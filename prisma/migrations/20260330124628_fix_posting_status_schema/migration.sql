/*
  Warnings:

  - You are about to drop the column `posting_status` on the `booking_benefits` table. All the data in the column will be lost.
  - You are about to drop the column `posting_status` on the `booking_card_benefits` table. All the data in the column will be lost.
  - You are about to drop the column `posting_status` on the `booking_partnership_earn_statuses` table. All the data in the column will be lost.
  - You are about to drop the column `posting_status` on the `booking_promotions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "booking_benefits" DROP COLUMN "posting_status",
ADD COLUMN     "postingStatus" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "booking_card_benefits" DROP COLUMN "posting_status",
ADD COLUMN     "postingStatus" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "booking_partnership_earn_statuses" DROP COLUMN "posting_status",
ADD COLUMN     "postingStatus" "PostingStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "booking_promotions" DROP COLUMN "posting_status",
ADD COLUMN     "postingStatus" "PostingStatus" NOT NULL DEFAULT 'pending';

-- RenameIndex
ALTER INDEX "booking_partnership_earn_statuses_booking_id_partnership_earn_i" RENAME TO "booking_partnership_earn_statuses_booking_id_partnership_ea_key";
