-- CreateEnum
CREATE TYPE "BenefitPeriod" AS ENUM ('monthly', 'quarterly', 'semi_annual', 'annual');

-- CreateTable
CREATE TABLE "card_benefits" (
    "id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "period" "BenefitPeriod" NOT NULL,
    "hotel_chain_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_card_benefits" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "card_benefit_id" TEXT NOT NULL,
    "applied_value" DECIMAL(10,2) NOT NULL,
    "period_key" TEXT NOT NULL,

    CONSTRAINT "booking_card_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_card_benefits_booking_id_card_benefit_id_key" ON "booking_card_benefits"("booking_id", "card_benefit_id");

-- AddForeignKey
ALTER TABLE "card_benefits" ADD CONSTRAINT "card_benefits_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_benefits" ADD CONSTRAINT "card_benefits_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_card_benefits" ADD CONSTRAINT "booking_card_benefits_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_card_benefits" ADD CONSTRAINT "booking_card_benefits_card_benefit_id_fkey" FOREIGN KEY ("card_benefit_id") REFERENCES "card_benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
