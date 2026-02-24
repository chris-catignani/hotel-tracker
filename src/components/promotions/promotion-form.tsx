"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parseISO } from "date-fns";
import { Trash2, Plus } from "lucide-react";
import {
  PromotionFormData,
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  PromotionBenefitFormData,
  PointsMultiplierBasis,
} from "@/lib/types";
import { BENEFIT_REWARD_TYPE_OPTIONS } from "@/lib/constants";
import { CERT_TYPE_OPTIONS } from "@/lib/cert-types";

// Build cert type options from existing cert-types for use in the form
const CERT_OPTIONS = CERT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

interface HotelChainSubBrand {
  id: number;
  name: string;
}

interface HotelChain {
  id: number;
  name: string;
  hotelChainSubBrands: HotelChainSubBrand[];
}

interface CreditCard {
  id: number;
  name: string;
}

interface ShoppingPortal {
  id: number;
  name: string;
}

interface PromotionFormProps {
  initialData?: Partial<PromotionFormData>;
  onSubmit: (data: PromotionFormData) => Promise<void>;
  submitting: boolean;
  title: string;
  description: string;
  submitLabel: string;
}

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
  // cashback
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
  // cashback
  if (valueType === "percentage") return "Percentage (%)";
  return "Amount ($)";
}

interface BenefitRowProps {
  benefit: PromotionBenefitFormData;
  index: number;
  canRemove: boolean;
  onChange: (index: number, updated: PromotionBenefitFormData) => void;
  onRemove: (index: number) => void;
}

function BenefitRow({ benefit, index, canRemove, onChange, onRemove }: BenefitRowProps) {
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
    </div>
  );
}

const DEFAULT_BENEFIT: PromotionBenefitFormData = {
  rewardType: "cashback",
  valueType: "fixed",
  value: 0,
  certType: null,
  pointsMultiplierBasis: "base_only",
  sortOrder: 0,
};

