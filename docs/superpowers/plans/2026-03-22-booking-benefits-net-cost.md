# Booking Benefits Net Cost Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `BookingBenefit` to support cash and points value types, wire both into net cost calculation, update the booking form UI, and surface an expandable "Booking Benefits" row in the Cost Breakdown card.

**Architecture:** Schema adds 3 nullable columns + 1 enum to `BookingBenefit`. `getNetCostBreakdown` in `net-cost.ts` is the single calculation source of truth and is extended with a new benefits section. The form reducer, form UI, and cost breakdown component are updated to match. No new files are needed — changes are additive to existing modules.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6, PostgreSQL, Vitest + RTL (unit), Playwright (E2E), Tailwind CSS 4, shadcn/ui

---

## File Map

| File                                              | Change                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                            | Add `BenefitPointsEarnType` enum + 3 columns to `BookingBenefit`                                                |
| `src/lib/types.ts`                                | Add `pointsEarnType`, `pointsAmount`, `pointsMultiplier` to `BookingBenefit` interface                          |
| `src/app/bookings/[id]/page.tsx`                  | Same addition to local `BookingBenefit` interface                                                               |
| `src/lib/net-cost.ts`                             | Add `benefits` to `NetCostBooking`; add booking benefits section; update `NetCostBreakdown` + `netCost` formula |
| `src/lib/net-cost.test.ts`                        | Add booking benefits unit test cases                                                                            |
| `src/app/api/bookings/route.ts`                   | POST: write new benefit fields with validation                                                                  |
| `src/app/api/bookings/[id]/route.ts`              | PUT: write new benefit fields with validation                                                                   |
| `src/app/page.tsx`                                | Export `calcTotalSavings`; add `bookingBenefitsValue` to sum                                                    |
| `src/app/page.test.ts`                            | New unit test: `calcTotalSavings` includes `bookingBenefitsValue`                                               |
| `src/components/bookings/booking-form-reducer.ts` | Expand `BenefitItem`; add `RESET_BENEFIT_POINTS` action                                                         |
| `src/components/bookings/booking-form.tsx`        | Redesign benefit row to card with value-type radio; hotel-chain-removal reset                                   |
| `src/components/cost-breakdown.tsx`               | Add expandable "Booking Benefits" row above "Promotion Savings"                                                 |
| `e2e/booking-benefits.spec.ts`                    | New E2E test file                                                                                               |

---

## Task 1: Schema Migration

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the enum and new columns to the schema**

Open `prisma/schema.prisma`. Find the `BenefitType` enum (around line 51) and add the new enum immediately after it:

```prisma
enum BenefitPointsEarnType {
  fixed_per_stay
  fixed_per_night
  multiplier_on_base
}
```

Then find the `BookingBenefit` model and add the three new columns after `dollarValue`:

```prisma
  pointsEarnType   BenefitPointsEarnType? @map("points_earn_type")
  pointsAmount     Int?                   @map("points_amount")
  pointsMultiplier Decimal?               @map("points_multiplier") @db.Decimal(6, 3)
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate
```

When prompted, name it: `booking_benefit_points_fields`

- [ ] **Step 3: Verify migration applied**

```bash
npx prisma studio
```

Open `booking_benefits` table — confirm the three new columns exist (all nullable). Close Prisma Studio.

- [ ] **Step 4: Restart dev server to pick up new Prisma client**

