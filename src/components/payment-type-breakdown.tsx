"use client";

import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface BookingCertificate {
  id: number;
  certType: string;
}

interface Booking {
  id: number;
  numNights: number;
  totalCost: string | number;
  pointsRedeemed: number | null;
  certificates: BookingCertificate[];
}

interface PaymentTypeBreakdownProps {
  bookings: Booking[];
}

type BreakdownMode = "stays" | "nights";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"]; // Emerald-500, Blue-500, Amber-500, Red-500

export function PaymentTypeBreakdown({ bookings }: PaymentTypeBreakdownProps) {
  const [mode, setMode] = useState<BreakdownMode>("stays");

  const data = useMemo(() => {
    let cashCount = 0;
    let pointsCount = 0;
    let certsCount = 0;
    let combinationCount = 0;
    let ignoredCount = 0;

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

        if (hasCerts) {
          const certNights = Math.min(numCerts, numNights);
          const remainingNights = numNights - certNights;

          if (remainingNights === 0) {
            certsCount += certNights;
            deduced = true;
          } else {
            // Check if remaining nights can be assigned to exactly one other type
            // Ignore cash < 20 if points are present
            if (hasPoints && !isSignificantCash) {
              certsCount += certNights;
              pointsCount += remainingNights;
              deduced = true;
            } else if (!hasPoints && isSignificantCash) {
              certsCount += certNights;
              cashCount += remainingNights;
              deduced = true;
            }
          }
        } else if (hasPoints && hasCash) {
          if (!isSignificantCash) {
            // Cash is likely just fees, treat all nights as points
            pointsCount += numNights;
            deduced = true;
          } else if (numNights === 2) {
            // 2 nights, Points + Cash: Deduce 1 night each
            pointsCount += 1;
            cashCount += 1;
            deduced = true;
          }
        } else if (hasPoints) {
          pointsCount += numNights;
          deduced = true;
        } else if (hasCash) {
          cashCount += numNights;
          deduced = true;
        }

        if (!deduced) {
          ignoredCount += 1;
        }
      }
    });

    const chartData = [
      { name: "Cash", value: cashCount },
      { name: "Points", value: pointsCount },
      { name: "Certificates", value: certsCount },
    ];

    if (mode === "stays") {
      chartData.push({ name: "Combination", value: combinationCount });
    }

    return {
      chartData: chartData.filter((d) => d.value > 0),
      ignoredCount,
    };
  }, [bookings, mode]);

  const total = data.chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Payment Type</CardTitle>
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
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center pt-0">
        {total === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No data to display
          </div>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ fontSize: "12px" }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {mode === "nights" && data.ignoredCount > 0 && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold">{data.ignoredCount}</span> combination{" "}
                  {data.ignoredCount === 1 ? "booking" : "bookings"} ignored because
                  nightly breakdown is unavailable.
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
