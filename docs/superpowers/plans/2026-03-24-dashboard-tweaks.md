# Dashboard Tweaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement four dashboard improvements: ascending sort on Savings Breakdown, and three new widgets (Price Distribution, Monthly Travel Pattern, Geo Distribution).

**Architecture:** Three new standalone components in `src/components/`, each receiving `BookingWithRelations[]` from `page.tsx` (already available as `filteredBookings`). The `BookingWithRelations` type in `page.tsx` needs one field addition (`countryCode` / `city` on `property`). Each component owns its own toggle state.

**Tech Stack:** Next.js App Router, TypeScript, Recharts (already a dep), shadcn/ui Card/Button, Vitest + RTL (unit), Playwright (E2E).

---

## File Map

| File                                             | Action | Purpose                                                                                                                  |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `src/app/page.tsx`                               | Modify | Sort savings breakdown items; add `countryCode`/`city` to `BookingWithRelations.property`; import + render 3 new widgets |
| `src/components/price-distribution.tsx`          | Create | Bar chart of bookings by cost-per-night bucket                                                                           |
| `src/components/monthly-travel-pattern.tsx`      | Create | Bar chart of bookings by check-in month                                                                                  |
| `src/components/geo-distribution.tsx`            | Create | Ranked list of bookings by country or city                                                                               |
| `src/components/price-distribution.test.tsx`     | Create | Unit tests for PriceDistribution                                                                                         |
| `src/components/monthly-travel-pattern.test.tsx` | Create | Unit tests for MonthlyTravelPattern                                                                                      |
| `src/components/geo-distribution.test.tsx`       | Create | Unit tests for GeoDistribution                                                                                           |
| `e2e/dashboard-widgets.spec.ts`                  | Create | E2E smoke tests for the 3 new widget cards                                                                               |

---

## Task 1: Savings Breakdown — Ascending Sort

**Files:**

- Modify: `src/app/page.tsx` (around line 712 — the `{items.map(...)` call)

- [ ] **Step 1: Apply the sort**

Find the `const maxValue = Math.max(...)` line (around line 709). Immediately before the `return (` JSX, add:

```ts
const sortedItems = [...items].sort((a, b) => a.value - b.value);
```

Then replace `{items.map((item) => (` with `{sortedItems.map((item) => (`.

The `maxValue` line stays unchanged — it's already computed from `items` (by value, not position).

- [ ] **Step 2: Verify it compiles and lints**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: sort savings breakdown items ascending by value"
```

---

## Task 2: Add Geo Fields to BookingWithRelations Type

**Files:**

- Modify: `src/app/page.tsx` (line ~43 — the `property` shape in `BookingWithRelations`)

The Prisma `property: true` select already returns `countryCode` and `city` at runtime. Only the TypeScript type needs updating.

- [ ] **Step 1: Update the type**

Change:

```ts
property: {
  name: string;
}
```

To:

```ts
property: {
  name: string;
  countryCode: string | null;
  city: string | null;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add countryCode and city to BookingWithRelations.property type"
```

---

## Task 3: PriceDistribution — Tests

**Files:**

- Create: `src/components/price-distribution.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PriceDistribution } from "./price-distribution";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: { label: string; count: number }[];
  }) => (
    <div data-testid="bar-chart">
      {data.map((d) => (
        <div key={d.label} data-testid={`bar-${d.label}`}>
          {d.label}: {d.count}
        </div>
      ))}
    </div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: () => null,
}));

