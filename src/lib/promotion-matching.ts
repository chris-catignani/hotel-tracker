import {
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  Prisma,
} from "@prisma/client";
import prisma from "./prisma";
import { MatchingBooking, MatchingPromotion, MatchingBenefit, MatchingRestrictions } from "./types";
import { certPointsValue } from "./cert-types";

/**
 * Ensures a value is a Date object or null.
 */
function ensureDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string | number | Date);
  return isNaN(d.getTime()) ? null : d;
}

const DEFAULT_EQN_VALUE = 10; // $10 per elite qualifying night

export interface BenefitApplication {
  promotionBenefitId: string;
  appliedValue: number;
  bonusPointsApplied: number;
  eligibleNightsAtBooking: number;
  isOrphaned: boolean;
}

export interface MatchedPromotion {
  promotionId: string;
  appliedValue: number;
  bonusPointsApplied: number;
  eligibleNightsAtBooking: number;
  isOrphaned: boolean;
  benefitApplications: BenefitApplication[];
}

export interface BenefitUsage {
  count: number;
  totalValue: number;
  totalBonusPoints: number;
  eligibleNights?: number;
  totalPotentialStayCount?: number;
  totalPotentialNightCount?: number;
  couldEverMatch?: boolean;
}

export interface PromotionUsage {
  count: number;
  totalValue: number;
  totalBonusPoints: number;
  totalPotentialStayCount?: number;
  totalPotentialNightCount?: number;
  eligibleStayCount?: number;
  eligibleNightCount?: number;
  eligibleStayNights?: number;
  appliedSubBrandIds?: Set<string | null>;
  benefitUsage?: Map<string, BenefitUsage>;
}

export type PromotionUsageMap = Map<string, PromotionUsage>;

type PromotionRule = (
  booking: MatchingBooking,
  promo: MatchingPromotion,
  usage?: PromotionUsage
) => { valid: boolean };

/**
 * Structural Match Rules
 * If these fail, the promotion is irrelevant to this booking context. skip stay.
 */
const StructuralRules: Record<string, PromotionRule> = {
  typeMatch: (booking, promo) => {
    if (promo.type === PromotionType.loyalty && promo.hotelChainId !== booking.hotelChainId) {
      return { valid: false };
    }
    if (promo.type === PromotionType.credit_card && promo.creditCardId !== booking.creditCardId) {
      return { valid: false };
    }
    if (
      promo.type === PromotionType.portal &&
      promo.shoppingPortalId !== booking.shoppingPortalId
    ) {
      return { valid: false };
    }
    return { valid: true };
  },

  hotelChainGate: (booking, promo) => {
    const r = promo.restrictions;
    if (r?.hotelChainId && r.hotelChainId !== booking.hotelChainId) {
      return { valid: false };
    }
    return { valid: true };
  },

  subBrandGate: (booking, promo) => {
    return { valid: checkSubBrandRestrictions(promo.restrictions, booking.hotelChainSubBrandId) };
  },

  dateRange: (booking, promo) => {
    const checkInDate = ensureDate(booking.checkIn)!;
    const registrationDate = ensureDate(promo.registrationDate);
    const validDays = promo.restrictions?.validDaysAfterRegistration;

    if (registrationDate) {
      const windowStart = registrationDate;
      const windowEnd = validDays
        ? new Date(registrationDate.getTime() + validDays * 24 * 60 * 60 * 1000)
        : ensureDate(promo.restrictions?.endDate || promo.endDate);

      if (checkInDate < windowStart) return { valid: false };
      if (windowEnd && checkInDate > windowEnd) return { valid: false };
      return { valid: true };
    }

    const startDate = ensureDate(promo.restrictions?.startDate || promo.startDate);
    const endDate = ensureDate(promo.restrictions?.endDate || promo.endDate);
    if (startDate && checkInDate < startDate) return { valid: false };
    if (endDate && checkInDate > endDate) return { valid: false };
    return { valid: true };
  },

  registrationDeadline: (booking, promo) => {
    const regDate = ensureDate(promo.registrationDate);
    const deadline = ensureDate(promo.restrictions?.registrationDeadline);
    if (regDate && deadline && regDate > deadline) return { valid: false };
    return { valid: true };
  },

  bookByDate: (booking, promo) => {
    const createdAt = ensureDate(booking.createdAt)!;
    const bookBy = ensureDate(promo.restrictions?.bookByDate);
    if (bookBy && createdAt > bookBy) return { valid: false };
    return { valid: true };
  },

  paymentType: (booking, promo) => {
    if (
      promo.restrictions?.allowedPaymentTypes &&
      promo.restrictions.allowedPaymentTypes.length > 0
    ) {
      return {
        valid: checkPaymentTypeRestriction(promo.restrictions.allowedPaymentTypes, booking),
      };
    }
    return { valid: true };
  },

  bookingSource: (booking, promo) => {
    if (
      promo.restrictions?.allowedBookingSources &&
      promo.restrictions.allowedBookingSources.length > 0
    ) {
      return {
        valid: checkBookingSourceRestriction(promo.restrictions.allowedBookingSources, booking),
      };
    }
    return { valid: true };
  },

  tieInCardGate: (booking, promo) => {
    const r = promo.restrictions;
    if (r?.tieInCards && r.tieInCards.length > 0) {
      if (
        booking.creditCardId == null ||
        !r.tieInCards.some((c) => c.creditCardId === booking.creditCardId)
      )
        return { valid: false };
    }
    return { valid: true };
  },
};

