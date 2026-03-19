import { BenefitPeriod } from "@prisma/client";

export interface CardBenefitForMatching {
  id: string;
  creditCardId: string;
  description: string;
  value: string | number;
  period: BenefitPeriod;
  hotelChainId: string | null;
  isActive: boolean;
}

export interface BookingCardBenefitUsage {
  cardBenefitId: string;
  appliedValue: string | number;
  periodKey: string;
}

export interface AppliedCardBenefit {
  cardBenefitId: string;
  appliedValue: number;
  periodKey: string;
}

/** Returns the period key string for a given date and period type.
 *  annual     → "2025"
 *  semi_annual → "2025-H1" | "2025-H2"
 *  quarterly  → "2025-Q1" … "2025-Q4"
 *  monthly    → "2025-01" … "2025-12"
 */
export function getPeriodKey(date: Date, period: BenefitPeriod): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12

  switch (period) {
    case "annual":
      return `${year}`;
    case "semi_annual":
      return month <= 6 ? `${year}-H1` : `${year}-H2`;
    case "quarterly":
      return `${year}-Q${Math.ceil(month / 3)}`;
    case "monthly":
      return `${year}-${String(month).padStart(2, "0")}`;
  }
}

/**
 * For each active card benefit on the booking's credit card, calculate how
 * much (if any) applies to this booking given prior usage in the same period.
 *
 * @param benefits       Active CardBenefits for the booking's credit card
 * @param existingUsage  BookingCardBenefit rows already recorded (other bookings, same user)
 * @param bookingHotelChainId  The hotel chain of the booking (for restriction check)
 * @param checkIn        The booking's check-in date (determines period)
 * @param totalCostUSD   The booking's total cost in USD (caps the applied value)
 */
export function matchCardBenefits(
  benefits: CardBenefitForMatching[],
  existingUsage: BookingCardBenefitUsage[],
  bookingHotelChainId: string | null,
  checkIn: Date,
  totalCostUSD: number
): AppliedCardBenefit[] {
  const applied: AppliedCardBenefit[] = [];

  for (const benefit of benefits) {
    if (!benefit.isActive) continue;

    // Hotel chain restriction
    if (benefit.hotelChainId && benefit.hotelChainId !== bookingHotelChainId) continue;

    const periodKey = getPeriodKey(checkIn, benefit.period);
    const benefitValue = Number(benefit.value);

    // Sum usage from other bookings in this period
    const usedElsewhere = existingUsage
      .filter((u) => u.cardBenefitId === benefit.id && u.periodKey === periodKey)
      .reduce((sum, u) => sum + Number(u.appliedValue), 0);

    const remaining = benefitValue - usedElsewhere;
    if (remaining <= 0) continue;

    const appliedValue = Math.min(remaining, totalCostUSD);
    if (appliedValue <= 0) continue;

    applied.push({ cardBenefitId: benefit.id, appliedValue, periodKey });
  }

  return applied;
}
