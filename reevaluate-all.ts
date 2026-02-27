import { PrismaClient } from "@prisma/client";
import { reevaluateBookings } from "./src/lib/promotion-matching";

const prisma = new PrismaClient();

async function main() {
  const allBookings = await prisma.booking.findMany({
    select: { id: true },
  });

  const ids = allBookings.map((b) => b.id);
  console.log(`Re-evaluating ALL ${ids.length} bookings for all promotions...`);

  // reevaluateBookings handles sequential processing and usage tracking internally
  await reevaluateBookings(ids);

  console.log("Global re-evaluation complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
