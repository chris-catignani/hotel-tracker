import { matchPromotionsForBooking, reevaluateSubsequentBookings } from "@/lib/promotion-apply";
import { reapplyCardBenefitsAffectedByBooking } from "@/lib/card-benefit-apply";
import { logger } from "@/lib/logger";

export interface PostBookingCreateMetadata {
  userId: string;
  accommodationType: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  totalCost: number;
  currency: string;
  ingestionMethod: string;
}

export async function runPostBookingCreate(
  bookingId: string,
  metadata: PostBookingCreateMetadata
): Promise<void> {
  const { userId } = metadata;
  const appliedPromoIds = await matchPromotionsForBooking(bookingId, userId);

  logger.info("booking:created", {
    bookingId,
    promotionsApplied: appliedPromoIds.length,
    ...metadata,
  });

  await reevaluateSubsequentBookings(bookingId, userId, appliedPromoIds);
  await reapplyCardBenefitsAffectedByBooking(bookingId);
}
