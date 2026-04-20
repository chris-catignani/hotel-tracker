// src/hooks/use-year-filter.ts
"use client";

import { useState, useCallback } from "react";

export type YearFilter = number | "all" | "upcoming";

export interface YearOption {
  value: YearFilter;
  label: string;
}

const STORAGE_KEY = "year-filter";

function parseStoredFilter(stored: string | null): YearFilter {
  if (stored === "all" || stored === "upcoming") return stored;
  if (stored !== null) {
    const n = parseInt(stored, 10);
    if (Number.isFinite(n) && !isNaN(n)) return n;
  }
  return new Date().getFullYear();
}

export function buildYearOptions<T extends { checkOut: string }>(bookings: T[]): YearOption[] {
  const currentYear = new Date().getFullYear();
  const years = [
    ...new Set(
      bookings.map((bk) => parseInt(bk.checkOut.slice(0, 4), 10)).filter((y) => !isNaN(y))
    ),
  ].sort((a, b) => b - a);

  return [
    { value: "all", label: "All Years" },
    { value: "upcoming", label: `${currentYear} — Upcoming` },
    ...years.map((y) => ({ value: y as YearFilter, label: String(y) })),
  ];
}

export function useYearFilter() {
  const [yearFilter, setYearFilterState] = useState<YearFilter>(() => {
    if (typeof window === "undefined") return new Date().getFullYear();
    return parseStoredFilter(localStorage.getItem(STORAGE_KEY));
  });

  const setYearFilter = useCallback((filter: YearFilter) => {
    setYearFilterState(filter);
    localStorage.setItem(STORAGE_KEY, String(filter));
  }, []);

  const filterBookings = useCallback(
    <T extends { checkOut: string }>(bookings: T[]): T[] => {
      const today = new Date().toISOString().slice(0, 10);
      const currentYear = new Date().getFullYear();
      if (yearFilter === "all") return bookings;
      if (yearFilter === "upcoming") {
        return bookings.filter(
          (bk) =>
            bk.checkOut.slice(0, 10) >= today &&
            parseInt(bk.checkOut.slice(0, 4), 10) === currentYear
        );
      }
      return bookings.filter((bk) => parseInt(bk.checkOut.slice(0, 4), 10) === yearFilter);
    },
    [yearFilter]
  );

  return { yearFilter, setYearFilter, filterBookings };
}
