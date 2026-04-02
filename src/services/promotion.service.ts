import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { matchPromotionsForAffectedBookings, reevaluateBookings } from "@/services/promotion-apply";
import type {
  PromotionFormData,
  PromotionBenefitFormData,
  PromotionRestrictionsFormData,
  PromotionTierFormData,
} from "@/lib/types";
import type { AccommodationType, PromotionType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Internal helpers (moved from lib/promotion-api-helpers.ts)
// ---------------------------------------------------------------------------

function buildRestrictionsCreateData(r: PromotionRestrictionsFormData) {
  return {
    minSpend: r.minSpend ? Number(r.minSpend) : null,
    minNightsRequired: r.minNightsRequired ? Number(r.minNightsRequired) : null,
    nightsStackable: r.nightsStackable ?? false,
    spanStays: r.spanStays ?? false,
    maxStayCount: r.maxStayCount ? Number(r.maxStayCount) : null,
    maxRewardCount: r.maxRewardCount ? Number(r.maxRewardCount) : null,
    maxRedemptionValue: r.maxRedemptionValue ? Number(r.maxRedemptionValue) : null,
    maxTotalBonusPoints: r.maxTotalBonusPoints ? Number(r.maxTotalBonusPoints) : null,
    oncePerSubBrand: r.oncePerSubBrand ?? false,
    prerequisiteStayCount: r.prerequisiteStayCount ? Number(r.prerequisiteStayCount) : null,
    prerequisiteNightCount: r.prerequisiteNightCount ? Number(r.prerequisiteNightCount) : null,
    bookByDate: r.bookByDate ? new Date(r.bookByDate) : null,
    registrationDeadline: r.registrationDeadline ? new Date(r.registrationDeadline) : null,
    validDaysAfterRegistration: r.validDaysAfterRegistration
      ? Number(r.validDaysAfterRegistration)
      : null,
    tieInRequiresPayment: r.tieInRequiresPayment ?? false,
    allowedPaymentTypes: r.allowedPaymentTypes ?? [],
    allowedBookingSources: r.allowedBookingSources ?? [],
    allowedCountryCodes: r.allowedCountryCodes ?? [],
    allowedAccommodationTypes: (r.allowedAccommodationTypes ?? []) as AccommodationType[],
    hotelChainId: r.hotelChainId || null,
    subBrandRestrictions: {
      create: [
        ...(r.subBrandIncludeIds ?? []).map((id) => ({
          hotelChainSubBrandId: id,
          mode: "include" as const,
        })),
        ...(r.subBrandExcludeIds ?? []).map((id) => ({
          hotelChainSubBrandId: id,
          mode: "exclude" as const,
        })),
      ],
    },
    tieInCards: {
      create: (r.tieInCreditCardIds ?? []).map((id) => ({ creditCardId: id })),
    },
  };
}

function buildBenefitCreateData(b: PromotionBenefitFormData, i: number) {
  const base = {
    rewardType: b.rewardType,
    valueType: b.valueType,
    value: Number(b.value),
    certType: b.certType || null,
    pointsMultiplierBasis: b.pointsMultiplierBasis || null,
    sortOrder: b.sortOrder ?? i,
  };
  if (b.restrictions) {
    return { ...base, restrictions: { create: buildRestrictionsCreateData(b.restrictions) } };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Shared include + return type
// ---------------------------------------------------------------------------

const PROMOTION_INCLUDE = {
  hotelChain: true,
  creditCard: true,
  shoppingPortal: true,
  restrictions: {
    include: { subBrandRestrictions: true, tieInCards: true },
  },
  benefits: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      restrictions: { include: { subBrandRestrictions: true, tieInCards: true } },
    },
  },
  tiers: {
    orderBy: { minStays: "asc" as const },
    include: {
      benefits: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          restrictions: { include: { subBrandRestrictions: true, tieInCards: true } },
        },
      },
    },
  },
  userPromotions: true,
} as const;

export type FullPromotion = Prisma.PromotionGetPayload<{ include: typeof PROMOTION_INCLUDE }>;

// ---------------------------------------------------------------------------
// Exported service functions (stubs — implemented in later tasks)
// ---------------------------------------------------------------------------

export async function getPromotion(id: string, userId: string): Promise<FullPromotion> {
  const promotion = await prisma.promotion.findFirst({
    where: { id, userId },
    include: PROMOTION_INCLUDE,
  });
  if (!promotion) throw new AppError("Promotion not found", 404);
  return promotion;
}

export async function listPromotions(_userId: string, type?: string): Promise<FullPromotion[]> {
  const where: Record<string, unknown> = {};
  if (type) where.type = type as PromotionType;
  return prisma.promotion.findMany({ where, include: PROMOTION_INCLUDE });
}

