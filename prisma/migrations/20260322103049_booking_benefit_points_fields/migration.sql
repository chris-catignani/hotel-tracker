-- CreateEnum
CREATE TYPE "BenefitPointsEarnType" AS ENUM ('fixed_per_stay', 'fixed_per_night', 'multiplier_on_base');

-- AlterTable
ALTER TABLE "booking_benefits" ADD COLUMN     "points_amount" INTEGER,
ADD COLUMN     "points_earn_type" "BenefitPointsEarnType",
ADD COLUMN     "points_multiplier" DECIMAL(6,3);