/**
 * Fulfillment Rules
 * If these fail for THIS stay, it can still be marked as orphaned if campaign potential is insufficient.
 */
const FulfillmentRules: Record<string, PromotionRule> = {
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
 * Hard Cap Rules
 * These determine if the promotion has reached its limit.
 */
const HardCapRules: Record<string, PromotionRule> = {
  maxStayCount: (booking, promo, usage) => {
    const r = promo.restrictions;
    if (r?.maxStayCount && usage && usage.count >= r.maxStayCount) return { valid: false };
    return { valid: true };
  },

  maxRewardCount: (booking, promo, usage) => {
    const r = promo.restrictions;
    if (r?.maxRewardCount && usage && usage.count >= r.maxRewardCount) return { valid: false };
    return { valid: true };
  },

  oncePerSubBrand: (booking, promo, usage) => {
    const r = promo.restrictions;
    if (
      r?.oncePerSubBrand &&
      usage?.appliedSubBrandIds?.has(booking.hotelChainSubBrandId ?? null)
    ) {
      return { valid: false };
    }
    return { valid: true };
  },

  redemptionCaps: (booking, promo, usage) => {
    const r = promo.restrictions;
    if (!r || !usage) return { valid: true };
    if (r.maxRedemptionValue && usage.totalValue >= Number(r.maxRedemptionValue))
      return { valid: false };
    if (r.maxTotalBonusPoints && usage.totalBonusPoints >= r.maxTotalBonusPoints)
      return { valid: false };
    return { valid: true };
  },
};

/**
 * Helper functions
 */
function checkSubBrandRestrictions(
  restrictions: MatchingRestrictions | null | undefined,
  subBrandId: string | null
): boolean {
  if (!restrictions?.subBrandRestrictions?.length) return true;
  const includeList = restrictions.subBrandRestrictions.filter((s) => s.mode === "include");
  const excludeList = restrictions.subBrandRestrictions.filter((s) => s.mode === "exclude");
  if (includeList.length > 0) return includeList.some((s) => s.hotelChainSubBrandId === subBrandId);
  if (excludeList.length > 0)
    return !excludeList.some((s) => s.hotelChainSubBrandId === subBrandId);
  return true;
}

function checkPaymentTypeRestriction(allowed: string[], booking: MatchingBooking): boolean {
  if (allowed.length === 0) return true;
  const hasCash = Number(booking.pretaxCost) > 0;
  const hasPoints = (booking.pointsRedeemed ?? 0) > 0;
  const hasCert = (booking._count?.certificates ?? 0) > 0;
  if (hasCash && !allowed.includes("cash")) return false;
  if (hasPoints && !allowed.includes("points")) return false;
  if (hasCert && !allowed.includes("cert")) return false;
  return true;
}

function checkBookingSourceRestriction(allowed: string[], booking: MatchingBooking): boolean {
  if (allowed.length === 0) return true;
  return allowed.includes(booking.bookingSource!);
}

function buildPotentialMatchFilter(promo: MatchingPromotion): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  const r = promo.restrictions;
  if (promo.type === PromotionType.loyalty && promo.hotelChainId)
    where.hotelChainId = promo.hotelChainId;
  else if (promo.type === PromotionType.credit_card && promo.creditCardId)
    where.creditCardId = promo.creditCardId;
  else if (promo.type === PromotionType.portal && promo.shoppingPortalId)
    where.shoppingPortalId = promo.shoppingPortalId;

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
    if (Object.keys(idFilter).length > 0) where.hotelChainSubBrand = { id: idFilter };
  }
  if (promo.restrictions?.bookByDate)
    where.createdAt = { lte: new Date(promo.restrictions.bookByDate) };
  if (r?.tieInCards?.length) where.creditCardId = { in: r.tieInCards.map((c) => c.creditCardId) };
  return where;
}

