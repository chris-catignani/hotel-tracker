import prisma from "@/lib/prisma";
import {
  BookingPromotion,
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  Prisma,
} from "@prisma/client";
import { DEFAULT_EQN_VALUE } from "./constants";
import { certPointsValue } from "./cert-types";

export type PromotionUsage = {
  count: number;
  totalValue: number;
  totalBonusPoints: number;
  eligibleStayCount?: number;
  eligibleStayNights?: number; // For spanStays / nightsStackable scaling
  eligibleNightCount?: number; // For tier-based matching on cumulative nights
  appliedSubBrandIds?: Set<string | null>;
  totalPotentialStayCount?: number; // Total stays that match CORE criteria (orphaned detection)
  totalPotentialNightCount?: number; // Total nights that match CORE criteria (orphaned detection)
  futurePotentialStayCount?: number; // Stays with checkIn > currentBooking.checkIn (pre-qualifying detection)
  futurePotentialNightCount?: number; // Nights for future potential stays
  benefitUsage?: Map<
    string,
    {
      count: number;
      totalValue: number;
      totalBonusPoints: number;
      eligibleNights?: number;
      couldEverMatch?: boolean; // Does this benefit match the core criteria for ANY stay?
      totalPotentialNightCount?: number; // Cumulative potential nights for this specific benefit
      futurePotentialNightCount?: number; // Future potential nights for this specific benefit
    }
  >;
};
export type PromotionUsageMap = Map<string, PromotionUsage>;

const BOOKING_INCLUDE = {
  hotelChain: { include: { pointType: true } },
  hotelChainSubBrand: true,
  creditCard: { include: { pointType: true } },
  shoppingPortal: true,
  _count: { select: { certificates: true } },
  bookingPromotions: {
    include: {
      benefitApplications: true,
    },
  },
} as const;

type MatchingRestrictions = {
  minSpend: Prisma.Decimal | null;
  minNightsRequired: number | null;
  nightsStackable: boolean;
  spanStays: boolean;
  maxStayCount: number | null;
  maxRewardCount: number | null;
  maxRedemptionValue: Prisma.Decimal | null;
  maxTotalBonusPoints: number | null;
  oncePerSubBrand: boolean;
  bookByDate: Date | null;
  registrationDeadline: Date | null;
  validDaysAfterRegistration: number | null;
  tieInRequiresPayment: boolean;
  allowedPaymentTypes: string[];
  allowedBookingSources: string[];
  hotelChainId: string | null;
  prerequisiteStayCount: number | null;
  prerequisiteNightCount: number | null;
  subBrandRestrictions: { hotelChainSubBrandId: string; mode: string }[];
  tieInCards: { creditCardId: string }[];
} | null;

type MatchingBenefit = {
  id: string;
  rewardType: PromotionRewardType;
  valueType: PromotionBenefitValueType;
  value: Prisma.Decimal;
  certType: string | null;
  pointsMultiplierBasis: string | null;
  sortOrder: number;
  restrictions: MatchingRestrictions;
};

const RESTRICTIONS_INCLUDE = {
  subBrandRestrictions: true,
  tieInCards: true,
} as const;

const PROMOTIONS_INCLUDE = {
  benefits: {
    orderBy: { sortOrder: "asc" as const },
    include: { restrictions: { include: RESTRICTIONS_INCLUDE } },
  },
  tiers: {
    orderBy: { minStays: "asc" as const },
    include: {
      benefits: {
        orderBy: { sortOrder: "asc" as const },
        include: { restrictions: { include: RESTRICTIONS_INCLUDE } },
      },
    },
  },
  restrictions: { include: RESTRICTIONS_INCLUDE },
  userPromotions: true,
} as const;

export interface MatchingBooking {
  id?: string;
  creditCardId: string | null;
  shoppingPortalId: string | null;
  hotelChainId: string | null;
  hotelChainSubBrandId: string | null;
  bookingSource: string | null;
  checkIn: Date | string;
  createdAt: Date | string;
  numNights: number;
  pretaxCost: string | number | Prisma.Decimal;
  totalCost: string | number | Prisma.Decimal;
  pointsRedeemed: number | null;
  loyaltyPointsEarned: number | null;
  _count?: { certificates: number };
  hotelChain?: {
    basePointRate?: string | number | Prisma.Decimal | null;
    pointType?: {
      centsPerPoint: string | number | Prisma.Decimal | null;
    } | null;
  } | null;
  creditCard?: {
    pointType?: {
      centsPerPoint: string | number | Prisma.Decimal | null;
    } | null;
  } | null;
}

export interface MatchingPromotion {
  id: string;
  type: PromotionType;
  creditCardId: string | null;
  shoppingPortalId: string | null;
  hotelChainId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  restrictions: MatchingRestrictions;
  registrationDate?: Date | null;
  benefits: MatchingBenefit[];
  tiers: {
    id: string;
    minStays: number | null;
    maxStays: number | null;
    minNights: number | null;
    maxNights: number | null;
    benefits: MatchingBenefit[];
  }[];
}

interface BenefitApplication {
  promotionBenefitId: string;
  appliedValue: number;
  bonusPointsApplied: number;
  eligibleNightsAtBooking?: number;
  isOrphaned?: boolean;
  isPreQualifying?: boolean;
}

interface MatchedPromotion {
  promotionId: string;
  appliedValue: number;
  bonusPointsApplied: number;
  eligibleNightsAtBooking?: number;
  isOrphaned?: boolean;
  isPreQualifying?: boolean;
  benefitApplications: BenefitApplication[];
}

function checkSubBrandRestrictions(
  restrictions: MatchingRestrictions,
  hotelChainSubBrandId: string | null
): boolean {
  if (!restrictions) return true;
  const includeList = restrictions.subBrandRestrictions.filter((s) => s.mode === "include");
  const excludeList = restrictions.subBrandRestrictions.filter((s) => s.mode === "exclude");
  if (
    includeList.length > 0 &&
    !includeList.some((s) => s.hotelChainSubBrandId === hotelChainSubBrandId)
  )
    return false;
  if (
    excludeList.length > 0 &&
    excludeList.some((s) => s.hotelChainSubBrandId === hotelChainSubBrandId)
  )
    return false;
  return true;
}

function checkPaymentTypeRestriction(
  allowedPaymentTypes: string[],
  booking: MatchingBooking
): boolean {
  if (allowedPaymentTypes.length === 0) return true;
  const hasCash = Number(booking.pretaxCost) > 0;
  const hasPoints = (booking.pointsRedeemed ?? 0) > 0;
  const hasCert = (booking._count?.certificates ?? 0) > 0;
  if (hasCash && !allowedPaymentTypes.includes("cash")) return false;
  if (hasPoints && !allowedPaymentTypes.includes("points")) return false;
  if (hasCert && !allowedPaymentTypes.includes("cert")) return false;
  return true;
}

function checkBookingSourceRestriction(
  allowedBookingSources: string[],
  booking: MatchingBooking
): boolean {
  if (allowedBookingSources.length === 0) return true;
  return allowedBookingSources.includes(booking.bookingSource ?? "other");
}

function ensureDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  return d instanceof Date ? d : new Date(d);
}

/**
 * Logic for validating and calculating promotion matches.
 */

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

