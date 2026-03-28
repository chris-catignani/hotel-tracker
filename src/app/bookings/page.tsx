"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useYearFilter, buildYearOptions, type YearFilter } from "@/hooks/use-year-filter";
import { BookingCard } from "@/components/bookings/booking-card";
import { formatCurrency, formatDate, formatCerts, pruneHotelName } from "@/lib/utils";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

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
  userCreditCardId: string | null;
  shoppingPortalId: string | null;
  portalCashbackRate: string | number | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  currency: string;
  lockedExchangeRate: string | number | null;
  isFutureEstimate?: boolean;
  exchangeRateEstimated?: boolean;
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
    pointType: { name: string; usdCentsPerPoint: string | number } | null;
    userStatus?: {
      eliteStatus: {
        name: string;
        bonusPercentage: string | number | null;
        fixedRate: string | number | null;
        isFixed: boolean;
      } | null;
    } | null;
  } | null;
  userCreditCard: {
    creditCard: {
      id: string;
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
  shoppingPortal: {
    id: string;
    name: string;
    rewardType: string;
    pointType: { name: string; usdCentsPerPoint: string | number } | null;
  } | null;
  bookingPromotions: BookingPromotion[];
  certificates: BookingCertificate[];
  priceWatchBooking: { priceWatch: { isEnabled: boolean } } | null;
  accommodationType: string;
  needsReview: boolean;
}

// ---------------------------------------------------------------------------
// Bookings Page
// ---------------------------------------------------------------------------

function BookingsPageInner() {
  const {
    data: bookingsData,
    loading,
    error: fetchError,
    clearError,
    refetch: refetchBookings,
  } = useApiQuery<Booking[]>("/api/bookings", {
    onError: (err) => logger.error("Failed to fetch bookings", err.error, { status: err.status }),
  });
  const bookings = useMemo(() => bookingsData ?? [], [bookingsData]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");

  const { yearFilter, setYearFilter, filterBookings: filterByYear } = useYearFilter();

  const yearOptions = useMemo(() => buildYearOptions(bookings), [bookings]);
  const filteredBookings = useMemo(() => {
    const yearFiltered = filterByYear(bookings);
    if (filterParam === "needs-review") {
      return yearFiltered.filter((b) => b.needsReview);
    }
    return yearFiltered;
  }, [bookings, filterByYear, filterParam]);

  const handleDeleteClick = (id: string) => {
    setBookingToDelete(id);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (bookingToDelete === null) return;
    setDeleteOpen(false);
    const result = await apiFetch(`/api/bookings/${bookingToDelete}`, { method: "DELETE" });
    if (!result.ok) {
      logger.error("Failed to delete booking", result.error, {
        bookingId: bookingToDelete,
        status: result.status,
      });
      toast.error("Failed to delete booking. Please try again.");
      return;
    }
    setBookingToDelete(null);
    refetchBookings();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="flex items-center gap-2">
          <Select
            value={String(yearFilter)}
            onValueChange={(val) => {
              if (val === "all" || val === "upcoming") {
                setYearFilter(val as YearFilter);
              } else {
                setYearFilter(parseInt(val, 10));
              }
            }}
          >
            <SelectTrigger className="w-40" data-testid="year-filter-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((opt) => (
                <SelectItem key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/bookings/new">
            <Button>Add Booking</Button>
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Booking?"
        description="Are you sure you want to delete this booking? This cannot be undone."
        onConfirm={handleDeleteConfirm}
      />

      <ErrorBanner
        error={fetchError ? "Failed to load bookings. Please try again." : null}
        onDismiss={clearError}
      />

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No bookings found"
          description="You haven't added any bookings yet. Start by adding your first hotel stay."
          action={{ label: "Add Booking", href: "/bookings/new" }}
          data-testid="bookings-empty"
        />
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No bookings for this period"
          description="No bookings found for the selected year. Try selecting a different year."
          data-testid="bookings-empty-year-filter"
        />
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="flex flex-col gap-4 md:hidden" data-testid="bookings-list-mobile">
            {filteredBookings.map((booking) => (
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
            className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto"
            data-testid="bookings-list-desktop"
          >
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 bg-background z-20">
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
                {filteredBookings.map((booking) => {
                  const exchangeRate = booking.lockedExchangeRate
                    ? Number(booking.lockedExchangeRate)
                    : 1;
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
                            {booking.needsReview && (
                              <Badge
                                data-testid="needs-review-badge"
                                variant="outline"
                                className="border-amber-400 bg-amber-50 text-amber-700 text-xs shrink-0"
                              >
                                Review
                              </Badge>
                            )}
                            {booking.accommodationType !== "apartment" && (
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
                            )}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell data-testid={`chain-cell-${booking.id}`}>
                        {booking.hotelChain?.name ??
                          (booking.accommodationType === "apartment" ? "Apartment / Rental" : "—")}
                      </TableCell>
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
                                {booking.exchangeRateEstimated && (
                                  <p className="text-amber-600 text-xs mt-0.5">
                                    Historical rate unavailable — estimated using current rate
                                  </p>
                                )}
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
                      <TableCell
                        className="text-right text-sm"
                        data-testid="booking-points-redeemed"
                      >
                        {booking.pointsRedeemed
                          ? `${booking.pointsRedeemed.toLocaleString("en-US")} pts`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm" data-testid="booking-certs">
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
        </>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsPageInner />
    </Suspense>
  );
}
