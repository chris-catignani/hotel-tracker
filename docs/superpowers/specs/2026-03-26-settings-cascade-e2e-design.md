# Settings Cascade E2E Tests — Design Spec

**Date:** 2026-03-26
**Issue:** #64 — Write E2E tests for settings pages (remaining cascade work)
**Status:** Approved

---

## Context

PRs #316 and #317 covered basic CRUD E2E for all settings tabs. This spec covers the remaining work: cascading effects when settings change propagate to existing bookings.

Two PRs are planned:

- **PR1** — Server-side recalculation cascades (promotion + loyalty)
- **PR2** — Live-computed net cost reflection (credit cards)

---

## PR1: Server-Side Recalculation Cascades

### API Fix: Sub-brand Base Rate Cascade

**File:** `src/app/api/hotel-chain-sub-brands/[id]/route.ts`

The PUT handler currently updates `basePointRate` without triggering loyalty recalculation. Fix:

1. Add `getAuthenticatedUserId()` call alongside existing `requireAdmin()`
2. Fetch the sub-brand's current `basePointRate` and `hotelChainId` before the update
3. After the update, if `basePointRate` changed, call `recalculateLoyaltyForHotelChain(hotelChainId, userId)`

This mirrors the identical pattern in the hotel chain PUT route.

### Promotion Cascade Tests

**File:** `e2e/promotion-cascading.spec.ts` (3 new tests added to existing file)

**Distinction from existing tests:** The two existing tests in this file cascade via _booking mutations_ (editing or deleting a booking re-evaluates caps on other bookings). The three new tests cascade via _promotion mutations_ (creating, deleting, or updating a promotion re-evaluates which bookings it applies to). These are distinct scenarios.

All new tests are API-only using `isolatedUser` + `testHotelChain` fixtures. `GET /api/bookings/:id` always includes `bookingPromotions` unconditionally — no query parameter needed. Note: the two existing tests in this file call `GET /api/bookings/:id?includePromotions=true`; that query param is silently ignored by the route. New tests should omit it and not copy that stale pattern.

**Test 1: Create promotion → auto-applies to existing booking**

- Create a booking for `testHotelChain` via `isolatedUser.request`
- POST a loyalty promo scoped to that chain with a fixed cashback benefit via `isolatedUser.request`
- Assert `GET /api/bookings/:id` returns `bookingPromotions` containing the new promo with correct `appliedValue`

**Test 2: Delete promotion → removed from booking**

- Create a matching booking + promo via `isolatedUser.request`, verify promo is applied
- `DELETE /api/promotions/:id` via `isolatedUser.request`
- Assert `GET /api/bookings/:id` no longer contains that promo in `bookingPromotions`

**Test 3: Update promotion criteria → booking gains then loses the promo**

- Create a booking for `testHotelChain` via `isolatedUser.request`
- Create a second hotel chain via `adminRequest`; create a promo scoped to that second chain via `isolatedUser.request` — booking has no match (promotions are user-scoped by IDOR protection; all create/PUT calls must use `isolatedUser.request`)
- `PUT /api/promotions/:id` via `isolatedUser.request` to set `hotelChainId` to `testHotelChain.id` — booking gains the promo
- `PUT /api/promotions/:id` via `isolatedUser.request` to revert `hotelChainId` to the second chain — booking loses the promo
- Single test covers both directions to keep fixture setup DRY

### Hotel Chain Loyalty Cascade Tests

**File:** `e2e/settings-hotel-chains.spec.ts` (2 new tests)

**Key constraints:**

