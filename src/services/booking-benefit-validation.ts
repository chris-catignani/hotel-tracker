import prisma from "@/lib/prisma";

export type BenefitInput = {
  benefitType?: string;
  dollarValue?: number | null;
  pointsEarnType?: string | null;
  pointsAmount?: number | null;
  pointsMultiplier?: number | null;
};

const VALID_EARN_TYPES = ["fixed_per_stay", "fixed_per_night", "multiplier_on_base"] as const;

/**
 * Validates the pure field-level constraints on a benefit (no DB calls).
 * `hasLoyaltyProgram` is only consulted when `pointsEarnType` is set — it is
 * ignored (and safe to pass any value) for cash/informational benefits.
 * Returns an error message string or null if valid.
 */
export function validateBenefitConstraints(
  b: BenefitInput,
  hasLoyaltyProgram: boolean
): string | null {
  const hasPoints = !!b.pointsEarnType;
  const hasDollar = b.dollarValue != null;

  if (hasPoints && hasDollar) {
    return "A benefit cannot have both a dollar value and a points earn type";
  }

  if (!hasPoints && (b.pointsAmount != null || b.pointsMultiplier != null)) {
    return "Points fields (pointsAmount, pointsMultiplier) must be null when pointsEarnType is not set";
  }

  if (hasPoints) {
    if (!VALID_EARN_TYPES.includes(b.pointsEarnType as (typeof VALID_EARN_TYPES)[number])) {
      return `Unknown pointsEarnType: ${b.pointsEarnType}`;
    }
    if (!hasLoyaltyProgram) {
      return "Points benefits require the hotel chain to have a configured loyalty program";
    }
    if (b.pointsEarnType === "fixed_per_stay" || b.pointsEarnType === "fixed_per_night") {
      if (b.pointsAmount == null) return "fixed_per_stay and fixed_per_night require pointsAmount";
      if (b.pointsMultiplier != null)
        return "fixed_per_stay and fixed_per_night cannot have pointsMultiplier";
    }
    if (b.pointsEarnType === "multiplier_on_base") {
      if (b.pointsMultiplier == null) return "multiplier_on_base requires pointsMultiplier";
      if (b.pointsAmount != null) return "multiplier_on_base cannot have pointsAmount";
    }
  }

  return null;
}

/**
 * Validates all benefits in a booking, including a DB lookup to check whether
 * the hotel chain has a configured loyalty program when pointsEarnType is set.
 * Returns an error message string or null if all benefits are valid.
 */
export async function validateBenefits(
  benefits: BenefitInput[],
  hotelChainId: string | null | undefined
): Promise<string | null> {
  for (const b of benefits) {
    if (b.pointsEarnType) {
      if (!hotelChainId) {
        return "Points benefits require a booking with a hotel chain";
      }
      const chain = await prisma.hotelChain.findUnique({
        where: { id: hotelChainId },
        select: { pointType: { select: { id: true } } },
      });
      const hasLoyaltyProgram = !!chain?.pointType;
      const error = validateBenefitConstraints(b, hasLoyaltyProgram);
      if (error) return error;
    } else {
      const error = validateBenefitConstraints(b, true); // no chain check needed for non-points
      if (error) return error;
    }
  }
  return null;
}
