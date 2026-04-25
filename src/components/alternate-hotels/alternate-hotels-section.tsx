"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, MapPinned } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { AppSelect, type AppSelectOption } from "@/components/ui/app-select";
import { AlternateCandidateRow } from "./alternate-candidate-row";
import { WatchAlternateModal } from "./watch-alternate-modal";
import { toast } from "sonner";

interface Candidate {
  propertyId: string;
  name: string;
  hotelChainName: string | null;
  distanceMiles: number | null;
  hotelChainId: string | null;
  isWatched: boolean;
  priceWatchId: string | null;
  cashThreshold: number | null;
  awardThreshold: number | null;
}

interface Props {
  bookingId: string;
  anchorHasGps: boolean;
  currency: string;
}

const RADIUS_OPTIONS: AppSelectOption[] = [
  { label: "5 mi", value: "5" },
  { label: "10 mi", value: "10" },
  { label: "25 mi", value: "25" },
  { label: "50 mi", value: "50" },
];

export function AlternateHotelsSection({ bookingId, anchorHasGps, currency }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chainOptions, setChainOptions] = useState<AppSelectOption[]>([]);
  const [selectedChainIds, setSelectedChainIds] = useState<string[]>([]);
  const [radius, setRadius] = useState("10");
  const [loading, setLoading] = useState(false);
  const [activeWatch, setActiveWatch] = useState<Candidate | null>(null);
  const chainsFetched = useRef(false);

  useEffect(() => {
    if (expanded && !chainsFetched.current) {
      chainsFetched.current = true;
      apiFetch<{ id: string; name: string }[]>("/api/hotel-chains").then((result) => {
        if (result.ok) {
          setChainOptions(result.data.map((c) => ({ label: c.name, value: c.id })));
        }
      });
    }
  }, [expanded]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      ...(selectedChainIds.length > 0 && { hotelChainIds: selectedChainIds.join(",") }),
      ...(anchorHasGps && { radiusMiles: radius }),
    });
    const result = await apiFetch<Candidate[]>(`/api/bookings/${bookingId}/alternates?${qs}`);
    setLoading(false);
    if (result.ok) {
      setCandidates(result.data);
    } else {
      toast.error("Failed to load alternate hotels. Please try again.");
    }
  }, [bookingId, anchorHasGps, selectedChainIds, radius]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (expanded) load();
  }, [expanded, load]);

  const watchedCount = candidates.filter((c) => c.isWatched).length;
  const watchLimitReached = watchedCount >= 5;

  const sortedCandidates = useMemo(
    () => [...candidates].sort((a, b) => Number(b.isWatched) - Number(a.isWatched)),
    [candidates]
  );

  const handleUnwatch = useCallback(async (candidate: Candidate) => {
    if (!candidate.priceWatchId) return;
    const result = await apiFetch(`/api/price-watches/${candidate.priceWatchId}`, {
      method: "DELETE",
    });
    if (!result.ok) {
      toast.error("Failed to remove watch. Please try again.");
      return;
    }
    setCandidates((prev) =>
      prev.map((c) =>
        c.propertyId === candidate.propertyId
          ? {
              ...c,
              isWatched: false,
              priceWatchId: null,
              cashThreshold: null,
              awardThreshold: null,
            }
          : c
      )
    );
  }, []);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
        data-testid="alternate-hotels-toggle"
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <MapPinned className="h-4 w-4" />
            Alternate hotels — watch for price drops
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            {anchorHasGps && (
              <div className="w-32">
                <Label className="text-xs">Radius</Label>
                <AppSelect
                  options={RADIUS_OPTIONS}
                  value={radius}
                  onValueChange={setRadius}
                  placeholder="Radius"
                  disableSort
                  data-testid="radius-select"
                />
              </div>
            )}
            <div className="w-64">
              <Label className="text-xs">Hotel chain</Label>
              <AppSelect
                multiple
                options={chainOptions}
                value={selectedChainIds}
                onValueChange={setSelectedChainIds}
                placeholder="All chains"
                searchPlaceholder="Search chains..."
                data-testid="chain-select"
              />
            </div>
          </div>

          {watchLimitReached && (
            <div
              className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800"
              data-testid="watch-limit-message"
            >
              You&apos;ve reached the 5-watch limit for this booking. Unwatch a property to add
              another.
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="alternate-hotels-empty">
              No alternates found.{anchorHasGps ? " Try widening the radius." : ""}
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {sortedCandidates.map((c) => (
                <AlternateCandidateRow
                  key={c.propertyId}
                  propertyId={c.propertyId}
                  name={c.name}
                  hotelChainName={c.hotelChainName}
                  distanceMiles={c.distanceMiles}
                  isWatched={c.isWatched}
                  priceWatchId={c.priceWatchId}
                  cashThreshold={c.cashThreshold}
                  awardThreshold={c.awardThreshold}
                  currency={currency}
                  onWatchClick={() => setActiveWatch(c)}
                  onUnwatchClick={() => handleUnwatch(c)}
                  watchDisabled={watchLimitReached && !c.isWatched}
                  watchDisabledReason={
                    watchLimitReached && !c.isWatched
                      ? "Max 5 alternate watches per booking"
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {activeWatch && (
            <WatchAlternateModal
              bookingId={bookingId}
              property={{ id: activeWatch.propertyId, name: activeWatch.name }}
              currency={currency}
              onClose={() => setActiveWatch(null)}
              onSaved={({ priceWatchId, cashThreshold, awardThreshold }) => {
                setCandidates((prev) =>
                  prev.map((c) =>
                    c.propertyId === activeWatch.propertyId
                      ? { ...c, isWatched: true, priceWatchId, cashThreshold, awardThreshold }
                      : c
                  )
                );
                setActiveWatch(null);
              }}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}
