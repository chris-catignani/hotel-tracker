-- Migration created at Fri Apr 24 18:23:00 EDT 2026
-- AlterTable
ALTER TABLE "properties" DROP COLUMN "chain_categories",
DROP COLUMN "detail_last_fetched_at";
