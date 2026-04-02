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
  _id: string,
  _userId: string,
  _data: PromotionFormData
): Promise<FullPromotion> {
  throw new Error("not implemented");
}

export async function deletePromotion(_id: string, _userId: string): Promise<void> {
  throw new Error("not implemented");
}

// Placeholder that references an import used by a later task implementation,
// preventing "defined but never used" lint errors on the skeleton.
// This will be replaced by real usage in a subsequent task.
void (reevaluateBookings as unknown);
