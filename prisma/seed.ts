import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Hotels
  const hilton = await prisma.hotel.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Hilton", loyaltyProgram: "Hilton Honors" },
  });
  const marriott = await prisma.hotel.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "Marriott", loyaltyProgram: "Marriott Bonvoy" },
  });
  const hyatt = await prisma.hotel.upsert({
    where: { id: 3 },
    update: {},
    create: { name: "Hyatt", loyaltyProgram: "World of Hyatt" },
  });
  const ihg = await prisma.hotel.upsert({
    where: { id: 4 },
    update: {},
    create: { name: "IHG", loyaltyProgram: "IHG One Rewards" },
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
    hotels: [hilton, marriott, hyatt, ihg],
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
