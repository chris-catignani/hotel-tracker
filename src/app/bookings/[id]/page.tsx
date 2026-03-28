"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { certTypeLabel } from "@/lib/cert-types";
import { getNetCostBreakdown, NetCostBooking } from "@/lib/net-cost";
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
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { ErrorBanner } from "@/components/ui/error-banner";

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
  verified: boolean;
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

// Ensure Booking interface matches NetCostBooking for the breakdown logic
interface PriceWatchBookingData {
  id: string;
  priceWatchId: string;
  cashThreshold: string | number | null;
  awardThreshold: number | null;
  dateFlexibilityDays: number;
}

interface Booking extends Omit<NetCostBooking, "bookingPromotions" | "userCreditCard"> {
  id: string;
  hotelChainId: string | null;
  accommodationType: string;
  hotelChainSubBrand: { id: string; name: string; basePointRate: string | number | null } | null;
  property: {
    id: string;
    name: string;
    city: string | null;
    countryCode: string | null;
    chainPropertyId: string | null;
  };
  propertyId: string;
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
  userCreditCardId: string | null;
  userCreditCard: {
    nickname: string | null;
    creditCard: {
      name: string;
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
  priceWatchBooking: PriceWatchBookingData | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBookingSource(booking: {
  bookingSource: string | null;
  otaAgency: { name: string } | null;
}): string {
  switch (booking.bookingSource) {
    case "direct_web":
      return "Direct — Hotel Chain Website";
    case "direct_app":
      return "Direct — Hotel Chain App";
    case "ota":
      return booking.otaAgency ? `OTA — ${booking.otaAgency.name}` : "OTA";
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

function getBookingTypeBadge(booking: {
  totalCost: string | number;
  pointsRedeemed: number | null;
  certificates: { id: string }[];
}): string | null {
  const hasCash = Number(booking.totalCost) > 0;
  const hasPoints = !!booking.pointsRedeemed;
  const hasCert = booking.certificates.length > 0;
  if (!hasPoints && !hasCert) return null;
  if (!hasCash && hasPoints && !hasCert) return "Award";
  if (!hasCash && !hasPoints && hasCert) return "Cert";
  if (!hasCash && hasPoints && hasCert) return "Award + Cert";
  if (hasCash && hasPoints && !hasCert) return "Cash + Points";
  if (hasCash && !hasPoints && hasCert) return "Cash + Cert";
  if (hasCash && hasPoints && hasCert) return "Cash + Points + Cert";
  return null;
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

  const toggleVerified = async (bp: BookingPromotion) => {
    const result = await apiFetch(`/api/booking-promotions/${bp.id}`, {
      method: "PATCH",
      body: { verified: !bp.verified },
    });
    if (!result.ok) {
      logger.error("Failed to update promotion verification", result.error, {
        bookingPromotionId: bp.id,
        status: result.status,
      });
      toast.error("Failed to update. Please try again.");
      return;
    }
    refetchBooking();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Booking Details</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
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

  const typeBadge = getBookingTypeBadge(booking);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Booking Details</h1>
        <div className="flex gap-2">
          <Link href={`/bookings/${id}/edit`}>
            <Button>Edit</Button>
          </Link>
          <Link href="/bookings">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>

      {/* Booking Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {booking.property.name}
            {typeBadge && (
              <Badge variant="secondary" data-testid="booking-type-badge">
                {typeBadge}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {booking.accommodationType === "apartment" ? (
              <div>
                <p className="text-sm text-muted-foreground">Accommodation Type</p>
                <p className="font-medium">Apartment / Short-term Rental</p>
              </div>
            ) : booking.hotelChain ? (
              <div>
                <p className="text-sm text-muted-foreground">Hotel Chain</p>
                <p className="font-medium">{booking.hotelChain.name}</p>
              </div>
            ) : null}
            {booking.hotelChainSubBrand && (
              <div>
                <p className="text-sm text-muted-foreground">Sub-brand</p>
                <p className="font-medium" data-testid="booking-sub-brand">
                  {booking.hotelChainSubBrand.name}
                </p>
              </div>
            )}
            {booking.hotelChain?.loyaltyProgram && (
              <div>
                <p className="text-sm text-muted-foreground">Loyalty Program</p>
                <p className="font-medium">{booking.hotelChain.loyaltyProgram}</p>
              </div>
            )}
            {(booking.property.city || booking.property.countryCode) && (
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium" data-testid="booking-location">
                  {[booking.property.city, booking.property.countryCode].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Check-in</p>
              <p className="font-medium">{formatDate(booking.checkIn)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check-out</p>
              <p className="font-medium">{formatDate(booking.checkOut)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nights</p>
              <p className="font-medium">{booking.numNights}</p>
            </div>
            {totalCost > 0 && (
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
                    {booking.exchangeRateEstimated && (
                      <p className="text-amber-600 text-xs mt-0.5">
                        Historical rate unavailable — estimated using current rate
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-medium">{formatCurrency(Number(booking.pretaxCost))}</p>
                )}
              </div>
            )}
            {totalCost > 0 && booking.numNights > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Avg/Night (pre-tax)</p>
                <p className="font-medium">
                  {formatCurrency(
                    Number(booking.pretaxCost) / booking.numNights,
                    booking.currency !== "USD" ? booking.currency : "USD"
                  )}
                </p>
              </div>
            )}
            {totalCost > 0 && (
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
            )}
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
            {booking.shoppingPortal && (
              <div>
                <p className="text-sm text-muted-foreground">Shopping Portal</p>
                <p className="font-medium" data-testid="booking-portal">
                  {booking.shoppingPortal.name}
                  {booking.portalCashbackRate
                    ? booking.shoppingPortal.rewardType === "points"
                      ? ` (${Number(booking.portalCashbackRate).toFixed(2)} pts/$ — ${booking.portalCashbackOnTotal ? "total cost basis" : "pre-tax basis"})`
                      : ` (${(Number(booking.portalCashbackRate) * 100).toFixed(1)}% — ${booking.portalCashbackOnTotal ? "total cost basis" : "pre-tax basis"})`
                    : ""}
                </p>
              </div>
            )}
            {booking.loyaltyPointsEarned != null && (
              <div>
                <p className="text-sm text-muted-foreground">Loyalty Points Earned</p>
                <p className="font-medium" data-testid="loyalty-points-earned">
                  {booking.loyaltyPointsEstimated ? "~" : ""}
                  {booking.loyaltyPointsEarned.toLocaleString()}
                  {booking.loyaltyPointsEstimated ? " (est.)" : ""}
                </p>
              </div>
            )}
            {booking.pointsRedeemed != null && (
              <div>
                <p className="text-sm text-muted-foreground">Points Redeemed</p>
                <p className="font-medium">{booking.pointsRedeemed.toLocaleString()}</p>
              </div>
            )}
            {booking.certificates.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Certificates</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {booking.certificates.map((cert) => (
                    <Badge key={cert.id} variant="outline">
                      {certTypeLabel(cert.certType)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {booking.bookingSource && (
              <div>
                <p className="text-sm text-muted-foreground">Booking Source</p>
                <p className="font-medium" data-testid="booking-source">
                  {formatBookingSource(booking)}
                </p>
              </div>
            )}
            {booking.paymentTiming === "prepaid" && (
              <div>
                <p className="text-sm text-muted-foreground">Payment Timing</p>
                <p className="font-medium" data-testid="booking-prepaid">
                  Prepaid
                </p>
              </div>
            )}
            {booking.bookingDate && (
              <div>
                <p className="text-sm text-muted-foreground">Booking Date</p>
                <p className="font-medium">{formatDate(booking.bookingDate)}</p>
              </div>
            )}
          </div>
          {booking.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="mt-1">{booking.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Booking Benefits */}
      {booking.benefits.length > 0 && (
        <Card data-testid="booking-benefits-card">
          <CardHeader>
            <CardTitle>Booking Benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {booking.benefits.map((b) => (
                <li key={b.id} className="flex items-center justify-between">
                  <span>
                    {formatBenefitType(b.benefitType)}
                    {b.label ? ` — ${b.label}` : ""}
                  </span>
                  {b.dollarValue != null ? (
                    <span className="text-muted-foreground">
                      ${Number(b.dollarValue).toFixed(2)}
                    </span>
                  ) : b.pointsEarnType === "fixed_per_stay" && b.pointsAmount != null ? (
                    <span className="text-muted-foreground">
                      {Number(b.pointsAmount).toLocaleString()} pts
                    </span>
                  ) : b.pointsEarnType === "fixed_per_night" && b.pointsAmount != null ? (
                    <span className="text-muted-foreground">
                      {Number(b.pointsAmount).toLocaleString()} pts/night
                    </span>
                  ) : b.pointsEarnType === "multiplier_on_base" && b.pointsMultiplier != null ? (
                    <span className="text-muted-foreground">
                      {Number(b.pointsMultiplier)}× multiplier
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Cost Breakdown */}
      <CostBreakdown breakdown={breakdown} />

      {/* Applied Promotions */}
      {booking.bookingPromotions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Applied Promotions</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex gap-2">
                      <Badge
                        variant={bp.autoApplied ? "default" : "outline"}
                        data-testid="promo-auto-applied"
                      >
                        {bp.autoApplied ? "Auto" : "Manual"}
                      </Badge>
                      {bp.verified && (
                        <Badge variant="default" data-testid="promo-verified-badge">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant={bp.verified ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => toggleVerified(bp)}
                      data-testid="promo-verify-button"
                    >
                      {bp.verified ? "Unverify" : "Mark Verified"}
                    </Button>
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
                    <TableHead>Auto-applied</TableHead>
                    <TableHead>Verified</TableHead>
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
                      <TableCell>
                        <Badge
                          variant={bp.autoApplied ? "default" : "outline"}
                          data-testid="promo-auto-applied"
                        >
                          {bp.autoApplied ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={bp.verified ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleVerified(bp)}
                          data-testid="promo-verify-button"
                        >
                          {bp.verified ? "Verified" : "Mark Verified"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price Watch — future hotel stays only */}
      {booking.accommodationType === "hotel" && isFutureBooking && (
        <BookingPriceWatch
          bookingId={booking.id}
          propertyId={booking.propertyId}
          propertyName={booking.property.name}
          hotelChainId={booking.hotelChainId ?? undefined}
          checkIn={booking.checkIn}
          checkOut={booking.checkOut}
          numNights={booking.numNights}
          totalCost={booking.totalCost}
          currency={booking.currency}
          pointsRedeemed={booking.pointsRedeemed}
          initialWatchBooking={booking.priceWatchBooking}
        />
      )}
    </div>
  );
}
