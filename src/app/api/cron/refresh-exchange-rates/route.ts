import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { refreshAllExchangeRates, refreshPointTypeUsdValues } from "@/services/exchange-rate";
import { finalizeCheckedInBookings } from "@/services/booking-enrichment";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Cron retrying after transient failure`, {
        context,
        attempt,
        maxAttempts,
        error: message,
      });
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }
  throw new Error("unreachable");
}

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

    let partialFailure = false;

    let upsertResults: string[] = [];
    try {
      upsertResults = await withRetry(() => refreshAllExchangeRates(), "BATCH_FETCH");
    } catch (err) {
      partialFailure = true;
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Cron job failed during batch rate fetch", err, { context: "BATCH_FETCH" });
      upsertResults.push(`BATCH_FETCH=>ERROR: ${message}`);
    }

    let lockedBookingIds: string[] = [];
    try {
      lockedBookingIds = await withRetry(() => finalizeCheckedInBookings(), "FINALIZE_BOOKINGS");
    } catch (err) {
      partialFailure = true;
      logger.error("Cron job failed during booking finalization", err, {
        context: "FINALIZE_BOOKINGS",
      });
    }

    let pointTypesUpdated: string[] = [];
    let bookingsReevaluated = 0;
    try {
      ({ pointTypesUpdated, bookingsReevaluated } = await withRetry(
        () => refreshPointTypeUsdValues(today),
        "REFRESH_POINT_TYPE_USD"
      ));
    } catch (err) {
      partialFailure = true;
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
      partialFailure,
    });

    return NextResponse.json(
      {
        success: !partialFailure,
        ratesUpdated: upsertResults,
        bookingsLocked: lockedBookingIds.length,
        pointTypesRefreshed: pointTypesUpdated,
        bookingsReevaluated,
        date: todayStr,
      },
      { status: partialFailure ? 207 : 200 }
    );
  } catch (error) {
    return apiError("Failed to refresh exchange rates", error, 500, request);
  }
}

export const GET = withObservability(handler);
