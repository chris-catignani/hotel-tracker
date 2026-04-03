"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Pause, Map } from "lucide-react";
import { PageSpinner } from "@/components/ui/page-spinner";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { TravelMapHud } from "./travel-map-hud";
import { apiFetch } from "@/lib/api-fetch";
import type { TravelStop } from "@/app/api/travel-map/route";
import type { TravelMapProps } from "./travel-map";

// Lazy-loaded to keep maplibre-gl out of the initial bundle
const TravelMap = dynamic<TravelMapProps>(() => import("./travel-map").then((m) => m.TravelMap), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#0f172a]" />,
});

interface TravelMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TravelMapModal({ open, onOpenChange }: TravelMapModalProps) {
  const [stops, setStops] = useState<TravelStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stopIndex, setStopIndex] = useState(-1);
  const [tickedNights, setTickedNights] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setIsPlaying(false);
      setStops([]);
      setStopIndex(-1);
      setTickedNights(0);
      setIsComplete(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    setLoading(true);
    setFetchError(false);
    apiFetch<TravelStop[]>("/api/travel-map").then((result) => {
      setLoading(false);
      if (result.ok) {
        setStops(result.data);
      } else {
        setFetchError(true);
      }
    });
  }, [open]);

  const handleUpdate = useCallback((index: number, ticked: number) => {
    setStopIndex(index);
    setTickedNights(ticked);
  }, []);

  const handleComplete = useCallback(() => {
    setIsPlaying(false);
    setIsComplete(true);
    const last = stops[stops.length - 1];
    setStopIndex(stops.length - 1);
    setTickedNights(last?.numNights ?? 0);
  }, [stops]);

  const completedNights = stops
    .slice(0, Math.max(stopIndex, 0))
    .reduce((s, st) => s + st.numNights, 0);
  const cumulativeNights = completedNights + tickedNights;
  const totalNights = stops.reduce((s, st) => s + st.numNights, 0);
  const totalCountries = new Set(stops.map((s) => s.countryCode).filter(Boolean)).size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-screen h-screen max-w-none m-0 p-0 border-0 rounded-none bg-[#0f172a] [&>button]:text-white [&>button]:top-4 [&>button]:right-4"
        data-testid="travel-map-modal"
      >
        {loading && <PageSpinner />}
        {fetchError && (
          <div className="flex items-center justify-center h-full">
            <ErrorBanner
              error="Failed to load travel data."
              onDismiss={() => setFetchError(false)}
            />
          </div>
        )}
        {!loading && !fetchError && stops.length === 0 && (
          <EmptyState
            icon={Map}
            title="No location data yet"
            description="Coordinates are added when you create or edit a booking."
          />
        )}
        {!loading && !fetchError && stops.length > 0 && (
          <div className="relative w-full h-full">
            <TravelMap
              stops={stops}
              isPlaying={isPlaying}
              speed={speed}
              onUpdate={handleUpdate}
              onComplete={handleComplete}
            />
            <TravelMapHud
              currentStop={stops[stopIndex] ?? null}
              stopIndex={stopIndex}
              totalStops={stops.length}
              tickedNights={tickedNights}
              cumulativeNights={cumulativeNights}
              totalNights={totalNights}
              totalCountries={totalCountries}
              isComplete={isComplete}
            />
            {/* Controls — top left, above HUD */}
            <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setIsPlaying((p) => !p)}
                data-testid="travel-map-play-pause"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-md">
                <span className="text-slate-400 text-xs">Speed</span>
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.5}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-24 accent-blue-400"
                  data-testid="travel-map-speed-slider"
                />
                <span className="text-slate-400 text-xs w-8">{speed}×</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
