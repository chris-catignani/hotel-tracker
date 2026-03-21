import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchExchangeRate, getCurrentRate } from "@/lib/exchange-rate";
import { apiError } from "@/lib/api-error";
import { CURRENCIES } from "@/lib/constants";
import { calculatePoints, resolveBasePointRate } from "@/lib/loyalty-utils";
import { reevaluateBookings } from "@/lib/promotion-matching";
import { logger } from "@/lib/logger";

const RATES_CDN =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const RATES_FALLBACK = "https://latest.currency-api.pages.dev/v1/currencies/usd.json";

export async function GET(request: NextRequest) {
  try {
    // Validate cron secret
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    // Step 1: Fetch all current rates in one request and upsert into ExchangeRate table
    const nonUsdCurrencies = CURRENCIES.filter((c) => c !== "USD");
    const upsertResults: string[] = [];

    try {
      let ratesRes = await fetch(RATES_CDN, { cache: "no-store" });
      if (!ratesRes.ok) ratesRes = await fetch(RATES_FALLBACK, { cache: "no-store" });
      if (!ratesRes.ok) throw new Error(`Rates API error: ${ratesRes.status}`);

      const ratesData = (await ratesRes.json()) as { usd: Record<string, number> };
      const rawRates = ratesData.usd; // 1 USD = X foreign

      for (const currency of nonUsdCurrencies) {
        const usdPerForeign = rawRates[currency.toLowerCase()];
        if (typeof usdPerForeign !== "number" || isNaN(usdPerForeign) || usdPerForeign === 0) {
          upsertResults.push(`${currency}=>NOT_FOUND`);
          continue;
        }
        const rate = 1 / usdPerForeign; // 1 foreign = X USD
        await prisma.exchangeRate.upsert({
          where: { fromCurrency_toCurrency: { fromCurrency: currency, toCurrency: "USD" } },
          update: { rate },
          create: { fromCurrency: currency, toCurrency: "USD", rate },
        });
        upsertResults.push(`${currency}=>${rate.toFixed(6)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Cron job failed during batch rate fetch", err, { context: "BATCH_FETCH" });
      upsertResults.push(`BATCH_FETCH=>ERROR: ${message}`);
    }

    // Step 2: Lock in exchange rates for past-due future bookings
    // Find bookings where checkIn <= today AND exchangeRate IS NULL AND currency != 'USD'
    const pastDueBookings = await prisma.booking.findMany({
      where: {
        checkIn: { lte: today },
        exchangeRate: null,
        NOT: { currency: "USD" },
      },
      include: {
        hotelChain: {
          include: {
            userStatuses: {
              include: { eliteStatus: true },
              take: 1,
            },
            pointType: true,
          },
        },
        hotelChainSubBrand: true,
      },
    });

    const lockedBookingIds: string[] = [];

    for (const booking of pastDueBookings) {
      try {
        const checkInStr = booking.checkIn.toISOString().split("T")[0];
        const rate = await fetchExchangeRate(booking.currency, checkInStr);

        // Compute loyalty points if not overridden (hotel stays only)
        let loyaltyPointsEarned = booking.loyaltyPointsEarned;
        if (loyaltyPointsEarned == null && booking.hotelChain) {
          const userStatus = booking.hotelChain.userStatuses[0] ?? null;
          const basePointRate = resolveBasePointRate(
            booking.hotelChain,
            booking.hotelChainSubBrand
          );

          const usdPretaxCost = Number(booking.pretaxCost) * rate;
          loyaltyPointsEarned = calculatePoints({
            pretaxCost: usdPretaxCost,
            basePointRate,
            eliteStatus: userStatus?.eliteStatus ?? null,
          });
        }

        const pt = booking.hotelChain?.pointType;
        const lockedLoyaltyUsdCentsPerPoint =
          pt?.programCurrency != null && pt?.programCentsPerPoint != null
            ? Number(pt.programCentsPerPoint) * rate
            : undefined;

        await prisma.booking.update({
          where: { id: booking.id },
          data: { exchangeRate: rate, loyaltyPointsEarned, lockedLoyaltyUsdCentsPerPoint },
        });
        lockedBookingIds.push(booking.id);
      } catch (err) {
        logger.error(`Failed to lock rate for booking ${booking.id}`, err, {
          context: "LOCK_BOOKING_RATE",
          bookingId: booking.id,
        });
        // Skip this booking on error; will retry next cron run
      }
    }

    // Step 3: Refresh USD value for foreign-currency PointTypes
    const pointTypesUpdated: string[] = [];
    const pointTypeBookingIds = new Set<string>();

    try {
      const foreignPointTypes = await prisma.pointType.findMany({
        where: { programCurrency: { not: null } },
        include: { hotelChains: { select: { id: true } } },
      });

      for (const pt of foreignPointTypes) {
        if (!pt.programCurrency || pt.programCentsPerPoint == null) continue;
        const rate = await getCurrentRate(pt.programCurrency);
        if (rate == null) {
          pointTypesUpdated.push(`${pt.name}=>NO_RATE`);
          continue;
        }
        const newUsd = Number(Number(pt.programCentsPerPoint) * rate).toFixed(3);
        await prisma.pointType.update({
          where: { id: pt.id },
          data: { usdCentsPerPoint: newUsd },
        });
        pointTypesUpdated.push(`${pt.name}=>${newUsd}`);

        // Collect booking IDs that have promotions linked to hotel chains using this point type
        const hotelChainIds = pt.hotelChains.map((hc) => hc.id);
        if (hotelChainIds.length > 0) {
          const affectedBookings = await prisma.booking.findMany({
            where: {
              hotelChainId: { in: hotelChainIds },
              bookingPromotions: { some: {} },
              checkIn: { gt: today },
            },
            select: { id: true },
          });
          for (const b of affectedBookings) pointTypeBookingIds.add(b.id);
        }
      }

      if (pointTypeBookingIds.size > 0) {
        await reevaluateBookings([...pointTypeBookingIds]);
      }
    } catch (err) {
      logger.error("Cron job failed during point type USD refresh", err, {
        context: "REFRESH_POINT_TYPE_USD",
      });
      pointTypesUpdated.push(`POINT_TYPE_REFRESH=>ERROR`);
    }

    return NextResponse.json({
      success: true,
      ratesUpdated: upsertResults,
      bookingsLocked: lockedBookingIds.length,
      pointTypesRefreshed: pointTypesUpdated,
      bookingsReevaluated: pointTypeBookingIds.size,
      date: todayStr,
    });
  } catch (error) {
    return apiError("Failed to refresh exchange rates", error, 500, request);
  }
}
