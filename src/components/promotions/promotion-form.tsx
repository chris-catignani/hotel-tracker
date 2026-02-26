"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import {
  PromotionFormData,
  PromotionType,
  PromotionBenefitFormData,
  PromotionTierFormData,
  PromotionExclusion,
} from "@/lib/types";
import { BenefitRow, DEFAULT_BENEFIT } from "./benefit-row";
import {
  RestrictionKey,
  RESTRICTION_ORDER,
  RESTRICTION_LABELS,
  deriveActiveRestrictions,
  MinSpendCard,
  BookByDateCard,
  MinNightsCard,
  RedemptionCapsCard,
  OncePerSubBrandCard,
  TieInCardsCard,
  RegistrationCard,
  SubBrandExclusionsCard,
} from "./restriction-cards";

interface HotelChainSubBrand {
  id: string;
  name: string;
}

interface HotelChain {
  id: string;
  name: string;
  hotelChainSubBrands: HotelChainSubBrand[];
}

interface CreditCard {
  id: string;
  name: string;
}

interface ShoppingPortal {
  id: string;
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

export function PromotionForm({
  initialData,
  onSubmit,
  submitting,
  title,
  description,
  submitLabel,
}: PromotionFormProps) {
  // ── Core fields ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState<PromotionType>(
    (initialData?.type as PromotionType) || "loyalty"
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  // ── Type-specific linking ────────────────────────────────────────────────────
  const [hotelChainId, setHotelChainId] = useState<string>(
    initialData?.hotelChainId ? initialData.hotelChainId : ""
  );
  const [hotelChainSubBrandId, setHotelChainSubBrandId] = useState<string>(
    initialData?.hotelChainSubBrandId ? initialData.hotelChainSubBrandId : ""
  );
  const [creditCardId, setCreditCardId] = useState<string>(
    initialData?.creditCardId ? initialData.creditCardId : ""
  );
  const [shoppingPortalId, setShoppingPortalId] = useState<string>(
    initialData?.shoppingPortalId ? initialData.shoppingPortalId : ""
  );

  // ── Benefits ─────────────────────────────────────────────────────────────────
  const [benefits, setBenefits] = useState<PromotionBenefitFormData[]>(
    initialData?.benefits && initialData.benefits.length > 0
      ? initialData.benefits
      : [{ ...DEFAULT_BENEFIT }]
  );
  const [isTiered, setIsTiered] = useState(
    () => (initialData?.tiers && initialData.tiers.length > 0) ?? false
  );
  const [tiers, setTiers] = useState<PromotionTierFormData[]>(
    initialData?.tiers && initialData.tiers.length > 0
      ? initialData.tiers
      : [{ minStays: 1, maxStays: null, benefits: [{ ...DEFAULT_BENEFIT }] }]
  );

  // ── Date range ───────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");

  // ── Restriction state ────────────────────────────────────────────────────────
  const [minSpend, setMinSpend] = useState(
    initialData?.minSpend ? String(initialData.minSpend) : ""
  );
  const [bookByDate, setBookByDate] = useState(initialData?.bookByDate || "");
  const [minNightsRequired, setMinNightsRequired] = useState(
    initialData?.minNightsRequired ? String(initialData.minNightsRequired) : ""
  );
  const [nightsStackable, setNightsStackable] = useState(initialData?.nightsStackable ?? false);
  const [maxRedemptionCount, setMaxRedemptionCount] = useState(
    initialData?.maxRedemptionCount ? String(initialData.maxRedemptionCount) : ""
  );
  const [maxRedemptionValue, setMaxRedemptionValue] = useState(
    initialData?.maxRedemptionValue ? String(initialData.maxRedemptionValue) : ""
  );
  const [maxTotalBonusPoints, setMaxTotalBonusPoints] = useState(
    initialData?.maxTotalBonusPoints ? String(initialData.maxTotalBonusPoints) : ""
  );
  const [tieInCreditCardIds, setTieInCreditCardIds] = useState<string[]>(
    initialData?.tieInCreditCardIds ?? []
  );
  const [tieInRequiresPayment, setTieInRequiresPayment] = useState(
    initialData?.tieInRequiresPayment ?? false
  );
  const [registrationDeadline, setRegistrationDeadline] = useState(
    initialData?.registrationDeadline || ""
  );
  const [validDaysAfterRegistration, setValidDaysAfterRegistration] = useState(
    initialData?.validDaysAfterRegistration ? String(initialData.validDaysAfterRegistration) : ""
  );
  const [registrationDate, setRegistrationDate] = useState(initialData?.registrationDate || "");
  const [exclusionSubBrandIds, setExclusionSubBrandIds] = useState<string[]>(
    initialData?.exclusions?.map((e) => e.hotelChainSubBrandId) ?? []
  );

  // ── Restriction picker state ─────────────────────────────────────────────────
  const [activeRestrictions, setActiveRestrictions] = useState<Set<RestrictionKey>>(() =>
    deriveActiveRestrictions(initialData)
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Reference data ───────────────────────────────────────────────────────────
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

  // Sync form state when initialData arrives (Edit mode — data fetched async)
  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (initialData.name !== undefined) setName(initialData.name);
      if (initialData.type !== undefined) setType(initialData.type as PromotionType);
      if (initialData.isActive !== undefined) setIsActive(initialData.isActive);
      if (initialData.hotelChainId !== undefined)
        setHotelChainId(initialData.hotelChainId ? initialData.hotelChainId : "");
      if (initialData.hotelChainSubBrandId !== undefined)
        setHotelChainSubBrandId(
          initialData.hotelChainSubBrandId ? initialData.hotelChainSubBrandId : ""
        );
      if (initialData.creditCardId !== undefined)
        setCreditCardId(initialData.creditCardId ? initialData.creditCardId : "");
      if (initialData.shoppingPortalId !== undefined)
        setShoppingPortalId(initialData.shoppingPortalId ? initialData.shoppingPortalId : "");
      if (initialData.benefits !== undefined && initialData.benefits.length > 0)
        setBenefits(initialData.benefits);
      if (initialData.tiers !== undefined) {
        const hasTiers = initialData.tiers.length > 0;
        setIsTiered(hasTiers);
        if (hasTiers) setTiers(initialData.tiers);
      }
      if (initialData.startDate !== undefined) setStartDate(initialData.startDate || "");
      if (initialData.endDate !== undefined) setEndDate(initialData.endDate || "");
      if (initialData.minSpend !== undefined)
        setMinSpend(initialData.minSpend ? String(initialData.minSpend) : "");
      if (initialData.bookByDate !== undefined) setBookByDate(initialData.bookByDate || "");
      if (initialData.minNightsRequired !== undefined)
        setMinNightsRequired(
          initialData.minNightsRequired ? String(initialData.minNightsRequired) : ""
        );
      if (initialData.nightsStackable !== undefined)
        setNightsStackable(initialData.nightsStackable);
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
      if (initialData.tieInCreditCardIds !== undefined)
        setTieInCreditCardIds(initialData.tieInCreditCardIds);
      if (initialData.tieInRequiresPayment !== undefined)
        setTieInRequiresPayment(initialData.tieInRequiresPayment);
      if (initialData.registrationDeadline !== undefined)
        setRegistrationDeadline(initialData.registrationDeadline || "");
      if (initialData.validDaysAfterRegistration !== undefined)
        setValidDaysAfterRegistration(
          initialData.validDaysAfterRegistration
            ? String(initialData.validDaysAfterRegistration)
            : ""
        );
      if (initialData.registrationDate !== undefined)
        setRegistrationDate(initialData.registrationDate || "");
      if (initialData.exclusions !== undefined)
        setExclusionSubBrandIds(initialData.exclusions.map((e) => e.hotelChainSubBrandId));
      setActiveRestrictions(deriveActiveRestrictions(initialData));
    }
  }, [initialData]);

  // ── Restriction helpers ──────────────────────────────────────────────────────

  const addRestriction = (key: RestrictionKey) => {
    setActiveRestrictions((prev) => new Set([...prev, key]));
    setPickerOpen(false);
  };

  const removeRestriction = (key: RestrictionKey) => {
    setActiveRestrictions((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    switch (key) {
      case "min_spend":
        setMinSpend("");
        break;
      case "book_by_date":
        setBookByDate("");
        break;
      case "min_nights":
        setMinNightsRequired("");
        setNightsStackable(false);
        break;
      case "redemption_caps":
        setMaxRedemptionCount("");
        setMaxRedemptionValue("");
        setMaxTotalBonusPoints("");
        break;
      case "tie_in_cards":
        setTieInCreditCardIds([]);
        setTieInRequiresPayment(false);
        break;
      case "registration":
        setRegistrationDeadline("");
        setValidDaysAfterRegistration("");
        setRegistrationDate("");
        break;
      case "sub_brand_exclusions":
        setExclusionSubBrandIds([]);
        break;
    }
  };

  // ── Benefit handlers ─────────────────────────────────────────────────────────

  const handleBenefitChange = (index: number, updated: PromotionBenefitFormData) => {
    setBenefits((prev) => prev.map((b, i) => (i === index ? updated : b)));
  };

  const handleBenefitRemove = (index: number) => {
    setBenefits((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddBenefit = () => {
    setBenefits((prev) => [...prev, { ...DEFAULT_BENEFIT, sortOrder: prev.length }]);
  };

  // ── Tier handlers ────────────────────────────────────────────────────────────

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

  // ── Submit ───────────────────────────────────────────────────────────────────

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
      body.hotelChainId = hotelChainId;
      body.hotelChainSubBrandId = hotelChainSubBrandId || null;
      body.exclusionSubBrandIds = activeRestrictions.has("sub_brand_exclusions")
        ? exclusionSubBrandIds
        : [];
    } else {
      body.hotelChainId = null;
      body.hotelChainSubBrandId = null;
      body.exclusionSubBrandIds = [];
    }

    body.creditCardId = type === "credit_card" && creditCardId ? creditCardId : null;
    body.shoppingPortalId = type === "portal" && shoppingPortalId ? shoppingPortalId : null;

    body.startDate = startDate || null;
    body.endDate = endDate || null;

    body.minSpend = activeRestrictions.has("min_spend") && minSpend ? parseFloat(minSpend) : null;
    body.bookByDate = activeRestrictions.has("book_by_date") ? bookByDate || null : null;

    if (activeRestrictions.has("min_nights") && minNightsRequired) {
      body.minNightsRequired = parseInt(minNightsRequired);
      body.nightsStackable = nightsStackable;
    } else {
      body.minNightsRequired = null;
      body.nightsStackable = false;
    }

    if (activeRestrictions.has("redemption_caps")) {
      body.maxRedemptionCount = maxRedemptionCount ? parseInt(maxRedemptionCount) : null;
      body.maxRedemptionValue = maxRedemptionValue ? parseFloat(maxRedemptionValue) : null;
      body.maxTotalBonusPoints = maxTotalBonusPoints ? parseInt(maxTotalBonusPoints) : null;
    } else {
      body.maxRedemptionCount = null;
      body.maxRedemptionValue = null;
      body.maxTotalBonusPoints = null;
    }

    body.oncePerSubBrand = activeRestrictions.has("once_per_sub_brand");

    if (activeRestrictions.has("tie_in_cards")) {
      body.tieInCreditCardIds = tieInCreditCardIds;
      body.tieInRequiresPayment = tieInRequiresPayment;
    } else {
      body.tieInCreditCardIds = [];
      body.tieInRequiresPayment = false;
    }

    if (activeRestrictions.has("registration")) {
      body.registrationDeadline = registrationDeadline || null;
      body.validDaysAfterRegistration = validDaysAfterRegistration
        ? parseInt(validDaysAfterRegistration)
        : null;
      body.registrationDate = registrationDate || null;
    } else {
      body.registrationDeadline = null;
      body.validDaysAfterRegistration = null;
      body.registrationDate = null;
    }

    await onSubmit(body);
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const startDateObj = startDate ? parseISO(startDate) : undefined;
  const endDateObj = endDate ? parseISO(endDate) : undefined;

  const selectedChainSubBrands =
    hotelChains.find((h) => h.id === hotelChainId)?.hotelChainSubBrands ?? [];

  const showSubBrandExclusionsOption =
    type === "loyalty" && !!hotelChainId && selectedChainSubBrands.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
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

          {/* Type */}
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

          {/* Active */}
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

          {/* Type-specific linking */}
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
                options={hotelChains.map((chain) => ({ label: chain.name, value: chain.id }))}
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
                  ...selectedChainSubBrands.map((sb) => ({ label: sb.name, value: sb.id })),
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
                options={creditCards.map((card) => ({ label: card.name, value: card.id }))}
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
                options={portals.map((portal) => ({ label: portal.name, value: portal.id }))}
                placeholder="Select portal..."
                data-testid="shopping-portal-select"
              />
            </div>
          )}

          {/* Tiered toggle */}
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

          {/* Flat benefits */}
          {!isTiered && (
            <div className="space-y-3">
              <Label>Benefits</Label>
              {benefits.map((benefit, index) => (
                <BenefitRow
                  key={index}
                  benefit={benefit}
                  index={index}
                  canRemove={benefits.length > 1}
                  hasTieInCard={tieInCreditCardIds.length > 0}
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

          {/* Tiered benefits */}
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
                        hasTieInCard={tieInCreditCardIds.length > 0}
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

          {/* Date range */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <DatePicker
                id="startDate"
                date={startDateObj}
                setDate={(date) => setStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                placeholder="Select start date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <DatePicker
                id="endDate"
                date={endDateObj}
                setDate={(date) => setEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                placeholder="Select end date"
              />
            </div>
          </div>

          {/* Restriction picker + active restriction cards */}
          <div className="space-y-3">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="restriction-picker-button"
                >
                  <Plus className="size-4 mr-2" />
                  Add Restriction
                  <ChevronDown className="size-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-64 p-2"
                data-testid="restriction-picker-popover"
              >
                <div className="flex flex-col gap-1">
                  {RESTRICTION_ORDER.map((key) => {
                    if (key === "sub_brand_exclusions" && !showSubBrandExclusionsOption)
                      return null;
                    const isActive = activeRestrictions.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={isActive}
                        onClick={() => addRestriction(key)}
                        className={`text-left px-3 py-2 rounded text-sm transition-colors ${
                          isActive
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        }`}
                        data-testid={`restriction-option-${key}`}
                      >
                        {RESTRICTION_LABELS[key]}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Active restriction cards in canonical order */}
            {RESTRICTION_ORDER.map((key) => {
              if (!activeRestrictions.has(key)) return null;

              if (key === "min_spend")
                return (
                  <MinSpendCard
                    key={key}
                    minSpend={minSpend}
                    onMinSpendChange={setMinSpend}
                    onRemove={() => removeRestriction("min_spend")}
                  />
                );

              if (key === "book_by_date")
                return (
                  <BookByDateCard
                    key={key}
                    bookByDate={bookByDate}
                    onBookByDateChange={(date) =>
                      setBookByDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    onRemove={() => removeRestriction("book_by_date")}
                  />
                );

              if (key === "min_nights")
                return (
                  <MinNightsCard
                    key={key}
                    minNightsRequired={minNightsRequired}
                    nightsStackable={nightsStackable}
                    onMinNightsChange={setMinNightsRequired}
                    onNightsStackableChange={setNightsStackable}
                    onRemove={() => removeRestriction("min_nights")}
                  />
                );

              if (key === "redemption_caps")
                return (
                  <RedemptionCapsCard
                    key={key}
                    maxRedemptionCount={maxRedemptionCount}
                    maxRedemptionValue={maxRedemptionValue}
                    maxTotalBonusPoints={maxTotalBonusPoints}
                    onMaxRedemptionCountChange={setMaxRedemptionCount}
                    onMaxRedemptionValueChange={setMaxRedemptionValue}
                    onMaxTotalBonusPointsChange={setMaxTotalBonusPoints}
                    onRemove={() => removeRestriction("redemption_caps")}
                  />
                );

              if (key === "once_per_sub_brand")
                return (
                  <OncePerSubBrandCard
                    key={key}
                    onRemove={() => removeRestriction("once_per_sub_brand")}
                  />
                );

              if (key === "tie_in_cards")
                return (
                  <TieInCardsCard
                    key={key}
                    creditCards={creditCards}
                    tieInCreditCardIds={tieInCreditCardIds}
                    tieInRequiresPayment={tieInRequiresPayment}
                    onTieInCardChange={(cardId, checked) => {
                      const newIds = checked
                        ? [...tieInCreditCardIds, cardId]
                        : tieInCreditCardIds.filter((id) => id !== cardId);
                      setTieInCreditCardIds(newIds);
                      if (newIds.length === 0) setTieInRequiresPayment(false);
                    }}
                    onTieInRequiresPaymentChange={setTieInRequiresPayment}
                    onRemove={() => removeRestriction("tie_in_cards")}
                  />
                );

              if (key === "registration")
                return (
                  <RegistrationCard
                    key={key}
                    registrationDeadline={registrationDeadline}
                    validDaysAfterRegistration={validDaysAfterRegistration}
                    registrationDate={registrationDate}
                    onRegistrationDeadlineChange={(date) =>
                      setRegistrationDeadline(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    onValidDaysChange={setValidDaysAfterRegistration}
                    onRegistrationDateChange={(date) =>
                      setRegistrationDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    onRemove={() => removeRestriction("registration")}
                  />
                );

              if (key === "sub_brand_exclusions" && showSubBrandExclusionsOption)
                return (
                  <SubBrandExclusionsCard
                    key={key}
                    subBrands={selectedChainSubBrands}
                    exclusionSubBrandIds={exclusionSubBrandIds}
                    onExclusionChange={(subBrandId, checked) => {
                      if (checked) {
                        setExclusionSubBrandIds((prev) => [...prev, subBrandId]);
                      } else {
                        setExclusionSubBrandIds((prev) => prev.filter((id) => id !== subBrandId));
                      }
                    }}
                    onRemove={() => removeRestriction("sub_brand_exclusions")}
                  />
                );

              return null;
            })}
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
