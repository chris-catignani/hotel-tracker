"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { certTypeLabel } from "@/lib/cert-types";
import { getNetCostBreakdown } from "@/lib/net-cost";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CostBreakdown } from "@/components/cost-breakdown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookingPromotion {
  id: number;
  bookingId: number;
  promotionId: number;
  appliedValue: string | number;
  autoApplied: boolean;
  verified: boolean;
  promotion: {
    id: number;
    name: string;
    type: string;
    valueType: string;
    value: string | number;
  };
}

interface BookingCertificate {
  id: number;
  certType: string;
}

interface BookingBenefit {
  id: number;
  benefitType: string;
  label: string | null;
  dollarValue: string | number | null;
}

interface Booking {
  id: number;
  hotelId: number;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: string | number;
  taxAmount: string | number;
  totalCost: string | number;
  currency: string;
  originalAmount: string | number | null;
  creditCardId: number | null;
  shoppingPortalId: number | null;
  portalCashbackRate: string | number | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  notes: string | null;
  createdAt: string;
  bookingSource: string | null;
  otaAgency: { id: number; name: string } | null;
  hotel: {
    id: number;
    name: string;
    loyaltyProgram: string | null;
    pointType: { centsPerPoint: string | number } | null;
  };
  creditCard: {
    id: number;
    name: string;
    rewardType: string;
    rewardRate: string | number;
    pointType: { centsPerPoint: string | number } | null;
  } | null;
  shoppingPortal: {
    id: number;
    name: string;
    rewardType: string;
    pointType: { centsPerPoint: string | number } | null;
  } | null;
  bookingPromotions: BookingPromotion[];
  certificates: BookingCertificate[];
  benefits: BookingBenefit[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBookingSource(booking: { bookingSource: string | null; otaAgency: { name: string } | null }): string {
  switch (booking.bookingSource) {
    case "direct_web": return "Direct — Hotel Website";
    case "direct_app": return "Direct — Hotel App";
    case "ota": return booking.otaAgency ? `OTA — ${booking.otaAgency.name}` : "OTA";
    case "other": return "Other";
    default: return "—";
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
  certificates: { id: number }[];
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

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBooking = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/bookings/${id}`);
    if (res.ok) {
      setBooking(await res.json());
    }
    setLoading(false);
  }, [id]);

  const toggleVerified = async (bp: BookingPromotion) => {
    const res = await fetch(`/api/booking-promotions/${bp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !bp.verified }),
    });
    if (res.ok) {
      setBooking((prev) =>
        prev
          ? {
              ...prev,
              bookingPromotions: prev.bookingPromotions.map((p) =>
                p.id === bp.id ? { ...p, verified: !bp.verified } : p
              ),
            }
          : prev
      );
    }
  };

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Booking Details</h1>
        <p className="text-muted-foreground">Loading...</p>
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

  const {
    totalCost,
    promoSavings: promotionSavings,
    portalCashback,
    cardReward,
    loyaltyPointsValue,
    pointsRedeemedValue,
    certsValue,
    netCost,
  } = getNetCostBreakdown(booking);

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
            {booking.propertyName}
            {typeBadge && (
              <Badge variant="secondary">{typeBadge}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Hotel Chain</p>
              <p className="font-medium">{booking.hotel.name}</p>
            </div>
            {booking.hotel.loyaltyProgram && (
              <div>
                <p className="text-sm text-muted-foreground">Loyalty Program</p>
                <p className="font-medium">{booking.hotel.loyaltyProgram}</p>
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
                <p className="font-medium">
                  {formatCurrency(Number(booking.pretaxCost))}
                </p>
              </div>
            )}
            {totalCost > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="font-medium">{formatCurrency(totalCost)}</p>
              </div>
            )}
            {booking.currency !== "USD" && booking.originalAmount != null && (
              <div>
                <p className="text-sm text-muted-foreground">Original Amount</p>
                <p className="font-medium">
                  {Number(booking.originalAmount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {booking.currency}
                </p>
              </div>
            )}
            {booking.creditCard && (
              <div>
                <p className="text-sm text-muted-foreground">Credit Card</p>
                <p className="font-medium">{booking.creditCard.name}</p>
              </div>
            )}
            {booking.shoppingPortal && (
              <div>
                <p className="text-sm text-muted-foreground">Shopping Portal</p>
                <p className="font-medium">
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
                <p className="text-sm text-muted-foreground">
                  Loyalty Points Earned
                </p>
                <p className="font-medium">
                  {booking.loyaltyPointsEarned.toLocaleString()}
                </p>
              </div>
            )}
            {booking.pointsRedeemed != null && (
              <div>
                <p className="text-sm text-muted-foreground">Points Redeemed</p>
                <p className="font-medium">
                  {booking.pointsRedeemed.toLocaleString()}
                </p>
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
                <p className="font-medium">{formatBookingSource(booking)}</p>
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
        <Card>
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
                  {b.dollarValue != null && (
                    <span className="text-muted-foreground">
                      ${Number(b.dollarValue).toFixed(2)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Cost Breakdown */}
      <CostBreakdown
        totalCost={totalCost}
        pointsRedeemedValue={pointsRedeemedValue}
        certsValue={certsValue}
        promotionSavings={promotionSavings}
        portalCashback={portalCashback}
        cardReward={cardReward}
        loyaltyPointsValue={loyaltyPointsValue}
        netCost={netCost}
      />

      {/* Applied Promotions */}
      {booking.bookingPromotions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Applied Promotions</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <TableRow key={bp.id}>
                    <TableCell>{bp.promotion.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{bp.promotion.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(Number(bp.appliedValue))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={bp.autoApplied ? "default" : "outline"}
                      >
                        {bp.autoApplied ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={bp.verified ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleVerified(bp)}
                      >
                        {bp.verified ? "Verified" : "Mark Verified"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
