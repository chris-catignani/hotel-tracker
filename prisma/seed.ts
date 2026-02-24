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

async function upsertSubBrands(hotelChainId: number, subBrands: SubBrandData[]) {
  for (const sb of subBrands) {
    await prisma.hotelChainSubBrand.upsert({
      where: {
        hotelChainId_name: {
          hotelChainId,
          name: sb.name,
        },
      },
      update: sb,
      create: {
        ...sb,
        hotelChainId,
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
    { name: "Apartment Collection by Hilton" },
    { name: "Canopy by Hilton" },
    { name: "Conrad Hotels & Resorts" },
    { name: "Curio Collection by Hilton" },
    { name: "DoubleTree by Hilton" },
    { name: "Embassy Suites by Hilton" },
    { name: "Graduate by Hilton" },
    { name: "Hampton by Hilton" },
    { name: "Hilton Club" },
    { name: "Hilton Garden Inn" },
    { name: "Hilton Grand Vacations" },
    { name: "Hilton Hotels & Resorts" },
    { name: "Hilton Vacation Club" },
    { name: "Home2 Suites by Hilton", basePointRate: 5 },
    { name: "Homewood Suites by Hilton", basePointRate: 5 },
    { name: "LivSmart Studios by Hilton", basePointRate: 5 },
    { name: "LXR Hotels & Resorts" },
    { name: "Motto by Hilton" },
    { name: "NoMad Hotels" },
    { name: "Signia by Hilton" },
    { name: "Spark by Hilton", basePointRate: 5 },
    { name: "Tapestry Collection by Hilton" },
    { name: "Tempo by Hilton" },
    { name: "Tru by Hilton", basePointRate: 5 },
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
    { name: "AC Hotels by Marriott" },
    { name: "Aloft Hotels" },
    { name: "Apartments by Marriott Bonvoy", basePointRate: 5 },
    { name: "Autograph Collection Hotels" },
    { name: "Bulgari Hotels & Resorts" },
    { name: "City Express by Marriott", basePointRate: 5 },
    { name: "citizenM" },
    { name: "Courtyard by Marriott" },
    { name: "Delta Hotels" },
    { name: "Design Hotels" },
    { name: "EDITION" },
    { name: "Element by Westin", basePointRate: 5 },
    { name: "Fairfield by Marriott" },
    { name: "Four Points by Sheraton" },
    { name: "Four Points Express by Sheraton", basePointRate: 5 },
    { name: "Four Points Flex by Sheraton", basePointRate: 5 },
    { name: "Gaylord Hotels" },
    { name: "Homes & Villas by Marriott Bonvoy", basePointRate: 5 },
    { name: "JW Marriott" },
    { name: "Le Meridien" },
    { name: "Marriott Executive Apartments", basePointRate: 5 },
    { name: "Marriott Hotels" },
    { name: "Marriott Vacation Club" },
    { name: "MGM Collection with Marriott Bonvoy" },
    { name: "Moxy Hotels" },
    { name: "Protea Hotels by Marriott", basePointRate: 5 },
    { name: "Renaissance Hotels" },
    { name: "Residence Inn by Marriott", basePointRate: 5 },
    { name: "Ritz-Carlton Reserve" },
    { name: "Sheraton" },
    { name: "SpringHill Suites" },
    { name: "St. Regis" },
    { name: "StudioRes by Marriott", basePointRate: 5 },
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
    { name: "Alua Hotels & Resorts" },
    { name: "Andaz" },
    { name: "Breathless Resorts & Spas" },
    { name: "Caption by Hyatt" },
    { name: "Destination by Hyatt" },
    { name: "Dream Hotels" },
    { name: "Dreams Resorts & Spas" },
    { name: "Grand Hyatt" },
    { name: "Hyatt Centric" },
    { name: "Hyatt House" },
    { name: "Hyatt Place" },
    { name: "Hyatt Regency" },
    { name: "Hyatt Studios", basePointRate: 2.5 },
    { name: "Hyatt Vacation Club" },
    { name: "Hyatt Vivid Hotels & Resorts" },
    { name: "Hyatt Zilara" },
    { name: "Hyatt Ziva" },
    { name: "Impression by Secrets" },
    { name: "JdV by Hyatt" },
    { name: "Miraval" },
    { name: "Park Hyatt" },
    { name: "Secrets Resorts & Spas" },
    { name: "Sunscape Resorts & Spas" },
    { name: "The Unbound Collection by Hyatt" },
    { name: "Thompson Hotels" },
    { name: "Zoetry Wellness & Spa Resorts" },
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
    { name: "avid hotels" },
    { name: "Candlewood Suites", basePointRate: 5 },
    { name: "Crowne Plaza Hotels & Resorts" },
    { name: "Even Hotels" },
    { name: "Garner Hotels" },
    { name: "Holiday Inn Club Vacations" },
    { name: "Holiday Inn Express" },
    { name: "Holiday Inn Hotels & Resorts" },
    { name: "Hotel Indigo" },
    { name: "HUALUXE Hotels & Resorts" },
    { name: "Iberostar Beachfront Resorts" },
    { name: "InterContinental Hotels & Resorts" },
    { name: "Kimpton Hotels & Restaurants" },
    { name: "Regent Hotels & Resorts" },
    { name: "Six Senses Hotels Resorts Spas" },
    { name: "Staybridge Suites", basePointRate: 5 },
    { name: "Vignette Collection" },
    { name: "voco Hotels" },
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
    { name: "Anantara Hotels & Resorts" },
    { name: "Andronis" },
    { name: "Araiya Hotels & Resorts" },
    { name: "Arjaan Hotel Apartments by Rotana" },
    { name: "ASMALLWORLD Hotels & Resorts" },
    { name: "Avani Hotels & Resorts" },
    { name: "Bristoria Hotels" },
    { name: "Capella Hotels & Resorts" },
    { name: "Centro by Rotana" },
    { name: "Cheval Collection" },
    { name: "Cinnamon Hotels & Resorts" },
    { name: "Corinthia Hotels" },
    { name: "Divani Collection Hotels" },
    { name: "Edge by Rotana" },
    { name: "Elewana Collection" },
    { name: "iclub Hotels" },
    { name: "iStay Hotels" },
    { name: "JA Resorts & Hotels" },
    { name: "Kempinski Hotels" },
    { name: "Lanson Place" },
    { name: "Lore Group" },
    { name: "Lungarno Collection" },
    { name: "Maqo Hotels" },
    { name: "Marco Polo Hotels" },
    { name: "Minor Hotels" },
    { name: "Mysk Hotels" },
    { name: "NH Collection Hotels & Resorts" },
    { name: "NH Hotels & Resorts" },
    { name: "nhow Hotels" },
    { name: "Niccolo Hotels" },
    { name: "Nikki Beach Hotels & Resorts" },
    { name: "NUO Hotels" },
    { name: "Oaks Hotels, Resorts and Suites" },
    { name: "OUTRIGGER Resorts & Hotels" },
    { name: "Pan Pacific Hotels and Resorts" },
    { name: "Paramount Hotels" },
    { name: "PARKROYAL COLLECTION Hotels & Resorts" },
    { name: "PARKROYAL Hotels & Resorts" },
    { name: "Patina Hotels & Resorts" },
    { name: "Rayhaan Hotels & Resorts by Rotana" },
    { name: "Regal Hotels" },
    { name: "Rotana Hotels & Resorts" },
    { name: "SAii Hotels & Resorts" },
    { name: "Shaza Hotels" },
    { name: "Sun International" },
    { name: "Sunway Hotels & Resorts" },
    { name: "TemptingPlaces" },
    { name: "The Doyle Collection" },
    { name: "The Leela Palaces, Hotels and Resorts" },
    { name: "The Residence by Cenizaro" },
    { name: "The Set Collection" },
    { name: "The Sukhothai Hotels & Resorts" },
    { name: "Tivoli Hotels & Resorts" },
    { name: "Ultratravel Collection" },
    { name: "Unike Hoteller" },
    { name: "Verdi Hotels" },
    { name: "Viceroy Hotels and Resorts" },
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
    { name: "21c Museum Hotel" },
    { name: "25hours Hotels" },
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
    { name: "Mantis Collection" },
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
    { name: "The Hoxton" },
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
