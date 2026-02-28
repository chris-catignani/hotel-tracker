"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { parseISO } from "date-fns";
import { X } from "lucide-react";
import type { PromotionRestrictionsFormData } from "@/lib/types";
import { AppSelect } from "@/components/ui/app-select";

// ─── Types & constants ────────────────────────────────────────────────────────

export type RestrictionKey =
  | "min_spend"
  | "book_by_date"
  | "min_nights"
  | "redemption_caps"
  | "once_per_sub_brand"
  | "tie_in_cards"
  | "registration"
  | "sub_brand_scope"
  | "payment_type";

/** Canonical display order — cards and picker options always follow this order. */
export const RESTRICTION_ORDER: RestrictionKey[] = [
  "payment_type",
  "min_spend",
  "book_by_date",
  "min_nights",
  "redemption_caps",
  "once_per_sub_brand",
  "tie_in_cards",
  "registration",
  "sub_brand_scope",
];

/** Restriction keys available at the benefit level (not all apply per-benefit). */
export const BENEFIT_RESTRICTION_ORDER: RestrictionKey[] = [
  "payment_type",
  "min_spend",
  "min_nights",
  "redemption_caps",
  "once_per_sub_brand",
  "tie_in_cards",
  "sub_brand_scope",
];

export const RESTRICTION_LABELS: Record<RestrictionKey, string> = {
  payment_type: "Payment Type",
  min_spend: "Minimum Spend",
  book_by_date: "Book By Date",
  min_nights: "Min Nights Required",
  redemption_caps: "Redemption Caps",
  once_per_sub_brand: "Once Per Sub-Brand",
  tie_in_cards: "Tie-In Credit Cards",
  registration: "Registration & Validity",
  sub_brand_scope: "Sub-Brand Scope",
};

// ─── Auto-detect active restrictions from saved restrictions data ─────────────

