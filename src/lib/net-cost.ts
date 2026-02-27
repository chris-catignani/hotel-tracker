import { certPointsValue } from "@/lib/cert-types";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_EQN_VALUE } from "@/lib/constants";

const DEFAULT_CENTS_PER_POINT = 0.01;

export interface CalculationSegment {
  label: string;
  value: number;
  formula: string;
  description: string;
}

export interface CalculationDetail {
  label: string;
  formula: string;
  description: string;
  segments?: CalculationSegment[];
}

export interface NetCostBookingPromotionBenefit {
  appliedValue: string | number;
  eligibleNightsAtBooking?: number | null;
  promotionBenefit: {
    rewardType: string;
    valueType: string;
    value: string | number;
    certType: string | null;
    pointsMultiplierBasis?: string | null;
    restrictions?: {
      minNightsRequired?: number | null;
      spanStays?: boolean;
    } | null;
  };
}

export interface NetCostBooking {
  totalCost: string | number;
  pretaxCost: string | number;
  numNights: number;
  portalCashbackOnTotal: boolean;
  portalCashbackRate: string | number | null;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  certificates: { certType: string }[];
  hotelChainId: string | null;
  otaAgencyId: string | null;
  hotelChain: {
    id: string;
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
    rewardRules?: {
      rewardType: string;
      rewardValue: string | number;
      hotelChainId: string | null;
      otaAgencyId: string | null;
    }[];
  } | null;
  shoppingPortal: {
    name: string;
    rewardType: string;
    pointType: { name: string; centsPerPoint: string | number } | null;
  } | null;
  bookingPromotions: {
    id?: string;
    bookingId?: string;
    promotionId?: string;
    appliedValue: string | number;
    autoApplied?: boolean;
    verified?: boolean;
    eligibleNightsAtBooking?: number | null;
    promotion: {
      name: string;
      type?: string;
      restrictions?: {
        minNightsRequired?: number | null;
        spanStays?: boolean;
      } | null;
      benefits?: {
        rewardType: string;
        valueType: string;
        value: string | number;
        certType: string | null;
      }[];
    };
    benefitApplications?: NetCostBookingPromotionBenefit[];
  }[];
}

