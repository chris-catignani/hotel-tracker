# Booking Benefits — Net Cost Integration

**Date:** 2026-03-22
**Status:** Approved

## Overview

Extend `BookingBenefit` to support two value types — cash and points — and wire both into the net cost calculation and Cost Breakdown UI. Benefits with a dollar value reduce net cost directly. Benefits that grant loyalty points are converted to USD at the locked (or live) rate and also reduce net cost. All benefits are shown as an expandable "Booking Benefits" row in the Cost Breakdown card, positioned immediately above "Promotion Savings".

---

## 1. Schema

### New enum

```prisma
enum BenefitPointsEarnType {
  fixed_per_stay
  fixed_per_night
  multiplier_on_base
}
```

### Extended `BookingBenefit` model

Four new nullable columns added to the existing model:

```prisma
model BookingBenefit {
  // existing fields
  id          String      @id @default(cuid())
  bookingId   String      @map("booking_id")
  booking     Booking     @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  benefitType BenefitType @map("benefit_type")
  label       String?
  dollarValue Decimal?    @map("dollar_value") @db.Decimal(10, 2)

  // new fields
  pointsEarnType   BenefitPointsEarnType? @map("points_earn_type")
  pointsAmount     Int?                   @map("points_amount")
  pointsMultiplier Decimal?               @map("points_multiplier") @db.Decimal(6, 3)

  @@map("booking_benefits")
}
```

`pointsMultiplier` uses `Decimal(6, 3)` (3 decimal places) to support fractional multipliers such as `1.125×`.

**No `pointTypeId` or `lockedUsdCentsPerPoint` on the benefit.** Benefit points always belong to the booking's hotel chain program, so:

- Point type is derived from `booking.hotelChain.pointType`
- Locked rate reuses `booking.lockedLoyaltyUsdCentsPerPoint` (already locked at check-in for past bookings)
- Exchange rate cron requires no changes

**Existing data:** All current `BookingBenefit` rows have `dollarValue` set (or null) and all points fields null. These rows remain valid under the new rules — the migration only adds nullable columns.

### Mutual-exclusivity rules (enforced in API validation, HTTP 400 via `api-error.ts`)

- `dollarValue` and any points field (`pointsEarnType`, `pointsAmount`, `pointsMultiplier`) are mutually exclusive.
- `fixed_per_stay` / `fixed_per_night` require `pointsAmount`; `pointsMultiplier` must be null.
- `multiplier_on_base` requires `pointsMultiplier`; `pointsAmount` must be null.
- If `pointsEarnType` is null, points fields must also be null.
- Points benefits (`pointsEarnType` is set) are only valid when the booking has a hotel chain **with a configured loyalty program** (`hotelChainId` is non-null AND the chain has a non-null `pointType`). The API must reject points benefits (HTTP 400) if either condition fails.
- `multiplier_on_base` is only valid for chains where `hotelChain.calculationCurrency` is null. Chains with a non-null `calculationCurrency` (e.g. Accor) would require an additional currency conversion step that is not in scope. The API must reject `multiplier_on_base` benefits (HTTP 400) if `hotelChain.calculationCurrency` is non-null. The form must hide/disable the "Multiplier" option for such chains.

---

## 2. Net Cost Calculation

### Updated `NetCostBooking` interface

The `benefits` array is added to the existing `NetCostBooking` input interface:

```ts
// Added to NetCostBooking
benefits: {
  benefitType: string;
  label: string | null;
  dollarValue: string | number | null;
  pointsEarnType: string | null; // 'fixed_per_stay' | 'fixed_per_night' | 'multiplier_on_base' | null
  pointsAmount: number | null;
  pointsMultiplier: string | number | null;
}
[];
```

Point type and locked rate are resolved from the existing booking-level fields already on `NetCostBooking` (`hotelChain.pointType`, `lockedLoyaltyUsdCentsPerPoint`).

**Null hotel chain / null pointType fallback:** If `hotelChain` or `hotelChain.pointType` is null at calculation time, any points benefit contributes $0 to `bookingBenefitsValue` (graceful degradation — no error thrown).

### `pointsMultiplier` semantics

The stored value is the **total multiplier**, not the increment. A value of `2.0` means "earn 2× base points total". The formula uses `(pointsMultiplier − 1)` to compute the **extra** points beyond the normal base earn. The form input label and detail string both express this as "2× base", consistent with the stored value being the total multiplier.

### Formulas

| `pointsEarnType`     | Extra points                                                                | USD value                                |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| `fixed_per_stay`     | `pointsAmount`                                                              | `floor(points) × usdCentsPerPoint / 100` |
| `fixed_per_night`    | `pointsAmount × numNights`                                                  | `floor(points) × usdCentsPerPoint / 100` |
| `multiplier_on_base` | `(pointsMultiplier − 1) × resolveBasePointRate(booking) × nativePretaxCost` | `floor(points) × usdCentsPerPoint / 100` |
| cash (`dollarValue`) | —                                                                           | `toUSD(dollarValue, exchangeRate)`       |