/**
 * API Functions
 */
export async function fetchPromotionUsage(
  promotions: MatchingPromotion[],
  currentBookingCheckIn: Date
): Promise<PromotionUsageMap> {
  const usageMap: PromotionUsageMap = new Map();

  // Find all bookings before the current stay
  const priorBookings = await prisma.booking.findMany({
    where: { checkIn: { lt: currentBookingCheckIn } },
    select: { id: true },
  });
  const priorBookingIds = priorBookings.map((b) => b.id);

  if (priorBookingIds.length === 0) {
    // Fill usage map with 0s for lookahead logic
    for (const promo of promotions) {
      usageMap.set(promo.id, {
        count: 0,
        totalValue: 0,
        totalBonusPoints: 0,
        totalPotentialStayCount: 0,
        totalPotentialNightCount: 0,
        eligibleStayCount: 0,
        eligibleNightCount: 0,
        eligibleStayNights: 0,
        appliedSubBrandIds: new Set(),
        benefitUsage: new Map(),
      });
    }
  } else {
    const usage = await prisma.bookingPromotion.groupBy({
      by: ["promotionId"],
      where: {
        bookingId: { in: priorBookingIds },
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
  }

  for (const promo of promotions) {
    const existing = usageMap.get(promo.id) ?? {
      count: 0,
      totalValue: 0,
      totalBonusPoints: 0,
      benefitUsage: new Map(),
    };
    const potentialFilter = buildPotentialMatchFilter(promo);
    const campaignBookings = await prisma.booking.findMany({
      where: { ...potentialFilter },
      select: { id: true, numNights: true, checkIn: true },
      orderBy: { checkIn: "asc" },
    });

    existing.totalPotentialStayCount = campaignBookings.length;
    existing.totalPotentialNightCount = campaignBookings.reduce((sum, b) => sum + b.numNights, 0);
    const priorCampaignBookings = campaignBookings.filter(
      (b) => new Date(b.checkIn) < new Date(currentBookingCheckIn)
    );
    existing.eligibleStayCount = priorCampaignBookings.length;
    existing.eligibleNightCount = priorCampaignBookings.reduce((sum, b) => sum + b.numNights, 0);

    const fulfilledBookings = await prisma.booking.findMany({
      where: {
        id: { in: priorBookingIds },
        bookingPromotions: { some: { promotionId: promo.id } },
      },
      select: { numNights: true, hotelChainSubBrandId: true },
    });
    existing.eligibleStayNights = fulfilledBookings.reduce((sum, b) => sum + b.numNights, 0);
    existing.appliedSubBrandIds = new Set(fulfilledBookings.map((r) => r.hotelChainSubBrandId));

    const bUsage = await prisma.bookingPromotionBenefit.groupBy({
      by: ["promotionBenefitId"],
      where: {
        bookingPromotion: {
          promotionId: promo.id,
          bookingId: { in: priorBookingIds },
        },
      },
      _count: { id: true },
      _sum: { appliedValue: true, bonusPointsApplied: true },
    });

    for (const row of bUsage) {
      existing.benefitUsage?.set(row.promotionBenefitId, {
        count: row._count.id,
        totalValue: Number(row._sum.appliedValue ?? 0),
        totalBonusPoints: row._sum.bonusPointsApplied ?? 0,
        eligibleNights: existing.eligibleStayNights,
        couldEverMatch: campaignBookings.length > 0,
        totalPotentialNightCount: existing.totalPotentialNightCount,
      });
    }
    usageMap.set(promo.id, existing);
  }
  return usageMap;
}

export async function matchPromotionsForBooking(bookingId: string): Promise<MatchedPromotion[]> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { hotelChain: { include: { pointType: true } } },
  });
  if (!booking) return [];

  const activePromotions = await prisma.promotion.findMany({
    include: {
      restrictions: { include: { subBrandRestrictions: true, tieInCards: true } },
      benefits: {
        include: { restrictions: { include: { subBrandRestrictions: true, tieInCards: true } } },
      },
      tiers: {
        include: {
          benefits: {
            include: {
              restrictions: { include: { subBrandRestrictions: true, tieInCards: true } },
            },
          },
        },
      },
    },
  });

  const priorUsage = await fetchPromotionUsage(
    activePromotions as MatchingPromotion[],
    booking.checkIn
  );
  const matched = calculateMatchedPromotions(
    booking as MatchingBooking,
    activePromotions as MatchingPromotion[],
    priorUsage
  );
  await applyMatchedPromotions(booking.id, matched);
  return matched;
}

