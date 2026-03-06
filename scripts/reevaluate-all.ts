import prisma from "../src/lib/prisma";
import { matchPromotionsForBooking } from "../src/lib/promotion-matching";

/**
 * Script to re-evaluate promotion matching for every booking in the database.
 * Useful after logic changes to ensure all historical data follows the new rules.
 */
async function main() {
  console.log("Starting full promotion re-evaluation...");

  const bookings = await prisma.booking.findMany({
    orderBy: { checkIn: "asc" },
    select: { id: true, propertyName: true, checkIn: true },
  });

  console.log(`Found ${bookings.length} bookings to process.`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const dateStr = new Date(booking.checkIn).toLocaleDateString();

    process.stdout.write(
      `[${i + 1}/${bookings.length}] Processing: ${booking.propertyName} (${dateStr})... `
    );

    try {
      await matchPromotionsForBooking(booking.id);
      console.log("✅");
      successCount++;
    } catch (error) {
      console.log("❌");
      console.error(`   Error processing booking ${booking.id}:`, error);
      errorCount++;
    }
  }

  console.log("\nRe-evaluation complete!");
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Failed:               ${errorCount}`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
