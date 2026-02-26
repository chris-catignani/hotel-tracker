"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { Trash2 } from "lucide-react";
import {
  PromotionRewardType,
  PromotionBenefitValueType,
  PromotionBenefitFormData,
  PointsMultiplierBasis,
} from "@/lib/types";
import { BENEFIT_REWARD_TYPE_OPTIONS } from "@/lib/constants";
import { CERT_TYPE_OPTIONS } from "@/lib/cert-types";

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
  hasTieInCard: boolean;
  onChange: (index: number, updated: PromotionBenefitFormData) => void;
  onRemove: (index: number) => void;
}

export function BenefitRow({
  benefit,
  index,
  canRemove,
  hasTieInCard,
  onChange,
  onRemove,
}: BenefitRowProps) {
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

      {hasTieInCard && (
        <div className="flex items-center gap-2 pt-1">
          <input
            id={`benefit-is-tie-in-${index}`}
            type="checkbox"
            checked={benefit.isTieIn}
            onChange={(e) => onChange(index, { ...benefit, isTieIn: e.target.checked })}
            className="size-4 rounded border-gray-300"
            data-testid={`benefit-is-tie-in-${index}`}
          />
          <div>
            <Label htmlFor={`benefit-is-tie-in-${index}`} className="text-sm">
              Tie-In Benefit (boosted)
            </Label>
            <p className="text-xs text-muted-foreground">
              Only applies when the tie-in card condition is met.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export const DEFAULT_BENEFIT: PromotionBenefitFormData = {
  rewardType: "cashback",
  valueType: "fixed",
  value: 0,
  certType: null,
  pointsMultiplierBasis: "base_only",
  isTieIn: false,
  sortOrder: 0,
};
