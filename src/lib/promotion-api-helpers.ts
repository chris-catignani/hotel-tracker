import type { PromotionBenefitFormData, PromotionRestrictionsFormData } from "@/lib/types";

export function buildRestrictionsCreateData(r: PromotionRestrictionsFormData) {
  return {
    minSpend: r.minSpend ? Number(r.minSpend) : null,
    minNightsRequired: r.minNightsRequired ? Number(r.minNightsRequired) : null,
    nightsStackable: r.nightsStackable ?? false,
    spanStays: r.spanStays ?? false,
    maxStayCount: r.maxStayCount ? Number(r.maxStayCount) : null,
    maxRewardCount: r.maxRewardCount ? Number(r.maxRewardCount) : null,
    maxRedemptionValue: r.maxRedemptionValue ? Number(r.maxRedemptionValue) : null,
    maxTotalBonusPoints: r.maxTotalBonusPoints ? Number(r.maxTotalBonusPoints) : null,
    maxTotalNights: r.maxTotalNights ? Number(r.maxTotalNights) : null,
    oncePerSubBrand: r.oncePerSubBrand ?? false,
    bookByDate: r.bookByDate ? new Date(r.bookByDate) : null,
    registrationDeadline: r.registrationDeadline ? new Date(r.registrationDeadline) : null,
    validDaysAfterRegistration: r.validDaysAfterRegistration
      ? Number(r.validDaysAfterRegistration)
      : null,
    tieInRequiresPayment: r.tieInRequiresPayment ?? false,
    allowedPaymentTypes: r.allowedPaymentTypes ?? [],
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

export function buildBenefitCreateData(b: PromotionBenefitFormData, i: number) {
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