type PromotionRule = (
  booking: MatchingBooking,
  promo: MatchingPromotion,
  usage?: PromotionUsage
) => ValidationResult;

/**
 * Core Eligibility Rules
 * These are "hard" filters that determine if a promotion is even considered for this booking.
 */
const CorePromotionRules: Record<string, PromotionRule> = {
  typeMatch: (booking, promo) => {
    switch (promo.type) {
      case PromotionType.credit_card:
        return { valid: promo.creditCardId === booking.creditCardId };
      case PromotionType.portal:
        return { valid: promo.shoppingPortalId === booking.shoppingPortalId };
      case PromotionType.loyalty:
        return { valid: promo.hotelChainId === booking.hotelChainId };
      default:
        return { valid: false };
    }
  },

  dateRange: (booking, promo) => {
    const checkInDate = ensureDate(booking.checkIn)!;
    const regDate = ensureDate(promo.registrationDate);

    if (regDate) {
      // If registered, check-in MUST be on or after registration date
      if (checkInDate < regDate) return { valid: false };

      if (promo.restrictions?.validDaysAfterRegistration) {
        const personalEndDate = new Date(regDate);
        personalEndDate.setDate(regDate.getDate() + promo.restrictions.validDaysAfterRegistration);
        if (checkInDate > personalEndDate) return { valid: false };
        // Within personal window -> valid regardless of global startDate/endDate
        return { valid: true };
      }
    }

    const startDate = ensureDate(promo.startDate);
    const endDate = ensureDate(promo.endDate);

    if (startDate && checkInDate < startDate) return { valid: false };
    if (endDate && checkInDate > endDate) return { valid: false };

    return { valid: true };
  },

  registrationDeadline: (booking, promo) => {
    const regDate = ensureDate(promo.registrationDate);
    const deadline = ensureDate(promo.restrictions?.registrationDeadline);
    if (regDate && deadline) {
      if (regDate > deadline) {
        return { valid: false };
      }
    }
    return { valid: true };
  },

  bookByDate: (booking, promo) => {
    const createdAt = ensureDate(booking.createdAt)!;
    const bookBy = ensureDate(promo.restrictions?.bookByDate);
    if (bookBy) {
      if (createdAt > bookBy) {
        return { valid: false };
      }
    }
    return { valid: true };
  },

  subBrand: (booking, promo) => {
    return { valid: checkSubBrandRestrictions(promo.restrictions, booking.hotelChainSubBrandId) };
  },

  paymentType: (booking, promo) => {
    if (promo.restrictions?.allowedPaymentTypes) {
      return {
        valid: checkPaymentTypeRestriction(promo.restrictions.allowedPaymentTypes, booking),
      };
    }
    return { valid: true };
  },

  bookingSource: (booking, promo) => {
    return {
      valid: checkBookingSourceRestriction(
        promo.restrictions?.allowedBookingSources ?? [],
        booking
      ),
    };
  },

  hotelChain: (booking, promo) => {
    const r = promo.restrictions;
    if (r?.hotelChainId) {
      return { valid: r.hotelChainId === booking.hotelChainId };
    }
    return { valid: true };
  },

  tieInCard: (booking, promo) => {
    if (promo.restrictions?.tieInCards && promo.restrictions.tieInCards.length > 0) {
      const cardMatches =
        booking.creditCardId != null &&
        promo.restrictions.tieInCards.some((c) => c.creditCardId === booking.creditCardId);
      return { valid: cardMatches };
    }
    return { valid: true };
  },
};

/**
 * Hard Cap Rules
 * These represent limits that have been reached. Result is $0 with no badge (Maxed Out).
 */
const HardCapPromotionRules: Record<string, PromotionRule> = {
  maxStayCount: (booking, promo, usage) => {
    const r = promo.restrictions;
    if (r?.maxStayCount && usage && usage.count >= r.maxStayCount) {
      return { valid: false };
    }
    return { valid: true };
  },

  oncePerSubBrand: (booking, promo, usage) => {
    const r = promo.restrictions;
    if (r?.oncePerSubBrand) {
      if (usage?.appliedSubBrandIds?.has(booking.hotelChainSubBrandId ?? null)) {
        return { valid: false };
      }
    }
    return { valid: true };
  },
};

/**
 * Per-stay "hide" rules.
 * These failures mean the promotion should be hidden entirely for this booking (not orphaned).
 */
const PerStayHideRules: Record<string, PromotionRule> = {
  minSpend: (booking, promo) => {
    if (
      promo.type === PromotionType.credit_card &&
      promo.restrictions?.minSpend != null &&
      Number(booking.totalCost) < Number(promo.restrictions.minSpend)
    ) {
      return { valid: false };
    }
    return { valid: true };
  },

  minNights: (booking, promo) => {
    const r = promo.restrictions;
    if (r?.minNightsRequired && booking.numNights < r.minNightsRequired && !r.spanStays) {
      return { valid: false };
    }
    return { valid: true };
  },
};

/**
 * Fulfillment Rules (campaign-level)
 * These determine if the cumulative campaign state meets thresholds.
 * Failures here can be pre-qualifying (future stays exist) or orphaned.
 */
const FulfillmentPromotionRules: Record<string, PromotionRule> = {
  prerequisites: (booking, promo, usage) => {
    const r = promo.restrictions;
    if (!r) return { valid: true };

    if (r.prerequisiteStayCount && (usage?.eligibleStayCount ?? 0) < r.prerequisiteStayCount) {
      return { valid: false };
    }

    if (r.prerequisiteNightCount && (usage?.eligibleNightCount ?? 0) < r.prerequisiteNightCount) {
      return { valid: false };
    }
    return { valid: true };
  },
};

/**
 * Calculates which promotions match a given booking without side effects.
 */
