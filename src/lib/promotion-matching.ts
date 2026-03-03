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
  benefitUsage?: Map<
    string,
    {
      count: number;
      totalValue: number;
      totalBonusPoints: number;
      eligibleNights?: number;
      totalPotentialStayCount?: number;
      totalPotentialNightCount?: number;
      couldEverMatch?: boolean;
    }
  >;
  // Lookahead stats for orphaned detection
  totalPotentialStayCount?: number;
  totalPotentialNightCount?: number;
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
  id: string;
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
    id: string;
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

interface MatchingPromotion {
  id: string;
  name?: string;
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
}

interface MatchedPromotion {
  promotionId: string;
  appliedValue: number;
  bonusPointsApplied: number;
  eligibleNightsAtBooking?: number;
  isOrphaned?: boolean;
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
    const checkInDate = new Date(booking.checkIn);

    if (promo.registrationDate) {
      const regDate = new Date(promo.registrationDate);
      if (checkInDate < regDate) return { valid: false };

      if (promo.restrictions?.validDaysAfterRegistration) {
        const personalEndDate = new Date(regDate);
        personalEndDate.setDate(regDate.getDate() + promo.restrictions.validDaysAfterRegistration);
        if (checkInDate > personalEndDate) return { valid: false };
      } else if (promo.endDate && checkInDate > new Date(promo.endDate)) {
        return { valid: false };
      }
    } else {
      if (promo.startDate && checkInDate < new Date(promo.startDate)) return { valid: false };
      if (promo.endDate && checkInDate > new Date(promo.endDate)) return { valid: false };
    }
    return { valid: true };
  },

  registrationDeadline: (booking, promo) => {
    if (promo.registrationDate && promo.restrictions?.registrationDeadline) {
      if (new Date(promo.registrationDate) > new Date(promo.restrictions.registrationDeadline)) {
        return { valid: false };
      }
    }
    return { valid: true };
  },

  bookByDate: (booking, promo) => {
    if (promo.restrictions?.bookByDate) {
      if (new Date(booking.createdAt) > new Date(promo.restrictions.bookByDate)) {
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
 * Fulfillment Rules (Orphaned Detection)
 * If these fail, the promotion might still be matched but marked as orphaned.
 */
const FulfillmentPromotionRules: Record<string, PromotionRule> = {
  usageCaps: (booking, promo, usage) => {
    const r = promo.restrictions;
    const maxStayCount = r?.maxStayCount != null ? Number(r.maxStayCount) : null;
    if (maxStayCount && usage && usage.count >= maxStayCount) {
      return { valid: false };
    }
    if (r?.oncePerSubBrand) {
      if (usage?.appliedSubBrandIds?.has(booking.hotelChainSubBrandId ?? null)) {
        return { valid: false };
      }
    }
    return { valid: true };
  },

  minSpend: (booking, promo) => {
    const minSpend =
      promo.restrictions?.minSpend != null ? Number(promo.restrictions.minSpend) : null;
    if (
      promo.type === PromotionType.credit_card &&
      minSpend != null &&
      Number(booking.totalCost) < minSpend
    ) {
      return { valid: false };
    }
    return { valid: true };
  },

  minNights: (booking, promo) => {
    const r = promo.restrictions;
    const minNights = r?.minNightsRequired != null ? Number(r.minNightsRequired) : 0;
    if (minNights > 0 && booking.numNights < minNights && !r?.spanStays) {
      return { valid: false };
    }
    return { valid: true };
  },

  prerequisites: (booking, promo, usage) => {
    const r = promo.restrictions;
    if (!r) return { valid: true };

    // This rule determines if the reward is given NOW.
    // Use eligibleStayCount (actual prior applications)
    const prereqStays = r.prerequisiteStayCount != null ? Number(r.prerequisiteStayCount) : 0;
    if (prereqStays > 0 && (usage?.eligibleStayCount ?? 0) < prereqStays) {
      return { valid: false };
    }

    const prereqNights = r.prerequisiteNightCount != null ? Number(r.prerequisiteNightCount) : 0;
    if (prereqNights > 0 && (usage?.eligibleNightCount ?? 0) < prereqNights) {
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

    // 1. Run Core Eligibility Rules (Hard Filters)
    const isCoreValid = Object.values(CorePromotionRules).every((rule) => {
      return rule(booking, promo, usage).valid;
    });

    if (!isCoreValid) continue;

    // 2. Run Fulfillment Rules (Soft Filters / Orphaned Detection)
    // Determines if THIS stay gets a reward.
    const isFulfillmentValid = Object.values(FulfillmentPromotionRules).every((rule) => {
      return rule(booking, promo, usage).valid;
    });

    // 3. Determine Orphaned Status (Lookahead)
    // A promotion is orphaned if its requirements can NEVER be met by the current schedule.
    let isPromoOrphaned = false;
    const r = promo.restrictions;

    if (r) {
      // Check Usage Caps (If already maxed out, it's a hard exclusion for this stay)
      const maxStayCount = r.maxStayCount != null ? Number(r.maxStayCount) : null;
      if (maxStayCount && usage && usage.count >= maxStayCount) {
        continue;
      }

      // Potential progress = (Existing matching bookings in window - past, current, and future)
      const potentialStays = usage?.totalPotentialStayCount ?? 0;
      const potentialNights = usage?.totalPotentialNightCount ?? 0;

      // Lookahead: Prerequisites
      const prereqStays = r.prerequisiteStayCount != null ? Number(r.prerequisiteStayCount) : 0;
      if (prereqStays > 0 && potentialStays < prereqStays + 1) {
        isPromoOrphaned = true;
      }

      const prereqNights = r.prerequisiteNightCount != null ? Number(r.prerequisiteNightCount) : 0;
      if (prereqNights > 0 && !isPromoOrphaned) {
        if (potentialNights < prereqNights + booking.numNights) {
          isPromoOrphaned = true;
        }
      }

      // Lookahead: Min Nights (Spanned stays)
      const minNights = r.minNightsRequired != null ? Number(r.minNightsRequired) : 0;
      if (r.spanStays && minNights > 0 && !isPromoOrphaned) {
        if (potentialNights < minNights) {
          isPromoOrphaned = true;
        }
      }
    }

    // If it's not fulfilling AND it's not orphaned yet, it's just PENDING.
    if (!isFulfillmentValid && !isPromoOrphaned) {
      // Only show pending promotions if they are spanned (partial value)
      if (!r?.spanStays) continue;
    }

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
        // If orphaned, show the first tier as the target
        if (isPromoOrphaned && promo.tiers.length > 0) {
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

    // Per-benefit matching and orphaned detection
    const benefitStatuses = activeBenefits.map((b) => {
      const br = b.restrictions;
      const bUsage = usage?.benefitUsage?.get(b.id);

      // 1. Core Eligibility (Hard filters)
      let currentMatchesCore = true;
      if (br) {
        if (!checkSubBrandRestrictions(br, booking.hotelChainSubBrandId))
          currentMatchesCore = false;
        if (currentMatchesCore && br.tieInCards.length > 0) {
          const cardMatches =
            booking.creditCardId != null &&
            br.tieInCards.some((c) => c.creditCardId === booking.creditCardId);
          if (!cardMatches) currentMatchesCore = false;
        }
        if (
          currentMatchesCore &&
          br.oncePerSubBrand &&
          usage?.appliedSubBrandIds?.has(booking.hotelChainSubBrandId ?? null)
        ) {
          currentMatchesCore = false;
        }
        if (
          currentMatchesCore &&
          br.allowedPaymentTypes &&
          !checkPaymentTypeRestriction(br.allowedPaymentTypes, booking)
        ) {
          currentMatchesCore = false;
        }
        if (
          currentMatchesCore &&
          br.allowedBookingSources &&
          !checkBookingSourceRestriction(br.allowedBookingSources, booking)
        ) {
          currentMatchesCore = false;
        }
        if (currentMatchesCore && br.hotelChainId && br.hotelChainId !== booking.hotelChainId) {
          currentMatchesCore = false;
        }
        if (
          currentMatchesCore &&
          br.minSpend != null &&
          Number(booking.totalCost) < Number(br.minSpend)
        ) {
          currentMatchesCore = false;
        }
        if (currentMatchesCore && br.maxRewardCount) {
          const benefitCount = bUsage?.count ?? 0;
          if (benefitCount >= br.maxRewardCount) currentMatchesCore = false;
        }
      }

      // If it doesn't match core criteria AND it hasn't matched any OTHER stay, filter it out completely
      if (!currentMatchesCore && !bUsage?.couldEverMatch) {
        return { matched: false };
      }

      // 2. Fulfillment detection (If these fail, it might be orphaned)
      // Inherit promo-level orphaned status
      let isOrphaned = !currentMatchesCore || isPromoOrphaned;
      let isRemainderOrphaned = false;

      // Check Benefit-level spanStays restrictions
      if (!isOrphaned && br?.spanStays && br.minNightsRequired && br.minNightsRequired > 0) {
        const totalNights = bUsage?.totalPotentialNightCount ?? usage?.totalPotentialNightCount;
        if (totalNights !== undefined) {
          if (totalNights < br.minNightsRequired) {
            isOrphaned = true;
          } else if (totalNights % br.minNightsRequired !== 0) {
            // Check if THIS stay contains the "dead" remainder
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

      // Check Promotion-level spanStays restrictions
      const r = promo.restrictions;
      if (!isOrphaned && r?.spanStays && r.minNightsRequired && r.minNightsRequired > 0) {
        const totalNights = usage?.totalPotentialNightCount;
        if (totalNights !== undefined) {
          if (totalNights < r.minNightsRequired) {
            isOrphaned = true;
          } else if (totalNights % r.minNightsRequired !== 0 && !isRemainderOrphaned) {
            const priorNights = usage?.eligibleStayNights ?? 0;
            const currentNights = booking.numNights; // Promo level always counts current stay if core matched
            const totalSoFar = priorNights + currentNights;
            const nextCycleGoal = Math.ceil(totalSoFar / r.minNightsRequired) * r.minNightsRequired;

            if (totalNights < nextCycleGoal) {
              isRemainderOrphaned = true;
            }
          }
        }
      }

      // Check Prerequisite Stay Counts
      const minStays = r?.prerequisiteStayCount ? r.prerequisiteStayCount + 1 : 0;
      if (!isOrphaned && minStays > 0) {
        const totalStays = usage?.totalPotentialStayCount;
        if (totalStays !== undefined && totalStays < minStays) {
          isOrphaned = true;
        }
      }

      // Check Prerequisite Night Counts
      if (!isOrphaned && r?.prerequisiteNightCount && r.prerequisiteNightCount > 0) {
        const totalNights = usage?.totalPotentialNightCount;
        if (
          totalNights !== undefined &&
          totalNights < r.prerequisiteNightCount + booking.numNights
        ) {
          isOrphaned = true;
        }
      }

      // Also filter out if it's a fixed-night stay (not spanned) and doesn't meet requirements
      if (
        !isOrphaned &&
        br?.minNightsRequired &&
        !br.spanStays &&
        booking.numNights < br.minNightsRequired
      ) {
        // For non-spanned stays, failing minNights is usually a hard exclusion
        return { matched: false };
      }

      return {
        matched: true,
        benefit: b,
        isOrphaned,
        isRemainderOrphaned,
        bUsage,
        currentMatchesCore,
        isFulfillmentValid,
      };
    });

    type BenefitUsageData = {
      count: number;
      totalValue: number;
      totalBonusPoints: number;
      eligibleNights?: number;
      totalPotentialStayCount?: number;
      totalPotentialNightCount?: number;
      couldEverMatch?: boolean;
    };

    const matchedBenefits = benefitStatuses.filter((s) => s.matched && s.benefit) as unknown as {
      matched: true;
      benefit: MatchingBenefit;
      isOrphaned: boolean;
      isRemainderOrphaned: boolean;
      bUsage: BenefitUsageData | undefined;
      currentMatchesCore: boolean;
      isFulfillmentValid: boolean;
    }[];

    if (matchedBenefits.length === 0) continue;

    // Calculate applied value per benefit
    const centsPerPoint = booking.hotelChain?.pointType?.centsPerPoint
      ? Number(booking.hotelChain.pointType.centsPerPoint)
      : 0.01;

    const benefitApplications: BenefitApplication[] = [];
    let totalAppliedValue = 0;
    let totalBonusPoints = 0;

    for (const {
      benefit,
      isOrphaned,
      isRemainderOrphaned,
      bUsage,
      currentMatchesCore,
      isFulfillmentValid,
    } of matchedBenefits) {
      const benefitValue = Number(benefit.value);
      let appliedValue = 0;
      let benefitBonusPoints = 0;

      const br = benefit.restrictions;
      const r = promo.restrictions;

      // 1. Determine Fulfillable Nights in THIS stay
      // Reward is ONLY given if core criteria match AND overall promotion prerequisites are met AND it's not orphaned.
      const isActuallyOrphaned = isOrphaned || isPromoOrphaned;
      let fulfillableNightsInStay =
        currentMatchesCore && isFulfillmentValid && !isActuallyOrphaned ? booking.numNights : 0;

      if (isActuallyOrphaned) {
        fulfillableNightsInStay = 0;
      } else if (isRemainderOrphaned) {
        const minNights = br?.minNightsRequired ?? r?.minNightsRequired ?? 0;
        if (minNights > 0) {
          const priorNights = bUsage?.eligibleNights ?? 0;
          const totalSoFar = priorNights + fulfillableNightsInStay;
          const completedCycles = Math.floor(totalSoFar / minNights);
          const nightsInCompletedCycles = completedCycles * minNights;
          fulfillableNightsInStay = Math.max(0, nightsInCompletedCycles - priorNights);
        }
      }

      // 2. Calculate Base Value (for 1 unit/cycle)
      let baseAppliedValue = 0;
      let baseBonusPoints = 0;

      switch (benefit.rewardType) {
        case PromotionRewardType.cashback:
          if (benefit.valueType === PromotionBenefitValueType.fixed) {
            baseAppliedValue = benefitValue;
          } else if (benefit.valueType === PromotionBenefitValueType.percentage) {
            baseAppliedValue = (Number(booking.totalCost) * benefitValue) / 100;
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
            baseAppliedValue = basisPoints * (benefitValue - 1) * centsPerPoint;
            baseBonusPoints = Math.round(basisPoints * (benefitValue - 1));
          } else {
            baseAppliedValue = benefitValue * centsPerPoint;
            baseBonusPoints = Math.round(benefitValue);
          }
          break;
        case PromotionRewardType.certificate:
          baseAppliedValue = benefit.certType
            ? certPointsValue(benefit.certType) * centsPerPoint * 0.7
            : 0;
          break;
        case PromotionRewardType.eqn:
          baseAppliedValue = benefitValue * DEFAULT_EQN_VALUE;
          break;
      }

      // 3. Scale by Fulfillable Nights
      const promoIsStacked = r?.nightsStackable && r?.minNightsRequired && r.minNightsRequired > 0;
      const promoIsSpanned = r?.spanStays && r?.minNightsRequired && r.minNightsRequired > 0;

      if (!promoIsStacked && !promoIsSpanned && br?.minNightsRequired && br.minNightsRequired > 0) {
        if (br.spanStays || br.nightsStackable) {
          const divisor = br.minNightsRequired;
          const multiplier = br.spanStays
            ? fulfillableNightsInStay / divisor
            : Math.floor(fulfillableNightsInStay / divisor);
          appliedValue = baseAppliedValue * multiplier;
          benefitBonusPoints = baseBonusPoints * multiplier;
        } else {
          // Fixed stay requirements met
          const multiplier = fulfillableNightsInStay > 0 ? 1 : 0;
          appliedValue = baseAppliedValue * multiplier;
          benefitBonusPoints = baseBonusPoints * multiplier;
        }
      } else {
        // Flat benefit or scaled at promo-level
        const multiplier = fulfillableNightsInStay > 0 ? 1 : 0;
        appliedValue = baseAppliedValue * multiplier;
        benefitBonusPoints = baseBonusPoints * multiplier;
      }

      // 4. Benefit-level caps (Applied ONLY to fulfillable value)
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

      // FINAL OVERRIDE: If orphaned or not fulfilling, no value
      if (isActuallyOrphaned || !isFulfillmentValid) {
        appliedValue = 0;
        benefitBonusPoints = 0;
      }

      // ONLY add to applications if it has value OR it's specifically a spanned remainder OR it's orphaned.
      // Including orphaned benefits allows the UI to show why the promotion didn't apply.
      const isVisible = appliedValue > 0 || isRemainderOrphaned || isActuallyOrphaned;

      if (isVisible) {
        benefitApplications.push({
          promotionBenefitId: benefit.id,
          appliedValue,
          bonusPointsApplied: Math.round(benefitBonusPoints),
          eligibleNightsAtBooking:
            (bUsage?.eligibleNights ?? 0) + (currentMatchesCore ? booking.numNights : 0),
          isOrphaned: isActuallyOrphaned || isRemainderOrphaned,
        });

        totalAppliedValue += appliedValue;
        totalBonusPoints += benefitBonusPoints;
      }
    }

    // Promotion-level scaling (Stackable / Span Stays)
    // ONLY applies to benefits that don't have their own scaling restrictions
    if (r?.minNightsRequired && r.minNightsRequired > 0 && (r.spanStays || r.nightsStackable)) {
      const multiplier = r.spanStays
        ? booking.numNights / r.minNightsRequired
        : Math.floor(booking.numNights / r.minNightsRequired);

      for (const ba of benefitApplications) {
        // Find the corresponding benefit from matchedBenefits to check its restrictions
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

        // Subtract old values from totals before scaling
        totalAppliedValue -= ba.appliedValue;
        totalBonusPoints -= ba.bonusPointsApplied;

        ba.appliedValue *= multiplier;
        ba.bonusPointsApplied = Math.round(ba.bonusPointsApplied * multiplier);

        // Add new values back to totals
        totalAppliedValue += ba.appliedValue;
        totalBonusPoints += ba.bonusPointsApplied;
      }
    }

    // Promotion-level caps
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
        totalAppliedValue = totalAppliedValue * ratio;
        totalBonusPoints = remainingPoints;
      }
    }

    // Overall Promotion Orphaned status override:
    // If the promotion is orphaned, ensure total value is 0 and all benefits are marked orphaned
    if (isPromoOrphaned) {
      totalAppliedValue = 0;
      totalBonusPoints = 0;
      for (const ba of benefitApplications) {
        ba.appliedValue = 0;
        ba.bonusPointsApplied = 0;
        ba.isOrphaned = true;
      }
    }

    matched.push({
      promotionId: promo.id,
      appliedValue: totalAppliedValue,
      bonusPointsApplied: Math.round(totalBonusPoints),
      eligibleNightsAtBooking: (usage?.eligibleStayNights ?? 0) + booking.numNights,
      benefitApplications,
      isOrphaned: isPromoOrphaned,
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
    const record = await prisma.bookingPromotion.create({
      data: {
        bookingId,
        promotionId: match.promotionId,
        appliedValue: match.appliedValue,
        bonusPointsApplied: match.bonusPointsApplied > 0 ? match.bonusPointsApplied : null,
        autoApplied: true,
        eligibleNightsAtBooking: match.eligibleNightsAtBooking,
        isOrphaned: match.isOrphaned ?? false,
        benefitApplications: {
          create: match.benefitApplications.map((ba) => ({
            promotionBenefitId: ba.promotionBenefitId,
            appliedValue: ba.appliedValue,
            bonusPointsApplied: ba.bonusPointsApplied > 0 ? ba.bonusPointsApplied : null,
            eligibleNightsAtBooking: ba.eligibleNightsAtBooking,
            isOrphaned: ba.isOrphaned ?? false,
          })),
        },
      },
    });
    createdRecords.push(record);
  }

  return createdRecords;
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

  const currentCheckIn = new Date(booking.checkIn);
  const currentCreatedAt = new Date(booking.createdAt);
  const currentId = booking.id;

  const priorFilter = {
    OR: [
      {
        booking: {
          checkIn: { lt: currentCheckIn },
        },
      },
      {
        booking: {
          checkIn: currentCheckIn,
          createdAt: { lt: currentCreatedAt },
        },
      },
      {
        booking: {
          checkIn: currentCheckIn,
          createdAt: currentCreatedAt,
          id: { lt: currentId },
        },
      },
    ],
  };

  // Potential stays should include ALL stays in the promo window (past, current, and future)
  // this tells us if the requirements are MATHEMATICALLY possible.
  const globalPotentialFilter = {}; // No filter needed other than the base where clause below

  // Single aggregation query to get count, totalValue, and totalBonusPoints
  const usage = await prisma.bookingPromotion.groupBy({
    by: ["promotionId"],
    where: {
      promotionId: { in: promotionIds },
      ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
      ...priorFilter,
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

  const benefitToPromoMap = new Map<string, string>();
  for (const p of promotions) {
    for (const b of [...p.benefits, ...p.tiers.flatMap((t) => t.benefits)]) {
      benefitToPromoMap.set(b.id, p.id);
    }
  }

  if (allBenefitIds.length > 0) {
    const benefitUsage = await prisma.bookingPromotionBenefit.groupBy({
      by: ["promotionBenefitId"],
      where: {
        promotionBenefitId: { in: allBenefitIds },
        ...(excludeBookingId ? { bookingPromotion: { bookingId: { not: excludeBookingId } } } : {}),
        bookingPromotion: priorFilter,
      },
      _count: { id: true },
      _sum: { appliedValue: true, bonusPointsApplied: true },
    });

    // To get eligible nights, we need to join with Booking
    // This is because numNights is on the booking, not the benefit application
    const priorBookingPromos = await prisma.bookingPromotion.findMany({
      where: {
        promotionId: { in: promotions.map((p) => p.id) },
        isOrphaned: false,
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
        ...priorFilter,
      },
      select: {
        booking: { select: { numNights: true } },
        benefitApplications: {
          where: {
            promotionBenefitId: { in: allBenefitIds },
            isOrphaned: false,
          },
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
          });
        }
      }
    }
  }
  // Fetch usage stats for all active promotions to ensure lookahead data is available
  for (const promo of promotions) {
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

    // Prior Usage (Only count bookings where this promo was actually applied and NOT orphaned)
    const eligiblePromoStats = await prisma.bookingPromotion.aggregate({
      where: {
        promotionId: promo.id,
        isOrphaned: false,
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
        ...priorFilter,
        booking: {
          // Filter by core criteria to ensure it matched the rules at the time
          hotelChainId:
            promo.type === PromotionType.loyalty ? (promo.hotelChainId ?? undefined) : undefined,
          creditCardId:
            promo.type === PromotionType.credit_card
              ? (promo.creditCardId ?? undefined)
              : undefined,
          shoppingPortalId:
            promo.type === PromotionType.portal ? (promo.shoppingPortalId ?? undefined) : undefined,
          ...subBrandFilter,
        },
      },
      _count: { id: true },
    });

    // To get eligible nights, we need to join with Booking
    const priorEligibleBookings = await prisma.bookingPromotion.findMany({
      where: {
        promotionId: promo.id,
        isOrphaned: false,
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
        ...priorFilter,
        booking: {
          hotelChainId:
            promo.type === PromotionType.loyalty ? (promo.hotelChainId ?? undefined) : undefined,
          creditCardId:
            promo.type === PromotionType.credit_card
              ? (promo.creditCardId ?? undefined)
              : undefined,
          shoppingPortalId:
            promo.type === PromotionType.portal ? (promo.shoppingPortalId ?? undefined) : undefined,
          ...subBrandFilter,
        },
      },
      select: {
        booking: { select: { numNights: true } },
      },
    });

    const eligibleNightsCount = priorEligibleBookings.reduce(
      (sum, bp) => sum + bp.booking.numNights,
      0
    );

    // Total Potential (including current + future stays for lookahead)
    const potentialStats = await prisma.booking.aggregate({
      where: {
        hotelChainId:
          promo.type === PromotionType.loyalty ? (promo.hotelChainId ?? undefined) : undefined,
        creditCardId:
          promo.type === PromotionType.credit_card ? (promo.creditCardId ?? undefined) : undefined,
        shoppingPortalId:
          promo.type === PromotionType.portal ? (promo.shoppingPortalId ?? undefined) : undefined,
        ...subBrandFilter,
        ...globalPotentialFilter,
        checkIn: {
          ...(promo.startDate ? { gte: promo.startDate } : {}),
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
      eligibleStayCount: eligiblePromoStats._count.id,
      eligibleNightCount: eligibleNightsCount,
      totalPotentialStayCount: potentialStats._count.id,
      totalPotentialNightCount: potentialStats._sum.numNights ?? 0,
    });
  }

  // Fetch potential counts for benefits (orphaned detection)
  const relevantBenefits = promotions.flatMap((p) => [
    ...p.benefits,
    ...p.tiers.flatMap((t) => t.benefits),
  ]);

  for (const benefit of relevantBenefits) {
    const promoId = benefitToPromoMap.get(benefit.id);
    if (!promoId) continue;
    const promo = promotions.find((p) => p.id === promoId);
    if (!promo) continue;

    let subBrandFilter: Record<string, unknown> = {};
    const br = benefit.restrictions;
    if (br) {
      const includeList = br.subBrandRestrictions.filter((s) => s.mode === "include");
      const excludeList = br.subBrandRestrictions.filter((s) => s.mode === "exclude");
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

    // Benefit-level potential (all stays matching benefit criteria in promo window)
    const potentialStats = await prisma.booking.aggregate({
      where: {
        hotelChainId:
          br?.hotelChainId ||
          (promo.type === PromotionType.loyalty ? (promo.hotelChainId ?? undefined) : undefined),
        creditCardId:
          promo.type === PromotionType.credit_card ? (promo.creditCardId ?? undefined) : undefined,
        shoppingPortalId:
          promo.type === PromotionType.portal ? (promo.shoppingPortalId ?? undefined) : undefined,
        ...subBrandFilter,
        ...globalPotentialFilter,
        checkIn: {
          ...(promo.startDate ? { gte: promo.startDate } : {}),
          ...(promo.endDate ? { lte: promo.endDate } : {}),
        },
      },
      _count: { id: true },
      _sum: { numNights: true },
    });

    const usage = usageMap.get(promoId);
    if (usage && usage.benefitUsage) {
      const bUsage = usage.benefitUsage.get(benefit.id) ?? {
        count: 0,
        totalValue: 0,
        totalBonusPoints: 0,
        eligibleNights: 0,
      };
      usage.benefitUsage.set(benefit.id, {
        ...bUsage,
        totalPotentialStayCount: potentialStats._count.id,
        totalPotentialNightCount: potentialStats._sum.numNights ?? 0,
        couldEverMatch: potentialStats._count.id > 0,
      });
    }
  }

  // Fetch eligibleStayNights for spanStays promotions
  const spanStaysPromos = promotions.filter((p) => p.restrictions?.spanStays);
  if (spanStaysPromos.length > 0) {
    const spanStaysPromoIds = spanStaysPromos.map((p) => p.id);
    const bookingPromos = await prisma.bookingPromotion.findMany({
      where: {
        promotionId: { in: spanStaysPromoIds },
        isOrphaned: false,
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
  // Include promotions where either the promotion-level or any benefit-level restriction has oncePerSubBrand
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
      p.restrictions?.maxStayCount != null ||
      p.restrictions?.maxRedemptionValue != null ||
      p.restrictions?.maxTotalBonusPoints != null ||
      p.restrictions?.spanStays ||
      p.restrictions?.prerequisiteStayCount != null ||
      p.restrictions?.prerequisiteNightCount != null ||
      p.tiers.length > 0 ||
      p.restrictions?.oncePerSubBrand ||
      p.benefits.some(
        (b) =>
          b.restrictions?.oncePerSubBrand ||
          b.restrictions?.maxStayCount != null ||
          b.restrictions?.maxRewardCount != null ||
          b.restrictions?.maxRedemptionValue != null ||
          b.restrictions?.maxTotalBonusPoints != null ||
          b.restrictions?.spanStays ||
          b.restrictions?.prerequisiteStayCount != null ||
          b.restrictions?.prerequisiteNightCount != null
      ) ||
      p.tiers.some((t) =>
        t.benefits.some(
          (b) =>
            b.restrictions?.oncePerSubBrand ||
            b.restrictions?.maxStayCount != null ||
            b.restrictions?.maxRewardCount != null ||
            b.restrictions?.maxRedemptionValue != null ||
            b.restrictions?.maxTotalBonusPoints != null ||
            b.restrictions?.spanStays ||
            b.restrictions?.prerequisiteStayCount != null ||
            b.restrictions?.prerequisiteNightCount != null
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
    registrationDate:
      p.userPromotions && p.userPromotions.length > 0 ? p.userPromotions[0].registrationDate : null,
  }));

  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: BOOKING_INCLUDE,
    orderBy: { checkIn: "asc" },
  });

  // Fetch prior usage for all active promotions to ensure lookahead data is available
  // Process sequentially to ensure accurate constraint checks
  for (const booking of bookings) {
    const priorUsage = await fetchPromotionUsage(activePromotions, booking, booking.id);
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
    registrationDate:
      p.userPromotions && p.userPromotions.length > 0 ? p.userPromotions[0].registrationDate : null,
  }));

  // Fetch prior usage for all active promotions to ensure lookahead data is available
  const priorUsage = await fetchPromotionUsage(activePromotions, booking, bookingId);

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

  const allAffectedIds = new Set<string>();

  for (const promotion of promotions) {
    // Find bookings that match the promotion's core criteria or already have it applied
    const affectedBookings = await prisma.booking.findMany({
      where: {
        AND: [
          {
            OR: [
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
            }),
          },
          {
            checkIn: {
              gte: promotion.startDate ?? undefined,
              lte: promotion.endDate ?? undefined,
            },
          },
        ],
      },
      select: { id: true },
    });

    affectedBookings.forEach((b) => allAffectedIds.add(b.id));
  }

  return Array.from(allAffectedIds);
}

/**
 * Re-evaluates and applies promotions for all bookings potentially affected by a promotion change.
 * Minimizes database calls by fetching active promotions once and processing bookings in parallel.
 */
export async function matchPromotionsForAffectedBookings(promotionId: string): Promise<void> {
  const affectedIds = await getAffectedBookingIds([promotionId]);
  await reevaluateBookings(affectedIds);
}
