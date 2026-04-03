"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { GeoResult } from "@/lib/types";
import type { HomebaseEntry } from "./travel-map-utils";

interface HomebaseInputProps {
  initialEntry: HomebaseEntry | null;
  onSelect: (entry: HomebaseEntry) => void;
  onSkip: () => void;
}

export function HomebaseInput({ initialEntry, onSelect, onSkip }: HomebaseInputProps) {
  const [query, setQuery] = useState(initialEntry?.address ?? "");
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HomebaseEntry | null>(initialEntry);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const url = new URL("/api/geo/search", window.location.origin);
    url.searchParams.set("q", q);
    try {
      const res = await fetch(url.toString());
      if (res.ok) {
        const data: GeoResult[] = await res.json();
        setSuggestions(data);
        setOpen(true);
      }
    } catch {
      // silently ignore — user can keep typing
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedEntry(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSuggestionClick = (result: GeoResult) => {
    if (result.latitude == null || result.longitude == null) return;
    const fullAddress = result.address ?? result.displayName;
    setSelectedEntry({
      address: fullAddress,
      city: result.city,
      countryCode: result.countryCode,
      lat: result.latitude,
      lng: result.longitude,
    });
    setQuery(fullAddress);
    setOpen(false);
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20 bg-black/50"
      data-testid="homebase-prompt"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-white text-lg font-semibold mb-1">Where&apos;s home?</h2>
        <p className="text-slate-400 text-sm mb-4">
          We&apos;ll route through home during long gaps between stays.
        </p>
        <div className="relative mb-4">
          <input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search for your home address..."
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 text-base focus:outline-none focus:border-blue-400"
            data-testid="homebase-address-input"
            autoFocus
            autoComplete="off"
          />
          {open && suggestions.length > 0 && (
            <div className="absolute mt-1 w-full bg-slate-800 border border-slate-600 rounded-md shadow-lg z-10">
              {suggestions.map((result, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-sm text-white hover:bg-slate-700 text-left"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSuggestionClick(result);
                  }}
                  data-testid={`homebase-suggestion-${i}`}
                >
                  <div>
                    <span className="font-medium">{result.displayName}</span>
                    {result.address && (
                      <span className="block text-slate-400 text-xs mt-0.5">{result.address}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onSkip}
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
            data-testid="homebase-skip"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => selectedEntry && onSelect(selectedEntry)}
            disabled={!selectedEntry}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            data-testid="homebase-done"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