export function calculateMatchedPromotions(
  booking: MatchingBooking,
  activePromotions: MatchingPromotion[],
  priorUsage?: PromotionUsageMap
) {
  const matched: MatchedPromotion[] = [];

  for (const promo of activePromotions) {
    const usage = priorUsage?.get(promo.id);

    // 1. Core Eligibility (Hard Filters — structural match)
    const isCoreEligible = Object.values(CorePromotionRules).every((rule) => {
      return rule(booking, promo, usage).valid;
    });

    // Any structural mismatch → invisible. "Orphaned" is reserved for fulfillment failures
    // (not enough stays/nights to complete the campaign), not structural incompatibility.
    let isPromoOrphaned = false;
    let isPromoPreQualifying = false;

    if (!isCoreEligible) {
      continue;
    }

    const r = promo.restrictions;

    // 2. Hard Cap check (maxStayCount, oncePerSubBrand) → Maxed Out ($0, no badge)
    let isMaxedOut = false;
    if (!isPromoOrphaned) {
      isMaxedOut = Object.values(HardCapPromotionRules).some((rule) => {
        return !rule(booking, promo, usage).valid;
      });
    }

    // 3. Per-stay hide rules (minNights no-span, minSpend) → hide entirely
    if (!isPromoOrphaned && !isMaxedOut) {
      const isPerStayHidden = Object.values(PerStayHideRules).some((rule) => {
        return !rule(booking, promo, usage).valid;
      });
      if (isPerStayHidden) continue;
    }

    // 4. SpanStays campaign-level check
    if (
      !isPromoOrphaned &&
      !isMaxedOut &&
      r?.spanStays &&
      r.minNightsRequired &&
      r.minNightsRequired > 0
    ) {
      const totalNights = usage?.totalPotentialNightCount;
      if (totalNights !== undefined && totalNights < r.minNightsRequired) {
        // Not enough total campaign nights to ever complete a cycle
        if ((usage?.futurePotentialNightCount ?? 0) > 0) {
          isPromoPreQualifying = true;
        } else {
          isPromoOrphaned = true;
        }
      }
    }

    // 5. Prerequisite campaign-level check
    if (!isPromoOrphaned && !isMaxedOut && !isPromoPreQualifying) {
      if (r?.prerequisiteStayCount && r.prerequisiteStayCount > 0) {
        const totalStays = usage?.totalPotentialStayCount;
        if (totalStays !== undefined && totalStays < r.prerequisiteStayCount + 1) {
          if ((usage?.futurePotentialStayCount ?? 0) > 0) {
            isPromoPreQualifying = true;
          } else {
            isPromoOrphaned = true;
          }
        }
      }
      if (
        !isPromoOrphaned &&
        !isPromoPreQualifying &&
        r?.prerequisiteNightCount &&
        r.prerequisiteNightCount > 0
      ) {
        const totalNights = usage?.totalPotentialNightCount;
        if (
          totalNights !== undefined &&
          totalNights < r.prerequisiteNightCount + booking.numNights
        ) {
          if ((usage?.futurePotentialNightCount ?? 0) > 0) {
            isPromoPreQualifying = true;
          } else {
            isPromoOrphaned = true;
          }
        }
      }
    }

    // 6. Fulfillment Rules (campaign-level: prerequisites, tiers)
    const isFulfilling = Object.values(FulfillmentPromotionRules).every((rule) => {
      return rule(booking, promo, usage).valid;
    });

    if (!isPromoOrphaned && !isMaxedOut && !isPromoPreQualifying && !isFulfilling) {
      // Campaign-level fulfillment failed
      if ((usage?.futurePotentialStayCount ?? 0) > 0) {
        isPromoPreQualifying = true;
      } else {
        isPromoOrphaned = true;
      }
    }

    // Final check: if not earning/orphaned/maxed/prequalifying, skip
    if (!isFulfilling && !isPromoOrphaned && !isMaxedOut && !isPromoPreQualifying) continue;

    // Determine which benefits to use: tier-based or flat
    let activeBenefits: MatchingBenefit[];
    if (promo.tiers.length > 0) {
      const priorMatchedStays = usage?.eligibleStayCount ?? 0;
      const priorMatchedNights = usage?.eligibleNightCount ?? 0;

      const currentStayNumber = priorMatchedStays + 1;
      const currentNightNumber = priorMatchedNights + 1; // Tier check is based on the START of the current stay/night sequence

      const applicableTier = promo.tiers.find((tier) => {
        // Stay-based tier check
        if (tier.minStays !== null) {
          const minMatch = currentStayNumber >= tier.minStays;
          const maxMatch = tier.maxStays === null || currentStayNumber <= tier.maxStays;
          if (minMatch && maxMatch) return true;
        }
        // Night-based tier check
        if (tier.minNights !== null) {
          const minMatch = currentNightNumber >= tier.minNights;
          const maxMatch = tier.maxNights === null || currentNightNumber <= tier.maxNights;
          if (minMatch && maxMatch) return true;
        }
        return false;
      });

      if (!applicableTier) {
        // Check if we will EVER reach a tier (pre-qualifying vs orphaned detection for tiers)
        if (
          !isPromoOrphaned &&
          !isPromoPreQualifying &&
          usage &&
          usage.totalPotentialStayCount !== undefined
        ) {
          const minTierStays = Math.min(...promo.tiers.map((t) => t.minStays ?? Infinity));
          if (usage.totalPotentialStayCount < minTierStays) {
            isPromoOrphaned = true;
          } else if ((usage.futurePotentialStayCount ?? 0) > 0) {
            isPromoPreQualifying = true;
          } else {
            isPromoOrphaned = true;
          }
        }

        // If orphaned or pre-qualifying, show the first tier as the target
        if (isPromoOrphaned || isPromoPreQualifying) {
          activeBenefits = promo.tiers[0].benefits;
        } else {
          continue;
        }
      } else {
        activeBenefits = applicableTier.benefits;
      }
    } else {
      activeBenefits = promo.benefits;
    }

    // Per-benefit filtering and orphaned detection
    const matchedBenefits = activeBenefits
      .map((b) => {
        const br = b.restrictions;
        const bUsage = usage?.benefitUsage?.get(b.id);

        // Create a temporary promotion object to reuse the existing rule functions
        // We merge benefit-level restrictions with promo-level ones
        const tempPromo: MatchingPromotion = {
          ...promo,
          restrictions: br
            ? { ...promo.restrictions, ...br }
            : (promo.restrictions as MatchingRestrictions),
        };

        // 1. Core Eligibility (Hard filters)
        let currentMatchesCore = true;
        for (const rule of Object.values(CorePromotionRules)) {
          if (!rule(booking, tempPromo, usage).valid) {
            currentMatchesCore = false;
            break;
          }
        }

        // Any structural mismatch at the benefit level → hide this benefit.
        if (!currentMatchesCore) {
          return null;
        }

        // 2. State detection per benefit
        let isActuallyOrphaned = !currentMatchesCore || isPromoOrphaned;
        let isActuallyPreQualifying = isPromoPreQualifying && !isActuallyOrphaned;
        let isRemainderOrphaned = false;

        // Check benefit-level hard caps → Maxed Out ($0, no badge)
        let isBenefitMaxedOut = isMaxedOut;
        if (
          !isBenefitMaxedOut &&
          br?.maxRewardCount &&
          bUsage &&
          bUsage.count >= br.maxRewardCount
        ) {
          isBenefitMaxedOut = true;
        }
        if (!isBenefitMaxedOut && br?.oncePerSubBrand) {
          if (usage?.appliedSubBrandIds?.has(booking.hotelChainSubBrandId ?? null)) {
            isBenefitMaxedOut = true;
          }
        }

        // Check benefit-level per-stay hide rules (minNights fixed, minSpend)
        // Only hide if not already orphaned/pre-qualifying
        if (!isActuallyOrphaned && !isActuallyPreQualifying && !isBenefitMaxedOut) {
          if (br?.minNightsRequired && !br.spanStays && booking.numNights < br.minNightsRequired) {
            return null;
          }
          if (
            promo.type === PromotionType.credit_card &&
            br?.minSpend != null &&
            Number(booking.totalCost) < Number(br.minSpend)
          ) {
            return null;
          }
        }

        // Also check fulfillment rules for this benefit specifically
        let isFulfillmentValid = true;
        for (const rule of Object.values(FulfillmentPromotionRules)) {
          if (!rule(booking, tempPromo, usage).valid) {
            isFulfillmentValid = false;
            break;
          }
        }

        // Check Benefit-level spanStays restrictions
        if (
          !isActuallyOrphaned &&
          !isActuallyPreQualifying &&
          !isBenefitMaxedOut &&
          br?.spanStays &&
          br.minNightsRequired &&
          br.minNightsRequired > 0
        ) {
          const totalNights = bUsage?.totalPotentialNightCount ?? usage?.totalPotentialNightCount;
          if (totalNights !== undefined) {
            if (totalNights < br.minNightsRequired) {
              // Not enough total nights
              if (
                (bUsage?.futurePotentialNightCount ?? usage?.futurePotentialNightCount ?? 0) > 0
              ) {
                isActuallyPreQualifying = true;
              } else {
                isActuallyOrphaned = true;
              }
            } else if (totalNights % br.minNightsRequired !== 0) {
              const priorNights = bUsage?.eligibleNights ?? 0;
              const currentNights = currentMatchesCore ? booking.numNights : 0;
              const totalSoFar = priorNights + currentNights;
              const nextCycleGoal =
                Math.ceil(totalSoFar / br.minNightsRequired) * br.minNightsRequired;

              if (totalNights < nextCycleGoal) {
                isRemainderOrphaned = true;
              }
            }
          }
        }

        // Check Promotion-level spanStays remainder orphaned status
        if (
          !isActuallyOrphaned &&
          !isActuallyPreQualifying &&
          !isBenefitMaxedOut &&
          r?.spanStays &&
          r.minNightsRequired &&
          r.minNightsRequired > 0
        ) {
          const totalNights = usage?.totalPotentialNightCount;
          if (totalNights !== undefined && totalNights % r.minNightsRequired !== 0) {
            const priorNights = usage?.eligibleStayNights ?? 0;
            const currentNights = booking.numNights;
            const totalSoFar = priorNights + currentNights;
            const nextCycleGoal = Math.ceil(totalSoFar / r.minNightsRequired) * r.minNightsRequired;

            if (totalNights < nextCycleGoal) {
              isRemainderOrphaned = true;
            }
          }
        }

        // Final check: if it's not fulfilling AND not orphaned/pre-qualifying/maxed-out, skip
        if (
          !isFulfillmentValid &&
          !isActuallyOrphaned &&
          !isActuallyPreQualifying &&
          !isRemainderOrphaned &&
          !isBenefitMaxedOut
        ) {
          return null;
        }

        return {
          benefit: b,
          isActuallyOrphaned,
          isActuallyPreQualifying,
          isRemainderOrphaned,
          isBenefitMaxedOut,
          currentMatchesCore,
          isFulfillmentValid,
          bUsage,
        };
      })
      .filter((mb): mb is NonNullable<typeof mb> => mb !== null);

    if (matchedBenefits.length === 0) continue;

    // Calculate applied value per benefit
    const centsPerPoint = booking.hotelChain?.pointType?.centsPerPoint
      ? Number(booking.hotelChain.pointType.centsPerPoint)
      : 0.01;

    const benefitApplications: BenefitApplication[] = [];

    for (const mb of matchedBenefits) {
      const {
        benefit,
        isActuallyOrphaned,
        isActuallyPreQualifying,
        isRemainderOrphaned,
        isBenefitMaxedOut,
        currentMatchesCore,
        isFulfillmentValid,
        bUsage,
      } = mb;

      const benefitValue = Number(benefit.value);
      let appliedValue = 0;
      let benefitBonusPoints = 0;

      // Only calculate values if fulfilling and not orphaned/maxed-out
      // Pre-qualifying span-stays benefits get pro-rated value; tier/prerequisite get $0
      const isSpanStaysPreQualifying =
        isActuallyPreQualifying &&
        ((benefit.restrictions?.spanStays && benefit.restrictions?.minNightsRequired) ||
          (r?.spanStays && r?.minNightsRequired));

      if (
        isFulfilling &&
        isFulfillmentValid &&
        !isActuallyOrphaned &&
        !isBenefitMaxedOut &&
        !isActuallyPreQualifying
      ) {
        switch (benefit.rewardType) {
          case PromotionRewardType.cashback:
            if (benefit.valueType === PromotionBenefitValueType.fixed) {
              appliedValue = benefitValue;
            } else if (benefit.valueType === PromotionBenefitValueType.percentage) {
              appliedValue = (Number(booking.totalCost) * benefitValue) / 100;
            }
            break;
          case PromotionRewardType.points:
            if (benefit.valueType === PromotionBenefitValueType.multiplier) {
              const isBaseOnly =
                !benefit.pointsMultiplierBasis || benefit.pointsMultiplierBasis === "base_only";
              const baseRate = booking.hotelChain?.basePointRate;
              const basisPoints =
                isBaseOnly && baseRate != null
                  ? Number(booking.pretaxCost) * Number(baseRate)
                  : Number(booking.loyaltyPointsEarned || 0);
              appliedValue = basisPoints * (benefitValue - 1) * centsPerPoint;
              benefitBonusPoints = Math.round(basisPoints * (benefitValue - 1));
            } else {
              appliedValue = benefitValue * centsPerPoint;
              benefitBonusPoints = Math.round(benefitValue);
            }
            break;
          case PromotionRewardType.certificate:
            appliedValue = benefit.certType
              ? certPointsValue(benefit.certType) * centsPerPoint * 0.7
              : 0;
            break;
          case PromotionRewardType.eqn:
            appliedValue = benefitValue * DEFAULT_EQN_VALUE;
            break;
        }

        // Scaling logic (Stackable / Span Stays)
        const br = benefit.restrictions;
        const promoIsStacked =
          r?.nightsStackable && r?.minNightsRequired && r.minNightsRequired > 0;
        const promoIsSpanned = r?.spanStays && r?.minNightsRequired && r.minNightsRequired > 0;

        if (
          !promoIsStacked &&
          !promoIsSpanned &&
          br?.minNightsRequired &&
          br.minNightsRequired > 0
        ) {
          if (br.spanStays || br.nightsStackable) {
            const divisor = br.minNightsRequired;
            let multiplier: number;
            if (br.spanStays) {
              if (isRemainderOrphaned) {
                // Only count completed cycles — the partial final cycle earns nothing
                const priorBenefitNights = bUsage?.eligibleNights ?? 0;
                const totalSoFar = priorBenefitNights + booking.numNights;
                multiplier =
                  Math.floor(totalSoFar / divisor) - Math.floor(priorBenefitNights / divisor);
              } else {
                multiplier = booking.numNights / divisor;
              }
            } else {
              multiplier = Math.floor(booking.numNights / divisor);
            }
            appliedValue *= multiplier;
            benefitBonusPoints *= multiplier;
          }
        }

        // Benefit-level caps
        if (br?.maxRedemptionValue) {
          const maxValue = Number(br.maxRedemptionValue);
          const priorValue = bUsage?.totalValue ?? 0;
          const remainingCapacity = Math.max(0, maxValue - priorValue);
          if (remainingCapacity < appliedValue) {
            const ratio = appliedValue > 0 ? remainingCapacity / appliedValue : 0;
            appliedValue = remainingCapacity;
            benefitBonusPoints = Math.round(benefitBonusPoints * ratio);
          }
        }

        if (br?.maxTotalBonusPoints) {
          const maxPoints = br.maxTotalBonusPoints;
          const priorPoints = bUsage?.totalBonusPoints ?? 0;
          const remainingPoints = Math.max(0, maxPoints - priorPoints);
          if (remainingPoints < benefitBonusPoints) {
            const ratio = benefitBonusPoints > 0 ? remainingPoints / benefitBonusPoints : 0;
            appliedValue *= ratio;
            benefitBonusPoints = Math.round(remainingPoints);
          }
        }
      } else if (isSpanStaysPreQualifying) {
        // Span-stays pre-qualifying: show pro-rated value based on this stay's contribution
        // Formula: benefitValue × (booking.numNights / minNightsRequired)
        const br = benefit.restrictions;
        const minNights =
          (br?.spanStays && br.minNightsRequired ? br.minNightsRequired : null) ??
          (r?.spanStays && r.minNightsRequired ? r.minNightsRequired : null);
        if (minNights && minNights > 0) {
          // Calculate full benefit value first
          switch (benefit.rewardType) {
            case PromotionRewardType.cashback:
              if (benefit.valueType === PromotionBenefitValueType.fixed) {
                appliedValue = benefitValue;
              } else if (benefit.valueType === PromotionBenefitValueType.percentage) {
                appliedValue = (Number(booking.totalCost) * benefitValue) / 100;
              }
              break;
            case PromotionRewardType.points:
              if (benefit.valueType === PromotionBenefitValueType.multiplier) {
                const isBaseOnly =
                  !benefit.pointsMultiplierBasis || benefit.pointsMultiplierBasis === "base_only";
                const baseRate = booking.hotelChain?.basePointRate;
                const basisPoints =
                  isBaseOnly && baseRate != null
                    ? Number(booking.pretaxCost) * Number(baseRate)
                    : Number(booking.loyaltyPointsEarned || 0);
                appliedValue = basisPoints * (benefitValue - 1) * centsPerPoint;
                benefitBonusPoints = Math.round(basisPoints * (benefitValue - 1));
              } else {
                appliedValue = benefitValue * centsPerPoint;
                benefitBonusPoints = Math.round(benefitValue);
              }
              break;
            case PromotionRewardType.certificate:
              appliedValue = benefit.certType
                ? certPointsValue(benefit.certType) * centsPerPoint * 0.7
                : 0;
              break;
            case PromotionRewardType.eqn:
              appliedValue = benefitValue * DEFAULT_EQN_VALUE;
              break;
          }
          // Apply pro-rating
          const proRateMultiplier = booking.numNights / minNights;
          appliedValue *= proRateMultiplier;
          benefitBonusPoints = Math.round(benefitBonusPoints * proRateMultiplier);
        }
      }

      benefitApplications.push({
        promotionBenefitId: benefit.id,
        appliedValue,
        bonusPointsApplied: Math.round(benefitBonusPoints),
        eligibleNightsAtBooking:
          (bUsage?.eligibleNights ?? 0) + (currentMatchesCore ? booking.numNights : 0),
        isOrphaned:
          (isPromoOrphaned || isActuallyOrphaned || isRemainderOrphaned) &&
          !isActuallyPreQualifying &&
          !isBenefitMaxedOut,
        isPreQualifying: isActuallyPreQualifying && !isBenefitMaxedOut,
      });
    }

    // If all benefits are zero-value AND none are orphaned/pre-qualifying/maxed-out, skip
    const hasAnyActiveBenefit = benefitApplications.some(
      (ba) => ba.appliedValue > 0 || ba.isOrphaned || ba.isPreQualifying
    );
    if (!hasAnyActiveBenefit) continue;

    // 4. Promotion-level scaling
    if (r?.minNightsRequired && r.minNightsRequired > 0 && (r.spanStays || r.nightsStackable)) {
      const multiplier = r.spanStays
        ? booking.numNights / r.minNightsRequired
        : Math.floor(booking.numNights / r.minNightsRequired);

      for (const ba of benefitApplications) {
        const mb = matchedBenefits.find((m) => m.benefit.id === ba.promotionBenefitId);
        const br = mb?.benefit.restrictions;

        // Skip if benefit already handled its own scaling
        if (
          br?.minNightsRequired &&
          br.minNightsRequired > 0 &&
          (br.spanStays || br.nightsStackable)
        ) {
          continue;
        }

        ba.appliedValue *= multiplier;
        ba.bonusPointsApplied = Math.round(ba.bonusPointsApplied * multiplier);
      }
    }

    // 5. Promotion-level caps
    let totalAppliedValue = benefitApplications.reduce((sum, ba) => sum + ba.appliedValue, 0);
    let totalBonusPoints = benefitApplications.reduce((sum, ba) => sum + ba.bonusPointsApplied, 0);

    if (r?.maxRedemptionValue) {
      const maxValue = Number(r.maxRedemptionValue);
      const priorValue = usage?.totalValue ?? 0;
      const remainingCapacity = Math.max(0, maxValue - priorValue);
      if (totalAppliedValue > remainingCapacity) {
        const ratio = totalAppliedValue > 0 ? remainingCapacity / totalAppliedValue : 0;
        for (const ba of benefitApplications) {
          ba.appliedValue *= ratio;
          ba.bonusPointsApplied = Math.round(ba.bonusPointsApplied * ratio);
        }
        totalAppliedValue = remainingCapacity;
      }
    }

    if (r?.maxTotalBonusPoints) {
      const priorPoints = usage?.totalBonusPoints ?? 0;
      const remainingPoints = Math.max(0, r.maxTotalBonusPoints - priorPoints);
      if (totalBonusPoints > remainingPoints) {
        const ratio = totalBonusPoints > 0 ? remainingPoints / totalBonusPoints : 0;
        for (const ba of benefitApplications) {
          ba.appliedValue *= ratio;
          ba.bonusPointsApplied = Math.round(ba.bonusPointsApplied * ratio);
        }
        totalBonusPoints = remainingPoints;
        totalAppliedValue = benefitApplications.reduce((sum, ba) => sum + ba.appliedValue, 0);
      }
    }

    const allBenefitsOrphaned = benefitApplications.every((ba) => ba.isOrphaned);
    const anyBenefitPreQualifying = benefitApplications.some((ba) => ba.isPreQualifying);

    matched.push({
      promotionId: promo.id,
      appliedValue: totalAppliedValue,
      bonusPointsApplied: Math.round(totalBonusPoints),
      eligibleNightsAtBooking: (usage?.eligibleStayNights ?? 0) + booking.numNights,
      isOrphaned:
        (isPromoOrphaned || allBenefitsOrphaned) && !anyBenefitPreQualifying && !isMaxedOut,
      isPreQualifying: isPromoPreQualifying || anyBenefitPreQualifying,
      benefitApplications,
    });
  }

  return matched;
}

