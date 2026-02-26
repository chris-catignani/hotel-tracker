"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { parseISO } from "date-fns";
import { X } from "lucide-react";
import type { PromotionFormData, PromotionExclusion } from "@/lib/types";

// ─── Types & constants ────────────────────────────────────────────────────────

export type RestrictionKey =
  | "min_spend"
  | "book_by_date"
  | "min_nights"
  | "redemption_caps"
  | "once_per_sub_brand"
  | "tie_in_cards"
  | "registration"
  | "sub_brand_exclusions";

/** Canonical display order — cards and picker options always follow this order. */
export const RESTRICTION_ORDER: RestrictionKey[] = [
  "min_spend",
  "book_by_date",
  "min_nights",
  "redemption_caps",
  "once_per_sub_brand",
  "tie_in_cards",
  "registration",
  "sub_brand_exclusions",
];

export const RESTRICTION_LABELS: Record<RestrictionKey, string> = {
  min_spend: "Minimum Spend",
  book_by_date: "Book By Date",
  min_nights: "Min Nights Required",
  redemption_caps: "Redemption Caps",
  once_per_sub_brand: "Once Per Sub-Brand",
  tie_in_cards: "Tie-In Credit Cards",
  registration: "Registration & Validity",
  sub_brand_exclusions: "Sub-Brand Exclusions",
};

// ─── Auto-detect active restrictions from saved promotion data ────────────────

export function deriveActiveRestrictions(
  data: (Partial<PromotionFormData> & { exclusions?: PromotionExclusion[] }) | undefined
): Set<RestrictionKey> {
  const keys = new Set<RestrictionKey>();
  if (!data) return keys;
  if (data.minSpend != null) keys.add("min_spend");
  if (data.bookByDate) keys.add("book_by_date");
  if (data.minNightsRequired != null) keys.add("min_nights");
  if (
    data.maxRedemptionCount != null ||
    data.maxRedemptionValue != null ||
    data.maxTotalBonusPoints != null
  )
    keys.add("redemption_caps");
  if (data.oncePerSubBrand === true) keys.add("once_per_sub_brand");
  if (data.tieInCreditCardIds && data.tieInCreditCardIds.length > 0) keys.add("tie_in_cards");
  if (data.registrationDeadline || data.validDaysAfterRegistration != null || data.registrationDate)
    keys.add("registration");
  if (data.exclusions && data.exclusions.length > 0) keys.add("sub_brand_exclusions");
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
  onMinNightsChange,
  onNightsStackableChange,
  onRemove,
}: {
  minNightsRequired: string;
  nightsStackable: boolean;
  onMinNightsChange: (val: string) => void;
  onNightsStackableChange: (val: boolean) => void;
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
    </RestrictionCard>
  );
}

export function RedemptionCapsCard({
  maxRedemptionCount,
  maxRedemptionValue,
  maxTotalBonusPoints,
  onMaxRedemptionCountChange,
  onMaxRedemptionValueChange,
  onMaxTotalBonusPointsChange,
  onRemove,
}: {
  maxRedemptionCount: string;
  maxRedemptionValue: string;
  maxTotalBonusPoints: string;
  onMaxRedemptionCountChange: (val: string) => void;
  onMaxRedemptionValueChange: (val: string) => void;
  onMaxTotalBonusPointsChange: (val: string) => void;
  onRemove: () => void;
}) {
  return (
    <RestrictionCard title="Redemption Caps" testId="redemption_caps" onRemove={onRemove}>
      <div className="space-y-2">
        <Label htmlFor="maxRedemptionCount">Max Redemption Count</Label>
        <Input
          id="maxRedemptionCount"
          type="number"
          step="1"
          value={maxRedemptionCount}
          onChange={(e) => onMaxRedemptionCountChange(e.target.value)}
          placeholder="e.g. 3"
          data-testid="promotion-max-redemption-count"
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
  onTieInCardChange,
  onTieInRequiresPaymentChange,
  onRemove,
}: {
  creditCards: Array<{ id: string; name: string }>;
  tieInCreditCardIds: string[];
  tieInRequiresPayment: boolean;
  onTieInCardChange: (cardId: string, checked: boolean) => void;
  onTieInRequiresPaymentChange: (val: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <RestrictionCard title="Tie-In Credit Cards" testId="tie_in_cards" onRemove={onRemove}>
      <p className="text-xs text-muted-foreground">
        Individual benefits can be marked as &ldquo;tie-in&rdquo; — they only apply when the
        booking&apos;s payment card matches one of these cards.
      </p>
      <div className="flex flex-col gap-2" data-testid="tie-in-credit-cards">
        {creditCards.map((card) => (
          <label key={card.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="size-4 rounded border-gray-300"
              checked={tieInCreditCardIds.includes(card.id)}
              onChange={(e) => onTieInCardChange(card.id, e.target.checked)}
              data-testid={`tie-in-credit-card-${card.id}`}
            />
            <span className="text-sm">{card.name}</span>
          </label>
        ))}
      </div>
      {tieInCreditCardIds.length > 0 && (
        <div className="flex items-center gap-2">
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
}: {
  registrationDeadline: string;
  validDaysAfterRegistration: string;
  registrationDate: string;
  onRegistrationDeadlineChange: (date?: Date) => void;
  onValidDaysChange: (val: string) => void;
  onRegistrationDateChange: (date?: Date) => void;
  onRemove: () => void;
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
    </RestrictionCard>
  );
}

export function SubBrandExclusionsCard({
  subBrands,
  exclusionSubBrandIds,
  onExclusionChange,
  onRemove,
}: {
  subBrands: Array<{ id: string; name: string }>;
  exclusionSubBrandIds: string[];
  onExclusionChange: (subBrandId: string, checked: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <RestrictionCard title="Sub-Brand Exclusions" testId="sub_brand_exclusions" onRemove={onRemove}>
      <p className="text-xs text-muted-foreground">
        This promotion will not apply to bookings at the selected sub-brands.
      </p>
      <div className="flex flex-col gap-2" data-testid="exclusion-sub-brands">
        {subBrands.map((sb) => (
          <label key={sb.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="size-4 rounded border-gray-300"
              checked={exclusionSubBrandIds.includes(sb.id)}
              onChange={(e) => onExclusionChange(sb.id, e.target.checked)}
              data-testid={`exclusion-sub-brand-${sb.id}`}
            />
            <span className="text-sm">{sb.name}</span>
          </label>
        ))}
      </div>
    </RestrictionCard>
  );
}