// Minimal BookingWithRelations shape needed by PriceDistribution
function makeBooking(overrides: {
  id?: string;
  totalCost?: number;
  numNights?: number;
  pretaxCost?: number;
  taxAmount?: number;
  lockedExchangeRate?: number | null;
  pointsRedeemed?: number | null;
}) {
  const {
    id = "1",
    totalCost = 300,
    numNights = 3,
    pretaxCost = 270,
    taxAmount = 30,
    lockedExchangeRate = 1,
    pointsRedeemed = null,
  } = overrides;
  return {
    id,
    totalCost: String(totalCost),
    numNights,
    pretaxCost: String(pretaxCost),
    taxAmount: String(taxAmount),
    lockedExchangeRate,
    currency: "USD",
    checkIn: "2026-06-01",
    checkOut: "2026-06-04",
    pointsRedeemed,
    portalCashbackRate: null,
    portalCashbackOnTotal: false,
    loyaltyPointsEarned: null,
    notes: null,
    hotelChainId: null,
    accommodationType: "hotel",
    otaAgencyId: null,
    bookingSource: null,
    hotelChain: null,
    hotelChainSubBrand: null,
    userCreditCard: null,
    shoppingPortal: null,
    bookingPromotions: [],
    certificates: [],
    property: { name: "Test Hotel", countryCode: "US", city: "New York" },
  };
}

