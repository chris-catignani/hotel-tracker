-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "pretax_cost" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "tax_amount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "total_cost" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "price_snapshot_rooms" ALTER COLUMN "cash_price" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "price_snapshots" ALTER COLUMN "lowest_refundable_cash_price" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "price_watch_bookings" ALTER COLUMN "cash_threshold" SET DATA TYPE DECIMAL(14,2);
