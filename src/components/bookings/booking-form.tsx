"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CERT_TYPE_OPTIONS } from "@/lib/cert-types";
import { calculatePointsFromChain } from "@/lib/loyalty-utils";
import {
  BENEFIT_TYPE_OPTIONS,
  BOOKING_SOURCE_OPTIONS,
  CURRENCIES,
  PAYMENT_TYPES,
} from "@/lib/constants";
import {
  Booking,
  BookingFormData,
  CreditCard,
  HotelChain,
  OtaAgency,
  PaymentType,
  ShoppingPortal,
} from "@/lib/types";

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

function toDateInputValue(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toPaymentType(
  totalCost: string | number,
  pointsRedeemed: number | null,
  certificates: { certType: string }[]
): PaymentType {
  const hasCash = Number(totalCost) > 0;
  const hasPoints = pointsRedeemed != null && Number(pointsRedeemed) > 0;
  const hasCert = certificates.length > 0;
  if (hasCash && hasPoints && hasCert) return "cash_points_cert";
  if (hasCash && hasPoints) return "cash_points";
  if (hasCash && hasCert) return "cash_cert";
  if (hasPoints && hasCert) return "points_cert";
  if (hasPoints) return "points";
  if (hasCert) return "cert";
  return "cash";
}

// ---------------------------------------------------------------------------
// Booking Form Component
// ---------------------------------------------------------------------------

interface BookingFormProps {
  initialData?: Booking;
  onSubmit: (data: BookingFormData) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
  title: string;
}

export function BookingForm({
  initialData,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
  title,
}: BookingFormProps) {
  // Reference data
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [portals, setPortals] = useState<ShoppingPortal[]>([]);
  const [otaAgencies, setOtaAgencies] = useState<OtaAgency[]>([]);

  // Form fields
  const [hotelChainId, setHotelChainId] = useState("");
  const [hotelChainSubBrandId, setHotelChainSubBrandId] = useState("none");
  const [propertyName, setPropertyName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [pretaxCost, setPretaxCost] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [originalAmount, setOriginalAmount] = useState("");
  const [pointsRedeemed, setPointsRedeemed] = useState("");
  const [certificates, setCertificates] = useState<string[]>([]);
  const [creditCardId, setCreditCardId] = useState("none");
  const [shoppingPortalId, setShoppingPortalId] = useState("none");
  const [portalCashbackRate, setPortalCashbackRate] = useState("");
  const [portalCashbackOnTotal, setPortalCashbackOnTotal] = useState(false);
  const [bookingSource, setBookingSource] = useState("");
  const [otaAgencyId, setOtaAgencyId] = useState("none");
  const [benefits, setBenefits] = useState<{ type: string; label: string; dollarValue: string }[]>(
    []
  );
  const [notes, setNotes] = useState("");

  // Populate from initialData if present
  useEffect(() => {
    if (initialData && portals.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHotelChainId(String(initialData.hotelChainId));
      setHotelChainSubBrandId(
        initialData.hotelChainSubBrandId ? String(initialData.hotelChainSubBrandId) : "none"
      );
      setPropertyName(initialData.propertyName);
      setCheckIn(toDateInputValue(initialData.checkIn));
      setCheckOut(toDateInputValue(initialData.checkOut));
      setPaymentType(
        toPaymentType(initialData.totalCost, initialData.pointsRedeemed, initialData.certificates)
      );
      setPretaxCost(String(Number(initialData.pretaxCost)));
      setTotalCost(String(Number(initialData.totalCost)));
      setCurrency(initialData.currency || "USD");
      setOriginalAmount(
        initialData.originalAmount ? String(Number(initialData.originalAmount)) : ""
      );
      setCreditCardId(initialData.creditCardId ? String(initialData.creditCardId) : "none");
      setShoppingPortalId(
        initialData.shoppingPortalId ? String(initialData.shoppingPortalId) : "none"
      );
      const portalForBooking = initialData.shoppingPortalId
        ? portals.find((p) => p.id === initialData.shoppingPortalId)
        : null;
      setPortalCashbackRate(
        initialData.portalCashbackRate
          ? portalForBooking?.rewardType === "points"
            ? String(Number(initialData.portalCashbackRate))
            : String(Number(initialData.portalCashbackRate) * 100)
          : ""
      );
      setPortalCashbackOnTotal(initialData.portalCashbackOnTotal ?? false);
      if (initialData.pointsRedeemed != null) {
        setPointsRedeemed(String(initialData.pointsRedeemed));
      }
      setCertificates(initialData.certificates.map((c) => c.certType));
      setBookingSource(initialData.bookingSource || "");
      setOtaAgencyId(initialData.otaAgencyId ? String(initialData.otaAgencyId) : "none");
      setBenefits(
        initialData.benefits.map((b) => ({
          type: b.benefitType,
          label: b.label || "",
          dollarValue: b.dollarValue != null ? String(Number(b.dollarValue)) : "",
        }))
      );
      setNotes(initialData.notes || "");
    }
  }, [initialData, portals]);

  // Derived booleans from payment type
  const hasCash = paymentType.includes("cash");
  const hasPoints = paymentType.includes("points");
  const hasCert = paymentType.includes("cert");

  // Derived state
  const numNights = checkIn && checkOut ? String(diffDays(checkIn, checkOut)) : "0";
  const taxAmount =
    pretaxCost && totalCost ? (Number(totalCost) - Number(pretaxCost)).toFixed(2) : "0.00";

  const loyaltyPointsEarned = useMemo(
    () =>
      calculatePointsFromChain({
        hotelChainId,
        hotelChainSubBrandId,
        pretaxCost,
        hotelChains,
      }),
    [hotelChainId, hotelChainSubBrandId, pretaxCost, hotelChains]
  );

  // Fetch reference data
  const fetchReferenceData = useCallback(async () => {
    const [hotelChainsRes, cardsRes, portalsRes, agenciesRes] = await Promise.all([
      fetch("/api/hotel-chains"),
      fetch("/api/credit-cards"),
      fetch("/api/portals"),
      fetch("/api/ota-agencies"),
    ]);
    if (hotelChainsRes.ok) setHotelChains(await hotelChainsRes.json());
    if (cardsRes.ok) setCreditCards(await cardsRes.json());
    if (portalsRes.ok) setPortals(await portalsRes.json());
    if (agenciesRes.ok) setOtaAgencies(await agenciesRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReferenceData();
  }, [fetchReferenceData]);

  const handlePaymentTypeChange = (v: PaymentType) => {
    setPaymentType(v);
    if (!v.includes("points")) setPointsRedeemed("");
    if (!v.includes("cert")) setCertificates([]);
  };

  const addCertificate = () => setCertificates((prev) => [...prev, ""]);
  const updateCertificate = (idx: number, value: string) =>
    setCertificates((prev) => prev.map((c, i) => (i === idx ? value : c)));
  const removeCertificate = (idx: number) =>
    setCertificates((prev) => prev.filter((_, i) => i !== idx));

  const addBenefit = () =>
    setBenefits((prev) => [...prev, { type: "", label: "", dollarValue: "" }]);
  const updateBenefit = (idx: number, field: string, value: string) =>
    setBenefits((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  const removeBenefit = (idx: number) => setBenefits((prev) => prev.filter((_, i) => i !== idx));

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      hotelChainId: Number(hotelChainId),
      hotelChainSubBrandId: hotelChainSubBrandId === "none" ? null : Number(hotelChainSubBrandId),
      propertyName,
      checkIn,
      checkOut,
      numNights: Number(numNights),
      pretaxCost: hasCash ? Number(pretaxCost) : 0,
      taxAmount: hasCash ? Number(taxAmount) : 0,
      totalCost: hasCash ? Number(totalCost) : 0,
      currency: hasCash ? currency : "USD",
      originalAmount:
        hasCash && currency !== "USD" && originalAmount ? Number(originalAmount) : null,
      pointsRedeemed: hasPoints && pointsRedeemed ? Number(pointsRedeemed) : null,
      certificates: hasCert ? certificates.filter((c) => c.trim()) : [],
      creditCardId: creditCardId === "none" ? null : Number(creditCardId),
      shoppingPortalId: shoppingPortalId === "none" ? null : Number(shoppingPortalId),
      portalCashbackRate: (() => {
        if (shoppingPortalId === "none" || !portalCashbackRate) return null;
        const portal = portals.find((p) => String(p.id) === shoppingPortalId);
        return portal?.rewardType === "points"
          ? Number(portalCashbackRate)
          : Number(portalCashbackRate) / 100;
      })(),
      portalCashbackOnTotal: shoppingPortalId !== "none" ? portalCashbackOnTotal : false,
      loyaltyPointsEarned: loyaltyPointsEarned ? Number(loyaltyPointsEarned) : null,
      bookingSource: bookingSource || null,
      otaAgencyId: bookingSource === "ota" && otaAgencyId !== "none" ? Number(otaAgencyId) : null,
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

  const isValid =
    hotelChainId &&
    propertyName.trim() &&
    checkIn &&
    checkOut &&
    numNights &&
    (!hasCash || (pretaxCost !== "" && totalCost !== ""));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* Hotel Chain + Property Name */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hotelChainId">Hotel Chain *</Label>
              <Select
                value={hotelChainId}
                onValueChange={(val) => {
                  setHotelChainId(val);
                  setHotelChainSubBrandId("none");
                  setCertificates((prev) =>
                    prev.filter((cert) => {
                      if (!cert) return true;
                      const opt = CERT_TYPE_OPTIONS.find((o) => o.value === cert);
                      return opt && opt.hotelChainId === Number(val);
                    })
                  );
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
            <div className="space-y-2">
              <Label htmlFor="propertyName">Property Name *</Label>
              <Input
                id="propertyName"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="e.g. Marriott Downtown Chicago"
                required
              />
            </div>
          </div>

          {/* Sub-brand selector */}
          {hotelChains.find((h) => h.id === Number(hotelChainId))?.hotelChainSubBrands.length ? (
            <div className="space-y-2">
              <Label htmlFor="hotelChainSubBrandId">Sub-brand</Label>
              <Select value={hotelChainSubBrandId} onValueChange={setHotelChainSubBrandId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select sub-brand..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / Not applicable</SelectItem>
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
          ) : null}

          {/* Booking Source */}
          <div className="space-y-2">
            <Label htmlFor="bookingSource">Booking Source</Label>
            <Select
              value={bookingSource || "none"}
              onValueChange={(v) => {
                setBookingSource(v === "none" ? "" : v);
                if (v !== "ota") setOtaAgencyId("none");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Where was this booked? (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {BOOKING_SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bookingSource === "ota" && (
            <div className="space-y-2">
              <Label htmlFor="otaAgencyId">OTA Agency</Label>
              <Select value={otaAgencyId} onValueChange={setOtaAgencyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select agency..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {otaAgencies.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="checkIn">Check-in Date *</Label>
              <Input
                id="checkIn"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOut">Check-out Date *</Label>
              <Input
                id="checkOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                required
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
            <Select
              value={paymentType}
              onValueChange={(v) => handlePaymentTypeChange(v as PaymentType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>
                    {pt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Costs */}
          {hasCash && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pretaxCost">Pre-tax Cost (USD) *</Label>
                <Input
                  id="pretaxCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pretaxCost}
                  onChange={(e) => setPretaxCost(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalCost">Total Cost (USD) *</Label>
                <Input
                  id="totalCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          )}

          {/* Currency */}
          {hasCash && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currency !== "USD" && (
                <div className="space-y-2">
                  <Label htmlFor="originalAmount">Original Amount ({currency})</Label>
                  <Input
                    id="originalAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={originalAmount}
                    onChange={(e) => setOriginalAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    USD amounts above are used for all calculations.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Points Redeemed */}
          {hasPoints && (
            <div className="space-y-2">
              <Label htmlFor="pointsRedeemed">Points Redeemed</Label>
              <Input
                id="pointsRedeemed"
                type="number"
                min="0"
                value={pointsRedeemed}
                onChange={(e) => setPointsRedeemed(e.target.value)}
                placeholder="e.g. 40000"
              />
            </div>
          )}

          {/* Certificates */}
          {hasCert && (
            <div className="space-y-2">
              <Label>Free Night Certificate(s)</Label>
              {certificates.map((cert, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={cert} onValueChange={(v) => updateCertificate(idx, v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select certificate type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CERT_TYPE_OPTIONS.filter(
                        (opt) => opt.hotelChainId === Number(hotelChainId)
                      ).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeCertificate(idx)}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addCertificate}>
                + Add Certificate
              </Button>
            </div>
          )}

          {/* Cards & Portals */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="creditCardId">Credit Card</Label>
              <Select value={creditCardId} onValueChange={setCreditCardId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select credit card..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {creditCards.map((card) => (
                    <SelectItem key={card.id} value={String(card.id)}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shoppingPortalId">Shopping Portal</Label>
              <Select value={shoppingPortalId} onValueChange={setShoppingPortalId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select portal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {portals.map((portal) => (
                    <SelectItem key={portal.id} value={String(portal.id)}>
                      {portal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Portal Rate */}
          {shoppingPortalId !== "none" && (
            <div className="space-y-2">
              {(() => {
                const portal = portals.find((p) => String(p.id) === shoppingPortalId);
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
                onChange={(e) => setPortalCashbackRate(e.target.value)}
                placeholder={(() => {
                  const portal = portals.find((p) => String(p.id) === shoppingPortalId);
                  return portal?.rewardType === "points" ? "e.g. 5.0" : "e.g. 6.75";
                })()}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="portalCashbackOnTotal"
                  checked={portalCashbackOnTotal}
                  onChange={(e) => setPortalCashbackOnTotal(e.target.checked)}
                />
                <Label htmlFor="portalCashbackOnTotal" className="font-normal">
                  Apply rate to total cost (default: pre-tax cost)
                </Label>
              </div>
            </div>
          )}

          {/* Loyalty Points */}
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
            <p className="text-xs text-muted-foreground">Auto-calculated from hotel chain rates.</p>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <Label>Booking Benefits</Label>
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Select
                  value={benefit.type || "none"}
                  onValueChange={(v) => updateBenefit(idx, "type", v === "none" ? "" : v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select type...</SelectItem>
                    {BENEFIT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {benefit.type === "other" && (
                  <Input
                    value={benefit.label}
                    onChange={(e) => updateBenefit(idx, "label", e.target.value)}
                    placeholder="Description"
                    className="flex-1"
                  />
                )}
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={benefit.dollarValue}
                  onChange={(e) => updateBenefit(idx, "dollarValue", e.target.value)}
                  placeholder="$ value"
                  className="w-32"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeBenefit(idx)}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addBenefit}>
              + Add Benefit
            </Button>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={!isValid || submitting}>
              {submitting ? "Submitting..." : submitLabel}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
