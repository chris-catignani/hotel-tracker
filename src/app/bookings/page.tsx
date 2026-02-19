"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface BookingCertificate {
  id: number;
  certType: string;
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
  pointsRedeemed: number | null;
  notes: string | null;
  createdAt: string;
  bookingSource: string | null;
  otaAgency: { id: number; name: string } | null;
  hotel: {
    id: number;
    name: string;
    loyaltyProgram: string | null;
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

function calculateNetCost(booking: Booking): number {
  const totalCost = Number(booking.totalCost);
  const promotionSavings = booking.bookingPromotions.reduce(
    (sum, bp) => sum + Number(bp.appliedValue),
    0
  );
  const portalBasis = booking.portalCashbackOnTotal ? totalCost : Number(booking.pretaxCost);
  const portalRate = Number(booking.portalCashbackRate || 0);
  let portalCashback = 0;
  if (booking.shoppingPortal?.rewardType === "points") {
    portalCashback = portalRate * portalBasis * Number(booking.shoppingPortal.pointType?.centsPerPoint ?? 0);
  } else {
    portalCashback = portalRate * portalBasis;
  }
  const cardReward = booking.creditCard
    ? totalCost *
      Number(booking.creditCard.rewardRate) *
      Number(booking.creditCard.pointType?.centsPerPoint ?? 0)
    : 0;
  return totalCost - promotionSavings - portalCashback - cardReward;
}

function formatSourceColumn(booking: { bookingSource: string | null; otaAgency: { name: string } | null }): string {
  switch (booking.bookingSource) {
    case "direct_web":
    case "direct_app": return "Direct";
    case "ota": return booking.otaAgency ? booking.otaAgency.name : "OTA";
    case "other": return "Other";
    default: return "—";
  }
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
// Bookings Page
// ---------------------------------------------------------------------------

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/bookings");
    if (res.ok) {
      setBookings(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this booking?")) return;
    const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchBookings();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <Link href="/bookings/new">
          <Button>Add Booking</Button>
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Property</TableHead>
            <TableHead>Hotel Chain</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
            <TableHead>Nights</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden sm:table-cell">Source</TableHead>
            <TableHead>Total Cost</TableHead>
            <TableHead>Net Cost</TableHead>
            <TableHead>Net/Night</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground">
                No bookings yet.
              </TableCell>
            </TableRow>
          ) : (
            bookings.map((booking) => {
              const totalCost = Number(booking.totalCost);
              const netCost = calculateNetCost(booking);
              const isSaving = netCost < totalCost;
              const typeBadge = getBookingTypeBadge(booking);

              return (
                <TableRow key={booking.id}>
                  <TableCell>{booking.propertyName}</TableCell>
                  <TableCell>{booking.hotel.name}</TableCell>
                  <TableCell>{formatDate(booking.checkIn)}</TableCell>
                  <TableCell>{formatDate(booking.checkOut)}</TableCell>
                  <TableCell>{booking.numNights}</TableCell>
                  <TableCell>
                    {typeBadge && (
                      <Badge variant="secondary" className="text-xs">
                        {typeBadge}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {formatSourceColumn(booking)}
                  </TableCell>
                  <TableCell>{formatCurrency(totalCost)}</TableCell>
                  <TableCell className={isSaving ? "text-green-600 font-medium" : ""}>
                    {formatCurrency(netCost)}
                  </TableCell>
                  <TableCell className={isSaving ? "text-green-600 font-medium" : ""}>
                    {formatCurrency(netCost / booking.numNights)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/bookings/${booking.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(booking.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