export function PromotionForm({
  initialData,
  onSubmit,
  submitting,
  title,
  description,
  submitLabel,
}: PromotionFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState<PromotionType>(
    (initialData?.type as PromotionType) || "loyalty"
  );
  const [benefits, setBenefits] = useState<PromotionBenefitFormData[]>(
    initialData?.benefits && initialData.benefits.length > 0
      ? initialData.benefits
      : [{ ...DEFAULT_BENEFIT }]
  );
  const [hotelChainId, setHotelChainId] = useState<string>(
    initialData?.hotelChainId ? String(initialData.hotelChainId) : ""
  );
  const [hotelChainSubBrandId, setHotelChainSubBrandId] = useState<string>(
    initialData?.hotelChainSubBrandId ? String(initialData.hotelChainSubBrandId) : ""
  );
  const [creditCardId, setCreditCardId] = useState<string>(
    initialData?.creditCardId ? String(initialData.creditCardId) : ""
  );
  const [shoppingPortalId, setShoppingPortalId] = useState<string>(
    initialData?.shoppingPortalId ? String(initialData.shoppingPortalId) : ""
  );
  const [minSpend, setMinSpend] = useState(
    initialData?.minSpend ? String(initialData.minSpend) : ""
  );
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [portals, setPortals] = useState<ShoppingPortal[]>([]);

  useEffect(() => {
    fetch("/api/hotel-chains")
      .then((res) => res.json())
      .then(setHotelChains)
      .catch(console.error);
    fetch("/api/credit-cards")
      .then((res) => res.json())
      .then(setCreditCards)
      .catch(console.error);
    fetch("/api/portals")
      .then((res) => res.json())
      .then(setPortals)
      .catch(console.error);
  }, []);

  // Update form if initialData changes (for Edit mode after fetch)
  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (initialData.name !== undefined) setName(initialData.name);
      if (initialData.type !== undefined) setType(initialData.type as PromotionType);
      if (initialData.benefits !== undefined && initialData.benefits.length > 0)
        setBenefits(initialData.benefits);
      if (initialData.hotelChainId !== undefined)
        setHotelChainId(initialData.hotelChainId ? String(initialData.hotelChainId) : "");
      if (initialData.hotelChainSubBrandId !== undefined)
        setHotelChainSubBrandId(
          initialData.hotelChainSubBrandId ? String(initialData.hotelChainSubBrandId) : ""
        );
      if (initialData.creditCardId !== undefined)
        setCreditCardId(initialData.creditCardId ? String(initialData.creditCardId) : "");
      if (initialData.shoppingPortalId !== undefined)
        setShoppingPortalId(
          initialData.shoppingPortalId ? String(initialData.shoppingPortalId) : ""
        );
      if (initialData.minSpend !== undefined)
        setMinSpend(initialData.minSpend ? String(initialData.minSpend) : "");
      if (initialData.startDate !== undefined) setStartDate(initialData.startDate || "");
      if (initialData.endDate !== undefined) setEndDate(initialData.endDate || "");
      if (initialData.isActive !== undefined) setIsActive(initialData.isActive);
    }
  }, [initialData]);

  const handleBenefitChange = (index: number, updated: PromotionBenefitFormData) => {
    setBenefits((prev) => prev.map((b, i) => (i === index ? updated : b)));
  };

  const handleBenefitRemove = (index: number) => {
    setBenefits((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddBenefit = () => {
    setBenefits((prev) => [...prev, { ...DEFAULT_BENEFIT, sortOrder: prev.length }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body: PromotionFormData = {
      name,
      type,
      benefits: benefits.map((b, i) => ({ ...b, sortOrder: i })),
      isActive,
    };

    if (type === "loyalty" && hotelChainId) {
      body.hotelChainId = parseInt(hotelChainId);
      body.hotelChainSubBrandId = hotelChainSubBrandId ? parseInt(hotelChainSubBrandId) : null;
    } else {
      body.hotelChainId = null;
      body.hotelChainSubBrandId = null;
    }

    if (type === "credit_card" && creditCardId) {
      body.creditCardId = parseInt(creditCardId);
    } else {
      body.creditCardId = null;
    }

    if (type === "portal" && shoppingPortalId) {
      body.shoppingPortalId = parseInt(shoppingPortalId);
    } else {
      body.shoppingPortalId = null;
    }

    if (minSpend) {
      body.minSpend = parseFloat(minSpend);
    } else {
      body.minSpend = null;
    }

    body.startDate = startDate || null;
    body.endDate = endDate || null;

    await onSubmit(body);
  };

  const startDateObj = startDate ? parseISO(startDate) : undefined;
  const endDateObj = endDate ? parseISO(endDate) : undefined;

  const handleStartDateChange = (date?: Date) => {
    setStartDate(date ? format(date, "yyyy-MM-dd") : "");
  };

  const handleEndDateChange = (date?: Date) => {
    setEndDate(date ? format(date, "yyyy-MM-dd") : "");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Bonus Offer"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <AppSelect
              value={type}
              onValueChange={(v) => setType(v as PromotionType)}
              options={[
                { label: "Credit Card", value: "credit_card" },
                { label: "Portal", value: "portal" },
                { label: "Loyalty", value: "loyalty" },
              ]}
              placeholder="Select type..."
              data-testid="promotion-type-select"
            />
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            <Label>Benefits</Label>
            {benefits.map((benefit, index) => (
              <BenefitRow
                key={index}
                benefit={benefit}
                index={index}
                canRemove={benefits.length > 1}
                onChange={handleBenefitChange}
                onRemove={handleBenefitRemove}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBenefit}
              data-testid="benefit-add"
            >
              <Plus className="size-4 mr-2" />
              Add Benefit
            </Button>
          </div>

          {type === "loyalty" && (
            <div className="space-y-2">
              <Label>Hotel Chain</Label>
              <AppSelect
                value={hotelChainId}
                onValueChange={(v) => {
                  setHotelChainId(v);
                  setHotelChainSubBrandId("");
                }}
                options={hotelChains.map((chain) => ({
                  label: chain.name,
                  value: String(chain.id),
                }))}
                placeholder="Select hotel chain..."
                data-testid="hotel-chain-select"
              />
            </div>
          )}

          {type === "loyalty" &&
            hotelChainId &&
            (hotelChains.find((h) => h.id === Number(hotelChainId))?.hotelChainSubBrands.length ??
              0) > 0 && (
              <div className="space-y-2">
                <Label>Sub-brand</Label>
                <AppSelect
                  value={hotelChainSubBrandId || "all"}
                  onValueChange={(v) => setHotelChainSubBrandId(v === "all" ? "" : v)}
                  options={[
                    { label: "All sub-brands (no filter)", value: "all" },
                    ...(hotelChains
                      .find((h) => h.id === Number(hotelChainId))
                      ?.hotelChainSubBrands.map((sb) => ({
                        label: sb.name,
                        value: String(sb.id),
                      })) || []),
                  ]}
                  placeholder="Select sub-brand..."
                  data-testid="sub-brand-select"
                />
              </div>
            )}

          {type === "credit_card" && (
            <div className="space-y-2">
              <Label>Credit Card</Label>
              <AppSelect
                value={creditCardId}
                onValueChange={setCreditCardId}
                options={creditCards.map((card) => ({
                  label: card.name,
                  value: String(card.id),
                }))}
                placeholder="Select credit card..."
                data-testid="credit-card-select"
              />
            </div>
          )}

          {type === "portal" && (
            <div className="space-y-2">
              <Label>Shopping Portal</Label>
              <AppSelect
                value={shoppingPortalId}
                onValueChange={setShoppingPortalId}
                options={portals.map((portal) => ({
                  label: portal.name,
                  value: String(portal.id),
                }))}
                placeholder="Select portal..."
                data-testid="shopping-portal-select"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="minSpend">Minimum Spend</Label>
            <Input
              id="minSpend"
              type="number"
              step="0.01"
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <DatePicker
                id="startDate"
                date={startDateObj}
                setDate={handleStartDateChange}
                placeholder="Select start date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <DatePicker
                id="endDate"
                date={endDateObj}
                setDate={handleEndDateChange}
                placeholder="Select end date"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded border-gray-300"
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm p-4 -mx-6 -mb-6 border-t md:static md:bg-transparent md:p-0 md:m-0 md:border-none flex gap-4 z-10">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 md:flex-none"
              data-testid="promotion-form-submit"
            >
              {submitting ? "Saving..." : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              asChild
              className="flex-1 md:flex-none"
              data-testid="promotion-form-cancel"
            >
              <Link href="/promotions">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