Kill and restart `npm run dev`. The Prisma client must be regenerated before TypeScript compilation works.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add points earn fields to BookingBenefit schema"
```

---

## Task 2: Update TypeScript Types

**Files:**

- Modify: `src/lib/types.ts`
- Modify: `src/app/bookings/[id]/page.tsx`

- [ ] **Step 1: Update the shared `BookingBenefit` interface in `types.ts`**

Find `BookingBenefit` in `src/lib/types.ts` (around line 429). Add three fields:

```ts
export interface BookingBenefit {
  id: string;
  benefitType: string;
  label: string | null;
  dollarValue: string | number | null;
  pointsEarnType: string | null; // ← new
  pointsAmount: number | null; // ← new
  pointsMultiplier: string | number | null; // ← new
}
```

- [ ] **Step 2: Update the local `BookingBenefit` interface in the booking detail page**

In `src/app/bookings/[id]/page.tsx`, find the local `BookingBenefit` interface (around line 89) and add the same three fields:

```ts
interface BookingBenefit {
  id: string;
  benefitType: string;
  label: string | null;
  dollarValue: string | number | null;
  pointsEarnType: string | null;
  pointsAmount: number | null;
  pointsMultiplier: string | number | null;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/app/bookings/[id]/page.tsx
git commit -m "feat: add points fields to BookingBenefit types"
```

---

## Task 3: Write Failing Unit Tests for Booking Benefits

**Files:**

- Modify: `src/lib/net-cost.test.ts`

The `mockBaseBooking` fixture in this file does **not** yet include a `benefits` field — `getNetCostBreakdown` will need to handle a missing `benefits` array gracefully (treat as `[]`). Write the tests first; they will fail because the calculation doesn't exist yet.

- [ ] **Step 1: Add a `describe("booking benefits")` block to `net-cost.test.ts`**

Add after the existing test blocks:

```ts
describe("booking benefits", () => {
  const baseBookingWithBenefits: NetCostBooking = {
    ...mockBaseBooking,
    // mockBaseBooking has: hotelChain.pointType.usdCentsPerPoint = 0.015, basePointRate = 10
    // pretaxCost = 80, totalCost = 100, numNights = 1, lockedExchangeRate = undefined
    benefits: [],
  };

  it("returns zero bookingBenefitsValue when no benefits", () => {
    const result = getNetCostBreakdown(baseBookingWithBenefits);
    expect(result.bookingBenefitsValue).toBe(0);
    expect(result.bookingBenefits).toHaveLength(0);
  });

  it("cash benefit (USD) reduces net cost", () => {
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      benefits: [
        {
          benefitType: "free_breakfast",
          label: null,
          dollarValue: 25,
          pointsEarnType: null,
          pointsAmount: null,
          pointsMultiplier: null,
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBeCloseTo(25);
    expect(result.netCost).toBeCloseTo(100 - 25); // totalCost - cashBenefit
    expect(result.bookingBenefits[0].label).toBe("Free Breakfast");
  });

  it("cash benefit (non-USD) applies exchange rate", () => {
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      pretaxCost: 800,
      totalCost: 1000,
      lockedExchangeRate: 1.08,
      benefits: [
        {
          benefitType: "dining_credit",
          label: null,
          dollarValue: 30,
          pointsEarnType: null,
          pointsAmount: null,
          pointsMultiplier: null,
        },
      ],
    };
    // $30 EUR × 1.08 = $32.40 USD
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBeCloseTo(32.4);
  });

  it("fixed_per_stay: floor(pointsAmount) × usdCentsPerPoint / 100", () => {
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      benefits: [
        {
          benefitType: "other",
          label: "Hyatt Milestone",
          dollarValue: null,
          pointsEarnType: "fixed_per_stay",
          pointsAmount: 2000,
          pointsMultiplier: null,
        },
      ],
    };
    // 2000 pts × $0.015/pt = $30
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBeCloseTo(30);
    expect(result.bookingBenefits[0].label).toBe("Hyatt Milestone");
  });

  it("fixed_per_night: floor(pointsAmount × numNights) × rate", () => {
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      numNights: 3,
      benefits: [
        {
          benefitType: "other",
          label: null,
          dollarValue: null,
          pointsEarnType: "fixed_per_night",
          pointsAmount: 1000,
          pointsMultiplier: null,
        },
      ],
    };
    // 1000 pts × 3 nights × $0.015/pt = $45
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBeCloseTo(45);
  });

  it("multiplier_on_base (no calculationCurrency): (mult-1) × baseRate × nativePretaxCost × centsPerPoint/100", () => {
    // basePointRate = 10, pretaxCost = 80, multiplier = 2.0
    // extraPoints = floor((2-1) × 10 × 80) = 800 pts
    // value = 800 × 0.015 = $12
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      benefits: [
        {
          benefitType: "other",
          label: "Double Base",
          dollarValue: null,
          pointsEarnType: "multiplier_on_base",
          pointsAmount: null,
          pointsMultiplier: 2.0,
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBeCloseTo(12);
  });

  it("multiplier_on_base (with calculationCurrency, Accor): converts pretaxCost via calcCurrencyToUsdRate", () => {
    // Accor: nativePretaxCost=400 EUR, exchangeRate=1.08 (EUR→USD), calcCurrencyToUsdRate=1.08
    // pretaxInEUR = 400 * 1.08 / 1.08 = 400 EUR
    // basePointRate = 25 pts/EUR, multiplier = 2.0
    // extraPoints = floor((2-1) × 25 × 400) = 10000 pts
    // value = 10000 × 0.002 = $20
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      pretaxCost: 400,
      totalCost: 500,
      lockedExchangeRate: 1.08,
      hotelChain: {
        ...mockBaseBooking.hotelChain!,
        basePointRate: 25,
        calculationCurrency: "EUR",
        calcCurrencyToUsdRate: 1.08,
        pointType: { name: "Accor Points", usdCentsPerPoint: 0.002 },
      },
      benefits: [
        {
          benefitType: "other",
          label: null,
          dollarValue: null,
          pointsEarnType: "multiplier_on_base",
          pointsAmount: null,
          pointsMultiplier: 2.0,
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBeCloseTo(20);
  });

  it("uses lockedLoyaltyUsdCentsPerPoint for past bookings", () => {
    // locked at 0.02/pt instead of live 0.015/pt
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      lockedLoyaltyUsdCentsPerPoint: 0.02,
      benefits: [
        {
          benefitType: "other",
          label: null,
          dollarValue: null,
          pointsEarnType: "fixed_per_stay",
          pointsAmount: 1000,
          pointsMultiplier: null,
        },
      ],
    };
    // 1000 pts × $0.02/pt = $20 (not $15 from live rate)
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBeCloseTo(20);
  });

  it("null hotel chain: points benefit contributes $0 gracefully", () => {
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      hotelChainId: null,
      hotelChain: null,
      benefits: [
        {
          benefitType: "other",
          label: null,
          dollarValue: null,
          pointsEarnType: "fixed_per_stay",
          pointsAmount: 1000,
          pointsMultiplier: null,
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBe(0);
  });

  it("chain with null pointType: points benefit contributes $0 gracefully", () => {
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      hotelChain: {
        ...mockBaseBooking.hotelChain!,
        pointType: null,
      },
      benefits: [
        {
          benefitType: "other",
          label: null,
          dollarValue: null,
          pointsEarnType: "fixed_per_stay",
          pointsAmount: 1000,
          pointsMultiplier: null,
        },
      ],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBe(0);
  });

  it("mixed cash + points benefits: both sum into bookingBenefitsValue", () => {
    const booking: NetCostBooking = {
      ...baseBookingWithBenefits,
      benefits: [
        {
          benefitType: "dining_credit",
          label: null,
          dollarValue: 25,
          pointsEarnType: null,
          pointsAmount: null,
          pointsMultiplier: null,
        },
        {
          benefitType: "other",
          label: null,
          dollarValue: null,
          pointsEarnType: "fixed_per_stay",
          pointsAmount: 1000,
          pointsMultiplier: null,
        },
      ],
    };
    // cash: $25, points: 1000 × $0.015 = $15, total = $40
    const result = getNetCostBreakdown(booking);
    expect(result.bookingBenefitsValue).toBeCloseTo(40);
    expect(result.bookingBenefits).toHaveLength(2);
    expect(result.netCost).toBeCloseTo(100 - 40);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- net-cost
```

Expected: all new tests FAIL with errors like "Cannot read properties of undefined (reading 'bookingBenefitsValue')" or similar. The existing tests should still pass.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/lib/net-cost.test.ts
git commit -m "test: add failing unit tests for booking benefits net cost"
```

---

## Task 4: Implement Booking Benefits in `getNetCostBreakdown`

**Files:**

- Modify: `src/lib/net-cost.ts`

- [ ] **Step 1: Add `benefits` to the `NetCostBooking` interface**

Find the `NetCostBooking` interface (around line 65). Add the `benefits` field after `bookingPromotions`:

```ts
benefits?: {
  benefitType: string;
  label: string | null;
  dollarValue: string | number | null;
  pointsEarnType: string | null;
  pointsAmount: number | null;
  pointsMultiplier: string | number | null;
}[];
```

The field is optional (`?`) so existing callers without it don't break.

- [ ] **Step 2: Add `bookingBenefitsValue`, `bookingBenefitsCalc`, `bookingBenefits` to `NetCostBreakdown`**

Find the `NetCostBreakdown` interface (around line 178). Add:

```ts
bookingBenefitsValue: number;
bookingBenefitsCalc: CalculationDetail | undefined; // undefined when no benefits have value; consistent with cardBenefitCalc pattern
bookingBenefits: {
  label: string;
  value: number;
  detail: string;
}
[];
```

- [ ] **Step 3: Add a helper to format benefit type labels**

Add this small helper near the top of `getNetCostBreakdown` (or just before it):

```ts
function formatBenefitLabel(benefitType: string): string {
  const labels: Record<string, string> = {
    free_breakfast: "Free Breakfast",
    dining_credit: "Dining Credit",
    spa_credit: "Spa Credit",
    room_upgrade: "Room Upgrade",
    late_checkout: "Late Checkout",
    early_checkin: "Early Check-in",
    other: "Other Benefit",
  };
  return labels[benefitType] ?? benefitType;
}
```

- [ ] **Step 4: Add the booking benefits calculation section in `getNetCostBreakdown`**

Add this block just before the `// 5. Points RedeemedValue` comment (i.e., after the partnership earns section, around line 1047). Insert as section "4c":

```ts
// 4c. Booking Benefits (cash perks and points awards from the rate/stay)
let bookingBenefitsValue = 0;
let bookingBenefitsCalc: CalculationDetail | undefined;
const bookingBenefits: { label: string; value: number; detail: string }[] = [];

const benefitUsdCentsPerPoint =
  booking.lockedLoyaltyUsdCentsPerPoint != null
    ? Number(booking.lockedLoyaltyUsdCentsPerPoint)
    : booking.hotelChain?.pointType?.usdCentsPerPoint != null
      ? Number(booking.hotelChain.pointType.usdCentsPerPoint)
      : 0;

const benefitCalcCurrencyToUsdRate = booking.hotelChain?.calcCurrencyToUsdRate ?? null;
const benefitCalculationCurrency = booking.hotelChain?.calculationCurrency ?? null;

for (const benefit of booking.benefits ?? []) {
  const benefitLabel = benefit.label || formatBenefitLabel(benefit.benefitType);

  if (benefit.dollarValue != null && Number(benefit.dollarValue) > 0) {
    // Cash benefit: convert native dollarValue to USD
    const usdValue = toUSD(Number(benefit.dollarValue), exchangeRate);
    const currencyCode = booking.currency ?? "USD";
    const detail =
      exchangeRate !== 1
        ? `${formatCurrency(Number(benefit.dollarValue), currencyCode)} × ${exchangeRate} (exchange rate) = ${formatCurrency(usdValue)}`
        : formatCurrency(usdValue);
    bookingBenefits.push({ label: benefitLabel, value: usdValue, detail });
    bookingBenefitsValue += usdValue;
  } else if (benefit.pointsEarnType && benefitUsdCentsPerPoint > 0) {
    const baseRate =
      resolveBasePointRate(booking.hotelChain ?? null, booking.hotelChainSubBrand) ?? 0;
    let extraPoints = 0;
    let detail = "";
    const centsStr = formatCents(benefitUsdCentsPerPoint);

    if (benefit.pointsEarnType === "fixed_per_stay") {
      extraPoints = Math.floor(Number(benefit.pointsAmount ?? 0));
      detail = `${extraPoints.toLocaleString()} pts × ${centsStr}¢ = ${formatCurrency((extraPoints * benefitUsdCentsPerPoint) / 100)}`;
    } else if (benefit.pointsEarnType === "fixed_per_night") {
      const ptsPerNight = Number(benefit.pointsAmount ?? 0);
      extraPoints = Math.floor(ptsPerNight * booking.numNights);
      detail = `${ptsPerNight.toLocaleString()} pts × ${booking.numNights} nights × ${centsStr}¢ = ${formatCurrency((extraPoints * benefitUsdCentsPerPoint) / 100)}`;
    } else if (benefit.pointsEarnType === "multiplier_on_base") {
      const multiplier = Number(benefit.pointsMultiplier ?? 0);
      // Convert pretax spend to the chain's program currency (mirrors the loyalty calculation)
      const pretaxInProgram =
        benefitCalculationCurrency && benefitCalcCurrencyToUsdRate
          ? (nativePretaxCost * exchangeRate) / benefitCalcCurrencyToUsdRate
          : nativePretaxCost;
      extraPoints = Math.floor((multiplier - 1) * baseRate * pretaxInProgram);
      const programCurrencyLabel = benefitCalculationCurrency ?? booking.currency ?? "USD";
      detail = `(${multiplier} − 1) × ${baseRate} pts/${programCurrencyLabel} × ${formatCurrency(pretaxInProgram, programCurrencyLabel)} pretax → ${extraPoints.toLocaleString()} pts × ${centsStr}¢ = ${formatCurrency((extraPoints * benefitUsdCentsPerPoint) / 100)}`;
    }

    const usdValue = (extraPoints * benefitUsdCentsPerPoint) / 100;
    if (usdValue > 0) {
      bookingBenefits.push({ label: benefitLabel, value: usdValue, detail });
      bookingBenefitsValue += usdValue;
    }
  }
}

if (bookingBenefits.length > 0 && bookingBenefitsValue > 0) {
  bookingBenefitsCalc = {
    label: "Booking Benefits",
    appliedValue: bookingBenefitsValue,
    description:
      "The combined value of perks included with this booking. Cash benefits are converted to USD using the booking's exchange rate. Points benefits use the hotel chain's per-point value locked at check-in (or the live rate for future bookings).",
    groups: bookingBenefits
      .filter((b) => b.value > 0)
      .map((b) => ({
        name: b.label,
        segments: [
          {
            label: b.label,
            value: b.value,
            formula: b.detail,
            description: "",
          },
        ],
      })),
  };
}
```

- [ ] **Step 5: Update the `netCost` formula to subtract `bookingBenefitsValue`**

Find the `netCost` calculation (around line 1110) and add `- bookingBenefitsValue`:

```ts
const netCost =
  totalCost -
  promoSavings -
  cardBenefitSavings -
  portalCashback -
  cardReward -
  loyaltyPointsValue -
  partnershipEarnsValue -
  bookingBenefitsValue + // ← new
  pointsRedeemedValue +
  certsValue;
```

- [ ] **Step 6: Add `bookingBenefitsValue`, `bookingBenefitsCalc`, `bookingBenefits` to the return object**

```ts
return {
  totalCost,
  promoSavings,
  promotions,
  cardBenefitSavings,
  cardBenefitCalc,
  portalCashback,
  portalCashbackCalc,
  cardReward,
  cardRewardCalc,
  loyaltyPointsValue,
  loyaltyPointsCalc,
  partnershipEarns,
  partnershipEarnsValue,
  bookingBenefitsValue, // ← new
  bookingBenefitsCalc, // ← new
  bookingBenefits, // ← new
  pointsRedeemedValue,
  pointsRedeemedCalc,
  certsValue,
  certsCalc,
  netCost,
};
```

- [ ] **Step 7: Run unit tests — all should pass now**

```bash
npm test -- net-cost
```

Expected: all tests pass, including the new booking benefits describe block.

- [ ] **Step 8: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors. Fix any type errors before committing.

- [ ] **Step 9: Commit**

```bash
git add src/lib/net-cost.ts src/lib/net-cost.test.ts
git commit -m "feat: implement booking benefits in getNetCostBreakdown"
```

---

## Task 5: API — Accept and Validate New Benefit Fields

**Files:**

- Modify: `src/app/api/bookings/route.ts`
- Modify: `src/app/api/bookings/[id]/route.ts`

The benefit type at the top of both files already imports `BenefitType` from `@prisma/client`. After the schema migration and `npm run db:generate`, `BenefitPointsEarnType` is also available.

**GET routes:** No changes needed. Both `GET /api/bookings` and `GET /api/bookings/[id]` use `benefits: true` in their Prisma include, which automatically returns all columns including the three new ones. Prisma's `include: { benefits: true }` selects all fields on the related model.

- [ ] **Step 1: Add `BenefitPointsEarnType` import to both route files**

In both `route.ts` files, update the Prisma import line:

```ts
import { CertType, BenefitType, BenefitPointsEarnType, AccommodationType } from "@prisma/client";
```

- [ ] **Step 2: Add the benefit validation helper to `route.ts` (POST/GET file)**

Add this function near the top of the file (before the route handlers):

```ts
async function validateBenefits(
  benefits: {
    benefitType?: string;
    dollarValue?: number | null;
    pointsEarnType?: string | null;
    pointsAmount?: number | null;
    pointsMultiplier?: number | null;
  }[],
  hotelChainId: string | null | undefined
): Promise<string | null> {
  for (const b of benefits) {
    const hasPoints = !!b.pointsEarnType;
    const hasDollar = b.dollarValue != null;
    if (hasPoints && hasDollar) {
      return "A benefit cannot have both a dollar value and a points earn type";
    }
    if (hasPoints) {
      if (!hotelChainId) {
        return "Points benefits require a booking with a hotel chain";
      }
      // Verify the chain has a point type
      const chain = await prisma.hotelChain.findUnique({
        where: { id: hotelChainId },
        select: { pointType: { select: { id: true } } },
      });
      if (!chain?.pointType) {
        return "Points benefits require the hotel chain to have a configured loyalty program";
      }
      if (b.pointsEarnType === "fixed_per_stay" || b.pointsEarnType === "fixed_per_night") {
        if (b.pointsAmount == null)
          return "fixed_per_stay and fixed_per_night require pointsAmount";
        if (b.pointsMultiplier != null)
          return "fixed_per_stay and fixed_per_night cannot have pointsMultiplier";
      }
      if (b.pointsEarnType === "multiplier_on_base") {
        if (b.pointsMultiplier == null) return "multiplier_on_base requires pointsMultiplier";
        if (b.pointsAmount != null) return "multiplier_on_base cannot have pointsAmount";
      }
    }
  }
  return null;
}
```

Add the same helper verbatim to `src/app/api/bookings/[id]/route.ts`. Place it at the top of the file, after all `import` statements and before the first route handler function (e.g., before `export async function GET`). The function body is identical — copy it exactly.

- [ ] **Step 3: Update benefit creation in POST route**

Find the benefits `create` block in the POST handler (around line 289). Replace it with:

```ts
benefits: benefits?.length
  ? {
      create: (
        benefits as {
          benefitType: string;
          label?: string;
          dollarValue?: number | null;
          pointsEarnType?: string | null;
          pointsAmount?: number | null;
          pointsMultiplier?: number | null;
        }[]
      )
        .filter((b) => b.benefitType)
        .map((b) => ({
          benefitType: b.benefitType as BenefitType,
          label: b.label || null,
          dollarValue: b.dollarValue != null ? Number(b.dollarValue) : null,
          pointsEarnType: (b.pointsEarnType as BenefitPointsEarnType) || null,
          pointsAmount: b.pointsAmount != null ? Number(b.pointsAmount) : null,
          pointsMultiplier: b.pointsMultiplier != null ? Number(b.pointsMultiplier) : null,
        })),
    }
  : undefined,
```

- [ ] **Step 4: Add validation call in POST handler**

In the POST handler, before the `prisma.booking.create(...)` call, add:

```ts
const benefitValidationError = await validateBenefits(benefits ?? [], hotelChainId);
if (benefitValidationError) {
  return apiError(benefitValidationError, null, 400, request);
}
```

- [ ] **Step 5: Update benefit creation in PUT route**

Find the `prisma.bookingBenefit.createMany` call in the PUT handler (around line 423). Update the `data` mapping:

```ts
data: validBenefits.map((b) => ({
  bookingId: id,
  benefitType: b.benefitType as BenefitType,
  label: b.label || null,
  dollarValue: b.dollarValue != null ? Number(b.dollarValue) : null,
  pointsEarnType: (b.pointsEarnType as BenefitPointsEarnType) || null,
  pointsAmount: b.pointsAmount != null ? Number(b.pointsAmount) : null,
  pointsMultiplier: b.pointsMultiplier != null ? Number(b.pointsMultiplier) : null,
})),
```

Also update the `validBenefits` filter and type:

```ts
const validBenefits = (
  benefits as {
    benefitType: string;
    label?: string;
    dollarValue?: number | null;
    pointsEarnType?: string | null;
    pointsAmount?: number | null;
    pointsMultiplier?: number | null;
  }[]
).filter((b) => b.benefitType);
```

And add validation before the delete/create block in PUT:

```ts
const benefitValidationError = await validateBenefits(benefits ?? [], body.hotelChainId);
if (benefitValidationError) {
  return apiError(benefitValidationError, null, 400, request);
}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Run unit tests to confirm nothing regressed**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/bookings/route.ts src/app/api/bookings/[id]/route.ts
git commit -m "feat: API accepts and validates points benefit fields"
```

---

## Task 6: Dashboard — Add `bookingBenefitsValue` to Total Savings

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update `calcTotalSavings`**

Find `calcTotalSavings` in `src/app/page.tsx` (around line 153):

```ts
function calcTotalSavings(booking: BookingWithRelations): number {
  const { promoSavings, portalCashback, cardReward, loyaltyPointsValue } =
    getNetCostBreakdown(booking);
  return promoSavings + portalCashback + cardReward + loyaltyPointsValue;
}
```

Replace with:

```ts
function calcTotalSavings(booking: BookingWithRelations): number {
  const { promoSavings, portalCashback, cardReward, loyaltyPointsValue, bookingBenefitsValue } =
    getNetCostBreakdown(booking);
  return promoSavings + portalCashback + cardReward + loyaltyPointsValue + bookingBenefitsValue;
}
```

- [ ] **Step 2: Export `calcTotalSavings` from `page.tsx` and add a unit test**

First, change the function declaration in `src/app/page.tsx` from `function calcTotalSavings` to `export function calcTotalSavings` so it can be unit tested.

Then create `src/app/page.test.ts` with:

```ts
import { describe, it, expect, vi } from "vitest";
import { getNetCostBreakdown } from "@/lib/net-cost";
import { calcTotalSavings } from "./page";
import type { BookingWithRelations } from "@/lib/types";

vi.mock("@/lib/net-cost", () => ({
  getNetCostBreakdown: vi.fn().mockReturnValue({
    promoSavings: 10,
    portalCashback: 5,
    cardReward: 8,
    loyaltyPointsValue: 12,
    bookingBenefitsValue: 25,
  }),
}));

describe("calcTotalSavings", () => {
  it("includes bookingBenefitsValue in the total", () => {
    // 10 + 5 + 8 + 12 + 25 = 60
    const result = calcTotalSavings({} as BookingWithRelations);
    expect(result).toBe(60);
  });
});
```

- [ ] **Step 3: TypeScript check + unit tests**

```bash
npx tsc --noEmit && npm test
```

Expected: zero errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: include bookingBenefitsValue in dashboard Total Savings"
```

---

## Task 7: Form Reducer — Expand `BenefitItem`

**Files:**

- Modify: `src/components/bookings/booking-form-reducer.ts`

- [ ] **Step 1: Expand the `BenefitItem` type**

Find `BenefitItem` (around line 14). Replace it:

```ts
export type BenefitItem = {
  type: string;
  label: string;
  // valueType tracks the selected radio button intent explicitly, avoiding ambiguity
  // between "None" and "Cash" when dollarValue is empty.
  valueType: "" | "cash" | "fixed_per_stay" | "fixed_per_night" | "multiplier_on_base";
  dollarValue: string;
  pointsEarnType: string; // '' | 'fixed_per_stay' | 'fixed_per_night' | 'multiplier_on_base'
  pointsAmount: string;
  pointsMultiplier: string;
  _id: string;
};
```

- [ ] **Step 2: Update `makeBenefitItem` default shape**

The function signature already handles `Omit<BenefitItem, '_id'>`. No changes needed to the function itself.

- [ ] **Step 3: Update `ADD_BENEFIT` case**

Find the `ADD_BENEFIT` case (around line 347). Replace the `makeBenefitItem` call:

```ts
case "ADD_BENEFIT":
  return {
    ...state,
    benefits: [
      ...state.benefits,
      makeBenefitItem({
        type: "",
        label: "",
        valueType: "",
        dollarValue: "",
        pointsEarnType: "",
        pointsAmount: "",
        pointsMultiplier: "",
      }),
    ],
  };
```

- [ ] **Step 4: Update initial state loading from existing booking data**

Find where `benefits` are mapped in the `initialData` section (around line 169):

```ts
benefits: initialData.benefits.map((b) => {
  // Derive valueType from the stored data for correct radio state on edit
  const valueType =
    b.pointsEarnType
      ? (b.pointsEarnType as BenefitItem["valueType"])
      : b.dollarValue != null
        ? "cash"
        : "";
  return makeBenefitItem({
    type: b.benefitType,
    label: b.label || "",
    valueType,
    dollarValue: b.dollarValue != null ? String(Number(b.dollarValue)) : "",
    pointsEarnType: b.pointsEarnType || "",
    pointsAmount: b.pointsAmount != null ? String(b.pointsAmount) : "",
    pointsMultiplier: b.pointsMultiplier != null ? String(Number(b.pointsMultiplier)) : "",
  });
}),
```

- [ ] **Step 5: Add `RESET_BENEFIT_POINTS` action for hotel-chain-removal flow**

Add to the action union type (near the other benefit actions):

```ts
| { type: "RESET_BENEFIT_POINTS" }
```

Add the case to the reducer:

```ts
case "RESET_BENEFIT_POINTS":
  return {
    ...state,
    benefits: state.benefits.map((b) =>
      b.pointsEarnType
        ? { ...b, valueType: "", pointsEarnType: "", pointsAmount: "", pointsMultiplier: "" }
        : b
    ),
  };
```

- [ ] **Step 6: Update the booking form's submission mapping**

In `src/components/bookings/booking-form.tsx`, find where benefits are mapped for submission (around line 337). Update:

```ts
benefits: benefits
  .filter((b) => b.type)
  .map((b) => ({
    benefitType: b.type,
    label: b.label || null,
    // Use valueType to determine which fields to send — avoids sending stale
    // field values when the user switched between value types
    dollarValue: b.valueType === "cash" && b.dollarValue ? Number(b.dollarValue) : null,
    pointsEarnType: b.valueType !== "" && b.valueType !== "cash" ? b.valueType : null,
    pointsAmount: b.valueType !== "" && b.valueType !== "cash" && b.pointsAmount ? Number(b.pointsAmount) : null,
    pointsMultiplier: b.valueType !== "" && b.valueType !== "cash" && b.pointsMultiplier ? Number(b.pointsMultiplier) : null,
  })),
```

- [ ] **Step 7: Run unit tests for the reducer**

```bash
npm test -- booking-form-reducer
```

Expected: all existing tests pass.

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/bookings/booking-form-reducer.ts src/components/bookings/booking-form.tsx
git commit -m "feat: expand BenefitItem with points earn fields in form reducer"
```

---

## Task 8: Booking Form UI — Benefit Card Redesign

**Files:**

- Modify: `src/components/bookings/booking-form.tsx`

This task replaces the current single-row benefit layout with a card layout that supports a value-type radio group and conditional input fields.

The form already receives `hotelChains` and the currently selected `hotelChainId`. Derive the selected chain at the top of the benefit rendering section:

```ts
const selectedChain = hotelChains?.find((c) => c.id === hotelChainId) ?? null;
const chainHasLoyalty = !!selectedChain?.pointType;
const chainBasePointRate = selectedChain ? Number(selectedChain.basePointRate ?? 0) : 0;
const chainUsdCentsPerPoint = selectedChain?.pointType
  ? Number(selectedChain.pointType.usdCentsPerPoint)
  : 0;
```

- [ ] **Step 1: Add the hotel-chain-removal useEffect**

In the form component body, add a `useEffect` that fires when `hotelChainId` changes to empty/null and resets any points-type benefits:

```ts
useEffect(() => {
  if (!hotelChainId) {
    dispatch({ type: "RESET_BENEFIT_POINTS" });
  }
}, [hotelChainId]);
```

- [ ] **Step 2: Add a helper to compute approximate dollar value for a benefit**

Add a pure helper function inside or near the component (not exported):

```ts
function calcBenefitApproxValue(
  benefit: BenefitItem,
  numNights: number,
  pretaxCost: string,
  chainBasePointRate: number,
  chainUsdCentsPerPoint: number
): number | null {
  // Use valueType as the discriminator — not pointsEarnType — for consistency
  if (benefit.valueType === "cash") {
    // For cash, the approx value is the entered amount (form operates in native currency)
    const v = Number(benefit.dollarValue || 0);
    return v > 0 ? v : null;
  }
  if (benefit.valueType === "fixed_per_stay") {
    const pts = Number(benefit.pointsAmount || 0);
    return (pts * chainUsdCentsPerPoint) / 100;
  }
  if (benefit.valueType === "fixed_per_night") {
    const pts = Number(benefit.pointsAmount || 0);
    return (pts * numNights * chainUsdCentsPerPoint) / 100;
  }
  if (benefit.valueType === "multiplier_on_base") {
    const mult = Number(benefit.pointsMultiplier || 0);
    const cost = Number(pretaxCost || 0);
    if (!cost) return null; // show "—" when no pretaxCost
    const extraPts = Math.floor((mult - 1) * chainBasePointRate * cost);
    return (extraPts * chainUsdCentsPerPoint) / 100;
  }
  return null;
}
```

- [ ] **Step 3: Replace the benefit row rendering with the new card layout**

Find the benefit rendering block (around line 829 in `booking-form.tsx`). Replace it with:

```tsx
<div className="space-y-2">
  <Label>Booking Benefits</Label>
  <div className="space-y-3">
    {benefits.map((benefit, idx) => {
      const approxValue = calcBenefitApproxValue(
        benefit,
        Number(numNights || 1),
        pretaxCost,
        chainBasePointRate,
        chainUsdCentsPerPoint
      );
      return (
        <div
          key={benefit._id}
          className="p-3 border rounded-lg space-y-3"
          data-testid={`benefit-card-${idx}`}
        >
          {/* Row 1: type + label + remove */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <SelectInput
              value={benefit.type || "none"}
              onChange={(v) =>
                dispatch({
                  type: "UPDATE_BENEFIT",
                  index: idx,
                  field: "type",
                  value: v === "none" ? "" : v,
                })
              }
              options={[{ label: "Select type...", value: "none" }, ...BENEFIT_TYPE_OPTIONS]}
              placeholder="Select type..."
              className="w-full sm:w-56 shrink-0"
              data-testid={`benefit-type-select-${idx}`}
            />
            {benefit.type === "other" && (
              <Input
                placeholder="Label (e.g. Welcome Gift)"
                value={benefit.label}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_BENEFIT",
                    index: idx,
                    field: "label",
                    value: e.target.value,
                  })
                }
                className="flex-1"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "REMOVE_BENEFIT", index: idx })}
              className="shrink-0"
              data-testid={`benefit-remove-${idx}`}
            >
              ✕
            </Button>
          </div>

          {/* Row 2: value type radio — driven by benefit.valueType for correct intent tracking */}
          <div className="flex flex-wrap gap-3 text-sm">
            {(["", "cash", "fixed_per_stay", "fixed_per_night", "multiplier_on_base"] as const).map(
              (vt) => {
                if (vt !== "" && vt !== "cash" && !chainHasLoyalty) return null;
                if (vt === "multiplier_on_base" && !chainBasePointRate) return null;
                const labels: Record<string, string> = {
                  "": "None",
                  cash: "Cash ($)",
                  fixed_per_stay: "Pts/stay",
                  fixed_per_night: "Pts/night",
                  multiplier_on_base: "Multiplier",
                };
                return (
                  <label key={vt} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`benefit-vt-${benefit._id}`}
                      checked={benefit.valueType === vt}
                      onChange={() => {
                        // Always set valueType first so the radio is in the correct state immediately
                        dispatch({
                          type: "UPDATE_BENEFIT",
                          index: idx,
                          field: "valueType",
                          value: vt,
                        });
                        if (vt === "" || vt === "cash") {
                          dispatch({
                            type: "UPDATE_BENEFIT",
                            index: idx,
                            field: "pointsEarnType",
                            value: "",
                          });
                          dispatch({
                            type: "UPDATE_BENEFIT",
                            index: idx,
                            field: "pointsAmount",
                            value: "",
                          });
                          dispatch({
                            type: "UPDATE_BENEFIT",
                            index: idx,
                            field: "pointsMultiplier",
                            value: "",
                          });
                          if (vt === "") {
                            dispatch({
                              type: "UPDATE_BENEFIT",
                              index: idx,
                              field: "dollarValue",
                              value: "",
                            });
                          }
                        } else {
                          dispatch({
                            type: "UPDATE_BENEFIT",
                            index: idx,
                            field: "dollarValue",
                            value: "",
                          });
                          dispatch({
                            type: "UPDATE_BENEFIT",
                            index: idx,
                            field: "pointsEarnType",
                            value: vt,
                          });
                          dispatch({
                            type: "UPDATE_BENEFIT",
                            index: idx,
                            field: "pointsAmount",
                            value: "",
                          });
                          dispatch({
                            type: "UPDATE_BENEFIT",
                            index: idx,
                            field: "pointsMultiplier",
                            value: "",
                          });
                        }
                      }}
                      data-testid={`benefit-vt-${idx}-${vt || "none"}`}
                    />
                    <span>{labels[vt]}</span>
                  </label>
                );
              }
            )}
          </div>

          {/* Row 3: conditional value input — driven by valueType, not field content */}
          {benefit.valueType === "cash" ? (
            // Cash — approxValue is just the entered amount (form uses native currency)
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={benefit.dollarValue}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_BENEFIT",
                    index: idx,
                    field: "dollarValue",
                    value: e.target.value,
                  })
                }
                className="w-32"
                data-testid={`benefit-dollar-${idx}`}
              />
              {approxValue != null && approxValue > 0 && (
                <span className="text-sm text-muted-foreground">
                  ≈ {formatCurrency(approxValue)}
                </span>
              )}
            </div>
          ) : benefit.valueType === "fixed_per_stay" || benefit.valueType === "fixed_per_night" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="number"
                min="0"
                placeholder="Points"
                value={benefit.pointsAmount}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_BENEFIT",
                    index: idx,
                    field: "pointsAmount",
                    value: e.target.value,
                  })
                }
                className="w-32"
                data-testid={`benefit-points-amount-${idx}`}
              />
              <span className="text-sm text-muted-foreground">
                pts{benefit.valueType === "fixed_per_night" ? ` × ${numNights || 1} nights` : ""}
              </span>
              {approxValue != null && approxValue > 0 && (
                <span className="text-sm text-muted-foreground">
                  ≈ {formatCurrency(approxValue)}
                </span>
              )}
            </div>
          ) : benefit.valueType === "multiplier_on_base" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="number"
                min="1"
                step="0.125"
                placeholder="e.g. 2.0"
                value={benefit.pointsMultiplier}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_BENEFIT",
                    index: idx,
                    field: "pointsMultiplier",
                    value: e.target.value,
                  })
                }
                className="w-24"
                data-testid={`benefit-multiplier-${idx}`}
              />
              <span className="text-sm text-muted-foreground">× base</span>
              {approxValue != null ? (
                <span className="text-sm text-muted-foreground">
                  ≈ {formatCurrency(approxValue)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          ) : null}
        </div>
      );
    })}
  </div>
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={() => dispatch({ type: "ADD_BENEFIT" })}
  >
    + Add Benefit
  </Button>
</div>
```

> **Note:** All radio, conditional input, and approximate value logic uses `benefit.valueType` as the single discriminator. `pointsEarnType` in `BenefitItem` mirrors `valueType` for points types and is used only for the API submission payload.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Visual test in browser**

Start `npm run dev`. Create or edit a booking, go to the Booking Benefits section. Verify:

- Adding a benefit shows the card layout
- Selecting "Cash ($)" shows a dollar input
- Selecting "Pts/stay" shows a points input with approximate value
- Selecting "Pts/night" shows points × nights
- Selecting "Multiplier" shows a multiplier input (only if chain has basePointRate)
- Points options are absent when no hotel chain is selected

- [ ] **Step 4: Commit**

```bash
git add src/components/bookings/booking-form.tsx
git commit -m "feat: redesign benefit card with value-type selector in booking form"
```

---

## Task 9: Cost Breakdown UI — Add Booking Benefits Row

**Files:**

- Modify: `src/components/cost-breakdown.tsx`

- [ ] **Step 1: Add `isBenefitsExpanded` state**

At the top of the `CostBreakdown` component, alongside `isPromosExpanded`:

```ts
const [isBenefitsExpanded, setIsBenefitsExpanded] = useState(false);
```

- [ ] **Step 2: Destructure new fields from breakdown**

Add to the destructuring (around line 119):

```ts
bookingBenefitsValue,
bookingBenefitsCalc,
bookingBenefits,
```

- [ ] **Step 3: Add the Booking Benefits expandable row**

Insert this block immediately before the existing `{promotions.length > 0 && (` block:

```tsx
{
  (bookingBenefitsValue ?? 0) > 0 && (
    <div className="space-y-2">
      <button
        className="flex w-full items-center justify-between text-sm hover:bg-muted/50 py-0.5 rounded transition-colors group"
        onClick={() => setIsBenefitsExpanded(!isBenefitsExpanded)}
        data-testid="breakdown-benefits-toggle"
      >
        <div className="flex items-center gap-1.5">
          <span>Booking Benefits</span>
          <CalculationInfo calc={bookingBenefitsCalc} />
          {isBenefitsExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <span data-testid="breakdown-benefits-value" className="text-green-600">
          -{formatCurrency(bookingBenefitsValue ?? 0)}
        </span>
      </button>

      {isBenefitsExpanded && (
        <div className="ml-5 space-y-2 border-l pl-3 py-1" data-testid="breakdown-benefits-list">
          {(bookingBenefits ?? []).map((b, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{b.label}</span>
              <div className="flex items-center gap-2">
                {b.detail && (
                  <span
                    className="text-muted-foreground text-[10px] max-w-[200px] truncate"
                    title={b.detail}
                  >
                    ({b.detail})
                  </span>
                )}
                <span className="text-green-600">-{formatCurrency(b.value)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Visual test in browser**

Open a booking detail page for a booking that has a benefit with `dollarValue` set. Verify the "Booking Benefits" row appears, is green, is clickable, and expands to show individual items. Verify it is above "Promotion Savings".

- [ ] **Step 6: Run all unit tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/cost-breakdown.tsx
git commit -m "feat: add expandable Booking Benefits row to Cost Breakdown"
```

---

## Task 10: E2E Tests

**Files:**

- Create: `e2e/booking-benefits.spec.ts`

Read `e2e/fixtures.ts` before writing — especially the `isolatedUser` fixture and how `testBooking` creates bookings via `POST /api/bookings`.

- [ ] **Step 1: Create the E2E test file**

```ts
import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";

test.describe("Booking Benefits in Cost Breakdown", () => {
  test("cash benefit appears expanded and reduces Net Cost", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // Create a booking with a cash benefit via API
    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [{ benefitType: "free_breakfast", dollarValue: 25 }],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      // Booking Benefits row is visible
      const benefitsToggle = page.getByTestId("breakdown-benefits-toggle");
      await expect(benefitsToggle).toBeVisible();
      await expect(page.getByTestId("breakdown-benefits-value")).toContainText("$25.00");

      // Expand it
      await benefitsToggle.click();
      const benefitsList = page.getByTestId("breakdown-benefits-list");
      await expect(benefitsList).toBeVisible();
      await expect(benefitsList).toContainText("Free Breakfast");

      // Net Cost is reduced
      const netCost = page.getByTestId("breakdown-net-cost");
      await expect(netCost).toContainText("$305.00"); // 330 - 25
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("fixed_per_night points benefit shows correct dollar value", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // Hyatt: 10.5x pts/USD, $0.017/pt
    // 1000 pts × 3 nights × 0.017 = $51.00
    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [
          {
            benefitType: "other",
            label: "Bonus Points",
            pointsEarnType: "fixed_per_night",
            pointsAmount: 1000,
          },
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      const benefitsToggle = page.getByTestId("breakdown-benefits-toggle");
      await expect(benefitsToggle).toBeVisible();

      await benefitsToggle.click();
      const benefitsList = page.getByTestId("breakdown-benefits-list");
      await expect(benefitsList).toContainText("Bonus Points");
      // Value = 1000 × 3 × $0.017 = $51.00
      await expect(page.getByTestId("breakdown-benefits-value")).toContainText("$51.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("multiplier_on_base benefit shows correct dollar value", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // Hyatt: basePointRate=10.5, pretaxCost=300, multiplier=2.0
    // extraPts = floor((2-1) × 10.5 × 300) = 3150 pts
    // value = 3150 × $0.017 = $53.55
    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [
          {
            benefitType: "other",
            label: "Double Base Points",
            pointsEarnType: "multiplier_on_base",
            pointsMultiplier: 2.0,
          },
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      const benefitsToggle = page.getByTestId("breakdown-benefits-toggle");
      await expect(benefitsToggle).toBeVisible();
      await expect(page.getByTestId("breakdown-benefits-value")).toContainText("$53.55");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Booking Benefits row is absent for a booking with purely informational benefits (no value)", async ({
    isolatedUser,
  }) => {
    const { request, page } = isolatedUser;

    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-02",
        numNights: 1,
        pretaxCost: 150,
        taxAmount: 15,
        totalCost: 165,
        currency: "USD",
        benefits: [
          { benefitType: "room_upgrade" }, // no dollarValue, no pointsEarnType
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-benefits-toggle")).not.toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Booking Benefits row is absent for a booking with no benefits at all", async ({
    isolatedUser,
  }) => {
    const { request, page } = isolatedUser;

    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-02",
        numNights: 1,
        pretaxCost: 150,
        taxAmount: 15,
        totalCost: 165,
        currency: "USD",
        benefits: [],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-benefits-toggle")).not.toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
```

> **Note:** `HOTEL_ID.HYATT` is imported from `@/lib/constants` which contains the seeded Hyatt chain ID `"cxjdwg32a8xf7by36md0mdvuu"`. This is the same constant used throughout the codebase.

- [ ] **Step 2: Run E2E tests**

```bash
npm run test:e2e -- --grep "Booking Benefits"
```

Expected: all 5 tests pass.

- [ ] **Step 3: Run full test suite**

```bash
npm test && npm run test:e2e
```

Expected: all pass.

- [ ] **Step 4: Run pre-push checklist**

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add e2e/booking-benefits.spec.ts
git commit -m "test: E2E tests for booking benefits in cost breakdown"
```
