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
import { Promotion, PromotionTier, PromotionRestrictionsData } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTierRequirement(tier: PromotionTier): string {
  if (tier.minNights != null || tier.maxNights != null) {
    const min = tier.minNights ?? 0;
    const max = tier.maxNights;
    return max != null ? `${min}–${max} nights` : `${min}+ nights`;
  }
  const min = tier.minStays ?? 0;
  const max = tier.maxStays;
  return max != null ? `${min}–${max} stays` : `${min}+ stays`;
}

function hasNonDefaultRestrictions(r: PromotionRestrictionsData): boolean {
  return !!(
    r.minSpend != null ||
    r.minNightsRequired != null ||
    r.bookByDate ||
    r.registrationDeadline ||
    r.maxStayCount != null ||
    r.maxRewardCount != null ||
    r.maxRedemptionValue != null ||
    r.maxTotalBonusPoints != null ||
    r.validDaysAfterRegistration != null ||
    r.spanStays ||
    r.nightsStackable ||
    r.oncePerSubBrand ||
    r.allowedPaymentTypes.length > 0 ||
    r.allowedBookingSources.length > 0 ||
    r.allowedAccommodationTypes.length > 0 ||
    r.tieInCards.length > 0 ||
    r.subBrandRestrictions.length > 0
  );
}

function RestrictionsDisplay({ restrictions: r }: { restrictions: PromotionRestrictionsData }) {
  const items: { label: string; value: string; testId: string }[] = [];

  if (r.minSpend != null)
    items.push({
      label: "Min Spend",
      value: formatCurrency(Number(r.minSpend)),
      testId: "restriction-min-spend",
    });
  if (r.minNightsRequired != null)
    items.push({
      label: "Min Nights",
      value: String(r.minNightsRequired),
      testId: "restriction-min-nights",
    });
  if (r.bookByDate)
    items.push({
      label: "Book By",
      value: formatDate(r.bookByDate),
      testId: "restriction-book-by",
    });
  if (r.registrationDeadline)
    items.push({
      label: "Register By",
      value: formatDate(r.registrationDeadline),
      testId: "restriction-register-by",
    });
  if (r.maxStayCount != null)
    items.push({
      label: "Max Stays",
      value: String(r.maxStayCount),
      testId: "restriction-max-stays",
    });
  if (r.maxRewardCount != null)
    items.push({
      label: "Max Rewards",
      value: String(r.maxRewardCount),
      testId: "restriction-max-rewards",
    });
  if (r.maxRedemptionValue != null)
    items.push({
      label: "Max Value",
      value: formatCurrency(Number(r.maxRedemptionValue)),
      testId: "restriction-max-value",
    });
  if (r.maxTotalBonusPoints != null)
    items.push({
      label: "Max Bonus Points",
      value: Number(r.maxTotalBonusPoints).toLocaleString(),
      testId: "restriction-max-bonus-points",
    });
  if (r.validDaysAfterRegistration != null)
    items.push({
      label: "Valid Days After Registration",
      value: String(r.validDaysAfterRegistration),
      testId: "restriction-valid-days",
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
      value: r.allowedPaymentTypes.join(", "),
      testId: "restriction-payment-types",
    });
  if (r.allowedBookingSources.length > 0)
    items.push({
      label: "Booking Sources",
      value: r.allowedBookingSources.join(", "),
      testId: "restriction-booking-sources",
    });
  if (r.allowedAccommodationTypes.length > 0)
    items.push({
      label: "Accommodation Types",
      value: r.allowedAccommodationTypes.join(", "),
      testId: "restriction-accommodation-types",
    });
  if (r.tieInCards.length > 0)
    items.push({
      label: "Tie-in Cards",
      value: `${r.tieInCards.length} card${r.tieInCards.length > 1 ? "s" : ""} required`,
      testId: "restriction-tie-in-cards",
    });
  if (r.subBrandRestrictions.length > 0) {
    const included = r.subBrandRestrictions.filter((s) => s.mode === "include").length;
    const excluded = r.subBrandRestrictions.filter((s) => s.mode === "exclude").length;
    const parts: string[] = [];
    if (included > 0) parts.push(`${included} included`);
    if (excluded > 0) parts.push(`${excluded} excluded`);
    items.push({ label: "Sub-brands", value: parts.join(", "), testId: "restriction-sub-brands" });
  }

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
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Linked to</p>
            <p className="font-medium" data-testid="hero-linked-to">
              {linkedName}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
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
              <ul className="space-y-2" data-testid="benefits-list">
                {promo.benefits.map((b) => (
                  <li key={b.id} className="text-sm" data-testid={`benefit-item-${b.id}`}>
                    {formatBenefit(b)}
                  </li>
                ))}
              </ul>
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
