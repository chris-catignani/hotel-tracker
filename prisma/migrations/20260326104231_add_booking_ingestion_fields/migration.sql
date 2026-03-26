-- CreateEnum
CREATE TYPE "IngestionMethod" AS ENUM ('manual', 'email');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "confirmationNumber" TEXT,
ADD COLUMN     "ingestionMethod" "IngestionMethod" NOT NULL DEFAULT 'manual',
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false;
