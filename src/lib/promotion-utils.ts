import { certTypeShortLabel } from "./cert-types";
import { Promotion, PromotionBenefit, PromotionTier } from "./types";

export function formatBenefit(benefit: PromotionBenefit): string {
  const num = typeof benefit.value === "string" ? parseFloat(benefit.value) : Number(benefit.value);
  switch (benefit.rewardType) {
    case "cashback":
      return benefit.valueType === "percentage"
        ? `${num}% cashback`
        : `$${num.toFixed(2)} cashback`;
    case "points":
      return benefit.valueType === "multiplier" ? `${num}x points` : `${num.toLocaleString()} pts`;
    case "certificate":
      const label = benefit.certType ? certTypeShortLabel(benefit.certType) : "";
      return `${num} ${label} cert${num !== 1 ? "s" : ""}`.replace(/\s+/g, " ");
    case "eqn":
      return `${num} EQN${num !== 1 ? "s" : ""}`;
    default:
      return String(num);
  }
}

export function formatBenefits(benefits: PromotionBenefit[], tiers: PromotionTier[] = []): string {
  // Simplified check as per bot feedback
  if (benefits.length === 0 && tiers.length === 0) return "—";

  if (tiers && tiers.length > 0) {
    const allTierBenefits: PromotionBenefit[] = [];
    tiers.forEach((t) => allTierBenefits.push(...t.benefits));

    if (allTierBenefits.length === 0) return "—";

    const formatted = Array.from(new Set(allTierBenefits.map((b) => formatBenefit(b))));

    if (tiers.length === 1) {
      return formatted.join(", ");
    }

    return `Multiple tiers: ${formatted.join(", ")}`;
  }

  return benefits.map(formatBenefit).join(", ");
}

export function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return "Always";
  const start = startDate
    ? new Date(startDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "No start date";
  const end = endDate
    ? new Date(endDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Ongoing";
  return `${start} - ${end}`;
}

export function getLinkedName(promo: Promotion): string {
  if (promo.hotelChain) return promo.hotelChain.name;
  if (promo.creditCard) return promo.creditCard.name;
  if (promo.shoppingPortal) return promo.shoppingPortal.name;
  return "-";
}

export function typeBadgeVariant(
  type: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (type) {
    case "credit_card":
      return "secondary";
    case "portal":
      return "outline";
    case "loyalty":
      return "default";
    default:
      return "secondary";
  }
}

export function typeLabel(type: string): string {
  switch (type) {
    case "credit_card":
      return "Credit Card";
    case "portal":
      return "Portal";
    case "loyalty":
      return "Loyalty";
    default:
      return type;
  }
}
