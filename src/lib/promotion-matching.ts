import {
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  Prisma,
} from "@prisma/client";
import { DEFAULT_EQN_VALUE } from "./constants";
import { resolveBasePointRate, convertToCalcCurrency } from "./loyalty-utils";
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

export const BOOKING_INCLUDE = {
  hotelChain: { include: { pointType: true } },
  hotelChainSubBrand: true,
  userCreditCard: { include: { creditCard: { include: { pointType: true } } } },
  shoppingPortal: true,
  property: { select: { countryCode: true } },
  _count: { select: { certificates: true } },
  bookingPromotions: {
    include: {
      benefitApplications: true,
    },
  },
} as const;

export type MatchingRestrictions = {
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
  requireBookedAfterRegistration: boolean;
  tieInRequiresPayment: boolean;
  allowedPaymentTypes: string[];
  allowedBookingSources: string[];
  allowedCountryCodes: string[];
  allowedAccommodationTypes: string[];
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

export const RESTRICTIONS_INCLUDE = {
  subBrandRestrictions: true,
  tieInCards: true,
} as const;

export const PROMOTIONS_INCLUDE = {
  benefits: {
    orderBy: { sortOrder: "asc" as const },
    include: { restrictions: { include: RESTRICTIONS_INCLUDE } },
  },
  tiers: {
    orderBy: [{ minStays: "asc" }, { minNights: "asc" }] as {
      minStays?: "asc" | "desc";
      minNights?: "asc" | "desc";
    }[],
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
  userCreditCardId?: string | null;
  userCreditCard?: {
    creditCardId: string;
    creditCard?: {
      pointType?: {
        usdCentsPerPoint: string | number | Prisma.Decimal | null;
      } | null;
    } | null;
  } | null;
  shoppingPortalId: string | null;
  hotelChainId: string | null;
  hotelChainSubBrandId: string | null;
  accommodationType?: string | null;
  bookingSource: string | null;
  checkIn: Date | string;
  createdAt: Date | string;
  bookingDate?: Date | string | null;
  numNights: number;
  pretaxCost: string | number | Prisma.Decimal;
  totalCost: string | number | Prisma.Decimal;
  currency?: string;
  lockedExchangeRate?: string | number | Prisma.Decimal | null;
  property?: { countryCode?: string | null } | null;
  pointsRedeemed: number | null;
  loyaltyPointsEarned: number | null;
  _count?: { certificates: number };
  hotelChain?: {
    basePointRate?: string | number | Prisma.Decimal | null;
    calculationCurrency?: string | null;
    calcCurrencyToUsdRate?: number | null;
    pointType?: {
      usdCentsPerPoint: string | number | Prisma.Decimal | null;
    } | null;
  } | null;
  hotelChainSubBrand?: {
    basePointRate?: string | number | Prisma.Decimal | null;
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

export interface BenefitApplication {
  promotionBenefitId: string;
  appliedValue: number;
  bonusPointsApplied: number;
  eligibleNightsAtBooking?: number;
  isOrphaned?: boolean;
  isPreQualifying?: boolean;
  isMaxedOut?: boolean;
}

export interface MatchedPromotion {
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
        return { valid: promo.creditCardId === (booking.userCreditCard?.creditCardId ?? null) };
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

  geography: (booking, promo) => {
    const codes = promo.restrictions?.allowedCountryCodes ?? [];
    if (codes.length === 0) return { valid: true }; // no restriction
    const countryCode = booking.property?.countryCode;
    if (!countryCode) return { valid: false }; // no geo data → hidden
    return { valid: codes.includes(countryCode) };
  },

  accommodationType: (booking, promo) => {
    const allowed = promo.restrictions?.allowedAccommodationTypes ?? [];
    if (allowed.length === 0) return { valid: true }; // no restriction → matches all types
    const type = booking.accommodationType ?? "hotel";
    return { valid: allowed.includes(type) };
  },

  tieInCard: (booking, promo) => {
    if (promo.restrictions?.tieInCards && promo.restrictions.tieInCards.length > 0) {
      const bookingCreditCardId = booking.userCreditCard?.creditCardId ?? null;
      const cardMatches =
        bookingCreditCardId != null &&
        promo.restrictions.tieInCards.some((c) => c.creditCardId === bookingCreditCardId);
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
      Number(booking.totalCost) * Number(booking.lockedExchangeRate ?? 1) <
        Number(promo.restrictions.minSpend)
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
 * Campaign-level check that evaluates whether this booking was placed on or
 * after the user's registration date for the promotion. Produces either an
 * "orphaned" or "pre_qualifying" reason when the rule is violated.
 */
function evaluateBookedAfterRegistration(
  booking: MatchingBooking,
  promo: MatchingPromotion
): ValidationResult {
  if (!promo.restrictions?.requireBookedAfterRegistration) {
    return { valid: true };
  }
  const regDate = ensureDate(promo.registrationDate);
  if (!regDate) {
    return { valid: false, reason: "pre_qualifying" };
  }
  const bookDate = ensureDate(booking.bookingDate);
  if (!bookDate) {
    return { valid: false, reason: "orphaned" };
  }
  if (bookDate < regDate) {
    return { valid: false, reason: "orphaned" };
  }
  return { valid: true };
}

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

    // 2.5 Booked-After-Registration check (campaign-level, fulfillment tier).
    //     Pre-qualifying if the user hasn't registered yet; orphaned if the
    //     booking predates the registration or lacks a booking date.
    if (!isPromoOrphaned && !isMaxedOut) {
      const result = evaluateBookedAfterRegistration(booking, promo);
      if (!result.valid) {
        if (result.reason === "pre_qualifying") {
          isPromoPreQualifying = true;
        } else {
          isPromoOrphaned = true;
        }
      }
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
      const currentStayNumber = priorMatchedStays + 1;

      // Night-based tiers use per-stay semantics: tier selected by this booking's numNights.
      // Stay-based tiers use cumulative semantics: tier selected by the stay sequence number.
      const hasStayBasedTiers = promo.tiers.some((t) => t.minStays !== null);

      const applicableTier = promo.tiers.find((tier) => {
        if (tier.minStays !== null) {
          const minMatch = currentStayNumber >= tier.minStays;
          const maxMatch = tier.maxStays === null || currentStayNumber <= tier.maxStays;
          if (minMatch && maxMatch) return true;
        }
        if (tier.minNights !== null) {
          const minMatch = booking.numNights >= tier.minNights;
          const maxMatch = tier.maxNights === null || booking.numNights <= tier.maxNights;
          if (minMatch && maxMatch) return true;
        }
        return false;
      });

      if (!applicableTier) {
        if (!hasStayBasedTiers) {
          // booking.numNights is fixed — no future state can move a stay into a night tier
          continue;
        }

        // Stay-based: check if we will EVER reach a tier (pre-qualifying vs orphaned detection)
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
            Number(booking.totalCost) * Number(booking.lockedExchangeRate ?? 1) <
              Number(br.minSpend)
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
    const centsPerPoint = booking.hotelChain?.pointType?.usdCentsPerPoint
      ? Number(booking.hotelChain.pointType.usdCentsPerPoint)
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
        const usdTotalCost = Number(booking.totalCost) * Number(booking.lockedExchangeRate ?? 1);
        const usdPretaxCost = Number(booking.pretaxCost) * Number(booking.lockedExchangeRate ?? 1);
        switch (benefit.rewardType) {
          case PromotionRewardType.cashback:
            if (benefit.valueType === PromotionBenefitValueType.fixed) {
              appliedValue = benefitValue;
            } else if (benefit.valueType === PromotionBenefitValueType.percentage) {
              appliedValue = (usdTotalCost * benefitValue) / 100;
            }
            break;
          case PromotionRewardType.points:
            if (benefit.valueType === PromotionBenefitValueType.multiplier) {
              const isBaseOnly =
                !benefit.pointsMultiplierBasis || benefit.pointsMultiplierBasis === "base_only";
              const baseRate = resolveBasePointRate(booking.hotelChain, booking.hotelChainSubBrand);
              const basisPretaxCost = convertToCalcCurrency(usdPretaxCost, booking.hotelChain);
              const basisPoints =
                isBaseOnly && baseRate != null
                  ? basisPretaxCost * Number(baseRate)
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
          const usdTotalCostSpan =
            Number(booking.totalCost) * Number(booking.lockedExchangeRate ?? 1);
          const usdPretaxCostSpan =
            Number(booking.pretaxCost) * Number(booking.lockedExchangeRate ?? 1);
          // Calculate full benefit value first
          switch (benefit.rewardType) {
            case PromotionRewardType.cashback:
              if (benefit.valueType === PromotionBenefitValueType.fixed) {
                appliedValue = benefitValue;
              } else if (benefit.valueType === PromotionBenefitValueType.percentage) {
                appliedValue = (usdTotalCostSpan * benefitValue) / 100;
              }
              break;
            case PromotionRewardType.points:
              if (benefit.valueType === PromotionBenefitValueType.multiplier) {
                const isBaseOnly =
                  !benefit.pointsMultiplierBasis || benefit.pointsMultiplierBasis === "base_only";
                const baseRate = resolveBasePointRate(
                  booking.hotelChain,
                  booking.hotelChainSubBrand
                );
                const basisPretaxCostSpan = convertToCalcCurrency(
                  usdPretaxCostSpan,
                  booking.hotelChain
                );
                const basisPoints =
                  isBaseOnly && baseRate != null
                    ? basisPretaxCostSpan * Number(baseRate)
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
        isMaxedOut: isBenefitMaxedOut,
      });
    }

    // If all benefits are zero-value AND none are orphaned/pre-qualifying/maxed-out, skip
    const hasAnyActiveBenefit = benefitApplications.some(
      (ba) => ba.appliedValue > 0 || ba.isOrphaned || ba.isPreQualifying || ba.isMaxedOut
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
