// src/hooks/use-year-filter.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { buildYearOptions, useYearFilter } from "./use-year-filter";

function b(checkOut: string) {
  return { checkOut };
}

const Y = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const PAST_YEAR = Y - 1;
const NEXT_YEAR = Y + 1;

// ── buildYearOptions ────────────────────────────────────────────────────────

describe("buildYearOptions", () => {
  it("returns [Upcoming, All Years] for empty input", () => {
    expect(buildYearOptions([])).toEqual([
      { value: "upcoming", label: `${Y} — Upcoming` },
      { value: "all", label: "All Years" },
    ]);
  });

  it("returns complete ordered array: Upcoming → All Years → descending years", () => {
    const bookings = [b(`${PAST_YEAR}-06-01`), b(`${Y}-06-01`), b(`${PAST_YEAR - 1}-06-01`)];
    expect(buildYearOptions(bookings)).toEqual([
      { value: "upcoming", label: `${Y} — Upcoming` },
      { value: "all", label: "All Years" },
      { value: Y, label: String(Y) },
      { value: PAST_YEAR, label: String(PAST_YEAR) },
      { value: PAST_YEAR - 1, label: String(PAST_YEAR - 1) },
    ]);
  });

  it("deduplicates years", () => {
    const bookings = [b(`${Y}-01-01`), b(`${Y}-06-01`), b(`${Y}-12-31`)];
    const yearEntries = buildYearOptions(bookings).filter((o) => typeof o.value === "number");
    expect(yearEntries).toHaveLength(1);
    expect(yearEntries[0].value).toBe(Y);
  });

  it("Upcoming label contains the actual current year", () => {
    expect(buildYearOptions([])[0].label).toBe(`${Y} — Upcoming`);
  });
});

// ── filterBookings ──────────────────────────────────────────────────────────

describe("filterBookings", () => {
  beforeEach(() => localStorage.clear());

  it("all: returns all bookings unchanged", () => {
    localStorage.setItem("year-filter", "all");
    const { result } = renderHook(() => useYearFilter());
    const bookings = [b(TODAY), b(`${PAST_YEAR}-06-01`), b(`${NEXT_YEAR}-06-01`)];
    expect(result.current.filterBookings(bookings)).toHaveLength(3);
  });

  it("year: returns only bookings matching that checkout year", () => {
    localStorage.setItem("year-filter", String(PAST_YEAR));
    const { result } = renderHook(() => useYearFilter());
    const bookings = [b(TODAY), b(`${PAST_YEAR}-06-01`), b(`${PAST_YEAR}-12-01`)];
    const filtered = result.current.filterBookings(bookings);
    expect(filtered).toHaveLength(2);
    filtered.forEach((bk) => expect(bk.checkOut.slice(0, 4)).toBe(String(PAST_YEAR)));
  });

  it("upcoming: includes booking with checkOut === today (>= is inclusive)", () => {
    localStorage.setItem("year-filter", "upcoming");
    const { result } = renderHook(() => useYearFilter());
    expect(result.current.filterBookings([b(TODAY)])).toHaveLength(1);
  });

  it("upcoming: includes current-year booking with checkOut > today", () => {
    localStorage.setItem("year-filter", "upcoming");
    const { result } = renderHook(() => useYearFilter());
    expect(result.current.filterBookings([b(TOMORROW)])).toHaveLength(1);
  });

  it("upcoming: excludes current-year booking with checkOut < today", () => {
    localStorage.setItem("year-filter", "upcoming");
    const { result } = renderHook(() => useYearFilter());
    expect(result.current.filterBookings([b(YESTERDAY)])).toHaveLength(0);
  });

  it("upcoming: excludes next-year booking even if checkOut > today", () => {
    localStorage.setItem("year-filter", "upcoming");
    const { result } = renderHook(() => useYearFilter());
    expect(result.current.filterBookings([b(`${NEXT_YEAR}-06-01`)])).toHaveLength(0);
  });
});

// ── useYearFilter hook ──────────────────────────────────────────────────────

describe("useYearFilter hook", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to current year when localStorage is empty", () => {
    const { result } = renderHook(() => useYearFilter());
    expect(result.current.yearFilter).toBe(Y);
  });

  it("reads a stored past year", () => {
    localStorage.setItem("year-filter", String(PAST_YEAR));
    const { result } = renderHook(() => useYearFilter());
    expect(result.current.yearFilter).toBe(PAST_YEAR);
  });

  it("reads 'all' from localStorage", () => {
    localStorage.setItem("year-filter", "all");
    const { result } = renderHook(() => useYearFilter());
    expect(result.current.yearFilter).toBe("all");
  });

  it("reads 'upcoming' from localStorage", () => {
    localStorage.setItem("year-filter", "upcoming");
    const { result } = renderHook(() => useYearFilter());
    expect(result.current.yearFilter).toBe("upcoming");
  });

  it.each(["banana", "", "null"])("falls back to current year for invalid value: %s", (invalid) => {
    localStorage.setItem("year-filter", invalid);
    const { result } = renderHook(() => useYearFilter());
    expect(result.current.yearFilter).toBe(Y);
  });

  it("setYearFilter updates state and persists to localStorage", () => {
    const { result } = renderHook(() => useYearFilter());
    act(() => result.current.setYearFilter("all"));
    expect(result.current.yearFilter).toBe("all");
    expect(localStorage.getItem("year-filter")).toBe("all");
  });

  it("localStorage written by setYearFilter can be read back as the correct type", () => {
    const { result } = renderHook(() => useYearFilter());
    act(() => result.current.setYearFilter(PAST_YEAR));
    // Simulate a fresh hook mount reading localStorage
    const { result: result2 } = renderHook(() => useYearFilter());
    expect(result2.current.yearFilter).toBe(PAST_YEAR);
  });
});
