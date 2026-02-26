"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { calculateNetCost } from "@/lib/net-cost";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingCard } from "@/components/bookings/booking-card";
import { formatCurrency, formatDate, formatCerts } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookingPromotion {
  id: string;
  bookingId: string;
  promotionId: string;
  appliedValue: string | number;
  autoApplied: boolean;
  verified: boolean;
  promotion: {
    id: string;
    name: string;
    type: string;
    valueType: string;
    value: string | number;
  };
}

interface BookingCertificate {
  id: string;
  certType: string;
}

interface Booking {
  id: string;
  hotelChainId: string;
  hotelChainSubBrand: { id: string; name: string } | null;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: string | number;
  taxAmount: string | number;
  totalCost: string | number;
  creditCardId: string | null;
  shoppingPortalId: string | null;
  portalCashbackRate: string | number | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  notes: string | null;
  createdAt: string;
  bookingSource: string | null;
  otaAgencyId: string | null;
  otaAgency: { id: string; name: string } | null;
  hotelChain: {
    id: string;
    name: string;
    loyaltyProgram: string | null;
    basePointRate: string | number | null;
    pointType: { name: string; centsPerPoint: string | number } | null;
  };
  creditCard: {
    id: string;
    name: string;
    rewardType: string;
    rewardRate: string | number;
    pointType: { name: string; centsPerPoint: string | number } | null;
  } | null;
  shoppingPortal: {
    id: string;
    name: string;
    rewardType: string;
    pointType: { name: string; centsPerPoint: string | number } | null;
  } | null;
  bookingPromotions: BookingPromotion[];
  certificates: BookingCertificate[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Bookings Page
// ---------------------------------------------------------------------------

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/bookings");
    if (res.ok) {
      setBookings(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings();
  }, [fetchBookings]);

  const handleDeleteClick = (id: string) => {
    setBookingToDelete(id);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (bookingToDelete === null) return;
    setDeleteOpen(false);
    setDeleteError(null);
    const res = await fetch(`/api/bookings/${bookingToDelete}`, { method: "DELETE" });
    if (res.ok) {
      setBookingToDelete(null);
      fetchBookings();
    } else {
      setDeleteError("Failed to delete booking. Please try again.");
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Booking?"
        description="Are you sure you want to delete this booking? This cannot be undone."
        onConfirm={handleDeleteConfirm}
      />

      {deleteError && (
        <p className="text-sm text-destructive" data-testid="booking-delete-error">
          {deleteError}
        </p>
      )}

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No bookings found"
          description="You haven't added any bookings yet. Start by adding your first hotel stay."
          action={{
            label: "Add Booking",
            href: "/bookings/new",
          }}
          data-testid="bookings-empty"
        />
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="flex flex-col gap-4 md:hidden" data-testid="bookings-list-mobile">
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onDelete={handleDeleteClick}
                showActions={true}
              />
            ))}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block" data-testid="bookings-list-desktop">
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
                {bookings.map((booking) => {
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
                        {formatCerts(booking.certificates, true)}
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
                            onClick={() => handleDeleteClick(booking.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
