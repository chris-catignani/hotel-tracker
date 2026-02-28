import {
  PrismaClient,
  PointCategory,
  BenefitType,
  CertType,
  ValuationValueType,
} from "@prisma/client";
import { HOTEL_ID, SUB_BRAND_ID } from "../src/lib/constants";
import { CREDIT_CARD_ID, SHOPPING_PORTAL_ID, OTA_AGENCY_ID } from "./seed-ids";
import { CERT_TYPE_OPTIONS } from "../src/lib/cert-types";

const prisma = new PrismaClient();

const POINT_TYPE_ID = {
  HILTON_HONORS: "cyh0r61a810u6qrgfj515tkid",
  MARRIOTT_BONVOY: "ctv910qcpclvq0b9thpcw12x6",
  WORLD_OF_HYATT: "cd0y4mrv3iwc2r2gwgwy722zk",
  IHG_ONE_REWARDS: "cmcri5r30guyq8l8f2pvaqwr7",
  DISCOVERY_DOLLARS: "c8wn8dzybdbymevuucmup1j96",
  ACCOR_ALL: "coa03zp46q2v01c4l4knm1rcg",
  MEMBERSHIP_REWARDS: "cc0pgnx83hbjbbwxi99qocq52",
  ULTIMATE_REWARDS: "c8974es8z9vnwdgt934zrlare",
  CAPITAL_ONE_MILES: "cwhd30omk2xajtvfa2iqmmgab",
  AVIOS: "c4rk0idsjpnfriatk1qulswgx",
  BILT: "cbuf26mcgjs61kr9bybazq95j",
  WELLS_FARGO: "c0kuqb3diocim6kgaxo0b3w0r",
};

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

