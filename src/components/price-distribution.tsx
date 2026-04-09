"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
      const increment = mode === "stays" ? 1 : dateNights;
      counts[bucketLabel] += increment;
    });

    return BUCKETS.map((b) => ({ label: b.label, count: counts[b.label] }));
  }, [bookings, metric, mode]);

  const hasData = data.some((d) => d.count > 0);

  return (
    <Card className="flex flex-col min-h-[320px] pb-0" data-testid="price-distribution-card">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold mt-1">Price Distribution</CardTitle>
        <div className="flex flex-row flex-wrap gap-1.5 items-center justify-end">
          <div className="flex shrink-0 rounded-lg border p-0.5 gap-0.5">
            {(["stays", "nights"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  mode === m
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "stays" ? "Stays" : "Nights"}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 rounded-lg border p-0.5 gap-0.5">
            {(["net", "total"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  metric === m
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "net" ? "Net/Night" : "Total/Night"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pl-3 pr-3 pb-3">
        <div className="flex-1 min-h-[140px]">
          {!hasData ? (
            <EmptyState
              icon={BarChart2}
              title="No data"
              description="Price distribution will appear once you add bookings."
              className="border-none bg-transparent"
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={45}
                  tick={({ x, y, payload }) => (
                    <g transform={`translate(${x},${y})`}>
                      <text
                        x={0}
                        y={0}
                        dy={4}
                        textAnchor="end"
                        fontSize={9}
                        fill="currentColor"
                        transform="rotate(-35)"
                      >
                        {payload.value}
                      </text>
                    </g>
                  )}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={25} interval={0} />
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
        </div>
      </CardContent>
    </Card>
  );
}
