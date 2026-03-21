# Year Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared year filter dropdown to the Dashboard and Bookings pages, defaulting to the current year, with an "Upcoming" option for current-year future bookings.

**Architecture:** A new `useYearFilter` hook in `src/hooks/` owns all state, localStorage persistence, and filtering logic. Both `src/app/page.tsx` (Dashboard) and `src/app/bookings/page.tsx` (Bookings) import the hook and a `buildYearOptions` utility; filtering is applied client-side with no API changes. On the Dashboard, year filter runs first, then the existing accommodation filter applies to that result.

**Tech Stack:** Next.js 16 App Router (`"use client"`), React hooks, shadcn/ui `Select`, Vitest + `@testing-library/react` (unit), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-03-21-year-filter-design.md`

---

## File Map

| File                                | Action     | Purpose                                                                   |
| ----------------------------------- | ---------- | ------------------------------------------------------------------------- |
| `src/hooks/use-year-filter.ts`      | **Create** | Hook + `buildYearOptions` utility                                         |
| `src/hooks/use-year-filter.test.ts` | **Create** | Unit tests for hook and utility                                           |
| `src/app/page.tsx`                  | **Modify** | Dashboard: add year Select, fix filter composition, fix Savings Breakdown |
| `src/app/bookings/page.tsx`         | **Modify** | Bookings: add year Select, filter list                                    |
| `e2e/fixtures.ts`                   | **Modify** | Add `pastYearBooking` fixture                                             |
| `e2e/year-filter.spec.ts`           | **Create** | E2E tests for year filter feature                                         |

---

## Task 1: Stub hook so tests can import it

**Files:**

- Create: `src/hooks/use-year-filter.ts`

- [ ] **Step 1: Create a stub file with the correct exports but no logic**

```ts
// src/hooks/use-year-filter.ts
"use client";

import { useState, useCallback } from "react";

export type YearFilter = number | "all" | "upcoming";

export interface YearOption {
  value: YearFilter;
  label: string;
}

export function buildYearOptions<T extends { checkOut: string }>(_bookings: T[]): YearOption[] {
  throw new Error("not implemented");
}

export function useYearFilter() {
  const [yearFilter] = useState<YearFilter>(0); // placeholder
  const setYearFilter = useCallback((_filter: YearFilter) => {}, []);
  const filterBookings = useCallback(
    <T extends { checkOut: string }>(bookings: T[]): T[] => bookings,
    []
  );
  return { yearFilter, setYearFilter, filterBookings };
}
```

- [ ] **Step 2: Confirm it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

---

## Task 2: Write failing unit tests

**Files:**

- Create: `src/hooks/use-year-filter.test.ts`

- [ ] **Step 1: Write the full test file**

```ts
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
```

- [ ] **Step 2: Run tests — expect them to FAIL (red phase)**

```bash
npm test -- use-year-filter
```

Expected: tests fail because `buildYearOptions` throws `"not implemented"` and the stub `useYearFilter` returns `yearFilter = 0` (not current year)

---

## Task 3: Implement the hook to make tests pass

**Files:**

- Modify: `src/hooks/use-year-filter.ts`

- [ ] **Step 1: Replace the stub with the real implementation**

```ts
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
    { value: "upcoming", label: `${currentYear} — Upcoming` },
    { value: "all", label: "All Years" },
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
```

- [ ] **Step 2: Run tests — all must PASS (green phase)**

```bash
npm test -- use-year-filter
```

Expected: all tests green

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all green

- [ ] **Step 4: TS check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-year-filter.ts src/hooks/use-year-filter.test.ts
git commit -m "feat: add useYearFilter hook and unit tests (#262)"
```

---

## Task 4: Wire year filter into the Dashboard

**Files:**

- Modify: `src/app/page.tsx`

Four separate changes, each with its own verify step.

### 4a — Fix filter composition (year filter before accommodation)

- [ ] **Step 1: Add imports at the top of `src/app/page.tsx`**

After the last existing import line, add:

```ts
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useYearFilter, buildYearOptions, type YearFilter } from "@/hooks/use-year-filter";
```

- [ ] **Step 2: Add hook call inside `DashboardPage`**

Directly after the existing `useState` declarations (after the `sortConfig` state, around line 206), add:

```ts
const { yearFilter, setYearFilter, filterBookings: filterByYear } = useYearFilter();
```

- [ ] **Step 3: Fix filter composition**

Find the existing `filteredBookings` useMemo (currently filters by accommodation only). Replace it with two memos:

