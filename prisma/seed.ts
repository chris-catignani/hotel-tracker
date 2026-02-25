import { PrismaClient } from "@prisma/client";
import { HOTEL_ID } from "../src/lib/constants";

const prisma = new PrismaClient();

interface EliteStatusData {
  name: string;
  bonusPercentage?: number;
  fixedRate?: number;
  isFixed?: boolean;
  eliteTierLevel: number;
}

interface SubBrandData {
  name: string;
  basePointRate?: number;
}

async function upsertEliteStatuses(hotelChainId: number, statuses: EliteStatusData[]) {
  for (const status of statuses) {
    await prisma.hotelChainEliteStatus.upsert({
      where: {
        hotelChainId_name: {
          hotelChainId,
          name: status.name,
        },
      },
      update: status,
      create: {
        ...status,
        hotelChainId,
      },
    });
  }
}

/**
 * Utility function used to generate the shortened names above.
 * Kept here for future use when adding new brands to the seed data.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function shortenName(name: string): string {
  // 1. Specific Exceptions for collisions or specific branding
  if (name === "Autograph Collection Hotels") return "Autograph Collection";
  if (name === "PARKROYAL COLLECTION Hotels & Resorts") return "PARKROYAL COLLECTION";
  if (name === "Hilton Club") return "Hilton Club";
  if (name === "Hilton Vacation Club") return "Hilton Vacation Club";
  if (name === "Holiday Inn Club Vacations") return "Holiday Inn Club";
  if (name === "NH Hotels & Resorts") return "NH Hotels";

  // 2. General Suffix Removals
  return name
    .replace(/\s+Resorts\s+&\s+Spas$/i, "")
    .replace(/\s+Wellness\s+&\s+Spa\s+Resorts$/i, "")
    .replace(/\s+Hotels\s+&\s+Resorts$/i, "")
    .replace(/\s+by\s+Hilton$/i, "")
    .replace(/\s+Resorts\s+&\s+Hotels$/i, "")
    .replace(/\s+Hotels\s+&\s+Restaurants$/i, "")
    .replace(/\s+Hotels\s+Resorts\s+Spas$/i, "")
    .replace(/\s+Hotels,\s+Resorts\s+and\s+Suites$/i, "")
    .replace(/\s+Collection\s+Hotels$/i, "")
    .replace(/\s+Hotels$/i, "")
    .replace(/\s+by\s+Marriott$/i, "")
    .replace(/\s+by\s+Hyatt$/i, "")
    .replace(/\s+by\s+Rotana$/i, "")
    .trim();
}

async function upsertSubBrands(hotelChainId: number, subBrands: SubBrandData[]) {
  for (let i = 0; i < subBrands.length; i++) {
    const sb = subBrands[i];
    const fixedId = hotelChainId * 1000 + (i + 1);

    await prisma.hotelChainSubBrand.upsert({
      where: { id: fixedId },
      update: {
        name: sb.name,
        hotelChainId,
        basePointRate: sb.basePointRate,
      },
      create: {
        id: fixedId,
        name: sb.name,
        hotelChainId,
        basePointRate: sb.basePointRate,
      },
    });
  }
}

async function upsertUserStatus(hotelChainId: number, statusName: string) {
  const eliteStatus = await prisma.hotelChainEliteStatus.findFirst({
    where: { hotelChainId, name: statusName },
  });
  if (eliteStatus) {
    await prisma.userStatus.upsert({
      where: { hotelChainId },
      update: { eliteStatusId: eliteStatus.id },
      create: { hotelChainId, eliteStatusId: eliteStatus.id },
    });
  }
}

async function main() {
  // PointTypes
  await prisma.pointType.upsert({
    where: { id: 1 },
    update: { name: "Hilton Honors Points", category: "hotel", centsPerPoint: 0.0045 },
    create: { id: 1, name: "Hilton Honors Points", category: "hotel", centsPerPoint: 0.0045 },
  });
  await prisma.pointType.upsert({
    where: { id: 2 },
    update: { name: "Marriott Bonvoy Points", category: "hotel", centsPerPoint: 0.007 },
    create: { id: 2, name: "Marriott Bonvoy Points", category: "hotel", centsPerPoint: 0.007 },
  });
  await prisma.pointType.upsert({
    where: { id: 3 },
    update: { name: "World of Hyatt Points", category: "hotel", centsPerPoint: 0.02 },
    create: { id: 3, name: "World of Hyatt Points", category: "hotel", centsPerPoint: 0.02 },
  });
  await prisma.pointType.upsert({
    where: { id: 4 },
    update: { name: "IHG One Rewards", category: "hotel", centsPerPoint: 0.006 },
    create: { id: 4, name: "IHG One Rewards", category: "hotel", centsPerPoint: 0.006 },
  });
  await prisma.pointType.upsert({
    where: { id: 5 },
    update: { name: "Discovery Dollars", category: "hotel", centsPerPoint: 0.01 },
    create: { id: 5, name: "Discovery Dollars", category: "hotel", centsPerPoint: 0.01 },
  });
  await prisma.pointType.upsert({
    where: { id: 6 },
    update: { name: "ALL - Accor Live Limitless", category: "hotel", centsPerPoint: 0.022 },
    create: { id: 6, name: "ALL - Accor Live Limitless", category: "hotel", centsPerPoint: 0.022 },
  });
  await prisma.pointType.upsert({
    where: { id: 7 },
    update: { name: "Membership Rewards", category: "transferable", centsPerPoint: 0.02 },
    create: { id: 7, name: "Membership Rewards", category: "transferable", centsPerPoint: 0.02 },
  });
  await prisma.pointType.upsert({
    where: { id: 8 },
    update: { name: "Ultimate Rewards", category: "transferable", centsPerPoint: 0.02 },
    create: { id: 8, name: "Ultimate Rewards", category: "transferable", centsPerPoint: 0.02 },
  });
  await prisma.pointType.upsert({
    where: { id: 9 },
    update: { name: "Capital One Miles", category: "transferable", centsPerPoint: 0.0175 },
    create: { id: 9, name: "Capital One Miles", category: "transferable", centsPerPoint: 0.0175 },
  });
  await prisma.pointType.upsert({
    where: { id: 10 },
    update: { name: "Avios", category: "airline", centsPerPoint: 0.012 },
    create: { id: 10, name: "Avios", category: "airline", centsPerPoint: 0.012 },
  });
  await prisma.pointType.upsert({
    where: { id: 11 },
    update: { name: "Bilt", category: "transferable", centsPerPoint: 0.02 },
    create: { id: 11, name: "Bilt", category: "transferable", centsPerPoint: 0.02 },
  });
  await prisma.pointType.upsert({
    where: { id: 12 },
    update: { name: "Wells Fargo Rewards", category: "transferable", centsPerPoint: 0.015 },
    create: { id: 12, name: "Wells Fargo Rewards", category: "transferable", centsPerPoint: 0.015 },
  });

  // Hilton
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.HILTON },
    update: { name: "Hilton", loyaltyProgram: "Hilton Honors", basePointRate: 10, pointTypeId: 1 },
    create: {
      id: HOTEL_ID.HILTON,
      name: "Hilton",
      loyaltyProgram: "Hilton Honors",
      basePointRate: 10,
      pointTypeId: 1,
    },
  });
  await upsertEliteStatuses(HOTEL_ID.HILTON, [
    { name: "Silver", bonusPercentage: 0.2, eliteTierLevel: 1 },
    { name: "Gold", bonusPercentage: 0.8, eliteTierLevel: 2 },
    { name: "Diamond", bonusPercentage: 1.0, eliteTierLevel: 3 },
    { name: "Diamond Reserve", bonusPercentage: 1.2, eliteTierLevel: 4 },
  ]);
  await upsertSubBrands(HOTEL_ID.HILTON, [
    { name: "Apartment Collection" },
    { name: "Canopy" },
    { name: "Conrad" },
    { name: "Curio Collection" },
    { name: "DoubleTree" },
    { name: "Embassy Suites" },
    { name: "Graduate" },
    { name: "Hampton" },
    { name: "Hilton Club" },
    { name: "Hilton Garden Inn" },
    { name: "Hilton Grand Vacations" },
    { name: "Hilton" },
    { name: "Hilton Vacation Club" },
    { name: "Home2 Suites", basePointRate: 5 },
    { name: "Homewood Suites", basePointRate: 5 },
    { name: "LivSmart Studios", basePointRate: 5 },
    { name: "LXR" },
    { name: "Motto" },
    { name: "NoMad" },
    { name: "Signia" },
    { name: "Spark", basePointRate: 5 },
    { name: "Tapestry Collection" },
    { name: "Tempo" },
    { name: "Tru", basePointRate: 5 },
    { name: "Waldorf Astoria" },
  ]);

  // Marriott
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.MARRIOTT },
    update: {
      name: "Marriott",
      loyaltyProgram: "Marriott Bonvoy",
      basePointRate: 10,
      pointTypeId: 2,
    },
    create: {
      id: HOTEL_ID.MARRIOTT,
      name: "Marriott",
      loyaltyProgram: "Marriott Bonvoy",
      basePointRate: 10,
      pointTypeId: 2,
    },
  });
  await upsertEliteStatuses(HOTEL_ID.MARRIOTT, [
    { name: "Silver", bonusPercentage: 0.1, eliteTierLevel: 1 },
    { name: "Gold", bonusPercentage: 0.25, eliteTierLevel: 2 },
    { name: "Platinum", bonusPercentage: 0.5, eliteTierLevel: 3 },
    { name: "Titanium", bonusPercentage: 0.75, eliteTierLevel: 4 },
    { name: "Ambassador", bonusPercentage: 0.75, eliteTierLevel: 5 },
  ]);
  await upsertSubBrands(HOTEL_ID.MARRIOTT, [
    { name: "AC Hotels" },
    { name: "Aloft" },
    { name: "Apartments by Marriott Bonvoy", basePointRate: 5 },
    { name: "Autograph Collection" },
    { name: "Bulgari" },
    { name: "City Express", basePointRate: 5 },
    { name: "citizenM" },
    { name: "Courtyard" },
    { name: "Delta" },
    { name: "Design" },
    { name: "EDITION" },
    { name: "Element", basePointRate: 5 },
    { name: "Fairfield" },
    { name: "Four Points" },
    { name: "Four Points Express", basePointRate: 5 },
    { name: "Four Points Flex", basePointRate: 5 },
    { name: "Gaylord" },
    { name: "Homes & Villas", basePointRate: 5 },
    { name: "JW Marriott" },
    { name: "Le Meridien" },
    { name: "Marriott Executive Apartments", basePointRate: 5 },
    { name: "Marriott" },
    { name: "Marriott Vacation Club" },
    { name: "MGM Collection" },
    { name: "Moxy" },
    { name: "Protea", basePointRate: 5 },
    { name: "Renaissance" },
    { name: "Residence Inn", basePointRate: 5 },
    { name: "Ritz-Carlton Reserve" },
    { name: "Sheraton" },
    { name: "SpringHill Suites" },
    { name: "St. Regis" },
    { name: "StudioRes", basePointRate: 5 },
    { name: "The Luxury Collection" },
    { name: "The Ritz-Carlton" },
    { name: "TownePlace Suites", basePointRate: 5 },
    { name: "Tribute Portfolio" },
    { name: "W Hotels" },
    { name: "Westin" },
  ]);

  // Hyatt
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.HYATT },
    update: { name: "Hyatt", loyaltyProgram: "World of Hyatt", basePointRate: 5, pointTypeId: 3 },
    create: {
      id: HOTEL_ID.HYATT,
      name: "Hyatt",
      loyaltyProgram: "World of Hyatt",
      basePointRate: 5,
      pointTypeId: 3,
    },
  });
  await upsertEliteStatuses(HOTEL_ID.HYATT, [
    { name: "Discoverist", bonusPercentage: 0.1, eliteTierLevel: 1 },
    { name: "Explorist", bonusPercentage: 0.2, eliteTierLevel: 2 },
    { name: "Globalist", bonusPercentage: 0.3, eliteTierLevel: 3 },
  ]);
  await upsertSubBrands(HOTEL_ID.HYATT, [
    { name: "Alila" },
    { name: "Alua" },
    { name: "Andaz" },
    { name: "Breathless" },
    { name: "Caption" },
    { name: "Destination" },
    { name: "Dream" },
    { name: "Dreams" },
    { name: "Grand Hyatt" },
    { name: "Hyatt Centric" },
    { name: "Hyatt House" },
    { name: "Hyatt Place" },
    { name: "Hyatt Regency" },
    { name: "Hyatt Studios", basePointRate: 2.5 },
    { name: "Hyatt Vacation Club" },
    { name: "Hyatt Vivid" },
    { name: "Hyatt Zilara" },
    { name: "Hyatt Ziva" },
    { name: "Impression by Secrets" },
    { name: "JdV" },
    { name: "Miraval" },
    { name: "Park Hyatt" },
    { name: "Secrets" },
    { name: "Sunscape" },
    { name: "The Unbound Collection" },
    { name: "Thompson" },
    { name: "Zoetry" },
  ]);

  // IHG
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.IHG },
    update: { name: "IHG", loyaltyProgram: "IHG One Rewards", basePointRate: 10, pointTypeId: 4 },
    create: {
      id: HOTEL_ID.IHG,
      name: "IHG",
      loyaltyProgram: "IHG One Rewards",
      basePointRate: 10,
      pointTypeId: 4,
    },
  });
  await upsertEliteStatuses(HOTEL_ID.IHG, [
    { name: "Silver", bonusPercentage: 0.2, eliteTierLevel: 1 },
    { name: "Gold", bonusPercentage: 0.4, eliteTierLevel: 2 },
    { name: "Platinum", bonusPercentage: 0.6, eliteTierLevel: 3 },
    { name: "Diamond", bonusPercentage: 1.0, eliteTierLevel: 4 },
  ]);
  await upsertSubBrands(HOTEL_ID.IHG, [
    { name: "Atwell Suites" },
    { name: "avid" },
    { name: "Candlewood Suites", basePointRate: 5 },
    { name: "Crowne Plaza" },
    { name: "Even" },
    { name: "Garner" },
    { name: "Holiday Inn Club Vacations" },
    { name: "Holiday Inn Express" },
    { name: "Holiday Inn" },
    { name: "Hotel Indigo" },
    { name: "HUALUXE" },
    { name: "Iberostar" },
    { name: "InterContinental" },
    { name: "Kimpton" },
    { name: "Regent" },
    { name: "Six Senses" },
    { name: "Staybridge Suites", basePointRate: 5 },
    { name: "Vignette Collection" },
    { name: "voco" },
  ]);

  // GHA Discovery
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.GHA_DISCOVERY },
    update: {
      name: "GHA Discovery",
      loyaltyProgram: "GHA Discovery",
      basePointRate: 4,
      pointTypeId: 5,
    },
    create: {
      id: HOTEL_ID.GHA_DISCOVERY,
      name: "GHA Discovery",
      loyaltyProgram: "GHA Discovery",
      basePointRate: 4,
      pointTypeId: 5,
    },
  });
  await upsertEliteStatuses(HOTEL_ID.GHA_DISCOVERY, [
    { name: "Silver", fixedRate: 4, isFixed: true, eliteTierLevel: 1 },
    { name: "Gold", fixedRate: 5, isFixed: true, eliteTierLevel: 2 },
    { name: "Platinum", fixedRate: 6, isFixed: true, eliteTierLevel: 3 },
    { name: "Titanium", fixedRate: 7, isFixed: true, eliteTierLevel: 4 },
  ]);
  await upsertSubBrands(HOTEL_ID.GHA_DISCOVERY, [
    { name: "Anantara" },
    { name: "Andronis" },
    { name: "Araiya" },
    { name: "Arjaan" },
    { name: "ASMALLWORLD" },
    { name: "Avani" },
    { name: "Bristoria" },
    { name: "Capella" },
    { name: "Centro" },
    { name: "Cheval Collection" },
    { name: "Cinnamon" },
    { name: "Corinthia" },
    { name: "Divani Collection" },
    { name: "Edge" },
    { name: "Elewana Collection" },
    { name: "iclub" },
    { name: "iStay" },
    { name: "JA" },
    { name: "Kempinski" },
    { name: "Lanson Place" },
    { name: "Lore Group" },
    { name: "Lungarno Collection" },
    { name: "Maqo" },
    { name: "Marco Polo" },
    { name: "Minor" },
    { name: "Mysk" },
    { name: "NH Collection" },
    { name: "NH Hotels" },
    { name: "nhow" },
    { name: "Niccolo" },
    { name: "Nikki Beach" },
    { name: "NUO" },
    { name: "Oaks" },
    { name: "OUTRIGGER" },
    { name: "Pan Pacific" },
    { name: "Paramount" },
    { name: "PARKROYAL COLLECTION" },
    { name: "PARKROYAL" },
    { name: "Patina" },
    { name: "Rayhaan" },
    { name: "Regal" },
    { name: "Rotana" },
    { name: "SAii" },
    { name: "Shaza" },
    { name: "Sun International" },
    { name: "Sunway" },
    { name: "TemptingPlaces" },
    { name: "The Doyle Collection" },
    { name: "The Leela" },
    { name: "The Residence by Cenizaro" },
    { name: "The Set Collection" },
    { name: "The Sukhothai" },
    { name: "Tivoli" },
    { name: "Ultratravel Collection" },
    { name: "Unike Hoteller" },
    { name: "Verdi" },
    { name: "Viceroy" },
  ]);

  // Accor
  const ACCOR_BASE_RATE = 25 / 12; // ~2.0833
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.ACCOR },
    update: {
      name: "Accor",
      loyaltyProgram: "ALL - Accor Live Limitless",
      basePointRate: ACCOR_BASE_RATE,
      pointTypeId: 6,
    },
    create: {
      id: HOTEL_ID.ACCOR,
      name: "Accor",
      loyaltyProgram: "ALL - Accor Live Limitless",
      basePointRate: ACCOR_BASE_RATE,
      pointTypeId: 6,
    },
  });
  await upsertEliteStatuses(HOTEL_ID.ACCOR, [
    { name: "Silver", bonusPercentage: 0.24, eliteTierLevel: 1 },
    { name: "Gold", bonusPercentage: 0.48, eliteTierLevel: 2 },
    { name: "Platinum", bonusPercentage: 0.76, eliteTierLevel: 3 },
    { name: "Diamond", bonusPercentage: 0.76, eliteTierLevel: 4 },
  ]);
  await upsertSubBrands(HOTEL_ID.ACCOR, [
    { name: "21c Museum" },
    { name: "25hours" },
    { name: "Adagio", basePointRate: 10 / 12 },
    { name: "Adagio Access", basePointRate: 5 / 12 },
    { name: "Banyan Tree" },
    { name: "Emblems Collection" },
    { name: "Faena" },
    { name: "Fairmont" },
    { name: "Grand Mercure" },
    { name: "Greet" },
    { name: "Handwritten Collection" },
    { name: "hotelF1", basePointRate: 5 / 12 },
    { name: "Hyde" },
    { name: "ibis", basePointRate: 12.5 / 12 },
    { name: "ibis budget", basePointRate: 5 / 12 },
    { name: "ibis Styles", basePointRate: 12.5 / 12 },
    { name: "Jo&Joe" },
    { name: "Mama Shelter" },
    { name: "Mantis" },
    { name: "Mercure" },
    { name: "MGallery" },
    { name: "Mondrian" },
    { name: "Mövenpick" },
    { name: "Novotel" },
    { name: "Orient Express" },
    { name: "Pullman" },
    { name: "Raffles" },
    { name: "Rixos" },
    { name: "SLS" },
    { name: "SO/" },
    { name: "Sofitel" },
    { name: "Sofitel Legend" },
    { name: "Swissôtel" },
    { name: "Hoxton" },
    { name: "The Sebel" },
    { name: "Tribe" },
  ]);

  // Seed UserStatus
  await upsertUserStatus(HOTEL_ID.ACCOR, "Platinum");
  await upsertUserStatus(HOTEL_ID.MARRIOTT, "Titanium");
  await upsertUserStatus(HOTEL_ID.HYATT, "Globalist");
  await upsertUserStatus(HOTEL_ID.HILTON, "Diamond");
  await upsertUserStatus(HOTEL_ID.IHG, "Diamond");
  await upsertUserStatus(HOTEL_ID.GHA_DISCOVERY, "Titanium");

  // Credit Cards
  await prisma.creditCard.upsert({
    where: { id: 1 },
    update: { name: "Amex Platinum", rewardType: "points", rewardRate: 1, pointTypeId: 7 },
    create: { id: 1, name: "Amex Platinum", rewardType: "points", rewardRate: 1, pointTypeId: 7 },
  });
  await prisma.creditCard.upsert({
    where: { id: 2 },
    update: { name: "Chase Sapphire Reserve", rewardType: "points", rewardRate: 4, pointTypeId: 8 },
    create: {
      id: 2,
      name: "Chase Sapphire Reserve",
      rewardType: "points",
      rewardRate: 4,
      pointTypeId: 8,
    },
  });
  await prisma.creditCard.upsert({
    where: { id: 3 },
    update: { name: "Capital One Venture X", rewardType: "points", rewardRate: 2, pointTypeId: 9 },
    create: {
      id: 3,
      name: "Capital One Venture X",
      rewardType: "points",
      rewardRate: 2,
      pointTypeId: 9,
    },
  });
  await prisma.creditCard.upsert({
    where: { id: 4 },
    update: {
      name: "Wells Fargo Autograph Journey",
      rewardType: "points",
      rewardRate: 5,
      pointTypeId: 12,
    },
    create: {
      id: 4,
      name: "Wells Fargo Autograph Journey",
      rewardType: "points",
      rewardRate: 5,
      pointTypeId: 12,
    },
  });

  // OTA Agencies
  await prisma.otaAgency.upsert({
    where: { id: 1 },
    update: { name: "AMEX FHR" },
    create: { id: 1, name: "AMEX FHR" },
  });
  await prisma.otaAgency.upsert({
    where: { id: 2 },
    update: { name: "AMEX THC" },
    create: { id: 2, name: "AMEX THC" },
  });
  await prisma.otaAgency.upsert({
    where: { id: 3 },
    update: { name: "Chase The Edit" },
    create: { id: 3, name: "Chase The Edit" },
  });

  // Shopping Portals
  await prisma.shoppingPortal.upsert({
    where: { id: 1 },
    update: { name: "Rakuten", rewardType: "points", pointTypeId: 11 },
    create: { id: 1, name: "Rakuten", rewardType: "points", pointTypeId: 11 },
  });
  await prisma.shoppingPortal.upsert({
    where: { id: 2 },
    update: { name: "TopCashback", rewardType: "cashback", pointTypeId: null },
    create: { id: 2, name: "TopCashback", rewardType: "cashback" },
  });
  await prisma.shoppingPortal.upsert({
    where: { id: 3 },
    update: { name: "British Airways", rewardType: "points", pointTypeId: 10 },
    create: { id: 3, name: "British Airways", rewardType: "points", pointTypeId: 10 },
  });

  console.log("Seed data created successfully");

  // Reset sequences to prevent clashes with manual IDs
  const tables = [
    "point_types",
    "hotel_chains",
    "credit_cards",
    "ota_agencies",
    "shopping_portals",
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id), 1)) FROM "${table}";`
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