/**
 * Converts a hotel chain sub-brand name into a snake_case key.
 * Used when adding new sub-brands to SUB_BRAND_ID in constants.ts —
 * run this against the brand name to generate a consistent key.
 * DO NOT DELETE: retained as a dev utility for future sub-brand additions.
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

// Map sub-brand names to their stable IDs from constants.
// Sub-brands not listed here receive an auto-generated CUID on first insert.
const SUB_BRAND_MAP: Record<string, string> = {
  "Autograph Collection": SUB_BRAND_ID.MARRIOTT.AUTOGRAPH_COLLECTION,
  citizenM: SUB_BRAND_ID.MARRIOTT.CITIZENM,
  Moxy: SUB_BRAND_ID.MARRIOTT.MOXY,
  "Tribute Portfolio": SUB_BRAND_ID.MARRIOTT.TRIBUTE_PORTFOLIO,
  "Park Hyatt": SUB_BRAND_ID.HYATT.PARK_HYATT,
  "Hyatt Centric": SUB_BRAND_ID.HYATT.HYATT_CENTRIC,
  "Hyatt Place": SUB_BRAND_ID.HYATT.HYATT_PLACE,
  "Holiday Inn Express": SUB_BRAND_ID.IHG.HOLIDAY_INN_EXPRESS,
  "Hotel Indigo": SUB_BRAND_ID.IHG.HOTEL_INDIGO,
  Sunway: SUB_BRAND_ID.GHA_DISCOVERY.SUNWAY,
  PARKROYAL: SUB_BRAND_ID.GHA_DISCOVERY.PARKROYAL,
  "PARKROYAL COLLECTION": SUB_BRAND_ID.GHA_DISCOVERY.PARKROYAL_COLLECTION,
  "ibis Styles": SUB_BRAND_ID.ACCOR.IBIS_STYLES,
};

async function upsertEliteStatuses(hotelChainId: string, statuses: EliteStatusData[]) {
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

async function upsertSubBrands(hotelChainId: string, subBrands: SubBrandData[]) {
  for (const sb of subBrands) {
    const stableId = SUB_BRAND_MAP[sb.name];
    await prisma.hotelChainSubBrand.upsert({
      where: {
        hotelChainId_name: {
          hotelChainId,
          name: sb.name,
        },
      },
      update: {
        name: sb.name,
        hotelChainId,
        basePointRate: sb.basePointRate,
      },
      create: {
        ...(stableId ? { id: stableId } : {}),
        name: sb.name,
        hotelChainId,
        basePointRate: sb.basePointRate,
      },
    });
  }
}

async function upsertUserStatus(hotelChainId: string, statusName: string) {
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

async function upsertGlobalValuations() {
  const valuations = [
    // 1. EQN Global Default
    {
      where: { hotelChainId: null, isEqn: true, certType: null, benefitType: null },
      data: { value: 10.0, valueType: "dollar" as ValuationValueType },
    },
    // 2. Certificate Global Defaults
    ...CERT_TYPE_OPTIONS.map((opt) => ({
      where: {
        hotelChainId: null,
        isEqn: false,
        certType: opt.value as CertType,
        benefitType: null,
      },
      data: { value: opt.pointsValue, valueType: "points" as ValuationValueType },
    })),
    // 3. Standard Benefit Global Defaults
    ...Object.values(BenefitType).map((type) => ({
      where: { hotelChainId: null, isEqn: false, certType: null, benefitType: type },
      data: { value: 0.0, valueType: "dollar" as ValuationValueType },
    })),
  ];

  for (const v of valuations) {
    const existing = await prisma.benefitValuation.findFirst({
      where: v.where,
    });

    if (existing) {
      await prisma.benefitValuation.update({
        where: { id: existing.id },
        data: v.data,
      });
    } else {
      await prisma.benefitValuation.create({
        data: { ...v.where, ...v.data },
      });
    }
  }
}

async function main() {
  // Valuations
  await upsertGlobalValuations();

  // PointTypes
  const pointTypeData = [
    {
      id: POINT_TYPE_ID.HILTON_HONORS,
      name: "Hilton Honors Points",
      category: "hotel",
      centsPerPoint: 0.0045,
    },
    {
      id: POINT_TYPE_ID.MARRIOTT_BONVOY,
      name: "Marriott Bonvoy Points",
      category: "hotel",
      centsPerPoint: 0.007,
    },
    {
      id: POINT_TYPE_ID.WORLD_OF_HYATT,
      name: "World of Hyatt Points",
      category: "hotel",
      centsPerPoint: 0.02,
    },
    {
      id: POINT_TYPE_ID.IHG_ONE_REWARDS,
      name: "IHG One Rewards",
      category: "hotel",
      centsPerPoint: 0.006,
    },
    {
      id: POINT_TYPE_ID.DISCOVERY_DOLLARS,
      name: "Discovery Dollars",
      category: "hotel",
      centsPerPoint: 0.01,
    },
    {
      id: POINT_TYPE_ID.ACCOR_ALL,
      name: "ALL - Accor Live Limitless",
      category: "hotel",
      centsPerPoint: 0.022,
    },
    {
      id: POINT_TYPE_ID.MEMBERSHIP_REWARDS,
      name: "Membership Rewards",
      category: "transferable",
      centsPerPoint: 0.02,
    },
    {
      id: POINT_TYPE_ID.ULTIMATE_REWARDS,
      name: "Ultimate Rewards",
      category: "transferable",
      centsPerPoint: 0.02,
    },
    {
      id: POINT_TYPE_ID.CAPITAL_ONE_MILES,
      name: "Capital One Miles",
      category: "transferable",
      centsPerPoint: 0.0175,
    },
    { id: POINT_TYPE_ID.AVIOS, name: "Avios", category: "airline", centsPerPoint: 0.012 },
    { id: POINT_TYPE_ID.BILT, name: "Bilt", category: "transferable", centsPerPoint: 0.02 },
    {
      id: POINT_TYPE_ID.WELLS_FARGO,
      name: "Wells Fargo Rewards",
      category: "transferable",
      centsPerPoint: 0.015,
    },
  ];

  for (const pt of pointTypeData) {
    await prisma.pointType.upsert({
      where: { id: pt.id },
      update: {
        name: pt.name,
        category: pt.category as PointCategory,
        centsPerPoint: pt.centsPerPoint,
      },
      create: {
        id: pt.id,
        name: pt.name,
        category: pt.category as PointCategory,
        centsPerPoint: pt.centsPerPoint,
      },
    });
  }

  // Hilton
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.HILTON },
    update: {
      name: "Hilton",
      loyaltyProgram: "Hilton Honors",
      basePointRate: 10,
      pointTypeId: POINT_TYPE_ID.HILTON_HONORS,
    },
    create: {
      id: HOTEL_ID.HILTON,
      name: "Hilton",
      loyaltyProgram: "Hilton Honors",
      basePointRate: 10,
      pointTypeId: POINT_TYPE_ID.HILTON_HONORS,
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
      pointTypeId: POINT_TYPE_ID.MARRIOTT_BONVOY,
    },
    create: {
      id: HOTEL_ID.MARRIOTT,
      name: "Marriott",
      loyaltyProgram: "Marriott Bonvoy",
      basePointRate: 10,
      pointTypeId: POINT_TYPE_ID.MARRIOTT_BONVOY,
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
    update: {
      name: "Hyatt",
      loyaltyProgram: "World of Hyatt",
      basePointRate: 5,
      pointTypeId: POINT_TYPE_ID.WORLD_OF_HYATT,
    },
    create: {
      id: HOTEL_ID.HYATT,
      name: "Hyatt",
      loyaltyProgram: "World of Hyatt",
      basePointRate: 5,
      pointTypeId: POINT_TYPE_ID.WORLD_OF_HYATT,
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
    update: {
      name: "IHG",
      loyaltyProgram: "IHG One Rewards",
      basePointRate: 10,
      pointTypeId: POINT_TYPE_ID.IHG_ONE_REWARDS,
    },
    create: {
      id: HOTEL_ID.IHG,
      name: "IHG",
      loyaltyProgram: "IHG One Rewards",
      basePointRate: 10,
      pointTypeId: POINT_TYPE_ID.IHG_ONE_REWARDS,
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
      pointTypeId: POINT_TYPE_ID.DISCOVERY_DOLLARS,
    },
    create: {
      id: HOTEL_ID.GHA_DISCOVERY,
      name: "GHA Discovery",
      loyaltyProgram: "GHA Discovery",
      basePointRate: 4,
      pointTypeId: POINT_TYPE_ID.DISCOVERY_DOLLARS,
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
      pointTypeId: POINT_TYPE_ID.ACCOR_ALL,
    },
    create: {
      id: HOTEL_ID.ACCOR,
      name: "Accor",
      loyaltyProgram: "ALL - Accor Live Limitless",
      basePointRate: ACCOR_BASE_RATE,
      pointTypeId: POINT_TYPE_ID.ACCOR_ALL,
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
    where: { id: CREDIT_CARD_ID.AMEX_PLATINUM },
    update: {
      name: "Amex Platinum",
      rewardType: "points",
      rewardRate: 1,
      pointTypeId: POINT_TYPE_ID.MEMBERSHIP_REWARDS,
    },
    create: {
      id: CREDIT_CARD_ID.AMEX_PLATINUM,
      name: "Amex Platinum",
      rewardType: "points",
      rewardRate: 1,
      pointTypeId: POINT_TYPE_ID.MEMBERSHIP_REWARDS,
    },
  });
  await prisma.creditCard.upsert({
    where: { id: CREDIT_CARD_ID.CHASE_SAPPHIRE_RESERVE },
    update: {
      name: "Chase Sapphire Reserve",
      rewardType: "points",
      rewardRate: 4,
      pointTypeId: POINT_TYPE_ID.ULTIMATE_REWARDS,
    },
    create: {
      id: CREDIT_CARD_ID.CHASE_SAPPHIRE_RESERVE,
      name: "Chase Sapphire Reserve",
      rewardType: "points",
      rewardRate: 4,
      pointTypeId: POINT_TYPE_ID.ULTIMATE_REWARDS,
    },
  });
  await prisma.creditCard.upsert({
    where: { id: CREDIT_CARD_ID.CAPITAL_ONE_VENTURE_X },
    update: {
      name: "Capital One Venture X",
      rewardType: "points",
      rewardRate: 2,
      pointTypeId: POINT_TYPE_ID.CAPITAL_ONE_MILES,
    },
    create: {
      id: CREDIT_CARD_ID.CAPITAL_ONE_VENTURE_X,
      name: "Capital One Venture X",
      rewardType: "points",
      rewardRate: 2,
      pointTypeId: POINT_TYPE_ID.CAPITAL_ONE_MILES,
    },
  });
  await prisma.creditCard.upsert({
    where: { id: CREDIT_CARD_ID.WELLS_FARGO_AUTOGRAPH },
    update: {
      name: "Wells Fargo Autograph Journey",
      rewardType: "points",
      rewardRate: 5,
      pointTypeId: POINT_TYPE_ID.WELLS_FARGO,
    },
    create: {
      id: CREDIT_CARD_ID.WELLS_FARGO_AUTOGRAPH,
      name: "Wells Fargo Autograph Journey",
      rewardType: "points",
      rewardRate: 5,
      pointTypeId: POINT_TYPE_ID.WELLS_FARGO,
    },
  });

  // OTA Agencies
  await prisma.otaAgency.upsert({
    where: { id: OTA_AGENCY_ID.AMEX_FHR },
    update: { name: "AMEX FHR" },
    create: { id: OTA_AGENCY_ID.AMEX_FHR, name: "AMEX FHR" },
  });
  await prisma.otaAgency.upsert({
    where: { id: OTA_AGENCY_ID.AMEX_THC },
    update: { name: "AMEX THC" },
    create: { id: OTA_AGENCY_ID.AMEX_THC, name: "AMEX THC" },
  });
  await prisma.otaAgency.upsert({
    where: { id: OTA_AGENCY_ID.CHASE_EDIT },
    update: { name: "Chase The Edit" },
    create: { id: OTA_AGENCY_ID.CHASE_EDIT, name: "Chase The Edit" },
  });

  // Shopping Portals
  await prisma.shoppingPortal.upsert({
    where: { id: SHOPPING_PORTAL_ID.RAKUTEN },
    update: { name: "Rakuten", rewardType: "points", pointTypeId: POINT_TYPE_ID.BILT }, // Rakuten -> Bilt/MR
    create: {
      id: SHOPPING_PORTAL_ID.RAKUTEN,
      name: "Rakuten",
      rewardType: "points",
      pointTypeId: POINT_TYPE_ID.BILT,
    },
  });
  await prisma.shoppingPortal.upsert({
    where: { id: SHOPPING_PORTAL_ID.TOPCASHBACK },
    update: { name: "TopCashback", rewardType: "cashback", pointTypeId: null },
    create: { id: SHOPPING_PORTAL_ID.TOPCASHBACK, name: "TopCashback", rewardType: "cashback" },
  });
  await prisma.shoppingPortal.upsert({
    where: { id: SHOPPING_PORTAL_ID.BRITISH_AIRWAYS },
    update: { name: "British Airways", rewardType: "points", pointTypeId: POINT_TYPE_ID.AVIOS },
    create: {
      id: SHOPPING_PORTAL_ID.BRITISH_AIRWAYS,
      name: "British Airways",
      rewardType: "points",
      pointTypeId: POINT_TYPE_ID.AVIOS,
    },
  });

  console.log("Seed data created successfully");
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
