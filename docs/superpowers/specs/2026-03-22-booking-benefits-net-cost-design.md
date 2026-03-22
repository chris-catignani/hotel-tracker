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
  pointsMultiplier Decimal?               @map("points_multiplier") @db.Decimal(5, 2)

  @@map("booking_benefits")
}
```

**No `pointTypeId` or `lockedUsdCentsPerPoint` on the benefit.** Benefit points always belong to the booking's hotel chain program, so:

- Point type is derived from `booking.hotelChain.pointType`
- Locked rate reuses `booking.lockedLoyaltyUsdCentsPerPoint` (already locked at check-in for past bookings)
- Exchange rate cron requires no changes

### Mutual-exclusivity rules (enforced in API validation)

- `dollarValue` and any points field (`pointsEarnType`, `pointsAmount`, `pointsMultiplier`) are mutually exclusive.
- `fixed_per_stay` / `fixed_per_night` require `pointsAmount`; `pointsMultiplier` must be null.
- `multiplier_on_base` requires `pointsMultiplier`; `pointsAmount` must be null.
- If `pointsEarnType` is null, points fields must also be null.

---

## 2. Net Cost Calculation

### Updated `NetCostBooking` interface

```ts
benefits: {
  benefitType: string;
  label: string | null;
  dollarValue: string | number | null;
  pointsEarnType: string | null;
  pointsAmount: number | null;
  pointsMultiplier: string | number | null;
}
[];
```

Point type and locked rate are resolved from the existing booking-level fields already on `NetCostBooking` (`hotelChain.pointType`, `lockedLoyaltyUsdCentsPerPoint`).

### Formulas

| `pointsEarnType`     | Extra points                                                | USD value                          |
| -------------------- | ----------------------------------------------------------- | ---------------------------------- |
| `fixed_per_stay`     | `pointsAmount`                                              | `points × usdCentsPerPoint / 100`  |
| `fixed_per_night`    | `pointsAmount × numNights`                                  | `points × usdCentsPerPoint / 100`  |
| `multiplier_on_base` | `(pointsMultiplier − 1) × basePointRate × nativePretaxCost` | `points × usdCentsPerPoint / 100`  |
| cash (`dollarValue`) | —                                                           | `toUSD(dollarValue, exchangeRate)` |

Where `usdCentsPerPoint` = `lockedLoyaltyUsdCentsPerPoint` if set (past booking), else `hotelChain.pointType.usdCentsPerPoint` (live rate for future bookings). Same fallback logic as the existing loyalty points value calculation.

### Updated net cost formula

```
Net Cost = totalCost + pointsRedeemedValue + certsValue
           − promotionSavings − portalCashback − cardReward
           − cardBenefitSavings − loyaltyPointsValue − partnershipEarnsValue
           − bookingBenefitsValue    ← new
```

`bookingBenefitsValue` = sum of all cash benefit values + sum of all points benefit values (both in USD).

### New fields on `NetCostBreakdown`

```ts
bookingBenefitsValue: number;
bookingBenefitsCalc: CalculationDetail;
bookingBenefits: {
  label: string; // benefit.label ?? formatted benefitType
  value: number; // USD value
  detail: string; // e.g. "2,000 pts × $0.017/pt" or "$25.00" or "2× base (1,200 extra pts)"
}
[];
```

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
  Hyatt Milestone Award            -$34.00   (2,000 pts)
  Bonus Points                     -$12.00   (1,000 pts × 3 nights)
  Double Base Points               -$8.00    (2× base)
Promotion Savings ▶                -$X.XX   ← expandable, existing
──────────────────────────────────────────
Net Cost                            $X.XX
```

- Row only renders if `bookingBenefitsValue > 0`
- Each sub-item label: `benefit.label` if set, otherwise the formatted `benefitType` (e.g. "Free Breakfast")
- Points benefits show point count detail in parentheses alongside the dollar value
- Follows the same expand/collapse pattern as Promotion Savings (local `useState`)

---

## 4. Booking Form UI

Each benefit becomes a small card replacing the current single-row layout:

```
┌────────────────────────────────────────────────────────────┐
│ [benefitType ▾]   [custom label — shown if "other"]   [✕] │
│ Value: ○ None  ○ Cash ($)  ○ Pts/stay  ○ Pts/night  ○ Multiplier │
│   → Cash:       [$25.00              ]                     │
│   → Pts/stay:   [2000  pts]  ≈ $34.00                     │
│   → Pts/night:  [1000  pts] × 3 nights ≈ $51.00           │
│   → Multiplier: [2.0  ×] base  ≈ +1,200 pts               │
└────────────────────────────────────────────────────────────┘
```

- Approximate dollar / point values are computed inline from the booking's hotel chain (if set), giving the user immediate feedback.
- "Pts/stay", "Pts/night", and "Multiplier" options are hidden/disabled when the booking has no hotel chain attached (e.g. apartment bookings).
- "Multiplier" also requires the booking's hotel chain to have a `basePointRate` set.

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

### GET `/api/bookings/[id]`

Include new benefit fields in the Prisma select:

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
- Validate mutual-exclusivity rules before writing
- No changes to locking logic (reuses `lockedLoyaltyUsdCentsPerPoint`)

### Exchange rate cron

No changes required.

---

## 6. Testing

### Unit tests (`net-cost.test.ts`)

- Cash benefit reduces net cost correctly (with exchange rate applied)
- `fixed_per_stay`: correct point × rate calculation
- `fixed_per_night`: correct point × numNights × rate calculation
- `multiplier_on_base`: correct (multiplier − 1) × baseRate × pretaxCost calculation
- Past booking uses `lockedLoyaltyUsdCentsPerPoint`; future booking uses live `usdCentsPerPoint`
- Mixed booking (cash + points benefits): both contribute to `bookingBenefitsValue`
- No hotel chain: points benefit contributes $0 gracefully

### E2E tests

- Add a cash benefit to a booking; verify it appears expanded in Cost Breakdown and reduces Net Cost
- Add a fixed-per-night points benefit; verify correct value shown
- Verify "Booking Benefits" row is absent when no benefits have a value
