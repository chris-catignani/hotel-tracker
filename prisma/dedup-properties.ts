/**
 * One-time script: deduplicates Property rows that share the same (name, hotelChainId).
 * Keeps the earliest-created row, re-points all bookings to it, deletes the rest.
 *
 * Run with: npx tsx prisma/dedup-properties.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all (name, hotelChainId) groups with more than one property
  const allProperties = await prisma.property.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Group by name+chainId
  const groups = new Map<string, typeof allProperties>();
  for (const p of allProperties) {
    const key = `${p.name.toLowerCase().trim()}::${p.hotelChainId ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  let totalMerged = 0;
  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    const [keep, ...duplicates] = group; // keep oldest
    console.log(`\nMerging "${keep.name}" (${group.length} copies):`);
    console.log(`  Keeping:  ${keep.id} (created ${keep.createdAt.toISOString()})`);

    for (const dup of duplicates) {
      console.log(`  Deleting: ${dup.id} (created ${dup.createdAt.toISOString()})`);

      // Re-point bookings
      const updated = await prisma.booking.updateMany({
        where: { propertyId: dup.id },
        data: { propertyId: keep.id },
      });
      if (updated.count > 0) {
        console.log(`    Moved ${updated.count} booking(s) → ${keep.id}`);
      }

      // Re-point price watches
      const existingWatch = await prisma.priceWatch.findUnique({
        where: {
          userId_propertyId: {
            userId:
              (await prisma.priceWatch.findFirst({ where: { propertyId: dup.id } }))?.userId ?? "",
            propertyId: keep.id,
          },
        },
      });

      const dupWatches = await prisma.priceWatch.findMany({ where: { propertyId: dup.id } });
      for (const w of dupWatches) {
        if (existingWatch) {
          // Already a watch for this user+keep property — delete the duplicate watch
          await prisma.priceWatch.delete({ where: { id: w.id } });
        } else {
          await prisma.priceWatch.update({ where: { id: w.id }, data: { propertyId: keep.id } });
        }
      }

      await prisma.property.delete({ where: { id: dup.id } });
    }
    totalMerged += duplicates.length;
  }

  if (totalMerged === 0) {
    console.log("No duplicate properties found.");
  } else {
    console.log(`\nDone. Removed ${totalMerged} duplicate(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
