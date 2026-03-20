-- CreateTable
CREATE TABLE "exchange_rate_history" (
    "id" SERIAL NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,

    CONSTRAINT "exchange_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_history_from_currency_to_currency_date_key" ON "exchange_rate_history"("from_currency", "to_currency", "date");
