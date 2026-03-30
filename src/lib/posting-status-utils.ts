import { PostingStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

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
  pointTypeName: string | null
): string {
  if (rewardType === "cashback") return formatCurrency(value);
  const abbr = pointTypeName ? abbreviatePointType(pointTypeName) : "";
  return `${Math.round(value).toLocaleString()}${abbr ? ` ${abbr}` : ""} pts`;
}

function abbreviatePointType(name: string): string {
  // e.g. "Membership Rewards" → "MR", "ThankYou Points" → "TY"
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("");
}

export function formatPortalValue(cashbackValue: number): string {
  return formatCurrency(cashbackValue);
}

export function formatPromotionValue(bp: {
  rewardType: string;
  bonusPointsApplied: number | null;
  appliedValue: number | string;
}): string {
  const v = Number(bp.appliedValue);
  if (bp.rewardType === "points" && bp.bonusPointsApplied != null) {
    return `+${bp.bonusPointsApplied.toLocaleString()} pts`;
  }
  if (bp.rewardType === "cashback") return formatCurrency(v);
  if (bp.rewardType === "eqn") return `+${v} EQNs`;
  if (bp.rewardType === "certificate") return "Cert";
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