export async function createPromotion(
  userId: string,
  data: PromotionFormData
): Promise<FullPromotion> {
  const {
    name,
    type,
    benefits,
    tiers,
    hotelChainId,
    creditCardId,
    shoppingPortalId,
    startDate,
    endDate,
    restrictions,
  } = data;

  const registrationDate = (restrictions as PromotionRestrictionsFormData | null)?.registrationDate;
  const hasTiers = Array.isArray(tiers) && tiers.length > 0;

  const promotion = await prisma.$transaction(async (tx) => {
    const created = await tx.promotion.create({
      data: {
        name,
        type,
        user: { connect: { id: userId } },
        hotelChain: hotelChainId ? { connect: { id: hotelChainId } } : undefined,
        creditCard: creditCardId ? { connect: { id: creditCardId } } : undefined,
        shoppingPortal: shoppingPortalId ? { connect: { id: shoppingPortalId } } : undefined,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        ...(restrictions
          ? { restrictions: { create: buildRestrictionsCreateData(restrictions) } }
          : {}),
        ...(hasTiers
          ? {
              tiers: {
                create: (tiers as PromotionTierFormData[]).map((tier) => ({
                  minStays: tier.minStays,
                  maxStays: tier.maxStays ?? null,
                  benefits: {
                    create: (tier.benefits || []).map((b: PromotionBenefitFormData, i: number) =>
                      buildBenefitCreateData(b, i)
                    ),
                  },
                })),
              },
            }
          : {
              benefits: {
                create: ((benefits as PromotionBenefitFormData[]) || []).map((b, i) =>
                  buildBenefitCreateData(b, i)
                ),
              },
            }),
      } as unknown as Prisma.PromotionCreateInput,
      include: PROMOTION_INCLUDE,
    });

    if (registrationDate) {
      await tx.userPromotion.create({
        data: {
          promotionId: created.id,
          userId,
          registrationDate: new Date(registrationDate),
        },
      });
    }

    return tx.promotion.findUnique({
      where: { id: created.id },
      include: PROMOTION_INCLUDE,
    }) as Promise<FullPromotion>;
  });

  await matchPromotionsForAffectedBookings(promotion.id, userId);
  return promotion;
}

