"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface BookingForGeo {
  id: string;
  property: {
    countryCode: string | null;
    city: string | null;
  };
}

interface GeoDistributionProps {
  bookings: BookingForGeo[];
}

type GeoView = "country" | "city";

export function GeoDistribution({ bookings }: GeoDistributionProps) {
  const [view, setView] = useState<GeoView>("country");

  const data = useMemo(() => {
    const counts: Record<string, number> = {};

    bookings.forEach((booking) => {
      const key = view === "country" ? booking.property.countryCode : booking.property.city;
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [bookings, view]);

  const maxCount = data[0]?.count ?? 1;

  return (
    <Card data-testid="geo-distribution-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Geo Distribution</CardTitle>
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
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No data"
            description="Geo distribution will appear once bookings have location data."
            className="border-none bg-transparent"
          />
        ) : (
          <div className="space-y-2">
            {data.map(({ label, count }) => (
              <div key={label} className="space-y-0.5" data-testid={`geo-row-${label}`}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{label}</span>
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
      </CardContent>
    </Card>
  );
}
