import { PrismaClient, Prisma } from "@prisma/client";
import { HOTEL_ID, SUB_BRAND_ID } from "../src/lib/constants";
import { CREDIT_CARD_ID } from "./seed-ids";

const prisma = new PrismaClient();

export async function seedPromotions(userId: string) {
  const promotions: Omit<Prisma.PromotionCreateInput, "user">[] = [
    {
      name: "IHG 2x Promo",
      type: "loyalty",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
      hotelChain: { connect: { id: HOTEL_ID.IHG } },
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
            value: "2",
            pointsMultiplierBasis: "base_only",
            sortOrder: 0,
          },
        ],
      },
    },
    {
      name: "WF Card Linked Offer",
      type: "credit_card",
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-04-30"),
      creditCard: { connect: { id: CREDIT_CARD_ID.WELLS_FARGO_AUTOGRAPH } },
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
            value: "10",
            sortOrder: 0,
          },
        ],
      },
    },
    {
      name: "IHG Bonus EQN",
      type: "loyalty",
      startDate: new Date("2026-01-22"),
      endDate: new Date("2026-03-31"),
      hotelChain: { connect: { id: HOTEL_ID.IHG } },
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
            value: "1",
            sortOrder: 0,
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
      startDate: new Date("2026-02-02"),
      endDate: new Date("2026-04-15"),
      hotelChain: { connect: { id: HOTEL_ID.HYATT } },
      benefits: {
        create: [
          {
            rewardType: "points",
            valueType: "fixed",
            value: "3000",
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
          {
            rewardType: "points",
            valueType: "fixed",
            value: "1000",
            sortOrder: 1,
            restrictions: {
              create: {
                minNightsRequired: 3,
                nightsStackable: true,
                spanStays: true,
                maxTotalBonusPoints: 7000,
                subBrandRestrictions: {
                  create: [
                    {
                      hotelChainSubBrandId: SUB_BRAND_ID.HYATT.HYATT_PLACE,
                      mode: "include",
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
    {
      name: "GHA multi brand",
      type: "loyalty",
      startDate: new Date("2025-12-01"),
      endDate: new Date("2026-05-31"),
      hotelChain: { connect: { id: HOTEL_ID.GHA_DISCOVERY } },
      tiers: {
        create: [
          {
            minStays: 2,
            maxStays: 2,
            minNights: null,
            maxNights: null,
            benefits: {
              create: [
                {
                  rewardType: "points",
                  valueType: "fixed",
                  value: "5000",
                  sortOrder: 0,
                },
              ],
            },
          },
          {
            minStays: 3,
            maxStays: 3,
            minNights: null,
            maxNights: null,
            benefits: {
              create: [
                {
                  rewardType: "points",
                  valueType: "fixed",
                  value: "7500",
                  sortOrder: 0,
                },
              ],
            },
          },
          {
            minStays: 4,
            maxStays: 10,
            minNights: null,
            maxNights: null,
            benefits: {
              create: [
                {
                  rewardType: "points",
                  valueType: "fixed",
                  value: "10000",
                  sortOrder: 0,
                },
              ],
            },
          },
        ],
      },
    },
    {
      name: "Hyatt Place/House 5k",
      type: "loyalty",
      startDate: new Date("2026-01-20"),
      endDate: new Date("2026-12-31"),
      hotelChain: { connect: { id: HOTEL_ID.HYATT } },
      restrictions: {
        create: {
          subBrandRestrictions: {
            create: [
              {
                hotelChainSubBrandId: SUB_BRAND_ID.HYATT.HYATT_HOUSE,
                mode: "include",
              },
              {
                hotelChainSubBrandId: SUB_BRAND_ID.HYATT.HYATT_PLACE,
                mode: "include",
              },
            ],
          },
        },
      },
      benefits: {
        create: [
          {
            rewardType: "points",
            valueType: "fixed",
            value: "5000",
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
    {
      name: "Marriott Global Q1",
      type: "loyalty",
      startDate: new Date("2026-02-25"),
      endDate: new Date("2026-05-10"),
      hotelChain: { connect: { id: HOTEL_ID.MARRIOTT } },
      restrictions: {
        create: {
          allowedPaymentTypes: ["cash"],
        },
      },
      benefits: {
        create: [
          {
            rewardType: "points",
            valueType: "fixed",
            value: "1500",
            sortOrder: 0,
          },
          {
            rewardType: "eqn",
            valueType: "fixed",
            value: "1",
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
      name: "GHA App",
      type: "loyalty",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-04-01"),
      hotelChain: { connect: { id: HOTEL_ID.GHA_DISCOVERY } },
      restrictions: {
        create: {
          allowedBookingSources: ["direct_app"],
        },
      },
      benefits: {
        create: [
          {
            rewardType: "points",
            valueType: "fixed",
            value: "500",
            sortOrder: 0,
          },
        ],
      },
    },
    {
      name: "Accor APAC 2026",
      type: "loyalty",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-05-15"),
      hotelChain: { connect: { id: HOTEL_ID.ACCOR } },
      restrictions: {
        create: {
          allowedCountryCodes: ["KR"],
        },
      },
      benefits: {
        create: [
          {
            rewardType: "points",
            valueType: "fixed",
            value: "2026",
            sortOrder: 0,
          },
        ],
      },
    },
  ];

  for (const promo of promotions) {
    const existing = await prisma.promotion.findFirst({
      where: { name: promo.name, userId },
    });

    if (!existing) {
      await prisma.promotion.create({
        data: { ...promo, user: { connect: { id: userId } } },
      });
    } else {
      // Update existing promotion if needed
      // For simplicity in seed, we just leave it or could delete and recreate
    }
  }

  console.log("Promotions seeded successfully");

  // Seed BookingPromotion application logic moved from seed-bookings.ts
  await seedBookingPromotions(userId);
}

async function seedBookingPromotions(userId: string) {
  const bookingPromosData = [
    {
      bookingId: "ctshv1is5aacu6rwsrsebfyxi",
      promotionName: "GHA multi brand",
      appliedValue: "0",
      bonusPointsApplied: null,
      eligibleNightsAtBooking: 2,
      benefits: [
        {
          rewardType: "points",
          value: "5000",
          appliedValue: "0",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 2,
        },
      ],
    },
    {
      bookingId: "ctshv1is5aacu6rwsrsebfyxi",
      promotionName: "GHA App",
      appliedValue: "5",
      bonusPointsApplied: 500,
      eligibleNightsAtBooking: 2,
      benefits: [
        {
          rewardType: "points",
          value: "500",
          appliedValue: "5",
          bonusPointsApplied: 500,
          eligibleNightsAtBooking: 2,
        },
      ],
    },
    {
      bookingId: "cnrxt78gdols3zb0bxsmaciaq",
      promotionName: "GHA multi brand",
      appliedValue: "50",
      bonusPointsApplied: 5000,
      eligibleNightsAtBooking: 2,
      benefits: [
        {
          rewardType: "points",
          value: "5000",
          appliedValue: "50",
          bonusPointsApplied: 5000,
          eligibleNightsAtBooking: 4,
        },
      ],
    },
    {
      bookingId: "cnrxt78gdols3zb0bxsmaciaq",
      promotionName: "GHA App",
      appliedValue: "5",
      bonusPointsApplied: 500,
      eligibleNightsAtBooking: 2,
      benefits: [
        {
          rewardType: "points",
          value: "500",
          appliedValue: "5",
          bonusPointsApplied: 500,
          eligibleNightsAtBooking: 2,
        },
      ],
    },
    {
      bookingId: "cwy9rm93feastnxmna5u75arp",
      promotionName: "GHA multi brand",
      appliedValue: "75",
      bonusPointsApplied: 7500,
      eligibleNightsAtBooking: 2,
      benefits: [
        {
          rewardType: "points",
          value: "7500",
          appliedValue: "75",
          bonusPointsApplied: 7500,
          eligibleNightsAtBooking: 2,
        },
      ],
    },
    {
      bookingId: "cwy9rm93feastnxmna5u75arp",
      promotionName: "GHA App",
      appliedValue: "5",
      bonusPointsApplied: 500,
      eligibleNightsAtBooking: 2,
      benefits: [
        {
          rewardType: "points",
          value: "500",
          appliedValue: "5",
          bonusPointsApplied: 500,
          eligibleNightsAtBooking: 2,
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
      bookingId: "ct05t6xeejpm9q6dxgtvei3r8",
      promotionName: "IHG 2x Promo",
      appliedValue: "0",
      bonusPointsApplied: null,
      eligibleNightsAtBooking: 1,
      benefits: [
        {
          rewardType: "points",
          value: "2",
          appliedValue: "0",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 1,
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
          eligibleNightsAtBooking: 7,
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
      promotionName: "Hyatt Bonus Journeys",
      appliedValue: "160",
      bonusPointsApplied: 8000,
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
          appliedValue: "40",
          bonusPointsApplied: 2000,
          eligibleNightsAtBooking: 7,
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
          eligibleNightsAtBooking: 1,
        },
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
          eligibleNightsAtBooking: 5,
        },
        {
          rewardType: "eqn",
          value: "1",
          appliedValue: "10",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 5,
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
          eligibleNightsAtBooking: 6,
        },
        {
          rewardType: "eqn",
          value: "1",
          appliedValue: "10",
          bonusPointsApplied: null,
          eligibleNightsAtBooking: 6,
        },
      ],
    },
    {
      bookingId: "cmgz12kjvzu90qvn5wxrki7ui",
      promotionName: "Accor APAC 2026",
      appliedValue: "44.57",
      bonusPointsApplied: 2026,
      eligibleNightsAtBooking: 1,
      benefits: [
        {
          rewardType: "points",
          value: "2026",
          appliedValue: "44.57",
          bonusPointsApplied: 2026,
          eligibleNightsAtBooking: 1,
        },
      ],
    },
  ];

  // Clear existing before seeding to avoid duplicates
  await prisma.bookingPromotion.deleteMany({});

  for (const bp of bookingPromosData) {
    const promotion = await prisma.promotion.findFirst({
      where: { name: bp.promotionName, userId },
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
  const standaloneUserId = process.env.SEED_USER_ID ?? "";
  seedPromotions(standaloneUserId)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
