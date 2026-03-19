/**
 * Step 1 of 2: Export the booking → credit_card_id mapping from production.
 *
 * Run this BEFORE deploying the migration to production (the migration drops
 * the credit_card_id column from bookings).
 *
 * Setup:
 *   Add DATABASE_URL_PROD to your .env.local:
 *     DATABASE_URL_PROD="postgresql://..."
 *
 * Usage:
 *   npm run db:export-cards
 *
 * Output: prisma/data/booking-card-mapping.json
 */

import dotenv from "dotenv";
import path from "path";
// dotenv/config only loads .env — explicitly load .env.local so DATABASE_URL_PROD is available
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config(); // fallback for .env
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";

const prodUrl = process.env.DATABASE_URL_PROD;
if (!prodUrl) {
  console.error("✗ DATABASE_URL_PROD is not set.");
  console.error("  Add it to your .env.local and try again.");
  process.exit(1);
}

// Set before instantiating PrismaClient — it reads DATABASE_URL at construction time.
process.env.DATABASE_URL = prodUrl;
const prisma = new PrismaClient();

interface BookingCardRow {
  booking_id: string;
  user_id: string;
  credit_card_id: string | null;
}

async function main() {
  const host = prodUrl!.split("@")[1]?.split("/")[0] ?? prodUrl;
  console.log(`Connecting to production: ${host}`);
  console.log("Exporting booking → credit_card_id mapping...\n");

  // Use raw SQL — credit_card_id no longer exists in the Prisma model after the
  // migration, but it still exists on production (migration not yet deployed).
  const rows = await prisma.$queryRaw<BookingCardRow[]>`
    SELECT id AS booking_id, user_id, credit_card_id
    FROM bookings
    ORDER BY id
  `;

  const withCard = rows.filter((r) => r.credit_card_id !== null);

  // Collect distinct (userId, creditCardId) pairs with their booking IDs
  const pairsMap = new Map<
    string,
    { userId: string; creditCardId: string; bookingIds: string[] }
  >();
  for (const row of withCard) {
    const key = `${row.user_id}::${row.credit_card_id}`;
    if (!pairsMap.has(key)) {
      pairsMap.set(key, { userId: row.user_id, creditCardId: row.credit_card_id!, bookingIds: [] });
    }
    pairsMap.get(key)!.bookingIds.push(row.booking_id);
  }

  // Look up credit card names for the summary
  const creditCardIds = [...new Set(withCard.map((r) => r.credit_card_id!))];
  const creditCards = await prisma.creditCard.findMany({
    where: { id: { in: creditCardIds } },
    select: { id: true, name: true },
  });
  const cardNames = new Map(creditCards.map((c) => [c.id, c.name]));

  const output = {
    exportedAt: new Date().toISOString(),
    summary: {
      totalBookings: rows.length,
      bookingsWithCard: withCard.length,
      bookingsWithoutCard: rows.length - withCard.length,
      uniquePairs: pairsMap.size,
    },
    pairs: Array.from(pairsMap.values()).map((p) => ({
      ...p,
      creditCardName: cardNames.get(p.creditCardId) ?? "unknown",
    })),
    // Full flat list used by populate-user-credit-cards.ts
    allBookings: rows,
  };

  const outDir = path.join(__dirname, "../data");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "booking-card-mapping.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`✓ Exported to ${outPath}`);
  console.log(`  Total bookings:        ${output.summary.totalBookings}`);
  console.log(`  Bookings with card:    ${output.summary.bookingsWithCard}`);
  console.log(`  Bookings without card: ${output.summary.bookingsWithoutCard}`);
  console.log(`\n  Unique (user, card) pairs:`);
  for (const p of output.pairs) {
    console.log(`    ${p.creditCardName} (${p.creditCardId}) — ${p.bookingIds.length} booking(s)`);
  }
  console.log(`\nNext step: deploy the migration, then run populate-user-credit-cards.ts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
