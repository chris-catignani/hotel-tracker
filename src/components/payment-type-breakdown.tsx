"use client";

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

interface BookingCertificate {
  id: string;
  certType: string;
}

interface Booking {
  id: string;
  numNights: number;
  totalCost: string | number;
  pointsRedeemed: number | null;
  certificates: BookingCertificate[];
}

interface PaymentTypeBreakdownProps {
  bookings: Booking[];
}

type BreakdownMode = "stays" | "nights";

const TYPE_COLORS: Record<string, string> = {
  Cash: "#10b981", // Emerald-500
  Points: "#3b82f6", // Blue-500
  Certificates: "#f59e0b", // Amber-500
  Combination: "#ef4444", // Red-500
};

export function PaymentTypeBreakdown({ bookings }: PaymentTypeBreakdownProps) {
  const [mode, setMode] = useState<BreakdownMode>("stays");

  const data = useMemo(() => {
    let cashCount = 0;
    let pointsCount = 0;
    let certsCount = 0;
    let combinationCount = 0;

    bookings.forEach((booking) => {
      const totalCost = Number(booking.totalCost);
      const pointsRedeemed = booking.pointsRedeemed ?? 0;
      const numCerts = booking.certificates?.length ?? 0;
      const numNights = booking.numNights;

      const hasCash = totalCost > 0;
      const isSignificantCash = totalCost >= 20;
      const hasPoints = pointsRedeemed > 0;
      const hasCerts = numCerts > 0;

      if (mode === "stays") {
        const typesCount = [hasCash, hasPoints, hasCerts].filter(Boolean).length;
        if (typesCount > 1) {
          combinationCount += 1;
        } else if (hasCash) {
          cashCount += 1;
        } else if (hasPoints) {
          pointsCount += 1;
        } else if (hasCerts) {
          certsCount += 1;
        }
      } else {
        // Nights mode: Attempt to deduce per-night breakdown
        let deduced = false;

        // Effective types for nightly breakdown (ignore cash < $20 if other methods are present)
        const hasEffectiveCash = isSignificantCash || (!hasPoints && !hasCerts && hasCash);
        const effectiveTypes = [
          hasEffectiveCash ? "cash" : null,
          hasPoints ? "points" : null,
          hasCerts ? "certs" : null,
        ].filter(Boolean);
        const typesCount = effectiveTypes.length;

        // 1. Single effective payment type
        if (typesCount === 1) {
          const type = effectiveTypes[0];
          if (type === "cash") cashCount += numNights;
          else if (type === "points") pointsCount += numNights;
          else if (type === "certs") certsCount += numNights;
          deduced = true;
        }
        // 2. Number of nights matches number of payment types (1 night each)
        else if (typesCount === numNights) {
          effectiveTypes.forEach((t) => {
            if (t === "cash") cashCount += 1;
            else if (t === "points") pointsCount += 1;
            else if (t === "certs") certsCount += 1;
          });
          deduced = true;
        }
        // 3. Certificates + one other effective type
        else if (hasCerts && typesCount === 2) {
          const certNights = Math.min(numCerts, numNights);
          const remainingNights = numNights - certNights;

          certsCount += certNights;
          if (hasPoints) pointsCount += remainingNights;
          else cashCount += remainingNights;
          deduced = true;
        }

        if (!deduced && typesCount > 1) {
          combinationCount += numNights;
        }
      }
    });

    const chartData = [
      { name: "Cash", value: cashCount },
      { name: "Points", value: pointsCount },
      { name: "Certificates", value: certsCount },
      { name: "Combination", value: combinationCount },
    ].filter((d) => d.value > 0);

    return { chartData };
  }, [bookings, mode]);

  const total = data.chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="flex flex-col h-full" data-testid="payment-type-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Payment Type</CardTitle>
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
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-0">
        {total === 0 ? (
          <EmptyState
            icon={PieChartIcon}
            title="No data"
            description="Payment breakdown will appear once you add bookings."
            className="border-none bg-transparent"
            data-testid="payment-type-empty"
          />
        ) : (
          <div className="flex-1 min-h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={TYPE_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    borderColor: "var(--border)",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {total > 0 && (
          <div
            className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-4"
            data-testid="payment-type-legend"
          >
            {data.chartData.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2"
                data-testid={`legend-item-${item.name.toLowerCase()}`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: TYPE_COLORS[item.name] }}
                />
                <div className="flex flex-col sm:flex-row sm:gap-1.5 items-start sm:items-center">
                  <span className="text-xs font-medium">{item.name}</span>
                  <span
                    className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap"
                    data-testid="legend-item-value"
                  >
                    {item.value} ({((item.value / total) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