- These tests do **not** use the `testHotelChain` fixture (which creates a chain with no `basePointRate`). They create chains inline via `adminRequest` with an explicit `basePointRate: 10` so that `loyaltyPointsEarned` is non-zero and a rate doubling produces a meaningful assertion.
- `recalculateLoyaltyForHotelChain` recalculates only for the requesting user's bookings. Since hotel chain PUT and sub-brand PUT are admin-only routes, `userId` in the recalculation call resolves to the admin user — so bookings must also belong to the admin user. Both tests create bookings via `adminRequest`. These tests intentionally verify the admin's own bookings are updated, consistent with the current per-user scoping of `recalculateLoyaltyForHotelChain` (the multi-user case is a known limitation, out of scope here).
- **Loyalty is only recalculated for past bookings** (checkIn ≤ today). Both tests use a prior-year check-in date to ensure `lockedExchangeRate` is set and the booking is eligible for recalculation.

**Test: Hotel chain base rate change recalculates past bookings**

- Create a chain with `basePointRate: 10` via `adminRequest` (inline, not via fixture)
- Create a past booking for that chain via `adminRequest`
- Record initial `loyaltyPointsEarned`
- `PUT /api/hotel-chains/:id` with `basePointRate: 20` via `adminRequest`
- Assert `loyaltyPointsEarned` on the booking doubled

**Test: Sub-brand base rate change recalculates past bookings**

- Create a chain + sub-brand (sub-brand with `basePointRate: 10`) via `adminRequest` (inline)
- Create a past booking linked to that sub-brand via `adminRequest`
- Record initial `loyaltyPointsEarned`
- `PUT /api/hotel-chain-sub-brands/:id` with `basePointRate: 20` via `adminRequest`
- Assert `loyaltyPointsEarned` on the booking doubled
- **Note:** This test is expected to fail on the current main branch until the sub-brand API fix (above) is applied in the same PR.

**Cleanup order:** Delete booking first, then sub-brand (if any), then chain. The chain DELETE route returns 409 if bookings exist or if sub-brands exist (both conditions must be cleared). The sub-brand DELETE route returns 400 if bookings reference it — so always delete the booking before the sub-brand.

### My Status Cascade Test

**File:** `e2e/settings-my-status.spec.ts` (1 new test)

Uses `isolatedUser` (status changes are user-scoped, not admin).

**Test: Changing elite status recalculates past bookings**

- Create a past booking for the seeded Hyatt chain via `isolatedUser.request` (Hyatt has seeded elite statuses with known bonus percentages)
- Record initial `loyaltyPointsEarned` (base/no status)
- POST to `/api/user-statuses` with Hyatt's Explorist `eliteStatusId`
- Assert `loyaltyPointsEarned` increased
- In `finally` block: restore base status by POST to `/api/user-statuses` with `eliteStatusId: null` (the route upserts; passing null sets the record back to no-status rather than deleting it)

---

## PR2: Live-Computed Net Cost Reflection

Credit card reward values are computed live at read-time — no recalculation is triggered when reference data changes. A test verifies that updating a card's reward rate is immediately visible when viewing an existing booking.

**Note on portals:** `ShoppingPortal` has no portal-level cashback rate field — `portalCashbackRate` lives on `Booking` and is set per-booking at creation time. There is no portal-level rate to change that would cascade to an existing booking's displayed value. Portal cascade tests are therefore not included.

### Credit Card Reward Rate Test

**File:** `e2e/settings-credit-cards.spec.ts` (1 new test)

- Create a booking using a seeded credit card via `isolatedUser.request`
- Navigate to the booking detail page, note the initial card reward value
- Update the card's `rewardRate` via `adminRequest PUT /api/credit-cards/:id`
- Re-navigate to the booking detail page
- Assert the card reward line reflects the updated rate
- Restore original `rewardRate` in `finally` block

---

## What Is Explicitly Out of Scope

- Point Types value changes (issue #64 item 5: core logic needs refining first)
- OTA Agencies (display-only, no numeric cascade)
- Shopping portal cascade (no portal-level rate field; `portalCashbackRate` is per-booking)
- Recalculation for all users when admin changes shared reference data (existing limitation of `recalculateLoyaltyForHotelChain`, separate concern)