export function deriveActiveRestrictions(
  r: PromotionRestrictionsFormData | null | undefined
): Set<RestrictionKey> {
  const keys = new Set<RestrictionKey>();
  if (!r) return keys;
  if (r.allowedPaymentTypes && r.allowedPaymentTypes.length > 0) keys.add("payment_type");
  if (r.minSpend) keys.add("min_spend");
  if (r.bookByDate) keys.add("book_by_date");
  if (r.minNightsRequired) keys.add("min_nights");
  if (r.maxStayCount || r.maxRewardCount || r.maxRedemptionValue || r.maxTotalBonusPoints)
    keys.add("redemption_caps");
  if (r.oncePerSubBrand === true) keys.add("once_per_sub_brand");
  if (r.tieInCreditCardIds && r.tieInCreditCardIds.length > 0) keys.add("tie_in_cards");
  if (r.registrationDeadline || r.validDaysAfterRegistration || r.registrationDate)
    keys.add("registration");
  if (r.subBrandIncludeIds.length > 0 || r.subBrandExcludeIds.length > 0)
    keys.add("sub_brand_scope");
  return keys;
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────

export function RestrictionCard({
  title,
  testId,
  onRemove,
  children,
}: {
  title: string;
  testId: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3" data-testid={`restriction-card-${testId}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          data-testid={`restriction-remove-${testId}`}
        >
          <X className="size-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}

// ─── Individual restriction cards ─────────────────────────────────────────────

export function MinSpendCard({
  minSpend,
  onMinSpendChange,
  onRemove,
}: {
  minSpend: string;
  onMinSpendChange: (val: string) => void;
  onRemove: () => void;
}) {
  return (
    <RestrictionCard title="Minimum Spend" testId="min_spend" onRemove={onRemove}>
      <div className="space-y-2">
        <Label htmlFor="minSpend">Minimum Spend ($)</Label>
        <Input
          id="minSpend"
          type="number"
          step="0.01"
          value={minSpend}
          onChange={(e) => onMinSpendChange(e.target.value)}
          placeholder="e.g. 200.00"
        />
      </div>
    </RestrictionCard>
  );
}

export function BookByDateCard({
  bookByDate,
  onBookByDateChange,
  onRemove,
}: {
  bookByDate: string;
  onBookByDateChange: (date?: Date) => void;
  onRemove: () => void;
}) {
  const bookByDateObj = bookByDate ? parseISO(bookByDate) : undefined;
  return (
    <RestrictionCard title="Book By Date" testId="book_by_date" onRemove={onRemove}>
      <div className="space-y-2">
        <Label htmlFor="bookByDate">Book By Date</Label>
        <DatePicker
          id="bookByDate"
          date={bookByDateObj}
          setDate={onBookByDateChange}
          placeholder="Select book by date"
          data-testid="promotion-book-by-date"
        />
      </div>
    </RestrictionCard>
  );
}

export function MinNightsCard({
  minNightsRequired,
  nightsStackable,
  spanStays,
  onMinNightsChange,
  onNightsStackableChange,
  onSpanStaysChange,
  onRemove,
}: {
  minNightsRequired: string;
  nightsStackable: boolean;
  spanStays: boolean;
  onMinNightsChange: (val: string) => void;
  onNightsStackableChange: (val: boolean) => void;
  onSpanStaysChange: (val: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <RestrictionCard title="Min Nights Required" testId="min_nights" onRemove={onRemove}>
      <div className="space-y-2">
        <Label htmlFor="minNightsRequired">Min Nights</Label>
        <Input
          id="minNightsRequired"
          type="number"
          step="1"
          value={minNightsRequired}
          onChange={(e) => onMinNightsChange(e.target.value)}
          placeholder="e.g. 2"
          data-testid="promotion-min-nights-required"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="nightsStackable"
          type="checkbox"
          checked={nightsStackable}
          onChange={(e) => onNightsStackableChange(e.target.checked)}
          className="size-4 rounded border-gray-300"
          data-testid="promotion-nights-stackable"
        />
        <Label htmlFor="nightsStackable">Stackable (multiply by number of stays)</Label>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="spanStays"
          type="checkbox"
          checked={spanStays}
          onChange={(e) => onSpanStaysChange(e.target.checked)}
          className="size-4 rounded border-gray-300"
          data-testid="promotion-span-stays"
        />
        <Label htmlFor="spanStays">Span Multiple Stays (proportional rewards)</Label>
      </div>
    </RestrictionCard>
  );
}

export function RedemptionCapsCard({
  maxStayCount,
  maxRewardCount,
  maxRedemptionValue,
  maxTotalBonusPoints,
  onMaxStayCountChange,
  onMaxRewardCountChange,
  onMaxRedemptionValueChange,
  onMaxTotalBonusPointsChange,
  onRemove,
}: {
  maxStayCount: string;
  maxRewardCount: string;
  maxRedemptionValue: string;
  maxTotalBonusPoints: string;
  onMaxStayCountChange: (val: string) => void;
  onMaxRewardCountChange: (val: string) => void;
  onMaxRedemptionValueChange: (val: string) => void;
  onMaxTotalBonusPointsChange: (val: string) => void;
  onRemove: () => void;
}) {
  return (
    <RestrictionCard title="Redemption Caps" testId="redemption_caps" onRemove={onRemove}>
      <div className="space-y-2">
        <Label htmlFor="maxStayCount">Max Stay Count (Promotion-level)</Label>
        <Input
          id="maxStayCount"
          type="number"
          step="1"
          value={maxStayCount}
          onChange={(e) => onMaxStayCountChange(e.target.value)}
          placeholder="e.g. 3"
          data-testid="promotion-max-stay-count"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxRewardCount">Max Reward Count (Benefit-level)</Label>
        <Input
          id="maxRewardCount"
          type="number"
          step="1"
          value={maxRewardCount}
          onChange={(e) => onMaxRewardCountChange(e.target.value)}
          placeholder="e.g. 10"
          data-testid="promotion-max-reward-count"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxRedemptionValue">Max Redemption Value ($)</Label>
        <Input
          id="maxRedemptionValue"
          type="number"
          step="0.01"
          value={maxRedemptionValue}
          onChange={(e) => onMaxRedemptionValueChange(e.target.value)}
          placeholder="e.g. 50.00"
          data-testid="promotion-max-redemption-value"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxTotalBonusPoints">Max Total Bonus Points</Label>
        <Input
          id="maxTotalBonusPoints"
          type="number"
          step="1"
          value={maxTotalBonusPoints}
          onChange={(e) => onMaxTotalBonusPointsChange(e.target.value)}
          placeholder="e.g. 10000"
          data-testid="promotion-max-total-bonus-points"
        />
      </div>
    </RestrictionCard>
  );
}

export function OncePerSubBrandCard({ onRemove }: { onRemove: () => void }) {
  return (
    <RestrictionCard title="Once Per Sub-Brand" testId="once_per_sub_brand" onRemove={onRemove}>
      <p className="text-xs text-muted-foreground">
        This promotion can only apply once per hotel sub-brand within the promo period.
      </p>
    </RestrictionCard>
  );
}

export function TieInCardsCard({
  creditCards,
  tieInCreditCardIds,
  tieInRequiresPayment,
  onTieInCreditCardIdsChange,
  onTieInRequiresPaymentChange,
  onRemove,
}: {
  creditCards: Array<{ id: string; name: string }>;
  tieInCreditCardIds: string[];
  tieInRequiresPayment: boolean;
  onTieInCreditCardIdsChange: (ids: string[]) => void;
  onTieInRequiresPaymentChange: (val: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <RestrictionCard title="Tie-In Credit Cards" testId="tie_in_cards" onRemove={onRemove}>
      <p className="text-xs text-muted-foreground mb-2">
        This benefit only applies when the booking&apos;s payment card matches one of these cards.
      </p>
      <div className="space-y-3" data-testid="tie-in-credit-cards">
        <AppSelect
          multiple
          value={tieInCreditCardIds}
          onValueChange={onTieInCreditCardIdsChange}
          options={creditCards.map((c) => ({ label: c.name, value: c.id }))}
          placeholder="Select credit cards..."
          searchPlaceholder="Search credit cards..."
        />
      </div>
      {tieInCreditCardIds.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <input
            id="tieInRequiresPayment"
            type="checkbox"
            checked={tieInRequiresPayment}
            onChange={(e) => onTieInRequiresPaymentChange(e.target.checked)}
            className="size-4 rounded border-gray-300"
            data-testid="tie-in-requires-payment"
          />
          <div>
            <Label htmlFor="tieInRequiresPayment">Requires Payment with Card</Label>
            <p className="text-xs text-muted-foreground">
              {tieInRequiresPayment
                ? "Must pay with one of these cards."
                : "Holding one of these cards is sufficient."}
            </p>
          </div>
        </div>
      )}
    </RestrictionCard>
  );
}

export function RegistrationCard({
  registrationDeadline,
  validDaysAfterRegistration,
  registrationDate,
  onRegistrationDeadlineChange,
  onValidDaysChange,
  onRegistrationDateChange,
  onRemove,
  showRegistrationDate = true,
}: {
  registrationDeadline: string;
  validDaysAfterRegistration: string;
  registrationDate: string;
  onRegistrationDeadlineChange: (date?: Date) => void;
  onValidDaysChange: (val: string) => void;
  onRegistrationDateChange: (date?: Date) => void;
  onRemove: () => void;
  showRegistrationDate?: boolean;
}) {
  const registrationDeadlineObj = registrationDeadline ? parseISO(registrationDeadline) : undefined;
  const registrationDateObj = registrationDate ? parseISO(registrationDate) : undefined;
  return (
    <RestrictionCard title="Registration & Validity" testId="registration" onRemove={onRemove}>
      <p className="text-xs text-muted-foreground">
        For promotions that require registration — specify the deadline and how long they stay
        valid.
      </p>
      <div className="space-y-2">
        <Label htmlFor="registrationDeadline">Registration Deadline</Label>
        <DatePicker
          id="registrationDeadline"
          date={registrationDeadlineObj}
          setDate={onRegistrationDeadlineChange}
          placeholder="Last date to register"
          data-testid="promotion-registration-deadline"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="validDaysAfterRegistration">Validity Duration (Days)</Label>
        <Input
          id="validDaysAfterRegistration"
          type="number"
          step="1"
          value={validDaysAfterRegistration}
          onChange={(e) => onValidDaysChange(e.target.value)}
          placeholder="Days valid from registration date"
          data-testid="promotion-valid-days-after-registration"
        />
        <p className="text-[0.7rem] text-muted-foreground">
          If set, matching logic will use Registration Date + Duration as the effective end date.
        </p>
      </div>
      {showRegistrationDate && (
        <div className="space-y-2">
          <Label htmlFor="registrationDate">Your Registration Date</Label>
          <DatePicker
            id="registrationDate"
            date={registrationDateObj}
            setDate={onRegistrationDateChange}
            placeholder="When did you register?"
            data-testid="promotion-registration-date"
          />
          <p className="text-[0.7rem] text-muted-foreground">
            Recording your registration date activates the personal validity window.
          </p>
        </div>
      )}
    </RestrictionCard>
  );
}

const PAYMENT_TYPE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "cash", label: "Cash", description: "Bookings paid (at least partially) with cash" },
  {
    value: "points",
    label: "Points",
    description: "Bookings paid (at least partially) with points",
  },
  {
    value: "cert",
    label: "Certificates",
    description: "Bookings paid (at least partially) with certificates",
  },
];

export function PaymentTypeCard({
  allowedPaymentTypes,
  onAllowedPaymentTypesChange,
  onRemove,
}: {
  allowedPaymentTypes: string[];
  onAllowedPaymentTypesChange: (types: string[]) => void;
  onRemove: () => void;
}) {
  return (
    <RestrictionCard title="Payment Type" testId="payment_type" onRemove={onRemove}>
      <p className="text-xs text-muted-foreground">
        Only applies to bookings that use the selected payment method(s). Unchecked methods are
        excluded.
      </p>
      <div className="flex flex-col gap-2" data-testid="payment-type-options">
        {PAYMENT_TYPE_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="size-4 rounded border-gray-300 mt-0.5"
              checked={allowedPaymentTypes.includes(opt.value)}
              onChange={(e) => {
                const newTypes = e.target.checked
                  ? [...allowedPaymentTypes, opt.value]
                  : allowedPaymentTypes.filter((t) => t !== opt.value);
                onAllowedPaymentTypesChange(newTypes);
              }}
              data-testid={`payment-type-${opt.value}`}
            />
            <div>
              <span className="text-sm font-medium">{opt.label}</span>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>
    </RestrictionCard>
  );
}

export function SubBrandScopeCard({
  subBrands,
  subBrandIncludeIds,
  subBrandExcludeIds,
  onIncludeIdsChange,
  onExcludeIdsChange,
  onRemove,
}: {
  subBrands: Array<{ id: string; name: string }>;
  subBrandIncludeIds: string[];
  subBrandExcludeIds: string[];
  onIncludeIdsChange: (ids: string[]) => void;
  onExcludeIdsChange: (ids: string[]) => void;
  onRemove: () => void;
}) {
  const [mode, setMode] = useState<"include" | "exclude">(
    subBrandIncludeIds.length > 0 ? "include" : "exclude"
  );

  const options = subBrands.map((sb) => ({ label: sb.name, value: sb.id }));

  return (
    <RestrictionCard title="Sub-Brand Scope" testId="sub_brand_scope" onRemove={onRemove}>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode("include")}
          className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
            mode === "include"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-accent"
          }`}
          data-testid="sub-brand-scope-mode-include"
        >
          Include only
        </button>
        <button
          type="button"
          onClick={() => setMode("exclude")}
          className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
            mode === "exclude"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-accent"
          }`}
          data-testid="sub-brand-scope-mode-exclude"
        >
          Exclude
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {mode === "include"
          ? "Only applies to bookings at the selected sub-brands."
          : "Applies to all sub-brands EXCEPT the selected ones."}
      </p>
      <div className="space-y-3" data-testid="sub-brand-scope-list">
        <AppSelect
          multiple
          value={mode === "include" ? subBrandIncludeIds : subBrandExcludeIds}
          onValueChange={mode === "include" ? onIncludeIdsChange : onExcludeIdsChange}
          options={options}
          placeholder={`Select sub-brands to ${mode}...`}
          searchPlaceholder="Search sub-brands..."
        />
      </div>
    </RestrictionCard>
  );
}
