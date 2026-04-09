"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/page-spinner";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/use-api-query";
import { logger } from "@/lib/logger";
import { formatDate, formatCurrency } from "@/lib/utils";
import { formatBenefit, getLinkedName, typeLabel, typeBadgeVariant } from "@/lib/promotion-utils";
import {
  BOOKING_SOURCE_LABELS,
  BENEFIT_REWARD_TYPE_OPTIONS,
  PAYMENT_TYPES,
  ACCOMMODATION_TYPE_OPTIONS,
} from "@/lib/constants";
import { Promotion, PromotionBenefit, PromotionTier, PromotionRestrictionsData } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function labelFromOptions(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string
): string {
  return options.find((opt) => opt.value === value)?.label ?? value;
}

function rewardTypeLabel(type: string): string {
  return labelFromOptions(BENEFIT_REWARD_TYPE_OPTIONS, type);
}

function benefitBasis(
  b: PromotionBenefit,
  promoRestrictions: PromotionRestrictionsData | null
): string {
  const br = b.restrictions;
  const pr = promoRestrictions;
  const stackingR =
    br?.nightsStackable && br?.minNightsRequired != null
      ? br
      : pr?.nightsStackable && pr?.minNightsRequired != null
        ? pr
        : null;
  if (!stackingR) return "Per stay";
  return stackingR.minNightsRequired === 1
    ? "Per night"
    : `Per ${stackingR.minNightsRequired} nights`;
}

type RestrictionItem = { label: string; value: string; testId: string; compact?: string };

