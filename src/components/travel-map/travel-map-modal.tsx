"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Play, Pause, Map, RotateCcw } from "lucide-react";
import { PageSpinner } from "@/components/ui/page-spinner";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { TravelMapHud } from "./travel-map-hud";
import { HomebaseInput } from "./travel-map-homebase-input";
import { apiFetch } from "@/lib/api-fetch";
import type { TravelStop } from "@/app/api/travel-map/route";
import type { TravelMapProps } from "./travel-map";
import {
  insertHomebaseStops,
  HOMEBASE_STORAGE_KEY,
  type AnimationStop,
  type HomebaseEntry,
} from "./travel-map-utils";

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

  const [homebase, setHomebase] = useState<HomebaseEntry | null>(null);
  const [homebasePromptVisible, setHomebasePromptVisible] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stopIndex, setStopIndex] = useState(-1);
  const [tickedNights, setTickedNights] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const animationStops: AnimationStop[] = useMemo(
    () => (homebase ? insertHomebaseStops(stops, homebase) : stops),
    [stops, homebase]
  );

  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setIsPlaying(false);
      setStops([]);
      setStopIndex(-1);
      setTickedNights(0);
      setIsComplete(false);
      setMapKey(0);
      setCountdown(null);
      setHomebase(null);
      setHomebasePromptVisible(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    setLoading(true);
    setFetchError(false);
    apiFetch<TravelStop[]>("/api/travel-map").then((result) => {
      setLoading(false);
      if (result.ok) {
        setStops(result.data);
        if (result.data.length > 0) {
          const saved = localStorage.getItem(HOMEBASE_STORAGE_KEY);
          setHomebase(saved ? (JSON.parse(saved) as HomebaseEntry) : null);
          setHomebasePromptVisible(true);
        }
      } else {
        setFetchError(true);
      }
    });
  }, [open]);

  const handleUpdate = useCallback((index: number, ticked: number) => {
    setStopIndex(index);
    setTickedNights(ticked);
  }, []);

  // Countdown starts when homebase prompt is dismissed
  useEffect(() => {
    if (stops.length === 0 || homebasePromptVisible) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setCountdown(5);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [stops, homebasePromptVisible]);

  // Countdown tick — auto-plays when it reaches 0
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setCountdown(null);
      setIsPlaying(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleHomebaseSelect = useCallback((entry: HomebaseEntry) => {
    localStorage.setItem(HOMEBASE_STORAGE_KEY, JSON.stringify(entry));
    setHomebase(entry);
    setHomebasePromptVisible(false);
  }, []);

  const handleHomebaseSkip = useCallback(() => {
    setHomebasePromptVisible(false);
  }, []);

  const handleRestart = useCallback(() => {
    setIsPlaying(false);
    setStopIndex(-1);
    setTickedNights(0);
    setIsComplete(false);
    setMapKey((k) => k + 1);
    setCountdown(5);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (homebasePromptVisible) return;
    if (isComplete) {
      handleRestart();
    } else if (countdown !== null) {
      setCountdown(null);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  }, [isComplete, countdown, handleRestart, homebasePromptVisible]);

  const handleComplete = useCallback(() => {
    setIsPlaying(false);
    setIsComplete(true);
    const last = animationStops[animationStops.length - 1];
    setStopIndex(animationStops.length - 1);
    setTickedNights(last?.numNights ?? 0);
  }, [animationStops]);

  const completedNights = useMemo(
    () => animationStops.slice(0, Math.max(stopIndex, 0)).reduce((s, st) => s + st.numNights, 0),
    [animationStops, stopIndex]
  );
  const cumulativeNights = completedNights + tickedNights;
  const totalNights = useMemo(
    () => animationStops.reduce((s, st) => s + st.numNights, 0),
    [animationStops]
  );
  const totalCountries = useMemo(
    () => new Set(animationStops.map((s) => s.countryCode).filter(Boolean)).size,
    [animationStops]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed inset-0 sm:inset-6 w-auto h-auto max-w-none sm:max-w-none translate-x-0 translate-y-0 m-0 p-0 border-0 rounded-none sm:rounded-xl overflow-hidden bg-[#0f172a] [&>button]:text-white [&>button]:top-10 [&>button]:right-4 [&>button]:size-10 [&>button]:rounded-full [&>button]:bg-black/40 [&>button_svg]:size-6 [touch-action:manipulation]"
        data-testid="travel-map-modal"
      >
        <VisuallyHidden>
          <DialogTitle>Travel Map</DialogTitle>
        </VisuallyHidden>
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
          <div className="relative w-full h-full cursor-pointer" onClick={handlePlayPause}>
            <TravelMap
              key={mapKey}
              stops={animationStops}
              isPlaying={isPlaying}
              speed={speed}
              onUpdate={handleUpdate}
              onComplete={handleComplete}
            />
            <TravelMapHud
              currentStop={animationStops[stopIndex] ?? null}
              stopIndex={stopIndex}
              totalStops={animationStops.length}
              tickedNights={tickedNights}
              cumulativeNights={cumulativeNights}
              totalNights={totalNights}
              totalCountries={totalCountries}
              isComplete={isComplete}
            />
            {/* Journey progress bar — bottom of screen, weighted by nights */}
            {totalNights > 0 && (
              <div className="absolute bottom-8 left-0 right-0 h-0.5 bg-slate-800 z-30">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
                  style={{ width: `${(cumulativeNights / totalNights) * 100}%` }}
                />
              </div>
            )}
            {/* Homebase prompt — shown after stops load, before countdown */}
            {homebasePromptVisible && (
              <HomebaseInput
                initialAddress={homebase?.address ?? ""}
                onSelect={handleHomebaseSelect}
                onSkip={handleHomebaseSkip}
              />
            )}
            {/* Pause overlay */}
            {!isPlaying && countdown === null && !isComplete && !homebasePromptVisible && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="rounded-full bg-black/40 p-6">
                  <Play className="h-12 w-12 text-white opacity-80" fill="white" />
                </div>
              </div>
            )}
            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div
                  className="text-white font-black tabular-nums select-none"
                  style={{ fontSize: "20vmin", opacity: 0.7, textShadow: "0 0 40px #60a5fa" }}
                  data-testid="travel-map-countdown"
                >
                  {countdown}
                </div>
              </div>
            )}
            {/* Controls — below MapLibre attribution pill */}
            <div
              className="absolute top-10 left-4 flex items-center gap-3 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="secondary"
                size="icon"
                onClick={handlePlayPause}
                data-testid="travel-map-play-pause"
                aria-label={
                  isComplete
                    ? "Restart"
                    : isPlaying
                      ? "Pause"
                      : countdown !== null
                        ? "Skip countdown"
                        : "Play"
                }
              >
                {isComplete ? (
                  <RotateCcw className="h-4 w-4" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
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
