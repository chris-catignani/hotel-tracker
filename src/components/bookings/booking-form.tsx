"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/app-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { CERT_TYPE_OPTIONS } from "@/lib/cert-types";
import { format, parseISO } from "date-fns";
import { calculatePointsFromChain } from "@/lib/loyalty-utils";
import {
  ACCOMMODATION_TYPE_OPTIONS,
  BENEFIT_TYPE_OPTIONS,
  BOOKING_SOURCE_OPTIONS,
  PAYMENT_TYPES,
} from "@/lib/constants";
import { CurrencyCombobox } from "@/components/ui/currency-combobox";
import { PropertyNameCombobox } from "@/components/ui/property-name-combobox";
import { ManualGeoModal } from "@/components/ui/manual-geo-modal";
import {
  AccommodationType,
  Booking,
  BookingFormData,
  CreditCard,
  GeoResult,
  HotelChain,
  OtaAgency,
  PaymentType,
  ShoppingPortal,
} from "@/lib/types";
import { bookingFormReducer, INITIAL_STATE } from "./booking-form-reducer";

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

// ---------------------------------------------------------------------------
// Booking Form Component
// ---------------------------------------------------------------------------

interface BookingFormProps {
  initialData?: Booking;
  onSubmit: (data: BookingFormData) => Promise<void>;
  onCancel: () => void;
  onCurrencyChange?: (currency: string) => void;
  submitting: boolean;
  submitLabel: string;
  title: string;
}

export function BookingForm({
  initialData,
  onSubmit,
  onCancel,
  onCurrencyChange,
  submitting,
  submitLabel,
  title,
}: BookingFormProps) {
  // Reference data
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [portals, setPortals] = useState<ShoppingPortal[]>([]);
  const [otaAgencies, setOtaAgencies] = useState<OtaAgency[]>([]);

  // Exchange rate state
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  // Form state
  const [state, dispatch] = useReducer(bookingFormReducer, INITIAL_STATE);

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
    creditCardId,
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
  const usdPretaxCost = pretaxCost ? String(Number(pretaxCost) * currentRate) : "";

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
    const [hotelChainsRes, cardsRes, portalsRes, agenciesRes, ratesRes] = await Promise.all([
      fetch("/api/hotel-chains"),
      fetch("/api/credit-cards"),
      fetch("/api/portals"),
      fetch("/api/ota-agencies"),
      fetch("/api/exchange-rates"),
    ]);
    if (hotelChainsRes.ok) setHotelChains(await hotelChainsRes.json());
    if (cardsRes.ok) setCreditCards(await cardsRes.json());
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
      creditCardId: creditCardId === "none" ? null : creditCardId,
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
          dollarValue: b.dollarValue ? Number(b.dollarValue) : null,
        })),
      notes: notes || null,
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
          {/* Accommodation Type */}
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

            {/* Sub-brand selector — hotel only */}
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

          {/* Payment Type */}
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

          {/* Costs & Currency */}
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

          {/* Points Redeemed */}
          {hasPoints && (
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
          )}

          {/* Certificates */}
          {hasCert && (
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
                      options={CERT_TYPE_OPTIONS.filter((opt) => opt.hotelChainId === hotelChainId)}
                      placeholder="Select certificate type..."
                      className="flex-1"
                      data-testid={`certificate-select-${idx}`}
                      error={showErrors && !cert ? "Required" : ""}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => dispatch({ type: "REMOVE_CERTIFICATE", index: idx })}
                    >
                      ×
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
          )}

          {/* Source & Credit Card */}
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
            <div className="space-y-2">
              <Label htmlFor="creditCardId">Credit Card</Label>
              <AppSelect
                value={creditCardId}
                onValueChange={(val) =>
                  dispatch({ type: "SET_FIELD", field: "creditCardId", value: val })
                }
                options={[
                  { label: "None", value: "none" },
                  ...creditCards.map((card) => ({
                    label: card.name,
                    value: card.id,
                  })),
                ]}
                placeholder="Select credit card..."
                data-testid="credit-card-select"
              />
            </div>
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

          {/* Portal & Rate */}
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

          {/* Loyalty Points — hotel stays only */}
          {isHotel && (
            <div className="space-y-2">
              <Label htmlFor="loyaltyPointsEarned">Loyalty Points Earned</Label>
              <Input
                id="loyaltyPointsEarned"
                type="number"
                min="0"
                value={loyaltyPointsEarned}
                readOnly
                className="bg-muted text-muted-foreground"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Auto-calculated from hotel chain rates.
              </p>
            </div>
          )}

          {/* Benefits */}
          <div className="space-y-2">
            <Label>Booking Benefits</Label>
            <div className="space-y-3">
              {benefits.map((benefit, idx) => (
                <div
                  key={benefit._id}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border rounded-lg sm:p-0 sm:border-none sm:rounded-none"
                >
                  <AppSelect
                    value={benefit.type || "none"}
                    onValueChange={(v) =>
                      dispatch({
                        type: "UPDATE_BENEFIT",
                        index: idx,
                        field: "type",
                        value: v === "none" ? "" : v,
                      })
                    }
                    options={[{ label: "Select type...", value: "none" }, ...BENEFIT_TYPE_OPTIONS]}
                    placeholder="Select type..."
                    className="w-full sm:w-56 shrink-0"
                    data-testid={`benefit-type-select-${idx}`}
                  />
                  {benefit.type === "other" && (
                    <Input
                      value={benefit.label}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_BENEFIT",
                          index: idx,
                          field: "label",
                          value: e.target.value,
                        })
                      }
                      placeholder="Description"
                      className="flex-1 min-w-[120px]"
                    />
                  )}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={benefit.dollarValue}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_BENEFIT",
                          index: idx,
                          field: "dollarValue",
                          value: e.target.value,
                        })
                      }
                      placeholder="$ value"
                      className="flex-1 sm:w-36 shrink-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => dispatch({ type: "REMOVE_BENEFIT", index: idx })}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
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

          {/* Notes */}
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
            />
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