// Single source of truth for all restriction fields.
// omitNightsRequirement: true when nightsStackable is already shown as the benefit basis label.
function getRestrictionItems(
  r: PromotionRestrictionsData,
  { omitNightsRequirement = false } = {}
): RestrictionItem[] {
  const items: RestrictionItem[] = [];
  if (r.minSpend != null)
    items.push({
      label: "Min Spend",
      value: formatCurrency(Number(r.minSpend)),
      testId: "restriction-min-spend",
      compact: `Min spend ${formatCurrency(Number(r.minSpend))}`,
    });
  if (!omitNightsRequirement && r.minNightsRequired != null)
    items.push({
      label: "Min Nights",
      value: String(r.minNightsRequired),
      testId: "restriction-min-nights",
      compact: `Min ${r.minNightsRequired} nights`,
    });
  if (r.bookByDate)
    items.push({
      label: "Book By",
      value: formatDate(r.bookByDate),
      testId: "restriction-book-by",
      compact: `Book by ${formatDate(r.bookByDate)}`,
    });
  if (r.registrationDeadline)
    items.push({
      label: "Register By",
      value: formatDate(r.registrationDeadline),
      testId: "restriction-register-by",
      compact: `Register by ${formatDate(r.registrationDeadline)}`,
    });
  if (r.maxStayCount != null)
    items.push({
      label: "Max Stays",
      value: String(r.maxStayCount),
      testId: "restriction-max-stays",
      compact: `Max ${r.maxStayCount} stays`,
    });
  if (r.maxRewardCount != null)
    items.push({
      label: "Max Rewards",
      value: String(r.maxRewardCount),
      testId: "restriction-max-rewards",
      compact: `Max ${r.maxRewardCount} rewards`,
    });
  if (r.maxRedemptionValue != null)
    items.push({
      label: "Max Value",
      value: formatCurrency(Number(r.maxRedemptionValue)),
      testId: "restriction-max-value",
      compact: `Max ${formatCurrency(Number(r.maxRedemptionValue))}`,
    });
  if (r.maxTotalBonusPoints != null)
    items.push({
      label: "Max Bonus Points",
      value: Number(r.maxTotalBonusPoints).toLocaleString(),
      testId: "restriction-max-bonus-points",
      compact: `Max ${Number(r.maxTotalBonusPoints).toLocaleString()} pts`,
    });
  if (r.validDaysAfterRegistration != null)
    items.push({
      label: "Valid Days After Registration",
      value: String(r.validDaysAfterRegistration),
      testId: "restriction-valid-days",
      compact: `${r.validDaysAfterRegistration} days after registration`,
    });
  if (r.spanStays)
    items.push({ label: "Span Stays", value: "Yes", testId: "restriction-span-stays" });
  if (r.nightsStackable)
    items.push({ label: "Nights Stackable", value: "Yes", testId: "restriction-nights-stackable" });
  if (r.oncePerSubBrand)
    items.push({
      label: "Once Per Sub-brand",
      value: "Yes",
      testId: "restriction-once-per-sub-brand",
    });
  if (r.allowedPaymentTypes.length > 0)
    items.push({
      label: "Payment Types",
      value: r.allowedPaymentTypes.map((val) => labelFromOptions(PAYMENT_TYPES, val)).join(", "),
      testId: "restriction-payment-types",
    });
  if (r.allowedBookingSources.length > 0)
    items.push({
      label: "Booking Sources",
      value: r.allowedBookingSources.map((s) => BOOKING_SOURCE_LABELS[s] ?? s).join(", "),
      testId: "restriction-booking-sources",
    });
  if (r.allowedAccommodationTypes.length > 0)
    items.push({
      label: "Accommodation Types",
      value: r.allowedAccommodationTypes
        .map((val) => labelFromOptions(ACCOMMODATION_TYPE_OPTIONS, val))
        .join(", "),
      testId: "restriction-accommodation-types",
    });
  if (r.tieInRequiresPayment)
    items.push({
      label: "Tie-in Payment Required",
      value: "Yes",
      testId: "restriction-tie-in-payment",
    });
  if (r.allowedCountryCodes.length > 0)
    items.push({
      label: "Countries",
      value: r.allowedCountryCodes.join(", "),
      testId: "restriction-countries",
    });
  if (r.hotelChainId != null)
    items.push({
      label: "Hotel Chain",
      value: r.hotelChain?.name ?? r.hotelChainId,
      testId: "restriction-hotel-chain",
    });
  if (r.prerequisiteStayCount != null)
    items.push({
      label: "Prerequisite Stays",
      value: String(r.prerequisiteStayCount),
      testId: "restriction-prerequisite-stays",
      compact: `Prereq: ${r.prerequisiteStayCount} stays`,
    });
  if (r.prerequisiteNightCount != null)
    items.push({
      label: "Prerequisite Nights",
      value: String(r.prerequisiteNightCount),
      testId: "restriction-prerequisite-nights",
      compact: `Prereq: ${r.prerequisiteNightCount} nights`,
    });
  if (r.tieInCards.length > 0)
    items.push({
      label: "Tie-in Cards",
      value: `${r.tieInCards.length} card${r.tieInCards.length > 1 ? "s" : ""} required`,
      testId: "restriction-tie-in-cards",
    });
  if (r.subBrandRestrictions.length > 0) {
    const included = r.subBrandRestrictions
      .filter((s) => s.mode === "include")
      .map((s) => s.hotelChainSubBrand?.name ?? s.hotelChainSubBrandId);
    const excluded = r.subBrandRestrictions
      .filter((s) => s.mode === "exclude")
      .map((s) => s.hotelChainSubBrand?.name ?? s.hotelChainSubBrandId);
    const parts: string[] = [];
    if (included.length > 0) parts.push(`${included.join(", ")} only`);
    if (excluded.length > 0) parts.push(`Excl. ${excluded.join(", ")}`);
    items.push({ label: "Sub-brands", value: parts.join(" · "), testId: "restriction-sub-brands" });
  }
  return items;
}

