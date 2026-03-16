"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays, Eye, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BookingCard } from "@/components/bookings/booking-card";
import { formatCurrency, formatDate, formatCerts, pruneHotelName } from "@/lib/utils";

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
  hotelChainSubBrand: { id: string; name: string; basePointRate: string | number | null } | null;
  property: { name: string };
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
  currency: string;
  exchangeRate: string | number | null;
  isFutureEstimate?: boolean;
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
    userStatus?: {
      eliteStatus: {
        name: string;
        bonusPercentage: string | number | null;
        fixedRate: string | number | null;
        isFixed: boolean;
      } | null;
    } | null;
  };
  creditCard: {
    id: string;
    name: string;
    rewardType: string;
    rewardRate: string | number;
    pointType: { name: string; centsPerPoint: string | number } | null;
    rewardRules?: {
      rewardType: string;
      rewardValue: string | number;
      hotelChainId: string | null;
      otaAgencyId: string | null;
    }[];
  } | null;
  shoppingPortal: {
    id: string;
    name: string;
    rewardType: string;
    pointType: { name: string; centsPerPoint: string | number } | null;
  } | null;
  bookingPromotions: BookingPromotion[];
  certificates: BookingCertificate[];
  priceWatchBooking: { priceWatch: { isEnabled: boolean } } | null;
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
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const stickyScrollbarRef = useRef<HTMLDivElement>(null);
  const phantomRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrapper = tableWrapperRef.current;
    const scrollbar = stickyScrollbarRef.current;
    const phantom = phantomRef.current;
    if (!wrapper || !scrollbar || !phantom) return;
    const container = wrapper.querySelector<HTMLElement>('[data-slot="table-container"]');
    if (!container) return;

    // Hide the native scrollbar (replaced by our sticky one)
    container.style.scrollbarWidth = "none";
    (container.style as CSSStyleDeclaration & { msOverflowStyle: string }).msOverflowStyle = "none";
    const styleId = "hide-table-native-scrollbar";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = '[data-slot="table-container"]::-webkit-scrollbar { display: none; }';
      document.head.appendChild(style);
    }

    // Sync sticky scrollbar dimensions with the table — called on mount and on resize
    const syncDimensions = () => {
      const stickyCol = wrapper.querySelector<HTMLElement>("th:first-child");
      const stickyWidth = stickyCol?.getBoundingClientRect().width ?? 0;
      scrollbar.style.marginLeft = `${stickyWidth}px`;
      phantom.style.width = `${container.scrollWidth - stickyWidth}px`;
    };
    syncDimensions();

    let syncing = false;
    const fromTable = () => {
      if (syncing) return;
      syncing = true;
      scrollbar.scrollLeft = container.scrollLeft;
      syncing = false;
    };
    const fromScrollbar = () => {
      if (syncing) return;
      syncing = true;
      container.scrollLeft = scrollbar.scrollLeft;
      syncing = false;
    };

    container.addEventListener("scroll", fromTable);
    scrollbar.addEventListener("scroll", fromScrollbar);

    // Re-sync when the table or viewport is resized
    const resizeObserver = new ResizeObserver(syncDimensions);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", fromTable);
      scrollbar.removeEventListener("scroll", fromScrollbar);
      resizeObserver.disconnect();
      document.getElementById(styleId)?.remove();
    };
  }, [bookings]);

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
                booking={{
                  ...booking,
                  property: { ...booking.property, name: pruneHotelName(booking.property.name) },
                }}
                onDelete={handleDeleteClick}
                showActions={true}
              />
            ))}
          </div>

          {/* Desktop View: Table */}
          <div
            className="hidden md:block"
            data-testid="bookings-list-desktop"
            ref={tableWrapperRef}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Property</TableHead>
                  <TableHead>Hotel Chain</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Certs</TableHead>
                  <TableHead className="text-right">Net/Night</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => {
                  const exchangeRate = booking.exchangeRate ? Number(booking.exchangeRate) : 1;
                  const usdTotalCost = Number(booking.totalCost) * exchangeRate;
                  const netCost = calculateNetCost(booking);

                  return (
                    <TableRow key={booking.id} data-testid={`booking-row-${booking.id}`}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <TooltipProvider>
                          <div className="flex items-start gap-1.5">
                            <div>
                              <div>{pruneHotelName(booking.property.name)}</div>
                              {booking.hotelChainSubBrand && (
                                <div className="text-xs text-muted-foreground">
                                  {booking.hotelChainSubBrand.name}
                                </div>
                              )}
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="mt-0.5 shrink-0 cursor-default">
                                  {booking.priceWatchBooking?.priceWatch.isEnabled ? (
                                    <Eye className="h-3.5 w-3.5 text-green-600" />
                                  ) : (
                                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {booking.priceWatchBooking
                                  ? booking.priceWatchBooking.priceWatch.isEnabled
                                    ? "Price watch enabled — you'll be alerted when rates drop"
                                    : "Price watch disabled"
                                  : "No price watch set up for this booking"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>{booking.hotelChain.name}</TableCell>
                      <TableCell>{formatDate(booking.checkIn)}</TableCell>
                      <TableCell>{formatDate(booking.checkOut)}</TableCell>
                      <TableCell>{booking.numNights}</TableCell>
                      <TableCell className="text-right">
                        {usdTotalCost > 0 ? (
                          booking.currency !== "USD" ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className="underline decoration-dotted cursor-pointer hover:text-foreground/80"
                                  data-testid="cost-popover-trigger"
                                >
                                  {formatCurrency(usdTotalCost, "USD", {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}
                                  {booking.isFutureEstimate ? " (est.)" : ""}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-3 text-sm"
                                align="end"
                                data-testid="cost-popover-content"
                              >
                                <p className="font-medium">
                                  {formatCurrency(Number(booking.totalCost), booking.currency, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}
                                </p>
                                <p className="text-muted-foreground text-xs mt-0.5">
                                  {booking.isFutureEstimate
                                    ? "Estimated at current rate"
                                    : "Locked at check-in rate"}
                                </p>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            formatCurrency(usdTotalCost, "USD", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })
                          )
                        ) : (
                          "—"
                        )}
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
                        className={`text-right font-medium ${netCost < usdTotalCost ? "text-green-600" : ""}`}
                        data-testid="booking-net-per-night"
                      >
                        {formatCurrency(netCost / booking.numNights, "USD", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
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
          {/* Sticky horizontal scrollbar — mirrors the table's scroll position */}
          <div
            ref={stickyScrollbarRef}
            className="hidden md:block sticky bottom-0 overflow-x-auto bg-background border-t"
            style={{ height: "14px" }}
          >
            <div ref={phantomRef} style={{ height: "1px" }} />
          </div>
        </>
      )}
    </div>
  );
}
