# Design: Issue #286 — Exchange Rate Tests + Follow-ups

## Scope

Three tests from the original issue body, plus three follow-up improvements:

1. **Tests** — unit tests for exchange rate fallback, bookings page error handling, dashboard error handling
2. **Exchange rate estimated indicator** — surface the fallback to the user in the UI (no DB change)
3. **Better error messages** — add the attempted URL to `fetchExchangeRate`'s logger params
4. **Sentry user context** — call `Sentry.setUser()` from the auth session

---

## Part 1: Tests

### `src/lib/exchange-rate.test.ts` (addition)

Add one missing case to the existing `getOrFetchHistoricalRate` describe block:

- **"returns null when the API fails and no current rate is cached"** — both the external API and `getCurrentRate` return nothing. Verifies the function returns `null` rather than throwing.

The existing test "falls back to current cached rate when the API fails" (line 164) already covers the non-null current-rate path.

### `src/app/bookings/page.test.tsx` (new file)

Mock `global.fetch`. Single test asserting:

- `ErrorBanner` (`data-testid="error-banner"`) is rendered when `GET /api/bookings` returns non-ok
- No booking rows are present: `expect(screen.queryAllByTestId(/^booking-row-/)).toHaveLength(0)`

When fetch fails, `bookings` stays `[]` and `fetchError` is set. The page renders `ErrorBanner` AND `EmptyState` simultaneously (since `bookings.length === 0` after the error). No heavy mocks needed — neither component uses recharts.

### `src/app/page.test.tsx` (new file)

Same pattern as bookings page test, with two additions:

- Mock `PaymentTypeBreakdown` and `SubBrandBreakdown` directly (both use recharts, both render with empty bookings after fetch error)
- Assert `ErrorBanner` is shown

---

## Part 2: Exchange Rate Estimated Indicator

### Goal

Show a warning indicator on cost values when `lockedExchangeRate` was set from the current rate as a fallback (e.g., a 3-year-old booking where the historical API has no data) rather than the actual historical rate.

### Root cause fix: switch locking paths to `getOrFetchHistoricalRate`

The three rate-locking paths currently call `fetchExchangeRate` directly for the booking currency:

- `src/app/api/bookings/route.ts` line 185 (POST)
- `src/app/api/bookings/[id]/route.ts` line 282 (PUT)
- `src/app/api/cron/refresh-exchange-rates/route.ts` line 86 (cron)

These must be changed to call `getOrFetchHistoricalRate` instead. This has three effects:

1. **Cache check:** if the historical rate for that date was already fetched by another booking, it's reused without an API call.
2. **Cache write:** on a successful API fetch, the rate is written to `ExchangeRateHistory`. This is the signal the heuristic uses.
3. **Graceful fallback:** if the API fails (e.g., a date before the API's coverage range), `getCurrentRate()` is used instead of throwing. The cron currently catches and logs per-booking throws, so old bookings with unavailable rates will be successfully locked (with estimated rate) instead of perpetually skipped.

**Behavioral difference for same-day check-ins:** `getOrFetchHistoricalRate` uses `isPast = checkIn < today` (strictly less than), while the current locking paths use `checkIn <= today`. For today's check-in date, `getOrFetchHistoricalRate` returns `getCurrentRate()` rather than hitting the historical API — which is correct and more reliable.

**Loyalty program currency calls are NOT changed** (lines 245/383 in routes and line 111 in cron). Those set `lockedLoyaltyUsdCentsPerPoint`, not `lockedExchangeRate`, and are a separate concern.

**Import updates required:** In all three files, add `getOrFetchHistoricalRate` to the import from `@/lib/exchange-rate` (or `./exchange-rate`). Remove `fetchExchangeRate` from the import in files where it is no longer used after the switch (the cron uses `fetchExchangeRate` only for the booking currency lock — once switched, that import is unused and should be removed to avoid lint errors).

Also, **remove the inaccurate comment** from `fetchExchangeRate`:

```typescript
// Historical data available from approximately March 2024 onward.  ← REMOVE
```

We have two APIs; it's unclear which has the cutoff and it may not apply to both.

### Heuristic in `enrichBookingWithRate`

Once the locking paths write to `ExchangeRateHistory` on success (and skip on fallback), the detection logic is:

A booking's rate is considered estimated if ALL of:

1. `currency !== "USD"`
2. `lockedExchangeRate` is set (past booking, already locked)
3. No `ExchangeRateHistory` record for `checkIn` date
4. No `ExchangeRateHistory` record for `checkIn - 1 day`

Condition 4 distinguishes same-day check-ins from old-booking fallbacks:

- **Same-day check-in** (checkIn = today at lock time): `getOrFetchHistoricalRate` uses `getCurrentRate()`, so no `ExchangeRateHistory` for today. But `checkIn - 1 day` (yesterday) will have a record if any booking with that currency was locked historically — so the flag stays false. Correct: same-day rate is close enough.
- **Very old booking** (API has no coverage for checkIn or surrounding dates): neither `checkIn` nor `checkIn - 1` has a record → flagged. Correct.

**Accepted imprecision:** a same-day check-in for a currency with no prior history records will be falsely flagged. This is rare and acceptable since daily fluctuations are small.

**Implementation in `booking-enrichment.ts`:**

```typescript
// Requires: import prisma from "@/lib/prisma"
let exchangeRateEstimated = false;
if (isNonUsd && !isFuture && resolvedRate != null) {
  const checkInDate = booking.checkIn instanceof Date ? booking.checkIn : new Date(booking.checkIn);
  const dayBefore = new Date(checkInDate);
  dayBefore.setDate(dayBefore.getDate() - 1);

  const [historyOnDate, historyDayBefore] = await Promise.all([
    prisma.exchangeRateHistory.findUnique({
      where: {
        fromCurrency_toCurrency_date: {
          fromCurrency: booking.currency,
          toCurrency: "USD",
          date: checkInDate,
        },
      },
    }),
    prisma.exchangeRateHistory.findUnique({
      where: {
        fromCurrency_toCurrency_date: {
          fromCurrency: booking.currency,
          toCurrency: "USD",
          date: dayBefore,
        },
      },
    }),
  ]);

  exchangeRateEstimated = historyOnDate == null && historyDayBefore == null;
}
```

`booking-enrichment.ts` has no existing `import prisma` — this adds one.

**API routes:** No changes needed. `enrichBookingWithRate` returns `{ ...booking, exchangeRateEstimated, ... }` via spread, so the field appears automatically in the JSON response.

### UI changes

Wherever `isFutureEstimate` is shown, `exchangeRateEstimated` gets a parallel treatment. The booking detail page (`[id]/page.tsx`) uses inline text (no popover), while the list and card use a `<Popover>`.

- **`src/app/bookings/page.tsx`** — inside the existing non-USD cost `<PopoverContent>`, add a conditional line when `booking.exchangeRateEstimated` is true: `"Historical rate unavailable — estimated using current rate"`
- **`src/app/bookings/[id]/page.tsx`** — `isFutureEstimate ? " (est.)" : ""` appears twice (pretax cost and total cost). For each occurrence, add a new `<p>` element immediately after the existing cost line, conditionally rendered when `booking.exchangeRateEstimated` is true, with text "Historical rate unavailable — estimated using current rate". This matches the style of the existing explanatory text in the list/card popovers.
- **`src/components/bookings/booking-card.tsx`** — same as `bookings/page.tsx` (uses popover)
- **`src/app/page.tsx`** (dashboard) — out of scope; the dashboard's `BookingWithRelations` type doesn't include `isFutureEstimate` today and summary rows don't show per-booking cost detail

### Types

Add `exchangeRateEstimated?: boolean` to:

- `src/app/bookings/page.tsx` — the `Booking` interface
- `src/app/bookings/[id]/page.tsx` — the booking type used in that file
- `src/components/bookings/booking-card.tsx` — the intersection type in `BookingCardProps`: `NetCostBooking & { ...; isFutureEstimate?: boolean; exchangeRateEstimated?: boolean; ... }`

### Tests

**`src/lib/booking-enrichment.test.ts`** — add cases:

- Past non-USD, no history for checkIn or checkIn-1 → `exchangeRateEstimated = true`
- Past non-USD, history exists for checkIn-1 → `exchangeRateEstimated = false`
- Past non-USD, history exists for checkIn → `exchangeRateEstimated = false`
- USD booking → `exchangeRateEstimated = false`
- Future non-USD booking → `exchangeRateEstimated = false`

**Mock setup update:** `booking-enrichment.test.ts` mocks `./exchange-rate` but not `./prisma`. The new direct Prisma calls require a new `vi.mock("./prisma", ...)` block:

```typescript
vi.mock("./prisma", () => ({
  default: {
    exchangeRateHistory: { findUnique: vi.fn() },
  },
}));
```

All existing past-non-USD test cases (e.g., "past non-USD booking with stored rate") will now also trigger the two `exchangeRateHistory.findUnique` calls, since those bookings satisfy all three guard conditions (`isNonUsd && !isFuture && resolvedRate != null`). Before each such existing test, set the mock to return a non-null record (e.g., `{ rate: "0.65" }`) so `exchangeRateEstimated` stays `false` and existing assertions aren't broken. For new `exchangeRateEstimated = true` tests, return `null` for both calls.

**Note on fresh deployments:** With no `ExchangeRateHistory` rows yet, all past non-USD bookings will show as estimated until rates are fetched and cached. This is a known initial-state limitation, not a bug.

---

## Part 3: Better Error Messages in `fetchExchangeRate`

**Current logger call in `getOrFetchHistoricalRate`:**

```typescript
logger.warn("Exchange rate fetch failed, falling back to current cached rate", {
  fromCurrency,
  date,
  error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
});
```

**Goal:** add the last URL attempted to the logger params (not the message).

`primaryUrl` and `fallbackUrl` are local to `fetchExchangeRate`. The error thrown there is caught in `getOrFetchHistoricalRate`. Attach the URL as a property on the thrown `Error`:

```typescript
// In fetchExchangeRate, after the fallback also fails:
const err = new Error(`Exchange rate API error for ${fromCurrency}: ${res.status}`);
(err as Error & { url: string }).url = fallbackUrl;
throw err;
```

Then extract in the catch block:

```typescript
logger.warn("Exchange rate fetch failed, falling back to current cached rate", {
  fromCurrency,
  date,
  url: (err as Error & { url?: string }).url,
  error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
});
```

The `"Invalid rate returned for..."` throw path is explicitly out of scope.

---

## Part 4: Sentry User Context

**Goal:** `Sentry.setUser({ id })` so Sentry reports impacted users correctly.

**Approach:** A `"use client"` component that reads the Auth.js session and calls `Sentry.setUser`. Rendered once in the root layout inside `SessionProvider`.

```typescript
// src/components/sentry-user-context.tsx
"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import * as Sentry from "@sentry/nextjs";

export function SentryUserContext() {
  const { data: session } = useSession();
  useEffect(() => {
    if (session?.user?.id) {
      Sentry.setUser({ id: session.user.id });
    } else {
      Sentry.setUser(null);
    }
  }, [session]);
  return null;
}
```

Add `<SentryUserContext />` inside `<SessionProvider>` in `src/app/layout.tsx`.

**Tests:** not needed — one-liner effect with no logic to unit test.

---

## File Change Summary

| File                                               | Change                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `src/lib/exchange-rate.test.ts`                    | Add one test case                                            |
| `src/app/bookings/page.test.tsx`                   | New file                                                     |
| `src/app/page.test.tsx`                            | New file                                                     |
| `src/lib/exchange-rate.ts`                         | Remove inaccurate date comment; attach `url` to thrown error |
| `src/app/api/bookings/route.ts`                    | Switch booking currency lock to `getOrFetchHistoricalRate`   |
| `src/app/api/bookings/[id]/route.ts`               | Same                                                         |
| `src/app/api/cron/refresh-exchange-rates/route.ts` | Same                                                         |
| `src/lib/booking-enrichment.ts`                    | Add `exchangeRateEstimated` computation + prisma import      |
| `src/lib/booking-enrichment.test.ts`               | Add test cases + extend prisma mock                          |
| `src/app/bookings/page.tsx`                        | Add `exchangeRateEstimated` type + UI indicator              |
| `src/app/bookings/[id]/page.tsx`                   | Same                                                         |
| `src/components/bookings/booking-card.tsx`         | Same                                                         |
| `src/components/sentry-user-context.tsx`           | New file                                                     |
| `src/app/layout.tsx`                               | Add `<SentryUserContext />`                                  |