**Rounding:** Apply `Math.floor()` to all point counts before converting to USD, consistent with the existing loyalty points calculation.

**`multiplier_on_base` — units clarification:** `nativePretaxCost` = `Number(booking.pretaxCost)` — the raw booking-currency amount (same variable used in the existing `getNetCostBreakdown` loyalty section). `resolveBasePointRate(booking)` returns points per unit of the booking's **native currency** (e.g. points/JPY for a JPY booking, points/USD for a USD booking). This is exactly the same interpretation as the existing loyalty auto-calculation and produces consistent results. This formula is only valid for chains with `calculationCurrency` = null (enforced in Section 1).

**`usdCentsPerPoint`** = `lockedLoyaltyUsdCentsPerPoint` if set (past booking), else `hotelChain.pointType.usdCentsPerPoint` (live rate for future bookings). Same fallback logic as the existing loyalty points value calculation.

### Updated net cost formula

```
Net Cost = totalCost + pointsRedeemedValue + certsValue
           − promotionSavings − portalCashback − cardReward
           − cardBenefitSavings − loyaltyPointsValue − partnershipEarnsValue
           − bookingBenefitsValue    ← new
```

`bookingBenefitsValue` = sum of all cash benefit values + sum of all points benefit values (both in USD).

### Dashboard "Total Savings"

`bookingBenefitsValue` **is included** in the dashboard aggregate Total Savings figure, alongside `promoSavings`, `portalCashback`, `cardReward`, and `loyaltyPointsValue`. Rationale: booking benefits are direct monetary savings of the same kind as promotions and portal cashback. The `calcTotalSavings` helper in `src/app/page.tsx` must be updated to add `bookingBenefitsValue`. Note: `cardBenefitSavings` and `partnershipEarnsValue` are currently absent from `calcTotalSavings` — that is a pre-existing gap tracked separately and is out of scope here.

### New fields on `NetCostBreakdown`

```ts
bookingBenefitsValue: number;
bookingBenefitsCalc: CalculationDetail;
bookingBenefits: {
  label: string; // benefit.label ?? formatted benefitType
  value: number; // USD value
  detail: string; // see detail string spec below
}
[];
```

### `bookingBenefitsCalc` content

The `CalculationDetail` for the "Booking Benefits" info dialog:

- `label`: `"Booking Benefits"`
- `description`: `"The combined value of perks included with this booking. Cash benefits are converted to USD using the booking's exchange rate. Points benefits use the hotel chain's per-point value locked at check-in (or the live rate for future bookings)."`
- `groups`: one group per benefit that has a non-zero value, each with a single segment:
  - `label`: same as the sub-item label (benefit.label ?? formatted benefitType)
  - `formula`: the calculation string (see examples below)
  - `value`: the USD value of this benefit
- `appliedValue`: `bookingBenefitsValue`