/**
 * Persists matched promotions to a booking, replacing existing auto-applied ones.
 */
async function applyMatchedPromotions(
  bookingId: string,
  matched: MatchedPromotion[]
): Promise<BookingPromotion[]> {
  // Verify booking still exists to avoid foreign key violations in concurrent re-evaluations
  const bookingExists = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true },
  });

  if (!bookingExists) {
    console.warn(`applyMatchedPromotions: Booking ${bookingId} not found, skipping.`);
    return [];
  }

  // Delete existing auto-applied BookingPromotions for this booking
  await prisma.bookingPromotion.deleteMany({
    where: {
      bookingId,
      autoApplied: true,
    },
  });

  // Create new BookingPromotion records with benefit applications
  const createdRecords: BookingPromotion[] = [];
  for (const match of matched) {
    try {
      const record = await prisma.bookingPromotion.create({
        data: {
          bookingId,
          promotionId: match.promotionId,
          appliedValue: match.appliedValue,
          bonusPointsApplied: match.bonusPointsApplied > 0 ? match.bonusPointsApplied : null,
          autoApplied: true,
          eligibleNightsAtBooking: match.eligibleNightsAtBooking,
          isOrphaned: match.isOrphaned ?? false,
          isPreQualifying: match.isPreQualifying ?? false,
          benefitApplications: {
            create: match.benefitApplications.map((ba) => ({
              promotionBenefitId: ba.promotionBenefitId,
              appliedValue: ba.appliedValue,
              bonusPointsApplied: ba.bonusPointsApplied > 0 ? ba.bonusPointsApplied : null,
              eligibleNightsAtBooking: ba.eligibleNightsAtBooking,
              isOrphaned: ba.isOrphaned ?? false,
              isPreQualifying: ba.isPreQualifying ?? false,
            })),
          },
        },
      });
      createdRecords.push(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2003" || error.code === "P2025")
      ) {
        console.warn(
          `applyMatchedPromotions: Booking ${bookingId} was likely deleted concurrently.`
        );
        return createdRecords;
      }
      throw error;
    }
  }

  return createdRecords;
}

