"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PromotionRewardType,
  PromotionBenefitValueType,
  PromotionBenefitFormData,
  PointsMultiplierBasis,
  PromotionRestrictionsFormData,
  EMPTY_RESTRICTIONS,
} from "@/lib/types";
import { BENEFIT_REWARD_TYPE_OPTIONS } from "@/lib/constants";
import { CERT_TYPE_OPTIONS } from "@/lib/cert-types";
import {
  RestrictionKey,
  BENEFIT_RESTRICTION_ORDER,
  RESTRICTION_LABELS,
  deriveActiveRestrictions,
  PaymentTypeCard,
  MinSpendCard,
  MinNightsCard,
  RedemptionCapsCard,
  OncePerSubBrandCard,
  TieInCardsCard,
  SubBrandScopeCard,
} from "./restriction-cards";

const CERT_OPTIONS = CERT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

function getDefaultValueType(_rewardType: PromotionRewardType): PromotionBenefitValueType {
  return "fixed";
}

function getValuePlaceholder(
  rewardType: PromotionRewardType,
  valueType: PromotionBenefitValueType
): string {
  if (rewardType === "points") return valueType === "multiplier" ? "e.g. 2" : "e.g. 1000";
  if (rewardType === "certificate") return "e.g. 1";
  if (rewardType === "eqn") return "e.g. 1";
  if (valueType === "percentage") return "e.g. 10";
  return "e.g. 50";
}

function getValueLabel(
  rewardType: PromotionRewardType,
  valueType: PromotionBenefitValueType
): string {
  if (rewardType === "points") return valueType === "multiplier" ? "Multiplier (x)" : "Points";
  if (rewardType === "certificate") return "Number of Certificates";
  if (rewardType === "eqn") return "Bonus EQNs";
  if (valueType === "percentage") return "Percentage (%)";
  return "Amount ($)";
}

export interface BenefitRowProps {
  benefit: PromotionBenefitFormData;
  index: number;
  canRemove: boolean;
  subBrands: Array<{ id: string; name: string }>;
  creditCards: Array<{ id: string; name: string }>;
  onChange: (index: number, updated: PromotionBenefitFormData) => void;
  onRemove: (index: number) => void;
}

