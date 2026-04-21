-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "chain_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "chain_url_path" TEXT,
ADD COLUMN     "detail_last_fetched_at" TIMESTAMP(3),
ADD COLUMN     "last_seen_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "properties_hotel_chain_id_latitude_longitude_idx" ON "properties"("hotel_chain_id", "latitude", "longitude");
