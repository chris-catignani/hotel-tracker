import { NextRequest, NextResponse } from "next/server";
import { withObservability as withAxiom } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

const PRICE_WATCH_INCLUDE = {
  property: true,
  bookings: {
    include: {
      booking: {
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          numNights: true,
          totalCost: true,
          currency: true,
          hotelChain: { select: { name: true } },
        },
      },
    },
  },
  snapshots: {
    orderBy: { fetchedAt: "desc" as const },
    take: 1,
    include: { rooms: true },
  },
} as const;

/** GET /api/price-watches — list all price watches for the current user */
export const GET = withAxiom(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const watches = await prisma.priceWatch.findMany({
      where: { userId },
      include: PRICE_WATCH_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(watches);
  } catch (error) {
    return apiError("Failed to fetch price watches", error, 500, request);
  }
});

/**
 * POST /api/price-watches
 * Body: {
 *   propertyId,
 *   isEnabled?,
 *   bookingId?,          // link a booking to this watch
 *   cashThreshold?,      // per-booking alert threshold
 *   awardThreshold?,     // per-booking award threshold
 *   dateFlexibilityDays? // ±N days flexibility
 * }
 * Creates or updates (upserts) a PriceWatch for (userId, propertyId).
 * If bookingId is provided, also upserts a PriceWatchBooking.
 */
export const POST = withAxiom(async (request: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const body = await request.json();
    const {
      propertyId,
      isEnabled = true,
      bookingId,
      cashThreshold,
      awardThreshold,
      dateFlexibilityDays = 0,
    } = body;

    if (!propertyId) {
      return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
    }

    // Upsert the PriceWatch (one per user per property)
    const watch = await prisma.priceWatch.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      update: { isEnabled },
      create: { userId, propertyId, isEnabled },
    });

    // Optionally link a booking with per-booking config
    if (bookingId) {
      // IDOR protection: verify the booking belongs to the authenticated user
      const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId } });
      if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

      const resolvedCashThreshold = cashThreshold != null ? Number(cashThreshold) : null;
      const resolvedAwardThreshold = awardThreshold != null ? Number(awardThreshold) : null;
      const resolvedFlexibility = Number(dateFlexibilityDays) || 0;

      await prisma.priceWatchBooking.upsert({
        where: { bookingId },
        update: {
          priceWatchId: watch.id,
          cashThreshold: resolvedCashThreshold,
          awardThreshold: resolvedAwardThreshold,
          dateFlexibilityDays: resolvedFlexibility,
        },
        create: {
          priceWatchId: watch.id,
          bookingId,
          cashThreshold: resolvedCashThreshold,
          awardThreshold: resolvedAwardThreshold,
          dateFlexibilityDays: resolvedFlexibility,
        },
      });
    }

    const fullWatch = await prisma.priceWatch.findUnique({
      where: { id: watch.id },
      include: PRICE_WATCH_INCLUDE,
    });

    return NextResponse.json(fullWatch, { status: 201 });
  } catch (error) {
    return apiError("Failed to create price watch", error, 500, request);
  }
});
