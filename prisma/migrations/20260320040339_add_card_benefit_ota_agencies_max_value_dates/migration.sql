-- AlterTable
ALTER TABLE "card_benefits" ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "max_value_per_booking" DECIMAL(10,2),
ADD COLUMN     "start_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "card_benefit_ota_agencies" (
    "card_benefit_id" TEXT NOT NULL,
    "ota_agency_id" TEXT NOT NULL,

    CONSTRAINT "card_benefit_ota_agencies_pkey" PRIMARY KEY ("card_benefit_id","ota_agency_id")
);

-- AddForeignKey
ALTER TABLE "card_benefit_ota_agencies" ADD CONSTRAINT "card_benefit_ota_agencies_card_benefit_id_fkey" FOREIGN KEY ("card_benefit_id") REFERENCES "card_benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_benefit_ota_agencies" ADD CONSTRAINT "card_benefit_ota_agencies_ota_agency_id_fkey" FOREIGN KEY ("ota_agency_id") REFERENCES "ota_agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
