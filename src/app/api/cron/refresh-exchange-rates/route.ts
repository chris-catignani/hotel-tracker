import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchRateFromFrankfurter } from "@/lib/exchange-rate";
import { apiError } from "@/lib/api-error";
import { CURRENCIES } from "@/lib/constants";
import { calculatePoints } from "@/lib/loyalty-utils";

export async function GET(request: NextRequest) {
  try {
    // Validate cron secret
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    // Step 1: Fetch all current rates from Frankfurter and upsert into ExchangeRate table
    const nonUsdCurrencies = CURRENCIES.filter((c) => c !== "USD");
    const upsertResults: string[] = [];

    for (const currency of nonUsdCurrencies) {
      try {
        const rate = await fetchRateFromFrankfurter(currency, "latest");
        await prisma.exchangeRate.upsert({
          where: { fromCurrency_toCurrency: { fromCurrency: currency, toCurrency: "USD" } },
          update: { rate },
          create: { fromCurrency: currency, toCurrency: "USD", rate },
        });
        upsertResults.push(`${currency}=>${rate}`);
      } catch {
        upsertResults.push(`${currency}=>ERROR`);
      }
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
          },
        },
        hotelChainSubBrand: true,
      },
    });

    const lockedBookingIds: string[] = [];

    for (const booking of pastDueBookings) {
      try {
        const checkInStr = booking.checkIn.toISOString().split("T")[0];
        const rate = await fetchRateFromFrankfurter(booking.currency, checkInStr);

        // Compute loyalty points if not overridden
        let loyaltyPointsEarned = booking.loyaltyPointsEarned;
        if (loyaltyPointsEarned == null) {
          const userStatus = booking.hotelChain.userStatuses[0] ?? null;
          const basePointRate = booking.hotelChainSubBrand?.basePointRate
            ? Number(booking.hotelChainSubBrand.basePointRate)
            : booking.hotelChain.basePointRate
              ? Number(booking.hotelChain.basePointRate)
              : null;

          const usdPretaxCost = Number(booking.pretaxCost) * rate;
          loyaltyPointsEarned = calculatePoints({
            pretaxCost: usdPretaxCost,
            basePointRate,
            eliteStatus: userStatus?.eliteStatus ?? null,
          });
        }

        await prisma.booking.update({
          where: { id: booking.id },
          data: { exchangeRate: rate, loyaltyPointsEarned },
        });
        lockedBookingIds.push(booking.id);
      } catch {
        // Skip this booking on error; will retry next cron run
      }
    }

    return NextResponse.json({
      success: true,
      ratesUpdated: upsertResults,
      bookingsLocked: lockedBookingIds.length,
      date: todayStr,
    });
  } catch (error) {
    return apiError("Failed to refresh exchange rates", error, 500, request);
  }
}
