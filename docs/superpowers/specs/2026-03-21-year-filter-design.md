# Year Filter — Design Spec

**Date:** 2026-03-21
**Issue:** [#262 — Add year select](https://github.com/chris-catignani/hotel-tracker/issues/262)

---

## Overview

Add a year filter dropdown to the Dashboard and Bookings pages so users can view data for a specific year. Includes a "Upcoming" option that shows only current-year future bookings.

---

## Decisions

| Question                       | Decision                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Default selection              | Current year (e.g. 2026)                                                     |
| Year determined by             | `checkOut` date                                                              |
| "Upcoming" scope               | Current year AND `checkOut >= today`                                         |
| Filter persistence             | Shared localStorage key `year-filter`, shared between Dashboard and Bookings |
| Implementation                 | Client-side filtering — no API changes                                       |
| Dropdown placement — Dashboard | `Select` to the left of the All/Hotels/Apartments toggle                     |
| Dropdown placement — Bookings  | `Select` between the page title and Add Booking button                       |

---

## Shared Hook — `src/hooks/use-year-filter.ts`

```ts
type YearFilter = number | "all" | "upcoming";
```

**Responsibilities:**

- Reads/writes `year-filter` from localStorage
- Defaults to the current calendar year on first visit
- Exposes `yearFilter`, `setYearFilter`, and `filterBookings(bookings[])` utility
- Derives available year options from booking data

**Filtering rules:**

- `"all"` → return all bookings unchanged
- `number` (e.g. `2026`) → return bookings where `checkOut.slice(0, 4) === String(year)`
- `"upcoming"` → return bookings where `checkOut >= today` AND `checkOut` year === current year

**Year dropdown options** (built from booking data):

1. `{ value: "upcoming", label: "2026 — Upcoming" }` — always first
2. `{ value: "all", label: "All Years" }`
3. One entry per unique checkout year in the data, descending (e.g. `2026`, `2025`, `2024`)

Years with no bookings are excluded automatically.

---

## UI Changes

### Dashboard (`src/app/page.tsx`)

- Add a shadcn `Select` (width `w-40`) to the top-right controls area, left of the accommodation toggle
- On desktop: `[2026 ▾]  [All | Hotels | Apartments]`
- On mobile: controls wrap — year selector and accommodation toggle stack on a second line (`flex-wrap` added to the container)
- Apply `filterBookings()` to produce `filteredBookings`; all stats, charts, accommodation summary, and the Savings Breakdown card consume `filteredBookings`
- **Note:** Savings Breakdown currently uses the raw `bookings` array — must be updated to use `filteredBookings`
- Upcoming Bookings card continues to show `checkOut >= today` from `filteredBookings` (existing empty state handles no results gracefully)

### Bookings Page (`src/app/bookings/page.tsx`)

- Add the same `Select` to the header row between the `h1` and the Add Booking button
- On mobile: header row gets `flex-wrap`; selector is compact enough (`w-40`) to fit alongside the button on most screens, wrapping as needed
- Apply `filterBookings()` to the fetched bookings before rendering

---

## No API Changes

Both pages continue to call `GET /api/bookings` with no query params. All filtering is client-side.

---

## Testing

### Unit Tests (`src/hooks/use-year-filter.test.ts`)

- `filterBookings("all")` returns all bookings
- `filterBookings(2026)` returns only bookings with `checkOut` year 2026
- `filterBookings("upcoming")` returns current-year bookings with `checkOut >= today`
- Year options derived correctly: sorted descending, no duplicates, "Upcoming" and "All Years" prepended
- Default is current year

### E2E Tests (Playwright)

- Dashboard: year selector is visible
- Dashboard: selecting a past year updates stats and accommodation summary
- Dashboard: `"2026 — Upcoming"` option shows only future current-year bookings
- Bookings page: year selector is visible and filtering works
- Year selection persists when navigating between Dashboard and Bookings

---

## Out of Scope

- Promotions page — not mentioned in the issue; can be added later
- "All Upcoming" option (future bookings across all years) — deferred; can be added later if needed
- API-side filtering — not needed at this scale
