import prisma from "@/lib/prisma";
import { PromotionType, Prisma } from "@prisma/client";
import {
  type MatchingBooking,
  type MatchingPromotion,
  type MatchingRestrictions,
  type PromotionUsageMap,
} from "./promotion-matching";

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
    userCreditCard:
      promo.type === PromotionType.credit_card && promo.creditCardId
        ? { creditCardId: promo.creditCardId }
        : undefined,
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
    where.userCreditCard = { creditCardId: { in: r.tieInCards.map((c) => c.creditCardId) } };
  }

  return where;
}

/**
 * Fetches prior usage statistics for promotions with redemption constraints.
 */
export async function fetchPromotionUsage(
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
        eligibleNights: 0,
        couldEverMatch: false,
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
        userCreditCard:
          promo.type === PromotionType.credit_card && promo.creditCardId
            ? { creditCardId: promo.creditCardId }
            : undefined,
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