```ts
// Year filter applied first on raw bookings (before accommodation filter)
const yearFilteredBookings = useMemo(() => filterByYear(bookings), [bookings, filterByYear]);

// Accommodation filter applied second
const filteredBookings = useMemo(() => {
  if (accommodationFilter === "all") return yearFilteredBookings;
  return yearFilteredBookings.filter((bk) => bk.accommodationType === accommodationFilter);
}, [yearFilteredBookings, accommodationFilter]);
```

Also update `hasApartments`, `hasHotels` (which drive the accommodation toggle visibility) to use `yearFilteredBookings` so the toggle only shows when the current year actually has both types:

```ts
const hasApartments = yearFilteredBookings.some((b) => b.accommodationType === "apartment");
const hasHotels = yearFilteredBookings.some((b) => b.accommodationType === "hotel");
```

And update the `bookingBreakdown`/`nightsBreakdown` memo to use `yearFilteredBookings` (the "All" view sub-labels should reflect the year):

```ts
const { bookingBreakdown, nightsBreakdown } = useMemo(() => {
  if (!showFilter) return { bookingBreakdown: undefined, nightsBreakdown: undefined };
  const counts = yearFilteredBookings.reduce(   // ← was: bookings
    ...
  );
  ...
}, [yearFilteredBookings, showFilter]);   // ← was: [bookings, showFilter]
```

- [ ] **Step 4: Verify TS + tests still pass**

```bash
npx tsc --noEmit && npm test
```

Expected: no errors, all tests green

### 4b — Fix Savings Breakdown to use `filteredBookings`

- [ ] **Step 5: Fix Savings Breakdown**

In the Savings Breakdown card (inside `CardContent`, around line 563), find:

```ts
const totals = bookings.reduce(
```

Change to:

```ts
const totals = filteredBookings.reduce(
```

This is the only place in that section that reads raw `bookings` instead of `filteredBookings`.

- [ ] **Step 6: Verify TS + tests still pass**

```bash
npx tsc --noEmit && npm test
```

Expected: no errors, all tests green

### 4c — Add year Select to the UI

- [ ] **Step 7: Add `buildYearOptions` memo**

After the `filteredBookings` useMemo, add:

```ts
const yearOptions = useMemo(() => buildYearOptions(bookings), [bookings]);
```

- [ ] **Step 8: Replace the top-right controls area**

Find the current top-right controls block (around line 404):

```tsx
{
  showFilter && <div className="flex shrink-0 rounded-lg border p-0.5 gap-0.5">...</div>;
}
```

Replace it with a wrapper that always shows the year Select and conditionally shows the accommodation toggle:

```tsx
<div className="flex shrink-0 flex-wrap gap-2 items-center justify-end">
  <Select
    value={String(yearFilter)}
    onValueChange={(val) => {
      if (val === "all" || val === "upcoming") {
        setYearFilter(val as YearFilter);
      } else {
        setYearFilter(parseInt(val, 10));
      }
    }}
  >
    <SelectTrigger className="w-40" data-testid="year-filter-select">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {yearOptions.map((opt) => (
        <SelectItem key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {showFilter && (
    <div className="flex shrink-0 rounded-lg border p-0.5 gap-0.5">
      {(["all", "hotel", "apartment"] as const).map((f) => (
        <button
          key={f}
          onClick={() => handleFilterChange(f)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            accommodationFilter === f
              ? "bg-background shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
          data-testid={`dashboard-filter-${f}`}
        >
          {f === "all" ? "All" : f === "hotel" ? "Hotels" : "Apartments"}
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 9: Full verify**

```bash
npx tsc --noEmit && npm run lint && npm test
```

Expected: no errors, all tests green

- [ ] **Step 10: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add year filter to Dashboard (#262)"
```

---

## Task 5: Wire year filter into the Bookings page

**Files:**

- Modify: `src/app/bookings/page.tsx`

- [ ] **Step 1: Add imports**

After the existing imports, add:

```ts
import { useMemo } from "react"; // add to existing react import line
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useYearFilter, buildYearOptions, type YearFilter } from "@/hooks/use-year-filter";
```

Note: `useMemo` must be added to the existing `import { useEffect, useState, useCallback } from "react"` line — not as a separate import.

- [ ] **Step 2: Add hook call and derived state**

After the existing `useState` declarations (around line 124), add:

```ts
const { yearFilter, setYearFilter, filterBookings: filterByYear } = useYearFilter();

const yearOptions = useMemo(() => buildYearOptions(bookings), [bookings]);
const filteredBookings = useMemo(() => filterByYear(bookings), [bookings, filterByYear]);
```

