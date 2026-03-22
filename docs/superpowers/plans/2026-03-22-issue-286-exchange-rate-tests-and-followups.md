# Issue #286 — Exchange Rate Tests + Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing unit tests for exchange rate fallback and page error handling, switch rate-locking paths to use the resilient `getOrFetchHistoricalRate`, surface an estimated-rate warning to users for very old bookings, improve Sentry context (URL in logs, user identity).

**Architecture:** Rate locking (booking POST/PUT/cron) switches from `fetchExchangeRate` (throws on failure) to `getOrFetchHistoricalRate` (caches successes in `ExchangeRateHistory`, falls back gracefully). `enrichBookingWithRate` then queries `ExchangeRateHistory` to detect fallback cases and sets `exchangeRateEstimated`. UI surfaces this flag in existing cost popovers/inline text.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 6, Vitest + React Testing Library, Auth.js v5, `@sentry/nextjs`

**Spec:** `docs/superpowers/specs/2026-03-22-issue-286-exchange-rate-tests-and-followups-design.md`

---

## File Map

| File                                               | Action | Purpose                                                    |
| -------------------------------------------------- | ------ | ---------------------------------------------------------- |
| `src/lib/exchange-rate.test.ts`                    | Modify | Add null-fallback test case                                |
| `src/app/bookings/page.test.tsx`                   | Create | Test fetch error → ErrorBanner                             |
| `src/app/page.test.tsx`                            | Create | Test fetch error → ErrorBanner on dashboard                |
| `src/lib/exchange-rate.ts`                         | Modify | Remove stale comment; attach `url` to thrown error         |
| `src/app/api/bookings/route.ts`                    | Modify | Switch booking currency lock to `getOrFetchHistoricalRate` |
| `src/app/api/bookings/[id]/route.ts`               | Modify | Same                                                       |
| `src/app/api/cron/refresh-exchange-rates/route.ts` | Modify | Same                                                       |
| `src/lib/booking-enrichment.ts`                    | Modify | Add `exchangeRateEstimated` heuristic + prisma import      |
| `src/lib/booking-enrichment.test.ts`               | Modify | Add prisma mock + test cases for `exchangeRateEstimated`   |
| `src/app/bookings/page.tsx`                        | Modify | Type + UI indicator                                        |
| `src/app/bookings/[id]/page.tsx`                   | Modify | Type + UI indicator                                        |
| `src/components/bookings/booking-card.tsx`         | Modify | Type + UI indicator                                        |
| `src/components/sentry-user-context.tsx`           | Create | `Sentry.setUser` client component                          |
| `src/app/layout.tsx`                               | Modify | Mount `SentryUserContext`                                  |

---

## Task 1: Add missing exchange-rate unit test

**Files:**

- Modify: `src/lib/exchange-rate.test.ts`

- [ ] **Step 1: Add the test case inside the existing `getOrFetchHistoricalRate` describe block (after the existing "falls back to current cached rate when the API fails" test at line 174)**