export async function reevaluateBookings(bookingIds: string[]): Promise<void> {
  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    orderBy: { checkIn: "asc" },
  });
  for (const booking of bookings) await matchPromotionsForBooking(booking.id);
}

export async function matchPromotionsForAffectedBookings(promotionId: string): Promise<void> {
  const affectedBookingIds = await getAffectedBookingIds([promotionId]);
  await reevaluateBookings(affectedBookingIds);
}

export async function getAffectedBookingIds(promotionIds: string[]): Promise<string[]> {
  const promotions = await prisma.promotion.findMany({ where: { id: { in: promotionIds } } });
  const bookingIds = new Set<string>();
  for (const p of promotions) {
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { hotelChainId: p.hotelChainId ?? undefined },
          { creditCardId: p.creditCardId ?? undefined },
          { shoppingPortalId: p.shoppingPortalId ?? undefined },
          { bookingPromotions: { some: { promotionId: p.id } } },
        ],
      },
      select: { id: true },
    });
    bookings.forEach((b) => bookingIds.add(b.id));
  }
  return Array.from(bookingIds);
}

export function getConstrainedPromotions(promotions: MatchingPromotion[]): MatchingPromotion[] {
  return promotions.filter((p) => {
    const r = p.restrictions;
    const hasPromoLimits =
      r?.maxStayCount != null ||
      r?.maxRewardCount != null ||
      r?.maxRedemptionValue != null ||
      r?.maxTotalBonusPoints != null ||
      r?.oncePerSubBrand === true ||
      r?.minSpend != null ||
      r?.minNightsRequired != null ||
      r?.prerequisiteStayCount != null ||
      r?.prerequisiteNightCount != null ||
      p.tiers.length > 0;
    if (hasPromoLimits) return true;
    return p.benefits.some((b) => {
      const br = b.restrictions;
      return (
        br?.maxRewardCount != null ||
        br?.maxRedemptionValue != null ||
        br?.maxTotalBonusPoints != null ||
        br?.oncePerSubBrand === true ||
        br?.minSpend != null ||
        br?.minNightsRequired != null
      );
    });
  });
}

/**
 * Main Matching Logic
 */
