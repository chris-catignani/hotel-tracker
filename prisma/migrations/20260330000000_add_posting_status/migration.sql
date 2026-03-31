-- CreateEnum
CREATE TYPE "PostingStatus" AS ENUM ('pending', 'posted', 'failed');

-- AlterTable: BookingPromotion — drop verified, add posting_status
ALTER TABLE "booking_promotions" DROP COLUMN "verified",
ADD COLUMN "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable: BookingCardBenefit — add posting_status
ALTER TABLE "booking_card_benefits" ADD COLUMN "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable: BookingBenefit — add posting_status
ALTER TABLE "booking_benefits" ADD COLUMN "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable: Booking — add loyalty/card/portal posting status columns
ALTER TABLE "bookings"
ADD COLUMN "loyalty_posting_status" "PostingStatus",
ADD COLUMN "card_reward_posting_status" "PostingStatus",
ADD COLUMN "portal_cashback_posting_status" "PostingStatus";

-- CreateTable: BookingPartnershipEarnStatus
CREATE TABLE "booking_partnership_earn_statuses" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "partnership_earn_id" TEXT NOT NULL,
    "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "booking_partnership_earn_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_partnership_earn_statuses_booking_id_partnership_ea_key" ON "booking_partnership_earn_statuses"("booking_id", "partnership_earn_id");

-- AddForeignKey
ALTER TABLE "booking_partnership_earn_statuses" ADD CONSTRAINT "booking_partnership_earn_statuses_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_partnership_earn_statuses" ADD CONSTRAINT "booking_partnership_earn_statuses_partnership_earn_id_fkey" FOREIGN KEY ("partnership_earn_id") REFERENCES "partnership_earns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill posting statuses for existing bookings that predate the feature.
-- Only sets pending for bookings that actually have something to post.
UPDATE bookings
SET loyalty_posting_status = 'pending'::"PostingStatus"
WHERE loyalty_posting_status IS NULL
  AND loyalty_points_earned IS NOT NULL
  AND loyalty_points_earned > 0
  AND accommodation_type != 'apartment'
  AND hotel_chain_id IS NOT NULL;

UPDATE bookings
SET card_reward_posting_status = 'pending'::"PostingStatus"
WHERE card_reward_posting_status IS NULL
  AND user_credit_card_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM user_credit_cards ucc
    JOIN credit_cards cc ON cc.id = ucc.credit_card_id
    JOIN credit_card_reward_rules r ON r.credit_card_id = cc.id
    WHERE ucc.id = bookings.user_credit_card_id
  );

UPDATE bookings
SET portal_cashback_posting_status = 'pending'::"PostingStatus"
WHERE portal_cashback_posting_status IS NULL
  AND shopping_portal_id IS NOT NULL;
