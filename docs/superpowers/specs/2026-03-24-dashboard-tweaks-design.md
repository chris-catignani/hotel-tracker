# Dashboard Tweaks — Design Spec

**Issue:** #301
**Date:** 2026-03-24

## Overview

Four changes to the dashboard:

1. Sort the Savings Breakdown section ascending (least → most savings)
2. New widget: Price Distribution (bar chart by cost-per-night bucket)
3. New widget: Monthly Travel Pattern (bar chart by calendar month)
4. New widget: Geo Distribution (ranked list by country or city)

---

## 1. Savings Breakdown Sort

**File:** `src/app/page.tsx`

Sort the `items` array ascending by `value` before rendering, so the largest bar is always at the bottom. The sort is on a copy; the "Total Savings" footer row stays pinned at the bottom regardless.

```ts
const sortedItems = [...items].sort((a, b) => a.value - b.value);
```

`maxValue` is computed from values (not position), so sorting does not affect bar widths.
Zero-value items remain visible (bar renders at 0 width), preserving all category labels.

---

## 2. Price Distribution Widget

**New file:** `src/components/price-distribution.tsx`

### Props

```ts
interface PriceDistributionProps {
  bookings: BookingWithRelations[];
}
```

The component receives the full `BookingWithRelations` type (imported from `page.tsx` or moved to a shared types file) so it can call `calculateNetCost(booking)` directly. A minimal prop slice is insufficient because `calculateNetCost` requires a large set of booking fields.

### Buckets

Fixed $50 intervals: `$0–50`, `$50–100`, `$100–150`, `$150–200`, `$200–250`, `$250+`

### Toggles

- **Metric:** `Net/Night` | `Total/Night` (default: `Net/Night`)
- **Mode:** `Stays` | `Nights` (default: `Stays`)

### Calculation

**Net/Night:**

- Value: `calculateNetCost(booking) / booking.numNights`
- Scope: all bookings. `calculateNetCost` already folds in `pointsRedeemedValue` and `certsValue` for award stays, so they produce a meaningful (typically positive) dollar value.
- Edge case: if the result is `< 0` (unusual — would require loyalty points earned back to exceed redemption cost), clamp to `$0` and place in the `$0–50` bucket.

**Total/Night:**

- Value: the booking's gross dollar cost per night, including award stays via their redemption value:
  - Cash stays (`totalCost > 0`): `(Number(totalCost) * (Number(lockedExchangeRate) || 1)) / numNights`
  - Award stays (`totalCost === 0`): `(pointsRedeemedValue + certsValue) / numNights` — both values from `getNetCostBreakdown(booking)`, already in USD
- All bookings are included; none excluded.
- `lockedExchangeRate: null` (future non-USD cash bookings) falls back to `|| 1`, treating the foreign amount as USD. This is the same accepted compromise used throughout `page.tsx`.

**Stays mode:** increment the matching bucket by 1 per qualifying booking.
**Nights mode:** increment the matching bucket by `booking.numNights`.

### Chart

Recharts `BarChart` (already a project dependency). Single series, color `#3b82f6`. `XAxis` shows bucket labels, `YAxis` shows count, `Tooltip` shows count on hover. `ResponsiveContainer` at 100% width, fixed height (~160px).

### Empty state

Use `EmptyState` component when no qualifying bookings exist for the selected metric.

### `data-testid`

`data-testid="price-distribution-card"` on the outer `<Card>`.

---

## 3. Monthly Travel Pattern Widget

**New file:** `src/components/monthly-travel-pattern.tsx`

### Props

```ts
interface MonthlyTravelPatternProps {
  bookings: BookingWithRelations[];
}
```

Uses only `booking.checkIn` (string) and `booking.numNights`. Full type passed for consistency.

### Behaviour

Always renders all 12 months (Jan–Dec), even when count is 0. Zero-count months show a bar at 0 height — this is intentional, not an empty state. The empty state is shown only when `bookings.length === 0`.

