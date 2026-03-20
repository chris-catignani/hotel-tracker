import prisma from "@/lib/prisma";
import { getPeriodKey } from "./card-benefit-matching";
import { BenefitPeriod } from "@prisma/client";

/**
 * Returns the date on which the booking is charged.
 * Prepaid bookings are charged at booking creation time (bookingDate).
 * Postpaid bookings are charged at check-in.
 */
export function getChargeDate(booking: {
  paymentTiming: string;
  bookingDate: Date | null;
  checkIn: Date;
}): Date {
  if (booking.paymentTiming === "prepaid" && booking.bookingDate) {
    return booking.bookingDate;
  }
  return booking.checkIn;
}

/**
 * Re-evaluates ALL bookings for a given (benefitId, periodKey, userCreditCardId) combination.
 *
 * Each UserCreditCard instance has its own independent benefit pool — two instances of the
 * same card product do NOT share a pool.
 *
 * Sorts eligible bookings by charge date ascending (earliest charge = highest priority),
 * tie-broken by createdAt, then applies the benefit cap greedily in that order.
 *
 * Idempotent — deletes existing BookingCardBenefit rows for this (benefit, period, card instance)
 * before writing new ones.
 */
export async function reapplyBenefitForPeriod(
  benefitId: string,
  periodKey: string,
  userCreditCardId: string
): Promise<void> {
  const benefit = await prisma.cardBenefit.findUnique({
    where: { id: benefitId },
    select: {
      id: true,
      creditCardId: true,
      hotelChainId: true,
      value: true,
      maxValuePerBooking: true,
      isActive: true,
      period: true,
      startDate: true,
      endDate: true,
      otaAgencies: { select: { otaAgencyId: true } },
    },
  });

  // Benefit gone or inactive — clear all usages for this (period, card instance)
  if (!benefit || !benefit.isActive) {
    await prisma.bookingCardBenefit.deleteMany({
      where: { cardBenefitId: benefitId, periodKey, booking: { userCreditCardId } },
    });
    return;
  }

  const otaAgencyIds = benefit.otaAgencies.map((o) => o.otaAgencyId);

  // Find all bookings for this card instance that match the hotel chain + OTA restrictions
  const bookings = await prisma.booking.findMany({
    where: {
      userCreditCardId,
      ...(benefit.hotelChainId ? { hotelChainId: benefit.hotelChainId } : {}),
      ...(otaAgencyIds.length > 0 ? { otaAgencyId: { in: otaAgencyIds } } : {}),
    },
    select: {
      id: true,
      checkIn: true,
      bookingDate: true,
      paymentTiming: true,
      totalCost: true,
      exchangeRate: true,
      createdAt: true,
      userCreditCard: { select: { openedDate: true, closedDate: true } },
    },
  });

  // Filter to bookings whose charge date falls in this period AND within the card's open window
  // AND within the benefit's optional start/end date range, then sort by charge date
  const eligible = bookings
    .map((b) => ({ ...b, chargeDate: getChargeDate(b) }))
    .filter((b) => {
      if (getPeriodKey(b.chargeDate, benefit.period as BenefitPeriod) !== periodKey) return false;
      // Normalize charge date to midnight UTC for day-level comparison
      const chargeDay = Date.UTC(
        b.chargeDate.getUTCFullYear(),
        b.chargeDate.getUTCMonth(),
        b.chargeDate.getUTCDate()
      );
      const opened = b.userCreditCard?.openedDate;
      const closed = b.userCreditCard?.closedDate;
      if (opened && chargeDay < opened.getTime()) return false;
      if (closed && chargeDay > closed.getTime()) return false;
      if (benefit.startDate && chargeDay < benefit.startDate.getTime()) return false;
      if (benefit.endDate && chargeDay > benefit.endDate.getTime()) return false;
      return true;
    })
    .sort((a, b) => {
      const diff = a.chargeDate.getTime() - b.chargeDate.getTime();
      return diff !== 0 ? diff : a.createdAt.getTime() - b.createdAt.getTime();
    });

  // Replace existing rows for this (benefit, period, card instance)
  await prisma.bookingCardBenefit.deleteMany({
    where: { cardBenefitId: benefitId, periodKey, booking: { userCreditCardId } },
  });

  const benefitValue = Number(benefit.value);
  const maxPerBooking =
    benefit.maxValuePerBooking != null ? Number(benefit.maxValuePerBooking) : null;
  let remaining = benefitValue;
  const toCreate: {
    bookingId: string;
    cardBenefitId: string;
    appliedValue: number;
    periodKey: string;
  }[] = [];

  for (const booking of eligible) {
    if (remaining <= 0) break;
    const totalCostUSD = Number(booking.totalCost) * Number(booking.exchangeRate ?? 1);
    const cap =
      maxPerBooking != null
        ? Math.min(remaining, maxPerBooking, totalCostUSD)
        : Math.min(remaining, totalCostUSD);
    const appliedValue = cap;
    if (appliedValue > 0) {
      toCreate.push({ bookingId: booking.id, cardBenefitId: benefitId, appliedValue, periodKey });
      remaining -= appliedValue;
    }
  }

  if (toCreate.length > 0) {
    await prisma.bookingCardBenefit.createMany({ data: toCreate });
  }
}

