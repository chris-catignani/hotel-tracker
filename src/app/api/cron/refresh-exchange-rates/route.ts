import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { refreshAllExchangeRates, refreshPointTypeUsdValues } from "@/services/exchange-rate";
import { finalizeCheckedInBookings } from "@/services/booking-enrichment";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

async function handler(request: NextRequest) {
  try {
    // Validate cron secret
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const today = new Date(todayStr); // UTC midnight, used in Prisma date filter

    let upsertResults: string[] = [];
    try {
      upsertResults = await refreshAllExchangeRates();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Cron job failed during batch rate fetch", err, { context: "BATCH_FETCH" });
      upsertResults.push(`BATCH_FETCH=>ERROR: ${message}`);
    }

    const lockedBookingIds = await finalizeCheckedInBookings();

    let pointTypesUpdated: string[] = [];
    let bookingsReevaluated = 0;
    try {
      ({ pointTypesUpdated, bookingsReevaluated } = await refreshPointTypeUsdValues(today));
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
      bookingsReevaluated,
    });

    return NextResponse.json({
      success: true,
      ratesUpdated: upsertResults,
      bookingsLocked: lockedBookingIds.length,
      pointTypesRefreshed: pointTypesUpdated,
      bookingsReevaluated,
      date: todayStr,
    });
  } catch (error) {
    return apiError("Failed to refresh exchange rates", error, 500, request);
  }
}

export const GET = withObservability(handler);
