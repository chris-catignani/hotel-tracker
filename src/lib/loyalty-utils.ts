import { Prisma } from "@prisma/client";

type RateHolder = { basePointRate?: unknown } | null | undefined;

/**
 * Resolves the effective base point rate for a booking, preferring the
 * sub-brand override over the chain-level rate.
 */
export function resolveBasePointRate(chain: RateHolder, subBrand?: RateHolder): number | null {
  const raw = subBrand?.basePointRate != null ? subBrand.basePointRate : chain?.basePointRate;
  return raw != null ? Number(raw) : null;
}

/**
 * Converts a USD pretax cost to the hotel chain's calculation currency (e.g. EUR for Accor).
 * Returns usdPretaxCost unchanged when the chain earns in USD or no rate is available.
 */
export function convertToCalcCurrency(
  usdPretaxCost: number,
  hotelChain:
    | { calculationCurrency?: string | null; calcCurrencyToUsdRate?: number | null }
    | null
    | undefined
): number {
  const calcCurrency = hotelChain?.calculationCurrency;
  const calcCurrencyToUsdRate = hotelChain?.calcCurrencyToUsdRate;
  return calcCurrency && calcCurrency !== "USD" && calcCurrencyToUsdRate != null
    ? usdPretaxCost / calcCurrencyToUsdRate
    : usdPretaxCost;
}

interface CalculationInput {
  pretaxCost: number; // always in USD
  basePointRate: number | null;
  calculationCurrency?: string | null; // if set and !== "USD", convert pretaxCost to that currency first
  calcCurrencyToUsdRate?: number | null; // 1 calcCurrency = X USD
  eliteStatus?: {
    isFixed: boolean;
    fixedRate: number | string | Prisma.Decimal | null;
    bonusPercentage: number | string | Prisma.Decimal | null;
    pointsFloorTo?: number | null;
  } | null;
}

/**
 * Centralized logic for calculating loyalty points based on elite status.
 * pretaxCost is expected in USD. If calculationCurrency is set and differs from USD,
 * the cost is converted to that currency before applying the base rate.
 */
export function calculatePoints({
  pretaxCost,
  basePointRate,
  calculationCurrency,
  calcCurrencyToUsdRate,
  eliteStatus,
}: CalculationInput): number {
  if (basePointRate == null && (!eliteStatus || !eliteStatus.isFixed)) {
    return 0;
  }

  const effectivePretaxCost = convertToCalcCurrency(pretaxCost, {
    calculationCurrency,
    calcCurrencyToUsdRate,
  });

  const baseRate = Number(basePointRate || 0);

  if (eliteStatus) {
    if (eliteStatus.isFixed && eliteStatus.fixedRate != null) {
      // Fixed rate (e.g. GHA Discovery 7%)
      const raw = effectivePretaxCost * Number(eliteStatus.fixedRate);
      if (eliteStatus.pointsFloorTo && eliteStatus.pointsFloorTo > 0) {
        return Math.floor(raw / eliteStatus.pointsFloorTo) * eliteStatus.pointsFloorTo;
      }
      return Math.round(raw);
    } else if (eliteStatus.bonusPercentage != null) {
      // Percentage bonus on base (e.g. Marriott 50% bonus)
      const bonusMultiplier = 1 + Number(eliteStatus.bonusPercentage);
      return Math.round(effectivePretaxCost * baseRate * bonusMultiplier);
    }
  }

  // Fallback to just base rate
  return Math.round(effectivePretaxCost * baseRate);
}

interface LoyaltyCalculationParams {
  hotelChainId: string;
  hotelChainSubBrandId: string;
  pretaxCost: string; // in USD
  hotelChains: {
    id: string;
    basePointRate: number | null;
    calculationCurrency?: string | null;
    calcCurrencyToUsdRate?: number | null;
    hotelChainSubBrands: { id: string; basePointRate: number | null }[];
    userStatus: {
      eliteStatus: {
        isFixed: boolean;
        fixedRate: number | null;
        bonusPercentage: number | null;
        pointsFloorTo: number | null;
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

  const hotelChain = hotelChains.find((h) => h.id === hotelChainId);
  if (!hotelChain) return "";

  const subBrand =
    hotelChainSubBrandId !== "none" && hotelChainSubBrandId
      ? hotelChain.hotelChainSubBrands.find((sb) => sb.id === hotelChainSubBrandId)
      : null;

  const basePointRate = resolveBasePointRate(hotelChain, subBrand);
  const eliteStatus = hotelChain.userStatus?.eliteStatus;

  const points = calculatePoints({
    pretaxCost: Number(pretaxCost),
    basePointRate,
    calculationCurrency: hotelChain.calculationCurrency ?? "USD",
    calcCurrencyToUsdRate: hotelChain.calcCurrencyToUsdRate ?? null,
    eliteStatus: eliteStatus
      ? {
          isFixed: eliteStatus.isFixed,
          bonusPercentage: eliteStatus.bonusPercentage,
          fixedRate: eliteStatus.fixedRate,
          pointsFloorTo: eliteStatus.pointsFloorTo,
        }
      : null,
  });

  return String(points);
}