/**
 * Re-evaluates all card benefits for a specific user credit card instance.
 *
 * Called when a UserCreditCard is updated (e.g. openedDate / closedDate changed)
 * so that existing bookings reflect the correct eligibility window.
 */
export async function reapplyBenefitsForUserCard(
  userCreditCardId: string,
  userId: string
): Promise<void> {
  // Get the creditCardId for this instance so we can find matching benefits
  const userCard = await prisma.userCreditCard.findFirst({
    where: { id: userCreditCardId, userId },
    select: { creditCardId: true },
  });
  if (!userCard) return;

  // Find all active benefits for this credit card product
  const benefits = await prisma.cardBenefit.findMany({
    where: { creditCardId: userCard.creditCardId, isActive: true },
    select: { id: true, period: true },
  });

  // Collect all unique (benefitId, periodKey) pairs for this card instance's bookings
  const bookings = await prisma.booking.findMany({
    where: { userCreditCardId },
    select: { checkIn: true, bookingDate: true, paymentTiming: true },
  });

  const pairs = new Map<string, { benefitId: string; periodKey: string }>();
  for (const benefit of benefits) {
    for (const booking of bookings) {
      const chargeDate = getChargeDate(booking);
      const periodKey = getPeriodKey(chargeDate, benefit.period as BenefitPeriod);
      const key = `${benefit.id}:${periodKey}`;
      if (!pairs.has(key)) pairs.set(key, { benefitId: benefit.id, periodKey });
    }
  }

  for (const { benefitId, periodKey } of pairs.values()) {
    await reapplyBenefitForPeriod(benefitId, periodKey, userCreditCardId);
  }
}

/**
 * Re-evaluates a benefit across ALL existing bookings for ALL users.
 *
 * Called when a CardBenefit is created or updated so that existing bookings
 * are retroactively credited. Also handles criteria changes (e.g. hotel chain
 * restriction added) by wiping stale rows before re-applying.
 *
 * Each UserCreditCard instance is evaluated independently — two instances of the
 * same card product each get their own full benefit pool.
 */
