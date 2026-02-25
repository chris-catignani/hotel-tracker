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
  PromotionTierFormData,
  PointsMultiplierBasis,
  PromotionExclusion,
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
  initialData?: Partial<PromotionFormData> & { exclusions?: PromotionExclusion[] };
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
  const [isSingleUse, setIsSingleUse] = useState(initialData?.isSingleUse ?? false);
  const [maxRedemptionCount, setMaxRedemptionCount] = useState(
    initialData?.maxRedemptionCount ? String(initialData.maxRedemptionCount) : ""
  );
  const [maxRedemptionValue, setMaxRedemptionValue] = useState(
    initialData?.maxRedemptionValue ? String(initialData.maxRedemptionValue) : ""
  );
  const [maxTotalBonusPoints, setMaxTotalBonusPoints] = useState(
    initialData?.maxTotalBonusPoints ? String(initialData.maxTotalBonusPoints) : ""
  );
  const [minNightsRequired, setMinNightsRequired] = useState(
    initialData?.minNightsRequired ? String(initialData.minNightsRequired) : ""
  );
  const [nightsStackable, setNightsStackable] = useState(initialData?.nightsStackable ?? false);
  const [bookByDate, setBookByDate] = useState(initialData?.bookByDate || "");
  const [oncePerSubBrand, setOncePerSubBrand] = useState(initialData?.oncePerSubBrand ?? false);
  const [exclusionSubBrandIds, setExclusionSubBrandIds] = useState<number[]>(
    initialData?.exclusions?.map((e) => e.hotelChainSubBrandId) ?? []
  );
  const [isTiered, setIsTiered] = useState(
    () => (initialData?.tiers && initialData.tiers.length > 0) ?? false
  );
  const [tiers, setTiers] = useState<PromotionTierFormData[]>(
    initialData?.tiers && initialData.tiers.length > 0
      ? initialData.tiers
      : [{ minStays: 1, maxStays: null, benefits: [{ ...DEFAULT_BENEFIT }] }]
  );

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
      if (initialData.isSingleUse !== undefined) setIsSingleUse(initialData.isSingleUse);
      if (initialData.maxRedemptionCount !== undefined)
        setMaxRedemptionCount(
          initialData.maxRedemptionCount ? String(initialData.maxRedemptionCount) : ""
        );
      if (initialData.maxRedemptionValue !== undefined)
        setMaxRedemptionValue(
          initialData.maxRedemptionValue ? String(initialData.maxRedemptionValue) : ""
        );
      if (initialData.maxTotalBonusPoints !== undefined)
        setMaxTotalBonusPoints(
          initialData.maxTotalBonusPoints ? String(initialData.maxTotalBonusPoints) : ""
        );
      if (initialData.minNightsRequired !== undefined)
        setMinNightsRequired(
          initialData.minNightsRequired ? String(initialData.minNightsRequired) : ""
        );
      if (initialData.nightsStackable !== undefined)
        setNightsStackable(initialData.nightsStackable);
      if (initialData.bookByDate !== undefined) setBookByDate(initialData.bookByDate || "");
      if (initialData.oncePerSubBrand !== undefined)
        setOncePerSubBrand(initialData.oncePerSubBrand);
      if (initialData.exclusions !== undefined)
        setExclusionSubBrandIds(initialData.exclusions.map((e) => e.hotelChainSubBrandId));
      if (initialData.tiers !== undefined) {
        const hasTiers = initialData.tiers.length > 0;
        setIsTiered(hasTiers);
        if (hasTiers) setTiers(initialData.tiers);
      }
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

  const handleTierChange = (tierIndex: number, updated: PromotionTierFormData) => {
    setTiers((prev) => prev.map((t, i) => (i === tierIndex ? updated : t)));
  };

  const handleTierRemove = (tierIndex: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== tierIndex));
  };

  const handleAddTier = () => {
    setTiers((prev) => {
      const last = prev[prev.length - 1];
      const nextMin = last != null ? (last.maxStays ?? last.minStays) + 1 : 1;
      return [...prev, { minStays: nextMin, maxStays: null, benefits: [{ ...DEFAULT_BENEFIT }] }];
    });
  };

  const handleTierBenefitChange = (
    tierIndex: number,
    benefitIndex: number,
    updated: PromotionBenefitFormData
  ) => {
    setTiers((prev) =>
      prev.map((t, i) =>
        i === tierIndex
          ? { ...t, benefits: t.benefits.map((b, bi) => (bi === benefitIndex ? updated : b)) }
          : t
      )
    );
  };

  const handleTierBenefitRemove = (tierIndex: number, benefitIndex: number) => {
    setTiers((prev) =>
      prev.map((t, i) =>
        i === tierIndex ? { ...t, benefits: t.benefits.filter((_, bi) => bi !== benefitIndex) } : t
      )
    );
  };

  const handleTierAddBenefit = (tierIndex: number) => {
    setTiers((prev) =>
      prev.map((t, i) =>
        i === tierIndex
          ? {
              ...t,
              benefits: [...t.benefits, { ...DEFAULT_BENEFIT, sortOrder: t.benefits.length }],
            }
          : t
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const withSortOrder = (bs: PromotionBenefitFormData[]) =>
      bs.map((b, i) => ({ ...b, sortOrder: i }));

    const body: PromotionFormData = {
      name,
      type,
      benefits: isTiered ? [] : withSortOrder(benefits),
      tiers: isTiered
        ? [...tiers]
            .sort((a, b) => a.minStays - b.minStays)
            .map((tier) => ({ ...tier, benefits: withSortOrder(tier.benefits) }))
        : [],
      isActive,
    };

    if (type === "loyalty" && hotelChainId) {
      body.hotelChainId = parseInt(hotelChainId);
      body.hotelChainSubBrandId = hotelChainSubBrandId ? parseInt(hotelChainSubBrandId) : null;
      body.exclusionSubBrandIds = exclusionSubBrandIds;
    } else {
      body.hotelChainId = null;
      body.hotelChainSubBrandId = null;
      body.exclusionSubBrandIds = [];
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

    body.isSingleUse = isSingleUse;
    if (maxRedemptionCount) {
      body.maxRedemptionCount = parseInt(maxRedemptionCount);
    } else {
      body.maxRedemptionCount = null;
    }
    if (maxRedemptionValue) {
      body.maxRedemptionValue = parseFloat(maxRedemptionValue);
    } else {
      body.maxRedemptionValue = null;
    }
    if (maxTotalBonusPoints) {
      body.maxTotalBonusPoints = parseInt(maxTotalBonusPoints);
    } else {
      body.maxTotalBonusPoints = null;
    }
    if (minNightsRequired) {
      body.minNightsRequired = parseInt(minNightsRequired);
    } else {
      body.minNightsRequired = null;
    }
    body.nightsStackable = nightsStackable;
    body.bookByDate = bookByDate || null;
    body.oncePerSubBrand = oncePerSubBrand;

    await onSubmit(body);
  };

  const startDateObj = startDate ? parseISO(startDate) : undefined;
  const endDateObj = endDate ? parseISO(endDate) : undefined;
  const bookByDateObj = bookByDate ? parseISO(bookByDate) : undefined;

  const selectedChainSubBrands =
    hotelChains.find((h) => h.id === Number(hotelChainId))?.hotelChainSubBrands ?? [];

  const handleStartDateChange = (date?: Date) => {
    setStartDate(date ? format(date, "yyyy-MM-dd") : "");
  };

  const handleEndDateChange = (date?: Date) => {
    setEndDate(date ? format(date, "yyyy-MM-dd") : "");
  };

  const handleBookByDateChange = (date?: Date) => {
    setBookByDate(date ? format(date, "yyyy-MM-dd") : "");
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

          {/* Tiered Promotion toggle */}
          <div className="flex items-center gap-2">
            <input
              id="isTiered"
              type="checkbox"
              checked={isTiered}
              onChange={(e) => setIsTiered(e.target.checked)}
              className="size-4 rounded border-gray-300"
              data-testid="promotion-is-tiered"
            />
            <div>
              <Label htmlFor="isTiered">Tiered Promotion</Label>
              <p className="text-xs text-muted-foreground">
                Different benefits apply based on how many stays the guest has accumulated.
              </p>
            </div>
          </div>

          {/* Flat Benefits (shown when not tiered) */}
          {!isTiered && (
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
          )}

          {/* Tiered Benefits (shown when tiered) */}
          {isTiered && (
            <div className="space-y-4">
              <Label>Tiers</Label>
              {tiers.map((tier, tierIndex) => (
                <div
                  key={tierIndex}
                  className="rounded-lg border p-4 space-y-3"
                  data-testid={`tier-${tierIndex}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Tier {tierIndex + 1}
                    </span>
                    {tiers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTierRemove(tierIndex)}
                        data-testid={`tier-remove-${tierIndex}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Min Stay #</Label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={tier.minStays || ""}
                        onChange={(e) =>
                          handleTierChange(tierIndex, {
                            ...tier,
                            minStays: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        data-testid={`tier-min-stays-${tierIndex}`}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Stay # (optional)</Label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={tier.maxStays ?? ""}
                        onChange={(e) =>
                          handleTierChange(tierIndex, {
                            ...tier,
                            maxStays: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        placeholder="No limit"
                        data-testid={`tier-max-stays-${tierIndex}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Benefits for this tier</Label>
                    {tier.benefits.map((benefit, benefitIndex) => (
                      <BenefitRow
                        key={benefitIndex}
                        benefit={benefit}
                        index={benefitIndex}
                        canRemove={tier.benefits.length > 1}
                        onChange={(bi, updated) => handleTierBenefitChange(tierIndex, bi, updated)}
                        onRemove={(bi) => handleTierBenefitRemove(tierIndex, bi)}
                      />
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTierAddBenefit(tierIndex)}
                      data-testid={`tier-add-benefit-${tierIndex}`}
                    >
                      <Plus className="size-4 mr-2" />
                      Add Benefit
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTier}
                data-testid="tier-add"
              >
                <Plus className="size-4 mr-2" />
                Add Tier
              </Button>
            </div>
          )}

          {type === "loyalty" && (
            <div className="space-y-2">
              <Label>Hotel Chain</Label>
              <AppSelect
                value={hotelChainId}
                onValueChange={(v) => {
                  setHotelChainId(v);
                  setHotelChainSubBrandId("");
                  setExclusionSubBrandIds([]);
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

          {type === "loyalty" && hotelChainId && selectedChainSubBrands.length > 0 && (
            <div className="space-y-2">
              <Label>Sub-brand</Label>
              <AppSelect
                value={hotelChainSubBrandId || "all"}
                onValueChange={(v) => setHotelChainSubBrandId(v === "all" ? "" : v)}
                options={[
                  { label: "All sub-brands (no filter)", value: "all" },
                  ...selectedChainSubBrands.map((sb) => ({
                    label: sb.name,
                    value: String(sb.id),
                  })),
                ]}
                placeholder="Select sub-brand..."
                data-testid="sub-brand-select"
              />
            </div>
          )}

          {type === "loyalty" && hotelChainId && selectedChainSubBrands.length > 0 && (
            <div className="space-y-2">
              <Label>Excluded Sub-Brands</Label>
              <p className="text-xs text-muted-foreground">
                This promotion will not apply to bookings at the selected sub-brands.
              </p>
              <div className="flex flex-col gap-2" data-testid="exclusion-sub-brands">
                {selectedChainSubBrands.map((sb) => (
                  <label key={sb.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-gray-300"
                      checked={exclusionSubBrandIds.includes(sb.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setExclusionSubBrandIds((prev) => [...prev, sb.id]);
                        } else {
                          setExclusionSubBrandIds((prev) => prev.filter((id) => id !== sb.id));
                        }
                      }}
                      data-testid={`exclusion-sub-brand-${sb.id}`}
                    />
                    <span className="text-sm">{sb.name}</span>
                  </label>
                ))}
              </div>
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

          {/* Redemption Constraints */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium">Redemption Constraints</h3>

            <div className="flex items-center gap-2">
              <input
                id="isSingleUse"
                type="checkbox"
                checked={isSingleUse}
                onChange={(e) => setIsSingleUse(e.target.checked)}
                className="size-4 rounded border-gray-300"
                data-testid="promotion-single-use"
              />
              <Label htmlFor="isSingleUse">Single Use Only</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRedemptionCount">Max Redemption Count</Label>
              <Input
                id="maxRedemptionCount"
                type="number"
                step="1"
                value={maxRedemptionCount}
                onChange={(e) => setMaxRedemptionCount(e.target.value)}
                placeholder="Optional (e.g. 3)"
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
                onChange={(e) => setMaxRedemptionValue(e.target.value)}
                placeholder="Optional (e.g. 50.00)"
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
                onChange={(e) => setMaxTotalBonusPoints(e.target.value)}
                placeholder="Optional (e.g. 10000)"
                data-testid="promotion-max-total-bonus-points"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minNightsRequired">Min Nights Required</Label>
              <Input
                id="minNightsRequired"
                type="number"
                step="1"
                value={minNightsRequired}
                onChange={(e) => setMinNightsRequired(e.target.value)}
                placeholder="Optional (e.g. 2)"
                data-testid="promotion-min-nights-required"
              />
            </div>

            {minNightsRequired && (
              <div className="flex items-center gap-2">
                <input
                  id="nightsStackable"
                  type="checkbox"
                  checked={nightsStackable}
                  onChange={(e) => setNightsStackable(e.target.checked)}
                  className="size-4 rounded border-gray-300"
                  data-testid="promotion-nights-stackable"
                />
                <Label htmlFor="nightsStackable">Stackable (multiply by number of stays)</Label>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="bookByDate">Book By Date</Label>
              <DatePicker
                id="bookByDate"
                date={bookByDateObj}
                setDate={handleBookByDateChange}
                placeholder="Select book by date"
                data-testid="promotion-book-by-date"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="oncePerSubBrand"
                type="checkbox"
                checked={oncePerSubBrand}
                onChange={(e) => setOncePerSubBrand(e.target.checked)}
                className="size-4 rounded border-gray-300"
                data-testid="promotion-once-per-sub-brand"
              />
              <div>
                <Label htmlFor="oncePerSubBrand">Once Per Sub-Brand</Label>
                <p className="text-xs text-muted-foreground">
                  Promotion can only apply once per hotel sub-brand within the promo period.
                </p>
              </div>
            </div>
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
