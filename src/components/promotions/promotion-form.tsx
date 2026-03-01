"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import {
  PromotionFormData,
  PromotionType,
  PromotionBenefitFormData,
  PromotionTierFormData,
  PromotionRestrictionsFormData,
  PromotionRestrictionsData,
  EMPTY_RESTRICTIONS,
} from "@/lib/types";
import { BenefitRow, DEFAULT_BENEFIT } from "./benefit-row";
import {
  RestrictionKey,
  RESTRICTION_ORDER,
  RESTRICTION_LABELS,
  deriveActiveRestrictions,
  PaymentTypeCard,
  MinSpendCard,
  BookByDateCard,
  MinNightsCard,
  RedemptionCapsCard,
  OncePerSubBrandCard,
  TieInCardsCard,
  RegistrationCard,
  SubBrandScopeCard,
  PrerequisitesCard,
  BookingSourceCard,
  HotelChainRestrictionCard,
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
  initialData?: Partial<PromotionFormData> & {
    restrictions?: PromotionRestrictionsData | PromotionRestrictionsFormData | null;
  };
  onSubmit: (data: PromotionFormData) => Promise<void>;
  submitting: boolean;
  title: string;
  description: string;
  submitLabel: string;
}

function mapApiRestrictionsToForm(
  r: PromotionRestrictionsData | PromotionRestrictionsFormData | null | undefined
): PromotionRestrictionsFormData {
  if (!r) return { ...EMPTY_RESTRICTIONS };
  // Short-circuit if already mapped to form data (edit page pre-maps before passing)
  if ("subBrandIncludeIds" in r) return r as PromotionRestrictionsFormData;
  return {
    minSpend: r.minSpend != null ? String(r.minSpend) : "",
    minNightsRequired: r.minNightsRequired != null ? String(r.minNightsRequired) : "",
    nightsStackable: r.nightsStackable ?? false,
    spanStays: r.spanStays ?? false,
    maxStayCount: r.maxStayCount != null ? String(r.maxStayCount) : "",
    maxRewardCount: r.maxRewardCount != null ? String(r.maxRewardCount) : "",
    maxRedemptionValue: r.maxRedemptionValue != null ? String(r.maxRedemptionValue) : "",
    maxTotalBonusPoints: r.maxTotalBonusPoints != null ? String(r.maxTotalBonusPoints) : "",
    oncePerSubBrand: r.oncePerSubBrand ?? false,
    bookByDate: r.bookByDate ? new Date(r.bookByDate).toISOString().split("T")[0] : "",
    registrationDeadline: r.registrationDeadline
      ? new Date(r.registrationDeadline).toISOString().split("T")[0]
      : "",
    validDaysAfterRegistration:
      r.validDaysAfterRegistration != null ? String(r.validDaysAfterRegistration) : "",
    registrationDate: "", // comes from userPromotions, set separately
    tieInRequiresPayment: r.tieInRequiresPayment ?? false,
    allowedPaymentTypes: r.allowedPaymentTypes ?? [],
    allowedBookingSources: r.allowedBookingSources ?? [],
    hotelChainId: r.hotelChainId ?? "",
    prerequisiteStayCount: r.prerequisiteStayCount != null ? String(r.prerequisiteStayCount) : "",
    prerequisiteNightCount:
      r.prerequisiteNightCount != null ? String(r.prerequisiteNightCount) : "",
    subBrandIncludeIds: (r.subBrandRestrictions ?? [])
      .filter((s) => s.mode === "include")
      .map((s) => s.hotelChainSubBrandId),
    subBrandExcludeIds: (r.subBrandRestrictions ?? [])
      .filter((s) => s.mode === "exclude")
      .map((s) => s.hotelChainSubBrandId),
    tieInCreditCardIds: (r.tieInCards ?? []).map((c) => c.creditCardId),
  };
}

