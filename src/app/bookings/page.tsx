"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { certTypeLabel } from "@/lib/cert-types";
import { calculateNetCost } from "@/lib/net-cost";
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
  hotelChainId: number;
  hotelChainSubBrand: { id: number; name: string } | null;
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
  hotelChain: {
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

function formatSourceColumn(booking: {
  bookingSource: string | null;
  otaAgency: { name: string } | null;
}): string {
  switch (booking.bookingSource) {
    case "direct_web":
    case "direct_app":
      return "Direct";
    case "ota":
      return booking.otaAgency ? booking.otaAgency.name : "OTA";
    case "other":
      return "Other";
    default:
      return "—";
  }
}

function formatCerts(certificates: { id: number; certType: string }[]): string {
  if (certificates.length === 0) return "—";
  const counts: Record<string, number> = {};
  for (const cert of certificates) {
    const label = certTypeLabel(cert.certType);
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([desc, count]) => (count > 1 ? `${count} × ${desc}` : desc))
    .join(", ");
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
            <TableHead className="hidden sm:table-cell">Source</TableHead>
            <TableHead className="text-right">Cash</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead className="text-right">Certs</TableHead>
            <TableHead className="text-right">Net/Night</TableHead>
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

              return (
                <TableRow key={booking.id}>
                  <TableCell>
                    <div>{booking.propertyName}</div>
                    {booking.hotelChainSubBrand && (
                      <div className="text-xs text-muted-foreground">
                        {booking.hotelChainSubBrand.name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{booking.hotelChain.name}</TableCell>
                  <TableCell>{formatDate(booking.checkIn)}</TableCell>
                  <TableCell>{formatDate(booking.checkOut)}</TableCell>
                  <TableCell>{booking.numNights}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {formatSourceColumn(booking)}
                  </TableCell>
                  <TableCell className="text-right">
                    {totalCost > 0 ? formatCurrency(totalCost) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {booking.pointsRedeemed
                      ? `${booking.pointsRedeemed.toLocaleString("en-US")} pts`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCerts(booking.certificates)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${netCost < totalCost ? "text-green-600" : ""}`}
                  >
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
