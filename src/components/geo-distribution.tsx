"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface BookingForGeo {
  id: string;
  numNights: number;
  property: {
    countryCode: string | null;
    city: string | null;
  };
}

interface GeoDistributionProps {
  bookings: BookingForGeo[];
}

type GeoView = "country" | "city";
type CountMode = "stays" | "nights";

function getCountryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function GeoDistribution({ bookings }: GeoDistributionProps) {
  const [view, setView] = useState<GeoView>("country");
  const [mode, setMode] = useState<CountMode>("stays");

  const data = useMemo(() => {
    const agg: Record<string, { stays: number; nights: number; displayLabel: string }> = {};

    bookings.forEach((booking) => {
      let key: string;
      let displayLabel: string;

      if (view === "country") {
        const code = booking.property.countryCode;
        if (!code) return;
        key = code;
        displayLabel = getCountryName(code);
      } else {
        const city = booking.property.city;
        const code = booking.property.countryCode;
        if (!city) return;
        key = code ? `${city}, ${code}` : city;
        displayLabel = key;
      }

      if (!agg[key]) agg[key] = { stays: 0, nights: 0, displayLabel };
      agg[key].stays += 1;
      agg[key].nights += booking.numNights;
    });

    return Object.entries(agg)
      .map(([key, { stays, nights, displayLabel }]) => ({
        key,
        count: mode === "stays" ? stays : nights,
        displayLabel,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [bookings, view, mode]);

  const maxCount = data[0]?.count ?? 1;

  return (
    <Card className="flex flex-col" data-testid="geo-distribution-card">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold mt-1">Geo Distribution</CardTitle>
        <div className="flex flex-row flex-wrap gap-1.5 items-center justify-end">
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
          <div className="flex gap-1 bg-secondary p-1 rounded-md">
            <Button
              variant={view === "country" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setView("country")}
            >
              Country
            </Button>
            <Button
              variant={view === "city" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setView("city")}
            >
              City
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center px-6 pb-4">
        <div className="w-full">
          {data.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No data"
              description="Geo distribution will appear once bookings have location data."
              className="border-none bg-transparent"
            />
          ) : (
            <div className="space-y-2">
              {data.map(({ key, displayLabel, count }) => (
                <div key={key} className="space-y-0.5" data-testid={`geo-row-${key}`}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{displayLabel}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${(count / maxCount) * 100}%` }}
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
