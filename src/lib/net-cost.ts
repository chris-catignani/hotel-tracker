import { certPointsValue } from "@/lib/cert-types";

export interface NetCostBooking {
  totalCost: string | number;
  pretaxCost: string | number;
  portalCashbackOnTotal: boolean;
  portalCashbackRate: string | number | null;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  certificates: { certType: string }[];
  hotel: {
    pointType: { centsPerPoint: string | number } | null;
  };
  creditCard: {
    rewardRate: string | number;
    pointType: { centsPerPoint: string | number } | null;
  } | null;
  shoppingPortal: {
    rewardType: string;
    pointType: { centsPerPoint: string | number } | null;
  } | null;
  bookingPromotions: {
    appliedValue: string | number;
  }[];
}

export interface NetCostBreakdown {
  totalCost: number;
  promoSavings: number;
  portalCashback: number;
  cardReward: number;
  loyaltyPointsValue: number;
  pointsRedeemedValue: number;
  certsValue: number;
  netCost: number;
}

export function getNetCostBreakdown(booking: NetCostBooking): NetCostBreakdown {
  const totalCost = Number(booking.totalCost);
  const promoSavings = booking.bookingPromotions.reduce(
    (sum, bp) => sum + Number(bp.appliedValue),
    0
  );
  const portalBasis = booking.portalCashbackOnTotal ? totalCost : Number(booking.pretaxCost);
  const portalRate = Number(booking.portalCashbackRate || 0);
  let portalCashback = 0;
  if (booking.shoppingPortal?.rewardType === "points") {
    portalCashback = portalRate * portalBasis * Number(booking.shoppingPortal.pointType?.centsPerPoint ?? 0);
  } else {
    portalCashback = portalRate * portalBasis;
  }
  const cardReward = booking.creditCard
    ? totalCost *
      Number(booking.creditCard.rewardRate) *
      Number(booking.creditCard.pointType?.centsPerPoint ?? 0)
    : 0;
  const loyaltyPointsValue =
    booking.loyaltyPointsEarned && booking.hotel.pointType
      ? booking.loyaltyPointsEarned * Number(booking.hotel.pointType.centsPerPoint)
      : 0;
  const hotelCentsPerPoint = booking.hotel.pointType
    ? Number(booking.hotel.pointType.centsPerPoint)
    : 0;
  const pointsRedeemedValue = (booking.pointsRedeemed ?? 0) * hotelCentsPerPoint;
  const certsValue = booking.certificates.reduce(
    (sum, cert) => sum + certPointsValue(cert.certType) * hotelCentsPerPoint,
    0
  );
  const netCost =
    totalCost + pointsRedeemedValue + certsValue - promoSavings - portalCashback - cardReward - loyaltyPointsValue;
  return { totalCost, promoSavings, portalCashback, cardReward, loyaltyPointsValue, pointsRedeemedValue, certsValue, netCost };
}

export function calculateNetCost(booking: NetCostBooking): number {
  return getNetCostBreakdown(booking).netCost;
}
