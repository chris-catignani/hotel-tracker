"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardStats } from "@/components/dashboard-stats";
import { PaymentTypeBreakdown } from "@/components/payment-type-breakdown";
import { SubBrandBreakdown } from "@/components/sub-brand-breakdown";
import { calculateNetCost, getNetCostBreakdown } from "@/lib/net-cost";
import { certPointsValue } from "@/lib/cert-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays, Wallet, ChevronUp, ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingCard } from "@/components/bookings/booking-card";
import { formatCurrency as formatDollars, formatDate, formatCerts, cn } from "@/lib/utils";

interface BookingCertificate {
  id: string;
  certType: string;
}

interface BookingWithRelations {
  id: string;
  property: { name: string };
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: string;
  taxAmount: string;
  totalCost: string;
  currency: string;
  lockedExchangeRate: string | number | null;
  portalCashbackRate: string | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  notes: string | null;
  hotelChainId: string | null;
  accommodationType: string;
  otaAgencyId: string | null;
  bookingSource: string | null;
  hotelChain: {
    id: string;
    name: string;
    loyaltyProgram: string | null;
    basePointRate: string | number | null;
    pointType: { name: string; usdCentsPerPoint: string } | null;
    userStatus?: {
      eliteStatus: {
        name: string;
        bonusPercentage: string | number | null;
        fixedRate: string | number | null;
        isFixed: boolean;
      } | null;
    } | null;
  } | null;
  hotelChainSubBrand?: {
    id: string;
    name: string;
    basePointRate: string | number | null;
  } | null;
  userCreditCard: {
    creditCard: {
      id: string;
      name: string;
      rewardType: string;
      rewardRate: string | number;
      pointType: { name: string; usdCentsPerPoint: string } | null;
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
    pointType: { name: string; usdCentsPerPoint: string } | null;
  } | null;
  bookingPromotions: {
    id: string;
    bookingId: string;
    promotionId: string;
    appliedValue: string;
    eligibleNightsAtBooking?: number | null;
    eligibleStayCount?: number | null;
    eligibleNightCount?: number | null;
    autoApplied: boolean;
    verified: boolean;
    promotion: {
      id: string;
      name: string;
      type: string;
      value: string | number;
      valueType: string;
      restrictions?: {
        minNightsRequired?: number | null;
        spanStays?: boolean;
      } | null;
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
    benefitApplications?: {
      appliedValue: string | number;
      eligibleNightsAtBooking?: number | null;
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
    }[];
  }[];
  certificates: BookingCertificate[];
}

function calcTotalSavings(booking: BookingWithRelations): number {
  const { promoSavings, portalCashback, cardReward, loyaltyPointsValue } =
    getNetCostBreakdown(booking);
  return promoSavings + portalCashback + cardReward + loyaltyPointsValue;
}

interface HotelChainSummary {
  chain: string;
  count: number;
  totalNights: number;
  totalSpend: number;
  totalSavings: number;
  totalNet: number;
  pointsRedeemed: number;
  certs: number;
}

const SortHeader = ({
  column,
  label,
  className = "",
  sortConfig,
  onSort,
}: {
  column: keyof HotelChainSummary;
  label: string;
  className?: string;
  sortConfig: { key: keyof HotelChainSummary; direction: "asc" | "desc" };
  onSort: (key: keyof HotelChainSummary) => void;
}) => (
  <TableHead
    className={`cursor-pointer hover:bg-muted/50 transition-colors ${className}`}
    onClick={() => onSort(column)}
  >
    <div
      className={`flex items-center gap-1 ${className.includes("text-right") ? "justify-end" : ""}`}
    >
      {label}
      {sortConfig.key === column ? (
        sortConfig.direction === "desc" ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )
      ) : null}
    </div>
  </TableHead>
);

const APARTMENT_LABEL = "Apartments / Short-term Rentals";
const FILTER_STORAGE_KEY = "dashboard-accommodation-filter";

type AccommodationFilter = "all" | "hotel" | "apartment";

export default function DashboardPage() {
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [accommodationFilter, setAccommodationFilter] = useState<AccommodationFilter>("all");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof HotelChainSummary;
    direction: "asc" | "desc";
  }>({
    key: "count",
    direction: "desc",
  });