export function BenefitRow({
  benefit,
  index,
  canRemove,
  subBrands,
  creditCards,
  onChange,
  onRemove,
}: BenefitRowProps) {
  const [restrictionPickerOpen, setRestrictionPickerOpen] = useState(false);
  // Track which restriction cards are explicitly shown (independent of whether they have values).
  // Initialized from existing restrictions so edit-mode cards appear correctly.
  const [visibleRestrictionKeys, setVisibleRestrictionKeys] = useState<Set<RestrictionKey>>(
    () => new Set(deriveActiveRestrictions(benefit.restrictions))
  );

  const showValueType = benefit.rewardType === "cashback" || benefit.rewardType === "points";
  const showCertType = benefit.rewardType === "certificate";
  const showMultiplierBasis = benefit.rewardType === "points" && benefit.valueType === "multiplier";
  const valuePlaceholder = getValuePlaceholder(benefit.rewardType, benefit.valueType);
  const valueLabel = getValueLabel(benefit.rewardType, benefit.valueType);

  const handleRewardTypeChange = (rewardType: PromotionRewardType) => {
    onChange(index, {
      ...benefit,
      rewardType,
      valueType: getDefaultValueType(rewardType),
      certType: rewardType === "certificate" ? (benefit.certType ?? null) : null,
      pointsMultiplierBasis: undefined,
    });
  };

  const updateRestrictions = (updates: Partial<PromotionRestrictionsFormData>) => {
    const current = benefit.restrictions ?? { ...EMPTY_RESTRICTIONS };
    onChange(index, { ...benefit, restrictions: { ...current, ...updates } });
  };

  const addBenefitRestriction = (key: RestrictionKey) => {
    setRestrictionPickerOpen(false);
    setVisibleRestrictionKeys((prev) => new Set([...prev, key]));
    // For boolean keys, set the value immediately so it's saved even without further interaction
    if (key === "once_per_sub_brand") {
      updateRestrictions({ oncePerSubBrand: true });
    } else {
      // Ensure restrictions object exists for non-boolean keys
      if (!benefit.restrictions) {
        onChange(index, { ...benefit, restrictions: { ...EMPTY_RESTRICTIONS } });
      }
    }
  };

  const removeBenefitRestriction = (key: RestrictionKey) => {
    const current = benefit.restrictions ?? { ...EMPTY_RESTRICTIONS };
    let updates: Partial<PromotionRestrictionsFormData> = {};
    switch (key) {
      case "payment_type":
        updates = { allowedPaymentTypes: [] };
        break;
      case "min_spend":
        updates = { minSpend: "" };
        break;
      case "min_nights":
        updates = { minNightsRequired: "", nightsStackable: false, spanStays: false };
        break;
      case "redemption_caps":
        updates = { maxRedemptionCount: "", maxRedemptionValue: "", maxTotalBonusPoints: "" };
        break;
      case "once_per_sub_brand":
        updates = { oncePerSubBrand: false };
        break;
      case "tie_in_cards":
        updates = { tieInCreditCardIds: [], tieInRequiresPayment: false };
        break;
      case "sub_brand_scope":
        updates = { subBrandIncludeIds: [], subBrandExcludeIds: [] };
        break;
    }
    const newRestrictions = { ...current, ...updates };
    // If all fields are empty/default, set restrictions to null
    const hasContent =
      newRestrictions.allowedPaymentTypes.length > 0 ||
      newRestrictions.minSpend ||
      newRestrictions.minNightsRequired ||
      newRestrictions.maxRedemptionCount ||
      newRestrictions.maxRedemptionValue ||
      newRestrictions.maxTotalBonusPoints ||
      newRestrictions.oncePerSubBrand ||
      newRestrictions.tieInCreditCardIds.length > 0 ||
      newRestrictions.subBrandIncludeIds.length > 0 ||
      newRestrictions.subBrandExcludeIds.length > 0;
    onChange(index, { ...benefit, restrictions: hasContent ? newRestrictions : null });
    setVisibleRestrictionKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const showSubBrandScopeOption = subBrands.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4" data-testid={`benefit-row-${index}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Benefit {index + 1}</span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            data-testid={`benefit-remove-${index}`}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Reward Type</Label>
          <AppSelect
            value={benefit.rewardType}
            onValueChange={(v) => handleRewardTypeChange(v as PromotionRewardType)}
            options={[...BENEFIT_REWARD_TYPE_OPTIONS]}
            data-testid={`benefit-reward-type-${index}`}
          />
        </div>

        {showValueType && (
          <div className="space-y-2">
            <Label>Value Type</Label>
            <AppSelect
              value={benefit.valueType}
              onValueChange={(v) =>
                onChange(index, { ...benefit, valueType: v as PromotionBenefitValueType })
              }
              options={
                benefit.rewardType === "points"
                  ? [
                      { label: "Fixed (pts)", value: "fixed" },
                      { label: "Multiplier (x)", value: "multiplier" },
                    ]
                  : [
                      { label: "Fixed ($)", value: "fixed" },
                      { label: "Percentage (%)", value: "percentage" },
                    ]
              }
              data-testid={`benefit-value-type-${index}`}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>{valueLabel}</Label>
          <Input
            type="number"
            step="any"
            value={benefit.value || ""}
            onChange={(e) =>
              onChange(index, { ...benefit, value: parseFloat(e.target.value) || 0 })
            }
            placeholder={valuePlaceholder}
            data-testid={`benefit-value-${index}`}
            required
          />
        </div>

        {showCertType && (
          <div className="space-y-2">
            <Label>Certificate Type</Label>
            <AppSelect
              value={benefit.certType || ""}
              onValueChange={(v) => onChange(index, { ...benefit, certType: v || null })}
              options={[...CERT_OPTIONS]}
              placeholder="Select certificate type..."
              data-testid={`benefit-cert-type-${index}`}
            />
          </div>
        )}

        {showMultiplierBasis && (
          <div className="space-y-2">
            <Label>Multiplier Basis</Label>
            <AppSelect
              value={benefit.pointsMultiplierBasis || "base_only"}
              onValueChange={(v) =>
                onChange(index, { ...benefit, pointsMultiplierBasis: v as PointsMultiplierBasis })
              }
              options={[
                { label: "Base Rate Only", value: "base_only" },
                { label: "Base + Elite Bonus", value: "base_and_elite" },
              ]}
              placeholder="Select basis..."
              data-testid={`benefit-multiplier-basis-${index}`}
            />
          </div>
        )}
      </div>

      {/* Per-benefit restriction section */}
      <div className="space-y-2 pt-1">
        <Popover open={restrictionPickerOpen} onOpenChange={setRestrictionPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              data-testid={`benefit-restriction-picker-${index}`}
            >
              <Plus className="size-3" />
              Add benefit restriction
              <ChevronDown className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="flex flex-col gap-1">
              {BENEFIT_RESTRICTION_ORDER.map((key) => {
                if (key === "sub_brand_scope" && !showSubBrandScopeOption) return null;
                const isVisible = visibleRestrictionKeys.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isVisible}
                    onClick={() => addBenefitRestriction(key)}
                    className={`text-left px-3 py-2 rounded text-sm transition-colors ${
                      isVisible
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    }`}
                    data-testid={`benefit-restriction-option-${key}-${index}`}
                  >
                    {RESTRICTION_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Active benefit restriction cards */}
        {visibleRestrictionKeys.size > 0 && (
          <div className="space-y-2">
            {visibleRestrictionKeys.has("payment_type") && (
              <PaymentTypeCard
                allowedPaymentTypes={benefit.restrictions?.allowedPaymentTypes ?? []}
                onAllowedPaymentTypesChange={(types) =>
                  updateRestrictions({ allowedPaymentTypes: types })
                }
                onRemove={() => removeBenefitRestriction("payment_type")}
              />
            )}
            {visibleRestrictionKeys.has("min_spend") && (
              <MinSpendCard
                minSpend={benefit.restrictions?.minSpend ?? ""}
                onMinSpendChange={(v) => updateRestrictions({ minSpend: v })}
                onRemove={() => removeBenefitRestriction("min_spend")}
              />
            )}
            {visibleRestrictionKeys.has("min_nights") && (
              <MinNightsCard
                minNightsRequired={benefit.restrictions?.minNightsRequired ?? ""}
                nightsStackable={benefit.restrictions?.nightsStackable ?? false}
                spanStays={benefit.restrictions?.spanStays ?? false}
                onMinNightsChange={(v) => updateRestrictions({ minNightsRequired: v })}
                onNightsStackableChange={(v) => updateRestrictions({ nightsStackable: v })}
                onSpanStaysChange={(v) => updateRestrictions({ spanStays: v })}
                onRemove={() => removeBenefitRestriction("min_nights")}
              />
            )}
            {visibleRestrictionKeys.has("redemption_caps") && (
              <RedemptionCapsCard
                maxRedemptionCount={benefit.restrictions?.maxRedemptionCount ?? ""}
                maxRedemptionValue={benefit.restrictions?.maxRedemptionValue ?? ""}
                maxTotalBonusPoints={benefit.restrictions?.maxTotalBonusPoints ?? ""}
                onMaxRedemptionCountChange={(v) => updateRestrictions({ maxRedemptionCount: v })}
                onMaxRedemptionValueChange={(v) => updateRestrictions({ maxRedemptionValue: v })}
                onMaxTotalBonusPointsChange={(v) => updateRestrictions({ maxTotalBonusPoints: v })}
                onRemove={() => removeBenefitRestriction("redemption_caps")}
              />
            )}
            {visibleRestrictionKeys.has("once_per_sub_brand") && (
              <OncePerSubBrandCard
                onRemove={() => removeBenefitRestriction("once_per_sub_brand")}
              />
            )}
            {visibleRestrictionKeys.has("tie_in_cards") && (
              <TieInCardsCard
                creditCards={creditCards}
                tieInCreditCardIds={benefit.restrictions?.tieInCreditCardIds ?? []}
                tieInRequiresPayment={benefit.restrictions?.tieInRequiresPayment ?? false}
                onTieInCardChange={(cardId, checked) => {
                  const current = benefit.restrictions ?? { ...EMPTY_RESTRICTIONS };
                  const newIds = checked
                    ? [...current.tieInCreditCardIds, cardId]
                    : current.tieInCreditCardIds.filter((id) => id !== cardId);
                  updateRestrictions({
                    tieInCreditCardIds: newIds,
                    tieInRequiresPayment:
                      newIds.length === 0 ? false : current.tieInRequiresPayment,
                  });
                }}
                onTieInRequiresPaymentChange={(v) =>
                  updateRestrictions({ tieInRequiresPayment: v })
                }
                onRemove={() => removeBenefitRestriction("tie_in_cards")}
              />
            )}
            {visibleRestrictionKeys.has("sub_brand_scope") && showSubBrandScopeOption && (
              <SubBrandScopeCard
                subBrands={subBrands}
                subBrandIncludeIds={benefit.restrictions?.subBrandIncludeIds ?? []}
                subBrandExcludeIds={benefit.restrictions?.subBrandExcludeIds ?? []}
                onIncludeChange={(subBrandId, checked) => {
                  const current = benefit.restrictions ?? { ...EMPTY_RESTRICTIONS };
                  const newIds = checked
                    ? [...current.subBrandIncludeIds, subBrandId]
                    : current.subBrandIncludeIds.filter((id) => id !== subBrandId);
                  updateRestrictions({ subBrandIncludeIds: newIds });
                }}
                onExcludeChange={(subBrandId, checked) => {
                  const current = benefit.restrictions ?? { ...EMPTY_RESTRICTIONS };
                  const newIds = checked
                    ? [...current.subBrandExcludeIds, subBrandId]
                    : current.subBrandExcludeIds.filter((id) => id !== subBrandId);
                  updateRestrictions({ subBrandExcludeIds: newIds });
                }}
                onRemove={() => removeBenefitRestriction("sub_brand_scope")}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const DEFAULT_BENEFIT: PromotionBenefitFormData = {
  rewardType: "cashback",
  valueType: "fixed",
  value: 0,
  certType: null,
  pointsMultiplierBasis: "base_only",
  sortOrder: 0,
  restrictions: null,
};
