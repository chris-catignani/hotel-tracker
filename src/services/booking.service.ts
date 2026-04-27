import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/app-error";
import {
  getConstrainedPromotions,
  type MatchingPromotion,
  type MatchingBooking,
} from "@/lib/promotion-matching";
import { PRICE_WATCH_PRIORITY } from "@/lib/constants";
import { fetchPromotionUsage } from "@/services/promotion-usage";
import {
  enrichBookingWithPartnerships,
  enrichBookingsWithPartnerships,
  enrichBookingWithRate,
} from "@/services/booking-enrichment";
import { normalizeUserStatuses } from "@/lib/normalize-response";
import {
  matchPromotionsForBooking,
  reevaluateSubsequentBookings,
  reevaluateBookings,
} from "@/services/promotion-apply";
import {
  reapplyCardBenefitsAffectedByBooking,
  reapplyBenefitForPeriod,
} from "@/services/card-benefit-apply";
import { resolveBookingFinancials } from "@/services/booking-financials";
import { validateBenefits } from "@/services/booking-benefit-validation";
import { findOrCreateProperty } from "@/services/property-utils";
import {
  fetchExchangeRate,
  getOrFetchHistoricalRate,
  getCurrentRate,
  resolveCalcCurrencyRate,
} from "@/services/exchange-rate";
import { calculatePoints, resolveBasePointRate } from "@/lib/loyalty-utils";
import {
  CertType,
  BenefitType,
  BenefitPointsEarnType,
  AccommodationType,
  IngestionMethod,
  PostingStatus,
  PaymentTiming,
  BookingSourceType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface BenefitInput {
  id?: string;
  benefitType: string;
  label?: string;
  dollarValue?: number | null;
  pointsEarnType?: string | null;
  pointsAmount?: number | null;
  pointsMultiplier?: number | null;
}

export interface CreateBookingInput {
  accommodationType?: string;
  hotelChainId?: string;
  propertyId?: string;
  propertyName?: string;
  placeId?: string;
  countryCode?: string;
  city?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: number;
  taxAmount: number;
  totalCost: number;
  userCreditCardId?: string;
  bookingDate?: string;
  paymentTiming?: string;
  shoppingPortalId?: string;
  portalCashbackRate?: number | null;
  portalCashbackOnTotal?: boolean;
  loyaltyPointsEarned?: number | null;
  pointsRedeemed?: number | null;
  currency?: string;
  certificates?: string[];
  bookingSource?: string;
  otaAgencyId?: string;
  benefits?: BenefitInput[];
  notes?: string;
  hotelChainSubBrandId?: string;
  confirmationNumber?: string;
  needsReview?: boolean;
  ingestionMethod?: string;
}

export interface UpdateBookingInput {
  accommodationType?: string;
  hotelChainId?: string | null;
  propertyId?: string;
  propertyName?: string;
  placeId?: string;
  countryCode?: string;
  city?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  checkIn?: string;
  checkOut?: string;
  numNights?: number;
  pretaxCost?: number;
  taxAmount?: number;
  totalCost?: number;
  userCreditCardId?: string | null;
  bookingDate?: string | null;
  paymentTiming?: string;
  shoppingPortalId?: string | null;
  portalCashbackRate?: number | null;
  portalCashbackOnTotal?: boolean;
  loyaltyPointsEarned?: number | null;
  pointsRedeemed?: number | null;
  currency?: string;
  certificates?: string[];
  bookingSource?: string | null;
  otaAgencyId?: string | null;
  benefits?: BenefitInput[];
  notes?: string | null;
  hotelChainSubBrandId?: string | null;
  confirmationNumber?: string | null;
}

export interface PatchBookingInput {
  needsReview?: boolean;
  loyaltyPostingStatus?: PostingStatus | null;
  cardRewardPostingStatus?: PostingStatus | null;
  portalCashbackPostingStatus?: PostingStatus | null;
}

export interface PostBookingCreateMetadata {
  userId: string;
  accommodationType: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  totalCost: number;
  currency: string;
  ingestionMethod: string;
}

// ---------------------------------------------------------------------------
// Shared include shape
// ---------------------------------------------------------------------------

const BOOKING_INCLUDE = (userId: string) =>
  ({
    hotelChain: {
      include: {
        pointType: true,
        userStatuses: {
          where: { userId },
          include: { eliteStatus: true },
          take: 1,
        },
      },
    },
    hotelChainSubBrand: true,
    userCreditCard: {
      include: { creditCard: { include: { pointType: true, rewardRules: true } } },
    },
    shoppingPortal: { include: { pointType: true } },
    bookingPromotions: {
      include: {
        promotion: {
          include: {
            restrictions: {
              include: {
                subBrandRestrictions: true,
                tieInCards: true,
              },
            },
            benefits: { orderBy: { sortOrder: "asc" } },
            tiers: {
              include: {
                benefits: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        benefitApplications: {
          include: {
            promotionBenefit: {
              include: {
                restrictions: {
                  include: {
                    subBrandRestrictions: true,
                    tieInCards: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    certificates: true,
    otaAgency: true,
    benefits: true,
    property: true,
    priceWatchBookings: {
      where: { priceWatch: { priority: PRICE_WATCH_PRIORITY.ANCHOR } },
      include: { priceWatch: { select: { isEnabled: true } } },
      take: 1,
    },
    bookingCardBenefits: { include: { cardBenefit: true } },
    bookingPartnershipEarnStatuses: true,
  }) as const;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

export function derivePostingStatusesForCreate(data: {
  loyaltyPointsEarned: number | null | undefined;
  accommodationType: string;
  hotelChainId: string | null | undefined;
  userCreditCardId: string | null | undefined;
  shoppingPortalId: string | null | undefined;
}) {
  return {
    loyaltyPostingStatus:
      data.loyaltyPointsEarned != null &&
      data.loyaltyPointsEarned > 0 &&
      data.accommodationType !== AccommodationType.apartment &&
      data.hotelChainId != null
        ? ("pending" as const)
        : null,
    cardRewardPostingStatus: data.userCreditCardId != null ? ("pending" as const) : null,
    portalCashbackPostingStatus: data.shoppingPortalId != null ? ("pending" as const) : null,
  };
}

export function derivePostingStatusesForUpdate(
  data: Record<string, unknown>,
  current: {
    loyaltyPointsEarned: unknown;
    accommodationType: string;
    hotelChainId: string | null;
    userCreditCardId: string | null;
    shoppingPortalId: string | null;
    loyaltyPostingStatus: PostingStatus | null;
    cardRewardPostingStatus: PostingStatus | null;
    portalCashbackPostingStatus: PostingStatus | null;
  },
  input: UpdateBookingInput
) {
  // --- loyaltyPostingStatus ---
  const finalLoyaltyPoints =
    input.loyaltyPointsEarned !== undefined
      ? (data.loyaltyPointsEarned as number | null | undefined)
      : current.loyaltyPointsEarned != null
        ? Number(current.loyaltyPointsEarned)
        : null;
  const finalAccommodationType =
    (data.accommodationType as string | undefined) ?? current.accommodationType;
  const finalHotelChainId =
    input.hotelChainId !== undefined
      ? (data.hotelChainId as string | null | undefined)
      : current.hotelChainId;

  const loyaltyEligible =
    finalLoyaltyPoints != null &&
    finalLoyaltyPoints > 0 &&
    finalAccommodationType !== AccommodationType.apartment &&
    finalHotelChainId != null;

  let loyaltyPostingStatus: PostingStatus | null;
  if (!loyaltyEligible) {
    loyaltyPostingStatus = null;
  } else {
    const loyaltyChanged =
      (input.loyaltyPointsEarned !== undefined &&
        Number(input.loyaltyPointsEarned || null) !==
          (current.loyaltyPointsEarned != null ? Number(current.loyaltyPointsEarned) : null)) ||
      (input.accommodationType !== undefined &&
        input.accommodationType !== current.accommodationType) ||
      (input.hotelChainId !== undefined && input.hotelChainId !== current.hotelChainId);
    loyaltyPostingStatus = loyaltyChanged ? "pending" : (current.loyaltyPostingStatus ?? "pending");
  }

  // --- cardRewardPostingStatus ---
  const finalUserCreditCardId =
    input.userCreditCardId !== undefined
      ? (data.userCreditCardId as string | null | undefined)
      : current.userCreditCardId;

  let cardRewardPostingStatus: PostingStatus | null;
  if (finalUserCreditCardId == null) {
    cardRewardPostingStatus = null;
  } else if (
    input.userCreditCardId !== undefined &&
    input.userCreditCardId !== current.userCreditCardId
  ) {
    cardRewardPostingStatus = "pending";
  } else {
    cardRewardPostingStatus = current.cardRewardPostingStatus ?? "pending";
  }

  // --- portalCashbackPostingStatus ---
  const finalShoppingPortalId =
    input.shoppingPortalId !== undefined
      ? (data.shoppingPortalId as string | null | undefined)
      : current.shoppingPortalId;

  let portalCashbackPostingStatus: PostingStatus | null;
  if (finalShoppingPortalId == null) {
    portalCashbackPostingStatus = null;
  } else if (
    input.shoppingPortalId !== undefined &&
    input.shoppingPortalId !== current.shoppingPortalId
  ) {
    portalCashbackPostingStatus = "pending";
  } else {
    portalCashbackPostingStatus = current.portalCashbackPostingStatus ?? "pending";
  }

  return { loyaltyPostingStatus, cardRewardPostingStatus, portalCashbackPostingStatus };
}

async function getBookingWithUsage(id: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id, userId },
    include: BOOKING_INCLUDE(userId),
  });

  if (!booking) return null;

  const promotions = booking.bookingPromotions.map((bp) => ({
    ...bp.promotion,
    registrationDate: null,
  })) as unknown as MatchingPromotion[];
  const constrainedPromos = getConstrainedPromotions(promotions);
  const usageMap = await fetchPromotionUsage(
    constrainedPromos,
    booking as unknown as MatchingBooking,
    userId,
    booking.id
  );

  const enhancedBookingPromotions = booking.bookingPromotions.map((bp) => {
    const usage = usageMap.get(bp.promotionId);
    if (!usage) return bp;
    return {
      ...bp,
      eligibleStayCount: (usage.eligibleStayCount ?? 0) + 1,
      eligibleNightCount: (usage.eligibleNightCount ?? 0) + booking.numNights,
      benefitApplications: bp.benefitApplications.map((ba) => {
        const bUsage = usage.benefitUsage?.get(ba.promotionBenefitId);
        return {
          ...ba,
          eligibleStayCount: (usage.eligibleStayCount ?? 0) + 1,
          eligibleNightCount: (bUsage?.eligibleNights ?? 0) + booking.numNights,
        };
      }),
    };
  });

  return enrichBookingWithPartnerships(
    { ...booking, bookingPromotions: enhancedBookingPromotions },
    userId
  );
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

export async function runPostBookingCreate(
  bookingId: string,
  metadata: PostBookingCreateMetadata
): Promise<void> {
  const { userId } = metadata;
  const appliedPromoIds = await matchPromotionsForBooking(bookingId, userId);

  logger.info("booking:created", {
    bookingId,
    promotionsApplied: appliedPromoIds.length,
    ...metadata,
  });

  await reevaluateSubsequentBookings(bookingId, userId, appliedPromoIds);
  await reapplyCardBenefitsAffectedByBooking(bookingId);
}

export async function getBooking(id: string, userId: string) {
  const booking = await getBookingWithUsage(id, userId);
  if (!booking) throw new AppError("Booking not found", 404);
  return booking;
}

export async function listBookings(userId: string, filter?: string | null) {
  const whereClause =
    filter === "needs-attention"
      ? {
          userId,
          OR: [
            {
              checkIn: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
              OR: [
                { loyaltyPostingStatus: { not: null } },
                { cardRewardPostingStatus: { not: null } },
                { portalCashbackPostingStatus: { not: null } },
                { bookingPromotions: { some: {} } },
                { bookingCardBenefits: { some: {} } },
                { benefits: { some: {} } },
                { bookingPartnershipEarnStatuses: { some: {} } },
              ],
            },
            { loyaltyPostingStatus: "pending" as const },
            { cardRewardPostingStatus: "pending" as const },
            { portalCashbackPostingStatus: "pending" as const },
            {
              bookingPromotions: {
                some: { postingStatus: "pending" as const, appliedValue: { gt: 0 } },
              },
            },
            { bookingCardBenefits: { some: { postingStatus: "pending" as const } } },
            { benefits: { some: { postingStatus: "pending" as const } } },
            {
              bookingPartnershipEarnStatuses: {
                some: { postingStatus: "pending" as const },
              },
            },
          ],
        }
      : { userId };

  const bookings = await prisma.booking.findMany({
    where: whereClause,
    include: BOOKING_INCLUDE(userId),
    orderBy: { checkIn: "asc" },
  });

  return enrichBookingsWithPartnerships(bookings, userId);
}

export async function createBooking(userId: string, input: CreateBookingInput) {
  const resolvedCurrency = input.currency || "USD";

  // Resolve propertyId: use provided id, or find/create from geo fields
  let propertyId: string | undefined = input.propertyId;
  if (!propertyId && input.propertyName) {
    propertyId = await findOrCreateProperty({
      propertyName: input.propertyName,
      placeId: input.placeId ?? null,
      hotelChainId: input.hotelChainId || null,
      countryCode: input.countryCode ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    });
  }
  if (!propertyId) throw new AppError("Property ID or Property Name is required", 400);

  const userProvidedPoints =
    input.loyaltyPointsEarned != null ? Number(input.loyaltyPointsEarned) : undefined;

  const financials = await resolveBookingFinancials({
    checkIn: input.checkIn,
    currency: resolvedCurrency,
    hotelChainId: input.hotelChainId || null,
    hotelChainSubBrandId: input.hotelChainSubBrandId || null,
    pretaxCost: userProvidedPoints == null && input.pretaxCost ? Number(input.pretaxCost) : null,
    userId,
  });

  const calculatedPoints = userProvidedPoints ?? financials.loyaltyPointsEarned;

  const benefitValidationError = await validateBenefits(
    input.benefits ?? [],
    input.hotelChainId ?? null
  );
  if (benefitValidationError) throw new AppError(benefitValidationError, 400);

  const postingStatuses = derivePostingStatusesForCreate({
    loyaltyPointsEarned: calculatedPoints,
    accommodationType: input.accommodationType ?? "hotel",
    hotelChainId: input.hotelChainId || null,
    userCreditCardId: input.userCreditCardId || null,
    shoppingPortalId: input.shoppingPortalId || null,
  });

  const booking = await prisma.booking.create({
    data: {
      userId,
      accommodationType: (input.accommodationType ?? "hotel") as AccommodationType,
      hotelChainId: input.hotelChainId || null,
      hotelChainSubBrandId: input.hotelChainSubBrandId || null,
      propertyId,
      checkIn: new Date(input.checkIn),
      checkOut: new Date(input.checkOut),
      numNights: Number(input.numNights),
      pretaxCost: Number(input.pretaxCost),
      taxAmount: Number(input.taxAmount),
      totalCost: Number(input.totalCost),
      userCreditCardId: input.userCreditCardId || null,
      bookingDate: input.bookingDate ? new Date(input.bookingDate) : null,
      paymentTiming: (input.paymentTiming || "postpaid") as PaymentTiming,
      shoppingPortalId: input.shoppingPortalId || null,
      portalCashbackRate: input.portalCashbackRate ? Number(input.portalCashbackRate) : null,
      portalCashbackOnTotal: input.portalCashbackOnTotal ?? false,
      loyaltyPointsEarned: calculatedPoints,
      pointsRedeemed: input.pointsRedeemed ? Number(input.pointsRedeemed) : null,
      currency: resolvedCurrency,
      lockedExchangeRate: financials.lockedExchangeRate,
      lockedLoyaltyUsdCentsPerPoint: financials.lockedLoyaltyUsdCentsPerPoint,
      notes: input.notes || null,
      confirmationNumber: input.confirmationNumber ?? null,
      needsReview: input.needsReview ?? false,
      ingestionMethod: (input.ingestionMethod ?? "manual") as IngestionMethod,
      bookingSource: (input.bookingSource || null) as BookingSourceType | null,
      otaAgencyId: input.bookingSource === "ota" && input.otaAgencyId ? input.otaAgencyId : null,
      certificates: input.certificates?.length
        ? { create: (input.certificates as string[]).map((v) => ({ certType: v as CertType })) }
        : undefined,
      benefits: input.benefits?.length
        ? {
            create: input.benefits
              .filter((b) => b.benefitType)
              .map((b) => ({
                benefitType: b.benefitType as BenefitType,
                label: b.label || null,
                dollarValue: b.dollarValue != null ? Number(b.dollarValue) : null,
                pointsEarnType: (b.pointsEarnType as BenefitPointsEarnType) || null,
                pointsAmount: b.pointsAmount != null ? Number(b.pointsAmount) : null,
                pointsMultiplier: b.pointsMultiplier != null ? Number(b.pointsMultiplier) : null,
              })),
          }
        : undefined,
      ...postingStatuses,
    },
  });

  await runPostBookingCreate(booking.id, {
    userId,
    accommodationType: (input.accommodationType ?? "hotel") as string,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    numNights: Number(input.numNights),
    totalCost: Number(input.totalCost),
    currency: resolvedCurrency,
    ingestionMethod: (input.ingestionMethod ?? "manual") as string,
  });

  const fullBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: BOOKING_INCLUDE(userId),
  });

  const normalized = normalizeUserStatuses(fullBooking) as typeof fullBooking;
  return normalized ? await enrichBookingWithRate(normalized) : null;
}

/**
 * Given an incoming list of benefit objects (from the form), fetches the existing DB rows
 * for this booking and returns the incoming list annotated with the preserved postingStatus
 * for each benefit that has a matching DB id. New benefits (no id) get "pending".
 */
export async function preserveBenefitPostingStatuses<T extends { id?: string }>(
  bookingId: string,
  incomingBenefits: T[]
): Promise<(T & { postingStatus: PostingStatus })[]> {
  // Skip the DB round-trip when all benefits are new (no existing row to look up).
  if (!incomingBenefits.some((b) => b.id)) {
    return incomingBenefits.map((b) => ({ ...b, postingStatus: "pending" as PostingStatus }));
  }

  const existing = await prisma.bookingBenefit.findMany({
    where: { bookingId },
    select: { id: true, postingStatus: true },
  });
  const statusById = new Map(existing.map((r) => [r.id, r.postingStatus]));

  return incomingBenefits.map((b) => ({
    ...b,
    postingStatus: (b.id ? statusById.get(b.id) : undefined) ?? "pending",
  }));
}

export async function updateBooking(id: string, userId: string, input: UpdateBookingInput) {
  const current = await prisma.booking.findFirst({
    where: { id, userId },
    select: {
      id: true,
      currency: true,
      checkIn: true,
      hotelChainId: true,
      pretaxCost: true,
      hotelChainSubBrandId: true,
      lockedExchangeRate: true,
      propertyId: true,
      loyaltyPointsEarned: true,
      accommodationType: true,
      userCreditCardId: true,
      shoppingPortalId: true,
      loyaltyPostingStatus: true,
      cardRewardPostingStatus: true,
      portalCashbackPostingStatus: true,
    },
  });
  if (!current) throw new AppError("Booking not found", 404);

  // Resolve propertyId
  let resolvedPropertyId: string | undefined = input.propertyId;
  if (!resolvedPropertyId && input.propertyName) {
    const chainId = input.hotelChainId ?? current.hotelChainId;
    resolvedPropertyId = await findOrCreateProperty({
      propertyName: input.propertyName,
      placeId: input.placeId ?? null,
      hotelChainId: chainId ?? null,
      countryCode: input.countryCode ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    });
  }

  // When the booking's hotel chain changes, keep the property in sync so the
  // price watch fetcher selects the correct scraper.
  // Fall back to current.propertyId so a chain-only update (no propertyId in payload) is covered.
  const propertyIdToSync = resolvedPropertyId ?? current.propertyId;
  const isNewProperty = !input.propertyId && !!input.propertyName; // findOrCreateProperty already used the new chain
  if (
    propertyIdToSync &&
    input.hotelChainId &&
    input.hotelChainId !== current.hotelChainId &&
    !isNewProperty
  ) {
    try {
      await prisma.property.update({
        where: { id: propertyIdToSync },
        data: { hotelChainId: input.hotelChainId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // A property with the same name + new chain already exists — point the booking there.
        const prop = await prisma.property.findUniqueOrThrow({ where: { id: propertyIdToSync } });
        const target = await prisma.property.findFirst({
          where: { name: prop.name, hotelChainId: input.hotelChainId },
        });
        if (target) resolvedPropertyId = target.id;
        else throw err;
      } else {
        throw err;
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (input.confirmationNumber !== undefined)
    data.confirmationNumber = input.confirmationNumber ?? null;
  if (input.accommodationType !== undefined) data.accommodationType = input.accommodationType;
  if (input.hotelChainId !== undefined) data.hotelChainId = input.hotelChainId || null;
  if (input.hotelChainSubBrandId !== undefined)
    data.hotelChainSubBrandId = input.hotelChainSubBrandId || null;
  if (resolvedPropertyId !== undefined) data.propertyId = resolvedPropertyId;
  if (input.checkIn !== undefined) data.checkIn = new Date(input.checkIn);
  if (input.checkOut !== undefined) data.checkOut = new Date(input.checkOut);
  if (input.numNights !== undefined) data.numNights = Number(input.numNights);
  if (input.pretaxCost !== undefined) data.pretaxCost = Number(input.pretaxCost);
  if (input.taxAmount !== undefined) data.taxAmount = Number(input.taxAmount);
  if (input.totalCost !== undefined) data.totalCost = Number(input.totalCost);
  if (input.userCreditCardId !== undefined) data.userCreditCardId = input.userCreditCardId || null;
  if (input.bookingDate !== undefined)
    data.bookingDate = input.bookingDate ? new Date(input.bookingDate) : null;
  if (input.paymentTiming !== undefined) data.paymentTiming = input.paymentTiming || "postpaid";
  if (input.shoppingPortalId !== undefined) data.shoppingPortalId = input.shoppingPortalId || null;
  if (input.portalCashbackRate !== undefined)
    data.portalCashbackRate = input.portalCashbackRate ? Number(input.portalCashbackRate) : null;
  if (input.loyaltyPointsEarned !== undefined)
    data.loyaltyPointsEarned = input.loyaltyPointsEarned ? Number(input.loyaltyPointsEarned) : null;
  if (input.portalCashbackOnTotal !== undefined)
    data.portalCashbackOnTotal = input.portalCashbackOnTotal;
  if (input.pointsRedeemed !== undefined)
    data.pointsRedeemed = input.pointsRedeemed ? Number(input.pointsRedeemed) : null;
  if (input.notes !== undefined) data.notes = input.notes || null;
  if (input.bookingSource !== undefined) {
    data.bookingSource = input.bookingSource || null;
    data.otaAgencyId =
      input.bookingSource === "ota" && input.otaAgencyId ? input.otaAgencyId : null;
  }

  // Resolve exchange rate when currency or checkIn changes
  if (input.currency !== undefined || input.checkIn !== undefined) {
    const finalCurrency = input.currency ?? current.currency ?? "USD";
    const finalCheckIn = input.checkIn ? new Date(input.checkIn) : (current.checkIn ?? new Date());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = finalCheckIn <= today;

    if (finalCurrency === "USD") {
      data.currency = finalCurrency;
      data.lockedExchangeRate = 1;
    } else if (isPast) {
      data.currency = finalCurrency;
      const checkInStr = finalCheckIn.toISOString().split("T")[0];
      data.lockedExchangeRate = await getOrFetchHistoricalRate(finalCurrency, checkInStr);
    } else {
      data.currency = finalCurrency;
      data.lockedExchangeRate = null;
    }
  } else if (input.currency !== undefined) {
    data.currency = input.currency;
  }

  // Auto-calculate loyalty points if not explicitly provided but hotel/pretax changed
  if (input.loyaltyPointsEarned === undefined || input.loyaltyPointsEarned === null) {
    const resolvedPretax = input.pretaxCost !== undefined ? Number(input.pretaxCost) : undefined;

    if (input.hotelChainId || resolvedPretax) {
      const finalCurrency = (data.currency as string | undefined) ?? current.currency ?? "USD";
      const finalCheckIn = input.checkIn
        ? new Date(input.checkIn)
        : (current.checkIn ?? new Date());
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPast = finalCheckIn <= today;
      const shouldCompute = finalCurrency === "USD" || isPast;

      if (shouldCompute) {
        const finalHotelChainId = input.hotelChainId ?? current.hotelChainId;
        const finalPretax = resolvedPretax ?? Number(current.pretaxCost);
        const finalSubBrandId =
          input.hotelChainSubBrandId !== undefined
            ? input.hotelChainSubBrandId || null
            : (current.hotelChainSubBrandId ?? null);

        if (finalHotelChainId && finalPretax) {
          const resolvedRate = data.lockedExchangeRate
            ? Number(data.lockedExchangeRate)
            : current.lockedExchangeRate
              ? Number(current.lockedExchangeRate)
              : finalCurrency === "USD"
                ? 1
                : ((await getCurrentRate(finalCurrency)) ?? 1);

          const [userStatus, hotelChain, subBrand] = await Promise.all([
            prisma.userStatus.findUnique({
              where: { userId_hotelChainId: { userId, hotelChainId: finalHotelChainId } },
              include: { eliteStatus: true },
            }),
            prisma.hotelChain.findUnique({ where: { id: finalHotelChainId } }),
            finalSubBrandId
              ? prisma.hotelChainSubBrand.findUnique({ where: { id: finalSubBrandId } })
              : null,
          ]);

          const basePointRate = resolveBasePointRate(hotelChain, subBrand);
          const calcCurrency = hotelChain?.calculationCurrency ?? "USD";
          const calcCurrencyToUsdRate = await resolveCalcCurrencyRate(calcCurrency);
          const usdPretax = finalPretax * resolvedRate;

          data.loyaltyPointsEarned = calculatePoints({
            pretaxCost: usdPretax,
            basePointRate,
            calculationCurrency: calcCurrency,
            calcCurrencyToUsdRate,
            eliteStatus: userStatus?.eliteStatus
              ? {
                  bonusPercentage: userStatus.eliteStatus.bonusPercentage,
                  fixedRate: userStatus.eliteStatus.fixedRate,
                  isFixed: userStatus.eliteStatus.isFixed,
                  pointsFloorTo: userStatus.eliteStatus.pointsFloorTo,
                }
              : null,
          });
        }
      }
    }
  }

  // Recompute lockedLoyaltyUsdCentsPerPoint when checkIn or hotelChainId changes
  if (input.checkIn !== undefined || input.hotelChainId !== undefined) {
    const finalCheckIn = input.checkIn ? new Date(input.checkIn) : (current.checkIn ?? new Date());
    const finalHotelChainId =
      input.hotelChainId !== undefined
        ? input.hotelChainId || null
        : (current.hotelChainId ?? null);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = finalCheckIn <= today;

    if (isPast && finalHotelChainId) {
      const hcWithPt = await prisma.hotelChain.findUnique({
        where: { id: finalHotelChainId },
        select: {
          pointType: { select: { programCurrency: true, programCentsPerPoint: true } },
        },
      });
      const pt = hcWithPt?.pointType;
      if (pt?.programCurrency != null && pt?.programCentsPerPoint != null) {
        const checkInStr = finalCheckIn.toISOString().split("T")[0];
        const programRate = await fetchExchangeRate(pt.programCurrency, checkInStr);
        data.lockedLoyaltyUsdCentsPerPoint = Number(pt.programCentsPerPoint) * programRate;
      } else {
        data.lockedLoyaltyUsdCentsPerPoint = null;
      }
    } else {
      data.lockedLoyaltyUsdCentsPerPoint = null;
    }
  }

  // Handle certificates: delete and recreate if provided
  if (input.certificates !== undefined) {
    await prisma.bookingCertificate.deleteMany({ where: { bookingId: id } });
    if (input.certificates.length > 0) {
      await prisma.bookingCertificate.createMany({
        data: input.certificates.map((v) => ({ bookingId: id, certType: v as CertType })),
      });
    }
  }

  // Handle benefits: validate, delete, and recreate if provided
  if (input.benefits !== undefined) {
    const effectiveHotelChainId =
      input.hotelChainId !== undefined
        ? input.hotelChainId || null
        : (current.hotelChainId ?? null);
    const benefitValidationError = await validateBenefits(
      input.benefits ?? [],
      effectiveHotelChainId
    );
    if (benefitValidationError) throw new AppError(benefitValidationError, 400);

    const validBenefits = input.benefits.filter((b) => b.benefitType);
    const benefitsWithStatus =
      validBenefits.length > 0 ? await preserveBenefitPostingStatuses(id, validBenefits) : [];

    // Must run after preserveBenefitPostingStatuses — snapshot reads rows being replaced.
    await prisma.bookingBenefit.deleteMany({ where: { bookingId: id } });

    if (benefitsWithStatus.length > 0) {
      await prisma.bookingBenefit.createMany({
        data: benefitsWithStatus.map((b) => ({
          bookingId: id,
          benefitType: b.benefitType as BenefitType,
          label: b.label || null,
          dollarValue: b.dollarValue != null ? Number(b.dollarValue) : null,
          pointsEarnType: (b.pointsEarnType as BenefitPointsEarnType) || null,
          pointsAmount: b.pointsAmount != null ? Number(b.pointsAmount) : null,
          pointsMultiplier: b.pointsMultiplier != null ? Number(b.pointsMultiplier) : null,
          postingStatus: b.postingStatus,
        })),
      });
    }
  }

  // Update geo fields in-place if provided without a new propertyName
  if (
    !resolvedPropertyId &&
    (input.countryCode !== undefined || input.city !== undefined || input.address !== undefined)
  ) {
    if (current.propertyId) {
      await prisma.property.update({
        where: { id: current.propertyId },
        data: {
          ...(input.countryCode !== undefined && { countryCode: input.countryCode || null }),
          ...(input.city !== undefined && { city: input.city || null }),
          ...(input.address !== undefined && { address: input.address || null }),
          ...(input.latitude !== undefined && { latitude: input.latitude ?? null }),
          ...(input.longitude !== undefined && { longitude: input.longitude ?? null }),
        },
      });
    }
  }

  // Derive earnings tracker statuses
  const postingStatuses = derivePostingStatusesForUpdate(data, current, input);
  data.loyaltyPostingStatus = postingStatuses.loyaltyPostingStatus;
  data.cardRewardPostingStatus = postingStatuses.cardRewardPostingStatus;
  data.portalCashbackPostingStatus = postingStatuses.portalCashbackPostingStatus;

  // Capture existing card benefit pairs before update
  const oldCardBenefitPairs = await prisma.bookingCardBenefit.findMany({
    where: { bookingId: id },
    select: {
      cardBenefitId: true,
      periodKey: true,
      booking: { select: { userCreditCardId: true } },
    },
  });

  const booking = await prisma.booking.update({ where: { id }, data });

  logger.info("booking:updated", { userId, bookingId: id, fieldsUpdated: Object.keys(data) });

  const appliedPromoIds = await matchPromotionsForBooking(booking.id, userId);
  await reevaluateSubsequentBookings(booking.id, userId, appliedPromoIds);
  await reapplyCardBenefitsAffectedByBooking(
    booking.id,
    oldCardBenefitPairs
      .filter((p) => p.booking.userCreditCardId != null)
      .map((p) => ({
        benefitId: p.cardBenefitId,
        periodKey: p.periodKey,
        userCreditCardId: p.booking.userCreditCardId!,
      }))
  );

  return getBookingWithUsage(booking.id, userId);
}

export async function patchBooking(id: string, userId: string, input: PatchBookingInput) {
  const booking = await prisma.booking.findFirst({
    where: { id, userId },
    select: { id: true, propertyId: true },
  });
  if (!booking) throw new AppError("Booking not found", 404);
  if (input.needsReview === false && !booking.propertyId) {
    throw new AppError("Cannot mark as reviewed without a property set", 422);
  }

  const data: Record<string, unknown> = {};
  if (input.needsReview !== undefined) data.needsReview = input.needsReview;
  if (input.loyaltyPostingStatus !== undefined)
    data.loyaltyPostingStatus = input.loyaltyPostingStatus;
  if (input.cardRewardPostingStatus !== undefined)
    data.cardRewardPostingStatus = input.cardRewardPostingStatus;
  if (input.portalCashbackPostingStatus !== undefined)
    data.portalCashbackPostingStatus = input.portalCashbackPostingStatus;

  return prisma.booking.update({ where: { id }, data });
}

export async function deleteBooking(id: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id, userId },
    select: {
      checkIn: true,
      userCreditCardId: true,
      bookingPromotions: { select: { promotionId: true } },
      bookingCardBenefits: { select: { cardBenefitId: true, periodKey: true } },
    },
  });
  if (!booking) throw new AppError("Booking not found", 404);

  const appliedPromoIds = booking.bookingPromotions.map((bp) => bp.promotionId);
  let subsequentBookingIds: string[] = [];
  if (appliedPromoIds.length > 0) {
    const affected = await prisma.booking.findMany({
      where: {
        checkIn: { gt: booking.checkIn },
        bookingPromotions: { some: { promotionId: { in: appliedPromoIds } } },
      },
      select: { id: true },
      orderBy: { checkIn: "asc" },
    });
    subsequentBookingIds = affected.map((b) => b.id);
  }

  const cardBenefitPairs = booking.userCreditCardId
    ? booking.bookingCardBenefits.map((b) => ({
        benefitId: b.cardBenefitId,
        periodKey: b.periodKey,
        userCreditCardId: booking.userCreditCardId!,
      }))
    : [];

  await prisma.bookingPromotion.deleteMany({ where: { bookingId: id } });
  await prisma.booking.delete({ where: { id } });

  logger.info("booking:deleted", { userId, bookingId: id });

  if (subsequentBookingIds.length > 0) {
    await reevaluateBookings(subsequentBookingIds, userId);
  }

  for (const { benefitId, periodKey, userCreditCardId } of cardBenefitPairs) {
    await reapplyBenefitForPeriod(benefitId, periodKey, userCreditCardId);
  }
}
