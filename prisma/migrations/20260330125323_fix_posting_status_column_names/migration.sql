/*
  Warnings:

  - You are about to drop the column `postingStatus` on the `booking_benefits` table. All the data in the column will be lost.
  - You are about to drop the column `postingStatus` on the `booking_card_benefits` table. All the data in the column will be lost.
  - You are about to drop the column `postingStatus` on the `booking_partnership_earn_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `postingStatus` on the `booking_promotions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "booking_benefits" DROP COLUMN "postingStatus",
ADD COLUMN     "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "booking_card_benefits" DROP COLUMN "postingStatus",
ADD COLUMN     "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "booking_partnership_earn_statuses" DROP COLUMN "postingStatus",
ADD COLUMN     "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "booking_promotions" DROP COLUMN "postingStatus",
ADD COLUMN     "posting_status" "PostingStatus" NOT NULL DEFAULT 'pending';