/**
 * Builds a Prisma 'where' clause that reflects the Core Eligibility rules.
 * Used for campaign-wide lookahead (orphaned detection).
 */
function buildPotentialMatchFilter(
  promo: MatchingPromotion,
  benefitRestrictions?: MatchingRestrictions
) {
  const r = benefitRestrictions || promo.restrictions;

  // NOTE: 'bookingSource' and 'paymentType' restrictions are intentionally not included in this filter.
  // Both are complex to express as Prisma 'where' clauses. Their omission makes lookahead counts
  // a conservative overestimate, which is safe for orphaned detection (UX imprecision only).
  const where: Prisma.BookingWhereInput = {
    hotelChainId:
      promo.type === PromotionType.loyalty ? (promo.hotelChainId ?? undefined) : undefined,
    creditCardId:
      promo.type === PromotionType.credit_card ? (promo.creditCardId ?? undefined) : undefined,
    shoppingPortalId:
      promo.type === PromotionType.portal ? (promo.shoppingPortalId ?? undefined) : undefined,
  };

  // Date range (Global or Registration-based)
  if (promo.registrationDate) {
    const regDate = new Date(promo.registrationDate);
    const dateFilter: Prisma.DateTimeFilter = { gte: regDate };

    if (promo.restrictions?.validDaysAfterRegistration) {
      const personalEndDate = new Date(regDate);
      personalEndDate.setDate(regDate.getDate() + promo.restrictions.validDaysAfterRegistration);
      dateFilter.lte = personalEndDate;
    } else if (promo.endDate) {
      dateFilter.lte = new Date(promo.endDate);
    }
    where.checkIn = dateFilter;
  } else {
    if (promo.startDate || promo.endDate) {
      where.checkIn = {
        gte: promo.startDate ?? undefined,
        lte: promo.endDate ?? undefined,
      };
    }
  }

  // Sub-brand restrictions
  if (r?.subBrandRestrictions?.length) {
    const includeIds = r.subBrandRestrictions
      .filter((s) => s.mode === "include")
      .map((s) => s.hotelChainSubBrandId);
    const excludeIds = r.subBrandRestrictions
      .filter((s) => s.mode === "exclude")
      .map((s) => s.hotelChainSubBrandId);

    const idFilter: Prisma.StringFilter = {};
    if (includeIds.length > 0) idFilter.in = includeIds;
    if (excludeIds.length > 0) idFilter.notIn = excludeIds;

    if (Object.keys(idFilter).length > 0) {
      where.hotelChainSubBrand = { id: idFilter };
    }
  }

  // Book by date
  if (promo.restrictions?.bookByDate) {
    where.createdAt = { lte: new Date(promo.restrictions.bookByDate) };
  }

  // Tie-in card
  if (r?.tieInCards?.length) {
    where.creditCardId = { in: r.tieInCards.map((c) => c.creditCardId) };
  }

  return where;
}

