"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parseISO } from "date-fns";
import { Trash2, Plus } from "lucide-react";
import {
  PromotionFormData,
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  PromotionBenefitFormData,
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
  const valuePlaceholder = getValuePlaceholder(benefit.rewardType, benefit.valueType);
  const valueLabel = getValueLabel(benefit.rewardType, benefit.valueType);

  const handleRewardTypeChange = (rewardType: PromotionRewardType) => {
    onChange(index, {
      ...benefit,
      rewardType,
      valueType: getDefaultValueType(rewardType),
      certType: rewardType === "certificate" ? (benefit.certType ?? null) : null,
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
          <Select
            value={benefit.rewardType}
            onValueChange={(v) => handleRewardTypeChange(v as PromotionRewardType)}
          >
            <SelectTrigger className="w-full" data-testid={`benefit-reward-type-${index}`}>
              <SelectValue placeholder="Select reward type..." />
            </SelectTrigger>
            <SelectContent>
              {BENEFIT_REWARD_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showValueType && (
          <div className="space-y-2">
            <Label>Value Type</Label>
            <Select
              value={benefit.valueType}
              onValueChange={(v) =>
                onChange(index, { ...benefit, valueType: v as PromotionBenefitValueType })
              }
            >
              <SelectTrigger className="w-full" data-testid={`benefit-value-type-${index}`}>
                <SelectValue placeholder="Select value type..." />
              </SelectTrigger>
              <SelectContent>
                {benefit.rewardType === "points" ? (
                  <>
                    <SelectItem value="fixed">Fixed (pts)</SelectItem>
                    <SelectItem value="multiplier">Multiplier (x)</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
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
            <Select
              value={benefit.certType || ""}
              onValueChange={(v) => onChange(index, { ...benefit, certType: v || null })}
            >
              <SelectTrigger className="w-full" data-testid={`benefit-cert-type-${index}`}>
                <SelectValue placeholder="Select certificate type..." />
              </SelectTrigger>
              <SelectContent>
                {CERT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={type} onValueChange={(v) => setType(v as PromotionType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="portal">Portal</SelectItem>
                <SelectItem value="loyalty">Loyalty</SelectItem>
              </SelectContent>
            </Select>
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
              <Select
                value={hotelChainId}
                onValueChange={(v) => {
                  setHotelChainId(v);
                  setHotelChainSubBrandId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select hotel chain..." />
                </SelectTrigger>
                <SelectContent>
                  {hotelChains.map((chain) => (
                    <SelectItem key={chain.id} value={String(chain.id)}>
                      {chain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "loyalty" &&
            hotelChainId &&
            (hotelChains.find((h) => h.id === Number(hotelChainId))?.hotelChainSubBrands.length ??
              0) > 0 && (
              <div className="space-y-2">
                <Label>Sub-brand</Label>
                <Select
                  value={hotelChainSubBrandId || "all"}
                  onValueChange={(v) => setHotelChainSubBrandId(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sub-brand..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sub-brands (no filter)</SelectItem>
                    {hotelChains
                      .find((h) => h.id === Number(hotelChainId))
                      ?.hotelChainSubBrands.map((sb) => (
                        <SelectItem key={sb.id} value={String(sb.id)}>
                          {sb.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          {type === "credit_card" && (
            <div className="space-y-2">
              <Label>Credit Card</Label>
              <Select value={creditCardId} onValueChange={setCreditCardId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select credit card..." />
                </SelectTrigger>
                <SelectContent>
                  {creditCards.map((card) => (
                    <SelectItem key={card.id} value={String(card.id)}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "portal" && (
            <div className="space-y-2">
              <Label>Shopping Portal</Label>
              <Select value={shoppingPortalId} onValueChange={setShoppingPortalId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select portal..." />
                </SelectTrigger>
                <SelectContent>
                  {portals.map((portal) => (
                    <SelectItem key={portal.id} value={String(portal.id)}>
                      {portal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