export async function updatePromotion(
  id: string,
  userId: string,
  data: PromotionFormData
): Promise<FullPromotion> {
  const {
    name,
    type,
    benefits,
    tiers,
    hotelChainId,
    creditCardId,
    shoppingPortalId,
    startDate,
    endDate,
    restrictions,
  } = data;

  // Verify ownership before updating
  const existing = await prisma.promotion.findFirst({
    where: { id, userId },
  });
  if (!existing) throw new AppError("Promotion not found", 404);

  const registrationDate = (restrictions as PromotionRestrictionsFormData | null)?.registrationDate;
  const hasTiers = Array.isArray(tiers) && tiers.length > 0;
  const replacingBenefitsOrTiers = benefits !== undefined || tiers !== undefined;

  const promotion = await prisma.$transaction(async (tx) => {
    const updateData: Prisma.PromotionUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;

    // Fix Bug 1: Use disconnect pattern when value is falsy but defined
    if (hotelChainId !== undefined) {
      updateData.hotelChain = hotelChainId
        ? { connect: { id: hotelChainId } }
        : { disconnect: true };
    }
    if (creditCardId !== undefined) {
      updateData.creditCard = creditCardId
        ? { connect: { id: creditCardId } }
        : { disconnect: true };
    }
    if (shoppingPortalId !== undefined) {
      updateData.shoppingPortal = shoppingPortalId
        ? { connect: { id: shoppingPortalId } }
        : { disconnect: true };
    }

    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    // Handle restrictions: upsert, create, or delete
    if (restrictions !== undefined) {
      if (restrictions === null) {
        // Clear restrictions if they exist
        const currentRestrictions = await tx.promotion.findUnique({
          where: { id },
          select: { restrictionsId: true },
        });
        if (currentRestrictions?.restrictionsId) {
          await tx.promotionRestrictions.delete({
            where: { id: currentRestrictions.restrictionsId },
          });
          updateData.restrictions = { disconnect: true };
        }
      } else if (restrictions) {
        const currentRestrictions = await tx.promotion.findUnique({
          where: { id },
          select: { restrictionsId: true },
        });
        if (currentRestrictions?.restrictionsId) {
          // Upsert: delete sub-relations and update
          await tx.promotionSubBrandRestriction.deleteMany({
            where: { promotionRestrictionsId: currentRestrictions.restrictionsId },
          });
          await tx.promotionRestrictionTieInCard.deleteMany({
            where: { promotionRestrictionsId: currentRestrictions.restrictionsId },
          });
          await tx.promotionRestrictions.update({
            where: { id: currentRestrictions.restrictionsId },
            data: buildRestrictionsCreateData(restrictions),
          });
          updateData.restrictions = { connect: { id: currentRestrictions.restrictionsId } };
        } else {
          // Create new restrictions
          const created = await tx.promotionRestrictions.create({
            data: buildRestrictionsCreateData(restrictions),
          });
          updateData.restrictions = { connect: { id: created.id } };
        }
      }
    }

    // Fix Bug 2: Clean up restriction records before deleteMany
    if (replacingBenefitsOrTiers) {
      // Delete flat benefits (those directly on the promotion) along with their restrictions
      const benefitsToDelete = await tx.promotionBenefit.findMany({
        where: { promotionId: id },
        select: { id: true, restrictionsId: true },
      });
      for (const b of benefitsToDelete) {
        if (b.restrictionsId) {
          await tx.promotionRestrictions.delete({ where: { id: b.restrictionsId } });
        }
      }
      await tx.promotionBenefit.deleteMany({ where: { promotionId: id } });

      // Delete all tiers along with their benefits' restrictions
      const tiersToDelete = await tx.promotionTier.findMany({
        where: { promotionId: id },
        include: { benefits: { select: { id: true, restrictionsId: true } } },
      });
      for (const tier of tiersToDelete) {
        for (const b of tier.benefits) {
          if (b.restrictionsId) {
            await tx.promotionRestrictions.delete({ where: { id: b.restrictionsId } });
          }
        }
      }
      await tx.promotionTier.deleteMany({ where: { promotionId: id } });
    }

    if (tiers !== undefined && Array.isArray(tiers) && tiers.length > 0) {
      updateData.tiers = {
        create: (tiers as PromotionTierFormData[]).map((tier) => ({
          minStays: tier.minStays,
          maxStays: tier.maxStays ?? null,
          benefits: {
            create: (tier.benefits || []).map((b: PromotionBenefitFormData, i: number) =>
              buildBenefitCreateData(b, i)
            ),
          },
        })),
      } as Prisma.PromotionTierUpdateManyWithoutPromotionNestedInput;
    } else if (benefits !== undefined && !hasTiers) {
      updateData.benefits = {
        create: ((benefits as PromotionBenefitFormData[]) || []).map((b, i) =>
          buildBenefitCreateData(b, i)
        ),
      } as Prisma.PromotionBenefitUpdateManyWithoutPromotionNestedInput;
    }

    // Handle UserPromotion: upsert if registrationDate provided, delete if empty string
    if (registrationDate !== undefined) {
      if (registrationDate) {
        await tx.userPromotion.upsert({
          where: { promotionId: id },
          update: { registrationDate: new Date(registrationDate) },
          create: {
            promotionId: id,
            userId,
            registrationDate: new Date(registrationDate),
          },
        });
      } else {
        await tx.userPromotion.deleteMany({
          where: { promotionId: id },
        });
      }
    }

    // Update promotion
    return tx.promotion.update({
      where: { id },
      data: updateData,
      include: PROMOTION_INCLUDE,
    });
  });

  await matchPromotionsForAffectedBookings(id, userId);
  return promotion as FullPromotion;
}

export async function deletePromotion(id: string, userId: string): Promise<void> {
  const exists = await prisma.promotion.findFirst({ where: { id, userId }, select: { id: true } });
  if (!exists) throw new AppError("Promotion not found", 404);

  const affectedBookings = await prisma.booking.findMany({
    where: { userId, bookingPromotions: { some: { promotionId: id } } },
    select: { id: true },
  });

  const promo = await prisma.promotion.findUnique({
    where: { id },
    select: {
      restrictionsId: true,
      benefits: { select: { restrictionsId: true } },
      tiers: { include: { benefits: { select: { restrictionsId: true } } } },
    },
  });

  const restrictionIdsToDelete = [
    promo?.restrictionsId,
    ...(promo?.benefits ?? []).map((b) => b.restrictionsId),
    ...(promo?.tiers ?? []).flatMap((t) => t.benefits.map((b) => b.restrictionsId)),
  ].filter((rid): rid is string => rid !== null && rid !== undefined);

  await prisma.promotion.delete({ where: { id } });

  if (restrictionIdsToDelete.length > 0) {
    await prisma.promotionRestrictions.deleteMany({
      where: { id: { in: restrictionIdsToDelete } },
    });
  }

  if (affectedBookings.length > 0) {
    await reevaluateBookings(
      affectedBookings.map((b) => b.id),
      userId
    );
  }
}
