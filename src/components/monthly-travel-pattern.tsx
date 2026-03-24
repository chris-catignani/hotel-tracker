"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface BookingForMonthly {
  checkIn: string;
  numNights: number;
}

interface MonthlyTravelPatternProps {
  bookings: BookingForMonthly[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type CountMode = "stays" | "nights";

export function MonthlyTravelPattern({ bookings }: MonthlyTravelPatternProps) {
  const [mode, setMode] = useState<CountMode>("stays");

  const data = useMemo(() => {
    const counts = Array(12).fill(0);
    bookings.forEach((booking) => {
      // Slice month digits directly — avoids timezone issues with new Date()
      const monthIndex = parseInt(booking.checkIn.slice(5, 7)) - 1;
      counts[monthIndex] += mode === "stays" ? 1 : booking.numNights;
    });
    return MONTHS.map((month, i) => ({ month, count: counts[i], fullMonth: MONTH_FULL[i] }));
  }, [bookings, mode]);

  if (bookings.length === 0) {
    return (
      <Card data-testid="monthly-travel-pattern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">Monthly Travel Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={CalendarRange}
            title="No data"
            description="Monthly travel patterns will appear once you add bookings."
            className="border-none bg-transparent"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="monthly-travel-pattern-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Monthly Travel Pattern</CardTitle>
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
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip
              labelFormatter={(label: string, payload) => {
                const item = payload?.[0]?.payload as { fullMonth?: string } | undefined;
                return item?.fullMonth ?? label;
              }}
              contentStyle={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: "8px",
              }}
              itemStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
