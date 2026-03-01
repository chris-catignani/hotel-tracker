import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedPromotions() {
  const promotions: Prisma.PromotionCreateInput[] = [
    {
      name: "IHG 2x Promo",
      type: "loyalty",
      hotelChain: { connect: { id: "co5ll49okbgq0fbceti8p0dpd" } },
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),

      restrictions: {
        create: {
          prerequisiteStayCount: 1,
        },
      },
      benefits: {
        create: [
          {
            rewardType: "points",
            valueType: "multiplier",
            value: 2,
          },
        ],
      },
    },
    {
      name: "WF Card Linked Offer",
      type: "credit_card",
      creditCard: { connect: { id: "cvn8tp6d6nae4s543nno1qc6p" } },
      startDate: new Date("2026-02-01"),

      endDate: new Date("2026-04-30"),
      restrictions: {
        create: {
          maxRewardCount: 1,
        },
      },
      benefits: {
        create: [
          {
            rewardType: "cashback",
            valueType: "percentage",
            value: 10,
            pointsMultiplierBasis: "base_only",
          },
        ],
      },
    },
    {
      name: "IHG Bonus EQN",
      type: "loyalty",
      hotelChain: { connect: { id: "co5ll49okbgq0fbceti8p0dpd" } },
      startDate: new Date("2026-01-22"),

      endDate: new Date("2026-03-31"),
      restrictions: {
        create: {
          minNightsRequired: 1,
          nightsStackable: true,
          spanStays: true,
        },
      },
      benefits: {
        create: [
          {
            rewardType: "eqn",
            valueType: "fixed",
            value: 1,
            restrictions: {
              create: {},
            },
          },
        ],
      },
    },
    {
      name: "Hyatt Bonus Journeys",
      type: "loyalty",
      hotelChain: { connect: { id: "cxjdwg32a8xf7by36md0mdvuu" } },
      startDate: new Date("2026-02-02"),

      endDate: new Date("2026-04-15"),
      benefits: {
        create: [
          {
            rewardType: "points",
            valueType: "fixed",
            value: 1000,
            sortOrder: 1,
            restrictions: {
              create: {
                minNightsRequired: 3,
                nightsStackable: true,
                spanStays: true,
                maxTotalBonusPoints: 7000,
                subBrandRestrictions: {
                  create: [{ hotelChainSubBrandId: "ckz1vxi70wnbaq3qehma0fhcc", mode: "include" }],
                },
              },
            },
          },
          {
            rewardType: "points",
            valueType: "fixed",
            value: 3000,
            sortOrder: 0,
            restrictions: {
              create: {
                minNightsRequired: 3,
                nightsStackable: true,
                spanStays: true,
                maxTotalBonusPoints: 21000,
              },
            },
          },
        ],
      },
    },
    {
      name: "GHA multi brand",
      type: "loyalty",
      hotelChain: { connect: { id: "cwizlxi70wnbaq3qehma0fhbz" } },
      startDate: new Date("2025-12-01"),

      endDate: new Date("2026-05-31"),
      tiers: {
        create: [
          {
            minStays: 2,
            maxStays: 2,
            benefits: {
              create: [
                {
                  rewardType: "points",
                  valueType: "fixed",
                  value: 4999,
                },
              ],
            },
          },
          {
            minStays: 3,
            maxStays: 3,
            benefits: {
              create: [
                {
                  rewardType: "points",
                  valueType: "fixed",
                  value: 7499,
                },
              ],
            },
          },
          {
            minStays: 4,
            maxStays: 10,
            benefits: {
              create: [
                {
                  rewardType: "points",
                  valueType: "fixed",
                  value: 9999,
                },
              ],
            },
          },
        ],
      },
    },
    {
      name: "Marriott Global Q1",
      type: "loyalty",
      hotelChain: { connect: { id: "c9uc76fdp3v95dccffxsa3h31" } },
      startDate: new Date("2026-02-25"),

      endDate: new Date("2026-05-10"),
      benefits: {
        create: [
          {
            rewardType: "points",
            valueType: "fixed",
            value: 1500,
            sortOrder: 0,
          },
          {
            rewardType: "eqn",
            valueType: "fixed",
            value: 1,
            sortOrder: 1,
            restrictions: {
              create: {
                oncePerSubBrand: true,
              },
            },
          },
        ],
      },
    },
    {
      name: "Hyatt Place/House 5k",
      type: "loyalty",
      hotelChain: { connect: { id: "cxjdwg32a8xf7by36md0mdvuu" } },
      startDate: new Date("2026-01-20"),
      endDate: new Date("2026-12-31"),
      restrictions: {
        create: {
          subBrandRestrictions: {
            create: [
              { hotelChainSubBrandId: "ckz1vxi70wnbaq3qehma0fhbz", mode: "include" }, // Hyatt House
              { hotelChainSubBrandId: "ckz1vxi70wnbaq3qehma0fhcc", mode: "include" }, // Hyatt Place
            ],
          },
        },
      },
      benefits: {
        create: [
          {
            rewardType: "points",
            valueType: "fixed",
            value: 5000,
            sortOrder: 0,
            restrictions: {
              create: {
                minNightsRequired: 5,
                maxTotalBonusPoints: 50000,
              },
            },
          },
        ],
      },
    },
  ];

  for (const promo of promotions) {
    const existing = await prisma.promotion.findFirst({
      where: { name: promo.name },
    });

    if (!existing) {
      await prisma.promotion.create({
        data: promo,
      });
    }
  }

  console.log("Promotions seeded successfully");

  // Seed BookingPromotion application logic moved from seed-bookings.ts
  await seedBookingPromotions();
}

