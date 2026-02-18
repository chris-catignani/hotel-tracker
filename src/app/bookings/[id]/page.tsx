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
  promotion: {
    id: number;
    name: string;
    type: string;
    valueType: string;
    value: string | number;
  };
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
  creditCardId: number | null;
  shoppingPortalId: number | null;
  portalCashbackRate: string | number | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  notes: string | null;
  createdAt: string;
  hotel: {
    id: number;
    name: string;
    loyaltyProgram: string | null;
    pointValue: string | number | null;
  };
  creditCard: {
    id: number;
    name: string;
    rewardType: string;
    rewardRate: string | number;
    pointValue: string | number;
  } | null;
  shoppingPortal: {
    id: number;
    name: string;
  } | null;
  bookingPromotions: BookingPromotion[];
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

  const totalCost = Number(booking.totalCost);
  const promotionSavings = booking.bookingPromotions.reduce(
    (sum, bp) => sum + Number(bp.appliedValue),
    0
  );
  const portalCashback =
    Number(booking.portalCashbackRate || 0) *
    (booking.portalCashbackOnTotal ? totalCost : Number(booking.pretaxCost));
  const cardReward = booking.creditCard
    ? totalCost *
      Number(booking.creditCard.rewardRate) *
      Number(booking.creditCard.pointValue)
    : 0;
  const loyaltyPointsValue =
    booking.loyaltyPointsEarned && booking.hotel.pointValue
      ? booking.loyaltyPointsEarned * Number(booking.hotel.pointValue)
      : 0;
  const netCost = totalCost - promotionSavings - portalCashback - cardReward - loyaltyPointsValue;

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
          <CardTitle>{booking.propertyName}</CardTitle>
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
            <div>
              <p className="text-sm text-muted-foreground">Pre-tax Cost</p>
              <p className="font-medium">
                {formatCurrency(Number(booking.pretaxCost))}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tax Amount</p>
              <p className="font-medium">
                {formatCurrency(Number(booking.taxAmount))}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="font-medium">{formatCurrency(totalCost)}</p>
            </div>
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
                    ? ` (${(Number(booking.portalCashbackRate) * 100).toFixed(1)}% — ${booking.portalCashbackOnTotal ? "total cost basis" : "pre-tax basis"})`
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

      {/* Cost Breakdown */}
      <CostBreakdown
        totalCost={totalCost}
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
