"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardStats } from "@/components/dashboard-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BookingCertificate {
  id: number;
  value: string;
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
  hotel: {
    id: number;
    name: string;
    loyaltyProgram: string | null;
    pointType: { centsPerPoint: string } | null;
  };
  creditCard: {
    id: number;
    name: string;
    rewardRate: string;
    pointType: { centsPerPoint: string } | null;
  } | null;
  shoppingPortal: {
    id: number;
    name: string;
    rewardType: string;
    pointType: { centsPerPoint: string } | null;
  } | null;
  bookingPromotions: {
    id: number;
    appliedValue: string;
    autoApplied: boolean;
    promotion: { id: number; name: string; type: string };
  }[];
  certificates: BookingCertificate[];
}

function formatDollars(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function calcNetCost(booking: BookingWithRelations): number {
  const total = Number(booking.totalCost);
  const promoSavings = booking.bookingPromotions.reduce(
    (sum, bp) => sum + Number(bp.appliedValue),
    0
  );
  const portalBasis = booking.portalCashbackOnTotal ? total : Number(booking.pretaxCost);
  const portalRate = Number(booking.portalCashbackRate || 0);
  let portalCashback = 0;
  if (booking.shoppingPortal?.rewardType === "points") {
    portalCashback = portalRate * portalBasis * Number(booking.shoppingPortal.pointType?.centsPerPoint ?? 0);
  } else {
    portalCashback = portalRate * portalBasis;
  }
  const cardReward = booking.creditCard
    ? total *
      Number(booking.creditCard.rewardRate) *
      Number(booking.creditCard.pointType?.centsPerPoint ?? 0)
    : 0;
  const loyaltyPointsValue =
    booking.loyaltyPointsEarned && booking.hotel.pointType
      ? booking.loyaltyPointsEarned * Number(booking.hotel.pointType.centsPerPoint)
      : 0;
  return total - promoSavings - portalCashback - cardReward - loyaltyPointsValue;
}

function calcTotalSavings(booking: BookingWithRelations): number {
  return Number(booking.totalCost) - calcNetCost(booking);
}

function formatCerts(certificates: { id: number; value: string }[]): string {
  if (certificates.length === 0) return "—";
  const counts: Record<string, number> = {};
  for (const cert of certificates) {
    counts[cert.value] = (counts[cert.value] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([desc, count]) => (count > 1 ? `${count} × ${desc}` : desc))
    .join(", ");
}

function getBookingTypeBadge(booking: {
  totalCost: string;
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
  const totalSpend = cashBookings.reduce(
    (sum, b) => sum + Number(b.totalCost),
    0
  );
  const totalSavings = cashBookings.reduce(
    (sum, b) => sum + calcTotalSavings(b),
    0
  );
  const totalNights = bookings.reduce((sum, b) => sum + b.numNights, 0);
  const cashNights = cashBookings.reduce((sum, b) => sum + b.numNights, 0);
  const avgNetCostPerNight =
    cashNights > 0
      ? cashBookings.reduce((sum, b) => sum + calcNetCost(b), 0) / cashNights
      : 0;

  const totalPointsRedeemed = bookings.reduce((sum, b) => sum + (b.pointsRedeemed ?? 0), 0);
  const totalCertificates = bookings.reduce((sum, b) => sum + b.certificates.length, 0);
  const awardByProgram = Object.values(
    bookings.reduce((acc, b) => {
      const hasAward = (b.pointsRedeemed ?? 0) > 0 || b.certificates.length > 0;
      if (!hasAward) return acc;
      const key = b.hotel.loyaltyProgram || b.hotel.name;
      if (!acc[key]) acc[key] = { program: key, points: 0, certs: 0 };
      acc[key].points += b.pointsRedeemed ?? 0;
      acc[key].certs += b.certificates.length;
      return acc;
    }, {} as Record<string, { program: string; points: number; certs: number }>)
  );

  const recentBookings = bookings.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your hotel bookings and savings
        </p>
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
              <p className="text-center text-muted-foreground py-8">
                No bookings yet.{" "}
                <Link href="/bookings/new" className="underline">
                  Add your first booking
                </Link>
              </p>
            ) : (
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
                    const netCost = calcNetCost(booking);
                    const total = Number(booking.totalCost);
                    const typeBadge = getBookingTypeBadge(booking);
                    const isAwardOnly =
                      total === 0 &&
                      !!(booking.pointsRedeemed || booking.certificates.length > 0);
                    return (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <Link
                            href={`/bookings/${booking.id}`}
                            className="font-medium hover:underline"
                          >
                            {booking.propertyName}
                          </Link>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            {booking.hotel.name}
                            {typeBadge && (
                              <Badge variant="secondary" className="text-xs py-0">
                                {typeBadge}
                              </Badge>
                            )}
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
                          {formatCerts(booking.certificates)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            !isAwardOnly && netCost < total ? "text-green-600" : ""
                          }`}
                        >
                          {isAwardOnly ? "—" : formatDollars(netCost / booking.numNights)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
                <p className="text-center text-muted-foreground py-8">
                  No data to display yet
                </p>
              ) : (
                <div className="space-y-4">
                  {(() => {
                  const totalPromoSavings = cashBookings.reduce(
                    (sum, b) =>
                      sum +
                      b.bookingPromotions.reduce(
                        (s, bp) => s + Number(bp.appliedValue),
                        0
                      ),
                    0
                  );
                  const totalPortalCashback = cashBookings.reduce((sum, b) => {
                    const portalBasis = b.portalCashbackOnTotal ? Number(b.totalCost) : Number(b.pretaxCost);
                    const portalRate = Number(b.portalCashbackRate || 0);
                    if (b.shoppingPortal?.rewardType === "points") {
                      return sum + portalRate * portalBasis * Number(b.shoppingPortal.pointType?.centsPerPoint ?? 0);
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
                      (b.loyaltyPointsEarned && b.hotel.pointType
                        ? b.loyaltyPointsEarned * Number(b.hotel.pointType.centsPerPoint)
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
                                width: `${Math.max(
                                  (item.value / maxValue) * 100,
                                  0
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t">
                        <div className="flex justify-between font-medium">
                          <span>Total Savings</span>
                          <span className="text-green-600">
                            {formatDollars(totalSavings)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground mt-1">
                          <span>Effective Savings Rate</span>
                          <span>
                            {totalSpend > 0
                              ? ((totalSavings / totalSpend) * 100).toFixed(1)
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

          <Card>
            <CardHeader>
              <CardTitle>Award Stays Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {awardByProgram.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No award stays yet
                </p>
              ) : (
                <div className="space-y-3">
                  {awardByProgram.map(({ program, points, certs }) => {
                    const parts = [
                      points > 0
                        ? `${points.toLocaleString("en-US")} pts`
                        : null,
                      certs > 0
                        ? `${certs} cert${certs !== 1 ? "s" : ""}`
                        : null,
                    ].filter(Boolean);
                    return (
                      <div key={program} className="flex justify-between text-sm">
                        <span>{program}</span>
                        <span className="font-medium">{parts.join(" · ")}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hotel Chain Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hotel Chain</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Nights</TableHead>
                  <TableHead className="text-right">Total Spend</TableHead>
                  <TableHead className="text-right">Total Savings</TableHead>
                  <TableHead className="text-right">Avg Net Cost</TableHead>
                  <TableHead className="text-right">Net/Night</TableHead>
                  <TableHead className="text-right">Award Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(
                  bookings.reduce(
                    (acc, b) => {
                      const chain = b.hotel.name;
                      if (!acc[chain]) {
                        acc[chain] = {
                          chain,
                          count: 0,
                          totalNights: 0,
                          cashCount: 0,
                          cashNights: 0,
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
                      // Only cash bookings contribute to spend/savings/net
                      if (Number(b.totalCost) > 0) {
                        acc[chain].cashCount++;
                        acc[chain].cashNights += b.numNights;
                        acc[chain].totalSpend += Number(b.totalCost);
                        acc[chain].totalSavings += calcTotalSavings(b);
                        acc[chain].totalNet += calcNetCost(b);
                      }
                      return acc;
                    },
                    {} as Record<
                      string,
                      {
                        chain: string;
                        count: number;
                        totalNights: number;
                        cashCount: number;
                        cashNights: number;
                        totalSpend: number;
                        totalSavings: number;
                        totalNet: number;
                        pointsRedeemed: number;
                        certs: number;
                      }
                    >
                  )
                ).map((summary) => (
                  <TableRow key={summary.chain}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{summary.chain}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {summary.count}
                    </TableCell>
                    <TableCell className="text-right">
                      {summary.totalNights}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDollars(summary.totalSpend)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatDollars(summary.totalSavings)}
                    </TableCell>
                    <TableCell className="text-right">
                      {summary.cashCount > 0
                        ? formatDollars(summary.totalNet / summary.cashCount)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {summary.cashNights > 0
                        ? formatDollars(summary.totalNet / summary.cashNights)
                        : "—"}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {totalBookings > cashBookings.length && (
        <p className="text-xs text-muted-foreground">
          * Spend, savings, and average cost metrics exclude award/cert bookings ($0 cost). Nights and booking counts include all bookings.
        </p>
      )}
    </div>
  );
}