**Formula string examples** (use the booking's native currency code, not a hardcoded `$`):

- Cash (USD booking): `"$25.00 × 1.0 (USD) = $25.00"`
- Cash (EUR booking): `"€30.00 × 1.08 (EUR/USD rate) = $32.40"`
- Fixed per stay: `"2,000 pts × $0.017/pt = $34.00"`
- Fixed per night: `"1,000 pts × 3 nights × $0.004/pt = $12.00"`
- Multiplier (USD booking): `"(2.0 − 1) × 10.5 pts/USD × $300 pretax → 3,150 pts × $0.017/pt = $53.55"`
- Multiplier (JPY booking): `"(2.0 − 1) × 0.1 pts/JPY × ¥40,000 pretax → 4,000 pts × $0.017/pt = $68.00"`

---

## 3. Cost Breakdown UI

New expandable "Booking Benefits" row placed immediately above "Promotion Savings":

```
Portal Cashback                    -$X.XX
Card Reward                        -$X.XX
Card Benefits                      -$X.XX
Loyalty Points Value               -$X.XX
[Partnership Earns]                -$X.XX
Booking Benefits ▶                 -$71.00   ← expandable, new
  Free Breakfast                   -$25.00
  Hyatt Milestone Award            -$34.00   (2,000 pts × $0.017/pt)
  Bonus Points                     -$12.00   (1,000 pts × 3 nights × $0.004/pt)
  Double Base Points               -$8.00    (2.0× base → 1,200 extra pts × $0.017/pt)
Promotion Savings ▶                -$X.XX    ← expandable, existing
──────────────────────────────────────────
Net Cost                            $X.XX
```

- Row only renders if `bookingBenefitsValue > 0`
- The expand/collapse toggle always renders when the row is visible, even with a single benefit item, for consistency with the Promotion Savings pattern
- Each sub-item shows the **USD value** (the converted amount, not the native amount)
- For non-USD cash benefits, the parenthetical detail shows the conversion: e.g. `(€30.00 × 1.08 = $32.40)`
- Points benefits show the points calculation detail in parentheses
- Follows the same expand/collapse pattern as Promotion Savings (local `useState`)

---

## 4. Booking Form UI

Each benefit becomes a small card replacing the current single-row layout:

```
┌────────────────────────────────────────────────────────────┐
│ [benefitType ▾]   [custom label — shown if "other"]   [✕] │
│ Value: ○ None  ○ Cash ($)  ○ Pts/stay  ○ Pts/night  ○ Multiplier │
│   → Cash:       [$25.00              ]  ≈ $25.00           │
│   → Pts/stay:   [2000  pts]             ≈ $34.00           │
│   → Pts/night:  [1000  pts] × 3 nights  ≈ $51.00          │
│   → Multiplier: [2.0  ×] base           ≈ $8.00            │
└────────────────────────────────────────────────────────────┘
```

- All four value types show an approximate **dollar value** inline, computed from the booking's hotel chain's live `usdCentsPerPoint` (not the locked rate — the form always operates on current values).
- If `pretaxCost` is not yet entered (empty or zero), the multiplier approximate value shows `"—"` rather than $0.00.
- "Pts/stay", "Pts/night", and "Multiplier" options are hidden/disabled when the booking has no hotel chain attached (e.g. apartment bookings).
- "Multiplier" is additionally hidden/disabled when the booking's hotel chain has a non-null `calculationCurrency` (e.g. Accor).
- "Multiplier" also requires the booking's hotel chain to have a `basePointRate` set.
- If the user switches value type, the fields from the previous type are cleared in form state (e.g. switching from "Pts/stay" to "Cash" clears `pointsAmount`; switching from "Cash" to "Pts/night" clears `dollarValue`).
- **Edit flow — hotel chain removal:** When the hotel chain is deselected, reset any benefits whose `pointsEarnType` is non-empty to `''` (None) immediately via a `useEffect` watching `hotelChainId` in the form reducer/component.

### Updated `BenefitItem` form state

```ts
export type BenefitItem = {
  type: string;
  label: string;
  // cash
  dollarValue: string;
  // points
  pointsEarnType: string; // '' | 'fixed_per_stay' | 'fixed_per_night' | 'multiplier_on_base'
  pointsAmount: string;
  pointsMultiplier: string;
  _id: string;
};
```

---

## 5. API Changes

### GET `/api/bookings` (list) and GET `/api/bookings/[id]` (detail)

Both endpoints must include the new benefit fields in their Prisma select so that `getNetCostBreakdown` receives the full benefit data:

```ts
benefits: {
  select: {
    id: true,
    benefitType: true,
    label: true,
    dollarValue: true,
    pointsEarnType: true,
    pointsAmount: true,
    pointsMultiplier: true,
  }
}
```

### POST `/api/bookings` + PUT `/api/bookings/[id]`

- Accept new fields on each benefit in the request body
- Validate mutual-exclusivity rules before writing; return HTTP 400 via `api-error.ts` on violation
- Reject points benefits (HTTP 400) if the booking has no `hotelChainId` or the chain has no `pointType`
- Reject `multiplier_on_base` benefits (HTTP 400) if the hotel chain has a non-null `calculationCurrency`
- No changes to locking logic (reuses `lockedLoyaltyUsdCentsPerPoint`)

### Exchange rate cron

No changes required.

---

## 6. Testing

### Unit tests (`net-cost.test.ts`)

- Cash benefit (USD booking) reduces net cost correctly
- Cash benefit (non-USD booking) applies exchange rate correctly
- `fixed_per_stay`: correct floor(points) × rate calculation
- `fixed_per_night`: correct floor(points × numNights) × rate calculation
- `multiplier_on_base`: correct floor((multiplier − 1) × baseRate × nativePretaxCost) calculation
- Past booking uses `lockedLoyaltyUsdCentsPerPoint`; future booking uses live `usdCentsPerPoint`
- Mixed booking (cash + points benefits): both contribute to `bookingBenefitsValue`
- No hotel chain (or chain with no pointType): points benefit contributes $0 gracefully
- `bookingBenefitsValue` is included in Total Savings alongside other savings types

### E2E tests

- Add a cash benefit to a booking that has no other benefits; verify the "Booking Benefits" row appears, is expandable, and reduces Net Cost
- Add a `fixed_per_night` points benefit; verify correct dollar value shown in Cost Breakdown
- Add a `multiplier_on_base` benefit; verify correct dollar value shown in Cost Breakdown
- Verify "Booking Benefits" row is absent for a booking with `BookingBenefit` rows that have no `dollarValue` and no `pointsEarnType` set (purely informational benefits)
- Verify "Booking Benefits" row is absent for a booking with no `BookingBenefit` rows at all