```typescript
it("returns null when the API fails and no current rate is cached", async () => {
  prismaMock.exchangeRateHistory.findUnique.mockResolvedValueOnce(null);
  mockFetch
    .mockResolvedValueOnce({ ok: false, status: 404 })
    .mockResolvedValueOnce({ ok: false, status: 404 });
  prismaMock.exchangeRate.findUnique.mockResolvedValueOnce(null);

  const rate = await getOrFetchHistoricalRate("AUD", "2025-06-01");
  expect(rate).toBeNull();
  expect(prismaMock.exchangeRateHistory.upsert).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test suite to verify the new test passes and nothing regressed**

```bash
npm test -- src/lib/exchange-rate.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/exchange-rate.test.ts
git commit -m "test: add null-fallback case for getOrFetchHistoricalRate"
```

---

## Task 2: Add BookingsPage fetch-error test

**Files:**

- Create: `src/app/bookings/page.test.tsx`

- [ ] **Step 1: Create the test file**

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BookingsPage from "./page";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingsPage", () => {
  it("shows an error banner and no booking rows when the bookings API fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    expect(screen.queryAllByTestId(/^booking-row-/)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

```bash
npm test -- src/app/bookings/page.test.tsx
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add src/app/bookings/page.test.tsx
git commit -m "test: add fetch-error test for BookingsPage"
```

---

## Task 3: Add DashboardPage fetch-error test

**Files:**

- Create: `src/app/page.test.tsx`

- [ ] **Step 1: Create the test file**

`PaymentTypeBreakdown` and `SubBrandBreakdown` import from `recharts` which doesn't work in jsdom. Mock them directly so the test doesn't depend on chart internals.

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DashboardPage from "./page";

// recharts doesn't work in jsdom — mock the components that use it
vi.mock("@/components/payment-type-breakdown", () => ({
  PaymentTypeBreakdown: () => null,
}));
vi.mock("@/components/sub-brand-breakdown", () => ({
  SubBrandBreakdown: () => null,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DashboardPage", () => {
  it("shows an error banner when the bookings API fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

```bash
npm test -- src/app/page.test.tsx
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.test.tsx
git commit -m "test: add fetch-error test for DashboardPage"
```

---

## Task 4: Attach URL to `fetchExchangeRate` thrown error + remove stale comment

**Files:**

- Modify: `src/lib/exchange-rate.ts`

`fetchExchangeRate` currently has a one-liner throw on line ~30:

```typescript
throw new Error(`Exchange rate API error for ${fromCurrency}: ${res.status}`);
```

And a comment above `fetchExchangeRate` that says:

```typescript
 * Historical data available from approximately March 2024 onward.
```

- [ ] **Step 1: Remove the inaccurate date comment and split the throw into two lines to attach `fallbackUrl`**

In `fetchExchangeRate`, replace:

```typescript
if (!res.ok) {
  throw new Error(`Exchange rate API error for ${fromCurrency}: ${res.status}`);
}
```

with:

```typescript
if (!res.ok) {
  const err = new Error(`Exchange rate API error for ${fromCurrency}: ${res.status}`);
  (err as Error & { url: string }).url = fallbackUrl;
  throw err;
}
```

Also remove this line from the JSDoc comment above the function:

```
 * Historical data available from approximately March 2024 onward.