async function seedBookingPromotions() {
  const bookingPromosData = [
    {
      bookingId: "clas2mljema779deuxi5mhuee",
      promotionName: "Marriott Global Q1",
      appliedValue: "20.5",
      bonusPointsApplied: 1500,
      eligibleNightsAtBooking: 3,
      benefits: [
        {
          rewardType: "points",
          value: "1500",
          appliedValue: "10.5",
          bonusPointsApplied: 1500,
          eligibleNightsAtBooking: 3,
        },
        {
          rewardType: "eqn",
          value: "1",
          appliedValue: "10",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 3,
        },
      ],
    },
    {
      bookingId: "ct05t6xeejpm9q6dxgtvei3r8",
      promotionName: "IHG Bonus EQN",
      appliedValue: "10",
      bonusPointsApplied: null,
      eligibleNightsAtBooking: 1,
      benefits: [
        {
          rewardType: "eqn",
          value: "1",
          appliedValue: "10",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 1,
        },
      ],
    },
    {
      bookingId: "c4mv6rvmc0pln9mk7txqlshkm",
      promotionName: "WF Card Linked Offer",
      appliedValue: "57.1",
      bonusPointsApplied: null,
      eligibleNightsAtBooking: 6,
      benefits: [
        {
          rewardType: "cashback",
          value: "10",
          appliedValue: "57.1",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 6,
        },
      ],
    },
    {
      bookingId: "c4mv6rvmc0pln9mk7txqlshkm",
      promotionName: "IHG Bonus EQN",
      appliedValue: "60",
      bonusPointsApplied: null,
      eligibleNightsAtBooking: 7,
      benefits: [
        {
          rewardType: "eqn",
          value: "1",
          appliedValue: "60",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 7,
        },
      ],
    },
    {
      bookingId: "c4mv6rvmc0pln9mk7txqlshkm",
      promotionName: "IHG 2x Promo",
      appliedValue: "31.68",
      bonusPointsApplied: 5280,
      eligibleNightsAtBooking: 6,
      benefits: [
        {
          rewardType: "points",
          value: "2",
          appliedValue: "31.68",
          bonusPointsApplied: 5280,
          eligibleNightsAtBooking: 6,
        },
      ],
    },
    {
      bookingId: "cnrxt78gdols3zb0bxsmaciaq",
      promotionName: "GHA multi brand",
      appliedValue: "49.99",
      bonusPointsApplied: 4999,
      eligibleNightsAtBooking: 2,
      benefits: [
        {
          rewardType: "points",
          value: "4999",
          appliedValue: "49.99",
          bonusPointsApplied: 4999,
          eligibleNightsAtBooking: 2,
        },
      ],
    },
    {
      bookingId: "cwy9rm93feastnxmna5u75arp",
      promotionName: "GHA multi brand",
      appliedValue: "74.99",
      bonusPointsApplied: 7499,
      eligibleNightsAtBooking: 2,
      benefits: [
        {
          rewardType: "points",
          value: "7499",
          appliedValue: "74.99",
          bonusPointsApplied: 7499,
          eligibleNightsAtBooking: 2,
        },
      ],
    },
    {
      bookingId: "cuj2d4xsen4rntp0ujp9gvjb0",
      promotionName: "Marriott Global Q1",
      appliedValue: "20.5",
      bonusPointsApplied: 1500,
      eligibleNightsAtBooking: 1,
      benefits: [
        {
          rewardType: "points",
          value: "1500",
          appliedValue: "10.5",
          bonusPointsApplied: 1500,
          eligibleNightsAtBooking: 4,
        },
        {
          rewardType: "eqn",
          value: "1",
          appliedValue: "10",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 4,
        },
      ],
    },
    {
      bookingId: "cscx18qakqticrsl6g6xvh7ha",
      promotionName: "Hyatt Bonus Journeys",
      appliedValue: "140",
      bonusPointsApplied: 7000,
      eligibleNightsAtBooking: 7,
      benefits: [
        {
          rewardType: "points",
          value: "3000",
          appliedValue: "140",
          bonusPointsApplied: 7000,
          eligibleNightsAtBooking: 15,
        },
      ],
    },
    {
      bookingId: "cy58uq56kllc6feidriho04yh",
      promotionName: "Hyatt Place/House 5k",
      appliedValue: "100",
      bonusPointsApplied: 5000,
      eligibleNightsAtBooking: 7,
      benefits: [
        {
          rewardType: "points",
          value: "5000",
          appliedValue: "100",
          bonusPointsApplied: 5000,
          eligibleNightsAtBooking: 7,
        },
      ],
    },
    {
      bookingId: "cy58uq56kllc6feidriho04yh",
      promotionName: "Hyatt Bonus Journeys",
      appliedValue: "166.67",
      bonusPointsApplied: 8333,
      eligibleNightsAtBooking: 7,
      benefits: [
        {
          rewardType: "points",
          value: "3000",
          appliedValue: "120",
          bonusPointsApplied: 6000,
          eligibleNightsAtBooking: 22,
        },
        {
          rewardType: "points",
          value: "1000",
          appliedValue: "46.67",
          bonusPointsApplied: 2333,
          eligibleNightsAtBooking: 7,
        },
      ],
    },
    {
      bookingId: "cc2gaeqcxn2mj300o28duzvd5",
      promotionName: "Marriott Global Q1",
      appliedValue: "20.5",
      bonusPointsApplied: 1500,
      eligibleNightsAtBooking: 4,
      benefits: [
        {
          rewardType: "points",
          value: "1500",
          appliedValue: "10.5",
          bonusPointsApplied: 1500,
          eligibleNightsAtBooking: 8,
        },
        {
          rewardType: "eqn",
          value: "1",
          appliedValue: "10",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 8,
        },
      ],
    },
    {
      bookingId: "cpmpa0buq8jl85t5wcv13wvi8",
      promotionName: "Marriott Global Q1",
      appliedValue: "20.5",
      bonusPointsApplied: 1500,
      eligibleNightsAtBooking: 1,
      benefits: [
        {
          rewardType: "points",
          value: "1500",
          appliedValue: "10.5",
          bonusPointsApplied: 1500,
          eligibleNightsAtBooking: 13,
        },
        {
          rewardType: "eqn",
          value: "1",
          appliedValue: "10",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 13,
        },
      ],
    },
    {
      bookingId: "c83ak8zknu6pwcvqhbfhm7ekv",
      promotionName: "Hyatt Bonus Journeys",
      appliedValue: "20",
      bonusPointsApplied: 1000,
      eligibleNightsAtBooking: 1,
      benefits: [
        {
          rewardType: "points",
          value: "3000",
          appliedValue: "20",
          bonusPointsApplied: 1000,
          eligibleNightsAtBooking: 1,
        },
      ],
    },
    {
      bookingId: "cufi5o67mbga7e8an9rvsb2vn",
      promotionName: "Hyatt Bonus Journeys",
      appliedValue: "140",
      bonusPointsApplied: 7000,
      eligibleNightsAtBooking: 7,
      benefits: [
        {
          rewardType: "points",
          value: "3000",
          appliedValue: "140",
          bonusPointsApplied: 7000,
          eligibleNightsAtBooking: 8,
        },
      ],
    },
  ];

  // Clear existing before seeding to avoid duplicates
  await prisma.bookingPromotion.deleteMany({});

  for (const bp of bookingPromosData) {
    const promotion = await prisma.promotion.findFirst({
      where: { name: bp.promotionName },
      include: { benefits: true, tiers: { include: { benefits: true } } },
    });

    if (promotion) {
      const existingBooking = await prisma.booking.findUnique({ where: { id: bp.bookingId } });
      if (!existingBooking) continue;

      const bookingPromotion = await prisma.bookingPromotion.create({
        data: {
          bookingId: bp.bookingId,
          promotionId: promotion.id,
          appliedValue: bp.appliedValue,
          bonusPointsApplied: bp.bonusPointsApplied,
          eligibleNightsAtBooking: bp.eligibleNightsAtBooking,
          autoApplied: true,
          verified: false,
        },
      });

      for (const benefitData of bp.benefits) {
        let promoBenefit = promotion.benefits.find(
          (b) => b.rewardType === benefitData.rewardType && b.value.toString() === benefitData.value
        );

        if (!promoBenefit) {
          for (const tier of promotion.tiers) {
            promoBenefit = tier.benefits.find(
              (b) =>
                b.rewardType === benefitData.rewardType && b.value.toString() === benefitData.value
            );
            if (promoBenefit) break;
          }
        }

        if (promoBenefit) {
          await prisma.bookingPromotionBenefit.create({
            data: {
              bookingPromotionId: bookingPromotion.id,
              promotionBenefitId: promoBenefit.id,
              appliedValue: benefitData.appliedValue,
              bonusPointsApplied: benefitData.bonusPointsApplied,
              eligibleNightsAtBooking: benefitData.eligibleNightsAtBooking,
            },
          });
        }
      }
    }
  }

  console.log("Booking applications seeded successfully");
}

if (require.main === module) {
  seedPromotions()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
