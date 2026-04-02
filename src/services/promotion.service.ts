import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { matchPromotionsForAffectedBookings, reevaluateBookings } from "@/services/promotion-apply";
import type {
  PromotionFormData,
  PromotionBenefitFormData,
  PromotionRestrictionsFormData,
} from "@/lib/types";
import type { AccommodationType } from "@prisma/client";

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

export async function getPromotion(_id: string, _userId: string): Promise<FullPromotion> {
  throw new Error("not implemented");
}

export async function listPromotions(_userId: string, _type?: string): Promise<FullPromotion[]> {
  throw new Error("not implemented");
}

export async function createPromotion(
  _userId: string,
  _data: PromotionFormData
): Promise<FullPromotion> {
  throw new Error("not implemented");
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

// Placeholders that reference imports used by later task implementations,
// preventing "defined but never used" lint errors on the skeleton.
// These will be replaced by real usage in subsequent tasks.
void (prisma as unknown);
void (AppError as unknown);
void (matchPromotionsForAffectedBookings as unknown);
void (reevaluateBookings as unknown);
void (buildBenefitCreateData as unknown);
void (PROMOTION_INCLUDE as unknown);
