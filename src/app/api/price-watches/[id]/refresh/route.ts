import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { createHyattFetcher } from "@/lib/scrapers/hyatt";
import { selectFetcher, type PriceFetcher } from "@/lib/price-fetcher";

const RATE_LIMIT_MINUTES = 5;

/**
 * POST /api/price-watches/[id]/refresh
 * Manually triggers a price fetch for all upcoming bookings on this watch.
 * Rate-limited to once per 5 minutes per watch.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const watch = await prisma.priceWatch.findFirst({
      where: { id, userId },
      include: {
        property: true,
        bookings: { include: { booking: { select: { checkIn: true, checkOut: true } } } },
      },
    });
    if (!watch) return apiError("Price watch not found", null, 404, request);

    // Rate limit: don't allow refresh more than once per 5 minutes
    if (watch.lastCheckedAt) {
      const msSinceLast = Date.now() - watch.lastCheckedAt.getTime();
      if (msSinceLast < RATE_LIMIT_MINUTES * 60 * 1000) {
        return NextResponse.json(
          { error: `Please wait ${RATE_LIMIT_MINUTES} minutes between manual refreshes` },
          { status: 429 }
        );
      }
    }

    const fetchers = [createHyattFetcher()].filter(
      (f): f is NonNullable<typeof f> => f !== null
    ) as PriceFetcher[];
    const fetcher = selectFetcher(watch.property, fetchers);

    if (!fetcher) {
      return NextResponse.json(
        {
          error:
            "No price fetcher available for this property. Ensure HYATT_SESSION_COOKIE is set and Property.chainPropertyId is populated.",
        },
        { status: 422 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshots = [];
    for (const pwb of watch.bookings) {
      const checkIn = new Date(pwb.booking.checkIn);
      if (checkIn < today) continue;

      const checkInStr = checkIn.toISOString().split("T")[0];
      const checkOutStr = new Date(pwb.booking.checkOut).toISOString().split("T")[0];

      const result = await fetcher.fetchPrice({
        property: watch.property,
        checkIn: checkInStr,
        checkOut: checkOutStr,
      });

      if (result) {
        const snapshot = await prisma.priceSnapshot.create({
          data: {
            priceWatchId: id,
            checkIn: new Date(checkInStr),
            checkOut: new Date(checkOutStr),
            cashPrice: result.cashPrice,
            cashCurrency: result.cashCurrency,
            awardPrice: result.awardPrice,
            source: result.source,
          },
        });
        snapshots.push(snapshot);
      }
    }

    await prisma.priceWatch.update({
      where: { id },
      data: { lastCheckedAt: new Date() },
    });

    return NextResponse.json({ snapshots });
  } catch (error) {
    return apiError("Failed to refresh price watch", error, 500, request);
  }
}
