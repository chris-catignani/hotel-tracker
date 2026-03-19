import prisma from "@/lib/prisma";
import { matchCardBenefits } from "./card-benefit-matching";

/**
 * Computes and persists BookingCardBenefit rows for a booking.
 * Idempotent — deletes any existing rows before writing new ones.
 */
export async function applyCardBenefitsForBooking(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      hotelChainId: true,
      checkIn: true,
      totalCost: true,
      exchangeRate: true,
      userCreditCard: {
        select: {
          creditCard: {
            select: {
              cardBenefits: {
                where: { isActive: true },
                select: {
                  id: true,
                  creditCardId: true,
                  description: true,
                  value: true,
                  period: true,
                  hotelChainId: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking?.userCreditCard) {
    // No card instance on this booking — clear any stale rows
    await prisma.bookingCardBenefit.deleteMany({ where: { bookingId } });
    return;
  }

  const benefits = booking.userCreditCard.creditCard.cardBenefits;

  // Delete existing rows (idempotent)
  await prisma.bookingCardBenefit.deleteMany({ where: { bookingId } });

  if (benefits.length === 0) return;

  const totalCostUSD = Number(booking.totalCost) * Number(booking.exchangeRate ?? 1);

  // Fetch existing usage for these benefits from other bookings
  const benefitIds = benefits.map((b) => b.id);
  const existingUsage = await prisma.bookingCardBenefit.findMany({
    where: { cardBenefitId: { in: benefitIds }, bookingId: { not: bookingId } },
    select: { cardBenefitId: true, appliedValue: true, periodKey: true },
  });

  const applied = matchCardBenefits(
    benefits.map((b) => ({ ...b, value: Number(b.value) })),
    existingUsage.map((u) => ({
      cardBenefitId: u.cardBenefitId,
      appliedValue: Number(u.appliedValue),
      periodKey: u.periodKey,
    })),
    booking.hotelChainId,
    booking.checkIn,
    totalCostUSD
  );

  if (applied.length > 0) {
    await prisma.bookingCardBenefit.createMany({
      data: applied.map((a) => ({
        bookingId,
        cardBenefitId: a.cardBenefitId,
        appliedValue: a.appliedValue,
        periodKey: a.periodKey,
      })),
    });
  }
}