export async function reapplyBenefitForAllUsers(benefitId: string): Promise<void> {
  const benefit = await prisma.cardBenefit.findUnique({
    where: { id: benefitId },
    select: {
      id: true,
      creditCardId: true,
      hotelChainId: true,
      period: true,
      isActive: true,
      otaAgencies: { select: { otaAgencyId: true } },
    },
  });

  if (!benefit) return;

  if (!benefit.isActive) {
    // Clear all usages for this benefit across all users
    await prisma.bookingCardBenefit.deleteMany({ where: { cardBenefitId: benefitId } });
    return;
  }

  // Delete ALL existing rows for this benefit first — handles criteria changes
  await prisma.bookingCardBenefit.deleteMany({ where: { cardBenefitId: benefitId } });

  const otaAgencyIds = benefit.otaAgencies.map((o) => o.otaAgencyId);

  // Find all bookings matching this benefit's card (+ optional hotel chain + OTA restrictions)
  const bookings = await prisma.booking.findMany({
    where: {
      userCreditCard: { creditCardId: benefit.creditCardId },
      ...(benefit.hotelChainId ? { hotelChainId: benefit.hotelChainId } : {}),
      ...(otaAgencyIds.length > 0 ? { otaAgencyId: { in: otaAgencyIds } } : {}),
    },
    select: { userCreditCardId: true, checkIn: true, bookingDate: true, paymentTiming: true },
  });

  // Collect unique (userCreditCardId, periodKey) pairs — each card instance is independent
  const pairs = new Map<string, { userCreditCardId: string; periodKey: string }>();
  for (const booking of bookings) {
    if (!booking.userCreditCardId) continue;
    const chargeDate = getChargeDate(booking);
    const periodKey = getPeriodKey(chargeDate, benefit.period as BenefitPeriod);
    const key = `${booking.userCreditCardId}:${periodKey}`;
    if (!pairs.has(key)) {
      pairs.set(key, { userCreditCardId: booking.userCreditCardId, periodKey });
    }
  }

  for (const { userCreditCardId, periodKey } of pairs.values()) {
    await reapplyBenefitForPeriod(benefitId, periodKey, userCreditCardId);
  }
}

/**
 * Determines which (benefitId, periodKey, userCreditCardId) tuples are affected by a booking
 * change, then re-evaluates all bookings in each of those combinations.
 *
 * Call this after booking create or update.
 *
 * @param bookingId  The booking that was created or updated.
 * @param oldPairs   (benefitId, periodKey, userCreditCardId) tuples that were applied BEFORE
 *                   the change. Pass these on update so that benefits from the old card instance
 *                   are re-evaluated even if the new booking state no longer matches them.
 */
export async function reapplyCardBenefitsAffectedByBooking(
  bookingId: string,
  oldPairs: { benefitId: string; periodKey: string; userCreditCardId: string }[] = []
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      checkIn: true,
      bookingDate: true,
      paymentTiming: true,
      hotelChainId: true,
      otaAgencyId: true,
      userCreditCardId: true,
      userCreditCard: {
        select: {
          creditCard: {
            select: {
              cardBenefits: {
                where: { isActive: true },
                select: {
                  id: true,
                  period: true,
                  hotelChainId: true,
                  otaAgencies: { select: { otaAgencyId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) return;

  // Collect all (benefitId, periodKey, userCreditCardId) tuples to re-evaluate
  const tuples = new Map<
    string,
    { benefitId: string; periodKey: string; userCreditCardId: string }
  >();

  // Old tuples — must be re-evaluated even if the booking no longer matches them
  for (const p of oldPairs) {
    tuples.set(`${p.benefitId}:${p.periodKey}:${p.userCreditCardId}`, p);
  }

  // New tuples based on the current state of the booking
  if (booking.userCreditCard && booking.userCreditCardId) {
    const chargeDate = getChargeDate(booking);
    for (const b of booking.userCreditCard.creditCard.cardBenefits) {
      if (b.hotelChainId && b.hotelChainId !== booking.hotelChainId) continue;
      const otaIds = b.otaAgencies.map((o) => o.otaAgencyId);
      if (otaIds.length > 0 && !otaIds.includes(booking.otaAgencyId ?? "")) continue;
      const periodKey = getPeriodKey(chargeDate, b.period as BenefitPeriod);
      tuples.set(`${b.id}:${periodKey}:${booking.userCreditCardId}`, {
        benefitId: b.id,
        periodKey,
        userCreditCardId: booking.userCreditCardId,
      });
    }
  }

  for (const { benefitId, periodKey, userCreditCardId } of tuples.values()) {
    await reapplyBenefitForPeriod(benefitId, periodKey, userCreditCardId);
  }
}
