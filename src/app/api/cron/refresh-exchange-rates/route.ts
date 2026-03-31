import { NextRequest, NextResponse } from "next/server";
import { withObservability as withAxiom } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { getCurrentRate } from "@/lib/exchange-rate";
import { finalizeCheckedInBookings } from "@/lib/booking-enrichment";
import { apiError } from "@/lib/api-error";
import { CURRENCIES } from "@/lib/constants";
import { reevaluateBookings } from "@/lib/promotion-matching";
import { logger } from "@/lib/logger";

const RATES_CDN =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const RATES_FALLBACK = "https://latest.currency-api.pages.dev/v1/currencies/usd.json";

async function handler(request: NextRequest) {
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
    const lockedBookingIds = await finalizeCheckedInBookings();

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
        const newUsd = Number(Number(pt.programCentsPerPoint) * rate).toFixed(6);
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

    logger.info("exchange_rates:refreshed", {
      currenciesUpdated: upsertResults.filter(
        (r) => !r.includes("ERROR") && !r.includes("NOT_FOUND")
      ).length,
      currenciesNotFound: upsertResults.filter((r) => r.includes("NOT_FOUND")).length,
      bookingsLocked: lockedBookingIds.length,
      pointTypesRefreshed: pointTypesUpdated.filter(
        (r) => !r.includes("ERROR") && !r.includes("NO_RATE")
      ).length,
      bookingsReevaluated: pointTypeBookingIds.size,
    });

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

export const GET = withAxiom(handler);