export function PromotionForm({
  initialData,
  onSubmit,
  submitting,
  title: _title,
  description: _description,
  submitLabel,
}: PromotionFormProps) {
  // ── Validation state ─────────────────────────────────────────────────────────
  const [showErrors, setShowErrors] = useState(false);

  // ── Core fields ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState<PromotionType>(
    (initialData?.type as PromotionType) || "loyalty"
  );

  // ── Type-specific linking ────────────────────────────────────────────────────
  const [hotelChainId, setHotelChainId] = useState<string>(
    initialData?.hotelChainId ? initialData.hotelChainId : ""
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
  const [activeTierTab, setActiveTierTab] = useState("tier-0");
  const [tiers, setTiers] = useState<PromotionTierFormData[]>(
    initialData?.tiers && initialData.tiers.length > 0
      ? initialData.tiers
      : [
          {
            minStays: null,
            maxStays: null,
            minNights: null,
            maxNights: null,
            benefits: [{ ...DEFAULT_BENEFIT }],
          },
        ]
  );

  // ── Date range ───────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");

  // ── Restrictions (single object) ─────────────────────────────────────────────
  const [restrictions, setRestrictions] = useState<PromotionRestrictionsFormData>(() =>
    mapApiRestrictionsToForm(initialData?.restrictions)
  );

  // ── Restriction picker state ─────────────────────────────────────────────────
  const [activeRestrictions, setActiveRestrictions] = useState<Set<RestrictionKey>>(() =>
    deriveActiveRestrictions(mapApiRestrictionsToForm(initialData?.restrictions))
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
      if (initialData.hotelChainId !== undefined)
        setHotelChainId(initialData.hotelChainId ? initialData.hotelChainId : "");
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
      const mappedRestrictions = mapApiRestrictionsToForm(initialData.restrictions);
      setRestrictions(mappedRestrictions);
      setActiveRestrictions(deriveActiveRestrictions(mappedRestrictions));
    }
  }, [initialData]);

  // ── Validation ───────────────────────────────────────────────────────────────

  const { errors, isValid, benefitErrors, tierErrors } = useMemo(() => {
    const validateBenefit = (b: PromotionBenefitFormData) => ({
      value: !b.value ? "Required" : "",
      certType: b.rewardType === "certificate" && !b.certType ? "Required" : "",
    });

    const bErrors = benefits.map(validateBenefit);
    const tErrors = tiers.map((t) => ({
      minStays: !t.minStays && !t.minNights ? "Qualification Required" : "",
      benefits: t.benefits.map(validateBenefit),
    }));

    const errs = {
      name: !name.trim() ? "Promotion name is required" : "",
      hotelChainId: type === "loyalty" && !hotelChainId ? "Hotel chain is required" : "",
      creditCardId: type === "credit_card" && !creditCardId ? "Credit card is required" : "",
      shoppingPortalId: type === "portal" && !shoppingPortalId ? "Shopping portal is required" : "",
      benefits: !isTiered && bErrors.some((e) => e.value || e.certType),
      tiers:
        isTiered &&
        (tErrors.some((e) => e.minStays) ||
          tErrors.some((e) => e.benefits.some((be) => be.value || be.certType))),
    };

    const valid =
      !errs.name &&
      !errs.hotelChainId &&
      !errs.creditCardId &&
      !errs.shoppingPortalId &&
      !errs.benefits &&
      !errs.tiers;

    return { errors: errs, isValid: valid, benefitErrors: bErrors, tierErrors: tErrors };
  }, [name, type, hotelChainId, creditCardId, shoppingPortalId, isTiered, benefits, tiers]);

  // ── Restriction helpers ──────────────────────────────────────────────────────

  const updateRestrictions = (updates: Partial<PromotionRestrictionsFormData>) => {
    setRestrictions((prev) => ({ ...prev, ...updates }));
  };

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
        updateRestrictions({ minSpend: "" });
        break;
      case "book_by_date":
        updateRestrictions({ bookByDate: "" });
        break;
      case "min_nights":
        updateRestrictions({ minNightsRequired: "", nightsStackable: false, spanStays: false });
        break;
      case "redemption_caps":
        updateRestrictions({
          maxStayCount: "",
          maxRewardCount: "",
          maxRedemptionValue: "",
          maxTotalBonusPoints: "",
        });
        break;
      case "tie_in_cards":
        updateRestrictions({ tieInCreditCardIds: [], tieInRequiresPayment: false });
        break;
      case "registration":
        updateRestrictions({
          registrationDeadline: "",
          validDaysAfterRegistration: "",
          registrationDate: "",
        });
        break;
      case "payment_type":
        updateRestrictions({ allowedPaymentTypes: [] });
        break;
      case "booking_source":
        updateRestrictions({ allowedBookingSources: [] });
        break;
      case "sub_brand_scope":
        updateRestrictions({ subBrandIncludeIds: [], subBrandExcludeIds: [] });
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
      const lastMin = last?.minStays ?? 0;
      const lastMax = last?.maxStays ?? lastMin;
      const nextMin = lastMax + 1;
      return [
        ...prev,
        {
          minStays: nextMin,
          maxStays: null,
          minNights: null,
          maxNights: null,
          benefits: [{ ...DEFAULT_BENEFIT }],
        },
      ];
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
    setShowErrors(true);

    if (!isValid) return;

    const withSortOrder = (bs: PromotionBenefitFormData[]) =>
      bs.map((b, i) => ({ ...b, sortOrder: i }));

    // Build the restrictions payload (null if no restrictions are active)
    let finalRestrictions: PromotionRestrictionsFormData | null = null;
    const hasAnyRestriction =
      activeRestrictions.size > 0 ||
      restrictions.subBrandIncludeIds.length > 0 ||
      restrictions.subBrandExcludeIds.length > 0;

    if (hasAnyRestriction) {
      finalRestrictions = {
        minSpend: activeRestrictions.has("min_spend") ? restrictions.minSpend : "",
        bookByDate: activeRestrictions.has("book_by_date") ? restrictions.bookByDate : "",
        minNightsRequired: activeRestrictions.has("min_nights")
          ? restrictions.minNightsRequired
          : "",
        nightsStackable: activeRestrictions.has("min_nights")
          ? restrictions.nightsStackable
          : false,
        spanStays: activeRestrictions.has("min_nights") ? restrictions.spanStays : false,
        maxStayCount: activeRestrictions.has("redemption_caps") ? restrictions.maxStayCount : "",
        maxRewardCount: "", // Promotion-level reward count is deprecated in favor of maxStayCount
        maxRedemptionValue: activeRestrictions.has("redemption_caps")
          ? restrictions.maxRedemptionValue
          : "",
        maxTotalBonusPoints: activeRestrictions.has("redemption_caps")
          ? restrictions.maxTotalBonusPoints
          : "",
        oncePerSubBrand: activeRestrictions.has("once_per_sub_brand"),
        allowedPaymentTypes: activeRestrictions.has("payment_type")
          ? restrictions.allowedPaymentTypes
          : [],
        allowedBookingSources: activeRestrictions.has("booking_source")
          ? restrictions.allowedBookingSources
          : [],
        hotelChainId: activeRestrictions.has("hotel_chain") ? restrictions.hotelChainId : "",
        tieInCreditCardIds: activeRestrictions.has("tie_in_cards")
          ? restrictions.tieInCreditCardIds
          : [],
        tieInRequiresPayment: activeRestrictions.has("tie_in_cards")
          ? restrictions.tieInRequiresPayment
          : false,
        registrationDeadline: activeRestrictions.has("registration")
          ? restrictions.registrationDeadline
          : "",
        validDaysAfterRegistration: activeRestrictions.has("registration")
          ? restrictions.validDaysAfterRegistration
          : "",
        registrationDate: activeRestrictions.has("registration")
          ? restrictions.registrationDate
          : "",
        prerequisiteStayCount: activeRestrictions.has("prerequisite")
          ? restrictions.prerequisiteStayCount
          : "",
        prerequisiteNightCount: activeRestrictions.has("prerequisite")
          ? restrictions.prerequisiteNightCount
          : "",
        subBrandIncludeIds: activeRestrictions.has("sub_brand_scope")
          ? restrictions.subBrandIncludeIds
          : [],
        subBrandExcludeIds: activeRestrictions.has("sub_brand_scope")
          ? restrictions.subBrandExcludeIds
          : [],
      };
    }

    const body: PromotionFormData = {
      name,
      type,
      benefits: isTiered ? [] : withSortOrder(benefits),
      tiers: isTiered
        ? [...tiers]
            .sort((a, b) => (a.minStays ?? 0) - (b.minStays ?? 0))
            .map((tier) => ({ ...tier, benefits: withSortOrder(tier.benefits) }))
        : [],
      restrictions: finalRestrictions,
    };

    if (type === "loyalty" && hotelChainId) {
      body.hotelChainId = hotelChainId;
    } else {
      body.hotelChainId = null;
    }

    body.creditCardId = type === "credit_card" && creditCardId ? creditCardId : null;
    body.shoppingPortalId = type === "portal" && shoppingPortalId ? shoppingPortalId : null;

    body.startDate = startDate || null;
    body.endDate = endDate || null;

    await onSubmit(body);
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const startDateObj = startDate ? parseISO(startDate) : undefined;
  const endDateObj = endDate ? parseISO(endDate) : undefined;

  const selectedChainSubBrands =
    hotelChains.find((h) => h.id === hotelChainId)?.hotelChainSubBrands ?? [];

  const showSubBrandScopeOption =
    type === "loyalty" && !!hotelChainId && selectedChainSubBrands.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Section 1: Basic Information ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
            <CardDescription>
              Give your promotion a name and link it to a chain, card, or portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Promotion Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Summer Bonus Offer"
                  error={showErrors ? errors.name : ""}
                  data-testid="promotion-name-input"
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>Promotion Type</Label>
                <AppSelect
                  value={type}
                  onValueChange={(v) => setType(v as PromotionType)}
                  options={[
                    { label: "Loyalty Program", value: "loyalty" },
                    { label: "Credit Card", value: "credit_card" },
                    { label: "Shopping Portal", value: "portal" },
                  ]}
                  placeholder="Select type..."
                  data-testid="promotion-type-select"
                />
              </div>
            </div>

            {/* Type-specific linking */}
            {type === "loyalty" && (
              <div className="space-y-2">
                <Label>Hotel Chain *</Label>
                <AppSelect
                  value={hotelChainId}
                  error={showErrors ? errors.hotelChainId : ""}
                  onValueChange={(v) => {
                    setHotelChainId(v);
                    updateRestrictions({ subBrandIncludeIds: [], subBrandExcludeIds: [] });
                  }}
                  options={hotelChains.map((chain) => ({ label: chain.name, value: chain.id }))}
                  placeholder="Select hotel chain..."
                  data-testid="hotel-chain-select"
                />
              </div>
            )}

            {type === "credit_card" && (
              <div className="space-y-2">
                <Label>Credit Card *</Label>
                <AppSelect
                  value={creditCardId}
                  error={showErrors ? errors.creditCardId : ""}
                  onValueChange={setCreditCardId}
                  options={creditCards.map((card) => ({ label: card.name, value: card.id }))}
                  placeholder="Select credit card..."
                  data-testid="credit-card-select"
                />
              </div>
            )}

            {type === "portal" && (
              <div className="space-y-2">
                <Label>Shopping Portal *</Label>
                <AppSelect
                  value={shoppingPortalId}
                  error={showErrors ? errors.shoppingPortalId : ""}
                  onValueChange={setShoppingPortalId}
                  options={portals.map((portal) => ({ label: portal.name, value: portal.id }))}
                  placeholder="Select portal..."
                  data-testid="shopping-portal-select"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 2: Earning Rules ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">Earning Rules</CardTitle>
                <CardDescription>Define the rewards earned from this promotion.</CardDescription>
              </div>
              <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
                <input
                  id="isTiered"
                  type="checkbox"
                  checked={isTiered}
                  onChange={(e) => setIsTiered(e.target.checked)}
                  className="size-4 rounded border-gray-300"
                  data-testid="promotion-is-tiered"
                />
                <Label htmlFor="isTiered" className="text-sm font-bold text-primary">
                  Enable Tiers
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isTiered && (
              <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-dashed text-xs leading-relaxed space-y-2">
                <p className="font-bold text-foreground">What are Tiers?</p>
                <p className="text-muted-foreground">
                  Use tiers when a promotion rewards you differently as you accumulate more stays or
                  nights (e.g. &quot;Earn 2,000 points on your 2nd stay, and 4,000 points on your
                  3rd&quot;).
                </p>
                <p className="text-muted-foreground">
                  <span className="font-bold text-primary">Note:</span> Tier requirements
                  (stays/nights) are <span className="underline italic">cumulative</span> across the
                  entire promotion period.
                </p>
              </div>
            )}

            {/* Flat benefits */}
            {!isTiered && (
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <BenefitRow
                    key={index}
                    benefit={benefit}
                    index={index}
                    canRemove={benefits.length > 1}
                    promotionType={type}
                    subBrands={selectedChainSubBrands}
                    creditCards={creditCards}
                    hotelChains={hotelChains}
                    onChange={handleBenefitChange}
                    onRemove={handleBenefitRemove}
                    errors={showErrors ? benefitErrors[index] : undefined}
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
                  Add Reward
                </Button>
              </div>
            )}

            {/* Tiered benefits */}
            {isTiered && (
              <div className="space-y-4">
                <Tabs value={activeTierTab} onValueChange={setActiveTierTab} className="w-full">
                  <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2">
                    <TabsList className="bg-muted/50 p-1">
                      {tiers.map((_, idx) => (
                        <TabsTrigger
                          key={idx}
                          value={`tier-${idx}`}
                          className="px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                        >
                          Tier {idx + 1}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleAddTier();
                        setActiveTierTab(`tier-${tiers.length}`);
                      }}
                      className="text-primary hover:bg-primary/5 ml-2 shrink-0"
                    >
                      <Plus className="size-4 mr-1" />
                      New Tier
                    </Button>
                  </div>

                  {tiers.map((tier, tierIndex) => (
                    <TabsContent
                      key={tierIndex}
                      value={`tier-${tierIndex}`}
                      className="space-y-6 animate-in fade-in zoom-in-95 duration-200"
                    >
                      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-bold uppercase tracking-tight text-primary">
                              Tier {tierIndex + 1} Configuration
                            </h4>
                            <p className="text-xs text-muted-foreground font-medium">
                              Set the cumulative goals required to unlock this tier.
                            </p>
                          </div>
                          {tiers.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                handleTierRemove(tierIndex);
                                setActiveTierTab(`tier-${Math.max(0, tierIndex - 1)}`);
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                1
                              </span>
                              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Cumulative Stays
                              </Label>
                            </div>
                            <div className="grid grid-cols-2 gap-4 ml-7">
                              <div className="space-y-2">
                                <Label className="text-[11px]">Minimum</Label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={tier.minStays ?? ""}
                                  onChange={(e) =>
                                    handleTierChange(tierIndex, {
                                      ...tier,
                                      minStays: e.target.value
                                        ? parseInt(e.target.value, 10)
                                        : null,
                                    })
                                  }
                                  placeholder="e.g. 1"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[11px]">Maximum</Label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={tier.maxStays ?? ""}
                                  onChange={(e) =>
                                    handleTierChange(tierIndex, {
                                      ...tier,
                                      maxStays: e.target.value
                                        ? parseInt(e.target.value, 10)
                                        : null,
                                    })
                                  }
                                  placeholder="Any"
                                  className="h-9"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4 border-l pl-6 hidden md:block">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                2
                              </span>
                              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Cumulative Nights
                              </Label>
                            </div>
                            <div className="grid grid-cols-2 gap-4 ml-7">
                              <div className="space-y-2">
                                <Label className="text-[11px]">Minimum</Label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={tier.minNights ?? ""}
                                  onChange={(e) =>
                                    handleTierChange(tierIndex, {
                                      ...tier,
                                      minNights: e.target.value
                                        ? parseInt(e.target.value, 10)
                                        : null,
                                    })
                                  }
                                  placeholder="e.g. 5"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[11px]">Maximum</Label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={tier.maxNights ?? ""}
                                  onChange={(e) =>
                                    handleTierChange(tierIndex, {
                                      ...tier,
                                      maxNights: e.target.value
                                        ? parseInt(e.target.value, 10)
                                        : null,
                                    })
                                  }
                                  placeholder="Any"
                                  className="h-9"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              3
                            </span>
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Rewards for this tier
                            </Label>
                          </div>
                          <div className="ml-7 space-y-3">
                            {tier.benefits.map((benefit, benefitIndex) => (
                              <BenefitRow
                                key={benefitIndex}
                                benefit={benefit}
                                index={benefitIndex}
                                canRemove={tier.benefits.length > 1}
                                promotionType={type}
                                subBrands={selectedChainSubBrands}
                                creditCards={creditCards}
                                hotelChains={hotelChains}
                                onChange={(bi, updated) =>
                                  handleTierBenefitChange(tierIndex, bi, updated)
                                }
                                onRemove={(bi) => handleTierBenefitRemove(tierIndex, bi)}
                                errors={
                                  showErrors
                                    ? tierErrors[tierIndex].benefits[benefitIndex]
                                    : undefined
                                }
                              />
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleTierAddBenefit(tierIndex)}
                              className="w-full border-dashed py-6 hover:bg-primary/5 hover:text-primary transition-all group"
                            >
                              <Plus className="size-4 mr-2 group-hover:scale-110 transition-transform" />
                              Add Reward to Tier {tierIndex + 1}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Timing ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Promotion Timing</CardTitle>
            <CardDescription>When is this promotion active for stays?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Global Start Date</Label>
                <DatePicker
                  id="startDate"
                  date={startDateObj}
                  setDate={(date) => setStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                  placeholder="Stays on/after..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Global End Date</Label>
                <DatePicker
                  id="endDate"
                  date={endDateObj}
                  setDate={(date) => setEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                  placeholder="Stays on/before..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 4: Eligibility & Restrictions ────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Eligibility & Restrictions</CardTitle>
            <CardDescription>
              Add specific requirements to limit how this promotion applies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="restriction-picker-button"
                    className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                  >
                    <Plus className="size-4 mr-2" />
                    Add Qualification Rule
                    <ChevronDown className="size-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-72 p-0"
                  data-testid="restriction-picker-popover"
                >
                  <div className="p-3 bg-muted/20 border-b">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Add Qualification Rule
                    </h4>
                  </div>
                  <div className="p-2 max-h-[400px] overflow-y-auto">
                    <div className="space-y-4">
                      {/* Group 1: Usage & Spend */}
                      <div className="space-y-1">
                        <p className="px-2 pb-1 text-[10px] font-bold uppercase text-muted-foreground/70">
                          Usage & Spend
                        </p>
                        {[
                          { key: "min_spend", label: "Minimum Spend" },
                          { key: "min_nights", label: "Min Length of Stay" },
                          { key: "redemption_caps", label: "Redemption Caps" },
                          { key: "payment_type", label: "Payment Type" },
                        ].map(({ key, label }) => {
                          const k = key as RestrictionKey;
                          const isActive = activeRestrictions.has(k);
                          return (
                            <button
                              key={k}
                              type="button"
                              disabled={isActive}
                              onClick={() => addRestriction(k)}
                              className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between ${
                                isActive
                                  ? "opacity-40 cursor-not-allowed bg-muted/30"
                                  : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
                              }`}
                              data-testid={`restriction-option-${k}`}
                            >
                              {label}
                              {!isActive && <Plus className="size-3 text-muted-foreground/50" />}
                            </button>
                          );
                        })}
                      </div>

                      <Separator />

                      {/* Group 2: Timing & Validity */}
                      <div className="space-y-1">
                        <p className="px-2 pb-1 text-[10px] font-bold uppercase text-muted-foreground/70">
                          Timing & Validity
                        </p>
                        {["book_by_date", "registration", "prerequisite"].map((key) => {
                          const k = key as RestrictionKey;
                          const isActive = activeRestrictions.has(k);
                          return (
                            <button
                              key={k}
                              type="button"
                              disabled={isActive}
                              onClick={() => addRestriction(k)}
                              className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between ${
                                isActive
                                  ? "opacity-40 cursor-not-allowed bg-muted/30"
                                  : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
                              }`}
                              data-testid={`restriction-option-${k}`}
                            >
                              {RESTRICTION_LABELS[k]}
                              {!isActive && <Plus className="size-3 text-muted-foreground/50" />}
                            </button>
                          );
                        })}
                      </div>

                      <Separator />

                      {/* Group 3: Scope */}
                      <div className="space-y-1">
                        <p className="px-2 pb-1 text-[10px] font-bold uppercase text-muted-foreground/70">
                          Scope
                        </p>
                        {["hotel_chain", "sub_brand_scope", "tie_in_cards", "booking_source"].map(
                          (key) => {
                            const k = key as RestrictionKey;
                            if (k === "sub_brand_scope" && !showSubBrandScopeOption) return null;
                            if (k === "hotel_chain" && type === "loyalty") return null;
                            const isActive = activeRestrictions.has(k);
                            return (
                              <button
                                key={k}
                                type="button"
                                disabled={isActive}
                                onClick={() => addRestriction(k)}
                                className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between ${
                                  isActive
                                    ? "opacity-40 cursor-not-allowed bg-muted/30"
                                    : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                }`}
                                data-testid={`restriction-option-${k}`}
                              >
                                {RESTRICTION_LABELS[k]}
                                {!isActive && <Plus className="size-3 text-muted-foreground/50" />}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Active restriction cards in canonical order */}
              <div className="grid grid-cols-1 gap-4">
                {RESTRICTION_ORDER.map((key) => {
                  if (!activeRestrictions.has(key)) return null;

                  if (key === "hotel_chain")
                    return (
                      <HotelChainRestrictionCard
                        key={key}
                        hotelChainId={restrictions.hotelChainId}
                        hotelChains={hotelChains}
                        onHotelChainChange={(val) => {
                          updateRestrictions({
                            hotelChainId: val,
                            subBrandIncludeIds: [],
                            subBrandExcludeIds: [],
                          });
                        }}
                        onRemove={() => removeRestriction("hotel_chain")}
                      />
                    );

                  if (key === "booking_source")
                    return (
                      <BookingSourceCard
                        key={key}
                        allowedBookingSources={restrictions.allowedBookingSources}
                        onAllowedBookingSourcesChange={(sources) =>
                          updateRestrictions({ allowedBookingSources: sources })
                        }
                        onRemove={() => removeRestriction("booking_source")}
                      />
                    );

                  if (key === "payment_type")
                    return (
                      <PaymentTypeCard
                        key={key}
                        allowedPaymentTypes={restrictions.allowedPaymentTypes}
                        onAllowedPaymentTypesChange={(types) =>
                          updateRestrictions({ allowedPaymentTypes: types })
                        }
                        onRemove={() => removeRestriction("payment_type")}
                      />
                    );

                  if (key === "prerequisite")
                    return (
                      <PrerequisitesCard
                        key={key}
                        prerequisiteStayCount={restrictions.prerequisiteStayCount}
                        prerequisiteNightCount={restrictions.prerequisiteNightCount}
                        onStayCountChange={(v) => updateRestrictions({ prerequisiteStayCount: v })}
                        onNightCountChange={(v) =>
                          updateRestrictions({ prerequisiteNightCount: v })
                        }
                        onRemove={() => removeRestriction("prerequisite")}
                      />
                    );

                  if (key === "min_spend")
                    return (
                      <MinSpendCard
                        key={key}
                        minSpend={restrictions.minSpend}
                        onMinSpendChange={(v) => updateRestrictions({ minSpend: v })}
                        onRemove={() => removeRestriction("min_spend")}
                      />
                    );

                  if (key === "book_by_date")
                    return (
                      <BookByDateCard
                        key={key}
                        bookByDate={restrictions.bookByDate}
                        onBookByDateChange={(date) =>
                          updateRestrictions({ bookByDate: date ? format(date, "yyyy-MM-dd") : "" })
                        }
                        onRemove={() => removeRestriction("book_by_date")}
                      />
                    );

                  if (key === "min_nights")
                    return (
                      <MinNightsCard
                        key={key}
                        minNightsRequired={restrictions.minNightsRequired}
                        nightsStackable={restrictions.nightsStackable}
                        spanStays={restrictions.spanStays}
                        onMinNightsChange={(v) => updateRestrictions({ minNightsRequired: v })}
                        onNightsStackableChange={(v) => updateRestrictions({ nightsStackable: v })}
                        onSpanStaysChange={(v) => updateRestrictions({ spanStays: v })}
                        onRemove={() => removeRestriction("min_nights")}
                      />
                    );

                  if (key === "redemption_caps")
                    return (
                      <RedemptionCapsCard
                        key={key}
                        maxStayCount={restrictions.maxStayCount}
                        maxRewardCount={restrictions.maxRewardCount}
                        maxRedemptionValue={restrictions.maxRedemptionValue}
                        maxTotalBonusPoints={restrictions.maxTotalBonusPoints}
                        onMaxStayCountChange={(v) => updateRestrictions({ maxStayCount: v })}
                        onMaxRewardCountChange={(v) => updateRestrictions({ maxRewardCount: v })}
                        onMaxRedemptionValueChange={(v) =>
                          updateRestrictions({ maxRedemptionValue: v })
                        }
                        onMaxTotalBonusPointsChange={(v) =>
                          updateRestrictions({ maxTotalBonusPoints: v })
                        }
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
                        tieInCreditCardIds={restrictions.tieInCreditCardIds}
                        tieInRequiresPayment={restrictions.tieInRequiresPayment}
                        onTieInCreditCardIdsChange={(ids) => {
                          updateRestrictions({
                            tieInCreditCardIds: ids,
                            tieInRequiresPayment:
                              ids.length === 0 ? false : restrictions.tieInRequiresPayment,
                          });
                        }}
                        onTieInRequiresPaymentChange={(v) =>
                          updateRestrictions({ tieInRequiresPayment: v })
                        }
                        onRemove={() => removeRestriction("tie_in_cards")}
                      />
                    );

                  if (key === "registration")
                    return (
                      <RegistrationCard
                        key={key}
                        registrationDeadline={restrictions.registrationDeadline}
                        validDaysAfterRegistration={restrictions.validDaysAfterRegistration}
                        registrationDate={restrictions.registrationDate}
                        onRegistrationDeadlineChange={(date) =>
                          updateRestrictions({
                            registrationDeadline: date ? format(date, "yyyy-MM-dd") : "",
                          })
                        }
                        onValidDaysChange={(v) =>
                          updateRestrictions({ validDaysAfterRegistration: v })
                        }
                        onRegistrationDateChange={(date) =>
                          updateRestrictions({
                            registrationDate: date ? format(date, "yyyy-MM-dd") : "",
                          })
                        }
                        onRemove={() => removeRestriction("registration")}
                      />
                    );

                  if (key === "sub_brand_scope" && showSubBrandScopeOption)
                    return (
                      <SubBrandScopeCard
                        key={key}
                        subBrands={selectedChainSubBrands}
                        subBrandIncludeIds={restrictions.subBrandIncludeIds}
                        subBrandExcludeIds={restrictions.subBrandExcludeIds}
                        onIncludeIdsChange={(ids) =>
                          updateRestrictions({ subBrandIncludeIds: ids })
                        }
                        onExcludeIdsChange={(ids) =>
                          updateRestrictions({ subBrandExcludeIds: ids })
                        }
                        onRemove={() => removeRestriction("sub_brand_scope")}
                      />
                    );

                  return null;
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Actions (Sticky Footer) ────────────────────────────────────────── */}
        <div className="sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-xl border shadow-lg flex gap-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-1">
              {initialData ? "Editing" : "Creating"} Promotion
            </p>
            <p className="text-sm font-bold truncate max-w-[200px] sm:max-w-md">
              {name || "Untitled Promotion"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              asChild
              className="hidden sm:flex"
              data-testid="promotion-form-cancel"
            >
              <Link href="/promotions">Cancel</Link>
            </Button>
            <Button type="submit" disabled={submitting} data-testid="promotion-form-submit">
              {submitting ? "Saving..." : submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