  useEffect(() => {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "hotel" || saved === "apartment") setAccommodationFilter(saved);
  }, []);

  useEffect(() => {
    fetch("/api/bookings")
      .then((res) => res.json())
      .then((data) => {
        setBookings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleFilterChange = (filter: AccommodationFilter) => {
    setAccommodationFilter(filter);
    localStorage.setItem(FILTER_STORAGE_KEY, filter);
  };

  const hasApartments = bookings.some((b) => b.accommodationType === "apartment");
  const hasHotels = bookings.some((b) => b.accommodationType === "hotel");
  const showFilter = hasApartments && hasHotels;

  const filteredBookings = useMemo(() => {
    if (accommodationFilter === "all") return bookings;
    return bookings.filter((b) => b.accommodationType === accommodationFilter);
  }, [bookings, accommodationFilter]);

  const hotelChainSummaries = useMemo(() => {
    const summaries = filteredBookings.reduce(
      (acc, b) => {
        const chain =
          b.accommodationType === "apartment" ? APARTMENT_LABEL : (b.hotelChain?.name ?? "Unknown");
        if (!acc[chain]) {
          acc[chain] = {
            chain,
            count: 0,
            totalNights: 0,
            totalSpend: 0,
            totalSavings: 0,
            totalNet: 0,
            pointsRedeemed: 0,
            certs: 0,
          };
        }
        acc[chain].count++;
        acc[chain].totalNights += b.numNights;
        acc[chain].pointsRedeemed += b.pointsRedeemed ?? 0;
        acc[chain].certs += b.certificates.length;
        acc[chain].totalNet += calculateNetCost(b);
        acc[chain].totalSavings += calcTotalSavings(b);
        // Only cash bookings contribute to spend
        const usdTotalCost = Number(b.totalCost) * (Number(b.lockedExchangeRate) || 1);
        if (Number(b.totalCost) > 0) {
          acc[chain].totalSpend += usdTotalCost;
        }
        return acc;
      },
      {} as Record<string, HotelChainSummary>
    );
    return Object.values(summaries);
  }, [filteredBookings]);

  const sortedHotelChainSummaries = useMemo(() => {
    return [...hotelChainSummaries].sort((a, b) => {
      // Always pin the apartment row to the bottom
      if (a.chain === APARTMENT_LABEL) return 1;
      if (b.chain === APARTMENT_LABEL) return -1;
      let aValue: string | number = a[sortConfig.key];
      let bValue: string | number = b[sortConfig.key];

      // Handle special sorting for calculated columns
      if (sortConfig.key === "totalNet") {
        // Sort by Net/Night average
        aValue = a.totalNights > 0 ? a.totalNet / a.totalNights : 0;
        bValue = b.totalNights > 0 ? b.totalNet / b.totalNights : 0;
      } else if (sortConfig.key === "pointsRedeemed") {
        // Sort by total award "impact" (points + certs)
        // This is a heuristic, but better than just points
        aValue = a.pointsRedeemed + a.certs * 20000; // Assume cert ~20k pts for sorting
        bValue = b.pointsRedeemed + b.certs * 20000;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortConfig.direction === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [hotelChainSummaries, sortConfig]);

  // Breakdown counts always use unfiltered bookings (shown in "All" view sub-labels)
  const { bookingBreakdown, nightsBreakdown } = useMemo(() => {
    if (!showFilter) return { bookingBreakdown: undefined, nightsBreakdown: undefined };
    const counts = bookings.reduce(
      (acc, b) => {
        if (b.accommodationType === "hotel") {
          acc.hotelCount++;
          acc.hotelNights += b.numNights;
        } else if (b.accommodationType === "apartment") {
          acc.apartmentCount++;
          acc.apartmentNights += b.numNights;
        }
        return acc;
      },
      { hotelCount: 0, apartmentCount: 0, hotelNights: 0, apartmentNights: 0 }
    );
    return {
      bookingBreakdown: { hotels: counts.hotelCount, apartments: counts.apartmentCount },
      nightsBreakdown: { hotels: counts.hotelNights, apartments: counts.apartmentNights },
    };
  }, [bookings, showFilter]);

  const toggleSort = (key: keyof HotelChainSummary) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const totalBookings = filteredBookings.length;
  // Only cash bookings (totalCost > 0) contribute to total spend
  const cashBookings = filteredBookings.filter((b) => Number(b.totalCost) > 0);
  const totalSpend = cashBookings.reduce(
    (sum, b) => sum + Number(b.totalCost) * (Number(b.lockedExchangeRate) || 1),
    0
  );
  const totalSavings = filteredBookings.reduce((sum, b) => sum + calcTotalSavings(b), 0);
  const totalNights = filteredBookings.reduce((sum, b) => sum + b.numNights, 0);

  // Exclude mixed-payment bookings from avg/night — each stay must use exactly one payment type
  const isMixedPayment = (b: BookingWithRelations) =>
    [Number(b.totalCost) > 0, (b.pointsRedeemed ?? 0) > 0, b.certificates.length > 0].filter(
      Boolean
    ).length > 1;
  const avgNightSkippedCount = filteredBookings.filter(isMixedPayment).length;

  const cashStays = filteredBookings.filter((b) => Number(b.totalCost) > 0 && !isMixedPayment(b));
  const cashStayNights = cashStays.reduce((sum, b) => sum + b.numNights, 0);
  const avgCashNetCostPerNight =
    cashStayNights > 0
      ? cashStays.reduce((sum, b) => sum + calculateNetCost(b), 0) / cashStayNights
      : null;

  const pointsStays = filteredBookings.filter(
    (b) => (b.pointsRedeemed ?? 0) > 0 && !isMixedPayment(b)
  );
  const pointsStayNights = pointsStays.reduce((sum, b) => sum + b.numNights, 0);
  const avgPointsPerNight =
    pointsStayNights > 0
      ? pointsStays.reduce((sum, b) => sum + (b.pointsRedeemed ?? 0), 0) / pointsStayNights
      : null;

  const certStays = filteredBookings.filter((b) => b.certificates.length > 0 && !isMixedPayment(b));
  const certStayNights = certStays.reduce((sum, b) => sum + b.numNights, 0);
  const avgCertPointsPerNight =
    certStayNights > 0
      ? certStays.reduce(
          (sum, b) => sum + b.certificates.reduce((s, c) => s + certPointsValue(c.certType), 0),
          0
        ) / certStayNights
      : null;

  const totalPointsRedeemed = filteredBookings.reduce((sum, b) => sum + (b.pointsRedeemed ?? 0), 0);
  const totalCertificates = filteredBookings.reduce((sum, b) => sum + b.certificates.length, 0);
  const totalCombinedSpend = filteredBookings.reduce((sum, b) => {
    const { totalCost: usdTotalCost, pointsRedeemedValue, certsValue } = getNetCostBreakdown(b);
    return sum + usdTotalCost + pointsRedeemedValue + certsValue;
  }, 0);

  const today = new Date().toISOString().split("T")[0];
  const recentBookings = filteredBookings
    .filter((b) => b.checkOut.slice(0, 10) >= today)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your bookings and savings</p>
        </div>
        {showFilter && (
          <div className="flex shrink-0 rounded-lg border p-0.5 gap-0.5">
            {(["all", "hotel", "apartment"] as const).map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  accommodationFilter === f
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`dashboard-filter-${f}`}
              >
                {f === "all" ? "All" : f === "hotel" ? "Hotels" : "Apartments"}
              </button>
            ))}
          </div>
        )}
      </div>

      <DashboardStats
        totalBookings={totalBookings}
        totalSpend={totalSpend}
        totalSavings={totalSavings}
        totalNights={totalNights}
        avgCashNetCostPerNight={avgCashNetCostPerNight}
        avgPointsPerNight={avgPointsPerNight}
        avgCertPointsPerNight={avgCertPointsPerNight}
        avgNightSkippedCount={avgNightSkippedCount}
        totalPointsRedeemed={totalPointsRedeemed}
        totalCertificates={totalCertificates}
        bookingBreakdown={accommodationFilter === "all" ? bookingBreakdown : undefined}
        nightsBreakdown={accommodationFilter === "all" ? nightsBreakdown : undefined}
      />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="lg:col-span-2 xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming Bookings</CardTitle>
              <Link href="/bookings">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming bookings"
                description="No current or future bookings. Add a new booking or check the bookings list for past stays."
                action={{
                  label: "Add Booking",
                  href: "/bookings/new",
                }}
                data-testid="recent-bookings-empty"
              />
            ) : (
              <>
                {/* Mobile View: Cards */}
                <div className="flex flex-col gap-4 md:hidden" data-testid="recent-bookings-mobile">
                  {recentBookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block" data-testid="recent-bookings-desktop">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead className="text-right">Cash</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                        <TableHead className="text-right">Certs</TableHead>
                        <TableHead className="text-right">Net/Night</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentBookings.map((booking) => {
                        const netCost = calculateNetCost(booking);
                        const total = Number(booking.totalCost);
                        return (
                          <TableRow key={booking.id} data-testid={`booking-row-${booking.id}`}>
                            <TableCell>
                              <Link
                                href={`/bookings/${booking.id}`}
                                className="font-medium hover:underline"
                              >
                                {booking.property.name}
                              </Link>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {booking.hotelChain?.name ?? "Apartment / Rental"}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(booking.checkIn)}
                              <div className="text-xs text-muted-foreground">
                                {booking.numNights} night
                                {booking.numNights !== 1 ? "s" : ""}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {total > 0
                                ? formatDollars(total, "USD", {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })
                                : "—"}
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
                              className={`text-right font-medium ${
                                netCost < total ? "text-green-600" : ""
                              }`}
                              data-testid="booking-net-per-night"
                            >
                              {formatDollars(netCost / booking.numNights, "USD", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Savings Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No savings data"
                description="Savings from promotions, portals, and credit cards will appear here once you add bookings."
                className="py-6"
                data-testid="savings-breakdown-empty"
              />
            ) : (
              <div className="space-y-4">
                {(() => {
                  const totals = bookings.reduce(
                    (acc, b) => {
                      const { promoSavings, portalCashback, cardReward, loyaltyPointsValue } =
                        getNetCostBreakdown(b);
                      acc.promoSavings += promoSavings;
                      acc.portalCashback += portalCashback;
                      acc.cardRewards += cardReward;
                      acc.loyaltyPointsValue += loyaltyPointsValue;
                      return acc;
                    },
                    { promoSavings: 0, portalCashback: 0, cardRewards: 0, loyaltyPointsValue: 0 }
                  );
                  const totalPromoSavings = totals.promoSavings;
                  const totalPortalCashback = totals.portalCashback;
                  const totalCardRewards = totals.cardRewards;
                  const totalLoyaltyPointsValue = totals.loyaltyPointsValue;

                  const items = [
                    {
                      label: "Promotion Savings",
                      value: totalPromoSavings,
                      color: "bg-blue-500",
                      testId: "savings-breakdown-promo",
                    },
                    {
                      label: "Portal Cashback",
                      value: totalPortalCashback,
                      color: "bg-green-500",
                      testId: "savings-breakdown-portal",
                    },
                    {
                      label: "Card Rewards",
                      value: totalCardRewards,
                      color: "bg-purple-500",
                      testId: "savings-breakdown-card",
                    },
                    {
                      label: "Loyalty Points Value",
                      value: totalLoyaltyPointsValue,
                      color: "bg-orange-500",
                      testId: "savings-breakdown-loyalty",
                    },
                  ];

                  const maxValue = Math.max(...items.map((i) => i.value), 1);

                  return (
                    <>
                      {items.map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{item.label}</span>
                            <span className="font-medium text-green-600" data-testid={item.testId}>
                              {formatDollars(item.value, "USD", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-secondary">
                            <div
                              className={`h-3 rounded-full ${item.color}`}
                              style={{
                                width: `${Math.max((item.value / maxValue) * 100, 0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t">
                        <div className="flex justify-between font-medium">
                          <span>Total Savings</span>
                          <span className="text-green-600" data-testid="savings-breakdown-total">
                            {formatDollars(totalSavings, "USD", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground mt-1">
                          <span>Effective Savings Rate</span>
                          <span>
                            {totalCombinedSpend > 0
                              ? ((totalSavings / totalCombinedSpend) * 100).toFixed(1)
                              : "0.0"}
                            %
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        <PaymentTypeBreakdown bookings={filteredBookings} />
        {accommodationFilter !== "apartment" && <SubBrandBreakdown bookings={filteredBookings} />}
      </div>

      {bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Accommodation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile View: Cards */}
            <div className="flex flex-col gap-4 md:hidden" data-testid="hotel-chain-summary-mobile">
              {sortedHotelChainSummaries.map((summary) => (
                <div key={summary.chain} className="flex flex-col p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-base font-semibold">{summary.chain}</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">{summary.count} Bookings</div>
                      <div className="text-xs text-muted-foreground">
                        {summary.totalNights} Nights
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Cash Spent
                      </div>
                      <div className="text-sm font-medium">
                        {formatDollars(summary.totalSpend, "USD", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Total Savings
                      </div>
                      <div className="text-sm font-medium text-green-600">
                        {formatDollars(summary.totalSavings, "USD", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Awards Used
                      </div>
                      <div className="text-sm font-medium">
                        {(() => {
                          const parts = [
                            summary.pointsRedeemed > 0
                              ? `${summary.pointsRedeemed.toLocaleString("en-US")} pts`
                              : null,
                            summary.certs > 0
                              ? `${summary.certs} cert${summary.certs !== 1 ? "s" : ""}`
                              : null,
                          ].filter(Boolean);
                          return parts.length > 0 ? parts.join(" · ") : "—";
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Net/Night
                      </div>
                      <div className="text-sm font-medium">
                        {summary.totalNights > 0
                          ? formatDollars(summary.totalNet / summary.totalNights, "USD", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block" data-testid="hotel-chain-summary-desktop">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader
                      column="chain"
                      label="Chain / Type"
                      sortConfig={sortConfig}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      column="count"
                      label="Bookings"
                      className="text-right"
                      sortConfig={sortConfig}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      column="totalNights"
                      label="Nights"
                      className="text-right"
                      sortConfig={sortConfig}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      column="totalSpend"
                      label="Cash Spent"
                      className="text-right"
                      sortConfig={sortConfig}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      column="pointsRedeemed"
                      label="Award Points Spent"
                      className="text-right"
                      sortConfig={sortConfig}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      column="totalSavings"
                      label="Total Savings"
                      className="text-right"
                      sortConfig={sortConfig}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      column="totalNet"
                      label="Net/Night"
                      className="text-right"
                      sortConfig={sortConfig}
                      onSort={toggleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHotelChainSummaries.map((summary) => (
                    <TableRow key={summary.chain}>
                      <TableCell className="font-medium">{summary.chain}</TableCell>
                      <TableCell className="text-right">{summary.count}</TableCell>
                      <TableCell className="text-right">{summary.totalNights}</TableCell>
                      <TableCell className="text-right">
                        {formatDollars(summary.totalSpend, "USD", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {(() => {
                          const parts = [
                            summary.pointsRedeemed > 0
                              ? `${summary.pointsRedeemed.toLocaleString("en-US")} pts`
                              : null,
                            summary.certs > 0
                              ? `${summary.certs} cert${summary.certs !== 1 ? "s" : ""}`
                              : null,
                          ].filter(Boolean);
                          return parts.length > 0 ? parts.join(" · ") : "—";
                        })()}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatDollars(summary.totalSavings, "USD", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.totalNights > 0
                          ? formatDollars(summary.totalNet / summary.totalNights, "USD", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
