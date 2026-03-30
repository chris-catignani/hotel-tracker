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
  _programName: string | null
): string | null {
  if (loyaltyPointsEarned == null) return null;
  return `${loyaltyPointsEarned.toLocaleString()} pts`;
}

export function formatCardRewardValue(
  value: number,
  rewardType: string,
  pointTypeName: string | null,
  usdCentsPerPoint?: number | null
): string {
  if (rewardType === "cashback") return formatCurrency(value);
  const centsPerPoint = usdCentsPerPoint ?? 0.01;
  const points = Math.round(value / centsPerPoint);
  const abbr = pointTypeName ? abbreviatePointType(pointTypeName) : "";
  return `${points.toLocaleString()}${abbr ? ` ${abbr}` : ""} pts`;
}

function abbreviatePointType(name: string): string {
  // e.g. "Membership Rewards" → "MR", "ThankYou Points" → "TY"
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("");
}

export function formatPortalValue(
  cashbackValue: number,
  rewardType?: string | null,
  pointTypeName?: string | null,
  usdCentsPerPoint?: number | null
): string {
  if (!rewardType || rewardType === "cashback") return formatCurrency(cashbackValue);
  const centsPerPoint = usdCentsPerPoint ?? 0.01;
  const points = Math.round(cashbackValue / centsPerPoint);
  const abbr = pointTypeName ? abbreviatePointType(pointTypeName) : "";
  return `${points.toLocaleString()}${abbr ? ` ${abbr}` : ""} pts`;
}

export function formatPromotionValue(bp: {
  rewardType?: string;
  promotion?: { benefits?: { rewardType: string }[] };
  bonusPointsApplied: number | null;
  appliedValue: number | string;
}): string {
  const v = Number(bp.appliedValue);
  // bonus_points_applied is the authoritative signal for points-type benefits
  if (bp.bonusPointsApplied != null) {
    return `+${bp.bonusPointsApplied.toLocaleString()} pts`;
  }
  const rewardType = bp.rewardType ?? bp.promotion?.benefits?.[0]?.rewardType;
  if (rewardType === "cashback") return formatCurrency(v);
  if (rewardType === "eqn") return `+${Math.round(v / DEFAULT_EQN_VALUE)} EQNs`;
  if (rewardType === "certificate") return "Cert";
  return formatCurrency(v);
}

export function formatPartnershipValue(pointsEarned: number, pointTypeName: string): string {
  const abbr = abbreviatePointType(pointTypeName);
  return `${Math.round(pointsEarned).toLocaleString()}${abbr ? ` ${abbr}` : ""} pts`;
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
  early_checkin: "Early Checkin",
  other: "Perk",
};

export function formatPerkValue(
  benefitType: string,
  dollarValue: number | null,
  label?: string | null
): string {
  if (dollarValue != null) return formatCurrency(dollarValue);
  if (label) return label;
  return PERK_LABELS[benefitType] ?? "Perk";
}

export function statusLabel(status: PostingStatus): string {
  if (status === "posted") return "✓ Posted";
  if (status === "failed") return "✗ Failed";
  return "⏳ Pending";
}

export function statusColorClass(status: PostingStatus): string {
  if (status === "posted") return "bg-green-100 text-green-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}
