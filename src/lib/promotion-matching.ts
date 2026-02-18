import prisma from "@/lib/prisma";
import { BookingPromotion, PromotionType, ValueType } from "@prisma/client";

export async function matchPromotionsForBooking(
  bookingId: number
): Promise<BookingPromotion[]> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      hotel: { include: { pointType: true } },
      creditCard: { include: { pointType: true } },
      shoppingPortal: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking with id ${bookingId} not found`);
  }

  const activePromotions = await prisma.promotion.findMany({
    where: { isActive: true },
  });

  const matched: {
    promotionId: number;
    appliedValue: number;
  }[] = [];

  for (const promo of activePromotions) {
    let typeMatches = false;

    switch (promo.type) {
      case PromotionType.credit_card:
        typeMatches = promo.creditCardId === booking.creditCardId;
        break;
      case PromotionType.portal:
        typeMatches = promo.shoppingPortalId === booking.shoppingPortalId;
        break;
      case PromotionType.loyalty:
        typeMatches = promo.hotelId === booking.hotelId;
        break;
    }

    if (!typeMatches) continue;

    // Date range check
    if (promo.startDate || promo.endDate) {
      const checkInDate = new Date(booking.checkIn);
      if (promo.startDate && checkInDate < new Date(promo.startDate)) continue;
      if (promo.endDate && checkInDate > new Date(promo.endDate)) continue;
    }

    // Min spend check for credit_card types
    if (
      promo.type === PromotionType.credit_card &&
      promo.minSpend !== null &&
      booking.totalCost < promo.minSpend
    ) {
      continue;
    }

    // Calculate applied value
    let appliedValue = 0;
    switch (promo.valueType) {
      case ValueType.fixed:
        appliedValue = Number(promo.value);
        break;
      case ValueType.percentage:
        appliedValue = Number(booking.totalCost) * Number(promo.value) / 100;
        break;
      case ValueType.points_multiplier: {
        const centsPerPoint = booking.creditCard?.pointType?.centsPerPoint
          ? Number(booking.creditCard.pointType.centsPerPoint)
          : 0.01;
        appliedValue =
          Number(booking.loyaltyPointsEarned) *
          (Number(promo.value) - 1) *
          centsPerPoint;
        break;
      }
    }

    matched.push({
      promotionId: promo.id,
      appliedValue,
    });
  }

  // Delete existing auto-applied BookingPromotions for this booking
  await prisma.bookingPromotion.deleteMany({
    where: {
      bookingId,
      autoApplied: true,
    },
  });

  // Create new BookingPromotion records
  const createdRecords: BookingPromotion[] = [];
  for (const match of matched) {
    const record = await prisma.bookingPromotion.create({
      data: {
        bookingId,
        promotionId: match.promotionId,
        appliedValue: match.appliedValue,
        autoApplied: true,
      },
    });
    createdRecords.push(record);
  }

  return createdRecords;
}