export interface PromotionBreakdown extends CalculationDetail {
  id: string;
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

function formatCents(centsPerPoint: number): string {
  const c = centsPerPoint * 100;
  if (Number.isInteger(c)) return c.toString();
  // Use toPrecision or simply toString to avoid trailing zeros unless necessary
  return parseFloat(c.toFixed(2)).toString();
}

export function getNetCostBreakdown(booking: NetCostBooking): NetCostBreakdown {
  const totalCost = Number(booking.totalCost);
  const pretaxCost = Number(booking.pretaxCost);

  // 1. Promotions
  const hotelCentsPerPoint = booking.hotelChain.pointType?.centsPerPoint
    ? Number(booking.hotelChain.pointType.centsPerPoint)
    : DEFAULT_CENTS_PER_POINT;

  const promotions: PromotionBreakdown[] = booking.bookingPromotions.map((bp, index) => {
    const appliedValue = Number(bp.appliedValue);
    const benefits = bp.benefitApplications ?? [];

    const descriptionLines: string[] = [];
    const segments: CalculationSegment[] = [];

    for (const ba of benefits) {
      const b = ba.promotionBenefit;
      const bValue = Number(b.value);
      const bApplied = ba.appliedValue != null ? Number(ba.appliedValue) : 0;

      const restrictions = b.restrictions || bp.promotion.restrictions;
      const isSpanned = !!(restrictions?.spanStays && restrictions?.minNightsRequired);

      if (isSpanned && restrictions?.minNightsRequired) {
        const minNights = restrictions.minNightsRequired;
        const cumulativeAtEnd = ba.eligibleNightsAtBooking || bp.eligibleNightsAtBooking || 0;
        const nightsInStay = booking.numNights;
        const cumulativeAtStart = Math.max(0, cumulativeAtEnd - nightsInStay);

        let nightsAccountedFor = 0;
        let currentStart = cumulativeAtStart;

        while (nightsAccountedFor < nightsInStay) {
          const progressInCurrentCycle = currentStart % minNights;
          const nightsToCompleteCycle = minNights - progressInCurrentCycle;
          const nightsInThisSegment = Math.min(
            nightsInStay - nightsAccountedFor,
            nightsToCompleteCycle
          );

          const segmentEndProgress = (currentStart + nightsInThisSegment) % minNights;
          const isCycleFinished = segmentEndProgress === 0;

          const segmentValue = (bApplied / nightsInStay) * nightsInThisSegment;

          let label = "";
          let description = "";

          if (progressInCurrentCycle === 0) {
            if (nightsInThisSegment === minNights) {
              label = `Full Reward Cycle (${minNights}/${minNights} nights)`;
              description = `A complete reward cycle finished within this stay.`;
            } else {
              label = `New Reward Cycle (${nightsInThisSegment}/${minNights} nights)`;
              description = `Started a new reward cycle. Pending more nights to complete.`;
            }
          } else {
            if (isCycleFinished) {
              label = `Cycle Completion (${nightsInThisSegment} nights)`;
              description = `Completed the reward cycle started in a previous stay.`;
            } else {
              label = `Cycle Progress (${nightsInThisSegment} nights)`;
              description = `Continued the reward cycle started in a previous stay. Still pending.`;
            }
          }

          const nightProgressLabel =
            nightsInThisSegment === 1
              ? `${cumulativeAtStart + nightsAccountedFor + 1} of ${minNights} nights`
              : `${nightsInThisSegment} nights towards ${minNights}-night goal`;

          let nightFormula = "";
          if (b.rewardType === "points") {
            const centsStr = formatCents(hotelCentsPerPoint);
            nightFormula = `(${nightProgressLabel}) × ${bValue.toLocaleString()} bonus pts × ${centsStr}¢ = ${formatCurrency(segmentValue)}`;
          } else if (b.rewardType === "cashback") {
            nightFormula = `(${nightProgressLabel}) × ${formatCurrency(bValue)} fixed cashback = ${formatCurrency(segmentValue)}`;
          } else {
            nightFormula = `(${nightProgressLabel}) × ${formatCurrency(bValue)} ${b.rewardType} = ${formatCurrency(segmentValue)}`;
          }

          segments.push({
            label,
            value: segmentValue,
            formula: nightFormula + (isCycleFinished ? "" : " (pending)"),
            description: description + (isCycleFinished ? " (Goal Met!)" : " (Pending)"),
          });

          nightsAccountedFor += nightsInThisSegment;
          currentStart += nightsInThisSegment;
        }

        const pendingRatio =
          cumulativeAtEnd % minNights !== 0
            ? ` (${
                nightsInStay === 1
                  ? `${cumulativeAtEnd % minNights} of ${minNights} nights`
                  : `${nightsInStay} nights towards ${minNights}-night goal`
              } required)`
            : "";

        const proportionalSuffix = pendingRatio
          ? ` This bonus is pending additional stays${pendingRatio}.`
          : "";

        descriptionLines.push(
          `Earned proportional rewards for ${nightsInStay} nights towards a ${minNights}-night requirement.${proportionalSuffix}`
        );
      } else {
        // Standard (Non-spanned) benefit logic
        let appliedMultiplier = 1;
        let isCapped = false;

        switch (b.rewardType) {
          case "cashback":
          case "eqn":
            if (b.valueType === "fixed") {
              if (bApplied % bValue === 0 && bApplied > bValue) {
                appliedMultiplier = bApplied / bValue;
              } else if (bApplied < bValue) {
                isCapped = true;
              }
            }
            break;
          case "points":
            if (b.valueType !== "multiplier") {
              const pointsValue = bValue * hotelCentsPerPoint;
              if (Math.abs(bApplied - pointsValue) < 0.001) {
                appliedMultiplier = 1;
              } else if (bApplied > pointsValue && Math.abs(bApplied % pointsValue) < 0.001) {
                appliedMultiplier = Math.round(bApplied / pointsValue);
              } else if (bApplied < pointsValue) {
                isCapped = true;
              }
            }
            break;
        }

        const multiplierPrefix = appliedMultiplier > 1 ? `${appliedMultiplier} × ` : "";
        const capSuffix = isCapped ? " (capped)" : "";

        let benefitFormula = "";
        let benefitDescription = "Reward based on stay criteria.";
        if (b.rewardType === "points") {
          const centsStr = formatCents(hotelCentsPerPoint);
          if (b.valueType === "multiplier") {
            const isBaseOnly = !b.pointsMultiplierBasis || b.pointsMultiplierBasis === "base_only";
            const baseRate = booking.hotelChain.basePointRate
              ? Number(booking.hotelChain.basePointRate)
              : 0;
            const basisPoints =
              isBaseOnly && baseRate > 0
                ? Math.round(pretaxCost * baseRate)
                : booking.loyaltyPointsEarned || 0;
            const basisLabel = isBaseOnly ? "(base rate only)" : "(incl. elite bonus)";
            benefitFormula = `${basisPoints.toLocaleString()} pts ${basisLabel} × (${bValue} - 1) × ${centsStr}¢${capSuffix}`;
            benefitDescription = `A ${bValue}x points multiplier on ${basisLabel} loyalty points, valued at ${centsStr}¢ each.`;
          } else {
            benefitFormula = `${multiplierPrefix}${bValue.toLocaleString()} bonus pts × ${centsStr}¢${capSuffix}`;
            benefitDescription = `${appliedMultiplier > 1 ? `Earning ${appliedMultiplier}x of ` : ""}${bValue.toLocaleString()} fixed bonus points, valued at ${centsStr}¢ each.`;
          }
        } else if (b.rewardType === "cashback") {
          if (b.valueType === "fixed") {
            benefitFormula = `${multiplierPrefix}${formatCurrency(bValue)} fixed cashback${capSuffix}`;
            benefitDescription = `${appliedMultiplier > 1 ? `Earning ${appliedMultiplier}x of a ` : "A "}fixed cashback of ${formatCurrency(bValue)}.`;
          } else {
            benefitFormula = `${formatCurrency(totalCost)} (total cost) × ${bValue}%${capSuffix}`;
            benefitDescription = `A ${bValue}% cashback on the total cost of the booking.`;
          }
        } else if (b.rewardType === "certificate") {
          const centsStr = formatCents(hotelCentsPerPoint);
          const points = b.certType ? certPointsValue(b.certType) : 0;
          benefitFormula = `${multiplierPrefix}${bValue.toLocaleString()} cert(s) × ${points.toLocaleString()} pts × 70% × ${centsStr}¢${capSuffix}`;
          benefitDescription = `Earns ${appliedMultiplier > 1 ? (appliedMultiplier * bValue).toLocaleString() : bValue.toLocaleString()} free night certificate(s), valued at ${centsStr}¢ per point.`;
        } else if (b.rewardType === "eqn") {
          benefitFormula = `${multiplierPrefix}${bValue.toLocaleString()} bonus EQN(s) × ${formatCurrency(DEFAULT_EQN_VALUE)}${capSuffix}`;
          benefitDescription = `Earns ${appliedMultiplier > 1 ? (appliedMultiplier * bValue).toLocaleString() : bValue.toLocaleString()} bonus Elite Qualifying Night(s).`;
        }

        if (isCapped) {
          benefitDescription += " Reduced by redemption caps.";
        }

        // Standard segment
        segments.push({
          label: `Benefit: ${b.rewardType}`,
          value: bApplied,
          formula: `${benefitFormula} = ${formatCurrency(bApplied)}`,
          description: benefitDescription,
        });

        descriptionLines.push(benefitDescription);
      }
    }

    const formula =
      segments.length > 1
        ? segments.map((s) => s.formula).join("; ") + ` = ${formatCurrency(appliedValue)} total`
        : segments.length === 1
          ? segments[0].formula
          : formatCurrency(appliedValue);

    const description =
      descriptionLines.length > 0
        ? descriptionLines.join(" ")
        : `Applied promotion value: ${formatCurrency(appliedValue)}.`;

    return {
      id: bp.id || String(index),
      name: bp.promotion.name,
      appliedValue,
      label: "Promotion",
      formula,
      description,
      segments,
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
    const baseRate = Number(booking.creditCard.rewardRate);
    const rules = booking.creditCard.rewardRules || [];
    const hotelId = booking.hotelChain.id || booking.hotelChainId;
    const otaId = booking.otaAgencyId;

    // Strict rule selection: OTA bookings only allow OTA rules.
    // Direct bookings only allow Hotel Chain rules.
    const applicableRules = rules.filter((r) => {
      if (otaId) {
        return r.otaAgencyId === otaId;
      }
      return r.hotelChainId === hotelId;
    });

    const multiplierRules = applicableRules.filter((r) => r.rewardType === "multiplier");
    const fixedRules = applicableRules.filter((r) => r.rewardType === "fixed");

    // Best multiplier (OTA match or Hotel match depending on booking context).
    // Pick the highest one if multiple match.
    const bestMultiplierRule = multiplierRules.sort(
      (a, b) => Number(b.rewardValue) - Number(a.rewardValue)
    )[0];

    const multiplierToUse = bestMultiplierRule ? Number(bestMultiplierRule.rewardValue) : baseRate;

    const centsPerPoint = booking.creditCard.pointType
      ? Number(booking.creditCard.pointType.centsPerPoint)
      : DEFAULT_CENTS_PER_POINT;
    const centsStr = formatCents(centsPerPoint);

    const cardSegments: CalculationSegment[] = [];

    // Base vs Boosted Multiplier
    if (bestMultiplierRule) {
      const baseValue = totalCost * baseRate * centsPerPoint;
      const boostValue = totalCost * (multiplierToUse - baseRate) * centsPerPoint;

      cardSegments.push({
        label: "Base Card Earning",
        value: baseValue,
        formula: `${formatCurrency(totalCost)} (total cost) × ${baseRate}x × ${centsStr}¢ = ${formatCurrency(baseValue)}`,
        description: `Standard earning rate for the ${booking.creditCard.name}.`,
      });

      cardSegments.push({
        label: `Hotel/Booking Boost`,
        value: boostValue,
        formula: `${formatCurrency(totalCost)} (total cost) × ${multiplierToUse - baseRate}x boost × ${centsStr}¢ = ${formatCurrency(boostValue)}`,
        description: `Additional earning for booking with ${booking.hotelChain.name}.`,
      });
    } else {
      const baseValue = totalCost * baseRate * centsPerPoint;
      cardSegments.push({
        label: "Base Card Earning",
        value: baseValue,
        formula: `${formatCurrency(totalCost)} (total cost) × ${baseRate}x × ${centsStr}¢ = ${formatCurrency(baseValue)}`,
        description: `Standard earning rate for the ${booking.creditCard.name}.`,
      });
    }

    // Fixed Bonuses
    for (const rule of fixedRules) {
      const bonusValue = Number(rule.rewardValue) * centsPerPoint;
      cardSegments.push({
        label: "Fixed Card Bonus",
        value: bonusValue,
        formula: `${Number(rule.rewardValue).toLocaleString()} bonus pts × ${centsStr}¢ = ${formatCurrency(bonusValue)}`,
        description: `Fixed point bonus awarded for this booking type.`,
      });
    }

    cardReward = cardSegments.reduce((sum, s) => sum + s.value, 0);

    cardRewardCalc = {
      label: "Card Reward",
      formula:
        cardSegments.length > 1
          ? cardSegments.map((s) => s.formula).join(" + ") + ` = ${formatCurrency(cardReward)}`
          : cardSegments[0].formula,
      description: `Total rewards earned using your ${booking.creditCard.name}.`,
      segments: cardSegments,
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

    const loyaltySegments: CalculationSegment[] = [];
    const elite = booking.hotelChain.userStatus?.eliteStatus;

    if (
      elite &&
      !elite.isFixed &&
      elite.bonusPercentage != null &&
      booking.hotelChain.basePointRate != null
    ) {
      const baseRate = Number(booking.hotelChain.basePointRate);
      const bonusPct = Number(elite.bonusPercentage);
      const basePoints = Math.round(pretaxCost * baseRate);
      const bonusPoints = Math.round(basePoints * bonusPct);

      loyaltySegments.push({
        label: "Base Loyalty Points",
        value: basePoints * centsPerPoint,
        formula: `${formatCurrency(pretaxCost)} (pre-tax) × ${baseRate}x = ${basePoints.toLocaleString()} pts`,
        description: "Standard earning rate for this hotel chain.",
      });

      loyaltySegments.push({
        label: `${elite.name} Elite Bonus`,
        value: bonusPoints * centsPerPoint,
        formula: `${basePoints.toLocaleString()} base pts × ${bonusPct * 100}% bonus = ${bonusPoints.toLocaleString()} pts`,
        description: `Additional points for your ${elite.name} status.`,
      });
    } else {
      loyaltySegments.push({
        label: "Total Loyalty Points",
        value: loyaltyPointsValue,
        formula: `${booking.loyaltyPointsEarned.toLocaleString()} pts × ${centsStr}¢ = ${formatCurrency(loyaltyPointsValue)}`,
        description: `Total points earned for this stay.`,
      });
    }

    loyaltyPointsCalc = {
      label: "Loyalty Points Value",
      formula:
        loyaltySegments.length > 1
          ? loyaltySegments.map((s) => s.formula).join("; ") +
            ` = ${formatCurrency(loyaltyPointsValue)} total`
          : loyaltySegments[0].formula,
      description: `You earned ${booking.loyaltyPointsEarned.toLocaleString()} ${pointName} for this stay.`,
      segments: loyaltySegments,
    };
  }

  // 5. Points RedeemedValue
  let pointsRedeemedValue = 0;
  let pointsRedeemedCalc: CalculationDetail | undefined;
  if (booking.pointsRedeemed && booking.hotelChain.pointType) {
    const centsPerPoint = Number(booking.hotelChain.pointType.centsPerPoint);
    const centsStr = formatCents(centsPerPoint);
    pointsRedeemedValue = booking.pointsRedeemed * centsPerPoint;

    pointsRedeemedCalc = {
      label: "Points Redeemed Value",
      formula: `${booking.pointsRedeemed.toLocaleString()} pts × ${centsStr}¢ = ${formatCurrency(pointsRedeemedValue)}`,
      description: `The estimated value of the points you redeemed for this stay.`,
    };
  }

  // 6. Certificates Value
  let certsValue = 0;
  let certsCalc: CalculationDetail | undefined;
  if (booking.certificates.length > 0 && booking.hotelChain.pointType) {
    const centsPerPoint = Number(booking.hotelChain.pointType.centsPerPoint);
    const centsStr = formatCents(centsPerPoint);

    const certSegments = booking.certificates.map((cert) => {
      const points = certPointsValue(cert.certType);
      const value = points * centsPerPoint;
      return {
        label: `Free Night Cert (${cert.certType})`,
        value,
        formula: `${points.toLocaleString()} pts × ${centsStr}¢ = ${formatCurrency(value)}`,
        description: `Estimated value of this certificate type.`,
      };
    });

    certsValue = certSegments.reduce((sum, s) => sum + s.value, 0);

    certsCalc = {
      label: "Certificates Value",
      formula:
        certSegments.length > 1
          ? certSegments.map((s) => s.formula).join(" + ") + ` = ${formatCurrency(certsValue)}`
          : certSegments[0].formula,
      description: `The total estimated value of certificates used for this stay.`,
      segments: certSegments,
    };
  }

  const netCost =
    totalCost -
    promoSavings -
    portalCashback -
    cardReward -
    loyaltyPointsValue +
    pointsRedeemedValue +
    certsValue;

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
