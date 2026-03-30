import { matchPromotionsForBooking } from "@/lib/promotion-matching";
import { reevaluateSubsequentBookings } from "@/lib/promotion-matching-helpers";
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
  const appliedPromoIds = await matchPromotionsForBooking(bookingId);

  logger.info("booking:created", {
    bookingId,
    promotionsApplied: appliedPromoIds.length,
    ...metadata,
  });

  await reevaluateSubsequentBookings(bookingId, appliedPromoIds);
  await reapplyCardBenefitsAffectedByBooking(bookingId);
}
