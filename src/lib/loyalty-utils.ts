import { Prisma } from "@prisma/client";

interface CalculationInput {
  pretaxCost: number;
  basePointRate: number | null;
  eliteStatus?: {
    isFixed: boolean;
    fixedRate: number | string | Prisma.Decimal | null;
    bonusPercentage: number | string | Prisma.Decimal | null;
  } | null;
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

interface LoyaltyCalculationParams {
  hotelChainId: string;
  hotelChainSubBrandId: string;
  pretaxCost: string;
  hotelChains: {
    id: number;
    basePointRate: number | null;
    hotelChainSubBrands: { id: number; basePointRate: number | null }[];
    userStatus: {
      eliteStatus: {
        isFixed: boolean;
        fixedRate: number | null;
        bonusPercentage: number | null;
      } | null;
    } | null;
  }[];
}

/**
 * Higher-level helper to find the correct chain/sub-brand and calculate points.
 * Useful for UI components that have the full list of chains.
 */
export function calculatePointsFromChain({
  hotelChainId,
  hotelChainSubBrandId,
  pretaxCost,
  hotelChains,
}: LoyaltyCalculationParams): string {
  if (!hotelChainId || !pretaxCost) return "";

  const hotelChain = hotelChains.find((h) => h.id === Number(hotelChainId));
  if (!hotelChain) return "";

  const subBrand =
    hotelChainSubBrandId !== "none"
      ? hotelChain.hotelChainSubBrands.find((sb) => sb.id === Number(hotelChainSubBrandId))
      : null;

  const basePointRate = Number(subBrand?.basePointRate ?? hotelChain.basePointRate ?? null);
  const eliteStatus = hotelChain.userStatus?.eliteStatus;

  const points = calculatePoints({
    pretaxCost: Number(pretaxCost),
    basePointRate: !isNaN(basePointRate) ? basePointRate : null,
    eliteStatus: eliteStatus
      ? {
          isFixed: eliteStatus.isFixed,
          bonusPercentage: eliteStatus.bonusPercentage,
          fixedRate: eliteStatus.fixedRate,
        }
      : null,
  });

  return String(points);
}
