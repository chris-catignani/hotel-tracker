-- AlterTable
ALTER TABLE "promotion_restrictions" ADD COLUMN     "require_booked_after_registration" BOOLEAN NOT NULL DEFAULT false;
