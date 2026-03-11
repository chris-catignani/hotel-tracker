/**
 * Cron: refresh all active price watches and send email alerts.
 *
 * Designed to run via GitHub Actions (not Vercel cron) because Playwright
 * for cookie refresh exceeds Vercel's 50MB bundle limit.
 *
 * Auth: Bearer token via CRON_SECRET env var (same pattern as exchange-rates cron).
 *
 * GitHub Actions workflow: .github/workflows/refresh-price-watches.yml
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { createHyattFetcher } from "@/lib/scrapers/hyatt";
import { selectFetcher, type PriceFetcher } from "@/lib/price-fetcher";
import { sendPriceDropAlert } from "@/lib/email";

export async function GET(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build fetchers
    const fetchers: PriceFetcher[] = [createHyattFetcher()].filter(Boolean) as PriceFetcher[];

    // Find all enabled watches that have at least one upcoming booking
    const watches = await prisma.priceWatch.findMany({
      where: {
        isEnabled: true,
        bookings: {
          some: { booking: { checkIn: { gte: today } } },
        },
      },
      include: {
        property: true,
        bookings: {
          where: { booking: { checkIn: { gte: today } } },
          include: {
            booking: {
              select: {
                id: true,
                checkIn: true,
                checkOut: true,
                totalCost: true,
                currency: true,
              },
            },
          },
        },
        user: { select: { email: true } },
      },
    });

    const results: { watchId: string; property: string; snapshots: number; alerts: number }[] = [];

    for (const watch of watches) {
      const fetcher = selectFetcher(watch.property, fetchers);
      let snapshotCount = 0;
      let alertCount = 0;

      for (const pwb of watch.bookings) {
        const checkIn = new Date(pwb.booking.checkIn);
        const checkInStr = checkIn.toISOString().split("T")[0];
        const checkOutStr = new Date(pwb.booking.checkOut).toISOString().split("T")[0];

        let result = null;
        if (fetcher) {
          result = await fetcher.fetchPrice({
            property: watch.property,
            checkIn: checkInStr,
            checkOut: checkOutStr,
          });
        }

        if (result) {
          await prisma.priceSnapshot.create({
            data: {
              priceWatchId: watch.id,
              checkIn: new Date(checkInStr),
              checkOut: new Date(checkOutStr),
              cashPrice: result.cashPrice,
              cashCurrency: result.cashCurrency,
              awardPrice: result.awardPrice,
              source: result.source,
            },
          });
          snapshotCount++;

          // Check thresholds and send alert if met
          const cashHit =
            pwb.cashThreshold !== null &&
            result.cashPrice !== null &&
            result.cashPrice <= Number(pwb.cashThreshold);
          const awardHit =
            pwb.awardThreshold !== null &&
            result.awardPrice !== null &&
            result.awardPrice <= pwb.awardThreshold;

          if ((cashHit || awardHit) && watch.user.email) {
            await sendPriceDropAlert({
              to: watch.user.email,
              propertyName: watch.property.name,
              checkIn: checkInStr,
              checkOut: checkOutStr,
              cashPrice: result.cashPrice,
              cashCurrency: result.cashCurrency,
              cashThreshold: pwb.cashThreshold ? Number(pwb.cashThreshold) : null,
              awardPrice: result.awardPrice,
              awardThreshold: pwb.awardThreshold,
              bookingId: pwb.booking.id,
            });
            alertCount++;
          }
        }
      }

      await prisma.priceWatch.update({
        where: { id: watch.id },
        data: { lastCheckedAt: new Date() },
      });

      results.push({
        watchId: watch.id,
        property: watch.property.name,
        snapshots: snapshotCount,
        alerts: alertCount,
      });
    }

    return NextResponse.json({
      watched: watches.length,
      results,
    });
  } catch (error) {
    return apiError("Failed to refresh price watches", error, 500, request);
  }
}