function hasNonDefaultRestrictions(r: PromotionRestrictionsData): boolean {
  return getRestrictionItems(r).length > 0;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatTierRequirement(tier: PromotionTier): string {
  if (tier.minNights != null || tier.maxNights != null) {
    const min = tier.minNights ?? 0;
    const max = tier.maxNights;
    if (max != null && min === max) return `${ordinal(min)} night`;
    return max != null ? `${min}–${max} nights` : `${min}+ nights`;
  }
  const min = tier.minStays ?? 0;
  const max = tier.maxStays;
  if (max != null && min === max) return `${ordinal(min)} stay`;
  return max != null ? `${min}–${max} stays` : `${min}+ stays`;
}

function RestrictionsDisplay({ restrictions: r }: { restrictions: PromotionRestrictionsData }) {
  const items = getRestrictionItems(r);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map(({ label, value, testId }) => (
        <div key={testId}>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-medium" data-testid={testId}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PromotionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const {
    data: promo,
    loading,
    error: fetchError,
    clearError,
  } = useApiQuery<Promotion>(`/api/promotions/${id}`, {
    onError: (err) =>
      logger.error("Failed to fetch promotion", err.error, { id, status: err.status }),
  });

  if (loading && !promo) return <PageSpinner />;

  if (fetchError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Promotion Details</h1>
        <ErrorBanner error="Failed to load promotion. Please try again." onDismiss={clearError} />
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Promotion Details</h1>
        <p className="text-muted-foreground">Promotion not found.</p>
        <Link href="/promotions">
          <Button variant="outline">Back to Promotions</Button>
        </Link>
      </div>
    );
  }

  const registrationDate = promo.userPromotions?.[0]?.registrationDate ?? null;
  const linkedName = getLinkedName(promo);
  const hasTiers = promo.tiers.length > 0;
  const hasRestrictions =
    promo.restrictions != null && hasNonDefaultRestrictions(promo.restrictions);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-end gap-2">
        <Link href={`/promotions/${id}/edit`}>
          <Button>Edit</Button>
        </Link>
        <Link href="/promotions">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {/* Hero Card */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h1 className="text-xl font-bold" data-testid="hero-promo-name">
              {promo.name}
            </h1>
            <Badge variant={typeBadgeVariant(promo.type)} data-testid="hero-promo-type">
              {typeLabel(promo.type)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4">
            <div data-testid="hero-linked-to">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Linked To
              </p>
              <p className="font-medium">{linkedName}</p>
            </div>
            <div data-testid="hero-start-date">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Start Date
              </p>
              <p className="font-medium">{promo.startDate ? formatDate(promo.startDate) : "—"}</p>
            </div>
            <div data-testid="hero-end-date">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                End Date
              </p>
              <p className="font-medium">{promo.endDate ? formatDate(promo.endDate) : "—"}</p>
            </div>
            <div data-testid="hero-registration-date">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Registration
              </p>
              <p className="font-medium">{registrationDate ? formatDate(registrationDate) : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Earning Rules */}
        <Card>
          <CardContent>
            <p className="text-base font-semibold mb-4">Earning Rules</p>
            {hasTiers ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Benefits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promo.tiers.map((tier, i) => (
                    <TableRow key={tier.id} data-testid={`tier-row-${tier.id}`}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell data-testid={`tier-requirement-${tier.id}`}>
                        {formatTierRequirement(tier)}
                      </TableCell>
                      <TableCell data-testid={`tier-benefits-${tier.id}`}>
                        {tier.benefits.map(formatBenefit).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table data-testid="benefits-list">
                <TableHeader>
                  <TableRow>
                    <TableHead>Reward</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promo.benefits.map((b) => {
                    const basis = benefitBasis(b, promo.restrictions);
                    const benefitItems = b.restrictions
                      ? getRestrictionItems(b.restrictions, {
                          omitNightsRequirement: b.restrictions.nightsStackable,
                        })
                      : [];
                    const restrictionSummary =
                      benefitItems.length > 0
                        ? benefitItems
                            .map((i) => i.compact ?? (i.value === "Yes" ? i.label : i.value))
                            .join(" · ")
                        : null;
                    const note = [basis, restrictionSummary].filter(Boolean).join(" · ");
                    return (
                      <TableRow key={b.id} data-testid={`benefit-item-${b.id}`}>
                        <TableCell>{rewardTypeLabel(b.rewardType)}</TableCell>
                        <TableCell>
                          {formatBenefit(b)}
                          <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {hasRestrictions && (
          <Card data-testid="restrictions-card">
            <CardContent>
              <p className="text-base font-semibold mb-4">Eligibility &amp; Restrictions</p>
              <RestrictionsDisplay restrictions={promo.restrictions!} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
