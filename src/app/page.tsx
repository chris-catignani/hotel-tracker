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
  notes: string | null;
  hotel: { id: number; name: string; pointValue: string | null };
  creditCard: {
    id: number;
    name: string;
    rewardRate: string;
    pointValue: string;
  } | null;
  shoppingPortal: { id: number; name: string } | null;
  bookingPromotions: {
    id: number;
    appliedValue: string;
    autoApplied: boolean;
    promotion: { id: number; name: string; type: string };
  }[];
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
  const portalCashback =
    Number(booking.portalCashbackRate || 0) *
    (booking.portalCashbackOnTotal ? total : Number(booking.pretaxCost));
  const cardReward = booking.creditCard
    ? total *
      Number(booking.creditCard.rewardRate) *
      Number(booking.creditCard.pointValue)
    : 0;
  const loyaltyPointsValue =
    booking.loyaltyPointsEarned && booking.hotel.pointValue
      ? booking.loyaltyPointsEarned * Number(booking.hotel.pointValue)
      : 0;
  return total - promoSavings - portalCashback - cardReward - loyaltyPointsValue;
}

function calcTotalSavings(booking: BookingWithRelations): number {
  return Number(booking.totalCost) - calcNetCost(booking);
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
  const totalSpend = bookings.reduce(
    (sum, b) => sum + Number(b.totalCost),
    0
  );
  const totalSavings = bookings.reduce(
    (sum, b) => sum + calcTotalSavings(b),
    0
  );
  const avgNetCost =
    totalBookings > 0
      ? bookings.reduce((sum, b) => sum + calcNetCost(b), 0) / totalBookings
      : 0;

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
        avgNetCost={avgNetCost}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
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
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBookings.map((booking) => {
                    const netCost = calcNetCost(booking);
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
                          <div className="text-xs text-muted-foreground">
                            {booking.hotel.name}
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
                          {formatDollars(total)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            netCost < total ? "text-green-600" : ""
                          }`}
                        >
                          {formatDollars(netCost)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Savings Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No data to display yet
              </p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const totalPromoSavings = bookings.reduce(
                    (sum, b) =>
                      sum +
                      b.bookingPromotions.reduce(
                        (s, bp) => s + Number(bp.appliedValue),
                        0
                      ),
                    0
                  );
                  const totalPortalCashback = bookings.reduce(
                    (sum, b) =>
                      sum +
                      Number(b.portalCashbackRate || 0) *
                        (b.portalCashbackOnTotal ? Number(b.totalCost) : Number(b.pretaxCost)),
                    0
                  );
                  const totalCardRewards = bookings.reduce(
                    (sum, b) =>
                      sum +
                      (b.creditCard
                        ? Number(b.totalCost) *
                          Number(b.creditCard.rewardRate) *
                          Number(b.creditCard.pointValue)
                        : 0),
                    0
                  );
                  const totalLoyaltyPointsValue = bookings.reduce(
                    (sum, b) =>
                      sum +
                      (b.loyaltyPointsEarned && b.hotel.pointValue
                        ? b.loyaltyPointsEarned * Number(b.hotel.pointValue)
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
                  <TableHead className="text-right">Total Spend</TableHead>
                  <TableHead className="text-right">Total Savings</TableHead>
                  <TableHead className="text-right">Avg Net Cost</TableHead>
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
                          totalSpend: 0,
                          totalSavings: 0,
                          totalNet: 0,
                        };
                      }
                      acc[chain].count++;
                      acc[chain].totalSpend += Number(b.totalCost);
                      acc[chain].totalSavings += calcTotalSavings(b);
                      acc[chain].totalNet += calcNetCost(b);
                      return acc;
                    },
                    {} as Record<
                      string,
                      {
                        chain: string;
                        count: number;
                        totalSpend: number;
                        totalSavings: number;
                        totalNet: number;
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
                      {formatDollars(summary.totalSpend)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatDollars(summary.totalSavings)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDollars(summary.totalNet / summary.count)}
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
