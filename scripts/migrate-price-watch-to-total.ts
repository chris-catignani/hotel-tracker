import { config } from "dotenv";
config({ path: ".env.local" });

import prisma from "../src/lib/prisma";

/**
 * Migration: convert PriceWatchBooking thresholds from per-night to total stay cost.
 *
 * cashThreshold  → Math.floor(booking.totalCost)
 * awardThreshold → Math.floor(booking.pointsRedeemed)
 *
 * Also deletes all PriceSnapshot rows since they stored per-night prices and
 * are no longer meaningful after this change.
 *
 * Run with: npx tsx scripts/migrate-price-watch-to-total.ts
 */
async function main() {
  const pwbs = await prisma.priceWatchBooking.findMany({
    where: {
      OR: [{ cashThreshold: { not: null } }, { awardThreshold: { not: null } }],
    },
    include: {
      booking: {
        select: { id: true, totalCost: true, pointsRedeemed: true },
      },
    },
  });

  console.log(`Found ${pwbs.length} PriceWatchBooking row(s) with thresholds.\n`);

  for (const pwb of pwbs) {
    const newCash = pwb.cashThreshold !== null ? Math.floor(Number(pwb.booking.totalCost)) : null;
    const newAward =
      pwb.awardThreshold !== null ? Math.floor(pwb.booking.pointsRedeemed ?? 0) : null;

    console.log(`PriceWatchBooking ${pwb.id} (booking ${pwb.booking.id})`);
    if (pwb.cashThreshold !== null)
      console.log(`  cashThreshold:  ${pwb.cashThreshold} → ${newCash}`);
    if (pwb.awardThreshold !== null)
      console.log(`  awardThreshold: ${pwb.awardThreshold} → ${newAward}`);

    await prisma.priceWatchBooking.update({
      where: { id: pwb.id },
      data: { cashThreshold: newCash, awardThreshold: newAward },
    });
  }

  const { count: snapshotCount } = await prisma.priceSnapshot.deleteMany({});
  console.log(`\nDeleted ${snapshotCount} stale PriceSnapshot row(s).`);

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
