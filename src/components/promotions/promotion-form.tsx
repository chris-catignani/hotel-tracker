"use client";

import { useEffect, useReducer, useState, useMemo } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
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
  PromotionRestrictionsFormData,
  PromotionRestrictionsData,
} from "@/lib/types";
import { BenefitRow } from "./benefit-row";
import {
  RestrictionKey,
  RESTRICTION_ORDER,
  RESTRICTION_LABELS,
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
  GeographyRestrictionCard,
} from "./restriction-cards";
import {
  promotionFormReducer,
  buildInitialState,
  toFormBenefit,
  toFormTier,
  InitialFormData,
} from "./promotion-form-reducer";

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

export function PromotionForm({
  initialData,
  onSubmit,
  submitting,
  title: _title,
  description: _description,
  submitLabel,
}: PromotionFormProps) {
  // ── Form state (useReducer) ───────────────────────────────────────────────
  const [state, dispatch] = useReducer(
    promotionFormReducer,
    initialData as InitialFormData | undefined,
    buildInitialState
  );

  const {
    name,
    type,
    hotelChainId,
    creditCardId,
    shoppingPortalId,
    benefits,
    isTiered,
    tierRequirementType,
    tiers,
    startDate,
    endDate,
    restrictions,
    activeRestrictions,
  } = state;

  // ── UI-only state (useState) ──────────────────────────────────────────────
  const [showErrors, setShowErrors] = useState(false);
  const [activeTierTab, setActiveTierTab] = useState("tier-0");
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Reference data ────────────────────────────────────────────────────────
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [portals, setPortals] = useState<ShoppingPortal[]>([]);

  useEffect(() => {
    fetch("/api/hotel-chains")
      .then((res) => res.json())
      .then(setHotelChains)
      .catch((err) => {
        console.error(err);
        Sentry.captureException(err);
      });
    fetch("/api/credit-cards")
      .then((res) => res.json())
      .then(setCreditCards)
      .catch((err) => {
        console.error(err);
        Sentry.captureException(err);
      });
    fetch("/api/portals")
      .then((res) => res.json())
      .then(setPortals)
      .catch((err) => {
        console.error(err);
        Sentry.captureException(err);
      });
  }, []);

  // Sync form state when initialData arrives (Edit mode — data fetched async)
  useEffect(() => {
    if (initialData) {
      dispatch({ type: "LOAD_INITIAL_DATA", initialData: initialData as InitialFormData });
    }
  }, [initialData]);

  // ── Validation ────────────────────────────────────────────────────────────

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

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);

    if (!isValid) return;

    const withSortOrder = (bs: ReturnType<typeof toFormBenefit>[]) =>
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
        allowedCountryCodes: activeRestrictions.has("geography")
          ? restrictions.allowedCountryCodes
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
      benefits: isTiered ? [] : withSortOrder(benefits.map(toFormBenefit)),
      tiers: isTiered
        ? [...tiers]
            .sort((a, b) => {
              const aVal = tierRequirementType === "stays" ? a.minStays : a.minNights;
              const bVal = tierRequirementType === "stays" ? b.minStays : b.minNights;
              return (aVal ?? 0) - (bVal ?? 0);
            })
            .map((tier) => {
              const formTier = toFormTier(tier);
              return {
                ...formTier,
                minStays: tierRequirementType === "stays" ? tier.minStays : null,
                maxStays: tierRequirementType === "stays" ? tier.maxStays : null,
                minNights: tierRequirementType === "nights" ? tier.minNights : null,
                maxNights: tierRequirementType === "nights" ? tier.maxNights : null,
                benefits: withSortOrder(formTier.benefits),
              };
            })
        : [],
      tierRequirementType: isTiered ? tierRequirementType : undefined,
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

  // ── Derived values ────────────────────────────────────────────────────────

  const startDateObj = startDate ? parseISO(startDate) : undefined;
  const endDateObj = endDate ? parseISO(endDate) : undefined;

  const selectedChainSubBrands =
    hotelChains.find((h) => h.id === hotelChainId)?.hotelChainSubBrands ?? [];

  const showSubBrandScopeOption =
    type === "loyalty" && !!hotelChainId && selectedChainSubBrands.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

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
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              data-testid="promotion-form-main-grid"
            >
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Promotion Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })
                  }
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
                  onValueChange={(v) =>
                    dispatch({ type: "SET_FIELD", field: "type", value: v as PromotionType })
                  }
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
                    dispatch({ type: "SET_FIELD", field: "hotelChainId", value: v });
                    dispatch({
                      type: "UPDATE_RESTRICTIONS",
                      updates: { subBrandIncludeIds: [], subBrandExcludeIds: [] },
                    });
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
                  onValueChange={(v) =>
                    dispatch({ type: "SET_FIELD", field: "creditCardId", value: v })
                  }
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
                  onValueChange={(v) =>
                    dispatch({ type: "SET_FIELD", field: "shoppingPortalId", value: v })
                  }
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
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "isTiered", value: e.target.checked })
                  }
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
                    key={benefit._id}
                    benefit={benefit}
                    index={index}
                    canRemove={benefits.length > 1}
                    promotionType={type}
                    subBrands={selectedChainSubBrands}
                    creditCards={creditCards}
                    hotelChains={hotelChains}
                    onChange={(i, updated) =>
                      dispatch({ type: "UPDATE_BENEFIT", index: i, benefit: updated })
                    }
                    onRemove={(i) => dispatch({ type: "REMOVE_BENEFIT", index: i })}
                    errors={showErrors ? benefitErrors[index] : undefined}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch({ type: "ADD_BENEFIT" })}
                  data-testid="benefit-add"
                >
                  <Plus className="size-4 mr-2" />
                  Add Reward
                </Button>
              </div>
            )}

            {/* Tiered benefits */}
            {isTiered && (
              <div className="space-y-6">
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-dashed">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">Requirement Type</Label>
                      <p className="text-xs text-muted-foreground">
                        Choose whether all tiers are stay-based or night-based.
                      </p>
                    </div>
                    <Tabs
                      value={tierRequirementType}
                      onValueChange={(val) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "tierRequirementType",
                          value: val as "stays" | "nights",
                        })
                      }
                      className="w-full sm:w-[240px]"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="stays">Stay-Based</TabsTrigger>
                        <TabsTrigger value="nights">Night-Based</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <Tabs value={activeTierTab} onValueChange={setActiveTierTab} className="w-full">
                  <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2">
                    <TabsList className="bg-muted/50 p-1">
                      {tiers.map((tier, idx) => (
                        <TabsTrigger
                          key={tier._id}
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
                        dispatch({ type: "ADD_TIER" });
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
                      key={tier._id}
                      value={`tier-${tierIndex}`}
                      className="space-y-6 animate-in fade-in zoom-in-95 duration-200"
                    >
                      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h4 className="text-base font-bold tracking-tight text-primary">
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
                                dispatch({ type: "REMOVE_TIER", tierIndex });
                                setActiveTierTab(`tier-${Math.max(0, tierIndex - 1)}`);
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-4">
                            <div>
                              <Label className="text-sm font-semibold">
                                {tierRequirementType === "stays"
                                  ? "Cumulative Stays"
                                  : "Cumulative Nights"}
                              </Label>
                              <p className="text-xs text-muted-foreground mt-1 mb-3">
                                {tierRequirementType === "stays"
                                  ? "Define the range of stays required to unlock this tier."
                                  : "Use a night count to define this tier requirement."}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  {tierRequirementType === "stays"
                                    ? "Minimum Stays"
                                    : "Minimum Nights"}
                                </Label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={
                                    (tierRequirementType === "stays"
                                      ? tier.minStays
                                      : tier.minNights) ?? ""
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value
                                      ? parseInt(e.target.value, 10)
                                      : null;
                                    dispatch({
                                      type: "UPDATE_TIER",
                                      tierIndex,
                                      updates: {
                                        [tierRequirementType === "stays"
                                          ? "minStays"
                                          : "minNights"]: val,
                                      },
                                    });
                                  }}
                                  placeholder={
                                    tierRequirementType === "stays" ? "e.g. 1" : "e.g. 5"
                                  }
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  {tierRequirementType === "stays"
                                    ? "Maximum Stays"
                                    : "Maximum Nights"}
                                </Label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={
                                    (tierRequirementType === "stays"
                                      ? tier.maxStays
                                      : tier.maxNights) ?? ""
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value
                                      ? parseInt(e.target.value, 10)
                                      : null;
                                    dispatch({
                                      type: "UPDATE_TIER",
                                      tierIndex,
                                      updates: {
                                        [tierRequirementType === "stays"
                                          ? "maxStays"
                                          : "maxNights"]: val,
                                      },
                                    });
                                  }}
                                  placeholder="Any"
                                  className="h-9"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t">
                          <Label className="text-sm font-semibold">Rewards for this Tier</Label>
                          <div className="space-y-3">
                            {tier.benefits.map((benefit, benefitIndex) => (
                              <BenefitRow
                                key={benefit._id}
                                benefit={benefit}
                                index={benefitIndex}
                                canRemove={tier.benefits.length > 1}
                                promotionType={type}
                                subBrands={selectedChainSubBrands}
                                creditCards={creditCards}
                                hotelChains={hotelChains}
                                onChange={(bi, updated) =>
                                  dispatch({
                                    type: "UPDATE_TIER_BENEFIT",
                                    tierIndex,
                                    benefitIndex: bi,
                                    benefit: updated,
                                  })
                                }
                                onRemove={(bi) =>
                                  dispatch({
                                    type: "REMOVE_TIER_BENEFIT",
                                    tierIndex,
                                    benefitIndex: bi,
                                  })
                                }
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
                              onClick={() => dispatch({ type: "ADD_TIER_BENEFIT", tierIndex })}
                              className="w-full border-dashed py-6 hover:bg-primary/5 hover:text-primary transition-all group"
                            >
                              <Plus className="size-4 mr-2 group-hover:scale-110 transition-transform" />
                              Add reward to this tier
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
                  setDate={(date) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "startDate",
                      value: date ? format(date, "yyyy-MM-dd") : "",
                    })
                  }
                  placeholder="Stays on/after..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Global End Date</Label>
                <DatePicker
                  id="endDate"
                  date={endDateObj}
                  setDate={(date) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "endDate",
                      value: date ? format(date, "yyyy-MM-dd") : "",
                    })
                  }
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
                    <h4 className="text-sm font-semibold text-foreground">
                      Add qualification rule
                    </h4>
                  </div>
                  <div className="p-2 max-h-[400px] overflow-y-auto">
                    <div className="space-y-4">
                      {/* Group 1: Usage & Spend */}
                      <div className="space-y-1">
                        <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/70">
                          Usage & spend
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
                              onClick={() => {
                                dispatch({ type: "ADD_RESTRICTION", key: k });
                                setPickerOpen(false);
                              }}
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
                        <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/70">
                          Timing & validity
                        </p>
                        {["book_by_date", "registration", "prerequisite"].map((key) => {
                          const k = key as RestrictionKey;
                          const isActive = activeRestrictions.has(k);
                          return (
                            <button
                              key={k}
                              type="button"
                              disabled={isActive}
                              onClick={() => {
                                dispatch({ type: "ADD_RESTRICTION", key: k });
                                setPickerOpen(false);
                              }}
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
                        <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/70">
                          Scope
                        </p>
                        {[
                          "hotel_chain",
                          "geography",
                          "sub_brand_scope",
                          "tie_in_cards",
                          "booking_source",
                        ].map((key) => {
                          const k = key as RestrictionKey;
                          if (k === "sub_brand_scope") {
                            const hasChain =
                              type === "loyalty" || activeRestrictions.has("hotel_chain");
                            if (!hasChain) return null;
                          }
                          if (k === "hotel_chain" && type === "loyalty") return null;
                          if (k === "tie_in_cards" && type === "credit_card") return null;
                          const isActive = activeRestrictions.has(k);
                          return (
                            <button
                              key={k}
                              type="button"
                              disabled={isActive}
                              onClick={() => {
                                dispatch({ type: "ADD_RESTRICTION", key: k });
                                setPickerOpen(false);
                              }}
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
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: {
                              hotelChainId: val,
                              subBrandIncludeIds: [],
                              subBrandExcludeIds: [],
                            },
                          });
                        }}
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "hotel_chain" })
                        }
                      />
                    );

                  if (key === "geography")
                    return (
                      <GeographyRestrictionCard
                        key={key}
                        allowedCountryCodes={restrictions.allowedCountryCodes ?? []}
                        onCountryCodesChange={(codes) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { allowedCountryCodes: codes },
                          })
                        }
                        onRemove={() => dispatch({ type: "REMOVE_RESTRICTION", key: "geography" })}
                      />
                    );

                  if (key === "booking_source")
                    return (
                      <BookingSourceCard
                        key={key}
                        allowedBookingSources={restrictions.allowedBookingSources}
                        onAllowedBookingSourcesChange={(sources) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { allowedBookingSources: sources },
                          })
                        }
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "booking_source" })
                        }
                      />
                    );

                  if (key === "payment_type")
                    return (
                      <PaymentTypeCard
                        key={key}
                        allowedPaymentTypes={restrictions.allowedPaymentTypes}
                        onAllowedPaymentTypesChange={(types) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { allowedPaymentTypes: types },
                          })
                        }
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "payment_type" })
                        }
                      />
                    );

                  if (key === "prerequisite")
                    return (
                      <PrerequisitesCard
                        key={key}
                        prerequisiteStayCount={restrictions.prerequisiteStayCount}
                        prerequisiteNightCount={restrictions.prerequisiteNightCount}
                        onStayCountChange={(v) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { prerequisiteStayCount: v },
                          })
                        }
                        onNightCountChange={(v) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { prerequisiteNightCount: v },
                          })
                        }
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "prerequisite" })
                        }
                      />
                    );

                  if (key === "min_spend")
                    return (
                      <MinSpendCard
                        key={key}
                        minSpend={restrictions.minSpend}
                        onMinSpendChange={(v) =>
                          dispatch({ type: "UPDATE_RESTRICTIONS", updates: { minSpend: v } })
                        }
                        onRemove={() => dispatch({ type: "REMOVE_RESTRICTION", key: "min_spend" })}
                      />
                    );

                  if (key === "book_by_date")
                    return (
                      <BookByDateCard
                        key={key}
                        bookByDate={restrictions.bookByDate}
                        onBookByDateChange={(date) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { bookByDate: date ? format(date, "yyyy-MM-dd") : "" },
                          })
                        }
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "book_by_date" })
                        }
                      />
                    );

                  if (key === "min_nights")
                    return (
                      <MinNightsCard
                        key={key}
                        minNightsRequired={restrictions.minNightsRequired}
                        nightsStackable={restrictions.nightsStackable}
                        spanStays={restrictions.spanStays}
                        onMinNightsChange={(v) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { minNightsRequired: v },
                          })
                        }
                        onNightsStackableChange={(v) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { nightsStackable: v },
                          })
                        }
                        onSpanStaysChange={(v) =>
                          dispatch({ type: "UPDATE_RESTRICTIONS", updates: { spanStays: v } })
                        }
                        onRemove={() => dispatch({ type: "REMOVE_RESTRICTION", key: "min_nights" })}
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
                        onMaxStayCountChange={(v) =>
                          dispatch({ type: "UPDATE_RESTRICTIONS", updates: { maxStayCount: v } })
                        }
                        onMaxRewardCountChange={(v) =>
                          dispatch({ type: "UPDATE_RESTRICTIONS", updates: { maxRewardCount: v } })
                        }
                        onMaxRedemptionValueChange={(v) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { maxRedemptionValue: v },
                          })
                        }
                        onMaxTotalBonusPointsChange={(v) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { maxTotalBonusPoints: v },
                          })
                        }
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "redemption_caps" })
                        }
                      />
                    );

                  if (key === "once_per_sub_brand")
                    return (
                      <OncePerSubBrandCard
                        key={key}
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "once_per_sub_brand" })
                        }
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
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: {
                              tieInCreditCardIds: ids,
                              tieInRequiresPayment:
                                ids.length === 0 ? false : restrictions.tieInRequiresPayment,
                            },
                          });
                        }}
                        onTieInRequiresPaymentChange={(v) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { tieInRequiresPayment: v },
                          })
                        }
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "tie_in_cards" })
                        }
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
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: {
                              registrationDeadline: date ? format(date, "yyyy-MM-dd") : "",
                            },
                          })
                        }
                        onValidDaysChange={(v) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { validDaysAfterRegistration: v },
                          })
                        }
                        onRegistrationDateChange={(date) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { registrationDate: date ? format(date, "yyyy-MM-dd") : "" },
                          })
                        }
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "registration" })
                        }
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
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { subBrandIncludeIds: ids },
                          })
                        }
                        onExcludeIdsChange={(ids) =>
                          dispatch({
                            type: "UPDATE_RESTRICTIONS",
                            updates: { subBrandExcludeIds: ids },
                          })
                        }
                        onRemove={() =>
                          dispatch({ type: "REMOVE_RESTRICTION", key: "sub_brand_scope" })
                        }
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
            <p className="text-xs font-medium text-muted-foreground tracking-tight leading-none mb-1">
              {initialData ? "Editing" : "Creating"} promotion
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
