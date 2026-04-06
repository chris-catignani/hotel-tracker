interface CCPointsInput {
  totalCost: string | number;
  lockedExchangeRate: string | number | null;
  hotelChainId: string | null;
  otaAgencyId: string | null;
  userCreditCard: {
    creditCard: {
      rewardType: string;
      rewardRate: string | number;
      rewardRules?: {
        rewardType: string; // "multiplier" | "fixed"
        rewardValue: string | number;
        hotelChainId: string | null;
        otaAgencyId: string | null;
      }[];
    };
  } | null;
}

export function calculateCCPointsEarned(booking: CCPointsInput): number | null {
  if (!booking.userCreditCard) return null;
  const { creditCard } = booking.userCreditCard;
  if (creditCard.rewardType !== "points") return null;

  const totalCostUSD =
    Number(booking.totalCost) *
    (booking.lockedExchangeRate ? Number(booking.lockedExchangeRate) : 1);
  if (totalCostUSD <= 0) return null;

  const rules = creditCard.rewardRules ?? [];

  // Strict context: OTA bookings only match OTA rules; direct bookings only match chain rules
  const applicableRules = rules.filter((r) => {
    if (booking.otaAgencyId) {
      return r.otaAgencyId === booking.otaAgencyId;
    }
    return r.hotelChainId === booking.hotelChainId;
  });

  const multiplierRules = applicableRules.filter((r) => r.rewardType === "multiplier");
  const fixedRules = applicableRules.filter((r) => r.rewardType === "fixed");

  // Pick highest multiplier (or fall back to base rate)
  const bestMultiplier = multiplierRules.reduce<number | null>(
    (best, r) => (best === null || Number(r.rewardValue) > best ? Number(r.rewardValue) : best),
    null
  );
  const multiplierToUse = bestMultiplier ?? Number(creditCard.rewardRate);

  // Sum all fixed bonuses
  const fixedPoints = fixedRules.reduce((sum, r) => sum + Number(r.rewardValue), 0);

  return Math.round(totalCostUSD * multiplierToUse + fixedPoints);
}

interface PortalPointsInput {
  totalCost: string | number;
  pretaxCost: string | number;
  lockedExchangeRate: string | number | null;
  hotelChainId: string | null;
  otaAgencyId: string | null;
  shoppingPortal: { rewardType: string } | null;
  portalCashbackRate: string | number | null;
  portalCashbackOnTotal: boolean | null;
}

export function calculatePortalPointsEarned(booking: PortalPointsInput): number | null {
  if (!booking.shoppingPortal || booking.shoppingPortal.rewardType !== "points") return null;
  if (booking.portalCashbackRate == null) return null;

  const costBasis = booking.portalCashbackOnTotal ? booking.totalCost : booking.pretaxCost;
  const costUSD =
    Number(costBasis) * (booking.lockedExchangeRate ? Number(booking.lockedExchangeRate) : 1);
  if (costUSD <= 0) return null;

  return Math.round(Number(booking.portalCashbackRate) * costUSD);
}
