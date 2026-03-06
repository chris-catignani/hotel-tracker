import { PrismaClient } from "@prisma/client";
import { reevaluateBookings } from "../src/lib/promotion-matching";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting full re-evaluation of all bookings...");

  // Fetch all bookings sorted by check-in date to ensure chronological consistency
  // especially for spanStays and redemption caps.
  const bookings = await prisma.booking.findMany({
    select: { id: true },
    orderBy: { checkIn: "asc" },
  });

  const bookingIds = bookings.map((b) => b.id);

  if (bookingIds.length === 0) {
    console.log("No bookings found to re-evaluate.");
    return;
  }

  console.log(`Re-evaluating ${bookingIds.length} bookings...`);

  await reevaluateBookings(bookingIds);

  console.log("Full re-evaluation complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Re-evaluation failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
