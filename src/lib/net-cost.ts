import { certPointsValue } from "@/lib/cert-types";
import { formatCurrency } from "@/lib/utils";

const DEFAULT_CENTS_PER_POINT = 0.01;

export interface CalculationDetail {
  label: string;
  formula: string;
  description: string;
}

export interface NetCostBooking {
  totalCost: string | number;
  pretaxCost: string | number;
  portalCashbackOnTotal: boolean;
  portalCashbackRate: string | number | null;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  certificates: { certType: string }[];
  hotelChain: {
    name: string;
    loyaltyProgram: string | null;
    basePointRate?: string | number | null;
    pointType: { name?: string; centsPerPoint: string | number } | null;
    userStatus?: {
      eliteStatus: {
        name: string;
        bonusPercentage: string | number | null;
        fixedRate: string | number | null;
        isFixed: boolean;
      } | null;
    } | null;
  };
  creditCard: {
    name: string;
    rewardRate?: string | number;
    pointType: { name?: string; centsPerPoint?: string | number } | null;
  } | null;
  shoppingPortal: {
    name: string;
    rewardType: string;
    pointType: { name?: string; centsPerPoint: string | number } | null;
  } | null;
  bookingPromotions: {
    id: number;
    bookingId: number;
    promotionId: number;
    appliedValue: string | number;
    autoApplied: boolean;
    verified: boolean;
    promotion: {
      id: number;
      name: string;
      type: string;
      value: string | number;
      valueType: string;
    };
  }[];
}

export interface PromotionBreakdown extends CalculationDetail {
  id: number;
  name: string;
  appliedValue: number;
}

export interface NetCostBreakdown {
  totalCost: number;
  promoSavings: number;
  promotions: PromotionBreakdown[];
  portalCashback: number;
  portalCashbackCalc?: CalculationDetail;
  cardReward: number;
  cardRewardCalc?: CalculationDetail;
  loyaltyPointsValue: number;
  loyaltyPointsCalc?: CalculationDetail;
  pointsRedeemedValue: number;
  pointsRedeemedCalc?: CalculationDetail;
  certsValue: number;
  certsCalc?: CalculationDetail;
  netCost: number;
}

/**
 * Formats a point valuation (cents per point) for display.
 * Handles floating point precision issues by rounding to 4 decimal places.
 */
function formatCents(centsPerPoint: number): string {
  const cents = centsPerPoint * 100;
  // Use toFixed and then parse back to number to remove trailing zeros
  // This handles 0.7000000000000001 -> "0.7"
  return parseFloat(cents.toFixed(4)).toString();
}

