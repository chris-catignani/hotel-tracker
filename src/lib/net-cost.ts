import { certPointsValue } from "@/lib/cert-types";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_EQN_VALUE } from "@/lib/constants";
import { resolveBasePointRate } from "@/lib/loyalty-utils";

const DEFAULT_CENTS_PER_POINT = 0.01;
const ORPHANED_PROMOTION_DESCRIPTION =
  "There are not enough future bookings to fulfill this promotion.";

export interface CalculationSegment {
  label: string;
  value: number;
  hideValue?: boolean;
  formula: string;
  description: string;
}

export interface CalculationGroup {
  name?: string;
  description?: string;
  segments: CalculationSegment[];
}

export interface CalculationDetail {
  label: string;
  appliedValue: number;
  description?: string;
  groups: CalculationGroup[];
}

export interface NetCostBookingPromotionBenefit {
  appliedValue: string | number;
  eligibleNightsAtBooking?: number | null;
  eligibleStayCount?: number | null;
  eligibleNightCount?: number | null;
  isOrphaned?: boolean;
  isPreQualifying?: boolean;
  promotionBenefit: {
    rewardType: string;
    valueType: string;
    value: string | number;
    certType: string | null;
    pointsMultiplierBasis?: string | null;
    restrictions?: {
      minNightsRequired?: number | null;
      spanStays?: boolean;
      prerequisiteStayCount?: number | null;
      prerequisiteNightCount?: number | null;
      hotelChainId?: string | null;
      allowedBookingSources?: string[] | null;
      maxTotalBonusPoints?: number | null;
      maxRedemptionValue?: string | number | null;
    } | null;
  };
}

/**
 * Convert a native-currency amount to USD using the stored/resolved exchange rate.
 * For USD bookings, exchangeRate = 1, so this is a no-op.
 */
export function toUSD(nativeAmount: number, exchangeRate: number): number {
  return nativeAmount * exchangeRate;
}

export interface NetCostBooking {
  totalCost: string | number;
  pretaxCost: string | number;
  currency?: string;
  exchangeRate?: string | number | null;
  numNights: number;
  portalCashbackOnTotal: boolean;
  portalCashbackRate: string | number | null;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  certificates: { certType: string }[];
  hotelChainId: string | null;
  otaAgencyId: string | null;
  bookingSource: string | null;
  hotelChain: {
    id: string;
    name: string;
    loyaltyProgram: string | null;
    basePointRate: string | number | null;
    calculationCurrency?: string | null;
    calcCurrencyToUsdRate?: number | null;
    pointType: { name: string; centsPerPoint: string | number } | null;
    userStatus?: {
      eliteStatus: {
        name: string;
        bonusPercentage: string | number | null;
        fixedRate: string | number | null;
        isFixed: boolean;
      } | null;
    } | null;
  } | null;
  hotelChainSubBrand?: { basePointRate: string | number | null } | null;
  userCreditCard: {
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
    };
  } | null;
  shoppingPortal: {
    name: string;
    rewardType: string;
    pointType: { name: string; centsPerPoint: string | number } | null;
  } | null;
  bookingCardBenefits?: {
    appliedValue: string | number;
    cardBenefit: { description: string };
  }[];
  partnershipEarns?: { name: string; earnedValue: number; calc: CalculationDetail }[];
  property?: { name?: string; countryCode?: string | null } | null;
  bookingPromotions: {
    id?: string;
    bookingId?: string;
    promotionId?: string;
    appliedValue: string | number;
    autoApplied?: boolean;
    verified?: boolean;
    eligibleNightsAtBooking?: number | null;
    eligibleStayCount?: number | null;
    eligibleNightCount?: number | null;
    isOrphaned?: boolean;
    isPreQualifying?: boolean;
    promotion: {
      name: string;
      type?: string;
      restrictions?: {
        minNightsRequired?: number | null;
        spanStays?: boolean;
        prerequisiteStayCount?: number | null;
        prerequisiteNightCount?: number | null;
        hotelChainId?: string | null;
        allowedBookingSources?: string[] | null;
        maxTotalBonusPoints?: number | null;
        maxRedemptionValue?: string | number | null;
      } | null;
      benefits?: {
        rewardType: string;
        valueType: string;
        value: string | number;
        certType: string | null;
      }[];
      tiers?: {
        minStays: number | null;
        maxStays: number | null;
        minNights: number | null;
        maxNights: number | null;
        benefits: {
          rewardType: string;
          valueType: string;
          value: string | number;
          certType: string | null;
        }[];
      }[];
    };
    benefitApplications?: NetCostBookingPromotionBenefit[];
  }[];
}

