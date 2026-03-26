-- Rename camelCase columns to snake_case
ALTER TABLE "bookings" RENAME COLUMN "confirmationNumber" TO "confirmation_number";
ALTER TABLE "bookings" RENAME COLUMN "ingestionMethod" TO "ingestion_method";
ALTER TABLE "bookings" RENAME COLUMN "needsReview" TO "needs_review";