Uses the booking's **check-in month** to assign each booking (not spread across months).

### Toggle

- **Mode:** `Stays` | `Nights` (default: `Stays`)

### Calculation

- **Stays:** count bookings per check-in month.
- **Nights:** sum `numNights` per check-in month.

Month index (0–11) is derived as `parseInt(booking.checkIn.slice(5, 7)) - 1`. Do not use `new Date(checkIn)` for month parsing — it is ambiguous in timezones west of UTC and can assign the booking to the wrong month.

### Chart

Recharts `BarChart`, color `#10b981`. 12 fixed bars (Jan–Dec). `Tooltip` shows full month name + count.

### `data-testid`

`data-testid="monthly-travel-pattern-card"` on the outer `<Card>`.

---

## 4. Geo Distribution Widget

**New file:** `src/components/geo-distribution.tsx`

### Props

```ts
interface GeoDistributionProps {
  bookings: BookingWithRelations[];
}
```

### Type change in `page.tsx`

Add `countryCode: string | null` and `city: string | null` to the `property` shape in `BookingWithRelations`. The Prisma query in `src/app/api/bookings/route.ts` uses `property: true` (confirmed — line 66), which selects all scalar fields. `countryCode` and `city` are already present in the API response at runtime — only the TypeScript type in `BookingWithRelations` needs updating.

### Toggle

- **View:** `Country` | `City` (default: `Country`)

### Calculation

- **Country:** group by `property.countryCode`. Bookings with `null` countryCode are excluded.
- **City:** group by `property.city`. Bookings with `null` city are excluded.
- Count = number of stays (not nights). Sort descending. Show top 10.
- **Empty state:** triggered when the filtered (non-null) set is empty after grouping — not when `bookings.length === 0`. A user may have 50 bookings that all lack geo data.

### Display

Ranked list (no recharts needed): each row shows label, stay count, and a relative progress bar. Top entry = 100% bar width; others scale proportionally.

### `data-testid`

`data-testid="geo-distribution-card"` on the outer `<Card>`.

---

## 5. Dashboard Layout

**File:** `src/app/page.tsx`

Add all three new components to the existing `grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3` section, after the existing widgets. Each takes 1 grid column.

Import at top of file:

```ts
import { PriceDistribution } from "@/components/price-distribution";
import { MonthlyTravelPattern } from "@/components/monthly-travel-pattern";
import { GeoDistribution } from "@/components/geo-distribution";
```

Pass `filteredBookings` to all three.

---

## 6. Testing

### Unit tests (Vitest / RTL)

**`price-distribution.test.tsx`**

- Correct bucket assignment for Net/Night (positive value)
- Negative net cost clamped to $0–50 bucket
- Award stays ($0 totalCost) included in Total/Night metric via redemption value (`pointsRedeemedValue + certsValue`)
- Nights mode sums correctly
- Empty state renders when no qualifying bookings

**`monthly-travel-pattern.test.tsx`**

- All 12 months always render (even with 0 count)
- Stays count correct per month
- Nights mode sums `numNights` per month
- Empty state renders when `bookings.length === 0`

**`geo-distribution.test.tsx`**

- Country grouping correct
- City grouping correct
- Null `countryCode`/`city` entries excluded
- Top-10 cap enforced
- Empty state renders when all entries have null geo data

### E2E (Playwright)

Add to existing `e2e/dashboard.spec.ts` or a new `e2e/dashboard-widgets.spec.ts`.

Pattern: use `isolatedUser` fixture; create at least one booking via `isolatedUser.request.post("/api/bookings", ...)` with enough fields to populate each widget (e.g. a hotel booking with countryCode set); navigate to `/`; assert each card `data-testid` is visible; delete booking in `finally` block.

Assertions:

- `data-testid="price-distribution-card"` is visible and contains at least one bar label (e.g. a bucket label like "$0–50")
- `data-testid="monthly-travel-pattern-card"` is visible and shows month labels
- `data-testid="geo-distribution-card"` is visible and shows at least one country/city row