```

Then update the catch block in `getOrFetchHistoricalRate` to log the URL:

```typescript
  } catch (err) {
    logger.warn("Exchange rate fetch failed, falling back to current cached rate", {
      fromCurrency,
      date,
      url: (err as Error & { url?: string }).url,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
    return getCurrentRate(fromCurrency);
  }
```

- [ ] **Step 2: Run the existing exchange-rate tests to confirm nothing broke**

```bash
npm test -- src/lib/exchange-rate.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/exchange-rate.ts
git commit -m "fix: attach fallback URL to exchange rate error + remove stale date comment"
```

---

## Task 5: Switch rate-locking paths to `getOrFetchHistoricalRate`

**Files:**

- Modify: `src/app/api/bookings/route.ts`
- Modify: `src/app/api/bookings/[id]/route.ts`
- Modify: `src/app/api/cron/refresh-exchange-rates/route.ts`

This is the key change that makes the `exchangeRateEstimated` heuristic reliable: `getOrFetchHistoricalRate` writes to `ExchangeRateHistory` on a successful API fetch and falls back gracefully (using `getCurrentRate`) on failure — whereas `fetchExchangeRate` throws. Note: `getOrFetchHistoricalRate` returns `number | null` while `fetchExchangeRate` returns `number`, so handle the nullable return.

**`src/app/api/bookings/route.ts`** — line 10 import and line 185 usage:

- [ ] **Step 1: Update `src/app/api/bookings/route.ts`**

Change the import on line 10 from:

```typescript
import { fetchExchangeRate, getCurrentRate, resolveCalcCurrencyRate } from "@/lib/exchange-rate";
```

to:

```typescript
import {
  getOrFetchHistoricalRate,
  getCurrentRate,
  resolveCalcCurrencyRate,
} from "@/lib/exchange-rate";
```

Change the lock call (~line 185) from:

```typescript
resolvedExchangeRate = await fetchExchangeRate(resolvedCurrency, checkInStr);
```

to:

```typescript
resolvedExchangeRate = await getOrFetchHistoricalRate(resolvedCurrency, checkInStr);
```

Note: `getOrFetchHistoricalRate` returns `number | null`. `resolvedExchangeRate` is declared at line 180 as `let resolvedExchangeRate: number | null = null` — it already accepts `null`, so no type change is needed.

**`src/app/api/bookings/[id]/route.ts`** — line 16 import and line 282 usage:

- [ ] **Step 2: Update `src/app/api/bookings/[id]/route.ts`**

Change the import on line 16 from:

```typescript
import { fetchExchangeRate, getCurrentRate, resolveCalcCurrencyRate } from "@/lib/exchange-rate";
```

to:

```typescript
import {
  getOrFetchHistoricalRate,
  getCurrentRate,
  resolveCalcCurrencyRate,
} from "@/lib/exchange-rate";
```

Change the lock call (~line 282) from:

```typescript
data.lockedExchangeRate = await fetchExchangeRate(finalCurrency, checkInStr);
```

to:

```typescript
data.lockedExchangeRate = await getOrFetchHistoricalRate(finalCurrency, checkInStr);
```

**`src/app/api/cron/refresh-exchange-rates/route.ts`** — line 3 import and line 86 usage:

- [ ] **Step 3: Update `src/app/api/cron/refresh-exchange-rates/route.ts`**

Change the import on line 3 from:

```typescript
import { fetchExchangeRate, getCurrentRate } from "@/lib/exchange-rate";
```

to:

```typescript
import { fetchExchangeRate, getOrFetchHistoricalRate, getCurrentRate } from "@/lib/exchange-rate";
```

**Important:** Keep `fetchExchangeRate` in the import — it is still used at line 111 for the loyalty program currency rate (`fetchExchangeRate(pt.programCurrency, checkInStr)`). Only the booking currency lock at line 86 is switching to `getOrFetchHistoricalRate`. Loyalty program currency calls are unchanged per the spec.

Change the lock call (~line 86) from:

```typescript
const rate = await fetchExchangeRate(booking.currency, checkInStr);
```

to:

```typescript
const rate = await getOrFetchHistoricalRate(booking.currency, checkInStr);
```

`getOrFetchHistoricalRate` returns `number | null`. The cron immediately uses `rate` for `prisma.booking.update({ data: { lockedExchangeRate: rate, ... } })`. A `null` rate here means `getCurrentRate` returned null (no cached rate at all). Guard against it:

```typescript
const rate = await getOrFetchHistoricalRate(booking.currency, checkInStr);
if (rate == null) {
  logger.warn(`No exchange rate available for booking ${booking.id}, skipping lock`, {
    currency: booking.currency,
    checkIn: checkInStr,
  });
  continue;
}
```

- [ ] **Step 4: Run lint to catch any unused import errors**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 5: Run unit tests to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/bookings/route.ts src/app/api/bookings/[id]/route.ts src/app/api/cron/refresh-exchange-rates/route.ts
git commit -m "fix: use getOrFetchHistoricalRate in rate-locking paths for caching + graceful fallback"
```

---

## Task 6: Add `exchangeRateEstimated` to `enrichBookingWithRate`

**Files:**

- Modify: `src/lib/booking-enrichment.ts`
- Modify: `src/lib/booking-enrichment.test.ts`

The enrichment function runs on every GET of a booking (single or list). It already computes `isFutureEstimate` and `loyaltyPointsEstimated`. We add `exchangeRateEstimated` using the `ExchangeRateHistory` heuristic.

- [ ] **Step 1: Write the failing tests first**

Open `src/lib/booking-enrichment.test.ts`.

First, add the prisma mock and typed mock reference. **Placement matters:**

- `vi.mock("./prisma", ...)` can go after the existing `vi.mock("./loyalty-utils", ...)` block — Vitest hoists all `vi.mock` calls automatically.
- `import prisma from "./prisma"` must go in the **top import block** (after line 15 where `calculatePoints` is imported), not mid-file. TypeScript requires import declarations at the top level.
- The `prismaMock` cast goes immediately after the existing mock casts (after line 19 `const mockCalculatePoints = ...`).

```typescript
// In the vi.mock section (after existing vi.mock calls):
vi.mock("./prisma", () => ({
  default: {
    exchangeRateHistory: { findUnique: vi.fn() },
  },
}));

// In the import section (after line 15):
import prisma from "./prisma";

// After line 19 (existing mock casts):
const prismaMock = prisma as unknown as {
  exchangeRateHistory: { findUnique: Mock };
};
```

Second, the existing "past non-USD booking with stored rate" describe block (lines 55–73) now triggers the two `exchangeRateHistory.findUnique` calls when the guard `isNonUsd && !isFuture && resolvedRate != null` is true. The top-level `beforeEach` calls `vi.clearAllMocks()` which resets this mock between tests, so you need per-test setup.

Add a `beforeEach` inside the `"past non-USD booking with stored rate"` describe block (right after line 55 `describe("past non-USD booking with stored rate", () => {`):

```typescript
describe("past non-USD booking with stored rate", () => {
  beforeEach(() => {
    prismaMock.exchangeRateHistory.findUnique.mockResolvedValue({ rate: "0.65" });
  });

  it("uses the stored exchangeRate, no live lookup, isFutureEstimate=false", async () => {
    // ... existing test unchanged ...
  });
});
```

Use `mockResolvedValue` (not `mockResolvedValueOnce`) so both parallel `findUnique` calls in `Promise.all` get the non-null record.

Third, add a new `describe("exchangeRateEstimated", ...)` block:

```typescript
describe("exchangeRateEstimated", () => {
  const pastNonUsdBooking = {
    ...baseBooking,
    currency: "AUD",
    lockedExchangeRate: "0.63",
    checkIn: new Date("2022-01-15T00:00:00Z"), // very old, pre-API coverage
  };

  it("is true when no ExchangeRateHistory exists for checkIn or checkIn-1", async () => {
    prismaMock.exchangeRateHistory.findUnique.mockResolvedValue(null);

    const result = await enrichBookingWithRate(pastNonUsdBooking);

    expect(result.exchangeRateEstimated).toBe(true);
  });

  it("is false when ExchangeRateHistory exists for checkIn-1 (same-day check-in case)", async () => {
    // First call (checkIn date) returns null, second call (checkIn-1) returns a record
    prismaMock.exchangeRateHistory.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ rate: "0.63" });

    const result = await enrichBookingWithRate(pastNonUsdBooking);

    expect(result.exchangeRateEstimated).toBe(false);
  });

  it("is false when ExchangeRateHistory exists for checkIn date itself", async () => {
    prismaMock.exchangeRateHistory.findUnique.mockResolvedValueOnce({ rate: "0.63" });

    const result = await enrichBookingWithRate(pastNonUsdBooking);

    expect(result.exchangeRateEstimated).toBe(false);
  });

  it("is false for a USD booking", async () => {
    const result = await enrichBookingWithRate(baseBooking); // baseBooking is USD
    expect(result.exchangeRateEstimated).toBe(false);
    expect(prismaMock.exchangeRateHistory.findUnique).not.toHaveBeenCalled();
  });

  it("is false for a future non-USD booking", async () => {
    mockGetCurrentRate.mockResolvedValueOnce(0.63);
    const futureBooking = {
      ...baseBooking,
      currency: "AUD",
      lockedExchangeRate: null,
      checkIn: futureDate,
    };

    const result = await enrichBookingWithRate(futureBooking);

    expect(result.exchangeRateEstimated).toBe(false);
    expect(prismaMock.exchangeRateHistory.findUnique).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify new tests fail (not yet implemented)**

```bash
npm test -- src/lib/booking-enrichment.test.ts
```

Expected: the 5 new `exchangeRateEstimated` tests fail with something like "result.exchangeRateEstimated is undefined". Existing tests should still pass (because the prisma mock is now set up).

- [ ] **Step 3: Implement `exchangeRateEstimated` in `booking-enrichment.ts`**

Add `import prisma from "@/lib/prisma";` at the top of `src/lib/booking-enrichment.ts`.

Add the heuristic computation after the existing `loyaltyPointsEstimated` block and before the `return` statement:

```typescript
let exchangeRateEstimated = false;
if (isNonUsd && !isFuture && resolvedRate != null) {
  const checkInDate = checkIn; // already a Date from line 33
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

Add `exchangeRateEstimated` to the returned object:

```typescript
return {
  ...booking,
  lockedExchangeRate: resolvedRate,
  loyaltyPointsEarned,
  isFutureEstimate,
  loyaltyPointsEstimated,
  exchangeRateEstimated,
  hotelChain: booking.hotelChain ? { ...booking.hotelChain, calcCurrencyToUsdRate } : null,
};
```

Note: `checkIn` is already resolved to a `Date` at line 33 (`const checkIn = booking.checkIn instanceof Date ? booking.checkIn : new Date(booking.checkIn)`), so reuse it directly instead of re-parsing.

- [ ] **Step 4: Run the tests and verify all pass**

```bash
npm test -- src/lib/booking-enrichment.test.ts
```

Expected: all tests pass including the 5 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking-enrichment.ts src/lib/booking-enrichment.test.ts
git commit -m "feat: compute exchangeRateEstimated flag in enrichBookingWithRate"
```

---

## Task 7: Surface `exchangeRateEstimated` in the UI

**Files:**

- Modify: `src/app/bookings/page.tsx`
- Modify: `src/app/bookings/[id]/page.tsx`
- Modify: `src/components/bookings/booking-card.tsx`

Three places show the non-USD cost popover or inline cost text. All follow the same pattern as the existing `isFutureEstimate` display.

### 7a — Bookings list page (`src/app/bookings/page.tsx`)

- [ ] **Step 1: Add `exchangeRateEstimated` to the `Booking` interface**

Find the `Booking` interface near the top of the file. Add the field alongside `isFutureEstimate`:

```typescript
isFutureEstimate?: boolean;
exchangeRateEstimated?: boolean;
```

- [ ] **Step 2: Add the indicator inside the non-USD cost `<PopoverContent>`**

Find the `<PopoverContent>` block that shows the native cost and rate label. It currently looks like:

```tsx
<PopoverContent className="w-auto p-3 text-sm" align="end" data-testid="cost-popover-content">
  <p className="font-medium">
    {formatCurrency(Number(booking.totalCost), booking.currency, { ... })}
  </p>
  <p className="text-muted-foreground text-xs mt-0.5">
    {booking.isFutureEstimate ? "Estimated at current rate" : "Locked at check-in rate"}
  </p>
</PopoverContent>
```

Add a third `<p>` after the existing rate-label paragraph:

```tsx
{
  booking.exchangeRateEstimated && (
    <p className="text-amber-600 text-xs mt-0.5">
      Historical rate unavailable — estimated using current rate
    </p>
  );
}
```

### 7b — Booking detail page (`src/app/bookings/[id]/page.tsx`)

- [ ] **Step 3: Add `exchangeRateEstimated` to the booking type in this file**

Find the interface/type for the booking (look for `isFutureEstimate?: boolean`) and add:

```typescript
exchangeRateEstimated?: boolean;
```

- [ ] **Step 4: Add the indicator near each `isFutureEstimate` occurrence**

The file has two occurrences of `isFutureEstimate ? " (est.)" : ""` — one for pretax cost and one for total cost. After each one, add a conditional `<p>`:

```tsx
{
  booking.exchangeRateEstimated && (
    <p className="text-amber-600 text-xs mt-0.5">
      Historical rate unavailable — estimated using current rate
    </p>
  );
}
```

### 7c — Booking card component (`src/components/bookings/booking-card.tsx`)

- [ ] **Step 5: Add `exchangeRateEstimated` to the intersection type in `BookingCardProps`**

Find the type for the `booking` prop. It looks like:

```typescript
NetCostBooking & {
  // ...
  isFutureEstimate?: boolean;
  // ...
}
```

Add `exchangeRateEstimated?: boolean;` to the intersection.

- [ ] **Step 6: Add the indicator inside the `<PopoverContent>` in `booking-card.tsx`**

Same pattern as the bookings list page:

```tsx
{
  booking.exchangeRateEstimated && (
    <p className="text-amber-600 text-xs mt-0.5">
      Historical rate unavailable — estimated using current rate
    </p>
  );
}
```

### 7d — Tests for `exchangeRateEstimated` UI indicator

- [ ] **Step 7: Add a test for the estimated rate warning in `src/app/bookings/page.test.tsx`**

Add a second test to the existing `describe("BookingsPage")` block that verifies the amber warning appears when `exchangeRateEstimated` is true:

```typescript
it("shows estimated rate warning when booking has exchangeRateEstimated=true", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ([
      {
        id: "bk1",
        currency: "AUD",
        lockedExchangeRate: "0.63",
        pretaxCost: "100",
        taxAmount: "10",
        totalCost: "110",
        checkIn: "2022-01-15",
        checkOut: "2022-01-17",
        numNights: 2,
        isFutureEstimate: false,
        exchangeRateEstimated: true,
        hotelChainId: null,
        hotelChain: null,
        hotelChainSubBrand: null,
        shoppingPortal: null,
        portalCashbackRate: null,
        portalCashbackOnTotal: false,
        userCreditCard: null,
        loyaltyPointsEarned: null,
        pointsRedeemed: null,
        loyaltyPointsEstimated: false,
        certificates: [],
        bookingPromotions: [],
        benefits: [],
        propertyId: "prop1",
        property: { name: "Test Hotel", countryCode: "AU", city: "Sydney", address: null, latitude: null, longitude: null },
        partnershipEarns: [],
        accommodationType: "hotel",
      },
    ]),
  });

  render(<BookingsPage />);

  await waitFor(() => {
    expect(screen.getByTestId("booking-row-bk1")).toBeInTheDocument();
  });

  // Open the popover to see the estimated rate warning
  // The warning is inside a Popover — check it exists in the DOM
  expect(screen.getByText("Historical rate unavailable — estimated using current rate")).toBeInTheDocument();
});
```

Note: The warning `<p>` is rendered inside a `<PopoverContent>`. Radix UI's Popover renders content in the DOM even when not open in jsdom, so the text should be queryable without clicking.

- [ ] **Step 8: Run lint and unit tests**

```bash
npm run lint && npm test
```

Expected: zero lint errors, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/app/bookings/page.tsx src/app/bookings/[id]/page.tsx src/components/bookings/booking-card.tsx
git commit -m "feat: show estimated rate warning for bookings using fallback exchange rate"
```

---

## Task 8: Add Sentry user context

**Files:**

- Create: `src/components/sentry-user-context.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/components/sentry-user-context.tsx`**

```typescript
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

- [ ] **Step 2: Mount it in the root layout**

Open `src/app/layout.tsx`. Import the component and add it inside `<SessionProvider>`:

```typescript
import { SentryUserContext } from "@/components/sentry-user-context";
```

```tsx
<SessionProvider>
  <SentryUserContext />
  <div className="flex flex-col lg:flex-row h-dvh bg-background overflow-hidden">
    {/* ... existing layout ... */}
  </div>
</SessionProvider>
```

- [ ] **Step 3: Run lint and build to confirm no errors**

```bash
npm run lint && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/sentry-user-context.tsx src/app/layout.tsx
git commit -m "feat: set Sentry user context from auth session"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run the full unit test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: zero errors.