export interface PromotionBreakdown extends CalculationDetail {
  id: string;
  name: string;
  appliedValue: number;
  isOrphaned: boolean;
  isPreQualifying: boolean;
}

export interface NetCostBreakdown {
  totalCost: number;
  promoSavings: number;
  promotions: PromotionBreakdown[];
  cardBenefitSavings?: number;
  cardBenefitCalc?: CalculationDetail;
  portalCashback: number;
  portalCashbackCalc?: CalculationDetail;
  cardReward: number;
  cardRewardCalc?: CalculationDetail;
  loyaltyPointsValue: number;
  loyaltyPointsCalc?: CalculationDetail;
  partnershipEarns: { name: string; earnedValue: number; calc: CalculationDetail }[];
  partnershipEarnsValue: number;
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
  const nativeTotalCost = Number(booking.totalCost);
  const nativePretaxCost = Number(booking.pretaxCost);
  const exchangeRate = booking.exchangeRate ? Number(booking.exchangeRate) : 1;
  // All cost-based calculations use USD values
  const totalCost = toUSD(nativeTotalCost, exchangeRate);
  const pretaxCost = toUSD(nativePretaxCost, exchangeRate);

  // NOTE: Redemption Constraints
  // The appliedValue shown here already reflects any constraints enforced at matching time:
  // - maxStayCount: limits how many separate stays can trigger a promotion
  // - maxRewardCount: limits how many times a modular reward can be earned across stays
  // - maxRedemptionValue: caps the total dollar value; appliedValue is reduced proportionally
  // - maxTotalBonusPoints: caps total bonus points earned; appliedValue is reduced proportionally
  // - minNightsRequired: promotion only applies to stays of minimum length
  // - prerequisiteStayCount: promotion only applies after a certain number of prior stays
  // - prerequisiteNightCount: promotion only applies after a certain number of prior nights
  // - nightsStackable: benefit is multiplied by number of qualifying stay nights
  // - bookByDate: booking must be created before cutoff date
  // - registrationDeadline: user must have registered by this date
  // - validDaysAfterRegistration: personal validity window starting from the registration date
  // The final appliedValue shown below is the result after all constraints are applied.

  // 1. Promotions
  const hotelCentsPerPoint =
    booking.hotelChain?.pointType?.centsPerPoint != null
      ? Number(booking.hotelChain.pointType.centsPerPoint)
      : DEFAULT_CENTS_PER_POINT;

