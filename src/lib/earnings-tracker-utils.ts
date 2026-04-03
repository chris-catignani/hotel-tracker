import { PostingStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_EQN_VALUE } from "@/lib/constants";

export const NEXT_STATUS: Record<PostingStatus, PostingStatus> = {
  pending: "posted",
  posted: "failed",
  failed: "pending",
};

export function nextPostingStatus(current: PostingStatus): PostingStatus {
  return NEXT_STATUS[current];
}

export function formatLoyaltyValue(
  loyaltyPointsEarned: number | null,
  shortName: string | null
): string | null {
  if (loyaltyPointsEarned == null) return null;
  return `${loyaltyPointsEarned.toLocaleString()}${shortName ? ` ${shortName}` : ""} pts`;
}

export function formatCardRewardValue(
  value: number,
  rewardType: string,
  pointTypeShortName: string | null,
  usdCentsPerPoint?: number | null
): string {
  if (rewardType === "cashback") return formatCurrency(value);
  const centsPerPoint = usdCentsPerPoint ?? 0.01;
  const points = Math.round(value / centsPerPoint);
  return `${points.toLocaleString()}${pointTypeShortName ? ` ${pointTypeShortName}` : ""} pts`;
}

export function formatPortalValue(
  cashbackValue: number,
  rewardType?: string | null,
  pointTypeShortName?: string | null,
  usdCentsPerPoint?: number | null,
  rawPoints?: number | null
): string {
  if (!rewardType || rewardType === "cashback") return formatCurrency(cashbackValue);
  const centsPerPoint = Number(usdCentsPerPoint ?? 0.01);
  const points =
    rawPoints != null ? Math.round(rawPoints) : Math.round(cashbackValue / centsPerPoint);
  return `${points.toLocaleString()}${pointTypeShortName ? ` ${pointTypeShortName}` : ""} pts`;
}

export function formatPromotionValue(
  bp: {
    rewardType?: string;
    promotion?: { benefits?: { rewardType: string }[] };
    bonusPointsApplied: number | null;
    appliedValue: number | string;
  },
  pointTypeShortName?: string | null
): string {
  const v = Number(bp.appliedValue);
  // bonus_points_applied is the authoritative signal for points-type benefits
  if (bp.bonusPointsApplied != null) {
    return `${bp.bonusPointsApplied.toLocaleString()}${pointTypeShortName ? ` ${pointTypeShortName}` : ""} pts`;
  }
  const rewardType = bp.rewardType ?? bp.promotion?.benefits?.[0]?.rewardType;
  if (rewardType === "cashback") return formatCurrency(v);
  if (rewardType === "eqn") return `${Math.round(v / DEFAULT_EQN_VALUE)} EQNs`;
  if (rewardType === "certificate") return "Cert";
  return formatCurrency(v);
}

export function formatPartnershipValue(pointsEarned: number, pointTypeShortName: string): string {
  return `${Math.round(pointsEarned).toLocaleString()}${pointTypeShortName ? ` ${pointTypeShortName}` : ""} pts`;
}

export function formatCardBenefitValue(appliedValue: number): string {
  return formatCurrency(appliedValue);
}

const PERK_LABELS: Record<string, string> = {
  free_breakfast: "Free Breakfast",
  dining_credit: "Dining Credit",
  spa_credit: "Spa Credit",
  room_upgrade: "Room Upgrade",
  late_checkout: "Late Checkout",
  early_checkin: "Early Check-in",
  other: "Other Benefit",
};

export function formatBenefitLabel(benefitType: string): string {
  return PERK_LABELS[benefitType] ?? benefitType;
}

export function formatPerkValue(
  benefitType: string,
  dollarValue: number | null,
  label?: string | null,
  currency = "USD"
): string {
  if (dollarValue != null) return formatCurrency(dollarValue, currency);
  if (label) return label;
  return PERK_LABELS[benefitType] ?? "Perk";
}

export function statusIcon(status: PostingStatus): string {
  if (status === "posted") return "✓";
  if (status === "failed") return "✗";
  return "⏳";
}

export function statusColorClass(status: PostingStatus): string {
  if (status === "posted") return "bg-green-100 text-green-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}
