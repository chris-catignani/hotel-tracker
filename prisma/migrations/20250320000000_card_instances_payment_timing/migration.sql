-- CreateEnum
CREATE TYPE "PaymentTiming" AS ENUM ('prepaid', 'postpaid');

-- CreateTable
CREATE TABLE "user_credit_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "nickname" TEXT,
    "opened_date" DATE,
    "closed_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_credit_cards_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "bookings"
    DROP COLUMN "credit_card_id",
    ADD COLUMN "user_credit_card_id" TEXT,
    ADD COLUMN "booking_date" DATE,
    ADD COLUMN "payment_timing" "PaymentTiming" NOT NULL DEFAULT 'postpaid';

-- AddForeignKey
ALTER TABLE "user_credit_cards" ADD CONSTRAINT "user_credit_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_credit_cards" ADD CONSTRAINT "user_credit_cards_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_credit_card_id_fkey" FOREIGN KEY ("user_credit_card_id") REFERENCES "user_credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
