"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, MapPinned } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { AlternateCandidateRow } from "./alternate-candidate-row";
import { WatchAlternateModal } from "./watch-alternate-modal";
import { toast } from "sonner";

interface Candidate {
  propertyId: string;
  name: string;
  distanceMiles: number | null;
  hotelChainId: string | null;
  chainCategories: string[];
}

interface Props {
  bookingId: string;
  hotelChainId: string;
}

const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

export function AlternateHotelsSection({ bookingId, hotelChainId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState<(typeof RADIUS_OPTIONS)[number]>(10);
  const [countryWide, setCountryWide] = useState(false);
  const [watchedCount, setWatchedCount] = useState(0);
  const [activeWatch, setActiveWatch] = useState<Candidate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      hotelChainIds: hotelChainId,
      radiusMiles: String(radius),
      countryWide: String(countryWide),
    });
    const result = await apiFetch<Candidate[]>(`/api/bookings/${bookingId}/alternates?${qs}`);
    setLoading(false);
    if (result.ok) {
      setCandidates(result.data);
    } else {
      toast.error("Failed to load alternate hotels. Please try again.");
    }
  }, [bookingId, hotelChainId, radius, countryWide]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (expanded) load();
  }, [expanded, load]);

  const watchLimitReached = watchedCount >= 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <MapPinned className="h-4 w-4" />
            Alternate hotels — watch for price drops
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((e) => !e)}
            data-testid="alternate-hotels-toggle"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">Radius</Label>
              <div className="flex gap-1 mt-1">
                {RADIUS_OPTIONS.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={radius === r && !countryWide ? "default" : "outline"}
                    onClick={() => {
                      setCountryWide(false);
                      setRadius(r);
                    }}
                    data-testid={`radius-${r}`}
                  >
                    {r} mi
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={countryWide ? "default" : "outline"}
                  onClick={() => setCountryWide((v) => !v)}
                  data-testid="radius-country"
                >
                  Country-wide
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="alternate-hotels-empty">
              No alternates found. Try widening the radius.
            </p>
          ) : (
            <div>
              {candidates.map((c) => (
                <AlternateCandidateRow
                  key={c.propertyId}
                  propertyId={c.propertyId}
                  name={c.name}
                  distanceMiles={c.distanceMiles}
                  chainCategories={c.chainCategories}
                  onWatchClick={() => setActiveWatch(c)}
                  watchDisabled={watchLimitReached}
                  watchDisabledReason={
                    watchLimitReached ? "Max 5 alternate watches per booking" : undefined
                  }
                />
              ))}
            </div>
          )}

          {activeWatch && (
            <WatchAlternateModal
              bookingId={bookingId}
              property={{ id: activeWatch.propertyId, name: activeWatch.name }}
              onClose={() => setActiveWatch(null)}
              onSaved={() => {
                setWatchedCount((n) => n + 1);
                setActiveWatch(null);
              }}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}