/**
 * Fetches prior usage statistics for promotions with redemption constraints.
 */
async function fetchPromotionUsage(
  promotions: MatchingPromotion[],
  booking: MatchingBooking,
  excludeBookingId?: string
): Promise<PromotionUsageMap> {
  const usageMap: PromotionUsageMap = new Map();

  const promotionIds = promotions.map((p) => p.id);
  if (promotionIds.length === 0) return usageMap;

  // Single aggregation query to get count, totalValue, and totalBonusPoints
  const usage = await prisma.bookingPromotion.groupBy({
    by: ["promotionId"],
    where: {
      promotionId: { in: promotionIds },
      ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
      booking: {
        checkIn: {
          lt: new Date(booking.checkIn),
        },
      },
    },
    _count: { id: true },
    _sum: { appliedValue: true, bonusPointsApplied: true },
  });

  for (const row of usage) {
    usageMap.set(row.promotionId, {
      count: row._count.id,
      totalValue: Number(row._sum.appliedValue ?? 0),
      totalBonusPoints: row._sum.bonusPointsApplied ?? 0,
      benefitUsage: new Map(),
    });
  }

  // Fetch benefit-level usage
  const allBenefitIds = promotions.flatMap((p) => [
    ...p.benefits.map((b) => b.id),
    ...p.tiers.flatMap((t) => t.benefits.map((b) => b.id)),
  ]);

  if (allBenefitIds.length > 0) {
    const benefitToPromoMap = new Map<string, string>();
    for (const p of promotions) {
      for (const b of [...p.benefits, ...p.tiers.flatMap((t) => t.benefits)]) {
        benefitToPromoMap.set(b.id, p.id);
      }
    }

    const benefitUsage = await prisma.bookingPromotionBenefit.groupBy({
      by: ["promotionBenefitId"],
      where: {
        promotionBenefitId: { in: allBenefitIds },
        ...(excludeBookingId ? { bookingPromotion: { bookingId: { not: excludeBookingId } } } : {}),
        bookingPromotion: {
          booking: {
            checkIn: {
              lt: new Date(booking.checkIn),
            },
          },
        },
      },
      _count: { id: true },
      _sum: { appliedValue: true, bonusPointsApplied: true },
    });

    // To get eligible nights, we need to join with Booking
    const priorBookingPromos = await prisma.bookingPromotion.findMany({
      where: {
        promotionId: { in: promotions.map((p) => p.id) },
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
        booking: {
          checkIn: {
            lt: new Date(booking.checkIn),
          },
        },
      },
      select: {
        booking: { select: { numNights: true } },
        benefitApplications: {
          where: { promotionBenefitId: { in: allBenefitIds } },
          select: { promotionBenefitId: true },
        },
      },
    });

    const nightsMap = new Map<string, number>();
    for (const bp of priorBookingPromos) {
      for (const ba of bp.benefitApplications) {
        const current = nightsMap.get(ba.promotionBenefitId) ?? 0;
        nightsMap.set(ba.promotionBenefitId, current + bp.booking.numNights);
      }
    }

    for (const row of benefitUsage) {
      const promoId = benefitToPromoMap.get(row.promotionBenefitId);
      if (promoId) {
        const usage = usageMap.get(promoId);
        if (usage && usage.benefitUsage) {
          usage.benefitUsage.set(row.promotionBenefitId, {
            count: row._count.id,
            totalValue: Number(row._sum.appliedValue ?? 0),
            totalBonusPoints: row._sum.bonusPointsApplied ?? 0,
            eligibleNights: nightsMap.get(row.promotionBenefitId) ?? 0,
            couldEverMatch: true, // If it's in benefitUsage, it matched at least once
          });
        }
      }
    }
  }

  // Fetch Potential Counts for all promotions (orphaned + pre-qualifying detection)
  // We need to count stays that match CORE criteria, even if they didn't fulfill the promo
  const currentCheckInDate = new Date(booking.checkIn);
  for (const promo of promotions) {
    // Filter by the same core rules used in calculateMatchedPromotions
    const potentialStats = await prisma.booking.aggregate({
      where: buildPotentialMatchFilter(promo),
      _count: { id: true },
      _sum: { numNights: true },
    });

    // Future potential: stays with checkIn > currentBooking.checkIn (pre-qualifying detection).
    // Merge gt into the existing checkIn filter from buildPotentialMatchFilter so that date-window
    // constraints (startDate, endDate, registrationDate, validDaysAfterRegistration) are preserved.
    const promoBaseFilter = buildPotentialMatchFilter(promo);
    const futurePotentialStats = await prisma.booking.aggregate({
      where: {
        ...promoBaseFilter,
        checkIn: {
          ...((promoBaseFilter.checkIn as Prisma.DateTimeFilter) ?? {}),
          gt: currentCheckInDate,
        },
      },
      _count: { id: true },
      _sum: { numNights: true },
    });

    const existing = usageMap.get(promo.id) ?? {
      count: 0,
      totalValue: 0,
      totalBonusPoints: 0,
      benefitUsage: new Map(),
    };
    if (!existing.benefitUsage) {
      existing.benefitUsage = new Map();
    }

    usageMap.set(promo.id, {
      ...existing,
      totalPotentialStayCount: potentialStats._count.id,
      totalPotentialNightCount: potentialStats._sum.numNights ?? 0,
      futurePotentialStayCount: futurePotentialStats._count.id,
      futurePotentialNightCount: futurePotentialStats._sum.numNights ?? 0,
    });

    // Also fetch benefit-level potential match (oncePerSubBrand / subBrand restrictions)
    for (const b of [...promo.benefits, ...promo.tiers.flatMap((t) => t.benefits)]) {
      const bPotentialStats = await prisma.booking.aggregate({
        where: buildPotentialMatchFilter(promo, b.restrictions),
        _count: { id: true },
        _sum: { numNights: true },
      });

      const bBaseFilter = buildPotentialMatchFilter(promo, b.restrictions);
      const bFuturePotentialStats = await prisma.booking.aggregate({
        where: {
          ...bBaseFilter,
          checkIn: {
            ...((bBaseFilter.checkIn as Prisma.DateTimeFilter) ?? {}),
            gt: currentCheckInDate,
          },
        },
        _count: { id: true },
        _sum: { numNights: true },
      });

      const bUsage = existing.benefitUsage.get(b.id) ?? {
        count: 0,
        totalValue: 0,
        totalBonusPoints: 0,
      };
      existing.benefitUsage.set(b.id, {
        ...bUsage,
        couldEverMatch: bPotentialStats._count.id > 0,
        totalPotentialNightCount: bPotentialStats._sum.numNights ?? 0,
        futurePotentialNightCount: bFuturePotentialStats._sum.numNights ?? 0,
      });
    }
  }

  // Fetch eligibleStayCount for tiered or prerequisite promotions
  const relevantPromos = promotions.filter(
    (p) =>
      p.tiers.length > 0 ||
      p.restrictions?.prerequisiteStayCount ||
      p.restrictions?.prerequisiteNightCount
  );
  for (const promo of relevantPromos) {
    const currentCheckIn = new Date(booking.checkIn);
    // Build sub-brand filter from restrictions
    let subBrandFilter: Record<string, unknown> = {};
    const r = promo.restrictions;
    if (r) {
      const includeList = r.subBrandRestrictions.filter((s) => s.mode === "include");
      const excludeList = r.subBrandRestrictions.filter((s) => s.mode === "exclude");
      if (includeList.length > 0) {
        subBrandFilter = {
          hotelChainSubBrandId: { in: includeList.map((s) => s.hotelChainSubBrandId) },
        };
      } else if (excludeList.length > 0) {
        subBrandFilter = {
          NOT: {
            hotelChainSubBrandId: { in: excludeList.map((s) => s.hotelChainSubBrandId) },
          },
        };
      }
    }

    const eligibleStats = await prisma.booking.aggregate({
      where: {
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        hotelChainId:
          promo.type === PromotionType.loyalty ? (promo.hotelChainId ?? undefined) : undefined,
        creditCardId:
          promo.type === PromotionType.credit_card ? (promo.creditCardId ?? undefined) : undefined,
        shoppingPortalId:
          promo.type === PromotionType.portal ? (promo.shoppingPortalId ?? undefined) : undefined,
        ...subBrandFilter,
        checkIn: {
          ...(promo.startDate ? { gte: promo.startDate } : {}),
          lt: currentCheckIn,
          ...(promo.endDate ? { lte: promo.endDate } : {}),
        },
      },
      _count: { id: true },
      _sum: { numNights: true },
    });

    const existing = usageMap.get(promo.id) ?? {
      count: 0,
      totalValue: 0,
      totalBonusPoints: 0,
      benefitUsage: new Map(),
    };
    usageMap.set(promo.id, {
      ...existing,
      eligibleStayCount: eligibleStats._count.id,
      eligibleNightCount: eligibleStats._sum.numNights ?? 0,
    });
  }

  // Fetch eligibleStayNights for spanStays promotions
  const spanStaysPromos = promotions.filter((p) => p.restrictions?.spanStays);
  if (spanStaysPromos.length > 0) {
    const spanStaysPromoIds = spanStaysPromos.map((p) => p.id);
    const bookingPromos = await prisma.bookingPromotion.findMany({
      where: {
        promotionId: { in: spanStaysPromoIds },
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
        booking: {
          checkIn: {
            lt: new Date(booking.checkIn),
          },
        },
      },
      include: { booking: { select: { numNights: true } } },
    });

    const nightsByPromo = new Map<string, number>();
    for (const bp of bookingPromos) {
      const current = nightsByPromo.get(bp.promotionId) ?? 0;
      nightsByPromo.set(bp.promotionId, current + bp.booking.numNights);
    }

    for (const promo of spanStaysPromos) {
      const nights = nightsByPromo.get(promo.id) ?? 0;
      const existing = usageMap.get(promo.id) ?? {
        count: 0,
        totalValue: 0,
        totalBonusPoints: 0,
        benefitUsage: new Map(),
      };
      usageMap.set(promo.id, { ...existing, eligibleStayNights: nights });
    }
  }

  // Fetch appliedSubBrandIds for oncePerSubBrand promotions
  const oncePerSubBrandPromos = promotions.filter(
    (p) =>
      p.restrictions?.oncePerSubBrand ||
      p.benefits.some((b) => b.restrictions?.oncePerSubBrand) ||
      p.tiers.some((t) => t.benefits.some((b) => b.restrictions?.oncePerSubBrand))
  );

  if (oncePerSubBrandPromos.length > 0) {
    const oncePerSubBrandPromoIds = oncePerSubBrandPromos.map((p) => p.id);
    const appliedBookings = await prisma.bookingPromotion.findMany({
      where: {
        promotionId: { in: oncePerSubBrandPromoIds },
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
        booking: {
          checkIn: {
            lt: new Date(booking.checkIn),
          },
        },
      },
      select: {
        promotionId: true,
        booking: { select: { hotelChainSubBrandId: true } },
      },
    });

    const subBrandsByPromo = new Map<string, Set<string | null>>();
    for (const promo of oncePerSubBrandPromos) {
      subBrandsByPromo.set(promo.id, new Set());
    }
    for (const bp of appliedBookings) {
      subBrandsByPromo.get(bp.promotionId)?.add(bp.booking.hotelChainSubBrandId);
    }

    for (const promo of oncePerSubBrandPromos) {
      const existing = usageMap.get(promo.id) ?? {
        count: 0,
        totalValue: 0,
        totalBonusPoints: 0,
        benefitUsage: new Map(),
      };
      usageMap.set(promo.id, { ...existing, appliedSubBrandIds: subBrandsByPromo.get(promo.id) });
    }
  }

  return usageMap;
}

