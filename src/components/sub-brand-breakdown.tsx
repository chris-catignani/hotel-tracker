"use client";

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart as PieChartIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface Booking {
  id: number;
  numNights: number;
  hotelChainSubBrand?: {
    id: number;
    name: string;
  } | null;
}

interface SubBrandBreakdownProps {
  bookings: Booking[];
}

type BreakdownMode = "stays" | "nights";

const COLORS = [
  "#3b82f6", // Blue-500
  "#10b981", // Emerald-500
  "#f59e0b", // Amber-500
  "#ef4444", // Red-500
  "#8b5cf6", // Violet-500
  "#ec4899", // Pink-500
  "#06b6d4", // Cyan-500
  "#f97316", // Orange-500
  "#6366f1", // Indigo-500
  "#84cc16", // Lime-500
];

export function SubBrandBreakdown({ bookings }: SubBrandBreakdownProps) {
  const [mode, setMode] = useState<BreakdownMode>("stays");

  const data = useMemo(() => {
    const counts: Record<string, number> = {};

    bookings.forEach((booking) => {
      const subBrandName = booking.hotelChainSubBrand?.name || "Other";
      const value = mode === "stays" ? 1 : booking.numNights;
      counts[subBrandName] = (counts[subBrandName] || 0) + value;
    });

    const sortedEntries = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (sortedEntries.length <= 10) {
      return sortedEntries;
    }

    const top9 = sortedEntries.slice(0, 9);
    const others = sortedEntries.slice(9);
    const othersValue = others.reduce((sum, item) => sum + item.value, 0);

    return [...top9, { name: "Other", value: othersValue }];
  }, [bookings, mode]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Sub Brands</CardTitle>
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
          <EmptyState
            icon={PieChartIcon}
            title="No data"
            description="Sub brand breakdown will appear once you add bookings."
            className="border-none bg-transparent"
            data-testid="sub-brand-breakdown-empty"
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
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
            className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-2"
            data-testid="sub-brand-breakdown-legend"
          >
            {data.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center gap-2"
                data-testid={`legend-item-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <div className="flex flex-col sm:flex-row sm:gap-1.5 items-start sm:items-center">
                  <span className="text-xs font-medium truncate max-w-[100px] sm:max-w-none">
                    {item.name}
                  </span>
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
