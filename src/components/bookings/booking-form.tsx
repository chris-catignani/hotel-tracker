"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/app-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { SectionDivider } from "@/components/ui/section-divider";
import { CERT_TYPE_OPTIONS } from "@/lib/cert-types";
import { format, parseISO } from "date-fns";
import { calculatePointsFromChain } from "@/lib/loyalty-utils";
import {
  ACCOMMODATION_TYPE_OPTIONS,
  BENEFIT_TYPE_OPTIONS,
  BOOKING_SOURCE_OPTIONS,
  COUNTRY_TO_CURRENCY,
  PAYMENT_TYPES,
} from "@/lib/constants";
import { CurrencyCombobox } from "@/components/ui/currency-combobox";
import { PropertyNameCombobox } from "@/components/ui/property-name-combobox";
import { ManualGeoModal } from "@/components/ui/manual-geo-modal";
import {
  AccommodationType,
  Booking,
  BookingFormData,
  GeoResult,
  HotelChain,
  OtaAgency,
  PaymentType,
  ShoppingPortal,
  UserCreditCard,
} from "@/lib/types";
import { bookingFormReducer, INITIAL_STATE, BenefitItem } from "./booking-form-reducer";
import { formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function diffDays(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function calcBenefitApproxValue(
  benefit: BenefitItem,
  numNights: number,
  pretaxCost: string,
  chainBasePointRate: number,
  chainUsdCentsPerPoint: number,
  exchangeRate: number
): number | null {
  if (benefit.valueType === "cash") {
    const v = Number(benefit.dollarValue || 0);
    if (v <= 0 || exchangeRate === 1) return null;
    return v * exchangeRate;
  }
  if (benefit.valueType === "fixed_per_stay") {
    const pts = Math.floor(Number(benefit.pointsAmount || 0));
    return pts * chainUsdCentsPerPoint;
  }
  if (benefit.valueType === "fixed_per_night") {
    const pts = Math.floor(Number(benefit.pointsAmount || 0));
    return pts * numNights * chainUsdCentsPerPoint;
  }
  if (benefit.valueType === "multiplier_on_base") {
    const mult = Number(benefit.pointsMultiplier || 0);
    const costUsd = Number(pretaxCost || 0) * exchangeRate;
    if (!costUsd) return null;
    const extraPts = Math.floor((mult - 1) * chainBasePointRate * costUsd);
    return extraPts * chainUsdCentsPerPoint;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Booking Form Component
// ---------------------------------------------------------------------------

interface BookingFormProps {
  initialData?: Booking;
  onSubmit: (data: BookingFormData) => Promise<void>;
  onCancel: () => void;
  onCurrencyChange?: (currency: string) => void;
  onAccommodationTypeChange?: (type: string) => void;
  submitting: boolean;
  submitLabel: string;
  title: string;
}

export function BookingForm({
  initialData,
  onSubmit,
  onCancel,
  onCurrencyChange,
  onAccommodationTypeChange,
  submitting,
  submitLabel,
  title,
}: BookingFormProps) {
  // Reference data
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [userCreditCards, setUserCreditCards] = useState<UserCreditCard[]>([]);
  const [portals, setPortals] = useState<ShoppingPortal[]>([]);
  const [otaAgencies, setOtaAgencies] = useState<OtaAgency[]>([]);

  // Exchange rate state
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  // Form state
  const [state, dispatch] = useReducer(bookingFormReducer, INITIAL_STATE);

  const [confirmationNumber, setConfirmationNumber] = useState<string>(
    initialData?.confirmationNumber ?? ""
  );
  const [manualGeoOpen, setManualGeoOpen] = useState(false);

  const {
    accommodationType,
    hotelChainId,
    hotelChainSubBrandId,
    propertyId,
    propertyName,
    placeId,
    geoConfirmed,
    countryCode,
    city,
    address,
    latitude,
    longitude,
    checkIn,
    checkOut,
    paymentType,
    pretaxCost,
    totalCost,
    currency,
    pointsRedeemed,
    certificates,
    userCreditCardId,
    bookingDate,
    paymentTiming,
    shoppingPortalId,
    portalCashbackRate,
    portalCashbackOnTotal,
    bookingSource,
    otaAgencyId,
    benefits,
    notes,
    showErrors,
  } = state;

  const handleGeoSelect = (result: GeoResult) => {
    dispatch({ type: "SET_PROPERTY_GEO", result });
    // Auto-set currency based on country if no costs have been entered yet
    if (!pretaxCost && !totalCost && result.countryCode) {
      const suggestedCurrency = COUNTRY_TO_CURRENCY[result.countryCode];
      if (suggestedCurrency) {
        dispatch({ type: "SET_FIELD", field: "currency", value: suggestedCurrency });
      }
    }
  };

  const handleManualPropertyEdit = () => {
    dispatch({ type: "CLEAR_GEO" });
  };

  const handleManualGeoConfirm = (
    manualPropertyName: string,
    manualCountryCode: string,
    manualCity: string
  ) => {
    dispatch({
      type: "SET_PROPERTY_GEO",
      result: {
        placeId: null,
        displayName: manualPropertyName,
        countryCode: manualCountryCode,
        city: manualCity,
        address: null,
        latitude: null,
        longitude: null,
      },
    });
  };

  const handleCheckInChange = (date?: Date) => {
    dispatch({ type: "SET_CHECK_IN", date });
  };

  const handleCheckOutChange = (date?: Date) => {
    dispatch({
      type: "SET_FIELD",
      field: "checkOut",
      value: date ? format(date, "yyyy-MM-dd") : "",
    });
  };

  const checkInDate = useMemo(() => (checkIn ? parseISO(checkIn) : undefined), [checkIn]);
  const checkOutDate = useMemo(() => (checkOut ? parseISO(checkOut) : undefined), [checkOut]);

  // Populate from initialData if present
  useEffect(() => {
    if (initialData && portals.length > 0) {
      dispatch({ type: "LOAD_INITIAL_DATA", initialData, portals });
    }
  }, [initialData, portals]);

  // Reset benefit points fields when hotel chain is cleared
  useEffect(() => {
    if (!hotelChainId) {
      dispatch({ type: "RESET_BENEFIT_POINTS" });
    }
  }, [hotelChainId]);

  // Derived booleans from accommodation type
  const isHotel = accommodationType === "hotel";

  // Derived booleans from payment type
  const hasCash = paymentType.includes("cash");
  const hasPoints = paymentType.includes("points");
  const hasCert = paymentType.includes("cert");

  // Derived state
  const numNights = checkIn && checkOut ? String(diffDays(checkIn, checkOut)) : "0";
  const taxAmount =
    pretaxCost && totalCost ? (Number(totalCost) - Number(pretaxCost)).toFixed(2) : "0.00";

  // Convert native pretax cost to USD for loyalty calculation
  const currentRate = exchangeRates[currency] ?? 1;
  const effectiveRate =
    initialData?.lockedExchangeRate != null && initialData.currency === currency
      ? Number(initialData.lockedExchangeRate)
      : currentRate;
  const usdPretaxCost = pretaxCost ? String(Number(pretaxCost) * effectiveRate) : "";

  const loyaltyPointsEarned = useMemo(
    () =>
      calculatePointsFromChain({
        hotelChainId,
        hotelChainSubBrandId,
        pretaxCost: usdPretaxCost,
        hotelChains,
      }),
    [hotelChainId, hotelChainSubBrandId, usdPretaxCost, hotelChains]
  );

  // Fetch reference data
  const fetchReferenceData = useCallback(async () => {
    const [hotelChainsRes, userCardsRes, portalsRes, agenciesRes, ratesRes] = await Promise.all([
      fetch("/api/hotel-chains"),
      fetch("/api/user-credit-cards"),
      fetch("/api/portals"),
      fetch("/api/ota-agencies"),
      fetch("/api/exchange-rates"),
    ]);
    if (hotelChainsRes.ok) setHotelChains(await hotelChainsRes.json());
    if (userCardsRes.ok) setUserCreditCards(await userCardsRes.json());
    if (portalsRes.ok) setPortals(await portalsRes.json());
    if (agenciesRes.ok) setOtaAgencies(await agenciesRes.json());
    if (ratesRes.ok) {
      const rates = (await ratesRes.json()) as { fromCurrency: string; rate: string | number }[];
      const rateMap: Record<string, number> = { USD: 1 };
      for (const r of rates) rateMap[r.fromCurrency] = Number(r.rate);
      setExchangeRates(rateMap);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    onCurrencyChange?.(currency);
  }, [currency, onCurrencyChange]);

  useEffect(() => {
    onAccommodationTypeChange?.(accommodationType);
  }, [accommodationType, onAccommodationTypeChange]);

  const { errors, isValid } = useMemo(() => {
    const errs = {
      hotelChainId: isHotel && !hotelChainId ? "Hotel chain is required" : "",
      propertyName: !propertyName.trim()
        ? "Property name is required"
        : !geoConfirmed
          ? "Please select your property from the list or enter details manually"
          : "",
      checkIn: !checkIn ? "Check-in date is required" : "",
      checkOut: !checkOut
        ? "Check-out date is required"
        : Number(numNights) <= 0
          ? "Check-out must be after check-in"
          : "",
      pretaxCost: hasCash && pretaxCost === "" ? "Pre-tax cost is required" : "",
      totalCost: hasCash && totalCost === "" ? "Total cost is required" : "",
      pointsRedeemed:
        hasPoints && (!pointsRedeemed || Number(pointsRedeemed) <= 0)
          ? "Points redeemed is required"
          : "",
      certificates:
        hasCert && (certificates.length === 0 || certificates.some((c) => !c))
          ? "All certificates must be selected"
          : "",
    };

    const valid =
      !errs.hotelChainId &&
      !errs.propertyName &&
      !errs.checkIn &&
      !errs.checkOut &&
      (!hasCash || (!errs.pretaxCost && !errs.totalCost)) &&
      (!hasPoints || !errs.pointsRedeemed) &&
      (!hasCert || !errs.certificates) &&
      Number(numNights) > 0;

    return { errors: errs, isValid: valid };
  }, [
    isHotel,
    hotelChainId,
    propertyName,
    geoConfirmed,
    checkIn,
    checkOut,
    hasCash,
    pretaxCost,
    totalCost,
    hasPoints,
    pointsRedeemed,
    hasCert,
    certificates,
    numNights,
  ]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_FIELD", field: "showErrors", value: true });

    if (!isValid) return;

    const body = {
      accommodationType,
      hotelChainId: isHotel ? hotelChainId || null : null,
      hotelChainSubBrandId:
        isHotel && hotelChainSubBrandId !== "none" ? hotelChainSubBrandId : null,
      propertyId: propertyId || undefined,
      propertyName,
      placeId: placeId || null,
      countryCode: countryCode || null,
      city: city || null,
      address: address || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      checkIn,
      checkOut,
      numNights: Number(numNights),
      pretaxCost: hasCash ? Number(pretaxCost) : 0,
      taxAmount: hasCash ? Number(taxAmount) : 0,
      totalCost: hasCash ? Number(totalCost) : 0,
      currency: hasCash ? currency : "USD",
      pointsRedeemed: hasPoints && pointsRedeemed ? Number(pointsRedeemed) : null,
      certificates: hasCert ? certificates.filter((c) => c.trim()) : [],
      userCreditCardId: userCreditCardId === "none" ? null : userCreditCardId,
      bookingDate: paymentTiming === "prepaid" && bookingDate ? bookingDate : null,
      paymentTiming,
      shoppingPortalId: shoppingPortalId === "none" ? null : shoppingPortalId,
      portalCashbackRate: (() => {
        if (shoppingPortalId === "none" || !portalCashbackRate) return null;
        const portal = portals.find((p) => p.id === shoppingPortalId);
        return portal?.rewardType === "points"
          ? Number(portalCashbackRate)
          : Number(portalCashbackRate) / 100;
      })(),
      portalCashbackOnTotal: shoppingPortalId !== "none" ? portalCashbackOnTotal : false,
      loyaltyPointsEarned: isHotel && loyaltyPointsEarned ? Number(loyaltyPointsEarned) : null,
      bookingSource: bookingSource || null,
      otaAgencyId: bookingSource === "ota" && otaAgencyId !== "none" ? otaAgencyId : null,
      benefits: benefits
        .filter((b) => b.type)
        .map((b) => ({
          benefitType: b.type,
          label: b.label || null,
          // Use valueType to determine which fields to send — avoids sending stale
          // field values when the user switched between value types
          dollarValue: b.valueType === "cash" && b.dollarValue ? Number(b.dollarValue) : null,
          pointsEarnType: b.valueType !== "" && b.valueType !== "cash" ? b.valueType : null,
          pointsAmount:
            b.valueType !== "" && b.valueType !== "cash" && b.pointsAmount
              ? Number(b.pointsAmount)
              : null,
          pointsMultiplier:
            b.valueType !== "" && b.valueType !== "cash" && b.pointsMultiplier
              ? Number(b.pointsMultiplier)
              : null,
        })),
      notes: notes || null,
      confirmationNumber: confirmationNumber.trim() || null,
    };

    await onSubmit(body);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* ── Stay Details ─────────────────────────────── */}
          <SectionDivider label="Stay Details" />

          {/* Accommodation Type */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="accommodationType">Accommodation Type</Label>
              <AppSelect
                value={accommodationType}
                onValueChange={(val) =>
                  dispatch({
                    type: "SET_ACCOMMODATION_TYPE",
                    accommodationType: val as AccommodationType,
                  })
                }
                options={[...ACCOMMODATION_TYPE_OPTIONS]}
                data-testid="accommodation-type-select"
              />
            </div>
          </div>

          {/* Hotel Chain + Sub-brand + Property Name */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {isHotel && (
              <div className="space-y-2">
                <Label htmlFor="hotelChainId">Hotel Chain *</Label>
                <AppSelect
                  value={hotelChainId}
                  error={showErrors ? errors.hotelChainId : ""}
                  onValueChange={(val) =>
                    dispatch({ type: "SET_HOTEL_CHAIN_ID", hotelChainId: val })
                  }
                  options={hotelChains.map((chain) => ({
                    label: chain.name,
                    value: chain.id,
                  }))}
                  placeholder="Select hotel chain..."
                  data-testid="hotel-chain-select"
                />
              </div>
            )}

            {isHotel && (
              <div className="space-y-2">
                <Label htmlFor="hotelChainSubBrandId">Sub-brand</Label>
                <AppSelect
                  value={!hotelChainId ? "" : hotelChainSubBrandId}
                  onValueChange={(val) =>
                    dispatch({ type: "SET_FIELD", field: "hotelChainSubBrandId", value: val })
                  }
                  disabled={
                    !hotelChainId ||
                    (hotelChains.find((h) => h.id === hotelChainId)?.hotelChainSubBrands.length ??
                      0) === 0
                  }
                  options={[
                    { label: "None / Not applicable", value: "none" },
                    ...(hotelChains
                      .find((h) => h.id === hotelChainId)
                      ?.hotelChainSubBrands.map((sb) => ({
                        label: sb.name,
                        value: sb.id,
                      })) || []),
                  ]}
                  placeholder={!hotelChainId ? "Select chain first..." : "Select sub-brand..."}
                  data-testid="sub-brand-select"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="propertyName">
                {isHotel ? "Property Name" : "Property / Rental Name"} *
              </Label>
              <PropertyNameCombobox
                id="propertyName"
                value={propertyName}
                confirmed={geoConfirmed}
                countryCode={countryCode}
                city={city}
                onValueChange={(val) =>
                  dispatch({ type: "SET_FIELD", field: "propertyName", value: val })
                }
                onGeoSelect={handleGeoSelect}
                onManualEdit={handleManualPropertyEdit}
                onReset={() => dispatch({ type: "RESET_PROPERTY" })}
                onCantFind={() => setManualGeoOpen(true)}
                accommodationType={accommodationType}
                error={showErrors ? errors.propertyName : ""}
                data-testid="property-name-input"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="checkIn">Check-in Date *</Label>
              <DatePicker
                id="checkIn"
                date={checkInDate}
                error={showErrors ? errors.checkIn : ""}
                setDate={handleCheckInChange}
                placeholder="Select check-in"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOut">Check-out Date *</Label>
              <DatePicker
                id="checkOut"
                date={checkOutDate}
                error={showErrors ? errors.checkOut : ""}
                setDate={handleCheckOutChange}
                placeholder="Select check-out"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numNights">Number of Nights</Label>
              <Input
                id="numNights"
                type="number"
                min="1"
                value={numNights}
                readOnly
                className="bg-muted text-muted-foreground"
              />
            </div>
          </div>

          {/* ── Payment ───────────────────────────────────── */}
          <SectionDivider label="Payment" />

          {/* Payment Type */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="paymentType">Payment Type</Label>
              <AppSelect
                value={paymentType}
                onValueChange={(v) =>
                  dispatch({ type: "SET_PAYMENT_TYPE", paymentType: v as PaymentType })
                }
                options={PAYMENT_TYPES.filter((pt) => isHotel || !pt.value.includes("cert"))}
                data-testid="payment-type-select"
              />
            </div>
          </div>

          {/* Costs & Currency — cash only */}
          {hasCash && (
            <div className="space-y-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="pretaxCost">Pre-tax Cost *</Label>
                  <Input
                    id="pretaxCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pretaxCost}
                    onChange={(e) =>
                      dispatch({ type: "SET_FIELD", field: "pretaxCost", value: e.target.value })
                    }
                    placeholder="0.00"
                    error={showErrors ? errors.pretaxCost : ""}
                  />
                  {currency !== "USD" && pretaxCost && currentRate !== 1 && (
                    <p className="text-xs text-muted-foreground">
                      ≈{" "}
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(Number(pretaxCost) * currentRate)}{" "}
                      USD
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalCost">Total Cost *</Label>
                  <Input
                    id="totalCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalCost}
                    onChange={(e) =>
                      dispatch({ type: "SET_FIELD", field: "totalCost", value: e.target.value })
                    }
                    placeholder="0.00"
                    error={showErrors ? errors.totalCost : ""}
                  />
                  {currency !== "USD" && totalCost && currentRate !== 1 && (
                    <p className="text-xs text-muted-foreground">
                      ≈{" "}
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(Number(totalCost) * currentRate)}{" "}
                      USD
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <CurrencyCombobox
                    value={currency}
                    onValueChange={(val) =>
                      dispatch({ type: "SET_FIELD", field: "currency", value: val })
                    }
                    data-testid="currency-select"
                  />
                  {currency !== "USD" && currentRate !== 1 && (
                    <p className="text-xs text-muted-foreground">
                      1 {currency} = {currentRate.toFixed(4)} USD (refreshed daily)
                    </p>
                  )}
                  {currency !== "USD" && currentRate === 1 && (
                    <p className="text-xs text-muted-foreground">
                      Exchange rate not available yet. Costs stored in {currency}; USD amounts
                      computed at check-in.
                    </p>
                  )}
                </div>
              </div>
              {currency !== "USD" && currentRate !== 1 && (
                <p className="text-xs text-muted-foreground">
                  For past stays, the exact check-in date rate will be used.
                </p>
              )}
            </div>
          )}

          {/* Points Redeemed — points only */}
          {hasPoints && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pointsRedeemed">Points Redeemed *</Label>
                <Input
                  id="pointsRedeemed"
                  type="number"
                  min="0"
                  value={pointsRedeemed}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "pointsRedeemed", value: e.target.value })
                  }
                  placeholder="e.g. 40000"
                  error={showErrors ? errors.pointsRedeemed : ""}
                />
              </div>
            </div>
          )}

          {/* Certificates — cert only */}
          {hasCert && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Free Night Certificate(s) *</Label>
                {certificates.map((cert, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <AppSelect
                        value={cert}
                        onValueChange={(v) =>
                          dispatch({ type: "UPDATE_CERTIFICATE", index: idx, value: v })
                        }
                        options={CERT_TYPE_OPTIONS.filter(
                          (opt) => opt.hotelChainId === hotelChainId
                        )}
                        placeholder="Select certificate type..."
                        className="flex-1"
                        data-testid={`certificate-select-${idx}`}
                        error={showErrors && !cert ? "Required" : ""}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => dispatch({ type: "REMOVE_CERTIFICATE", index: idx })}
                        className="shrink-0 h-7 w-7 p-0"
                        data-testid={`certificate-remove-${idx}`}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="space-y-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => dispatch({ type: "ADD_CERTIFICATE" })}
                    data-testid="add-certificate-button"
                  >
                    + Add Certificate
                  </Button>
                  {showErrors && certificates.length === 0 && (
                    <p className="text-xs font-medium text-destructive">
                      At least one certificate is required
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Credit Card + Payment Timing + Booking Date (prepaid only) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="userCreditCardId">Credit Card</Label>
              <AppSelect
                value={userCreditCardId}
                onValueChange={(val) =>
                  dispatch({ type: "SET_FIELD", field: "userCreditCardId", value: val })
                }
                options={[
                  { label: "None", value: "none" },
                  ...userCreditCards.map((uc) => ({
                    label: uc.nickname
                      ? `${uc.creditCard.name} (${uc.nickname})`
                      : uc.creditCard.name,
                    value: uc.id,
                  })),
                ]}
                placeholder="Select credit card..."
                data-testid="credit-card-select"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTiming">Payment Timing</Label>
              <AppSelect
                value={paymentTiming}
                onValueChange={(val) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "paymentTiming",
                    value: val as "prepaid" | "postpaid",
                  })
                }
                options={[
                  { label: "Postpaid (charged at check-in)", value: "postpaid" },
                  { label: "Prepaid (charged at booking)", value: "prepaid" },
                ]}
                data-testid="payment-timing-select"
              />
            </div>
            {paymentTiming === "prepaid" && (
              <div className="space-y-2">
                <Label htmlFor="bookingDate">Booking Date</Label>
                <DatePicker
                  id="bookingDate"
                  date={bookingDate ? parseISO(bookingDate) : undefined}
                  setDate={(date) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "bookingDate",
                      value: date ? format(date, "yyyy-MM-dd") : "",
                    })
                  }
                  placeholder="Select booking date"
                  data-testid="booking-date-picker"
                />
              </div>
            )}
          </div>

          {/* ── Booking Context ───────────────────────────── */}
          <SectionDivider label="Booking Context" />

          {/* Booking Source + OTA Agency — adjacent pair */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bookingSource">Booking Source</Label>
              <AppSelect
                value={bookingSource || "none"}
                onValueChange={(v) => dispatch({ type: "SET_BOOKING_SOURCE", bookingSource: v })}
                options={[{ label: "Not specified", value: "none" }, ...BOOKING_SOURCE_OPTIONS]}
                placeholder="Where was this booked? (optional)"
                data-testid="booking-source-select"
              />
            </div>
            {bookingSource === "ota" && (
              <div className="space-y-2">
                <Label htmlFor="otaAgencyId">OTA Agency</Label>
                <AppSelect
                  value={otaAgencyId}
                  onValueChange={(val) =>
                    dispatch({ type: "SET_FIELD", field: "otaAgencyId", value: val })
                  }
                  options={[
                    { label: "Not specified", value: "none" },
                    ...otaAgencies.map((a) => ({
                      label: a.name,
                      value: a.id,
                    })),
                  ]}
                  placeholder="Select agency..."
                  data-testid="ota-agency-select"
                />
              </div>
            )}
          </div>

          {/* Shopping Portal + Rate — adjacent pair */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shoppingPortalId">Shopping Portal</Label>
              <AppSelect
                value={shoppingPortalId}
                onValueChange={(val) =>
                  dispatch({ type: "SET_FIELD", field: "shoppingPortalId", value: val })
                }
                options={[
                  { label: "None", value: "none" },
                  ...portals.map((portal) => ({
                    label: portal.name,
                    value: portal.id,
                  })),
                ]}
                placeholder="Select portal..."
                data-testid="shopping-portal-select"
              />
            </div>
            {shoppingPortalId !== "none" && (
              <div className="space-y-2">
                {(() => {
                  const portal = portals.find((p) => p.id === shoppingPortalId);
                  const isPoints = portal?.rewardType === "points";
                  return (
                    <Label htmlFor="portalCashbackRate">
                      {isPoints ? "Points Rate (pts/$)" : "Cashback Rate (%)"}
                    </Label>
                  );
                })()}
                <Input
                  id="portalCashbackRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={portalCashbackRate}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "portalCashbackRate",
                      value: e.target.value,
                    })
                  }
                  placeholder={(() => {
                    const portal = portals.find((p) => p.id === shoppingPortalId);
                    return portal?.rewardType === "points" ? "e.g. 5.0" : "e.g. 6.75";
                  })()}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="portalCashbackOnTotal"
                    checked={portalCashbackOnTotal}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "portalCashbackOnTotal",
                        value: e.target.checked,
                      })
                    }
                  />
                  <Label htmlFor="portalCashbackOnTotal" className="font-normal text-xs">
                    Apply to total (default: pre-tax)
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* Benefits */}
          {(() => {
            const selectedChain = hotelChains?.find((c) => c.id === hotelChainId) ?? null;
            const chainHasLoyalty = !!selectedChain?.pointType;
            const chainBasePointRate = selectedChain ? Number(selectedChain.basePointRate ?? 0) : 0;
            const chainUsdCentsPerPoint = selectedChain?.pointType
              ? Number(selectedChain.pointType.usdCentsPerPoint)
              : 0;
            return (
              <div className="space-y-2">
                <Label>Booking Benefits</Label>
                <div className="space-y-3">
                  {benefits.map((benefit, idx) => {
                    const approxValue = calcBenefitApproxValue(
                      benefit,
                      Number(numNights || 1),
                      pretaxCost,
                      chainBasePointRate,
                      chainUsdCentsPerPoint,
                      effectiveRate
                    );
                    const isOther = benefit.type === "other";
                    return (
                      <div
                        key={benefit._id}
                        className="flex items-start gap-2"
                        data-testid={`benefit-card-${idx}`}
                      >
                        <div className="flex-1 sm:flex-none flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          {/* Benefit type */}
                          <div className="w-full sm:w-48 sm:shrink-0">
                            <AppSelect
                              value={benefit.type || "none"}
                              onValueChange={(v) => {
                                const newType = v === "none" ? "" : v;
                                dispatch({
                                  type: "UPDATE_BENEFIT",
                                  index: idx,
                                  field: "type",
                                  value: newType,
                                });
                                if (newType !== "other") {
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "label",
                                    value: "",
                                  });
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "valueType",
                                    value: "cash",
                                  });
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "pointsEarnType",
                                    value: "",
                                  });
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "pointsAmount",
                                    value: "",
                                  });
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "pointsMultiplier",
                                    value: "",
                                  });
                                }
                              }}
                              options={[
                                { label: "Select type...", value: "none" },
                                ...BENEFIT_TYPE_OPTIONS,
                              ]}
                              placeholder="Select type..."
                              data-testid={`benefit-type-select-${idx}`}
                            />
                          </div>

                          {/* Label input — only for "other" */}
                          {isOther && (
                            <div className="w-full sm:w-36 sm:shrink-0">
                              <Input
                                placeholder="Label"
                                value={benefit.label}
                                onChange={(e) =>
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "label",
                                    value: e.target.value,
                                  })
                                }
                                data-testid={`benefit-label-input-${idx}`}
                              />
                            </div>
                          )}

                          {/* Value type select — only for "other" */}
                          {isOther && (
                            <div className="w-full sm:w-36 sm:shrink-0">
                              <AppSelect
                                value={benefit.valueType || "none"}
                                onValueChange={(vt) => {
                                  const newVt = vt === "none" ? "" : vt;
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "valueType",
                                    value: newVt,
                                  });
                                  if (newVt === "" || newVt === "cash") {
                                    dispatch({
                                      type: "UPDATE_BENEFIT",
                                      index: idx,
                                      field: "pointsEarnType",
                                      value: "",
                                    });
                                    dispatch({
                                      type: "UPDATE_BENEFIT",
                                      index: idx,
                                      field: "pointsAmount",
                                      value: "",
                                    });
                                    dispatch({
                                      type: "UPDATE_BENEFIT",
                                      index: idx,
                                      field: "pointsMultiplier",
                                      value: "",
                                    });
                                    if (newVt === "") {
                                      dispatch({
                                        type: "UPDATE_BENEFIT",
                                        index: idx,
                                        field: "dollarValue",
                                        value: "",
                                      });
                                    }
                                  } else {
                                    dispatch({
                                      type: "UPDATE_BENEFIT",
                                      index: idx,
                                      field: "dollarValue",
                                      value: "",
                                    });
                                    dispatch({
                                      type: "UPDATE_BENEFIT",
                                      index: idx,
                                      field: "pointsEarnType",
                                      value: newVt,
                                    });
                                    dispatch({
                                      type: "UPDATE_BENEFIT",
                                      index: idx,
                                      field: "pointsAmount",
                                      value: "",
                                    });
                                    dispatch({
                                      type: "UPDATE_BENEFIT",
                                      index: idx,
                                      field: "pointsMultiplier",
                                      value: "",
                                    });
                                  }
                                }}
                                options={[
                                  { label: "No value", value: "none" },
                                  { label: `Cash (${currency})`, value: "cash" },
                                  ...(chainHasLoyalty
                                    ? [
                                        { label: "Pts/stay", value: "fixed_per_stay" },
                                        { label: "Pts/night", value: "fixed_per_night" },
                                        ...(chainBasePointRate
                                          ? [{ label: "Multiplier", value: "multiplier_on_base" }]
                                          : []),
                                      ]
                                    : []),
                                ]}
                                data-testid={`benefit-vt-select-${idx}`}
                              />
                            </div>
                          )}

                          {/* Cash value input — shown when valueType is "cash" */}
                          {benefit.valueType === "cash" && (
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-muted-foreground">{currency}</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={benefit.dollarValue}
                                onChange={(e) =>
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "dollarValue",
                                    value: e.target.value,
                                  })
                                }
                                className="w-24"
                                data-testid={`benefit-dollar-${idx}`}
                              />
                            </div>
                          )}

                          {/* Points input — fixed per stay or per night */}
                          {(benefit.valueType === "fixed_per_stay" ||
                            benefit.valueType === "fixed_per_night") && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                placeholder="pts"
                                value={benefit.pointsAmount}
                                onChange={(e) =>
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "pointsAmount",
                                    value: e.target.value,
                                  })
                                }
                                className="w-24"
                                data-testid={`benefit-points-amount-${idx}`}
                              />
                              <span className="text-sm text-muted-foreground">
                                pts
                                {benefit.valueType === "fixed_per_night"
                                  ? ` × ${numNights || 1}`
                                  : ""}
                              </span>
                            </div>
                          )}

                          {/* Multiplier input */}
                          {benefit.valueType === "multiplier_on_base" && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="1"
                                step="0.125"
                                placeholder="2.0"
                                value={benefit.pointsMultiplier}
                                onChange={(e) =>
                                  dispatch({
                                    type: "UPDATE_BENEFIT",
                                    index: idx,
                                    field: "pointsMultiplier",
                                    value: e.target.value,
                                  })
                                }
                                className="w-20"
                                data-testid={`benefit-multiplier-${idx}`}
                              />
                              <span className="text-sm text-muted-foreground">× base</span>
                            </div>
                          )}

                          {/* Approximate value */}
                          {benefit.valueType !== "" && (
                            <span
                              className="text-sm text-muted-foreground shrink-0"
                              data-testid={`benefit-approx-value-${idx}`}
                            >
                              {approxValue != null && approxValue > 0
                                ? `≈ ${formatCurrency(approxValue)}`
                                : benefit.valueType === "multiplier_on_base"
                                  ? "—"
                                  : null}
                            </span>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => dispatch({ type: "REMOVE_BENEFIT", index: idx })}
                          className="shrink-0 self-center h-7 w-7 p-0"
                          data-testid={`benefit-remove-${idx}`}
                        >
                          ✕
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch({ type: "ADD_BENEFIT" })}
                >
                  + Add Benefit
                </Button>
              </div>
            );
          })()}

          {/* Confirmation Number + Notes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="confirmation-number">Confirmation Number</Label>
              <Input
                id="confirmation-number"
                data-testid="confirmation-number-input"
                placeholder="Optional"
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "notes", value: e.target.value })
                }
                placeholder="Any additional notes..."
                rows={3}
                data-testid="notes-textarea"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm p-4 -mx-6 -mb-6 border-t md:static md:bg-transparent md:p-0 md:m-0 md:border-none flex gap-4 z-10">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 md:flex-none"
              data-testid="booking-form-submit"
            >
              {submitting ? "Submitting..." : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 md:flex-none"
              data-testid="booking-form-cancel"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
      <ManualGeoModal
        key={manualGeoOpen ? `open-${propertyName}` : "closed"}
        open={manualGeoOpen}
        onClose={() => setManualGeoOpen(false)}
        initialPropertyName={propertyName}
        onConfirm={handleManualGeoConfirm}
      />
    </Card>
  );
}