/**
 * Filters promotions that have constraints requiring usage tracking.
 */
export function getConstrainedPromotions(promotions: MatchingPromotion[]): MatchingPromotion[] {
  return promotions.filter(
    (p) =>
      p.restrictions?.maxStayCount ||
      p.restrictions?.maxRedemptionValue ||
      p.restrictions?.maxTotalBonusPoints ||
      p.restrictions?.spanStays ||
      p.restrictions?.prerequisiteStayCount ||
      p.restrictions?.prerequisiteNightCount ||
      p.tiers.length > 0 ||
      p.restrictions?.oncePerSubBrand ||
      p.benefits.some(
        (b) =>
          b.restrictions?.oncePerSubBrand ||
          b.restrictions?.maxStayCount ||
          b.restrictions?.maxRewardCount ||
          b.restrictions?.maxRedemptionValue ||
          b.restrictions?.maxTotalBonusPoints ||
          b.restrictions?.spanStays ||
          b.restrictions?.prerequisiteStayCount ||
          b.restrictions?.prerequisiteNightCount
      ) ||
      p.tiers.some((t) =>
        t.benefits.some(
          (b) =>
            b.restrictions?.oncePerSubBrand ||
            b.restrictions?.maxStayCount ||
            b.restrictions?.maxRewardCount ||
            b.restrictions?.maxRedemptionValue ||
            b.restrictions?.maxTotalBonusPoints ||
            b.restrictions?.spanStays ||
            b.restrictions?.prerequisiteStayCount ||
            b.restrictions?.prerequisiteNightCount
        )
      )
  );
}

