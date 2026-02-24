"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardStats } from "@/components/dashboard-stats";
import { PaymentTypeBreakdown } from "@/components/payment-type-breakdown";
import { calculateNetCost, getNetCostBreakdown } from "@/lib/net-cost";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays, Wallet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingCard } from "@/components/bookings/booking-card";
import { formatCurrency as formatDollars, formatDate, formatCerts } from "@/lib/utils";

interface BookingCertificate {
  id: number;
  certType: string;
}

interface BookingWithRelations {
  id: number;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: string;
  taxAmount: string;
  totalCost: string;
  portalCashbackRate: string | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  notes: string | null;
  hotelChain: {
    id: number;
    name: string;
    loyaltyProgram: string | null;
    basePointRate: string | number | null;
    pointType: { name: string; centsPerPoint: string } | null;
  };
  hotelChainSubBrand?: {
    id: number;
    name: string;
  } | null;
  creditCard: {
    id: number;
    name: string;
    rewardType: string;
    rewardRate: string | number;
    pointType: { name: string; centsPerPoint: string } | null;
  } | null;
  shoppingPortal: {
    id: number;
    name: string;
    rewardType: string;
    pointType: { name: string; centsPerPoint: string } | null;
  } | null;
  bookingPromotions: {
    id: number;
    bookingId: number;
    promotionId: number;
    appliedValue: string;
    autoApplied: boolean;
    verified: boolean;
    promotion: {
      id: number;
      name: string;
      type: string;
      value: string | number;
      valueType: string;
    };
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

export default function DashboardPage() {
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bookings")
      .then((res) => res.json())
      .then((data) => {
        setBookings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const hotelChainSummaries = useMemo(() => {
    const summaries = bookings.reduce(
      (acc, b) => {
        const chain = b.hotelChain.name;
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
        // Only cash bookings contribute to spend/savings
        if (Number(b.totalCost) > 0) {
          acc[chain].totalSpend += Number(b.totalCost);
          acc[chain].totalSavings += calcTotalSavings(b);
        }
        return acc;
      },
      {} as Record<string, HotelChainSummary>
    );
    return Object.values(summaries);
  }, [bookings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const totalBookings = bookings.length;
  // Only cash bookings (totalCost > 0) contribute to spend/savings/avg stats
  const cashBookings = bookings.filter((b) => Number(b.totalCost) > 0);
  const totalSpend = cashBookings.reduce((sum, b) => sum + Number(b.totalCost), 0);
  const totalSavings = bookings.reduce((sum, b) => sum + calcTotalSavings(b), 0);
  const totalNights = bookings.reduce((sum, b) => sum + b.numNights, 0);
  const cashNights = cashBookings.reduce((sum, b) => sum + b.numNights, 0);
  const avgNetCostPerNight =
    cashNights > 0 ? cashBookings.reduce((sum, b) => sum + calculateNetCost(b), 0) / cashNights : 0;

  const totalPointsRedeemed = bookings.reduce((sum, b) => sum + (b.pointsRedeemed ?? 0), 0);
  const totalCertificates = bookings.reduce((sum, b) => sum + b.certificates.length, 0);
  const totalCombinedSpend = bookings.reduce((sum, b) => {
    const { pointsRedeemedValue, certsValue } = getNetCostBreakdown(b);
    return sum + Number(b.totalCost) + pointsRedeemedValue + certsValue;
  }, 0);

  const recentBookings = bookings.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your hotel bookings and savings</p>
      </div>

      <DashboardStats
        totalBookings={totalBookings}
        totalSpend={totalSpend}
        totalSavings={totalSavings}
        totalNights={totalNights}
        avgNetCostPerNight={avgNetCostPerNight}
        totalPointsRedeemed={totalPointsRedeemed}
        totalCertificates={totalCertificates}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Bookings</CardTitle>
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
                title="No bookings yet"
                description="Start tracking your hotel stays and savings by adding your first booking."
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
                          <TableRow key={booking.id}>
                            <TableCell>
                              <Link
                                href={`/bookings/${booking.id}`}
                                className="font-medium hover:underline"
                              >
                                {booking.propertyName}
                              </Link>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {booking.hotelChain.name}
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
                              {total > 0 ? formatDollars(total) : "—"}
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
                            >
                              {formatDollars(netCost / booking.numNights)}
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

        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Savings Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {cashBookings.length === 0 ? (
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
                    const totalPromoSavings = cashBookings.reduce(
                      (sum, b) =>
                        sum + b.bookingPromotions.reduce((s, bp) => s + Number(bp.appliedValue), 0),
                      0
                    );
                    const totalPortalCashback = cashBookings.reduce((sum, b) => {
                      const portalBasis = b.portalCashbackOnTotal
                        ? Number(b.totalCost)
                        : Number(b.pretaxCost);
                      const portalRate = Number(b.portalCashbackRate || 0);
                      if (b.shoppingPortal?.rewardType === "points") {
                        return (
                          sum +
                          portalRate *
                            portalBasis *
                            Number(b.shoppingPortal.pointType?.centsPerPoint ?? 0)
                        );
                      }
                      return sum + portalRate * portalBasis;
                    }, 0);
                    const totalCardRewards = cashBookings.reduce(
                      (sum, b) =>
                        sum +
                        (b.creditCard
                          ? Number(b.totalCost) *
                            Number(b.creditCard.rewardRate) *
                            Number(b.creditCard.pointType?.centsPerPoint ?? 0)
                          : 0),
                      0
                    );
                    const totalLoyaltyPointsValue = cashBookings.reduce(
                      (sum, b) =>
                        sum +
                        (b.loyaltyPointsEarned && b.hotelChain.pointType
                          ? b.loyaltyPointsEarned * Number(b.hotelChain.pointType.centsPerPoint)
                          : 0),
                      0
                    );

                    const items = [
                      {
                        label: "Promotion Savings",
                        value: totalPromoSavings,
                        color: "bg-blue-500",
                      },
                      {
                        label: "Portal Cashback",
                        value: totalPortalCashback,
                        color: "bg-green-500",
                      },
                      {
                        label: "Card Rewards",
                        value: totalCardRewards,
                        color: "bg-purple-500",
                      },
                      {
                        label: "Loyalty Points Value",
                        value: totalLoyaltyPointsValue,
                        color: "bg-orange-500",
                      },
                    ];

                    const maxValue = Math.max(...items.map((i) => i.value), 1);

                    return (
                      <>
                        {items.map((item) => (
                          <div key={item.label} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{item.label}</span>
                              <span className="font-medium text-green-600">
                                {formatDollars(item.value)}
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
                            <span className="text-green-600">{formatDollars(totalSavings)}</span>
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

          <PaymentTypeBreakdown bookings={bookings} />
        </div>
      </div>

      {bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hotel Chain Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile View: Cards */}
            <div className="flex flex-col gap-4 md:hidden" data-testid="hotel-chain-summary-mobile">
              {hotelChainSummaries.map((summary) => (
                <div key={summary.chain} className="flex flex-col p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="text-base">
                      {summary.chain}
                    </Badge>
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
                      <div className="text-sm font-medium">{formatDollars(summary.totalSpend)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Total Savings
                      </div>
                      <div className="text-sm font-medium text-green-600">
                        {formatDollars(summary.totalSavings)}
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
                          ? formatDollars(summary.totalNet / summary.totalNights)
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
                    <TableHead>Hotel Chain</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Nights</TableHead>
                    <TableHead className="text-right">Cash Spent</TableHead>
                    <TableHead className="text-right">Award Points Spent</TableHead>
                    <TableHead className="text-right">Total Savings</TableHead>
                    <TableHead className="text-right">Net/Night</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotelChainSummaries.map((summary) => (
                    <TableRow key={summary.chain}>
                      <TableCell className="font-medium">
                        <Badge variant="outline">{summary.chain}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{summary.count}</TableCell>
                      <TableCell className="text-right">{summary.totalNights}</TableCell>
                      <TableCell className="text-right">
                        {formatDollars(summary.totalSpend)}
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
                        {formatDollars(summary.totalSavings)}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.totalNights > 0
                          ? formatDollars(summary.totalNet / summary.totalNights)
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
