"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface Booking {
  id: string;
  numNights: number;
  accommodationType?: string;
  hotelChainSubBrand?: {
    id: string;
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
      if (booking.accommodationType === "apartment") return;
      const subBrandName = booking.hotelChainSubBrand?.name || "Other";
      const value = mode === "stays" ? 1 : booking.numNights;
      counts[subBrandName] = (counts[subBrandName] || 0) + value;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [bookings, mode]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Top 10 Hotel Brands</CardTitle>
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
      <CardContent className="flex-1 flex items-center px-6 pb-4">
        <div className="w-full">
          {total === 0 ? (
            <EmptyState
              icon={LayoutList}
              title="No data"
              description="Top brands will appear once you add bookings."
              className="border-none bg-transparent"
              data-testid="sub-brand-breakdown-empty"
            />
          ) : (
            <div className="space-y-2" data-testid="sub-brand-breakdown-legend">
              {data.map((item, index) => (
                <div
                  key={item.name}
                  className="space-y-0.5"
                  data-testid={`legend-item-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate mr-2">{item.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {item.value} ({((item.value / total) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(item.value / data[0].value) * 100}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
