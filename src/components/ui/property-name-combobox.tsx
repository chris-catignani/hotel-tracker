"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { GeoResult } from "@/lib/types";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { MapPin, X, HelpCircle } from "lucide-react";

interface PropertyNameComboboxProps {
  id?: string;
  value: string;
  confirmed: boolean;
  countryCode: string | null;
  city: string | null;
  onValueChange: (value: string) => void;
  onGeoSelect: (result: GeoResult) => void;
  onManualEdit: () => void;
  onReset: () => void;
  onCantFind: () => void;
  placeholder?: string;
  error?: string;
  "data-testid"?: string;
}

export function PropertyNameCombobox({
  id,
  value,
  confirmed,
  countryCode,
  city,
  onValueChange,
  onGeoSelect,
  onManualEdit,
  onReset,
  onCantFind,
  placeholder = "Search for your property...",
  error,
  "data-testid": testId,
}: PropertyNameComboboxProps) {
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data: GeoResult[] = await res.json();
        setSuggestions(data);
        setOpen(true); // always open when we have results or not (to show "Can't find?")
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onValueChange(newValue);
    onManualEdit();

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSelect = (result: GeoResult) => {
    onGeoSelect(result);
    setSuggestions([]);
    setOpen(false);
  };

  const handleCantFind = () => {
    setOpen(false);
    onCantFind();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Confirmed state: read-only display with reset button
  if (confirmed) {
    const locationLabel = [city, countryCode ? countryName(countryCode) : null]
      .filter(Boolean)
      .join(", ");

    return (
      <div className="space-y-1">
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm",
            error && "border-destructive"
          )}
          data-testid={testId ? `${testId}-confirmed` : undefined}
        >
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{value}</p>
            {locationLabel && (
              <p className="text-xs text-muted-foreground truncate">{locationLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 rounded p-0.5 hover:bg-accent hover:text-accent-foreground"
            aria-label="Clear property selection"
            data-testid={testId ? `${testId}-reset` : undefined}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // Unconfirmed state: search input with dropdown
  const showDropdown = open && value.trim().length >= 3;

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        error={error}
        data-testid={testId}
        autoComplete="off"
        onFocus={() => {
          if (value.trim().length >= 3 && suggestions.length >= 0) setOpen(true);
        }}
      />
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {suggestions.map((result, i) => (
            <button
              key={i}
              type="button"
              className="flex w-full items-start gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(result);
              }}
              data-testid={`geo-suggestion-${i}`}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <span className="font-medium">{result.displayName}</span>
                {(result.city || result.countryCode) && (
                  <span className="ml-1 text-muted-foreground">
                    {[result.city, result.countryCode].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </button>
          ))}
          <button
            type="button"
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
            onMouseDown={(e) => {
              e.preventDefault();
              handleCantFind();
            }}
            data-testid="geo-cant-find"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            Can&apos;t find your hotel?
          </button>
        </div>
      )}
    </div>
  );
}
