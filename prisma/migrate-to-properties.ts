/**
 * One-time data migration: creates Property rows from existing booking data
 * and sets booking.propertyId for all existing bookings.
 *
 * Run with: npx tsx prisma/migrate-to-properties.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting property migration...");

  const bookings = await prisma.booking.findMany({
    where: { propertyId: null },
    select: {
      id: true,
      propertyName: true,
      hotelChainId: true,
      countryCode: true,
      city: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${bookings.length} bookings without a propertyId.`);

  // Group by (propertyName, hotelChainId) — same name at the same chain = same property
  const propertyMap = new Map<
    string,
    { propertyName: string; hotelChainId: string; countryCode: string | null; city: string | null }
  >();

  for (const booking of bookings) {
    const key = `${booking.propertyName.toLowerCase().trim()}::${booking.hotelChainId}`;
    if (!propertyMap.has(key)) {
      propertyMap.set(key, {
        propertyName: booking.propertyName,
        hotelChainId: booking.hotelChainId,
        countryCode: booking.countryCode,
        city: booking.city,
      });
    }
  }

  console.log(`Creating ${propertyMap.size} unique Property rows...`);

  // Create Property rows
  const createdProperties = new Map<string, string>(); // key → Property.id

  for (const [key, data] of propertyMap.entries()) {
    const property = await prisma.property.create({
      data: {
        name: data.propertyName,
        hotelChainId: data.hotelChainId,
        countryCode: data.countryCode,
        city: data.city,
      },
    });
    createdProperties.set(key, property.id);
    console.log(`  Created: "${data.propertyName}" → ${property.id}`);
  }

  // Update bookings with their propertyId
  console.log("Linking bookings to properties...");
  let updated = 0;

  for (const booking of bookings) {
    const key = `${booking.propertyName.toLowerCase().trim()}::${booking.hotelChainId}`;
    const propertyId = createdProperties.get(key);
    if (!propertyId) continue;

    await prisma.booking.update({
      where: { id: booking.id },
      data: { propertyId },
    });
    updated++;
  }

  console.log(`Done. Updated ${updated} bookings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
