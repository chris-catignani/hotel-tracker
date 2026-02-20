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
    update: { name: "Hilton", loyaltyProgram: "Hilton Honors", basePointRate: 10, elitePointRate: 10, pointTypeId: 1 },
    create: { id: HOTEL_ID.HILTON, name: "Hilton", loyaltyProgram: "Hilton Honors", basePointRate: 10, elitePointRate: 10, pointTypeId: 1 },
  });
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.MARRIOTT },
    update: { name: "Marriott", loyaltyProgram: "Marriott Bonvoy", basePointRate: 10, elitePointRate: 7.5, pointTypeId: 2 },
    create: { id: HOTEL_ID.MARRIOTT, name: "Marriott", loyaltyProgram: "Marriott Bonvoy", basePointRate: 10, elitePointRate: 7.5, pointTypeId: 2 },
  });
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.HYATT },
    update: { name: "Hyatt", loyaltyProgram: "World of Hyatt", basePointRate: 5, elitePointRate: 1.5, pointTypeId: 3 },
    create: { id: HOTEL_ID.HYATT, name: "Hyatt", loyaltyProgram: "World of Hyatt", basePointRate: 5, elitePointRate: 1.5, pointTypeId: 3 },
  });
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.IHG },
    update: { name: "IHG", loyaltyProgram: "IHG One Rewards", basePointRate: 10, elitePointRate: 10, pointTypeId: 4 },
    create: { id: HOTEL_ID.IHG, name: "IHG", loyaltyProgram: "IHG One Rewards", basePointRate: 10, elitePointRate: 10, pointTypeId: 4 },
  });
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.GHA_DISCOVERY },
    update: { name: "GHA Discovery", loyaltyProgram: "GHA Discovery", basePointRate: 4, elitePointRate: 3, pointTypeId: 5 },
    create: { id: HOTEL_ID.GHA_DISCOVERY, name: "GHA Discovery", loyaltyProgram: "GHA Discovery", basePointRate: 4, elitePointRate: 3, pointTypeId: 5 },
  });
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.ACCOR },
    update: { name: "Accor", loyaltyProgram: "ALL - Accor Live Limitless", basePointRate: 25, elitePointRate: 0, pointTypeId: 6 },
    create: { id: HOTEL_ID.ACCOR, name: "Accor", loyaltyProgram: "ALL - Accor Live Limitless", basePointRate: 25, elitePointRate: 0, pointTypeId: 6 },
  });

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
