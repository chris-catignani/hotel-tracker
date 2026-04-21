/*
  Warnings:

  - You are about to drop the column `date_flexibility_days` on the `price_watch_bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "price_watch_bookings" DROP COLUMN "date_flexibility_days";

-- AlterTable
ALTER TABLE "price_watches" ALTER COLUMN "updated_at" DROP DEFAULT;
