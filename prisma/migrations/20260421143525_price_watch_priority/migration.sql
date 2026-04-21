-- AlterTable: add priority and updated_at to price_watches
ALTER TABLE "price_watches" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "price_watches" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- CreateIndex
CREATE INDEX "price_watches_priority_updated_at_idx" ON "price_watches"("priority", "updated_at");

-- DropIndex: old unique on booking_id alone
DROP INDEX "price_watch_bookings_booking_id_key";

-- CreateIndex: composite unique on (price_watch_id, booking_id)
CREATE UNIQUE INDEX "price_watch_bookings_price_watch_id_booking_id_key" ON "price_watch_bookings"("price_watch_id", "booking_id");
