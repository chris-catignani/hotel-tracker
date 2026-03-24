"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { calculateNetCost, getNetCostBreakdown } from "@/lib/net-cost";

// Must match the full BookingWithRelations shape from page.tsx
// We import only the fields we need; the component accepts the full type.
interface BookingForPrice {
  totalCost: string;
  numNights: number;
  lockedExchangeRate: string | number | null;
  // All other fields required by calculateNetCost / getNetCostBreakdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface PriceDistributionProps {
  bookings: BookingForPrice[];
}

const BUCKETS = [
  { label: "$0–50", min: 0, max: 50 },
  { label: "$50–100", min: 50, max: 100 },
  { label: "$100–150", min: 100, max: 150 },
  { label: "$150–200", min: 150, max: 200 },
  { label: "$200–250", min: 200, max: 250 },
  { label: "$250+", min: 250, max: Infinity },
];

type MetricMode = "net" | "total";
type CountMode = "stays" | "nights";

function getBucket(value: number): string {
  const clamped = Math.max(0, value);
  const bucket = BUCKETS.find((b) => clamped >= b.min && clamped < b.max);
  return bucket?.label ?? "$250+";
}

function getDateNights(checkIn: string, checkOut: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const nights = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay;
  return Math.max(1, Math.round(nights));
}

export function PriceDistribution({ bookings }: PriceDistributionProps) {
  const [metric, setMetric] = useState<MetricMode>("net");
  const [mode, setMode] = useState<CountMode>("stays");

  const data = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(BUCKETS.map((b) => [b.label, 0]));

    bookings.forEach((booking) => {
      let perNight: number;
      // Use date-derived nights for per-night rate calculation (canonical stay length);
      // booking.numNights is used only for the "Nights" count mode accumulation.
      const dateNights = getDateNights(booking.checkIn, booking.checkOut);

      if (metric === "net") {
        perNight = calculateNetCost(booking as never) / dateNights;
      } else {
        const totalCost = Number(booking.totalCost);
        if (totalCost > 0) {
          // Cash stay
          perNight = (totalCost * (Number(booking.lockedExchangeRate) || 1)) / dateNights;
        } else {
          // Award stay: use redemption value
          const { pointsRedeemedValue, certsValue } = getNetCostBreakdown(booking as never);
          perNight = (pointsRedeemedValue + certsValue) / dateNights;
        }
      }

      const bucketLabel = getBucket(perNight);
      const increment = mode === "stays" ? 1 : booking.numNights;
      counts[bucketLabel] += increment;
    });

    return BUCKETS.map((b) => ({ label: b.label, count: counts[b.label] }));
  }, [bookings, metric, mode]);

  const hasData = data.some((d) => d.count > 0);

  return (
    <Card data-testid="price-distribution-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Price Distribution</CardTitle>
        <div className="flex gap-1 flex-wrap justify-end">
          <div className="flex gap-1 bg-secondary p-1 rounded-md">
            <Button
              variant={metric === "net" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setMetric("net")}
            >
              Net/Night
            </Button>
            <Button
              variant={metric === "total" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setMetric("total")}
            >
              Total/Night
            </Button>
          </div>
          <div className="flex gap-1 bg-secondary p-1 rounded-md">
            <Button
              variant={mode === "stays" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setMode("stays")}
            >
              Stays
            </Button>
            <Button
              variant={mode === "nights" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setMode("nights")}
            >
              Nights
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            icon={BarChart2}
            title="No data"
            description="Price distribution will appear once you add bookings."
            className="border-none bg-transparent"
          />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                }}
                itemStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
