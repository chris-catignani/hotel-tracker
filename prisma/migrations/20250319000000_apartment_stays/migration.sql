-- CreateEnum
CREATE TYPE "AccommodationType" AS ENUM ('hotel', 'apartment');

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_hotel_chain_id_fkey";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "accommodation_type" "AccommodationType" NOT NULL DEFAULT 'hotel',
ALTER COLUMN "hotel_chain_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "promotion_restrictions" ADD COLUMN     "allowed_accommodation_types" "AccommodationType"[] DEFAULT ARRAY[]::"AccommodationType"[];

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

