-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_property_id_fkey";

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "property_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