describe("PriceDistribution", () => {
  it("buckets a cash booking by Net/Night correctly", () => {
    // $300 total, 3 nights, no savings → Net/Night = $100 → $100–150 bucket
    const booking = makeBooking({ totalCost: 300, numNights: 3 });
    render(<PriceDistribution bookings={[booking as never]} />);
    expect(screen.getByTestId("bar-$100–150")).toHaveTextContent("$100–150: 1");
    expect(screen.getByTestId("bar-$0–50")).toHaveTextContent("$0–50: 0");
  });

  it("clamps negative Net/Night to $0–50 bucket", () => {
    // Make net cost effectively 0 — $0 totalCost award stay with no redemption value
    // calculateNetCost will return 0, clamped to $0–50
    const booking = makeBooking({ totalCost: 0, numNights: 3, pretaxCost: 0, taxAmount: 0 });
    render(<PriceDistribution bookings={[booking as never]} />);
    expect(screen.getByTestId("bar-$0–50")).toHaveTextContent("$0–50: 1");
  });

  it("Total/Night mode includes award stays via redemption value", async () => {
    const user = userEvent.setup();
    // Award stay: totalCost=0, pointsRedeemed=30000 pts
    // getNetCostBreakdown will compute pointsRedeemedValue from the points and point type
    // Without a hotelChain/pointType, pointsRedeemedValue = 0 → lands in $0–50
    // This test verifies the award stay IS included (count=1), not excluded
    const awardBooking = makeBooking({
      totalCost: 0,
      numNights: 3,
      pretaxCost: 0,
      taxAmount: 0,
      pointsRedeemed: 30000,
    });
    render(<PriceDistribution bookings={[awardBooking as never]} />);
    await user.click(screen.getByText("Total/Night"));
    // Award stay should appear in some bucket (not be excluded)
    const allBuckets = screen.getAllByTestId(/^bar-/);
    const totalCount = allBuckets.reduce((sum, el) => {
      const match = el.textContent?.match(/: (\d+)$/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);
    expect(totalCount).toBe(1); // Award stay is included, not excluded
  });

  it("Nights mode sums numNights per bucket", async () => {
    const user = userEvent.setup();
    const booking = makeBooking({ totalCost: 300, numNights: 5 });
    render(<PriceDistribution bookings={[booking as never]} />);
    await user.click(screen.getByText("Nights"));
    expect(screen.getByTestId("bar-$100–150")).toHaveTextContent("$100–150: 5");
  });

  it("Total/Night mode uses gross cost for cash stays", async () => {
    const user = userEvent.setup();
    // $300 / 3 nights = $100/night → $100–150 bucket
    const booking = makeBooking({ totalCost: 300, numNights: 3 });
    render(<PriceDistribution bookings={[booking as never]} />);
    await user.click(screen.getByText("Total/Night"));
    expect(screen.getByTestId("bar-$100–150")).toHaveTextContent("$100–150: 1");
  });

  it("shows empty state when no bookings", () => {
    render(<PriceDistribution bookings={[]} />);
    expect(screen.getByTestId("price-distribution-card")).toBeInTheDocument();
    // Empty state should appear
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm tests fail (component doesn't exist yet)**

```bash
npm run test -- price-distribution
```

Expected: FAIL — cannot find module `./price-distribution`.

---

## Task 4: PriceDistribution — Implementation

**Files:**

- Create: `src/components/price-distribution.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { calculateNetCost, getNetCostBreakdown } from "@/lib/net-cost";

// Must match the full BookingWithRelations shape from page.tsx
// We import only the fields we need; the component accepts the full type.
interface BookingForPrice {
  totalCost: string;
  numNights: number;
  lockedExchangeRate: string | number | null;
  // All other fields required by calculateNetCost / getNetCostBreakdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface PriceDistributionProps {
  bookings: BookingForPrice[];
}

const BUCKETS = [
  { label: "$0–50", min: 0, max: 50 },
  { label: "$50–100", min: 50, max: 100 },
  { label: "$100–150", min: 100, max: 150 },
  { label: "$150–200", min: 150, max: 200 },
  { label: "$200–250", min: 200, max: 250 },
  { label: "$250+", min: 250, max: Infinity },
];

type MetricMode = "net" | "total";
type CountMode = "stays" | "nights";

function getBucket(value: number): string {
  const clamped = Math.max(0, value);
  const bucket = BUCKETS.find((b) => clamped >= b.min && clamped < b.max);
  return bucket?.label ?? "$250+";
}

export function PriceDistribution({ bookings }: PriceDistributionProps) {
  const [metric, setMetric] = useState<MetricMode>("net");
  const [mode, setMode] = useState<CountMode>("stays");

  const data = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(BUCKETS.map((b) => [b.label, 0]));

    bookings.forEach((booking) => {
      let perNight: number;

      if (metric === "net") {
        perNight = calculateNetCost(booking as never) / booking.numNights;
      } else {
        const totalCost = Number(booking.totalCost);
        if (totalCost > 0) {
          // Cash stay
          perNight = (totalCost * (Number(booking.lockedExchangeRate) || 1)) / booking.numNights;
        } else {
          // Award stay: use redemption value
          const { pointsRedeemedValue, certsValue } = getNetCostBreakdown(booking as never);
          perNight = (pointsRedeemedValue + certsValue) / booking.numNights;
        }
      }

      const bucketLabel = getBucket(perNight);
      const increment = mode === "stays" ? 1 : booking.numNights;
      counts[bucketLabel] += increment;
    });

    return BUCKETS.map((b) => ({ label: b.label, count: counts[b.label] }));
  }, [bookings, metric, mode]);

  const hasData = data.some((d) => d.count > 0);

  return (
    <Card data-testid="price-distribution-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Price Distribution</CardTitle>
        <div className="flex gap-1 flex-wrap justify-end">
          <div className="flex gap-1 bg-secondary p-1 rounded-md">
            <Button
              variant={metric === "net" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setMetric("net")}
            >
              Net/Night
            </Button>
            <Button
              variant={metric === "total" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setMetric("total")}
            >
              Total/Night
            </Button>
          </div>
          <div className="flex gap-1 bg-secondary p-1 rounded-md">
            <Button
              variant={mode === "stays" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setMode("stays")}
            >
              Stays
            </Button>
            <Button
              variant={mode === "nights" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setMode("nights")}
            >
              Nights
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            icon={BarChart2}
            title="No data"
            description="Price distribution will appear once you add bookings."
            className="border-none bg-transparent"
          />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                }}
                itemStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run the tests**

```bash
npm run test -- price-distribution
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/price-distribution.tsx src/components/price-distribution.test.tsx
git commit -m "feat: add PriceDistribution widget"
```

---

## Task 5: MonthlyTravelPattern — Tests

**Files:**

- Create: `src/components/monthly-travel-pattern.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MonthlyTravelPattern } from "./monthly-travel-pattern";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: { month: string; count: number }[];
  }) => (
    <div data-testid="bar-chart">
      {data.map((d) => (
        <div key={d.month} data-testid={`bar-${d.month}`}>
          {d.month}: {d.count}
        </div>
      ))}
    </div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

function makeBooking(id: string, checkIn: string, numNights: number) {
  return { id, checkIn, numNights };
}

describe("MonthlyTravelPattern", () => {
  it("renders all 12 months even when all counts are 0", () => {
    render(<MonthlyTravelPattern bookings={[makeBooking("1", "2026-06-15", 3) as never]} />);
    // All 12 month bars should be rendered
    expect(screen.getByTestId("bar-Jan")).toBeInTheDocument();
    expect(screen.getByTestId("bar-Dec")).toBeInTheDocument();
  });

  it("counts stays per check-in month correctly", () => {
    const bookings = [
      makeBooking("1", "2026-03-10", 2),
      makeBooking("2", "2026-03-25", 1),
      makeBooking("3", "2026-06-01", 5),
    ];
    render(<MonthlyTravelPattern bookings={bookings as never[]} />);
    expect(screen.getByTestId("bar-Mar")).toHaveTextContent("Mar: 2");
    expect(screen.getByTestId("bar-Jun")).toHaveTextContent("Jun: 1");
    expect(screen.getByTestId("bar-Jan")).toHaveTextContent("Jan: 0");
  });

  it("Nights mode sums numNights per check-in month", async () => {
    const user = userEvent.setup();
    const bookings = [makeBooking("1", "2026-03-10", 2), makeBooking("2", "2026-03-25", 4)];
    render(<MonthlyTravelPattern bookings={bookings as never[]} />);
    await user.click(screen.getByText("Nights"));
    expect(screen.getByTestId("bar-Mar")).toHaveTextContent("Mar: 6");
  });

  it("shows empty state when bookings array is empty", () => {
    render(<MonthlyTravelPattern bookings={[]} />);
    expect(screen.getByTestId("monthly-travel-pattern-card")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  it("assigns month by check-in month string slice, not Date parsing", () => {
    // "2026-01-31" should be January regardless of timezone
    const booking = makeBooking("1", "2026-01-31", 1);
    render(<MonthlyTravelPattern bookings={[booking as never]} />);
    expect(screen.getByTestId("bar-Jan")).toHaveTextContent("Jan: 1");
    expect(screen.getByTestId("bar-Dec")).toHaveTextContent("Dec: 0");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test -- monthly-travel-pattern
```

Expected: FAIL — cannot find module.

---

## Task 6: MonthlyTravelPattern — Implementation

**Files:**

- Create: `src/components/monthly-travel-pattern.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface BookingForMonthly {
  checkIn: string;
  numNights: number;
}

interface MonthlyTravelPatternProps {
  bookings: BookingForMonthly[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type CountMode = "stays" | "nights";

export function MonthlyTravelPattern({ bookings }: MonthlyTravelPatternProps) {
  const [mode, setMode] = useState<CountMode>("stays");

  const data = useMemo(() => {
    const counts = Array(12).fill(0);
    bookings.forEach((booking) => {
      // Slice month digits directly — avoids timezone issues with new Date()
      const monthIndex = parseInt(booking.checkIn.slice(5, 7)) - 1;
      counts[monthIndex] += mode === "stays" ? 1 : booking.numNights;
    });
    return MONTHS.map((month, i) => ({ month, count: counts[i], fullMonth: MONTH_FULL[i] }));
  }, [bookings, mode]);

  if (bookings.length === 0) {
    return (
      <Card data-testid="monthly-travel-pattern-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">Monthly Travel Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={CalendarRange}
            title="No data"
            description="Monthly travel patterns will appear once you add bookings."
            className="border-none bg-transparent"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="monthly-travel-pattern-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Monthly Travel Pattern</CardTitle>
        <div className="flex gap-1 bg-secondary p-1 rounded-md">
          <Button
            variant={mode === "stays" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setMode("stays")}
          >
            Stays
          </Button>
          <Button
            variant={mode === "nights" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setMode("nights")}
          >
            Nights
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip
              labelFormatter={(label: string, payload) => {
                const item = payload?.[0]?.payload as { fullMonth?: string } | undefined;
                return item?.fullMonth ?? label;
              }}
              contentStyle={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: "8px",
              }}
              itemStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- monthly-travel-pattern
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/monthly-travel-pattern.tsx src/components/monthly-travel-pattern.test.tsx
git commit -m "feat: add MonthlyTravelPattern widget"
```

---

## Task 7: GeoDistribution — Tests

**Files:**

- Create: `src/components/geo-distribution.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { GeoDistribution } from "./geo-distribution";

function makeBooking(id: string, countryCode: string | null, city: string | null) {
  return {
    id,
    property: { name: "Hotel", countryCode, city },
  };
}

describe("GeoDistribution", () => {
  it("groups bookings by country code", () => {
    const bookings = [
      makeBooking("1", "US", "New York"),
      makeBooking("2", "US", "Chicago"),
      makeBooking("3", "FR", "Paris"),
    ];
    render(<GeoDistribution bookings={bookings as never[]} />);
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("FR")).toBeInTheDocument();
    // US should show 2 stays
    const usRow = screen.getByTestId("geo-row-US");
    expect(usRow).toHaveTextContent("2");
  });

  it("groups bookings by city when City toggle is selected", async () => {
    const user = userEvent.setup();
    const bookings = [
      makeBooking("1", "US", "New York"),
      makeBooking("2", "US", "New York"),
      makeBooking("3", "US", "Chicago"),
    ];
    render(<GeoDistribution bookings={bookings as never[]} />);
    await user.click(screen.getByText("City"));
    expect(screen.getByTestId("geo-row-New York")).toHaveTextContent("2");
    expect(screen.getByTestId("geo-row-Chicago")).toHaveTextContent("1");
  });

  it("excludes bookings with null countryCode from country view", () => {
    const bookings = [makeBooking("1", "US", "New York"), makeBooking("2", null, null)];
    render(<GeoDistribution bookings={bookings as never[]} />);
    // Only US row should appear
    expect(screen.getAllByTestId(/^geo-row-/)).toHaveLength(1);
  });

  it("excludes bookings with null city from city view", async () => {
    const user = userEvent.setup();
    const bookings = [makeBooking("1", "US", "New York"), makeBooking("2", "US", null)];
    render(<GeoDistribution bookings={bookings as never[]} />);
    await user.click(screen.getByText("City"));
    expect(screen.getAllByTestId(/^geo-row-/)).toHaveLength(1);
  });

  it("caps display at top 10 entries", () => {
    const bookings = Array.from({ length: 15 }, (_, i) =>
      makeBooking(String(i), `C${i}`, `City${i}`)
    );
    render(<GeoDistribution bookings={bookings as never[]} />);
    expect(screen.getAllByTestId(/^geo-row-/)).toHaveLength(10);
  });

  it("shows empty state when all bookings have null geo data", () => {
    const bookings = [makeBooking("1", null, null)];
    render(<GeoDistribution bookings={bookings as never[]} />);
    expect(screen.getByTestId("geo-distribution-card")).toBeInTheDocument();
    expect(screen.queryByTestId(/^geo-row-/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test -- geo-distribution
```

Expected: FAIL — cannot find module.

---

## Task 8: GeoDistribution — Implementation

**Files:**

- Create: `src/components/geo-distribution.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface BookingForGeo {
  id: string;
  property: {
    countryCode: string | null;
    city: string | null;
  };
}

interface GeoDistributionProps {
  bookings: BookingForGeo[];
}

type GeoView = "country" | "city";

export function GeoDistribution({ bookings }: GeoDistributionProps) {
  const [view, setView] = useState<GeoView>("country");

  const data = useMemo(() => {
    const counts: Record<string, number> = {};

    bookings.forEach((booking) => {
      const key = view === "country" ? booking.property.countryCode : booking.property.city;
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [bookings, view]);

  const maxCount = data[0]?.count ?? 1;

  return (
    <Card data-testid="geo-distribution-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Geo Distribution</CardTitle>
        <div className="flex gap-1 bg-secondary p-1 rounded-md">
          <Button
            variant={view === "country" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setView("country")}
          >
            Country
          </Button>
          <Button
            variant={view === "city" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setView("city")}
          >
            City
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No data"
            description="Geo distribution will appear once bookings have location data."
            className="border-none bg-transparent"
          />
        ) : (
          <div className="space-y-2">
            {data.map(({ label, count }) => (
              <div key={label} className="space-y-0.5" data-testid={`geo-row-${label}`}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- geo-distribution
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/geo-distribution.tsx src/components/geo-distribution.test.tsx
git commit -m "feat: add GeoDistribution widget"
```

---

## Task 9: Wire Up to Dashboard

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add imports** (at top of file, alongside other component imports)

```ts
import { PriceDistribution } from "@/components/price-distribution";
import { MonthlyTravelPattern } from "@/components/monthly-travel-pattern";
import { GeoDistribution } from "@/components/geo-distribution";
```

- [ ] **Step 2: Add widgets to the grid**

Find the closing section of the grid (around line 763):

```tsx
        <PaymentTypeBreakdown bookings={filteredBookings} />
        {accommodationFilter !== "apartment" && <SubBrandBreakdown bookings={filteredBookings} />}
      </div>
```

Replace with:

```tsx
        <PaymentTypeBreakdown bookings={filteredBookings} />
        {accommodationFilter !== "apartment" && <SubBrandBreakdown bookings={filteredBookings} />}
        <PriceDistribution bookings={filteredBookings} />
        <MonthlyTravelPattern bookings={filteredBookings} />
        <GeoDistribution bookings={filteredBookings} />
      </div>
```

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Full unit test run**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add PriceDistribution, MonthlyTravelPattern, and GeoDistribution widgets to dashboard"
```

---

## Task 10: E2E Tests

**Files:**

- Create: `e2e/dashboard-widgets.spec.ts`

- [ ] **Step 1: Write the E2E test**

```ts
import crypto from "crypto";
import { test, expect } from "./fixtures";

const YEAR = new Date().getFullYear();

test.describe("Dashboard — new widgets", () => {
  test("new widget cards are visible with booking data", async ({ isolatedUser, adminRequest }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    // Use a property name that triggers the manual geo modal path; we rely on the API
    // accepting countryCode directly via the property upsert. If the API does not accept
    // countryCode on booking create, the geo card will show empty state — adjust as needed.
    const propertyName = `Widget Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-06-10`,
        checkOut: `${YEAR}-06-13`,
        numNights: 3,
        pretaxCost: 270,
        taxAmount: 30,
        totalCost: 300,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      // Price Distribution — card visible and shows at least one bucket label
      const priceCard = isolatedUser.page.getByTestId("price-distribution-card");
      await expect(priceCard).toBeVisible();
      // $300 / 3 nights = $100/night → $100–150 bucket should appear
      await expect(priceCard).toContainText("$100–150");

      // Monthly Travel Pattern — card visible and shows month labels
      const monthlyCard = isolatedUser.page.getByTestId("monthly-travel-pattern-card");
      await expect(monthlyCard).toBeVisible();
      await expect(monthlyCard).toContainText("Jun");

      // Geo Distribution — card visible and shows at least one country row
      const geoCard = isolatedUser.page.getByTestId("geo-distribution-card");
      await expect(geoCard).toBeVisible();
      await expect(geoCard.getByTestId("geo-row-US")).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
```

- [ ] **Step 2: Run E2E (requires dev server + test DB)**

```bash
npm run test:e2e -- dashboard-widgets
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/dashboard-widgets.spec.ts
git commit -m "test: add E2E smoke tests for new dashboard widgets"
```

---

## Task 11: Final Verification

- [ ] **Run full test suite**

```bash
npm run test
```

Expected: all unit tests PASS.

- [ ] **Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Invoke finishing skill**

Use `superpowers:finishing-a-development-branch` to determine next steps (PR, cleanup, etc.).
