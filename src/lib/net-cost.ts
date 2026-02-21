import { certPointsValue } from "@/lib/cert-types";

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
    basePointRate: string | number | null;
    pointType: { name: string; centsPerPoint: string | number } | null;
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
    rewardRate: string | number;
    pointType: { name: string; centsPerPoint: string | number } | null;
  } | null;
  shoppingPortal: {
    name: string;
    rewardType: string;
    pointType: { name: string; centsPerPoint: string | number } | null;
  } | null;
  bookingPromotions: {
    appliedValue: string | number;
    promotion: {
      name: string;
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

function formatDollars(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
      formula = `${formatDollars(totalCost)} (total cost) × ${value}% = ${formatDollars(appliedValue)}`;
      description = `This promotion offers a ${value}% discount on the total cost of the booking.`;
    } else if (bp.promotion.valueType === "fixed") {
      formula = `${formatDollars(value)} = ${formatDollars(appliedValue)}`;
      description = `This is a fixed-value promotion of ${formatDollars(value)}.`;
    } else if (bp.promotion.valueType === "points_multiplier") {
      const centsPerPoint = booking.creditCard?.pointType?.centsPerPoint ? Number(booking.creditCard.pointType.centsPerPoint) : 0.01;
      formula = `${(booking.loyaltyPointsEarned || 0).toLocaleString()} pts × (${value} - 1) × ${centsPerPoint}¢ = ${formatDollars(appliedValue)}`;
      description = `This promotion is a ${value}x points multiplier on earned loyalty points. We value these points at ${centsPerPoint * 100}¢ each.`;
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
    const centsPerPoint = isPoints ? Number(booking.shoppingPortal.pointType?.centsPerPoint ?? 0) : 1;
    portalCashback = portalRate * portalBasis * (isPoints ? centsPerPoint : 1);

    const basisStr = booking.portalCashbackOnTotal ? "total cost" : "pre-tax cost";
    
    let formula = "";
    let description = "";
    if (isPoints) {
      formula = `${formatDollars(portalBasis)} (${basisStr}) × ${portalRate} pts/$ × ${centsPerPoint * 100}¢ = ${formatDollars(portalCashback)}`;
      description = `${booking.shoppingPortal.name} offers ${portalRate} ${booking.shoppingPortal.pointType?.name || "points"} per dollar based on the ${basisStr}. We value these points at ${centsPerPoint * 100}¢ each.`;
    } else {
      formula = `${formatDollars(portalBasis)} (${basisStr}) × ${(portalRate * 100).toFixed(1)}% = ${formatDollars(portalCashback)}`;
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
    const centsPerPoint = booking.creditCard.pointType ? Number(booking.creditCard.pointType.centsPerPoint) : 0.01;
    const pointName = booking.creditCard.pointType?.name || "points";
    cardReward = totalCost * rate * centsPerPoint;

    cardRewardCalc = {
      label: "Card Reward",
      formula: `${formatDollars(totalCost)} (total cost) × ${rate}x × ${centsPerPoint * 100}¢ = ${formatDollars(cardReward)}`,
      description: `The ${booking.creditCard.name} earns ${rate}x ${pointName} per dollar spent on the total cost of the booking. We value ${pointName} at ${centsPerPoint * 100}¢ each.`,
    };
  }

  // 4. Loyalty Points Earned
  let loyaltyPointsValue = 0;
  let loyaltyPointsCalc: CalculationDetail | undefined;
  if (booking.loyaltyPointsEarned && booking.hotelChain.pointType) {
    const centsPerPoint = Number(booking.hotelChain.pointType.centsPerPoint);
    const pointName = booking.hotelChain.pointType.name || "points";
    loyaltyPointsValue = booking.loyaltyPointsEarned * centsPerPoint;

    let description = `You earned ${booking.loyaltyPointsEarned.toLocaleString()} ${pointName} for this stay. Loyalty points are typically earned on the pre-tax cost only. We value these points at ${centsPerPoint * 100}¢ each.`;
    
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
      formula: `${booking.loyaltyPointsEarned.toLocaleString()} pts × ${centsPerPoint * 100}¢ = ${formatDollars(loyaltyPointsValue)}`,
      description,
    };
  }

  // 5. Points Redeemed
  const hotelChainCentsPerPoint = booking.hotelChain.pointType ? Number(booking.hotelChain.pointType.centsPerPoint) : 0;
  const pointsRedeemedValue = (booking.pointsRedeemed ?? 0) * hotelChainCentsPerPoint;
  let pointsRedeemedCalc: CalculationDetail | undefined;
  if (booking.pointsRedeemed) {
    pointsRedeemedCalc = {
      label: "Award Points (value)",
      formula: `${booking.pointsRedeemed.toLocaleString()} pts × ${hotelChainCentsPerPoint * 100}¢ = ${formatDollars(pointsRedeemedValue)}`,
      description: `You redeemed ${booking.pointsRedeemed.toLocaleString()} points for this stay. Their equivalent cash value based on our valuation is ${formatDollars(pointsRedeemedValue)}.`,
    };
  }

  // 6. Certificates
  const certsValue = booking.certificates.reduce(
    (sum, cert) => sum + certPointsValue(cert.certType) * hotelChainCentsPerPoint,
    0
  );
  let certsCalc: CalculationDetail | undefined;
  if (booking.certificates.length > 0) {
    certsCalc = {
      label: "Certificates (value)",
      formula: booking.certificates.map(c => `${certPointsValue(c.certType).toLocaleString()} pts`).join(" + ") + ` × ${hotelChainCentsPerPoint * 100}¢ = ${formatDollars(certsValue)}`,
      description: `You used ${booking.certificates.length} certificate(s). We value them based on the maximum point value they can be redeemed for.`,
    };
  }

  const netCost = totalCost + pointsRedeemedValue + certsValue - promoSavings - portalCashback - cardReward - loyaltyPointsValue;
  
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
    netCost 
  };
}

export function calculateNetCost(booking: NetCostBooking): number {
  return getNetCostBreakdown(booking).netCost;
}
