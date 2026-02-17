import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Hotels
  const hiltonData = {
    name: "Hilton",
    loyaltyProgram: "Hilton Honors",
    basePointRate: 10,
    elitePointRate: 10,
    pointValue: 0.005,
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
    elitePointRate: 12.5,
    pointValue: 0.007,
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
    elitePointRate: 5.5,
    pointValue: 0.017,
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
    pointValue: 0.005,
  };
  const ihg = await prisma.hotel.upsert({
    where: { id: 4 },
    update: ihgData,
    create: ihgData,
  });
  const ghaData = {
    name: "GHA Discovery",
    loyaltyProgram: "GHA Discovery",
    basePointRate: 0,
    elitePointRate: 0,
    pointValue: 0,
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
    pointValue: 0.02,
  };
  const accor = await prisma.hotel.upsert({
    where: { id: 6 },
    update: accorData,
    create: accorData,
  });

  // Credit Cards
  const amexPlat = await prisma.creditCard.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Amex Platinum",
      rewardType: "points",
      rewardRate: 0.05,
      pointValue: 0.02,
    },
  });
  const chaseSapphire = await prisma.creditCard.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "Chase Sapphire Reserve",
      rewardType: "points",
      rewardRate: 0.03,
      pointValue: 0.02,
    },
  });
  const ventureX = await prisma.creditCard.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: "Capital One Venture X",
      rewardType: "points",
      rewardRate: 0.1,
      pointValue: 0.01,
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