export function getNetCostBreakdown(booking: NetCostBooking): NetCostBreakdown {
  const totalCost = Number(booking.totalCost);
  const pretaxCost = Number(booking.pretaxCost);

  // 1. Promotions
  const promotions: PromotionBreakdown[] = booking.bookingPromotions.map((bp, index) => {
    const value = Number(bp.promotion.value);
    const appliedValue = Number(bp.appliedValue);
    let formula = "";
    let description = "";

    if (bp.promotion.valueType === "percentage") {
      formula = `${formatCurrency(totalCost)} (total cost) × ${value}% = ${formatCurrency(appliedValue)}`;
      description = `This promotion offers a ${value}% discount on the total cost of the booking.`;
    } else if (bp.promotion.valueType === "fixed") {
      formula = `${formatCurrency(value)} = ${formatCurrency(appliedValue)}`;
      description = `This is a fixed-value promotion of ${formatCurrency(value)}.`;
    } else if (bp.promotion.valueType === "points_multiplier") {
      const centsPerPoint = booking.hotelChain.pointType?.centsPerPoint
        ? Number(booking.hotelChain.pointType.centsPerPoint)
        : DEFAULT_CENTS_PER_POINT;
      const centsStr = formatCents(centsPerPoint);
      formula = `${(booking.loyaltyPointsEarned || 0).toLocaleString()} pts (from pre-tax cost) × (${value} - 1) × ${centsStr}¢ = ${formatCurrency(appliedValue)}`;
      description = `This promotion is a ${value}x points multiplier on earned loyalty points, which are typically based on the pre-tax cost. We value these points at ${centsStr}¢ each.`;
    }

    return {
      id: index,
      name: bp.promotion.name,
      appliedValue,
      label: "Promotion",
      formula,
      description,
    };
  });
  const promoSavings = promotions.reduce((sum, p) => sum + p.appliedValue, 0);

  // 2. Portal Cashback
  const portalBasis = booking.portalCashbackOnTotal ? totalCost : pretaxCost;
  const portalRate = Number(booking.portalCashbackRate || 0);
  let portalCashback = 0;
  let portalCashbackCalc: CalculationDetail | undefined;

  if (booking.shoppingPortal) {
    const isPoints = booking.shoppingPortal.rewardType === "points";
    const centsPerPoint = isPoints
      ? Number(booking.shoppingPortal.pointType?.centsPerPoint ?? 0)
      : 1;
    portalCashback = portalRate * portalBasis * (isPoints ? centsPerPoint : 1);

    const basisStr = booking.portalCashbackOnTotal ? "total cost" : "pre-tax cost";

    let formula = "";
    let description = "";
    if (isPoints) {
      const centsStr = formatCents(centsPerPoint);
      formula = `${formatCurrency(portalBasis)} (${basisStr}) × ${portalRate} pts/$ × ${centsStr}¢ = ${formatCurrency(portalCashback)}`;
      description = `${booking.shoppingPortal.name} offers ${portalRate} ${booking.shoppingPortal.pointType?.name || "points"} per dollar based on the ${basisStr}. We value these points at ${centsStr}¢ each.`;
    } else {
      formula = `${formatCurrency(portalBasis)} (${basisStr}) × ${(portalRate * 100).toFixed(1)}% = ${formatCurrency(portalCashback)}`;
      description = `${booking.shoppingPortal.name} offers a ${(portalRate * 100).toFixed(1)}% cashback bonus based on the ${basisStr}.`;
    }

    portalCashbackCalc = {
      label: "Portal Cashback",
      formula,
      description,
    };
  }

  // 3. Card Reward
  let cardReward = 0;
  let cardRewardCalc: CalculationDetail | undefined;
  if (booking.creditCard) {
    const rate = Number(booking.creditCard.rewardRate);
    const centsPerPoint = booking.creditCard.pointType
      ? Number(booking.creditCard.pointType.centsPerPoint)
      : DEFAULT_CENTS_PER_POINT;
    const pointName = booking.creditCard.pointType?.name || "points";
    const centsStr = formatCents(centsPerPoint);
    cardReward = totalCost * rate * centsPerPoint;

    cardRewardCalc = {
      label: "Card Reward",
      formula: `${formatCurrency(totalCost)} (total cost) × ${rate}x × ${centsStr}¢ = ${formatCurrency(cardReward)}`,
      description: `The ${booking.creditCard.name} earns ${rate}x ${pointName} per dollar spent on the total cost of the booking. We value ${pointName} at ${centsStr}¢ each.`,
    };
  }

  // 4. Loyalty Points Earned
  let loyaltyPointsValue = 0;
  let loyaltyPointsCalc: CalculationDetail | undefined;
  if (booking.loyaltyPointsEarned && booking.hotelChain.pointType) {
    const centsPerPoint = Number(booking.hotelChain.pointType.centsPerPoint);
    const pointName = booking.hotelChain.pointType.name || "points";
    const centsStr = formatCents(centsPerPoint);
    loyaltyPointsValue = booking.loyaltyPointsEarned * centsPerPoint;

    let description = `You earned ${booking.loyaltyPointsEarned.toLocaleString()} ${pointName} for this stay. Loyalty points are typically earned on the pre-tax cost only. We value these points at ${centsStr}¢ each.`;

    const elite = booking.hotelChain.userStatus?.eliteStatus;
    if (elite) {
      if (elite.isFixed && elite.fixedRate != null) {
        description += ` This was calculated as a fixed rate of ${elite.fixedRate} points per dollar of the pre-tax cost for your ${elite.name} status.`;
      } else if (elite.bonusPercentage != null && booking.hotelChain.basePointRate != null) {
        const baseRate = Number(booking.hotelChain.basePointRate);
        const bonusPct = Number(elite.bonusPercentage);
        const basePoints = Math.round(pretaxCost * baseRate);
        const bonusPoints = Math.round(basePoints * bonusPct);
        description += ` This includes ${basePoints.toLocaleString()} base points (${baseRate}x on pre-tax cost) and a ${bonusPct * 100}% bonus of ${bonusPoints.toLocaleString()} points for your ${elite.name} status.`;
      }
    }

    loyaltyPointsCalc = {
      label: "Loyalty Points Value",
      formula: `${booking.loyaltyPointsEarned.toLocaleString()} pts × ${centsStr}¢ = ${formatCurrency(loyaltyPointsValue)}`,
      description,
    };
  }

  // 5. Points Redeemed
  const hotelChainCentsPerPoint = booking.hotelChain.pointType
    ? Number(booking.hotelChain.pointType.centsPerPoint)
    : 0;
  const pointsRedeemedValue = (booking.pointsRedeemed ?? 0) * hotelChainCentsPerPoint;
  let pointsRedeemedCalc: CalculationDetail | undefined;
  if (booking.pointsRedeemed) {
    const centsStr = formatCents(hotelChainCentsPerPoint);
    pointsRedeemedCalc = {
      label: "Award Points (value)",
      formula: `${booking.pointsRedeemed.toLocaleString()} pts × ${centsStr}¢ = ${formatCurrency(pointsRedeemedValue)}`,
      description: `You redeemed ${booking.pointsRedeemed.toLocaleString()} points for this stay. Their equivalent cash value based on our valuation is ${formatCurrency(pointsRedeemedValue)}.`,
    };
  }

  // 6. Certificates
  const certsValue = booking.certificates.reduce(
    (sum, cert) => sum + certPointsValue(cert.certType) * hotelChainCentsPerPoint,
    0
  );
  let certsCalc: CalculationDetail | undefined;
  if (booking.certificates.length > 0) {
    const centsStr = formatCents(hotelChainCentsPerPoint);
    certsCalc = {
      label: "Certificates (value)",
      formula:
        booking.certificates
          .map((c) => `${certPointsValue(c.certType).toLocaleString()} pts`)
          .join(" + ") + ` × ${centsStr}¢ = ${formatCurrency(certsValue)}`,
      description: `You used ${booking.certificates.length} certificate(s). We value them based on the maximum point value they can be redeemed for.`,
    };
  }

  const netCost =
    totalCost +
    pointsRedeemedValue +
    certsValue -
    promoSavings -
    portalCashback -
    cardReward -
    loyaltyPointsValue;

  return {
    totalCost,
    promoSavings,
    promotions,
    portalCashback,
    portalCashbackCalc,
    cardReward,
    cardRewardCalc,
    loyaltyPointsValue,
    loyaltyPointsCalc,
    pointsRedeemedValue,
    pointsRedeemedCalc,
    certsValue,
    certsCalc,
    netCost,
  };
}

export function calculateNetCost(booking: NetCostBooking): number {
  return getNetCostBreakdown(booking).netCost;
}