- [ ] **Step 3: Replace the header row**

Find (around line 160):

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold">Bookings</h1>
  <Link href="/bookings/new">
    <Button>Add Booking</Button>
  </Link>
</div>
```

Replace with:

```tsx
<div className="flex flex-wrap items-center justify-between gap-2">
  <h1 className="text-2xl font-bold">Bookings</h1>
  <div className="flex items-center gap-2">
    <Select
      value={String(yearFilter)}
      onValueChange={(val) => {
        if (val === "all" || val === "upcoming") {
          setYearFilter(val as YearFilter);
        } else {
          setYearFilter(parseInt(val, 10));
        }
      }}
    >
      <SelectTrigger className="w-40" data-testid="year-filter-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {yearOptions.map((opt) => (
          <SelectItem key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Link href="/bookings/new">
      <Button>Add Booking</Button>
    </Link>
  </div>
</div>
```

- [ ] **Step 4: Swap `bookings` → `filteredBookings` in the render and add year-filtered empty state**

The rendering logic currently is:

```tsx
) : bookings.length === 0 ? (
  <EmptyState ... />
) : (
  <>
    {/* mobile cards */}
    {bookings.map(...)}
    {/* desktop table */}
    {bookings.map(...)}
  </>
```

Change to:

```tsx
) : bookings.length === 0 ? (
  <EmptyState
    icon={CalendarDays}
    title="No bookings found"
    description="You haven't added any bookings yet. Start by adding your first hotel stay."
    action={{ label: "Add Booking", href: "/bookings/new" }}
    data-testid="bookings-empty"
  />
) : filteredBookings.length === 0 ? (
  <EmptyState
    icon={CalendarDays}
    title="No bookings for this period"
    description="No bookings found for the selected year. Try selecting a different year."
    data-testid="bookings-empty-year-filter"
  />
) : (
  <>
    {/* mobile cards */}
    {filteredBookings.map(...)}   {/* ← was bookings.map */}
    {/* desktop table */}
    {filteredBookings.map(...)}   {/* ← was bookings.map */}
  </>
```

- [ ] **Step 5: Full verify**

```bash
npx tsc --noEmit && npm run lint && npm test
```

Expected: no errors, all tests green

- [ ] **Step 6: Commit**

```bash
git add src/app/bookings/page.tsx
git commit -m "feat: add year filter to Bookings page (#262)"
```

---

## Task 6: E2E tests

**Files:**

- Modify: `e2e/fixtures.ts` — add `pastYearBooking` fixture
- Create: `e2e/year-filter.spec.ts`

- [ ] **Step 1: Add `pastYearBooking` to `TestFixtures` type in `e2e/fixtures.ts`**

In the `type TestFixtures` block, add:

```ts
pastYearBooking: {
  id: string;
  propertyName: string;
}
```

- [ ] **Step 2: Implement the fixture in `test.extend`**

After the `apartmentBooking` fixture, add:

```ts
pastYearBooking: async ({ request }, use) => {
  const chains = await request.get("/api/hotel-chains");
  const chain = (await chains.json())[0];

  // Use a firmly past year (current - 1) with explicit YYYY-MM-DD dates
  const pastYear = new Date().getFullYear() - 1;
  const uniqueName = `Test Past Year Hotel ${crypto.randomUUID()}`;
  const res = await request.post("/api/bookings", {
    data: {
      hotelChainId: chain.id,
      propertyName: uniqueName,
      checkIn: `${pastYear}-06-01`,
      checkOut: `${pastYear}-06-05`,
      numNights: 4,
      pretaxCost: 400,
      taxAmount: 40,
      totalCost: 440,
      currency: "USD",
      bookingSource: "direct_web",
      countryCode: "US",
      city: "Chicago",
    },
  });
  const booking = await res.json();
  await use({ id: booking.id, propertyName: uniqueName });
  await request.delete(`/api/bookings/${booking.id}`);
},
```

- [ ] **Step 3: Create `e2e/year-filter.spec.ts`**

```ts
// e2e/year-filter.spec.ts
import { test, expect } from "./fixtures";

const CURRENT_YEAR = new Date().getFullYear();
const PAST_YEAR = CURRENT_YEAR - 1;

test.describe("Year filter — Dashboard", () => {
  test("year selector is visible and defaults to current year", async ({
    page,
    pastYearBooking: _,
  }) => {
    await page.goto("/");
    const trigger = page.getByTestId("year-filter-select");
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText(String(CURRENT_YEAR));
  });

  test("selecting past year changes the displayed year in the selector", async ({
    page,
    pastYearBooking: _,
  }) => {
    await page.goto("/");

    await page.getByTestId("year-filter-select").click();
    await page.getByRole("option", { name: String(PAST_YEAR) }).click();

    await expect(page.getByTestId("year-filter-select")).toContainText(String(PAST_YEAR));
    // Accommodation summary table is still rendered (no crash)
    await expect(page.getByTestId("hotel-chain-summary-desktop")).toBeVisible();
  });

  test("Upcoming option: today's checkout booking is shown (>= boundary)", async ({
    page,
    request,
  }) => {
    // Create a booking checking out TODAY
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];
    const today = new Date().toISOString().slice(0, 10);
    const nights = 1;
    const checkIn = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const propertyName = `Today Checkout Test ${Math.random()}`;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn,
        checkOut: today,
        numNights: nights,
        pretaxCost: 100,
        taxAmount: 10,
        totalCost: 110,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Boston",
      },
    });
    const booking = await res.json();

    try {
      await page.goto("/");

      // Select Upcoming
      await page.getByTestId("year-filter-select").click();
      await page.getByRole("option", { name: `${CURRENT_YEAR} — Upcoming` }).click();

      // The today-checkout booking should appear in the Upcoming Bookings card
      const bookingRow = page.getByTestId(`booking-row-${booking.id}`);
      await expect(bookingRow).toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("year filter and accommodation filter work simultaneously", async ({
    page,
    pastYearBooking: _,
  }) => {
    await page.goto("/");

    // Select past year
    await page.getByTestId("year-filter-select").click();
    await page.getByRole("option", { name: String(PAST_YEAR) }).click();

    // If accommodation filter is visible, click Hotels — page should not crash
    const hotelsBtn = page.getByTestId("dashboard-filter-hotel");
    if (await hotelsBtn.isVisible()) {
      await hotelsBtn.click();
      await expect(page.getByTestId("hotel-chain-summary-desktop")).toBeVisible();
    }

    // Selector still shows past year
    await expect(page.getByTestId("year-filter-select")).toContainText(String(PAST_YEAR));
  });
});

