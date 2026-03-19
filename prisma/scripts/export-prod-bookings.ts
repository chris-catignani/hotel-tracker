/**
 * Exports all production bookings as a seed-compatible TypeScript file.
 *
 * Writes prisma/data/prod-bookings-export.ts which can replace seed-bookings.ts
 * (after review). Maps all IDs to their named constants where known.
 *
 * Setup:
 *   DATABASE_URL_PROD must be set in .env.local
 *
 * Usage:
 *   npm run db:export-bookings
 *
 * Output: prisma/data/prod-bookings-export.ts
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";

const prodUrl = process.env.DATABASE_URL_PROD;
if (!prodUrl) {
  console.error("✗ DATABASE_URL_PROD is not set. Add it to your .env.local and try again.");
  process.exit(1);
}
process.env.DATABASE_URL = prodUrl;
const prisma = new PrismaClient();

// ── ID → constant name maps ──────────────────────────────────────────────────

const HOTEL_ID_MAP: Record<string, string> = {
  c1v12til5p1ebxu77368umx5z: "HOTEL_ID.HILTON",
  c9uc76fdp3v95dccffxsa3h31: "HOTEL_ID.MARRIOTT",
  cxjdwg32a8xf7by36md0mdvuu: "HOTEL_ID.HYATT",
  co5ll49okbgq0fbceti8p0dpd: "HOTEL_ID.IHG",
  cwizlxi70wnbaq3qehma0fhbz: "HOTEL_ID.GHA_DISCOVERY",
  cv53wjloc78ambkei5wlnsvfn: "HOTEL_ID.ACCOR",
};

const SUB_BRAND_ID_MAP: Record<string, string> = {
  cmmnj4ily000ylpw8x09l0v31: "SUB_BRAND_ID.HILTON.HILTON",
  chp49do4y7cqmn8hslv1mybao: "SUB_BRAND_ID.MARRIOTT.AUTOGRAPH_COLLECTION",
  c6bbtoocrvncdrrbk132ja590: "SUB_BRAND_ID.MARRIOTT.CITIZENM",
  c4bwgkazkhr249673vbyrssjq: "SUB_BRAND_ID.MARRIOTT.MOXY",
  ceaflewyzoa8xcdfui5f510n0: "SUB_BRAND_ID.MARRIOTT.TRIBUTE_PORTFOLIO",
  cmmnj54i30046lpw8v1nqdjso: "SUB_BRAND_ID.HYATT.ALILA",
  c6b6y4o6u20bqlv0fjuvb9k6i: "SUB_BRAND_ID.HYATT.HYATT_CENTRIC",
  cmmepq6ks004jlpl1ghsje2x0: "SUB_BRAND_ID.HYATT.HYATT_HOUSE",
  cwf3srsbp7rv61q9c9f9zbapb: "SUB_BRAND_ID.HYATT.HYATT_PLACE",
  cmmnj5hlz004qlpw8bc3yyys8: "SUB_BRAND_ID.HYATT.HYATT_REGENCY",
  cd7oxx4b5kfe0rq65x74ha3gu: "SUB_BRAND_ID.HYATT.PARK_HYATT",
  cmmnj5nos005ilpw8qmcjxwv2: "SUB_BRAND_ID.HYATT.THE_STANDARD",
  cmmw44bvp000dl804919wjtpk: "SUB_BRAND_ID.HYATT.THE_STANDARDX",
  cmmnj5l9r006clpw8z261y2vc: "SUB_BRAND_ID.IHG.HOLIDAY_INN",
  cdfi8ldn9nllyjjrfqgeho0be: "SUB_BRAND_ID.IHG.HOLIDAY_INN_EXPRESS",
  caugp7vwgq7oy52v7h22eoj7f: "SUB_BRAND_ID.IHG.HOTEL_INDIGO",
  c0qxg9nbkd2qzlaz7cl0ek05c: "SUB_BRAND_ID.GHA_DISCOVERY.SUNWAY",
  cj7yen4u5zazxezcgzore4e71: "SUB_BRAND_ID.GHA_DISCOVERY.PARKROYAL",
  clsi50jt27f0upikgefn4y84v: "SUB_BRAND_ID.GHA_DISCOVERY.PARKROYAL_COLLECTION",
  cv2toj341anbybixocwk8voaq: "SUB_BRAND_ID.ACCOR.IBIS_STYLES",
  cmmnj6lhf00c6lpw8ro1u3xb0: "SUB_BRAND_ID.ACCOR.MONDRIAN",
  cmmnj6o3200cslpw8r2u56g5c: "SUB_BRAND_ID.ACCOR.SOFITEL",
};

const CREDIT_CARD_ID_MAP: Record<string, string> = {
  cme8yfwy2hfqahb6ync8czd24: "USER_CREDIT_CARD_ID.AMEX_PLATINUM",
  cmmw2ra4k0000l804o93d91fq: "USER_CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM",
  cw4yg6ftdskwq651p3p8nrvnr: "USER_CREDIT_CARD_ID.CHASE_SAPPHIRE_RESERVE",
  cmmw34t3r0004lb043y0858eo: "USER_CREDIT_CARD_ID.CHASE_WORLD_OF_HYATT",
  cvn8tp6d6nae4s543nno1qc6p: "USER_CREDIT_CARD_ID.WELLS_FARGO_AUTOGRAPH",
};

const PORTAL_ID_MAP: Record<string, string> = {
  cj774ttrj5g3wzk24foulu47x: "SHOPPING_PORTAL_ID.RAKUTEN",
  cnj91ehnjvuu34xnsa8l9lem4: "SHOPPING_PORTAL_ID.TOPCASHBACK",
  cjh7oskumoc40su7j747thqig: "SHOPPING_PORTAL_ID.BRITISH_AIRWAYS",
};

const OTA_ID_MAP: Record<string, string> = {
  cmmx05c59002gl804y96cjguj: "OTA_AGENCY_ID.AIRBNB",
  c2kjfusly4a0127ty3vj1ilii: "OTA_AGENCY_ID.AMEX_FHR",
  c0t44386bltnv0weekdizhsbo: "OTA_AGENCY_ID.AMEX_THC",
  c656cp2gyguq568kf1ukey5hz: "OTA_AGENCY_ID.CHASE_EDIT",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function id(map: Record<string, string>, val: string | null): string {
  if (val === null) return "null";
  return map[val] ? map[val] : `"${val}" /* unknown — add to seed-ids.ts */`;
}

function str(val: string | null | undefined): string {
  if (val === null || val === undefined) return "null";
  return JSON.stringify(val);
}

function decimal(val: unknown): string {
  if (val === null || val === undefined) return "null";
  return JSON.stringify(String(val));
}

function num(val: number | null | undefined): string {
  if (val === null || val === undefined) return "null";
  return String(val);
}

function date(val: Date | string | null | undefined): string {
  if (val === null || val === undefined) return "null";
  return JSON.stringify(new Date(val).toISOString());
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface RawBookingCard {
  id: string;
  credit_card_id: string | null;
}

async function main() {
  const host = prodUrl!.split("@")[1]?.split("/")[0] ?? prodUrl;
  console.log(`Connecting to production: ${host}`);

  // Read credit_card_id via raw SQL — it may not yet exist as a Prisma relation
  // (migration not yet deployed), but the column still exists on the table.
  const rawCards = await prisma.$queryRaw<RawBookingCard[]>`
    SELECT id, credit_card_id FROM bookings ORDER BY id
  `;
  const creditCardByBookingId = new Map(rawCards.map((r) => [r.id, r.credit_card_id]));

  // Use explicit select to avoid referencing columns added by the pending migration
  // (user_credit_card_id, booking_date, payment_timing) which don't exist in prod yet.
  const bookings = await prisma.booking.findMany({
    select: {
      id: true,
      accommodationType: true,
      hotelChainId: true,
      hotelChainSubBrandId: true,
      property: { select: { name: true, countryCode: true, city: true } },
      checkIn: true,
      checkOut: true,
      numNights: true,
      pretaxCost: true,
      taxAmount: true,
      totalCost: true,
      shoppingPortalId: true,
      portalCashbackRate: true,
      portalCashbackOnTotal: true,
      loyaltyPointsEarned: true,
      pointsRedeemed: true,
      currency: true,
      exchangeRate: true,
      bookingSource: true,
      otaAgencyId: true,
      notes: true,
      certificates: { select: { certType: true } },
      benefits: { select: { benefitType: true, dollarValue: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  console.log(`Found ${bookings.length} bookings. Generating seed file...`);

  const unknownSubBrands = new Set<string>();

  const lines: string[] = [
    `import { PrismaClient, BookingSourceType, CertType, BenefitType, AccommodationType } from "@prisma/client";`,
    `import { HOTEL_ID, SUB_BRAND_ID } from "../src/lib/constants";`,
    `import { USER_CREDIT_CARD_ID, SHOPPING_PORTAL_ID, OTA_AGENCY_ID } from "./seed-ids";`,
    ``,
    `const prisma = new PrismaClient();`,
    ``,
    `interface BookingSeedData {`,
    `  id: string;`,
    `  accommodationType: AccommodationType;`,
    `  hotelChainId: string | null;`,
    `  hotelChainSubBrandId: string | null;`,
    `  propertyName: string;`,
    `  countryCode: string;`,
    `  city: string;`,
    `  checkIn: string;`,
    `  checkOut: string;`,
    `  numNights: number;`,
    `  pretaxCost: string;`,
    `  taxAmount: string;`,
    `  totalCost: string;`,
    `  userCreditCardId: string | null;`,
    `  shoppingPortalId: string | null;`,
    `  portalCashbackRate: string | null;`,
    `  portalCashbackOnTotal: boolean;`,
    `  loyaltyPointsEarned: number | null;`,
    `  pointsRedeemed: number | null;`,
    `  currency: string;`,
    `  exchangeRate: number | null;`,
    `  bookingSource: string | null;`,
    `  otaAgencyId: string | null;`,
    `  notes: string | null;`,
    `  certificates: { certType: string }[];`,
    `  benefits: { benefitType: string; dollarValue?: number | string | null }[];`,
    `}`,
    ``,
    `export async function seedBookings(userId: string) {`,
    `  const bookings: BookingSeedData[] = [`,
  ];

  for (const b of bookings) {
    const subBrandRef = b.hotelChainSubBrandId
      ? (SUB_BRAND_ID_MAP[b.hotelChainSubBrandId] ?? null)
      : null;
    if (b.hotelChainSubBrandId && !subBrandRef) {
      unknownSubBrands.add(b.hotelChainSubBrandId);
    }

    // Map old credit_card_id → USER_CREDIT_CARD_ID constant
    const rawCreditCardId = creditCardByBookingId.get(b.id) ?? null;
    const uccRef = rawCreditCardId ? (CREDIT_CARD_ID_MAP[rawCreditCardId] ?? null) : null;

    lines.push(`    {`);
    lines.push(`      id: "${b.id}",`);
    lines.push(`      accommodationType: "${b.accommodationType}" as AccommodationType,`);
    lines.push(`      hotelChainId: ${id(HOTEL_ID_MAP, b.hotelChainId)},`);
    lines.push(
      `      hotelChainSubBrandId: ${subBrandRef ? subBrandRef : b.hotelChainSubBrandId ? `"${b.hotelChainSubBrandId}" /* unknown */` : "null"},`
    );
    lines.push(`      propertyName: ${str(b.property.name)},`);
    lines.push(`      countryCode: ${str(b.property.countryCode ?? "")},`);
    lines.push(`      city: ${str(b.property.city ?? "")},`);
    lines.push(`      checkIn: ${date(b.checkIn)},`);
    lines.push(`      checkOut: ${date(b.checkOut)},`);
    lines.push(`      numNights: ${b.numNights},`);
    lines.push(`      pretaxCost: ${decimal(b.pretaxCost)},`);
    lines.push(`      taxAmount: ${decimal(b.taxAmount)},`);
    lines.push(`      totalCost: ${decimal(b.totalCost)},`);
    lines.push(
      `      userCreditCardId: ${uccRef ? uccRef : rawCreditCardId ? `"${rawCreditCardId}" /* unknown credit card — add to CREDIT_CARD_ID_MAP */` : "null"},`
    );
    lines.push(`      shoppingPortalId: ${id(PORTAL_ID_MAP, b.shoppingPortalId)},`);
    lines.push(`      portalCashbackRate: ${decimal(b.portalCashbackRate)},`);
    lines.push(`      portalCashbackOnTotal: ${b.portalCashbackOnTotal},`);
    lines.push(`      loyaltyPointsEarned: ${num(b.loyaltyPointsEarned)},`);
    lines.push(`      pointsRedeemed: ${num(b.pointsRedeemed)},`);
    lines.push(`      currency: ${str(b.currency)},`);
    lines.push(`      exchangeRate: ${num(b.exchangeRate ? Number(b.exchangeRate) : null)},`);
    lines.push(`      bookingSource: ${str(b.bookingSource)},`);
    lines.push(`      otaAgencyId: ${id(OTA_ID_MAP, b.otaAgencyId)},`);
    lines.push(`      notes: ${str(b.notes)},`);

    const certs = b.certificates.map((c) => `{ certType: "${c.certType}" }`).join(", ");
    lines.push(`      certificates: [${certs}],`);

    const benefits = b.benefits
      .map((bf) => {
        const dv = bf.dollarValue != null ? `, dollarValue: ${decimal(bf.dollarValue)}` : "";
        return `{ benefitType: "${bf.benefitType}"${dv} }`;
      })
      .join(", ");
    lines.push(`      benefits: [${benefits}],`);

    lines.push(`    },`);
  }

  lines.push(`  ];`);
  lines.push(``);

  // Append the existing seedBookings loop body verbatim
  lines.push(
    `  for (const b of bookings) {`,
    `    const { certificates, benefits, propertyName, countryCode, city, accommodationType, ...bookingData } = b;`,
    ``,
    `    let property = await prisma.property.findFirst({`,
    `      where: { name: propertyName, hotelChainId: bookingData.hotelChainId },`,
    `    });`,
    `    if (!property) {`,
    `      property = await prisma.property.create({`,
    `        data: { name: propertyName, hotelChainId: bookingData.hotelChainId, countryCode, city },`,
    `      });`,
    `    }`,
    ``,
    `    const payload = {`,
    `      ...bookingData,`,
    `      accommodationType: accommodationType as AccommodationType,`,
    `      propertyId: property.id,`,
    `      bookingSource: bookingData.bookingSource as BookingSourceType,`,
    `      certificates: {`,
    `        create: certificates.map((c) => ({ certType: c.certType as CertType })),`,
    `      },`,
    `      benefits: {`,
    `        create: benefits.map((bf) => ({`,
    `          benefitType: bf.benefitType as BenefitType,`,
    `          dollarValue: bf.dollarValue ? Number(bf.dollarValue) : null,`,
    `        })),`,
    `      },`,
    `    };`,
    ``,
    `    await prisma.booking.upsert({`,
    `      where: { id: b.id },`,
    `      update: {`,
    `        ...payload,`,
    `        userId,`,
    `        certificates: { deleteMany: {}, ...payload.certificates },`,
    `        benefits: { deleteMany: {}, ...payload.benefits },`,
    `      },`,
    `      create: { ...payload, userId },`,
    `    });`,
    `  }`,
    ``,
    `  console.log("Bookings restored/upserted successfully");`,
    `}`,
    ``,
    `if (require.main === module) {`,
    `  const standaloneUserId = process.env.SEED_USER_ID ?? "";`,
    `  seedBookings(standaloneUserId)`,
    `    .catch((e) => {`,
    `      console.error(e);`,
    `      process.exit(1);`,
    `    })`,
    `    .finally(async () => {`,
    `      await prisma.$disconnect();`,
    `    });`,
    `}`
  );

  const outDir = path.join(__dirname, "../data");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prod-bookings-export.ts");
  writeFileSync(outPath, lines.join("\n") + "\n");

  console.log(`\n✓ Written to ${outPath}`);
  console.log(`  ${bookings.length} bookings exported`);

  if (unknownSubBrands.size > 0) {
    console.warn(`\n⚠ Unknown sub-brand IDs (add to SUB_BRAND_ID_MAP in this script):`);
    for (const id of unknownSubBrands) {
      console.warn(`    "${id}"`);
    }
  } else {
    console.log(`  All sub-brand IDs resolved to named constants.`);
  }

  console.log(`\nNext step: review ${outPath}, then copy it to prisma/seed-bookings.ts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