export function calculateMatchedPromotions(
  booking: MatchingBooking,
  activePromotions: MatchingPromotion[],
  priorUsage?: PromotionUsageMap
): MatchedPromotion[] {
  const matched: MatchedPromotion[] = [];

  for (const promo of activePromotions) {
    const usage = priorUsage?.get(promo.id);
    const r = promo.restrictions;

    // 1. Structural Match
    // If any structural rule fails, skip the promotion entirely for this booking.
    const isStructuralMatch = Object.values(StructuralRules).every(
      (rule) => rule(booking, promo, usage).valid
    );
    if (!isStructuralMatch) continue;

    // 2. Fulfillment Status
    let isHardCapHit = Object.values(HardCapRules).some(
      (rule) => !rule(booking, promo, usage).valid
    );

    // Check if we are past the last tier (if tiers exist)
    if (!isHardCapHit && promo.tiers.length > 0) {
      const priorMatchedStays = usage?.eligibleStayCount ?? 0;
      const currentStayNumber = priorMatchedStays + 1;
      const maxTierStays = Math.max(...promo.tiers.map((t) => t.maxStays ?? 0));
      const hasUpperInfiniteTier = promo.tiers.some((t) => t.maxStays === null);
      if (!hasUpperInfiniteTier && currentStayNumber > maxTierStays) {
        isHardCapHit = true;
      }
    }

    const isFulfillmentValid = Object.values(FulfillmentRules).every(
      (rule) => rule(booking, promo, usage).valid
    );
    const isFulfilling = !isHardCapHit && isFulfillmentValid;

    // 3. Orphaned Detection
    let isPromoOrphaned = false;
    const potentialStays = usage?.totalPotentialStayCount ?? 0;
    const potentialNights = usage?.totalPotentialNightCount ?? 0;
    const campaignStays = Math.max(1, potentialStays);
    const campaignNights = Math.max(booking.numNights, potentialNights);

    if (!isFulfilling && !isHardCapHit) {
      // It's a fulfillment failure (Nights, Spend, Prerequisites)
      // Check if it's unfulfillable campaign-wide

      if (r?.spanStays && r.minNightsRequired && campaignNights < r.minNightsRequired)
        isPromoOrphaned = true;
      if (
        !isPromoOrphaned &&
        r?.prerequisiteStayCount &&
        campaignStays < r.prerequisiteStayCount + 1
      )
        isPromoOrphaned = true;
      if (
        !isPromoOrphaned &&
        r?.prerequisiteNightCount &&
        campaignNights < r.prerequisiteNightCount + booking.numNights
      )
        isPromoOrphaned = true;

      if (!isPromoOrphaned) {
        if (!FulfillmentRules.minSpend(booking, promo, usage).valid) {
          if (campaignStays === 1) isPromoOrphaned = true;
        }
        if (
          !isPromoOrphaned &&
          !FulfillmentRules.minNights(booking, promo, usage).valid &&
          !r?.spanStays
        ) {
          if (campaignStays === 1) isPromoOrphaned = true;
        }
        if (!isPromoOrphaned && !FulfillmentRules.prerequisites(booking, promo, usage).valid) {
          isPromoOrphaned = true;
        }
      }
    }

    // Inclusion Check: STRUCTURAL match is always included (per user feedback)
    // This keeps the breakdown clean of noise but shows progress for all relevant promos.

    // Determine Benefits
    let activeBenefits: MatchingBenefit[] = [];
    if (promo.tiers.length > 0) {
      const priorMatchedStays = usage?.eligibleStayCount ?? 0;
      const currentStayNumber = priorMatchedStays + 1;
      const applicableTier = promo.tiers.find((t) => {
        if (t.minStays !== null && currentStayNumber < t.minStays) return false;
        if (t.maxStays !== null && currentStayNumber > t.maxStays) return false;
        return true;
      });
      if (!applicableTier) {
        // If no tier matches the current stay number, show the first tier as Pending/Orphaned
        activeBenefits = promo.tiers[0].benefits;
        if (!isHardCapHit && potentialStays < (promo.tiers[0].minStays ?? 0)) {
          isPromoOrphaned = true;
        }
      } else activeBenefits = applicableTier.benefits;
    } else activeBenefits = promo.benefits;

    const benefitApplications: BenefitApplication[] = [];
    const centsPerPoint = booking.hotelChain?.pointType?.centsPerPoint
      ? Number(booking.hotelChain.pointType.centsPerPoint)
      : 0.01;

    for (const b of activeBenefits) {
      const br = b.restrictions;
      const bUsage = usage?.benefitUsage?.get(b.id);
      const tempPromo: MatchingPromotion = {
        ...promo,
        restrictions: br
          ? { ...promo.restrictions, ...br }
          : (promo.restrictions as MatchingRestrictions),
      };

      // 1. Benefit structural match (Hard Skip if mismatch)
      const isBStructuralMatch = Object.values(StructuralRules).every(
        (rule) => rule(booking, tempPromo, usage).valid
      );
      if (!isBStructuralMatch) continue;

      const isBHardCapHit = Object.values(HardCapRules).some(
        (rule) => !rule(booking, tempPromo, usage).valid
      );
      const isBFulfillmentValid = Object.values(FulfillmentRules).every(
        (rule) => rule(booking, tempPromo, usage).valid
      );
      const isBFulfilling = !isBHardCapHit && isBFulfillmentValid;

      let appliedValue = 0;
      let bonusPointsApplied = 0;

      // We calculate value if it's fulfilling OR if it's pending (fulfillable)
      // Hard caps always result in 0 value.
      if (!isHardCapHit && !isBHardCapHit) {
        const benefitValue = Number(b.value);
        switch (b.rewardType) {
          case PromotionRewardType.cashback:
            appliedValue =
              b.valueType === PromotionBenefitValueType.fixed
                ? benefitValue
                : (Number(booking.totalCost) * benefitValue) / 100;
            break;
          case PromotionRewardType.points:
            const isBaseOnly = !b.pointsMultiplierBasis || b.pointsMultiplierBasis === "base_only";
            const baseRate = booking.hotelChain?.basePointRate;
            const basisPoints =
              isBaseOnly && baseRate != null
                ? Number(booking.pretaxCost) * Number(baseRate)
                : Number(booking.loyaltyPointsEarned || 0);
            appliedValue =
              b.valueType === PromotionBenefitValueType.multiplier
                ? basisPoints * (benefitValue - 1) * centsPerPoint
                : benefitValue * centsPerPoint;
            bonusPointsApplied =
              b.valueType === PromotionBenefitValueType.multiplier
                ? Math.round(basisPoints * (benefitValue - 1))
                : Math.round(benefitValue);
            break;
          case PromotionRewardType.certificate:
            appliedValue = b.certType ? certPointsValue(b.certType) * centsPerPoint * 0.7 : 0;
            break;
          case PromotionRewardType.eqn:
            appliedValue = benefitValue * DEFAULT_EQN_VALUE;
            break;
        }

        // Scaling logic (apply even if not currently fulfilling, as long as it's fulfillable)
        const isStackable = br?.nightsStackable || r?.nightsStackable;
        const isSpannable = br?.spanStays || r?.spanStays;
        const minReq = br?.minNightsRequired ?? r?.minNightsRequired;

        if ((isStackable || isSpannable) && minReq) {
          const mult = isStackable
            ? booking.numNights / minReq
            : Math.min(1, booking.numNights / minReq);
          appliedValue *= mult;
          bonusPointsApplied = Math.round(bonusPointsApplied * mult);
        } else if (!isFulfilling || !isBFulfilling) {
          // If not fulfilling and not stackable/spannable, value is 0
          appliedValue = 0;
          bonusPointsApplied = 0;
        }

        // Benefit-level caps
        if (br?.maxRedemptionValue && appliedValue > 0) {
          const rem = Math.max(0, Number(br.maxRedemptionValue) - (bUsage?.totalValue ?? 0));
          if (appliedValue > rem) {
            const ratio = rem / appliedValue;
            appliedValue = rem;
            bonusPointsApplied = Math.round(bonusPointsApplied * ratio);
          }
        }
        if (br?.maxTotalBonusPoints && bonusPointsApplied > 0) {
          const rem = Math.max(0, br.maxTotalBonusPoints - (bUsage?.totalBonusPoints ?? 0));
          if (bonusPointsApplied > rem) {
            const ratio = rem / bonusPointsApplied;
            appliedValue *= ratio;
            bonusPointsApplied = rem;
          }
        }
      }

      let isBenefitOrphaned = isPromoOrphaned;
      if (!isBenefitOrphaned && !isBFulfilling && !isBHardCapHit && !isHardCapHit) {
        // If it's a fulfillment failure for this benefit, check if it's unfulfillable
        if (campaignStays === 1) isBenefitOrphaned = true;
      }

      const isBMaxedOut = isBHardCapHit || isHardCapHit;
      if (isBMaxedOut) isBenefitOrphaned = false;

      benefitApplications.push({
        promotionBenefitId: b.id,
        appliedValue,
        bonusPointsApplied,
        eligibleNightsAtBooking: (bUsage?.eligibleNights ?? 0) + booking.numNights,
        isOrphaned: isBenefitOrphaned,
      });
    }

    if (benefitApplications.length === 0) continue;

    let totalAppliedValue = benefitApplications.reduce((sum, ba) => sum + ba.appliedValue, 0);
    let totalBonusPoints = benefitApplications.reduce((sum, ba) => sum + ba.bonusPointsApplied, 0);

    // Caps with proportional scaling for bonus points
    if (r?.maxRedemptionValue && totalAppliedValue > 0) {
      const rem = Math.max(0, Number(r.maxRedemptionValue) - (usage?.totalValue ?? 0));
      if (totalAppliedValue > rem) {
        const ratio = rem / totalAppliedValue;
        benefitApplications.forEach((ba) => {
          ba.appliedValue *= ratio;
          ba.bonusPointsApplied = Math.round(ba.bonusPointsApplied * ratio);
        });
        totalAppliedValue = rem;
        totalBonusPoints = benefitApplications.reduce((sum, ba) => sum + ba.bonusPointsApplied, 0);
      }
    }
    if (r?.maxTotalBonusPoints && totalBonusPoints > 0) {
      const rem = Math.max(0, r.maxTotalBonusPoints - (usage?.totalBonusPoints ?? 0));
      if (totalBonusPoints > rem) {
        const ratio = rem / totalBonusPoints;
        benefitApplications.forEach((ba) => {
          ba.appliedValue *= ratio;
          ba.bonusPointsApplied = Math.round(ba.bonusPointsApplied * ratio);
        });
        totalBonusPoints = rem;
        totalAppliedValue = benefitApplications.reduce((sum, ba) => sum + ba.appliedValue, 0);
      }
    }

    matched.push({
      promotionId: promo.id,
      appliedValue: totalAppliedValue,
      bonusPointsApplied: Math.round(totalBonusPoints),
      eligibleNightsAtBooking: (usage?.eligibleStayNights ?? 0) + booking.numNights,
      isOrphaned: isPromoOrphaned || benefitApplications.every((ba) => ba.isOrphaned),
      benefitApplications,
    });
  }
  return matched;
}

async function applyMatchedPromotions(bookingId: string, matched: MatchedPromotion[]) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return [];
  await prisma.bookingPromotion.deleteMany({ where: { bookingId, autoApplied: true } });
  const createdRecords = [];
  for (const match of matched) {
    try {
      const record = await prisma.bookingPromotion.create({
        data: {
          bookingId,
          promotionId: match.promotionId,
          appliedValue: match.appliedValue,
          bonusPointsApplied: match.bonusPointsApplied,
          eligibleNightsAtBooking: match.eligibleNightsAtBooking,
          isOrphaned: match.isOrphaned,
          benefitApplications: {
            create: match.benefitApplications.map((ba) => ({
              promotionBenefitId: ba.promotionBenefitId,
              appliedValue: ba.appliedValue,
              bonusPointsApplied: ba.bonusPointsApplied,
              eligibleNightsAtBooking: ba.eligibleNightsAtBooking,
              isOrphaned: ba.isOrphaned,
            })),
          },
        },
      });
      createdRecords.push(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2025" || error.code === "P2003")
      )
        continue;
      throw error;
    }
  }
  return createdRecords;
}