  const promotions: PromotionBreakdown[] = booking.bookingPromotions.map((bp, index) => {
    const benefits = bp.benefitApplications ?? [];

    const groups: CalculationGroup[] = [];

    const isPromoOrphaned = bp.isOrphaned ?? false;
    const isPromoPreQualifying = bp.isPreQualifying ?? false;

    // Prerequisite information
    const promoRestrictions = bp.promotion.restrictions;
    const prereqStayNeeded = promoRestrictions?.prerequisiteStayCount || 0;
    const prereqNightNeeded = promoRestrictions?.prerequisiteNightCount || 0;

    const currentStayCount = bp.eligibleStayCount ?? 0;
    const currentNightCount = bp.eligibleNightCount ?? 0;

    if (isPromoPreQualifying) {
      if (prereqStayNeeded > 0) {
        const remainingAfterThis = prereqStayNeeded - currentStayCount;
        const fulfilled = remainingAfterThis <= 0;
        groups.push({
          name: "Prerequisite Stays",
          description: `This promotion requires ${prereqStayNeeded} pre-qualifying stay${prereqStayNeeded !== 1 ? "s" : ""} before rewards begin.`,
          segments: [
            {
              label: "Requirement Progress",
              value: 0,
              hideValue: true,
              formula: fulfilled
                ? `${prereqStayNeeded} of ${prereqStayNeeded} pre-qualifying stays complete — this booking is #${currentStayCount}`
                : `${currentStayCount} of ${prereqStayNeeded} stays complete — this booking is #${currentStayCount}, ${remainingAfterThis} more needed`,
              description: fulfilled
                ? `This booking fulfills the prerequisite! The promotion will apply starting on your next qualifying stay.`
                : `You'll need ${remainingAfterThis} more qualifying stay${remainingAfterThis !== 1 ? "s" : ""} after this one to unlock the promotion.`,
            },
          ],
        });
      }

      if (prereqNightNeeded > 0) {
        const remainingAfterThis = prereqNightNeeded - currentNightCount;
        const fulfilled = remainingAfterThis <= 0;
        groups.push({
          name: "Prerequisite Nights",
          description: `This promotion requires ${prereqNightNeeded} pre-qualifying night${prereqNightNeeded !== 1 ? "s" : ""} before rewards begin.`,
          segments: [
            {
              label: "Requirement Progress",
              value: 0,
              hideValue: true,
              formula: fulfilled
                ? `${prereqNightNeeded} of ${prereqNightNeeded} pre-qualifying nights complete — this booking adds ${booking.numNights}`
                : `${currentNightCount} of ${prereqNightNeeded} nights complete — this booking adds ${booking.numNights}, ${remainingAfterThis} more needed`,
              description: fulfilled
                ? `This booking fulfills the prerequisite! The promotion will apply starting on your next qualifying stay.`
                : `You'll need ${remainingAfterThis} more qualifying night${remainingAfterThis !== 1 ? "s" : ""} after this booking to unlock the promotion.`,
            },
          ],
        });
      }

      // Tier information
      if (bp.promotion.tiers && bp.promotion.tiers.length > 0) {
        const tiersByStays = bp.promotion.tiers.some((t) => t.minStays !== null);

        // For tier-based pre-qualifying (no explicit prerequisite), show where the user
        // currently stands in the progression so they understand why this is pre-qualifying.
        const currentPositionSegment: CalculationSegment | null =
          !prereqStayNeeded && !prereqNightNeeded
            ? tiersByStays
              ? (() => {
                  const firstTierStart = Math.min(
                    ...bp.promotion.tiers.map((t) => t.minStays ?? Infinity)
                  );
                  return {
                    label: "Your Current Position",
                    value: 0,
                    hideValue: true,
                    formula: `Stay ${currentStayCount} of campaign (tier rewards begin at stay ${firstTierStart})`,
                    description: `This is eligible stay #${currentStayCount} in this campaign. Keep going to unlock tier rewards starting at stay ${firstTierStart}.`,
                  };
                })()
              : (() => {
                  const firstTierStart = Math.min(
                    ...bp.promotion.tiers.map((t) => t.minNights ?? Infinity)
                  );
                  return {
                    label: "Your Current Position",
                    value: 0,
                    hideValue: true,
                    formula: `Night ${currentNightCount} of campaign (tier rewards begin at night ${firstTierStart})`,
                    description: `You've accumulated ${currentNightCount} night${currentNightCount !== 1 ? "s" : ""} in this campaign. Tier rewards begin at night ${firstTierStart}.`,
                  };
                })()
            : null;

        const tierSegments: CalculationSegment[] = [
          ...(currentPositionSegment ? [currentPositionSegment] : []),
          ...bp.promotion.tiers.map((t, tIdx) => {
            const rewardParts = t.benefits.map((b) => {
              const val = Number(b.value);
              if (b.rewardType === "points") return `${val.toLocaleString()} pts`;
              if (b.rewardType === "cashback")
                return b.valueType === "percentage" ? `${val}%` : formatCurrency(val);
              if (b.rewardType === "eqn") return `${val} EQN${val !== 1 ? "s" : ""}`;
              return b.rewardType;
            });

            let rangeLabel = "";
            if (t.minStays !== null) {
              rangeLabel =
                t.maxStays === null
                  ? `Stay ${t.minStays}+`
                  : t.minStays === t.maxStays
                    ? `Stay ${t.minStays}`
                    : `Stays ${t.minStays}-${t.maxStays}`;
            } else if (t.minNights !== null) {
              rangeLabel =
                t.maxNights === null
                  ? `Night ${t.minNights}+`
                  : t.minNights === t.maxNights
                    ? `Night ${t.minNights}`
                    : `Nights ${t.minNights}-${t.maxNights}`;
            }

            return {
              label: `Tier ${tIdx + 1}: ${rangeLabel}`,
              value: 0,
              hideValue: true,
              formula: rewardParts.join(" + "),
              description: `Rewards you will earn when you reach this tier.`,
            };
          }),
        ];

        groups.push({
          name: "Promotion Tiers",
          description: "Future rewards you'll earn as you complete more stays in this campaign.",
          segments: tierSegments,
        });
      }
    }

    // For actively-earning tiered promotions, show what future tiers will earn.
    if (
      !isPromoPreQualifying &&
      !isPromoOrphaned &&
      bp.promotion.tiers &&
      bp.promotion.tiers.length > 1
    ) {
      const currentStayCount = bp.eligibleStayCount ?? 0;
      const currentNightCount = bp.eligibleNightCount ?? 0;
      const tiersByStays = bp.promotion.tiers.some((t) => t.minStays !== null);

      const futureTiers = bp.promotion.tiers.filter((t) =>
        tiersByStays ? (t.minStays ?? 0) > currentStayCount : (t.minNights ?? 0) > currentNightCount
      );

      if (futureTiers.length > 0) {
        const futureSegments: CalculationSegment[] = futureTiers.map((t, tIdx) => {
          const rewardParts = t.benefits.map((b) => {
            const val = Number(b.value);
            if (b.rewardType === "points") return `${val.toLocaleString()} pts`;
            if (b.rewardType === "cashback")
              return b.valueType === "percentage" ? `${val}%` : formatCurrency(val);
            if (b.rewardType === "eqn") return `${val} EQN${val !== 1 ? "s" : ""}`;
            return b.rewardType;
          });

          let rangeLabel = "";
          if (t.minStays !== null) {
            rangeLabel =
              t.maxStays === null
                ? `Stay ${t.minStays}+`
                : t.minStays === t.maxStays
                  ? `Stay ${t.minStays}`
                  : `Stays ${t.minStays}–${t.maxStays}`;
          } else if (t.minNights !== null) {
            rangeLabel =
              t.maxNights === null
                ? `Night ${t.minNights}+`
                : t.minNights === t.maxNights
                  ? `Night ${t.minNights}`
                  : `Nights ${t.minNights}–${t.maxNights}`;
          }

          return {
            label: tIdx === 0 ? `Next: ${rangeLabel}` : rangeLabel,
            value: 0,
            hideValue: true,
            formula: rewardParts.join(" + "),
            description: "",
          };
        });

        groups.push({
          name: "Upcoming Tiers",
          description: "",
          segments: futureSegments,
        });
      }
    }

    for (const ba of benefits) {
      const b = ba.promotionBenefit;
      const bValue = Number(b.value);
      const bApplied = ba.appliedValue != null ? Number(ba.appliedValue) : 0;
      const isOrphaned =
        (ba.isOrphaned ?? isPromoOrphaned) && !(ba.isPreQualifying ?? isPromoPreQualifying);
      const isPreQualifying = ba.isPreQualifying ?? isPromoPreQualifying;

      // For tier-based pre-qualifying promotions the tier table already explains the
      // rewards for each stay, so skip the per-benefit group to avoid duplication.
      if (isPreQualifying && bp.promotion.tiers && bp.promotion.tiers.length > 0) continue;

      const restrictions = b.restrictions || bp.promotion.restrictions;
      const isSpanned = !!(restrictions?.spanStays && restrictions?.minNightsRequired);

      const benefitSegments: CalculationSegment[] = [];
      let benefitDescriptionLine = "";

      let groupName = "";
      if (b.rewardType === "points") {
        groupName = `${bValue.toLocaleString()} Bonus Points`;
      } else if (b.rewardType === "eqn") {
        groupName = `${bValue} Bonus Elite Night${bValue !== 1 ? "s" : ""}`;
      } else if (b.rewardType === "cashback") {
        groupName =
          b.valueType === "percentage"
            ? `${bValue}% Cashback`
            : `${formatCurrency(bValue)} Cashback`;
      } else {
        groupName = b.rewardType.charAt(0).toUpperCase() + b.rewardType.slice(1);
      }

      if (isSpanned && restrictions?.minNightsRequired) {
        const minNights = restrictions.minNightsRequired;
        const cumulativeAtEnd = ba.eligibleNightsAtBooking || bp.eligibleNightsAtBooking || 0;
        const nightsInStay = booking.numNights;
        const cumulativeAtStart = Math.max(0, cumulativeAtEnd - nightsInStay);

        let expectedValuePerNight = 0;
        if (b.rewardType === "points") {
          expectedValuePerNight = (bValue * hotelCentsPerPoint) / minNights;
        } else if (b.rewardType === "cashback") {
          if (b.valueType === "fixed") {
            expectedValuePerNight = bValue / minNights;
          } else {
            // Percentage cashback - attribute proportionally based on cost if available,
            // but for simplicity we use night-proportional here as well
            expectedValuePerNight = (totalCost * (bValue / 100)) / nightsInStay;
          }
        } else if (b.rewardType === "eqn") {
          expectedValuePerNight = (bValue * DEFAULT_EQN_VALUE) / minNights;
        }

        // Determine if the benefit cap was truly exhausted by completed cycles.
        // Used to distinguish "Capped" (cap hit) from "Orphaned" (ran out of nights) for
        // span-stays partial cycles. We use the total cumulative cycles across ALL bookings
        // (cumulativeAtEnd / minNights) × benefitValue vs the cap, because bApplied only
        // reflects this booking's contribution, not the full campaign total.
        let isBenefitCapExhausted = false;
        const maxBonusPts = restrictions?.maxTotalBonusPoints;
        const maxRedemptionVal = restrictions?.maxRedemptionValue;
        if (maxBonusPts != null && b.rewardType === "points") {
          const totalCyclesEarned = Math.floor(cumulativeAtEnd / minNights);
          const totalPointsFromCycles = totalCyclesEarned * bValue;
          isBenefitCapExhausted = totalPointsFromCycles >= maxBonusPts - 0.5;
        } else if (maxRedemptionVal != null && b.rewardType !== "points") {
          const totalCyclesEarned = Math.floor(cumulativeAtEnd / minNights);
          const totalValueFromCycles = totalCyclesEarned * bValue;
          isBenefitCapExhausted = totalValueFromCycles >= Number(maxRedemptionVal) - 0.001;
        } else {
          // No explicit cap: if the benefit is NOT orphaned, a $0 partial cycle means
          // bApplied was exhausted by completed cycles → treat as capped.
          // If the benefit IS orphaned, the partial cycle is missing future stays → stays orphaned.
          isBenefitCapExhausted = !isOrphaned;
        }

        let nightsAccountedFor = 0;
        let currentStart = cumulativeAtStart;
        let remainingBApplied = bApplied;

        while (nightsAccountedFor < nightsInStay) {
          const progressInCurrentCycle = currentStart % minNights;
          const nightsToCompleteCycle = minNights - progressInCurrentCycle;
          const nightsInThisSegment = Math.min(
            nightsInStay - nightsAccountedFor,
            nightsToCompleteCycle
          );

          const segmentEndProgress = (currentStart + nightsInThisSegment) % minNights;
          const isCycleFinished = segmentEndProgress === 0;

          // 'Fill Up' strategy: Give this segment its full expected value until we run out of bApplied
          const expectedSegmentValue = expectedValuePerNight * nightsInThisSegment;
          const segmentValue = Math.min(remainingBApplied, expectedSegmentValue);
          remainingBApplied -= segmentValue;

          const isSegmentCapped =
            expectedSegmentValue > 0 && segmentValue < expectedSegmentValue - 0.001;

          const isCappedToZero = isSegmentCapped && segmentValue < 0.01;

          // A partial cycle is "orphaned" if:
          //   - the promotion/benefit is marked orphaned, OR
          //   - the cap is NOT exhausted but the segment is $0 (ran out of bApplied without
          //     hitting the cap — cycle simply can't be completed with remaining eligible nights)
          // Pre-qualifying takes precedence: if this stay is pre-qualifying, don't mark as orphaned.
          const isSegmentOrphaned =
            !isCycleFinished &&
            (isOrphaned || (!isPreQualifying && !isBenefitCapExhausted && isCappedToZero));

          // Show "Capped Reward Cycle" only when the benefit cap was truly exhausted.
          // If the partial cycle is $0 because eligible nights ran out (not cap), show as Orphaned.
          const isMaxedOut = isCappedToZero && isBenefitCapExhausted;

          let label = "";
          let description = "";

          const isSegmentPreQualifying = isPreQualifying && !isCycleFinished;

          if (progressInCurrentCycle === 0) {
            if (nightsInThisSegment === minNights) {
              label = `Full Reward Cycle (${minNights}/${minNights} nights)`;
              description = `A complete reward cycle finished within this stay.`;
            } else {
              label = isMaxedOut
                ? `Capped Reward Cycle (${nightsInThisSegment}/${minNights} nights)`
                : isSegmentOrphaned
                  ? `Orphaned Reward Cycle (${nightsInThisSegment}/${minNights} nights)`
                  : isSegmentPreQualifying
                    ? `Pre-qualifying Reward Cycle (${nightsInThisSegment}/${minNights} nights)`
                    : `New Reward Cycle (${nightsInThisSegment}/${minNights} nights)`;
              description = isMaxedOut
                ? `Started a new reward cycle, but the benefit cap has already been reached.`
                : isSegmentOrphaned
                  ? `Started a new reward cycle, but it cannot be completed.`
                  : isSegmentPreQualifying
                    ? `Started a new reward cycle. A future booked stay will complete it.`
                    : `Started a new reward cycle. Pending more nights to complete.`;
            }
          } else {
            if (isCycleFinished) {
              label = `Cycle Completion (${nightsInThisSegment} nights)`;
              description = `Completed the reward cycle started in a previous stay.`;
            } else {
              label = isMaxedOut
                ? `Capped Cycle Progress (${nightsInThisSegment} nights)`
                : isSegmentOrphaned
                  ? `Orphaned Cycle Progress (${nightsInThisSegment} nights)`
                  : isSegmentPreQualifying
                    ? `Pre-qualifying Cycle Progress (${nightsInThisSegment} nights)`
                    : `Cycle Progress (${nightsInThisSegment} nights)`;
              description = isMaxedOut
                ? `Continued the reward cycle started in a previous stay, but the benefit cap has already been reached.`
                : isSegmentOrphaned
                  ? `Continued the reward cycle started in a previous stay, but it cannot be completed.`
                  : isSegmentPreQualifying
                    ? `Continued the reward cycle started in a previous stay. A future booked stay will complete it.`
                    : `Continued the reward cycle started in a previous stay. Still pending.`;
            }
          }

          const nightProgressLabel =
            nightsInThisSegment === 1
              ? `${cumulativeAtStart + nightsAccountedFor + 1} of ${minNights} nights`
              : `${nightsInThisSegment} nights towards ${minNights}-night goal`;

          let nightFormula = "";
          if (!isMaxedOut) {
            if (b.rewardType === "points") {
              const centsStr = formatCents(hotelCentsPerPoint);
              nightFormula = `(${nightProgressLabel}) × ${bValue.toLocaleString()} bonus pts × ${centsStr}¢`;
            } else if (b.rewardType === "cashback") {
              nightFormula = `(${nightProgressLabel}) × ${formatCurrency(bValue)} fixed cashback`;
            } else {
              nightFormula = `(${nightProgressLabel}) × ${formatCurrency(bValue)} ${b.rewardType}`;
            }
          }

          const capSuffix = isSegmentCapped ? " (capped)" : "";

          benefitSegments.push({
            label,
            value: segmentValue,
            formula: isMaxedOut
              ? ""
              : nightFormula +
                ` = ${formatCurrency(segmentValue)}` +
                capSuffix +
                (isCycleFinished
                  ? ""
                  : isSegmentOrphaned
                    ? " (orphaned)"
                    : isSegmentPreQualifying
                      ? " (pre-qualifying)"
                      : " (pending)"),
            description: isMaxedOut
              ? "This segment no longer applies because the promotion has been maxed out."
              : isSegmentOrphaned
                ? ORPHANED_PROMOTION_DESCRIPTION
                : description +
                  (isCycleFinished
                    ? " (Goal Met!)"
                    : isSegmentPreQualifying
                      ? " (Pre-qualifying)"
                      : " (Pending)") +
                  (isSegmentCapped ? " Reduced by redemption caps." : ""),
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

        const isMaxedOutOverall =
          bApplied < 0.01 &&
          expectedValuePerNight * nightsInStay > 0.01 &&
          !isOrphaned &&
          !isPreQualifying;

        const proportionalSuffix =
          pendingRatio && !isMaxedOutOverall
            ? isOrphaned
              ? " (Not enough future bookings to fulfill)"
              : isPreQualifying
                ? ` A future booked stay will complete this cycle${pendingRatio}.`
                : ` This bonus is pending additional stays${pendingRatio}.`
            : "";

        benefitDescriptionLine = isMaxedOutOverall
          ? "This promotion has been maxed out and no further rewards apply."
          : isOrphaned
            ? ORPHANED_PROMOTION_DESCRIPTION
            : isPreQualifying
              ? `Pre-qualifying: earned proportional rewards for ${nightsInStay} nights towards a ${minNights}-night requirement. Will be fully earned when the campaign completes.${proportionalSuffix}`
              : `Earned proportional rewards for ${nightsInStay} nights towards a ${minNights}-night requirement.${proportionalSuffix}`;

        if (bApplied < expectedValuePerNight * nightsInStay - 0.001 && !isMaxedOutOverall) {
          benefitDescriptionLine += " Reduced by redemption caps.";
        }
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

        const isMaxedOutOverall = isCapped && bApplied < 0.01 && !isOrphaned && !isPreQualifying;
        const multiplierPrefix = appliedMultiplier > 1 ? `${appliedMultiplier} × ` : "";
        const capSuffix = isCapped ? " (capped)" : "";

        let benefitFormula = "";
        let benefitDescription = "Reward based on stay criteria.";
        if (b.rewardType === "points") {
          const centsStr = formatCents(hotelCentsPerPoint);
          if (b.valueType === "multiplier") {
            const isBaseOnly = !b.pointsMultiplierBasis || b.pointsMultiplierBasis === "base_only";
            const effectiveBaseRate =
              resolveBasePointRate(booking.hotelChain ?? null, booking.hotelChainSubBrand) ?? 0;
            const basisPoints =
              isBaseOnly && effectiveBaseRate > 0
                ? Math.round(pretaxCost * effectiveBaseRate)
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

        if (isCapped && !isMaxedOutOverall) {
          benefitDescription += " Reduced by redemption caps.";
        }

        benefitDescriptionLine = isMaxedOutOverall
          ? "This promotion has been maxed out and no further rewards apply."
          : isOrphaned
            ? ORPHANED_PROMOTION_DESCRIPTION
            : isPreQualifying
              ? `Pre-qualifying — will be earned when campaign completes. ${benefitDescription}`
              : benefitDescription;

        // Standard segment
        benefitSegments.push({
          label: `Benefit: ${b.rewardType}`,
          value: bApplied,
          hideValue: isPreQualifying || undefined,
          formula: isMaxedOutOverall
            ? ""
            : `${benefitFormula} = ${formatCurrency(bApplied)}` +
              (isOrphaned ? " (orphaned)" : isPreQualifying ? " (pre-qualifying)" : ""),
          description: isMaxedOutOverall
            ? "This segment no longer applies because the promotion has been maxed out."
            : isOrphaned
              ? ORPHANED_PROMOTION_DESCRIPTION
              : isPreQualifying
                ? `Pre-qualifying — will be earned when campaign completes. ${benefitDescription}`
                : benefitDescription,
        });
      }

      groups.push({
        name: groupName,
        description: benefitDescriptionLine,
        segments: benefitSegments,
      });
    }

    const totalAppliedValue = groups.reduce(
      (sum, group) => sum + group.segments.reduce((sSum, s) => sSum + s.value, 0),
      0
    );

    return {
      id: bp.promotionId || bp.id || String(index),
      name: bp.promotion.name,
      appliedValue: totalAppliedValue,
      isOrphaned: isPromoOrphaned,
      isPreQualifying: isPromoPreQualifying,
      label: bp.promotion.name,
      description: `Rewards from ${bp.promotion.name}`,
      groups,
    };
  });
  const promoSavings = promotions.reduce((sum, p) => sum + p.appliedValue, 0);

  // 2. Portal Cashback
  // 3a. Card Benefit Savings (recurring credits, e.g. "$50/quarter Hilton credit")
  let cardBenefitSavings = 0;
  let cardBenefitCalc: CalculationDetail | undefined;
  if ((booking.bookingCardBenefits ?? []).length > 0) {
    const benefitSegments: CalculationSegment[] = (booking.bookingCardBenefits ?? []).map((bcb) => {
      const val = Number(bcb.appliedValue);
      return {
        label: bcb.cardBenefit.description,
        value: val,
        formula: formatCurrency(val),
        description: `Applied from card benefit: ${bcb.cardBenefit.description}. Uses total cost basis.`,
      };
    });
    cardBenefitSavings = benefitSegments.reduce((sum, s) => sum + s.value, 0);
    cardBenefitCalc = {
      label: "Card Benefits",
      appliedValue: cardBenefitSavings,
      description: "Recurring credits from your credit card applied to this booking.",
      groups: [{ name: "Card Credits", segments: benefitSegments }],
    };
  }

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
      appliedValue: portalCashback,
      description: `Rewards earned via ${booking.shoppingPortal.name}.`,
      groups: [
        {
          name: booking.shoppingPortal.name,
          segments: [
            {
              label: "Portal Reward",
              value: portalCashback,
              formula,
              description,
            },
          ],
        },
      ],
    };
  }

  // 3. Card Reward
  let cardReward = 0;
  let cardRewardCalc: CalculationDetail | undefined;
  if (booking.userCreditCard?.creditCard) {
    const baseRate = Number(booking.userCreditCard?.creditCard.rewardRate);
    const rules = booking.userCreditCard?.creditCard.rewardRules || [];
    const hotelId = booking.hotelChain?.id || booking.hotelChainId;
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

    const centsPerPoint = booking.userCreditCard?.creditCard.pointType
      ? Number(booking.userCreditCard?.creditCard.pointType.centsPerPoint)
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
        description: `Standard earning rate for the ${booking.userCreditCard?.creditCard.name}.`,
      });

      cardSegments.push({
        label: `Hotel/Booking Boost`,
        value: boostValue,
        formula: `${formatCurrency(totalCost)} (total cost) × ${multiplierToUse - baseRate}x boost × ${centsStr}¢ = ${formatCurrency(boostValue)}`,
        description: `Additional earning for booking with ${booking.hotelChain?.name ?? "this hotel"}.`,
      });
    } else {
      const baseValue = totalCost * baseRate * centsPerPoint;
      cardSegments.push({
        label: "Base Card Earning",
        value: baseValue,
        formula: `${formatCurrency(totalCost)} (total cost) × ${baseRate}x × ${centsStr}¢ = ${formatCurrency(baseValue)}`,
        description: `Standard earning rate for the ${booking.userCreditCard?.creditCard.name}.`,
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
      appliedValue: cardReward,
      description: `Total rewards earned using your ${booking.userCreditCard?.creditCard.name}.`,
      groups: [
        {
          name: booking.userCreditCard?.creditCard.name,
          segments: cardSegments,
        },
      ],
    };
  }

  // 4. Loyalty Points Earned
  let loyaltyPointsValue = 0;
  let loyaltyPointsCalc: CalculationDetail | undefined;
  if (booking.loyaltyPointsEarned && booking.hotelChain?.pointType) {
    const centsPerPoint = Number(booking.hotelChain.pointType.centsPerPoint);
    const pointName = booking.hotelChain.pointType.name || "points";
    const centsStr = formatCents(centsPerPoint);
    loyaltyPointsValue = booking.loyaltyPointsEarned * centsPerPoint;

    const loyaltySegments: CalculationSegment[] = [];
    const elite = booking.hotelChain?.userStatus?.eliteStatus;

    const effectiveBasePointRate = resolveBasePointRate(
      booking.hotelChain ?? null,
      booking.hotelChainSubBrand
    );

    if (
      elite &&
      !elite.isFixed &&
      elite.bonusPercentage != null &&
      effectiveBasePointRate != null
    ) {
      const baseRate = effectiveBasePointRate;
      const bonusPct = Number(elite.bonusPercentage);
      const calcCurrency = booking.hotelChain?.calculationCurrency ?? "USD";
      const calcCurrencyToUsdRate = booking.hotelChain?.calcCurrencyToUsdRate ?? null;
      // Convert USD pretax cost to the chain's calculation currency (e.g., EUR for Accor)
      const effectivePretaxCost =
        calcCurrency !== "USD" && calcCurrencyToUsdRate
          ? pretaxCost / calcCurrencyToUsdRate
          : pretaxCost;
      const basePoints = Math.round(effectivePretaxCost * baseRate);
      const bonusPoints = Math.round(basePoints * bonusPct);

      const costBasisNote =
        calcCurrency !== "USD" ? `pre-tax cost (calculated in ${calcCurrency})` : "pre-tax cost";
      loyaltySegments.push({
        label: "Base Loyalty Points",
        value: basePoints * centsPerPoint,
        formula: `${formatCurrency(effectivePretaxCost)} (pre-tax) × ${baseRate}x = ${basePoints.toLocaleString()} pts`,
        description: `Standard earning rate for this hotel chain, applied to the ${costBasisNote}.`,
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
      appliedValue: loyaltyPointsValue,
      description: `You earned ${booking.loyaltyPointsEarned.toLocaleString()} ${pointName} for this stay.`,
      groups: [
        {
          name: booking.hotelChain?.loyaltyProgram || "Loyalty Points",
          segments: loyaltySegments,
        },
      ],
    };
  }

  // 4b. Partnership Earns (e.g. Accor–Qantas miles)
  const partnershipEarns = booking.partnershipEarns ?? [];
  const partnershipEarnsValue = partnershipEarns.reduce((sum, e) => sum + e.earnedValue, 0);

  // 5. Points RedeemedValue
  let pointsRedeemedValue = 0;
  let pointsRedeemedCalc: CalculationDetail | undefined;
  if (booking.pointsRedeemed && booking.hotelChain?.pointType) {
    const centsPerPoint = Number(booking.hotelChain.pointType.centsPerPoint);
    const centsStr = formatCents(centsPerPoint);
    pointsRedeemedValue = booking.pointsRedeemed * centsPerPoint;

    pointsRedeemedCalc = {
      label: "Points Redeemed Value",
      appliedValue: pointsRedeemedValue,
      description: `The estimated value of the points you redeemed for this stay.`,
      groups: [
        {
          name: "Points Redemption",
          segments: [
            {
              label: "Points Redeemed",
              value: pointsRedeemedValue,
              formula: `${booking.pointsRedeemed.toLocaleString()} pts × ${centsStr}¢ = ${formatCurrency(pointsRedeemedValue)}`,
              description: `Estimated value based on ${centsStr}¢ per point.`,
            },
          ],
        },
      ],
    };
  }

  // 6. Certificates Value
  let certsValue = 0;
  let certsCalc: CalculationDetail | undefined;
  if (booking.certificates.length > 0 && booking.hotelChain?.pointType) {
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
      appliedValue: certsValue,
      description: `The total estimated value of certificates used for this stay.`,
      groups: [
        {
          name: "Free Night Certificates",
          segments: certSegments,
        },
      ],
    };
  }

  const netCost =
    totalCost -
    promoSavings -
    cardBenefitSavings -
    portalCashback -
    cardReward -
    loyaltyPointsValue -
    partnershipEarnsValue +
    pointsRedeemedValue +
    certsValue;

  return {
    totalCost,
    promoSavings,
    promotions,
    cardBenefitSavings,
    cardBenefitCalc,
    portalCashback,
    portalCashbackCalc,
    cardReward,
    cardRewardCalc,
    loyaltyPointsValue,
    loyaltyPointsCalc,
    partnershipEarns,
    partnershipEarnsValue,
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
