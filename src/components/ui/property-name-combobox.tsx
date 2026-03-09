"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { GeoResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

interface PropertyNameComboboxProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  onGeoSelect: (result: GeoResult) => void;
  onManualEdit: () => void;
  placeholder?: string;
  error?: string;
  "data-testid"?: string;
}

export function PropertyNameCombobox({
  id,
  value,
  onValueChange,
  onGeoSelect,
  onManualEdit,
  placeholder = "e.g. Marriott Downtown Chicago",
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
        setOpen(data.length > 0);
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

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
      />
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {suggestions.map((result, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left"
              )}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click
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
        </div>
      )}
    </div>
  );
}
