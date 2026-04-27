"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/page-spinner";
import { certTypeLabel } from "@/lib/cert-types";
import { getNetCostBreakdown, NetCostBooking, CalculationDetail } from "@/lib/net-cost";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CostBreakdown } from "@/components/cost-breakdown";
import { BookingPriceWatch } from "@/components/price-watch/booking-price-watch";
import { AlternateHotelsSection } from "@/components/alternate-hotels/alternate-hotels-section";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SectionDivider } from "@/components/ui/section-divider";
import { BookingPointsEarned } from "@/components/bookings/booking-view-points-earned";
import { PAYMENT_TYPES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookingPromotionBenefit {
  appliedValue: string | number;
  eligibleNightsAtBooking?: number | null;
  eligibleStayCount?: number | null;
  eligibleNightCount?: number | null;
  promotionBenefit: {
    rewardType: string;
    valueType: string;
    value: string | number;
    certType: string | null;
    restrictions?: {
      minNightsRequired?: number | null;
      spanStays?: boolean;
    } | null;
  };
}

interface BookingPromotion {
  id: string;
  bookingId: string;
  promotionId: string;
  appliedValue: string | number;
  eligibleNightsAtBooking?: number | null;
  eligibleStayCount?: number | null;
  eligibleNightCount?: number | null;
  autoApplied: boolean;
  promotion: {
    name: string;
    type: string;
    restrictions?: {
      minNightsRequired?: number | null;
      spanStays?: boolean;
    } | null;
    benefits: {
      rewardType: string;
      valueType: string;
      value: string | number;
      certType: string | null;
    }[];
    tiers?: {
      minStays: number | null;
      maxStays: number | null;
      minNights: number | null;
      maxNights: number | null;
      benefits: {
        rewardType: string;
        valueType: string;
        value: string | number;
        certType: string | null;
      }[];
    }[];
  };
  benefitApplications: BookingPromotionBenefit[];
}

interface BookingCertificate {
  id: string;
  certType: string;
}

interface BookingBenefit {
  id: string;
  benefitType: string;
  label: string | null;
  dollarValue: string | number | null;
  pointsEarnType: string | null;
  pointsAmount: number | null;
  pointsMultiplier: string | number | null;
}

interface BookingCardBenefitLocal {
  id: string;
  bookingId: string;
  cardBenefitId: string;
  cardBenefit: { description: string };
  appliedValue: string | number;
  periodKey: string;
}

interface PartnershipEarn {
  id: string;
  name: string;
  pointsEarned: number;
  earnedValue: number;
  pointTypeName: string;
  calc: CalculationDetail;
}

// Ensure Booking interface matches NetCostBooking for the breakdown logic
interface PriceWatchBookingData {
  id: string;
  priceWatchId: string;
  cashThreshold: string | number | null;
  awardThreshold: number | null;
  priceWatch: { isEnabled: boolean };
}

interface Booking extends Omit<NetCostBooking, "bookingPromotions" | "userCreditCard"> {
  id: string;
  hotelChainId: string | null;
  accommodationType: string;
  confirmationNumber: string | null;
  hotelChainSubBrand: { id: string; name: string; basePointRate: string | number | null } | null;
  property: {
    id: string;
    name: string;
    city: string | null;
    countryCode: string | null;
    chainPropertyId: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  propertyId: string | null;
  checkIn: string;
  checkOut: string;
  numNights: number;
  currency: string;
  paymentTiming: string;
  bookingDate: string | null;
  lockedExchangeRate: string | number | null;
  isFutureEstimate?: boolean;
  exchangeRateEstimated?: boolean;
  loyaltyPointsEstimated?: boolean;
  needsReview: boolean;
  userCreditCardId: string | null;
  userCreditCard: {
    nickname: string | null;
    creditCard: {
      name: string;
      rewardType: string;
      rewardRate: string | number;
      pointType: { name: string; usdCentsPerPoint: string | number } | null;
      rewardRules?: {
        rewardType: string;
        rewardValue: string | number;
        hotelChainId: string | null;
        otaAgencyId: string | null;
      }[];
    };
  } | null;
  shoppingPortalId: string | null;
  notes: string | null;
  createdAt: string;
  bookingSource: string | null;
  otaAgencyId: string | null;
  otaAgency: { id: string; name: string } | null;
  certificates: BookingCertificate[];
  benefits: BookingBenefit[];
  bookingPromotions: BookingPromotion[];
  bookingCardBenefits: BookingCardBenefitLocal[];
  partnershipEarns: PartnershipEarn[];
  priceWatchBookings: PriceWatchBookingData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBookingSourceLabel(bookingSource: string | null): string {
  switch (bookingSource) {
    case "direct_web":
      return "Direct — Hotel Chain Website";
    case "direct_app":
      return "Direct — Hotel Chain App";
    case "ota":
      return "OTA";
    case "other":
      return "Other";
    default:
      return "—";
  }
}

function formatBenefitType(type: string): string {
  const labels: Record<string, string> = {
    free_breakfast: "Free Breakfast",
    dining_credit: "Dining Credit",
    spa_credit: "Spa Credit",
    room_upgrade: "Room Upgrade",
    late_checkout: "Late Checkout",
    early_checkin: "Early Check-in",
    other: "Other",
  };
  return labels[type] ?? type;
}

// ---------------------------------------------------------------------------
// Booking Detail Page
// ---------------------------------------------------------------------------

export default function BookingDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const {
    data: booking,
    loading,
    error: fetchError,
    clearError,
    refetch: refetchBooking,
  } = useApiQuery<Booking>(`/api/bookings/${id}`, {
    onError: (err) =>
      logger.error("Failed to fetch booking", err.error, { bookingId: id, status: err.status }),
  });

  const [dismissingReview, setDismissingReview] = useState(false);

  const dismissReview = async () => {
    setDismissingReview(true);
    const result = await apiFetch(`/api/bookings/${id}`, {
      method: "PATCH",
      body: { needsReview: false },
    });
    setDismissingReview(false);
    if (!result.ok) {
      logger.error("Failed to dismiss review flag", result.error, {
        bookingId: id,
        status: result.status,
      });
      toast.error("Failed to update. Please try again.");
      return;
    }
    refetchBooking();
  };

  if (loading && !booking) {
    return <PageSpinner />;
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Booking Details</h1>
        <ErrorBanner error="Failed to load booking. Please try again." onDismiss={clearError} />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Booking Details</h1>
        <p className="text-muted-foreground">Booking not found.</p>
        <Link href="/bookings">
          <Button variant="outline">Back to Bookings</Button>
        </Link>
      </div>
    );
  }

  const breakdown = getNetCostBreakdown(booking);
  const totalCost = Number(booking.totalCost);
  const today = new Date().toISOString().split("T")[0];
  const isFutureBooking = booking.checkIn.slice(0, 10) > today;

  const hasCash = totalCost > 0;
  const hasPoints = (booking.pointsRedeemed ?? 0) > 0;
  const hasCert = booking.certificates.length > 0;

  const derivedPaymentType =
    [hasCash ? "cash" : null, hasPoints ? "points" : null, hasCert ? "cert" : null]
      .filter(Boolean)
      .join("_") || "cash";
  const paymentTypeLabel =
    PAYMENT_TYPES.find((pt) => pt.value === derivedPaymentType)?.label ?? derivedPaymentType;

  const exchangeRate = booking.lockedExchangeRate ? Number(booking.lockedExchangeRate) : 1;
  const usdTotalCost = totalCost * exchangeRate;

  const isMultiCurrency = [hasCash, hasPoints, hasCert].filter(Boolean).length > 1;

  const usdCost = breakdown.totalCost + breakdown.pointsRedeemedValue + breakdown.certsValue;
  const savings = usdCost - breakdown.netCost;
  const certGroups = Object.entries(
    booking.certificates.reduce(
      (acc, cert) => {
        acc[cert.certType] = (acc[cert.certType] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  );

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          <Link href={`/bookings/${id}/edit`}>
            <Button>Edit</Button>
          </Link>
          <Link href="/bookings">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>

      {booking.needsReview && (
        <div
          className="flex items-center justify-between rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-amber-800"
          data-testid="needs-review-banner"
        >
          <p className="text-sm">
            This booking was auto-imported from email — please verify the details are correct.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="ml-4 shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
            onClick={dismissReview}
            disabled={dismissingReview || !booking.property}
            data-testid="dismiss-review-button"
          >
            {dismissingReview ? "Saving…" : "Mark as reviewed"}
          </Button>
        </div>
      )}

      {/* ── Hero card ─────────────────────────────────────── */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: name + subtitle + dates */}
            <div className="flex flex-col gap-3">
              <div>
                <h1 className="text-xl font-bold" data-testid="hero-property-name">
                  {booking.property?.name ?? "Unknown Property"}
                </h1>
                {booking.accommodationType === "hotel" && (
                  <p className="text-sm text-muted-foreground" data-testid="hero-subtitle">
                    {[
                      booking.hotelChain?.name,
                      booking.hotelChainSubBrand?.name,
                      [booking.property?.city, booking.property?.countryCode]
                        .filter(Boolean)
                        .join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {booking.accommodationType === "apartment" && (
                  <p className="text-sm text-muted-foreground" data-testid="hero-subtitle">
                    {[
                      "Apartment / Short-term Rental",
                      [booking.property?.city, booking.property?.countryCode]
                        .filter(Boolean)
                        .join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              {/* Dates */}
              <div className="flex flex-wrap gap-4">
                <div data-testid="hero-check-in">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Check-in
                  </p>
                  <p className="font-medium">{formatDate(booking.checkIn)}</p>
                </div>
                <div data-testid="hero-check-out">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Check-out
                  </p>
                  <p className="font-medium">{formatDate(booking.checkOut)}</p>
                </div>
                <div data-testid="hero-nights">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nights
                  </p>
                  <p className="font-medium">{booking.numNights}</p>
                </div>
              </div>
            </div>

            {/* Right: cost summary — what you paid, in native units */}
            <div
              className="border-t pt-3 sm:border-t-0 sm:pt-0 sm:text-right"
              data-testid="hero-net-cost"
            >
              {hasCash && (
                <p className={`font-bold ${isMultiCurrency ? "text-xl" : "text-2xl"}`}>
                  {booking.currency !== "USD"
                    ? formatCurrency(Number(booking.totalCost), booking.currency)
                    : `${formatCurrency(usdTotalCost)}${booking.isFutureEstimate ? " (est.)" : ""}`}
                </p>
              )}
              {hasCash && booking.currency !== "USD" && (
                <p className="text-sm text-muted-foreground">
                  ≈ {formatCurrency(usdTotalCost)}
                  {booking.isFutureEstimate ? " (est.)" : ""}
                </p>
              )}
              {hasPoints && booking.pointsRedeemed != null && (
                <p className={`font-bold ${isMultiCurrency ? "text-xl" : "text-2xl"}`}>
                  {booking.pointsRedeemed.toLocaleString()} pts
                </p>
              )}
              {hasPoints && breakdown.pointsRedeemedValue > 0 && (
                <p className="text-sm text-muted-foreground">
                  ≈ {formatCurrency(breakdown.pointsRedeemedValue)}
                </p>
              )}
              {hasCert &&
                certGroups.map(([certType, count]) => (
                  <p
                    key={certType}
                    className={`font-bold ${isMultiCurrency ? "text-xl" : "text-2xl"}`}
                  >
                    {count > 1 ? `${count} × ` : ""}
                    {certTypeLabel(certType)}
                  </p>
                ))}
              {hasCert && breakdown.certsValue > 0 && (
                <p className="text-sm text-muted-foreground">
                  ≈ {formatCurrency(breakdown.certsValue)}
                </p>
              )}
              {!hasCash && !hasPoints && !hasCert && <p className="text-2xl font-bold">—</p>}
            </div>
          </div>

          {/* ── USD equivalent row ──────────────────────────── */}
          <div className="border-t mt-2 pt-4 grid grid-cols-3 gap-4 text-center">
            <div data-testid="usd-savings-row">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Savings
              </p>
              <p className={`font-medium ${savings > 0 ? "text-green-600" : ""}`}>
                {savings > 0 ? `−${formatCurrency(savings)}` : "—"}
              </p>
            </div>
            <div data-testid="usd-net-cost-row">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Net Cost
              </p>
              <p className="font-semibold">
                {formatCurrency(breakdown.netCost)}
                {booking.isFutureEstimate ? " (est.)" : ""}
              </p>
            </div>
            <div data-testid="usd-per-night-row">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Per Night
              </p>
              <p className="font-medium">
                {booking.numNights > 0
                  ? formatCurrency(breakdown.netCost / booking.numNights)
                  : "—"}
                {booking.numNights > 0 && booking.isFutureEstimate ? " (est.)" : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Details card ──────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4">
          <p className="text-base font-semibold">Payment Details</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Payment Type</p>
              <p className="font-medium" data-testid="payment-type">
                {paymentTypeLabel}
              </p>
            </div>

            {/* Cash sub-group */}
            {hasCash && totalCost > 0 && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Pre-tax Cost</p>
                  {booking.currency !== "USD" ? (
                    <>
                      <p className="font-medium">
                        {formatCurrency(Number(booking.pretaxCost), booking.currency)}
                      </p>
                      {booking.lockedExchangeRate != null && (
                        <p className="text-sm text-muted-foreground">
                          ≈{" "}
                          {formatCurrency(
                            Number(booking.pretaxCost) * Number(booking.lockedExchangeRate)
                          )}
                          {booking.isFutureEstimate ? " (est.)" : ""}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-medium">{formatCurrency(Number(booking.pretaxCost))}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  {booking.currency !== "USD" ? (
                    <>
                      <p className="font-medium" data-testid="total-cost-native">
                        {formatCurrency(totalCost, booking.currency)}
                      </p>
                      {booking.lockedExchangeRate != null && (
                        <p
                          className="text-sm text-muted-foreground"
                          data-testid="total-cost-usd-equivalent"
                        >
                          ≈ {formatCurrency(totalCost * Number(booking.lockedExchangeRate))}
                          {booking.isFutureEstimate ? " (est.)" : ""}
                        </p>
                      )}
                      {booking.exchangeRateEstimated && (
                        <p className="text-amber-600 text-xs mt-0.5">
                          Historical rate unavailable — estimated using current rate
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-medium" data-testid="total-cost-usd">
                      {formatCurrency(totalCost)}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Points sub-group */}
            {hasPoints && booking.pointsRedeemed != null && (
              <div>
                <p className="text-sm text-muted-foreground">Points Redeemed</p>
                <p className="font-medium">{booking.pointsRedeemed.toLocaleString()}</p>
              </div>
            )}

            {/* Credit Card */}
            {booking.userCreditCard && (
              <div>
                <p className="text-sm text-muted-foreground">Credit Card</p>
                <p className="font-medium" data-testid="booking-credit-card">
                  {booking.userCreditCard.nickname
                    ? `${booking.userCreditCard.creditCard.name} (${booking.userCreditCard.nickname})`
                    : booking.userCreditCard.creditCard.name}
                </p>
              </div>
            )}

            {/* Payment Timing */}
            <div>
              <p className="text-sm text-muted-foreground">Payment Timing</p>
              <p className="font-medium" data-testid="booking-payment-timing">
                {booking.paymentTiming === "prepaid" ? "Prepaid" : "Postpaid"}
              </p>
            </div>
          </div>

          {/* Cert sub-group — full row */}
          {hasCert && booking.certificates.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground">Certificates</p>
              <div className="flex flex-wrap gap-1 mt-1" data-testid="cert-badges">
                {certGroups.map(([certType, count]) => (
                  <Badge key={certType} variant="outline">
                    {count > 1 ? `${count} × ` : ""}
                    {certTypeLabel(certType)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <SectionDivider label="Booking Context" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {booking.bookingDate && (
              <div>
                <p className="text-sm text-muted-foreground">Booking Date</p>
                <p className="font-medium" data-testid="booking-date">
                  {formatDate(booking.bookingDate)}
                </p>
              </div>
            )}
            {booking.hotelChainSubBrand && (
              <div>
                <p className="text-sm text-muted-foreground">Sub-brand</p>
                <p className="font-medium" data-testid="booking-sub-brand">
                  {booking.hotelChainSubBrand.name}
                </p>
              </div>
            )}
            {(booking.property?.city || booking.property?.countryCode) && (
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium" data-testid="booking-location">
                  {[booking.property?.city, booking.property?.countryCode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
            {booking.bookingSource && (
              <div>
                <p className="text-sm text-muted-foreground">Booking Source</p>
                <p className="font-medium" data-testid="booking-source">
                  {formatBookingSourceLabel(booking.bookingSource)}
                </p>
              </div>
            )}
            {booking.bookingSource === "ota" && booking.otaAgency && (
              <div>
                <p className="text-sm text-muted-foreground">OTA</p>
                <p className="font-medium" data-testid="booking-ota">
                  {booking.otaAgency.name}
                </p>
              </div>
            )}
            {booking.shoppingPortal && (
              <div>
                <p className="text-sm text-muted-foreground">Shopping Portal</p>
                <p className="font-medium" data-testid="booking-portal">
                  {booking.shoppingPortal.name}
                  {booking.portalCashbackRate
                    ? booking.shoppingPortal.rewardType === "points"
                      ? ` (${Number(booking.portalCashbackRate).toFixed(2)} pts/$ — ${booking.portalCashbackOnTotal ? "total" : "pre-tax"} basis)`
                      : ` (${(Number(booking.portalCashbackRate) * 100).toFixed(1)}% — ${booking.portalCashbackOnTotal ? "total" : "pre-tax"} basis)`
                    : ""}
                </p>
              </div>
            )}
            {booking.confirmationNumber && (
              <div>
                <p className="text-sm text-muted-foreground">Confirmation Number</p>
                <p className="font-medium" data-testid="confirmation-number">
                  {booking.confirmationNumber}
                </p>
              </div>
            )}
          </div>

          {booking.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="mt-1">{booking.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Secondary cards: 2-col grid on desktop ────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CostBreakdown breakdown={breakdown} />
        <BookingPointsEarned booking={booking} />

        {/* Applied Promotions */}
        {booking.bookingPromotions.length > 0 && (
          <Card>
            <CardContent>
              <p className="text-base font-semibold mb-4">Applied Promotions</p>
              {/* Mobile View: Cards */}
              <div className="flex flex-col gap-4 md:hidden" data-testid="applied-promos-mobile">
                {booking.bookingPromotions.map((bp) => (
                  <div
                    key={bp.id}
                    className="flex flex-col p-4 border rounded-lg space-y-3"
                    data-testid={`applied-promo-card-${bp.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold" data-testid="promo-name">
                          {bp.promotion.name}
                        </p>
                        <Badge variant="secondary" className="mt-1" data-testid="promo-type">
                          {bp.promotion.type}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-lg font-bold text-green-600"
                          data-testid="promo-applied-value"
                        >
                          {formatCurrency(Number(bp.appliedValue))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block" data-testid="applied-promos-desktop">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Promotion Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Applied Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {booking.bookingPromotions.map((bp) => (
                      <TableRow key={bp.id} data-testid={`applied-promo-row-${bp.id}`}>
                        <TableCell data-testid="promo-name">{bp.promotion.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" data-testid="promo-type">
                            {bp.promotion.type}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid="promo-applied-value">
                          {formatCurrency(Number(bp.appliedValue))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Booking Benefits */}
        {booking.benefits.length > 0 && (
          <Card data-testid="booking-benefits-card">
            <CardContent>
              <p className="text-base font-semibold mb-4">Booking Benefits</p>
              <ul className="space-y-2">
                {booking.benefits.map((b) => (
                  <li key={b.id} className="flex items-center justify-between">
                    <span>
                      {formatBenefitType(b.benefitType)}
                      {b.label ? ` — ${b.label}` : ""}
                    </span>
                    <span>
                      {b.dollarValue != null ? (
                        <span className="text-muted-foreground">
                          {formatCurrency(Number(b.dollarValue), booking.currency)}
                        </span>
                      ) : b.pointsEarnType === "fixed_per_stay" && b.pointsAmount != null ? (
                        <span className="text-muted-foreground">
                          {Number(b.pointsAmount).toLocaleString()} pts
                        </span>
                      ) : b.pointsEarnType === "fixed_per_night" && b.pointsAmount != null ? (
                        <span className="text-muted-foreground">
                          {Number(b.pointsAmount).toLocaleString()} pts/night
                        </span>
                      ) : b.pointsEarnType === "multiplier_on_base" &&
                        b.pointsMultiplier != null ? (
                        <span className="text-muted-foreground">
                          {Number(b.pointsMultiplier)}× multiplier
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Card Benefits */}
        {booking.bookingCardBenefits.length > 0 && (
          <Card data-testid="card-benefits-card">
            <CardContent>
              <p className="text-base font-semibold mb-4">Card Benefits</p>
              <ul className="space-y-2">
                {booking.bookingCardBenefits.map((bcb) => (
                  <li key={bcb.id} className="flex items-center justify-between">
                    <span>{bcb.cardBenefit.description}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(Number(bcb.appliedValue))}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Partnership Earns */}
        {booking.partnershipEarns && booking.partnershipEarns.length > 0 && (
          <Card data-testid="partnership-earns-card">
            <CardContent>
              <p className="text-base font-semibold mb-4">Partnership Earns</p>
              <ul className="space-y-2">
                {booking.partnershipEarns.map((earn) => (
                  <li key={earn.id} className="flex items-center justify-between">
                    <span>{earn.name}</span>
                    <span className="text-muted-foreground">
                      {Math.round(earn.pointsEarned).toLocaleString()} pts
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Price Watch — outside grid, full-width, future hotel stays only */}
      {booking.accommodationType === "hotel" &&
        isFutureBooking &&
        booking.hotelChainId &&
        booking.propertyId && (
          <BookingPriceWatch
            bookingId={booking.id}
            propertyId={booking.propertyId}
            propertyName={booking.property?.name ?? ""}
            hotelChainId={booking.hotelChainId ?? undefined}
            checkIn={booking.checkIn}
            checkOut={booking.checkOut}
            numNights={booking.numNights}
            totalCost={booking.totalCost}
            currency={booking.currency}
            pointsRedeemed={booking.pointsRedeemed}
            initialWatchBooking={booking.priceWatchBookings[0] ?? null}
          />
        )}

      {/* Alternate Hotels — outside grid, full-width, future hotel stays only */}
      {booking.accommodationType === "hotel" &&
        isFutureBooking &&
        booking.hotelChainId &&
        booking.propertyId && (
          <AlternateHotelsSection
            bookingId={booking.id}
            anchorHasGps={booking.property?.latitude != null && booking.property?.longitude != null}
            currency={booking.currency}
          />
        )}
    </div>
  );
}
