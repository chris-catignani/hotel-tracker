# Year Filter — Design Spec

**Date:** 2026-03-21
**Issue:** [#262 — Add year select](https://github.com/chris-catignani/hotel-tracker/issues/262)

---

## Overview

Add a year filter dropdown to the Dashboard and Bookings pages. Includes an "Upcoming" option for current-year future bookings.

---

## Decisions

| Question            | Decision                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Default selection   | Current year                                                                                                         |
| Year determined by  | `checkOut` date                                                                                                      |
| "Upcoming" scope    | Current year AND `checkOut >= today` (normalized to `YYYY-MM-DD`; inclusive — a booking checking out today is shown) |
| Persistence         | Shared localStorage key `year-filter`                                                                                |
| Implementation      | Client-side filtering                                                                                                |
| Dashboard placement | `Select` (`w-40`) left of All/Hotels/Apartments toggle                                                               |
| Bookings placement  | `Select` (`w-40`) between page title and Add Booking button                                                          |

---

## Module — `src/hooks/use-year-filter.ts`

### Types

```ts
type YearFilter = number | "all" | "upcoming";
interface YearOption {
  value: YearFilter;
  label: string;
}
```

### Exports

1. **`buildYearOptions<T extends { checkOut: string }>(bookings: T[]): YearOption[]`** — pure utility, exported directly from the module (not from the hook). `currentYear` is computed internally via `new Date().getFullYear()`. Must always be called with the raw unfiltered bookings array by convention — passing a filtered array will silently produce an incomplete year list (this is the caller's responsibility, not enforced by types).

2. **`useYearFilter()` hook** — returns `{ yearFilter, setYearFilter, filterBookings }` where `filterBookings<T extends { checkOut: string }>(bookings: T[]): T[]` closes over the current `yearFilter`.

### Hook behavior

- Reads localStorage `year-filter` on mount; defaults to current year if absent or invalid
- **Invalid** means the stored string cannot be parsed as a finite integer, `"all"`, or `"upcoming"`. Any integer year — past, current, or future — is valid even if no bookings exist for that year.
- `setYearFilter` writes to localStorage immediately

### localStorage and multi-user

The `year-filter` key is not user-scoped. If two users share a browser, one user's filter persists for the next. This is an accepted limitation — the accommodation filter (`dashboard-accommodation-filter`) follows the same pattern.

### Date normalization

`.slice(0, 10)` normalizes ISO timestamps to `YYYY-MM-DD`. `today = new Date().toISOString().slice(0, 10)`.

### Filtering rules

- `"all"` → return all bookings
- `number` (e.g. `2026`) → `checkOut.slice(0, 4) === String(year)`
- `"upcoming"` → `checkOut.slice(0, 10) >= today` (inclusive) AND `checkOut.slice(0, 4) === String(currentYear)`

`currentYear` in the hook's `filterBookings` = `new Date().getFullYear()` at call time (never cached).

**Cross-year edge case:** Next-year checkouts are intentionally excluded from "Upcoming" even if their `checkOut >= today`.

### `buildYearOptions` output

Always in this order:

1. `{ value: "upcoming", label: "${currentYear} — Upcoming" }` — e.g. `"2026 — Upcoming"`, computed dynamically
2. `{ value: "all", label: "All Years" }`
3. Unique checkout years descending, one entry per year

"Upcoming" and "All Years" are always present even when `bookings` is empty.

---

## UI Changes

### Dashboard (`src/app/page.tsx`)

**Filter composition order:**

1. `buildYearOptions(bookings)` on raw `bookings` state
2. `yearFilteredBookings = filterBookings(bookings)` — year filter first
3. `filteredBookings` = accommodation filter applied to `yearFilteredBookings` (existing logic, unchanged)

**Layout:** `Select` (`w-40`) left of the accommodation toggle; container gets `flex-wrap` (no explicit breakpoint — wraps naturally).

**Widget wiring:** All widgets use `filteredBookings` (year + accommodation filtered). This includes the **Savings Breakdown card**, which currently reads raw `bookings` directly and must be updated to `filteredBookings`.

**Upcoming Bookings card:** Shows `checkOut >= today` from `filteredBookings`. Empty for past-year selections — intentional; existing empty state handles it gracefully.

### Bookings Page (`src/app/bookings/page.tsx`)

- `buildYearOptions` on raw fetched `bookings`
- `Select` (`w-40`) between `h1` and Add Booking button
- Header row gets `flex-wrap` (no explicit breakpoint)
- Apply `filterBookings()` before rendering the list

---

## No API Changes

Both pages continue to call `GET /api/bookings` with no query params.

---

## Testing

### Unit Tests (`src/hooks/use-year-filter.test.ts`)

**`filterBookings`:**

- `"all"` → all bookings returned
- `2026` → only bookings with `checkOut` year 2026
- `"upcoming"` → includes current-year booking with `checkOut === today` (boundary: `>=` is inclusive)
- `"upcoming"` → includes current-year booking with `checkOut > today`
- `"upcoming"` → excludes current-year booking with `checkOut < today`
- `"upcoming"` → excludes next-year booking with `checkOut > today`

**`buildYearOptions`:**

- Complete ordered array: index 0 = Upcoming (label contains current year), index 1 = "All Years", then descending year entries — asserted as a full array, not individual elements
- Deduplicates years (two 2026 bookings → one 2026 entry)
- Empty input → exactly `[Upcoming, "All Years"]`, nothing else

**`useYearFilter` hook:**

- Default = current year when localStorage is empty
- Invalid values (`"banana"`, `""`, `"null"`) fall back to current year
- Valid values (`"all"`, `"upcoming"`, `2025`) are accepted as-is

Invalid localStorage fallback is covered by unit tests only; no E2E test needed.

### E2E Tests (Playwright)

**Test data:** Create a booking with `checkOut` in a past calendar year via `POST /api/bookings` directly (consistent with the project's E2E fixture pattern — never via UI navigation).

- Dashboard: year selector visible on load; displayed value is the current year
- Dashboard: selecting the past year updates the stats and accommodation summary (verified by observing stat value changes)
- Dashboard: selecting "Upcoming" shows only current-year future bookings
- Dashboard: year filter and accommodation filter work correctly when both are active simultaneously
- Bookings page: year selector visible; selecting the past year changes the displayed booking list
- Persistence: select the past year on Dashboard, then navigate to Bookings via the sidebar nav link (no page reload); the year selector on Bookings shows the same past year

---

## Out of Scope

- Promotions page — not mentioned in the issue; can be added later
- "All Upcoming" option (future bookings across all years) — deferred
- API-side filtering — not needed at this scale
