import prisma from "./prisma";
import { reevaluateBookings } from "./promotion-matching";

/**
 * Finds all bookings that occur after a given check-in date.
 */
export async function getSubsequentBookingIds(checkIn: Date): Promise<string[]> {
  const subsequentBookings = await prisma.booking.findMany({
    where: {
      checkIn: {
        gt: checkIn,
      },
    },
    select: { id: true },
    orderBy: { checkIn: "asc" },
  });

  return subsequentBookings.map((b) => b.id);
}

/**
 * Re-evaluates all bookings that occur after a given booking.
 * This is necessary because changes to an earlier booking can affect the
 * redemption capacity and eligibility for chronologically later stays.
 *
 * Optimization: If promotionIds are provided, only re-evaluates subsequent
 * bookings that either currently have one of those promotions or could
 * potentially match them.
 */
export async function reevaluateSubsequentBookings(
  bookingId: string,
  promotionIds?: string[]
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { checkIn: true },
  });

  if (!booking) return;

  let queryIds: string[] = [];

  if (promotionIds && promotionIds.length > 0) {
    // Optimized path: only find bookings after this stay that match the same promos
    const affected = await prisma.booking.findMany({
      where: {
        checkIn: { gt: booking.checkIn },
        bookingPromotions: {
          some: {
            promotionId: { in: promotionIds },
          },
        },
      },
      select: { id: true },
      orderBy: { checkIn: "asc" },
    });
    queryIds = affected.map((b) => b.id);
  } else {
    // Fallback: re-evaluate all future bookings (e.g. on deletion where we don't know what matched)
    queryIds = await getSubsequentBookingIds(booking.checkIn);
  }

  if (queryIds.length > 0) {
    await reevaluateBookings(queryIds);
  }
}
