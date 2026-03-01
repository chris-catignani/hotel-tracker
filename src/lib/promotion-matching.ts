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
    { count: number; totalValue: number; totalBonusPoints: number; eligibleNights?: number }
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
  creditCardId: string | null;
  shoppingPortalId: string | null;
  hotelChainId: string | null;
  hotelChainSubBrandId: string | null;
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

interface MatchingPromotion {
  id: string;
  type: PromotionType;
  creditCardId: string | null;
  shoppingPortalId: string | null;
  hotelChainId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
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
}

interface MatchedPromotion {
  promotionId: string;
  appliedValue: number;
  bonusPointsApplied: number;
  eligibleNightsAtBooking?: number;
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

const PromotionRules: Record<string, PromotionRule> = {
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

  tieInCard: (booking, promo) => {
    if (promo.restrictions?.tieInCards && promo.restrictions.tieInCards.length > 0) {
      const cardMatches =
        booking.creditCardId != null &&
        promo.restrictions.tieInCards.some((c) => c.creditCardId === booking.creditCardId);
      return { valid: cardMatches };
    }
    return { valid: true };
  },

  usageCaps: (booking, promo, usage) => {
    if (
      promo.restrictions?.maxStayCount &&
      usage &&
      usage.count >= promo.restrictions.maxStayCount
    ) {
      return { valid: false };
    }
    if (promo.restrictions?.oncePerSubBrand) {
      if (usage?.appliedSubBrandIds?.has(booking.hotelChainSubBrandId ?? null)) {
        return { valid: false };
      }
    }
    return { valid: true };
  },

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

    // Run all validation rules
    const isValid = Object.values(PromotionRules).every((rule) => {
      return rule(booking, promo, usage).valid;
    });

    if (!isValid) continue;

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

      if (!applicableTier) continue;
      activeBenefits = applicableTier.benefits;
    } else {
      activeBenefits = promo.benefits;
    }

    // Per-benefit filtering
    const eligibleBenefits = activeBenefits.filter((b) => {
      const br = b.restrictions;
      if (!br) return true;

      if (!checkSubBrandRestrictions(br, booking.hotelChainSubBrandId)) return false;
      if (br.tieInCards.length > 0) {
        const cardMatches =
          booking.creditCardId != null &&
          br.tieInCards.some((c) => c.creditCardId === booking.creditCardId);
        if (!cardMatches) return false;
      }
      if (
        br.oncePerSubBrand &&
        usage?.appliedSubBrandIds?.has(booking.hotelChainSubBrandId ?? null)
      ) {
        return false;
      }
      if (br.allowedPaymentTypes && !checkPaymentTypeRestriction(br.allowedPaymentTypes, booking)) {
        return false;
      }
      if (br.minNightsRequired && booking.numNights < br.minNightsRequired && !br.spanStays) {
        return false;
      }
      if (br.minSpend != null && Number(booking.totalCost) < Number(br.minSpend)) return false;
      if (br.maxRewardCount) {
        const benefitCount = usage?.benefitUsage?.get(b.id)?.count ?? 0;
        if (benefitCount >= br.maxRewardCount) return false;
      }

      return true;
    });

    if (eligibleBenefits.length === 0) continue;

    // Calculate applied value per benefit
    const centsPerPoint = booking.hotelChain?.pointType?.centsPerPoint
      ? Number(booking.hotelChain.pointType.centsPerPoint)
      : 0.01;

    const benefitApplications: BenefitApplication[] = [];
    let totalAppliedValue = 0;
    let totalBonusPoints = 0;

