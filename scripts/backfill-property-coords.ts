import { config } from "dotenv";
config({ path: ".env.local" });

import prisma from "../src/lib/prisma";
import { searchProperties } from "../src/services/geo-lookup";

/**
 * Backfill: geocode all properties missing lat/lng using Google Places API.
 * Takes the top search result for each property name.
 * Also backfills placeId when the property doesn't have one.
 * Run with: npx tsx scripts/backfill-property-coords.ts
 */
async function main() {
  const properties = await prisma.property.findMany({
    where: { latitude: null },
    select: { id: true, name: true, city: true, countryCode: true, placeId: true },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${properties.length} properties missing coordinates.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const property of properties) {
    const parts = [property.name, property.city, property.countryCode].filter(Boolean);
    const query = parts.join(" ");

    process.stdout.write(`  ${property.name} ... `);

    try {
      const results = await searchProperties(query);
      const top = results[0];

      if (!top) {
        console.log("no results");
        skipped++;
      } else {
        await prisma.property.update({
          where: { id: property.id },
          data: {
            latitude: top.latitude,
            longitude: top.longitude,
            ...(!property.placeId && top.placeId ? { placeId: top.placeId } : {}),
          },
        });
        console.log(
          `✓ (${top.latitude!.toFixed(4)}, ${top.longitude!.toFixed(4)}) matched as "${top.displayName}"`
        );
        updated++;
      }
    } catch (e) {
      console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }

    // Pause between requests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nDone. Updated: ${updated}, No results: ${skipped}, Errors: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
