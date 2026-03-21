-- Rename cents_per_point to usd_cents_per_point for clarity
ALTER TABLE "point_types" RENAME COLUMN "cents_per_point" TO "usd_cents_per_point";

-- Add program_currency and program_cents_per_point columns
ALTER TABLE "point_types" ADD COLUMN "program_currency" TEXT;
ALTER TABLE "point_types" ADD COLUMN "program_cents_per_point" DECIMAL(10,6);