    for (const benefit of eligibleBenefits) {
      const benefitValue = Number(benefit.value);
      let appliedValue = 0;
      let benefitBonusPoints = 0;

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
      const r = promo.restrictions;
      const br = benefit.restrictions;

      const promoIsStacked = r?.nightsStackable && r?.minNightsRequired && r.minNightsRequired > 0;
      const promoIsSpanned = r?.spanStays && r?.minNightsRequired && r.minNightsRequired > 0;

      // Benefit-level scaling (only if not already scaled at promo-level)
      if (!promoIsStacked && !promoIsSpanned && br?.minNightsRequired && br.minNightsRequired > 0) {
        if (br.spanStays || br.nightsStackable) {
          const divisor = br.minNightsRequired;
          const multiplier = br.spanStays
            ? booking.numNights / divisor
            : Math.floor(booking.numNights / divisor);
          appliedValue *= multiplier;
          benefitBonusPoints *= multiplier;
        }
      }

      // Benefit-level caps
      if (br?.maxRedemptionValue) {
        const maxValue = Number(br.maxRedemptionValue);
        const priorValue = usage?.benefitUsage?.get(benefit.id)?.totalValue ?? 0;
        const remainingCapacity = Math.max(0, maxValue - priorValue);
        if (remainingCapacity < appliedValue) {
          const ratio = appliedValue > 0 ? remainingCapacity / appliedValue : 0;
          appliedValue = remainingCapacity;
          benefitBonusPoints = Math.round(benefitBonusPoints * ratio);
        }
      }

      if (br?.maxTotalBonusPoints) {
        const maxPoints = br.maxTotalBonusPoints;
        const priorPoints = usage?.benefitUsage?.get(benefit.id)?.totalBonusPoints ?? 0;
        const remainingPoints = Math.max(0, maxPoints - priorPoints);
        if (remainingPoints < benefitBonusPoints) {
          const ratio = benefitBonusPoints > 0 ? remainingPoints / benefitBonusPoints : 0;
          appliedValue *= ratio;
          benefitBonusPoints = Math.round(remainingPoints);
        }
      }

      benefitApplications.push({
        promotionBenefitId: benefit.id,
        appliedValue,
        bonusPointsApplied: Math.round(benefitBonusPoints),
        eligibleNightsAtBooking:
          (usage?.benefitUsage?.get(benefit.id)?.eligibleNights ?? 0) + booking.numNights,
      });

      totalAppliedValue += appliedValue;
      totalBonusPoints += benefitBonusPoints;
    }

    // Promotion-level scaling (Stackable / Span Stays)
    const r = promo.restrictions;
    if (r?.minNightsRequired && r.minNightsRequired > 0) {
      if (r.spanStays || r.nightsStackable) {
        const multiplier = r.spanStays
          ? booking.numNights / r.minNightsRequired
          : Math.floor(booking.numNights / r.minNightsRequired);

        totalAppliedValue *= multiplier;
        totalBonusPoints *= multiplier;
        for (const ba of benefitApplications) {
          ba.appliedValue *= multiplier;
          ba.bonusPointsApplied = Math.round(ba.bonusPointsApplied * multiplier);
        }
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

    matched.push({
      promotionId: promo.id,
      appliedValue: totalAppliedValue,
      bonusPointsApplied: Math.round(totalBonusPoints),
      eligibleNightsAtBooking: (usage?.eligibleStayNights ?? 0) + booking.numNights,
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
        benefitApplications: {
          create: match.benefitApplications.map((ba) => ({
            promotionBenefitId: ba.promotionBenefitId,
            appliedValue: ba.appliedValue,
            bonusPointsApplied: ba.bonusPointsApplied > 0 ? ba.bonusPointsApplied : null,
            eligibleNightsAtBooking: ba.eligibleNightsAtBooking,
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
    // This is because numNights is on the booking, not the benefit application
    const benefitNights = await prisma.bookingPromotionBenefit.findMany({
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
      select: {
        promotionBenefitId: true,
        bookingPromotion: {
          select: {
            booking: {
              select: {
                numNights: true,
              },
            },
          },
        },
      },
    });

    const nightsMap = new Map<string, number>();
    for (const bn of benefitNights) {
      if (bn.bookingPromotion?.booking) {
        const current = nightsMap.get(bn.promotionBenefitId) ?? 0;
        nightsMap.set(bn.promotionBenefitId, current + bn.bookingPromotion.booking.numNights);
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
        hotelChainId: promo.type === PromotionType.loyalty ? promo.hotelChainId : undefined,
        creditCardId: promo.type === PromotionType.credit_card ? promo.creditCardId : undefined,
        shoppingPortalId: promo.type === PromotionType.portal ? promo.shoppingPortalId : undefined,
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
      p.restrictions?.maxStayCount ||
      p.restrictions?.maxRewardCount ||
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
      where: { isActive: true },
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
      where: { isActive: true },
      include: PROMOTIONS_INCLUDE,
    })
  ).map((p) => ({
    ...p,
    registrationDate:
      p.userPromotions && p.userPromotions.length > 0 ? p.userPromotions[0].registrationDate : null,
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
 * Re-evaluates and applies promotions for all bookings potentially affected by a promotion change.
 * Minimizes database calls by fetching active promotions once and processing bookings in parallel.
 */
export async function matchPromotionsForAffectedBookings(promotionId: string): Promise<void> {
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
  });

  if (!promotion) return;

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
            // Remove conditions that are undefined/null to avoid matching everything
            const firstKey = Object.keys(condition)[0] as keyof typeof condition;
            const value = condition[firstKey];
            return value !== undefined && value !== null;
          }),
        },
        // Date range filtering: only bookings that could potentially match the promotion
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

  await reevaluateBookings(affectedBookings.map((b) => b.id));
}
