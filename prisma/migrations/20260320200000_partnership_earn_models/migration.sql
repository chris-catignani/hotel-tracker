-- Drop the old accor_qantas_enabled column from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "accor_qantas_enabled";

-- CreateTable: partnership_earns
CREATE TABLE "partnership_earns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hotel_chain_id" TEXT,
    "point_type_id" TEXT NOT NULL,
    "earn_rate" DECIMAL(10,4) NOT NULL,
    "earn_currency" TEXT NOT NULL,
    "country_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "partnership_earns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_partnership_earns
CREATE TABLE "user_partnership_earns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "partnership_earn_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_partnership_earns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_partnership_earns_user_id_partnership_earn_id_key" ON "user_partnership_earns"("user_id", "partnership_earn_id");

-- AddForeignKey
ALTER TABLE "partnership_earns" ADD CONSTRAINT "partnership_earns_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnership_earns" ADD CONSTRAINT "partnership_earns_point_type_id_fkey" FOREIGN KEY ("point_type_id") REFERENCES "point_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_partnership_earns" ADD CONSTRAINT "user_partnership_earns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_partnership_earns" ADD CONSTRAINT "user_partnership_earns_partnership_earn_id_fkey" FOREIGN KEY ("partnership_earn_id") REFERENCES "partnership_earns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
