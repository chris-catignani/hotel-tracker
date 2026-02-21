import { HotelChainEliteStatus } from "@prisma/client";

interface CalculationInput {
  pretaxCost: number;
  basePointRate: number | null;
  eliteStatus?: (HotelChainEliteStatus & { isFixed: boolean }) | null;
}

/**
 * Centralized logic for calculating loyalty points based on elite status.
 */
export function calculatePoints({
  pretaxCost,
  basePointRate,
  eliteStatus,
}: CalculationInput): number {
  if (basePointRate == null && (!eliteStatus || !eliteStatus.isFixed)) {
    return 0;
  }

  const baseRate = Number(basePointRate || 0);

  if (eliteStatus) {
    if (eliteStatus.isFixed && eliteStatus.fixedRate != null) {
      // Fixed rate (e.g. GHA Discovery 7%)
      return Math.round(pretaxCost * Number(eliteStatus.fixedRate));
    } else if (eliteStatus.bonusPercentage != null) {
      // Percentage bonus on base (e.g. Marriott 50% bonus)
      const bonusMultiplier = 1 + Number(eliteStatus.bonusPercentage);
      return Math.round(pretaxCost * baseRate * bonusMultiplier);
    }
  }

  // Fallback to just base rate
  return Math.round(pretaxCost * baseRate);
}
