/*
  Warnings:

  - A unique constraint covering the columns `[hotel_chain_id,chain_property_id]` on the table `properties` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotel_chain_id,chain_url_path]` on the table `properties` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "properties_hotel_chain_id_chain_property_id_key" ON "properties"("hotel_chain_id", "chain_property_id");

-- CreateIndex
CREATE UNIQUE INDEX "properties_hotel_chain_id_chain_url_path_key" ON "properties"("hotel_chain_id", "chain_url_path");