test.describe("Year filter — Bookings", () => {
  test("year selector is visible on Bookings page", async ({ page, pastYearBooking: _ }) => {
    await page.goto("/bookings");
    await expect(page.getByTestId("year-filter-select")).toBeVisible();
  });

  test("selecting past year shows past-year booking in list", async ({ page, pastYearBooking }) => {
    await page.goto("/bookings");

    await page.getByTestId("year-filter-select").click();
    await page.getByRole("option", { name: String(PAST_YEAR) }).click();

    await expect(page.getByTestId(`booking-row-${pastYearBooking.id}`)).toBeVisible();
  });

  test("selecting current year hides past-year booking", async ({ page, pastYearBooking }) => {
    await page.goto("/bookings");

    // Explicitly select current year (it should be the default, but set it explicitly)
    await page.getByTestId("year-filter-select").click();
    await page.getByRole("option", { name: String(CURRENT_YEAR) }).click();

    await expect(page.getByTestId(`booking-row-${pastYearBooking.id}`)).not.toBeVisible();
  });
});

test.describe("Year filter — Persistence", () => {
  test("year selection persists when navigating from Dashboard to Bookings via sidebar", async ({
    page,
    pastYearBooking: _,
  }) => {
    await page.goto("/");

    // Set past year on Dashboard
    await page.getByTestId("year-filter-select").click();
    await page.getByRole("option", { name: String(PAST_YEAR) }).click();
    await expect(page.getByTestId("year-filter-select")).toContainText(String(PAST_YEAR));

    // Navigate to Bookings via sidebar link (no page reload)
    await page.getByRole("link", { name: "Bookings" }).first().click();
    await page.waitForURL("/bookings");

    // Year filter should still be past year
    await expect(page.getByTestId("year-filter-select")).toContainText(String(PAST_YEAR));
  });
});
```

- [ ] **Step 4: Run the E2E tests**

```bash
npm run test:e2e -- --grep "Year filter"
```

Expected: all year-filter tests pass

- [ ] **Step 5: Run full test suite**

```bash
npm test && npm run test:e2e
```

Expected: all green

- [ ] **Step 6: Final lint + TS check**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add e2e/fixtures.ts e2e/year-filter.spec.ts
git commit -m "test: add E2E tests for year filter (#262)"
```

---

## Done

All tasks complete. Open a PR referencing issue #262.
