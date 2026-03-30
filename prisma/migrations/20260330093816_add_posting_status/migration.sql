-- CreateEnum
CREATE TYPE "PostingStatus" AS ENUM ('pending', 'posted', 'failed');

-- AlterTable: BookingPromotion — drop verified, add postingStatus
ALTER TABLE "booking_promotions" DROP COLUMN "verified",
ADD COLUMN "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable: BookingCardBenefit — add postingStatus
ALTER TABLE "booking_card_benefits" ADD COLUMN "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable: BookingBenefit — add postingStatus
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
CREATE UNIQUE INDEX "booking_partnership_earn_statuses_booking_id_partnership_earn_id_key" ON "booking_partnership_earn_statuses"("booking_id", "partnership_earn_id");

-- AddForeignKey
ALTER TABLE "booking_partnership_earn_statuses" ADD CONSTRAINT "booking_partnership_earn_statuses_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_partnership_earn_statuses" ADD CONSTRAINT "booking_partnership_earn_statuses_partnership_earn_id_fkey" FOREIGN KEY ("partnership_earn_id") REFERENCES "partnership_earns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
