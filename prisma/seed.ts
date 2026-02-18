import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // PointTypes
  await prisma.pointType.upsert({
    where: { id: 1 },
    update: { name: "Hilton Honors", category: "hotel", centsPerPoint: 0.0045 },
    create: { id: 1, name: "Hilton Honors", category: "hotel", centsPerPoint: 0.0045 },
  });
  await prisma.pointType.upsert({
    where: { id: 2 },
    update: { name: "Marriott Bonvoy", category: "hotel", centsPerPoint: 0.007 },
    create: { id: 2, name: "Marriott Bonvoy", category: "hotel", centsPerPoint: 0.007 },
  });
  await prisma.pointType.upsert({
    where: { id: 3 },
    update: { name: "World of Hyatt", category: "hotel", centsPerPoint: 0.02 },
    create: { id: 3, name: "World of Hyatt", category: "hotel", centsPerPoint: 0.02 },
  });
  await prisma.pointType.upsert({
    where: { id: 4 },
    update: { name: "IHG One Rewards", category: "hotel", centsPerPoint: 0.006 },
    create: { id: 4, name: "IHG One Rewards", category: "hotel", centsPerPoint: 0.006 },
  });
  await prisma.pointType.upsert({
    where: { id: 5 },
    update: { name: "GHA Discovery", category: "hotel", centsPerPoint: 0.01 },
    create: { id: 5, name: "GHA Discovery", category: "hotel", centsPerPoint: 0.01 },
  });
  await prisma.pointType.upsert({
    where: { id: 6 },
    update: { name: "ALL - Accor Live Limitless", category: "hotel", centsPerPoint: 0.022 },
    create: { id: 6, name: "ALL - Accor Live Limitless", category: "hotel", centsPerPoint: 0.022 },
  });
  await prisma.pointType.upsert({
    where: { id: 7 },
    update: { name: "Amex Membership Rewards", category: "credit_card", centsPerPoint: 0.020 },
    create: { id: 7, name: "Amex Membership Rewards", category: "credit_card", centsPerPoint: 0.020 },
  });
  await prisma.pointType.upsert({
    where: { id: 8 },
    update: { name: "Chase Ultimate Rewards", category: "credit_card", centsPerPoint: 0.020 },
    create: { id: 8, name: "Chase Ultimate Rewards", category: "credit_card", centsPerPoint: 0.020 },
  });
  await prisma.pointType.upsert({
    where: { id: 9 },
    update: { name: "Capital One Miles", category: "credit_card", centsPerPoint: 0.02 },
    create: { id: 9, name: "Capital One Miles", category: "credit_card", centsPerPoint: 0.02 },
  });

  // Hotels
  const hiltonData = {
    name: "Hilton",
    loyaltyProgram: "Hilton Honors",
    basePointRate: 10,
    elitePointRate: 10,
    pointTypeId: 1,
  };
  const hilton = await prisma.hotel.upsert({
    where: { id: 1 },
    update: hiltonData,
    create: hiltonData,
  });
  const marriottData = {
    name: "Marriott",
    loyaltyProgram: "Marriott Bonvoy",
    basePointRate: 10,
    elitePointRate: 7.5,
    pointTypeId: 2,
  };
  const marriott = await prisma.hotel.upsert({
    where: { id: 2 },
    update: marriottData,
    create: marriottData,
  });
  const hyattData = {
    name: "Hyatt",
    loyaltyProgram: "World of Hyatt",
    basePointRate: 5,
    elitePointRate: 1.5,
    pointTypeId: 3,
  };
  const hyatt = await prisma.hotel.upsert({
    where: { id: 3 },
    update: hyattData,
    create: hyattData,
  });
  const ihgData = {
    name: "IHG",
    loyaltyProgram: "IHG One Rewards",
    basePointRate: 10,
    elitePointRate: 10,
    pointTypeId: 4,
  };
  const ihg = await prisma.hotel.upsert({
    where: { id: 4 },
    update: ihgData,
    create: ihgData,
  });
  const ghaData = {
    name: "GHA Discovery",
    loyaltyProgram: "GHA Discovery",
    basePointRate: 4,
    elitePointRate: 3,
    pointTypeId: 5,
  };
  const ghaDiscovery = await prisma.hotel.upsert({
    where: { id: 5 },
    update: ghaData,
    create: ghaData,
  });
  const accorData = {
    name: "Accor",
    loyaltyProgram: "ALL - Accor Live Limitless",
    basePointRate: 25,
    elitePointRate: 0,
    pointTypeId: 6,
  };
  const accor = await prisma.hotel.upsert({
    where: { id: 6 },
    update: accorData,
    create: accorData,
  });

  // Credit Cards
  const amexPlat = await prisma.creditCard.upsert({
    where: { id: 1 },
    update: { pointTypeId: 7 },
    create: {
      name: "Amex Platinum",
      rewardType: "points",
      rewardRate: 1,
      pointTypeId: 7,
    },
  });
  const chaseSapphire = await prisma.creditCard.upsert({
    where: { id: 2 },
    update: { pointTypeId: 8 },
    create: {
      name: "Chase Sapphire Reserve",
      rewardType: "points",
      rewardRate: 4,
      pointTypeId: 8,
    },
  });
  const ventureX = await prisma.creditCard.upsert({
    where: { id: 3 },
    update: { pointTypeId: 9 },
    create: {
      name: "Capital One Venture X",
      rewardType: "points",
      rewardRate: 2,
      pointTypeId: 9,
    },
  });

  // Shopping Portals
  const rakuten = await prisma.shoppingPortal.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Rakuten" },
  });
  const topCashback = await prisma.shoppingPortal.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "TopCashback" },
  });

  console.log("Seed data created:", {
    hotels: [hilton, marriott, hyatt, ihg, ghaDiscovery, accor],
    creditCards: [amexPlat, chaseSapphire, ventureX],
    shoppingPortals: [rakuten, topCashback],
  });
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
