"use client";

import { countryName } from "@/lib/countries";
import type { TravelStop } from "@/app/api/travel-map/route";
import type { AnimationStop } from "./travel-map-utils";

interface TravelMapHudProps {
  currentStop: TravelStop | null;
  stopIndex: number; // 0-based; -1 = not started
  totalStops: number;
  tickedNights: number; // 0 → numNights for current stop, animated
  cumulativeNights: number; // sum of all nights so far including tickedNights
  totalNights: number; // grand total across all stops
  totalCountries: number;
  isComplete: boolean;
}

export function TravelMapHud({
  currentStop,
  stopIndex,
  totalStops,
  tickedNights,
  cumulativeNights,
  totalNights,
  totalCountries,
  isComplete,
}: TravelMapHudProps) {
  if (stopIndex === -1 && !isComplete) return null;

  if (isComplete) {
    return (
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-6 pb-10 pt-16"
        data-testid="travel-map-hud"
      >
        <div className="text-center" data-testid="hud-complete-summary">
          <div className="text-white text-2xl font-bold mb-1">Journey Complete</div>
          <div className="text-slate-400 text-sm">
            {totalStops} stays · {totalNights} nights · {totalCountries} countries
          </div>
        </div>
      </div>
    );
  }

  if (!currentStop) return null;

  const isHome = !!(currentStop as AnimationStop).isHome;
  const propertyDisplay = isHome
    ? (currentStop.city?.toUpperCase() ?? "HOME")
    : currentStop.propertyName.toUpperCase();
  const city = currentStop.city;
  const country = currentStop.countryCode ? countryName(currentStop.countryCode) : null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-4 pb-10 pt-16"
      data-testid="travel-map-hud"
    >
      <div className="flex justify-between items-end mb-3">
        <div className="min-w-0">
          <div
            className="text-white text-xl sm:text-2xl font-bold uppercase tracking-wide line-clamp-2"
            data-testid="hud-property-name"
            title={propertyDisplay}
          >
            {propertyDisplay}
          </div>
          <div className="text-slate-400 text-sm">
            {city && <span>{city} · </span>}
            {country && <span>{country} · </span>}
            {currentStop.checkIn}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="text-purple-400 text-4xl font-black font-mono leading-none"
            data-testid="hud-night-counter"
          >
            {tickedNights}
          </div>
          <div className="text-slate-500 text-xs uppercase tracking-widest">nights</div>
        </div>
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span data-testid="hud-stay-counter">
          Stay {stopIndex + 1} of {totalStops}
        </span>
        <span data-testid="hud-total-nights">{cumulativeNights} nights total</span>
      </div>
    </div>
  );
}
