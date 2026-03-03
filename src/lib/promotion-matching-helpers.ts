import prisma from "./prisma";
import { reevaluateBookings, getAffectedBookingIds } from "./promotion-matching";

/**
 * Re-evaluates all bookings (past and future) that match specific promotions,
 * and optionally all bookings occurring after a specific date.
 *
 * This handles:
 * 1. "Unfulfillable" lookahead (global across the promotion)
 * 2. Prerequisite/Sequencing changes (all subsequent bookings)
 * 3. Redemption cap changes (all subsequent bookings)
 */
export async function reevaluateRelatedBookings(
  bookingId: string | null,
  promotionIds: string[],
  afterCheckIn?: Date
): Promise<void> {
  if (promotionIds.length === 0 && !afterCheckIn) return;

  const affectedPromoBookingIds = await getAffectedBookingIds(promotionIds);

  const affected = await prisma.booking.findMany({
    where: {
      OR: [
        ...(bookingId ? [{ id: bookingId }] : []),
        ...(affectedPromoBookingIds.length > 0
          ? [
              {
                id: { in: affectedPromoBookingIds },
              },
            ]
          : []),
        ...(afterCheckIn
          ? [
              {
                checkIn: { gt: afterCheckIn },
              },
            ]
          : []),
      ],
    },
    select: { id: true },
    orderBy: { checkIn: "asc" },
  });

  const queryIds = affected.map((b) => b.id);
  if (queryIds.length > 0) {
    await reevaluateBookings(queryIds);
  }
}
