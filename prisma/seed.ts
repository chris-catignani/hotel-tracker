import { PrismaClient } from "@prisma/client";
import { HOTEL_ID } from "../src/lib/constants";

const prisma = new PrismaClient();

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

  // Hotel Chains
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.HILTON },
    update: { name: "Hilton", loyaltyProgram: "Hilton Honors", basePointRate: 10, pointTypeId: 1 },
    create: { id: HOTEL_ID.HILTON, name: "Hilton", loyaltyProgram: "Hilton Honors", basePointRate: 10, pointTypeId: 1 },
  });
  await prisma.hotelChainEliteStatus.deleteMany({ where: { hotelChainId: HOTEL_ID.HILTON } });
  await prisma.hotelChainEliteStatus.createMany({
    data: [
      { hotelChainId: HOTEL_ID.HILTON, name: "Silver", bonusPercentage: 0.20, eliteTierLevel: 1 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Gold", bonusPercentage: 0.80, eliteTierLevel: 2 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Diamond", bonusPercentage: 1.00, eliteTierLevel: 3 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Diamond Reserve", bonusPercentage: 1.20, eliteTierLevel: 4 },
    ],
  });
  await prisma.hotelChainSubBrand.deleteMany({ where: { hotelChainId: HOTEL_ID.HILTON } });
  await prisma.hotelChainSubBrand.createMany({
    data: [
      { hotelChainId: HOTEL_ID.HILTON, name: "Waldorf Astoria", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "LXR Hotels & Resorts", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Conrad Hotels & Resorts", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Canopy by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Signia by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Hilton Hotels & Resorts", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Curio Collection by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "DoubleTree by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Tapestry Collection by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Embassy Suites by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Tempo by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Motto by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Hilton Garden Inn", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Hampton by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Home2 Suites by Hilton", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Tru by Hilton", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Spark by Hilton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.HILTON, name: "Hilton Grand Vacations", basePointRate: 10 },
    ],
  });

  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.MARRIOTT },
    update: { name: "Marriott", loyaltyProgram: "Marriott Bonvoy", basePointRate: 10, pointTypeId: 2 },
    create: { id: HOTEL_ID.MARRIOTT, name: "Marriott", loyaltyProgram: "Marriott Bonvoy", basePointRate: 10, pointTypeId: 2 },
  });
  await prisma.hotelChainEliteStatus.deleteMany({ where: { hotelChainId: HOTEL_ID.MARRIOTT } });
  await prisma.hotelChainEliteStatus.createMany({
    data: [
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Silver", bonusPercentage: 0.10, eliteTierLevel: 1 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Gold", bonusPercentage: 0.25, eliteTierLevel: 2 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Platinum", bonusPercentage: 0.50, eliteTierLevel: 3 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Titanium", bonusPercentage: 0.75, eliteTierLevel: 4 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Ambassador", bonusPercentage: 0.75, eliteTierLevel: 5 },
    ],
  });
  await prisma.hotelChainSubBrand.deleteMany({ where: { hotelChainId: HOTEL_ID.MARRIOTT } });
  await prisma.hotelChainSubBrand.createMany({
    data: [
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "The Ritz-Carlton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "St. Regis", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "JW Marriott", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "The Luxury Collection", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "W Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "EDITION", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Marriott Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Sheraton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Westin", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Le Meridien", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Renaissance Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Autograph Collection Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Delta Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Gaylord Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Courtyard by Marriott", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Four Points by Sheraton", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "SpringHill Suites", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Fairfield by Marriott", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Protea Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "AC Hotels by Marriott", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Aloft Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Moxy Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Residence Inn by Marriott", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "TownePlace Suites", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Element by Westin", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.MARRIOTT, name: "Homes & Villas by Marriott Bonvoy", basePointRate: 5 },
    ],
  });

  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.HYATT },
    update: { name: "Hyatt", loyaltyProgram: "World of Hyatt", basePointRate: 5, pointTypeId: 3 },
    create: { id: HOTEL_ID.HYATT, name: "Hyatt", loyaltyProgram: "World of Hyatt", basePointRate: 5, pointTypeId: 3 },
  });
  await prisma.hotelChainEliteStatus.deleteMany({ where: { hotelChainId: HOTEL_ID.HYATT } });
  await prisma.hotelChainEliteStatus.createMany({
    data: [
      { hotelChainId: HOTEL_ID.HYATT, name: "Discoverist", bonusPercentage: 0.10, eliteTierLevel: 1 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Explorist", bonusPercentage: 0.20, eliteTierLevel: 2 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Globalist", bonusPercentage: 0.30, eliteTierLevel: 3 },
    ],
  });
  await prisma.hotelChainSubBrand.deleteMany({ where: { hotelChainId: HOTEL_ID.HYATT } });
  await prisma.hotelChainSubBrand.createMany({
    data: [
      { hotelChainId: HOTEL_ID.HYATT, name: "Park Hyatt", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Andaz", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Grand Hyatt", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Hyatt Regency", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Hyatt Centric", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "The Unbound Collection by Hyatt", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Hyatt Place", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Hyatt House", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Hyatt Ziva", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Hyatt Zilara", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Thompson Hotels", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Destination by Hyatt", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Alila", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Caption by Hyatt", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.HYATT, name: "Hyatt Studios", basePointRate: 2.5 },
    ],
  });

  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.IHG },
    update: { name: "IHG", loyaltyProgram: "IHG One Rewards", basePointRate: 10, pointTypeId: 4 },
    create: { id: HOTEL_ID.IHG, name: "IHG", loyaltyProgram: "IHG One Rewards", basePointRate: 10, pointTypeId: 4 },
  });
  await prisma.hotelChainEliteStatus.deleteMany({ where: { hotelChainId: HOTEL_ID.IHG } });
  await prisma.hotelChainEliteStatus.createMany({
    data: [
      { hotelChainId: HOTEL_ID.IHG, name: "Silver", bonusPercentage: 0.20, eliteTierLevel: 1 },
      { hotelChainId: HOTEL_ID.IHG, name: "Gold", bonusPercentage: 0.40, eliteTierLevel: 2 },
      { hotelChainId: HOTEL_ID.IHG, name: "Platinum", bonusPercentage: 0.60, eliteTierLevel: 3 },
      { hotelChainId: HOTEL_ID.IHG, name: "Diamond", bonusPercentage: 1.00, eliteTierLevel: 4 },
    ],
  });
  await prisma.hotelChainSubBrand.deleteMany({ where: { hotelChainId: HOTEL_ID.IHG } });
  await prisma.hotelChainSubBrand.createMany({
    data: [
      { hotelChainId: HOTEL_ID.IHG, name: "InterContinental Hotels & Resorts", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.IHG, name: "Kimpton Hotels & Restaurants", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.IHG, name: "Hotel Indigo", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.IHG, name: "Crowne Plaza Hotels & Resorts", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.IHG, name: "Holiday Inn Hotels & Resorts", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.IHG, name: "Holiday Inn Express", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.IHG, name: "Staybridge Suites", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.IHG, name: "Candlewood Suites", basePointRate: 5 },
      { hotelChainId: HOTEL_ID.IHG, name: "Voco Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.IHG, name: "Even Hotels", basePointRate: 10 },
      { hotelChainId: HOTEL_ID.IHG, name: "Avid Hotels", basePointRate: 10 },
    ],
  });

  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.GHA_DISCOVERY },
    update: { name: "GHA Discovery", loyaltyProgram: "GHA Discovery", basePointRate: 4, pointTypeId: 5 },
    create: { id: HOTEL_ID.GHA_DISCOVERY, name: "GHA Discovery", loyaltyProgram: "GHA Discovery", basePointRate: 4, pointTypeId: 5 },
  });
  await prisma.hotelChainEliteStatus.deleteMany({ where: { hotelChainId: HOTEL_ID.GHA_DISCOVERY } });
  await prisma.hotelChainEliteStatus.createMany({
    data: [
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Silver", fixedRate: 4, isFixed: true, eliteTierLevel: 1 },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Gold", fixedRate: 5, isFixed: true, eliteTierLevel: 2 },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Platinum", fixedRate: 6, isFixed: true, eliteTierLevel: 3 },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Titanium", fixedRate: 7, isFixed: true, eliteTierLevel: 4 },
    ],
  });
  await prisma.hotelChainSubBrand.deleteMany({ where: { hotelChainId: HOTEL_ID.GHA_DISCOVERY } });
  await prisma.hotelChainSubBrand.createMany({
    data: [
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Kempinski Hotels" },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Anantara Hotels, Resorts & Spas" },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Pan Pacific Hotels & Resorts" },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Viceroy Hotels & Resorts" },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Parkroyal Hotels & Resorts" },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Outrigger Resorts & Hotels" },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "The Leela Palaces, Hotels and Resorts" },
      { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Capella Hotels and Resorts" },
    ],
  });

  // Accor: 25 pts per 10 EUR. 1 EUR = 1.2 USD. 10 EUR = 12 USD.
  // Base rate = 25 / 12 = 2.0833 pts per $1
  const ACCOR_BASE_RATE = 25 / 12; // ~2.0833
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.ACCOR },
    update: { name: "Accor", loyaltyProgram: "ALL - Accor Live Limitless", basePointRate: ACCOR_BASE_RATE, pointTypeId: 6 },
    create: { id: HOTEL_ID.ACCOR, name: "Accor", loyaltyProgram: "ALL - Accor Live Limitless", basePointRate: ACCOR_BASE_RATE, pointTypeId: 6 },
  });
  await prisma.hotelChainEliteStatus.deleteMany({ where: { hotelChainId: HOTEL_ID.ACCOR } });
  await prisma.hotelChainEliteStatus.createMany({
    data: [
      { hotelChainId: HOTEL_ID.ACCOR, name: "Silver", bonusPercentage: 0.24, eliteTierLevel: 1 },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Gold", bonusPercentage: 0.48, eliteTierLevel: 2 },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Platinum", bonusPercentage: 0.76, eliteTierLevel: 3 },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Diamond", bonusPercentage: 0.76, eliteTierLevel: 4 },
    ],
  });
  await prisma.hotelChainSubBrand.deleteMany({ where: { hotelChainId: HOTEL_ID.ACCOR } });
  await prisma.hotelChainSubBrand.createMany({
    data: [
      { hotelChainId: HOTEL_ID.ACCOR, name: "Raffles", basePointRate: ACCOR_BASE_RATE },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Banyan Tree", basePointRate: ACCOR_BASE_RATE },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Fairmont", basePointRate: ACCOR_BASE_RATE },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Sofitel", basePointRate: ACCOR_BASE_RATE },
      { hotelChainId: HOTEL_ID.ACCOR, name: "MGallery", basePointRate: ACCOR_BASE_RATE },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Pullman", basePointRate: ACCOR_BASE_RATE },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Swissôtel", basePointRate: ACCOR_BASE_RATE },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Novotel", basePointRate: ACCOR_BASE_RATE },
      { hotelChainId: HOTEL_ID.ACCOR, name: "Mercure", basePointRate: ACCOR_BASE_RATE },
      { hotelChainId: HOTEL_ID.ACCOR, name: "ibis", basePointRate: 12.5 / 12 }, // 1.0417
      { hotelChainId: HOTEL_ID.ACCOR, name: "ibis Styles", basePointRate: 12.5 / 12 }, // 1.0417
      { hotelChainId: HOTEL_ID.ACCOR, name: "ibis budget", basePointRate: 5 / 12 }, // 0.4167
      { hotelChainId: HOTEL_ID.ACCOR, name: "Adagio", basePointRate: 10 / 12 }, // 0.8333
      { hotelChainId: HOTEL_ID.ACCOR, name: "Adagio Access", basePointRate: 5 / 12 }, // 0.4167
    ],
  });

  // Seed UserStatus
  const marriottTitanium = await prisma.hotelChainEliteStatus.findFirst({
    where: { hotelChainId: HOTEL_ID.MARRIOTT, name: "Titanium" },
  });
  const hyattGlobalist = await prisma.hotelChainEliteStatus.findFirst({
    where: { hotelChainId: HOTEL_ID.HYATT, name: "Globalist" },
  });
  const hiltonDiamond = await prisma.hotelChainEliteStatus.findFirst({
    where: { hotelChainId: HOTEL_ID.HILTON, name: "Diamond" },
  });
  const ihgDiamond = await prisma.hotelChainEliteStatus.findFirst({
    where: { hotelChainId: HOTEL_ID.IHG, name: "Diamond" },
  });
  const ghaTitanium = await prisma.hotelChainEliteStatus.findFirst({
    where: { hotelChainId: HOTEL_ID.GHA_DISCOVERY, name: "Titanium" },
  });

  if (marriottTitanium) await prisma.userStatus.upsert({ where: { hotelChainId: HOTEL_ID.MARRIOTT }, update: { eliteStatusId: marriottTitanium.id }, create: { hotelChainId: HOTEL_ID.MARRIOTT, eliteStatusId: marriottTitanium.id } });
  if (hyattGlobalist) await prisma.userStatus.upsert({ where: { hotelChainId: HOTEL_ID.HYATT }, update: { eliteStatusId: hyattGlobalist.id }, create: { hotelChainId: HOTEL_ID.HYATT, eliteStatusId: hyattGlobalist.id } });
  if (hiltonDiamond) await prisma.userStatus.upsert({ where: { hotelChainId: HOTEL_ID.HILTON }, update: { eliteStatusId: hiltonDiamond.id }, create: { hotelChainId: HOTEL_ID.HILTON, eliteStatusId: hiltonDiamond.id } });
  if (ihgDiamond) await prisma.userStatus.upsert({ where: { hotelChainId: HOTEL_ID.IHG }, update: { eliteStatusId: ihgDiamond.id }, create: { hotelChainId: HOTEL_ID.IHG, eliteStatusId: ihgDiamond.id } });
  if (ghaTitanium) await prisma.userStatus.upsert({ where: { hotelChainId: HOTEL_ID.GHA_DISCOVERY }, update: { eliteStatusId: ghaTitanium.id }, create: { hotelChainId: HOTEL_ID.GHA_DISCOVERY, eliteStatusId: ghaTitanium.id } });

  // Credit Cards
  await prisma.creditCard.upsert({
    where: { id: 1 },
    update: { name: "Amex Platinum", rewardType: "points", rewardRate: 1, pointTypeId: 7 },
    create: { id: 1, name: "Amex Platinum", rewardType: "points", rewardRate: 1, pointTypeId: 7 },
  });
  await prisma.creditCard.upsert({
    where: { id: 2 },
    update: { name: "Chase Sapphire Reserve", rewardType: "points", rewardRate: 4, pointTypeId: 8 },
    create: { id: 2, name: "Chase Sapphire Reserve", rewardType: "points", rewardRate: 4, pointTypeId: 8 },
  });
  await prisma.creditCard.upsert({
    where: { id: 3 },
    update: { name: "Capital One Venture X", rewardType: "points", rewardRate: 2, pointTypeId: 9 },
    create: { id: 3, name: "Capital One Venture X", rewardType: "points", rewardRate: 2, pointTypeId: 9 },
  });
  await prisma.creditCard.upsert({
    where: { id: 4 },
    update: { name: "Wells Fargo Autograph Journey", rewardType: "points", rewardRate: 5, pointTypeId: 12 },
    create: { id: 4, name: "Wells Fargo Autograph Journey", rewardType: "points", rewardRate: 5, pointTypeId: 12 },
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