/**
 * Re-evaluates and applies promotions for a list of booking IDs sequentially.
 * Processes bookings one at a time to ensure accurate redemption constraint checks.
 */
export async function reevaluateBookings(bookingIds: string[]): Promise<void> {
  if (bookingIds.length === 0) return;

  const activePromotions = (
    await prisma.promotion.findMany({
      include: PROMOTIONS_INCLUDE,
    })
  ).map((p) => ({
    ...p,
    registrationDate: p.userPromotions ? p.userPromotions.registrationDate : null,
  }));

  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: BOOKING_INCLUDE,
    orderBy: { checkIn: "asc" },
  });

  // Get all promotions with constraints (including tier-based stay counting)
  const constrainedPromos = getConstrainedPromotions(activePromotions);

  // Process sequentially to ensure accurate constraint checks
  for (const booking of bookings) {
    const priorUsage = await fetchPromotionUsage(constrainedPromos, booking, booking.id);
    const matched = calculateMatchedPromotions(booking, activePromotions, priorUsage);

    await applyMatchedPromotions(booking.id, matched);
  }
}

/**
 * Re-evaluates and applies promotions for a single booking.
 * Returns the list of promotion IDs that were applied.
 */
export async function matchPromotionsForBooking(bookingId: string): Promise<string[]> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: BOOKING_INCLUDE,
  });

  if (!booking) {
    throw new Error(`Booking with id ${bookingId} not found`);
  }

  const activePromotions = (
    await prisma.promotion.findMany({
      include: PROMOTIONS_INCLUDE,
    })
  ).map((p) => ({
    ...p,
    registrationDate: p.userPromotions ? p.userPromotions.registrationDate : null,
  }));

  // Get all promotions with constraints (including tier-based stay counting)
  const constrainedPromos = getConstrainedPromotions(activePromotions);

  // Fetch prior usage excluding current booking
  const priorUsage = await fetchPromotionUsage(constrainedPromos, booking, bookingId);

  const matched = calculateMatchedPromotions(booking, activePromotions, priorUsage);
  await applyMatchedPromotions(bookingId, matched);
  return matched.map((m) => m.promotionId);
}

/**
 * Finds all bookings potentially affected by changes to a list of promotions.
 * This includes bookings that already have the promotion applied AND bookings
 * that match the promotion's core criteria (hotel chain, dates, etc.).
 */
export async function getAffectedBookingIds(promotionIds: string[]): Promise<string[]> {
  if (promotionIds.length === 0) return [];

  const promotions = await prisma.promotion.findMany({
    where: { id: { in: promotionIds } },
  });

  if (promotions.length === 0) return [];

  const orConditions = promotions.map((promotion) => {
    const coreConditions = [
      { hotelChainId: promotion.hotelChainId ?? undefined },
      { creditCardId: promotion.creditCardId ?? undefined },
      { shoppingPortalId: promotion.shoppingPortalId ?? undefined },
      {
        bookingPromotions: {
          some: { promotionId: promotion.id },
        },
      },
    ].filter((condition) => {
      const firstKey = Object.keys(condition)[0] as keyof typeof condition;
      const value = condition[firstKey];
      return value !== undefined && value !== null;
    });

    return {
      AND: [
        { OR: coreConditions },
        {
          checkIn: {
            gte: promotion.startDate ?? undefined,
            lte: promotion.endDate ?? undefined,
          },
        },
      ],
    };
  });

  const affectedBookings = await prisma.booking.findMany({
    where: {
      OR: orConditions,
    },
    select: { id: true },
  });

  // Use a Set to handle bookings affected by multiple promotions
  const allAffectedIds = new Set(affectedBookings.map((b) => b.id));
  return Array.from(allAffectedIds);
}

/**
 * Re-evaluates and applies promotions for all bookings potentially affected by a promotion change.
 */
export async function matchPromotionsForAffectedBookings(promotionId: string): Promise<void> {
  const affectedBookingIds = await getAffectedBookingIds([promotionId]);
  await reevaluateBookings(affectedBookingIds);
}
