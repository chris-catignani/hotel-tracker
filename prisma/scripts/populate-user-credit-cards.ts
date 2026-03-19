/**
 * Step 2 of 2: Create UserCreditCard records and link them to bookings.
 *
 * Run this AFTER deploying the migration to production. Reads the JSON file
 * produced by export-booking-credit-cards.ts, creates one UserCreditCard per
 * unique (user, creditCard) pair, then sets user_credit_card_id on each booking.
 *
 * Setup:
 *   Add DATABASE_URL_PROD to your .env.local:
 *     DATABASE_URL_PROD="postgresql://..."
 *
 * Usage:
 *   npx tsx prisma/scripts/populate-user-credit-cards.ts
 *
 * Requires: prisma/data/booking-card-mapping.json (from export-booking-credit-cards.ts)
 * Idempotent: safe to re-run — skips UCCs that already exist, skips already-linked bookings.
 */

import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import path from "path";

// Must override DATABASE_URL before PrismaClient is imported/instantiated.
const prodUrl = process.env.DATABASE_URL_PROD;
if (!prodUrl) {
  console.error("✗ DATABASE_URL_PROD is not set.");
  console.error("  Add it to your .env.local and try again.");
  process.exit(1);
}
process.env.DATABASE_URL = prodUrl;

// Import after DATABASE_URL is set.
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

interface ExportedPair {
  userId: string;
  creditCardId: string;
  creditCardName: string;
  bookingIds: string[];
}

interface ExportData {
  exportedAt: string;
  summary: {
    totalBookings: number;
    bookingsWithCard: number;
  };
  pairs: ExportedPair[];
}

async function main() {
  const host = prodUrl!.split("@")[1]?.split("/")[0] ?? prodUrl;
  console.log(`Connecting to production: ${host}`);

  const mappingPath = path.join(__dirname, "../data/booking-card-mapping.json");
  if (!existsSync(mappingPath)) {
    console.error(`✗ Mapping file not found: ${mappingPath}`);
    console.error(`  Run export-booking-credit-cards.ts BEFORE the migration first.`);
    process.exit(1);
  }

  const data: ExportData = JSON.parse(readFileSync(mappingPath, "utf-8"));
  console.log(`Loaded mapping exported at ${data.exportedAt}`);
  console.log(
    `  ${data.summary.bookingsWithCard} bookings to link across ${data.pairs.length} (user, card) pair(s)\n`
  );

  let uccCreated = 0;
  let uccSkipped = 0;
  let bookingsLinked = 0;

  for (const pair of data.pairs) {
    // Check if a UserCreditCard already exists for this (userId, creditCardId)
    const existing = await prisma.userCreditCard.findFirst({
      where: { userId: pair.userId, creditCardId: pair.creditCardId },
    });

    let uccId: string;

    if (existing) {
      console.log(
        `  ↩ UserCreditCard already exists for ${pair.creditCardName} (id: ${existing.id})`
      );
      uccId = existing.id;
      uccSkipped++;
    } else {
      const ucc = await prisma.userCreditCard.create({
        data: {
          userId: pair.userId,
          creditCardId: pair.creditCardId,
          isActive: true,
        },
      });
      console.log(`  ✓ Created UserCreditCard for ${pair.creditCardName} (id: ${ucc.id})`);
      uccId = ucc.id;
      uccCreated++;
    }

    // Link all bookings that had this creditCardId to the new/existing UCC
    const { count } = await prisma.booking.updateMany({
      where: {
        id: { in: pair.bookingIds },
        userCreditCardId: null, // skip already-linked bookings
      },
      data: { userCreditCardId: uccId },
    });
    console.log(
      `    Linked ${count} of ${pair.bookingIds.length} booking(s)` +
        (pair.bookingIds.length - count > 0
          ? ` (${pair.bookingIds.length - count} already linked)`
          : "") +
        "\n"
    );
    bookingsLinked += count;
  }

  console.log("─".repeat(50));
  console.log(`UserCreditCards created:         ${uccCreated}`);
  console.log(`UserCreditCards already existed: ${uccSkipped}`);
  console.log(`Bookings linked:                 ${bookingsLinked}`);

  // Sanity check
  const unlinked = await prisma.booking.count({
    where: {
      id: { in: data.pairs.flatMap((p) => p.bookingIds) },
      userCreditCardId: null,
    },
  });
  if (unlinked > 0) {
    console.warn(
      `\n⚠ ${unlinked} booking(s) still have no userCreditCardId — investigate manually.`
    );
  } else {
    console.log(`\n✓ All bookings successfully linked.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
