# Settings Cascade E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix loyalty recalculation to cover all users when an admin changes shared chain/sub-brand rates, then add E2E tests for promotion cascades, loyalty cascades, My Status cascade, and credit card live-computed net cost reflection.

**Architecture:** Two PRs — PR1 fixes `recalculateLoyaltyForHotelChain` to accept an optional `userId` (omit = all users), updates the hotel chain and sub-brand PUT routes to use the all-users path, then adds cascade E2E tests that exercise the cross-user scenario. PR2 adds a single UI-driven test verifying that a credit card `rewardRate` change is immediately visible in an existing booking's cost breakdown.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6, PostgreSQL, Playwright (E2E), Vitest (unit)

**Spec:** `docs/superpowers/specs/2026-03-26-settings-cascade-e2e-design.md`

---

## Key Reference Points

- `src/lib/loyalty-recalculation.ts` — function to fix; `userId` becomes optional
- `src/lib/loyalty-recalculation.test.ts` — unit tests to update
- `src/app/api/hotel-chains/[id]/route.ts:99` — call site to update (drop userId)
- `src/app/api/hotel-chain-sub-brands/[id]/route.ts` — add cascade trigger here
- `e2e/fixtures.ts` — fixture definitions; `isolatedUser`, `adminRequest`, `testHotelChain`
- `e2e/promotion-cascading.spec.ts` — append 3 new tests here
- `e2e/settings-hotel-chains.spec.ts` — append 2 new cascade tests here
- `e2e/settings-my-status.spec.ts` — append 1 new cascade test here
- `e2e/settings-credit-cards.spec.ts` — append 1 new UI test here (PR2)
- `src/components/cost-breakdown.tsx` — `data-testid="breakdown-card-reward"` is the assertion target for PR2
- `src/lib/constants.ts` — `HOTEL_ID.HYATT` = `"cxjdwg32a8xf7by36md0mdvuu"` (has Explorist/Globalist statuses)
- Run unit tests: `npx vitest run src/lib/loyalty-recalculation.test.ts`
- Run E2E tests by file: `npx playwright test e2e/<file>.spec.ts`
- Run all E2E: `npx playwright test`

---

## PR1 — Server-Side Cascade Fix + Tests

---

### Task 1: Make `recalculateLoyaltyForHotelChain` support all-users recalculation

**Files:**

- Modify: `src/lib/loyalty-recalculation.ts`
- Modify: `src/lib/loyalty-recalculation.test.ts`

The current signature is `recalculateLoyaltyForHotelChain(hotelChainId: string, userId: string)`.
When `userId` is omitted the function should query all users' past bookings instead of filtering to one user.
The tricky part: `userStatuses` (used to look up elite status for point multipliers) is currently fetched per-user.
When running for all users, we need to either:

- Fetch all `userStatuses` for the chain and group by `userId`, then compute per-user
- Or run the existing per-user logic once per distinct userId found in the bookings

The simplest correct approach: when `userId` is omitted, fetch all past bookings for the chain (no userId filter), group them by `userId`, then for each unique userId run the existing per-user recalculation logic (i.e., call the per-user path in a loop). This reuses all existing logic with minimal change and avoids reimplementing the status-lookup.

- [ ] **Step 1: Update the function signature and add a short-circuit all-users path**

In `src/lib/loyalty-recalculation.ts`, change:

```typescript
export async function recalculateLoyaltyForHotelChain(
  hotelChainId: string,
  userId: string
): Promise<void> {
```

to:

```typescript
export async function recalculateLoyaltyForHotelChain(
  hotelChainId: string,
  userId?: string
): Promise<void> {
  // When no userId provided, fan out to all users who have past bookings for this chain
  if (!userId) {
    const usersWithBookings = await prisma.booking.findMany({
      where: {
        hotelChainId,
        checkIn: { lte: new Date() },
      },
      select: { userId: true },
      distinct: ["userId"],
    });
    await Promise.all(
      usersWithBookings.map((b) => recalculateLoyaltyForHotelChain(hotelChainId, b.userId))
    );
    return;
  }
```

No other changes to the function body — the rest already works correctly for a single userId.

- [ ] **Step 2: Run existing unit tests to confirm no regressions**

```bash
npx vitest run src/lib/loyalty-recalculation.test.ts
```

Expected: all 5 tests pass (they all pass a userId so hit the unchanged code path).

- [ ] **Step 3: Add a unit test for the all-users fan-out path**

In `src/lib/loyalty-recalculation.test.ts`, add inside the `describe` block:

```typescript
it("should fan out to all users with past bookings when userId is omitted", async () => {
  // booking.findMany for distinct users returns two userIds
  prismaMock.booking.findMany
    .mockResolvedValueOnce([{ userId: "user-a" }, { userId: "user-b" }]) // distinct query
    .mockResolvedValue([]); // per-user queries return no bookings → early exit

  prismaMock.hotelChain.findUnique.mockResolvedValue({
    id: "1",
    basePointRate: 10,
    hotelChainSubBrands: [],
    userStatuses: [],
  });

  await recalculateLoyaltyForHotelChain("1"); // no userId

  // findMany called 3 times: once for distinct users, once per user (2 users × 1 = 2)
  expect(prismaMock.booking.findMany).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 4: Run tests to confirm new test passes**

```bash
npx vitest run src/lib/loyalty-recalculation.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/loyalty-recalculation.ts src/lib/loyalty-recalculation.test.ts
git commit -m "feat: make recalculateLoyaltyForHotelChain support all-users recalculation"
```

---

### Task 2: Update hotel chain PUT route to recalculate for all users

**Files:**

- Modify: `src/app/api/hotel-chains/[id]/route.ts`

Currently line 99:

```typescript
await recalculateLoyaltyForHotelChain(id, userId);
```

- [ ] **Step 1: Remove the `userId` argument from the call site**

Change line 99 from:

```typescript
await recalculateLoyaltyForHotelChain(id, userId);
```

to:

```typescript
await recalculateLoyaltyForHotelChain(id);
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/hotel-chains/[id]/route.ts
git commit -m "fix: recalculate loyalty for all users when hotel chain base rate changes"
```

---

### Task 3: Add loyalty cascade trigger to sub-brand PUT route

**Files:**

- Modify: `src/app/api/hotel-chain-sub-brands/[id]/route.ts`

Currently the PUT handler has no loyalty recalculation. It needs to:

1. Import `recalculateLoyaltyForHotelChain`
2. Fetch existing sub-brand before the update to get `hotelChainId` and current `basePointRate`
3. After updating, call `recalculateLoyaltyForHotelChain(hotelChainId)` if `basePointRate` changed

- [ ] **Step 1: Rewrite the PUT handler**

Replace the current PUT handler in `src/app/api/hotel-chain-sub-brands/[id]/route.ts` with:

```typescript
import { recalculateLoyaltyForHotelChain } from "@/lib/loyalty-recalculation";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const body = await request.json();
    const { name, basePointRate } = body;

    // Fetch existing sub-brand to detect rate change and get hotelChainId
    const existing = await prisma.hotelChainSubBrand.findUnique({
      where: { id },
      select: { hotelChainId: true, basePointRate: true },
    });
    if (!existing) {
      return apiError("Sub-brand not found", null, 404, request, { subBrandId: id });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (basePointRate !== undefined)
      data.basePointRate = basePointRate != null ? Number(basePointRate) : null;

    const subBrand = await prisma.hotelChainSubBrand.update({
      where: { id },
      data,
    });

    // Recalculate loyalty for all users if basePointRate changed
    const rateChanged =
      basePointRate !== undefined && Number(existing.basePointRate) !== Number(basePointRate);
    if (rateChanged) {
      await recalculateLoyaltyForHotelChain(existing.hotelChainId);
    }

    return NextResponse.json(subBrand);
  } catch (error) {
    return apiError("Failed to update sub-brand", error, 500, request, { subBrandId: id });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/hotel-chain-sub-brands/[id]/route.ts
git commit -m "feat: recalculate loyalty for all users when sub-brand base rate changes"
```

---

### Task 4: Promotion cascade E2E tests

**Files:**

- Modify: `e2e/promotion-cascading.spec.ts`

Add three new tests to the existing `"Promotion Cascading Re-evaluation"` describe block.

**Important rules for these tests:**

- All API calls use `isolatedUser.request` (promotions are IDOR-protected by userId — only the creating user can update/delete them)
- Do NOT copy the `?includePromotions=true` pattern from the existing tests — it does nothing (the route always includes `bookingPromotions`)
- Clean up all created resources in a `finally` block or via explicit deletes after assertions
- Use `testHotelChain` fixture (chain with no basePointRate — fine here since we're testing promotion application, not loyalty points)

- [ ] **Step 1: Add Test 1 — create promotion auto-applies to existing booking**

Append to `e2e/promotion-cascading.spec.ts`:

```typescript
test("should auto-apply a new promotion to an existing matching booking", async ({
  isolatedUser,
  testHotelChain,
}) => {
  const bookingRes = await isolatedUser.request.post("/api/bookings", {
    data: {
      hotelChainId: testHotelChain.id,
      propertyName: `Cascade Create ${crypto.randomUUID()}`,
      checkIn: `${YEAR}-04-01`,
      checkOut: `${YEAR}-04-03`,
      numNights: 2,
      pretaxCost: 200,
      taxAmount: 20,
      totalCost: 220,
    },
  });
  expect(bookingRes.ok()).toBeTruthy();
  const booking = await bookingRes.json();

  const promoRes = await isolatedUser.request.post("/api/promotions", {
    data: {
      name: `Auto Apply ${crypto.randomUUID()}`,
      type: "loyalty",
      hotelChainId: testHotelChain.id,
      benefits: [{ rewardType: "cashback", valueType: "fixed", value: 30, sortOrder: 0 }],
    },
  });
  expect(promoRes.ok()).toBeTruthy();
  const promo = await promoRes.json();

  try {
    const refreshRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
    expect(refreshRes.ok()).toBeTruthy();
    const refreshed = await refreshRes.json();
    const bp = (refreshed.bookingPromotions ?? []).find((p: any) => p.promotionId === promo.id);
    expect(bp).toBeDefined();
    expect(Number(bp.appliedValue)).toBe(30);
  } finally {
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  }
});
```

- [ ] **Step 2: Add Test 2 — deleting a promotion removes it from the booking**

```typescript
test("should remove a promotion from its booking when the promotion is deleted", async ({
  isolatedUser,
  testHotelChain,
}) => {
  const bookingRes = await isolatedUser.request.post("/api/bookings", {
    data: {
      hotelChainId: testHotelChain.id,
      propertyName: `Cascade Delete ${crypto.randomUUID()}`,
      checkIn: `${YEAR}-05-01`,
      checkOut: `${YEAR}-05-03`,
      numNights: 2,
      pretaxCost: 200,
      taxAmount: 20,
      totalCost: 220,
    },
  });
  expect(bookingRes.ok()).toBeTruthy();
  const booking = await bookingRes.json();

  const promoRes = await isolatedUser.request.post("/api/promotions", {
    data: {
      name: `Delete Promo ${crypto.randomUUID()}`,
      type: "loyalty",
      hotelChainId: testHotelChain.id,
      benefits: [{ rewardType: "cashback", valueType: "fixed", value: 40, sortOrder: 0 }],
    },
  });
  expect(promoRes.ok()).toBeTruthy();
  const promo = await promoRes.json();

  // Confirm promo is applied
  const beforeRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
  const before = await beforeRes.json();
  expect(
    (before.bookingPromotions ?? []).some((p: any) => p.promotionId === promo.id)
  ).toBeTruthy();

  try {
    // Delete the promotion
    const delRes = await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
    expect(delRes.ok()).toBeTruthy();

    // Confirm promo is gone from booking
    const afterRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
    const after = await afterRes.json();
    expect(
      (after.bookingPromotions ?? []).some((p: any) => p.promotionId === promo.id)
    ).toBeFalsy();
  } finally {
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    // promo already deleted; ignore 404
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`).catch(() => {});
  }
});
```

- [ ] **Step 3: Add Test 3 — updating promotion criteria makes booking gain then lose it**

```typescript
test("should apply/remove a promotion to a booking when criteria change", async ({
  isolatedUser,
  adminRequest,
  testHotelChain,
}) => {
  // Create a second chain to scope the promo to initially (no match)
  const otherChainRes = await adminRequest.post("/api/hotel-chains", {
    data: { name: `Other Chain ${crypto.randomUUID()}` },
  });
  expect(otherChainRes.ok()).toBeTruthy();
  const otherChain = await otherChainRes.json();

  const bookingRes = await isolatedUser.request.post("/api/bookings", {
    data: {
      hotelChainId: testHotelChain.id,
      propertyName: `Cascade Update ${crypto.randomUUID()}`,
      checkIn: `${YEAR}-06-01`,
      checkOut: `${YEAR}-06-03`,
      numNights: 2,
      pretaxCost: 200,
      taxAmount: 20,
      totalCost: 220,
    },
  });
  expect(bookingRes.ok()).toBeTruthy();
  const booking = await bookingRes.json();

  // Promo scoped to otherChain → no match with booking
  const promoRes = await isolatedUser.request.post("/api/promotions", {
    data: {
      name: `Update Criteria ${crypto.randomUUID()}`,
      type: "loyalty",
      hotelChainId: otherChain.id,
      benefits: [{ rewardType: "cashback", valueType: "fixed", value: 50, sortOrder: 0 }],
    },
  });
  expect(promoRes.ok()).toBeTruthy();
  const promo = await promoRes.json();

  try {
    // No match yet
    const noMatchRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
    const noMatch = await noMatchRes.json();
    expect(
      (noMatch.bookingPromotions ?? []).some((p: any) => p.promotionId === promo.id)
    ).toBeFalsy();

    // Update promo to match testHotelChain → booking gains it
    const gainRes = await isolatedUser.request.put(`/api/promotions/${promo.id}`, {
      data: { hotelChainId: testHotelChain.id },
    });
    expect(gainRes.ok()).toBeTruthy();

    const gainedRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
    const gained = await gainedRes.json();
    const gainedBp = (gained.bookingPromotions ?? []).find((p: any) => p.promotionId === promo.id);
    expect(gainedBp).toBeDefined();
    expect(Number(gainedBp.appliedValue)).toBe(50);

    // Revert promo back to otherChain → booking loses it
    const loseRes = await isolatedUser.request.put(`/api/promotions/${promo.id}`, {
      data: { hotelChainId: otherChain.id },
    });
    expect(loseRes.ok()).toBeTruthy();

    const lostRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
    const lost = await lostRes.json();
    expect((lost.bookingPromotions ?? []).some((p: any) => p.promotionId === promo.id)).toBeFalsy();
  } finally {
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
    await adminRequest.delete(`/api/hotel-chains/${otherChain.id}`);
  }
});
```

- [ ] **Step 4: Run the new promotion cascade tests**

```bash
npx playwright test e2e/promotion-cascading.spec.ts
```

Expected: all 5 tests pass (2 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add e2e/promotion-cascading.spec.ts
git commit -m "test: promotion create/delete/update cascade E2E tests"
```

---

### Task 5: Hotel chain loyalty cascade E2E tests

**Files:**

- Modify: `e2e/settings-hotel-chains.spec.ts`

Two new tests. Key setup rules:

- Do NOT use the `testHotelChain` fixture — it creates a chain with no `basePointRate` (loyalty points would be 0, so "doubled" = still 0)
- Create chains inline with explicit `basePointRate: 10` via `adminRequest`
- Create bookings via `isolatedUser.request` (cross-user scenario — this is what the fix enables)
- Use prior-year check-in so `lockedExchangeRate` is set (recalculation only applies to past bookings)
- Cleanup order: booking → sub-brand (if any) → chain (chain DELETE returns 409 if either exist)

- [ ] **Step 1: Add the hotel chain base rate cascade test**

Append to `e2e/settings-hotel-chains.spec.ts` (inside the existing `"Settings — Hotel Chains"` describe block):

```typescript
test("recalculates loyalty points for all users when base point rate changes", async ({
  isolatedUser,
  adminRequest,
}) => {
  const pastYear = new Date().getFullYear() - 1;
  const chainRes = await adminRequest.post("/api/hotel-chains", {
    data: { name: `Rate Cascade Chain ${crypto.randomUUID()}`, basePointRate: 10 },
  });
  expect(chainRes.ok()).toBeTruthy();
  const chain = await chainRes.json();

  const bookingRes = await isolatedUser.request.post("/api/bookings", {
    data: {
      hotelChainId: chain.id,
      propertyName: `Rate Cascade Hotel ${crypto.randomUUID()}`,
      checkIn: `${pastYear}-06-01`,
      checkOut: `${pastYear}-06-05`,
      numNights: 4,
      pretaxCost: 100,
      taxAmount: 10,
      totalCost: 110,
    },
  });
  expect(bookingRes.ok()).toBeTruthy();
  const booking = await bookingRes.json();
  const initialPoints = Number(booking.loyaltyPointsEarned);
  expect(initialPoints).toBeGreaterThan(0);

  try {
    // Admin doubles the base rate
    const updateRes = await adminRequest.put(`/api/hotel-chains/${chain.id}`, {
      data: { basePointRate: 20 },
    });
    expect(updateRes.ok()).toBeTruthy();

    // Isolated user's booking should have doubled points
    const refreshRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
    expect(refreshRes.ok()).toBeTruthy();
    const refreshed = await refreshRes.json();
    expect(Number(refreshed.loyaltyPointsEarned)).toBe(initialPoints * 2);
  } finally {
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await adminRequest.delete(`/api/hotel-chains/${chain.id}`);
  }
});
```

- [ ] **Step 2: Add the sub-brand base rate cascade test**

```typescript
test("recalculates loyalty points for all users when sub-brand base rate changes", async ({
  isolatedUser,
  adminRequest,
}) => {
  const pastYear = new Date().getFullYear() - 1;

  // Create chain with no base rate (sub-brand rate will be the only rate)
  const chainRes = await adminRequest.post("/api/hotel-chains", {
    data: { name: `Sub-brand Cascade Chain ${crypto.randomUUID()}` },
  });
  expect(chainRes.ok()).toBeTruthy();
  const chain = await chainRes.json();

  const sbRes = await adminRequest.post(`/api/hotel-chains/${chain.id}/hotel-chain-sub-brands`, {
    data: { name: `Sub-brand ${crypto.randomUUID()}`, basePointRate: 10 },
  });
  expect(sbRes.ok()).toBeTruthy();
  const subBrand = await sbRes.json();

  const bookingRes = await isolatedUser.request.post("/api/bookings", {
    data: {
      hotelChainId: chain.id,
      hotelChainSubBrandId: subBrand.id,
      propertyName: `Sub-brand Cascade Hotel ${crypto.randomUUID()}`,
      checkIn: `${pastYear}-07-01`,
      checkOut: `${pastYear}-07-05`,
      numNights: 4,
      pretaxCost: 100,
      taxAmount: 10,
      totalCost: 110,
    },
  });
  expect(bookingRes.ok()).toBeTruthy();
  const booking = await bookingRes.json();
  const initialPoints = Number(booking.loyaltyPointsEarned);
  expect(initialPoints).toBeGreaterThan(0);

  try {
    // Admin doubles the sub-brand rate
    const updateRes = await adminRequest.put(`/api/hotel-chain-sub-brands/${subBrand.id}`, {
      data: { basePointRate: 20 },
    });
    expect(updateRes.ok()).toBeTruthy();

    // Isolated user's booking should have doubled points
    const refreshRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
    expect(refreshRes.ok()).toBeTruthy();
    const refreshed = await refreshRes.json();
    expect(Number(refreshed.loyaltyPointsEarned)).toBe(initialPoints * 2);
  } finally {
    // Must delete booking before sub-brand (400 if referenced), sub-brand before chain (409 if exists)
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await adminRequest.delete(`/api/hotel-chain-sub-brands/${subBrand.id}`);
    await adminRequest.delete(`/api/hotel-chains/${chain.id}`);
  }
});
```

- [ ] **Step 3: Run the hotel chain cascade tests**

```bash
npx playwright test e2e/settings-hotel-chains.spec.ts
```

Expected: all tests pass (4 existing + 2 new).

- [ ] **Step 4: Commit**

```bash
git add e2e/settings-hotel-chains.spec.ts
git commit -m "test: hotel chain and sub-brand base rate cascade E2E tests"
```

---

### Task 6: My Status loyalty cascade E2E test

**Files:**

- Modify: `e2e/settings-my-status.spec.ts`

One new test. Key setup rules:

- Use the seeded Hyatt chain (`HOTEL_ID.HYATT` = `"cxjdwg32a8xf7by36md0mdvuu"`) which has elite statuses including Explorist (with a bonus multiplier)
- Use prior-year check-in so `lockedExchangeRate` is set
- Need Hyatt's `basePointRate` to be non-null to get non-zero initial points — fetch chain data first to confirm, or just assert points increased (not exact value)
- Restore base status in `finally` with `eliteStatusId: null`

- [ ] **Step 1: Add the My Status cascade test**

`HOTEL_ID` is already imported in this file. Add `import crypto from "crypto";` at the top if not already present (the existing file does not import it).

Append inside the `"Settings — My Status"` describe block:

```typescript
test("recalculates loyalty points when elite status changes", async ({ isolatedUser }) => {
  const { request } = isolatedUser;
  const pastYear = new Date().getFullYear() - 1;

  // Fetch Hyatt to get an Explorist eliteStatusId
  const chainsRes = await request.get("/api/hotel-chains");
  const chains = await chainsRes.json();
  const hyatt = chains.find((c: { id: string }) => c.id === HOTEL_ID.HYATT);
  const explorist = hyatt?.eliteStatuses?.find((s: { name: string }) => s.name === "Explorist");
  if (!explorist) {
    test.skip();
    return;
  }

  // Create a past booking for Hyatt (no status set yet → base rate only)
  const bookingRes = await request.post("/api/bookings", {
    data: {
      hotelChainId: HOTEL_ID.HYATT,
      propertyName: `Status Cascade ${crypto.randomUUID()}`,
      checkIn: `${pastYear}-08-01`,
      checkOut: `${pastYear}-08-05`,
      numNights: 4,
      pretaxCost: 200,
      taxAmount: 20,
      totalCost: 220,
    },
  });
  expect(bookingRes.ok()).toBeTruthy();
  const booking = await bookingRes.json();
  const initialPoints = Number(booking.loyaltyPointsEarned);

  try {
    // Set elite status to Explorist
    const statusRes = await request.post("/api/user-statuses", {
      data: { hotelChainId: HOTEL_ID.HYATT, eliteStatusId: explorist.id },
    });
    expect(statusRes.ok()).toBeTruthy();

    // Loyalty points should have increased
    const refreshRes = await request.get(`/api/bookings/${booking.id}`);
    expect(refreshRes.ok()).toBeTruthy();
    const refreshed = await refreshRes.json();
    expect(Number(refreshed.loyaltyPointsEarned)).toBeGreaterThan(initialPoints);
  } finally {
    await request.delete(`/api/bookings/${booking.id}`);
    // Restore base status
    await request.post("/api/user-statuses", {
      data: { hotelChainId: HOTEL_ID.HYATT, eliteStatusId: null },
    });
  }
});
```

- [ ] **Step 2: Run the My Status cascade tests**

```bash
npx playwright test e2e/settings-my-status.spec.ts
```

Expected: all tests pass (4 existing + 1 new).

- [ ] **Step 3: Commit**

```bash
git add e2e/settings-my-status.spec.ts
git commit -m "test: My Status change recalculates loyalty points E2E test"
```

---

### Task 7: Open PR1

- [ ] **Step 1: Push and open PR**

Use the `commit-push-pr` skill to push the branch and open a PR targeting `main`.

PR title: `fix: recalculate loyalty for all users on chain/sub-brand rate change + cascade E2E tests`

PR body should reference issue #64 and summarise:

- Fix: `recalculateLoyaltyForHotelChain` now fans out to all users when called without userId
- Fix: hotel chain PUT now recalculates for all users (not just admin)
- Feat: sub-brand PUT now triggers loyalty recalculation when `basePointRate` changes
- Tests: 3 new promotion cascade tests in `promotion-cascading.spec.ts`
- Tests: 2 new loyalty cascade tests in `settings-hotel-chains.spec.ts`
- Tests: 1 new loyalty cascade test in `settings-my-status.spec.ts`

---

## PR2 — Credit Card Live-Computed Net Cost Reflection

---

### Task 8: Credit card reward rate change reflected in booking detail

**Files:**

- Modify: `e2e/settings-credit-cards.spec.ts`

The test creates a booking with a seeded credit card, navigates to the booking detail page, updates the card's `rewardRate` via API, reloads the page, and asserts `data-testid="breakdown-card-reward"` shows the updated amount.

Credit cards are seeded in `e2e/global-setup.ts` via `db:seed`. Use `GET /api/credit-cards` to find a seeded card at test time (don't hardcode an ID).

The booking detail page URL is `/bookings/:id`.

The card reward displayed at `breakdown-card-reward` is: `rewardRate * totalCost` (e.g., 2% × $220 = $4.40 → shown as "-$4.40"). The test should assert the text changes, not compute the exact amount, to keep it resilient to rounding.

- [ ] **Step 1: Add the credit card reward rate reflection test**

The booking API requires `userCreditCardId` (a user-owned card instance), not `creditCardId`. The `breakdown-card-reward` element only renders when `cardReward > 0`, which requires a `userCreditCard` to be linked. Create a `UserCreditCard` inline at test start and delete it in the `finally` block (per CLAUDE.md pattern for card-benefit tests).

Append inside the existing `"Settings — Credit Cards"` describe block in `e2e/settings-credit-cards.spec.ts`:

```typescript
test("updated card reward rate is reflected in existing booking cost breakdown", async ({
  isolatedUser,
  adminRequest,
}) => {
  // Find a seeded credit card with a cashback rewardRate
  const cardsRes = await adminRequest.get("/api/credit-cards");
  const cards = await cardsRes.json();
  const card = cards.find(
    (c: { rewardRate: number | null; rewardType: string }) =>
      c.rewardType === "cashback" && c.rewardRate != null
  );
  if (!card) {
    test.skip();
    return;
  }

  const originalRate = Number(card.rewardRate);
  const newRate = originalRate + 0.01; // bump by 1 percentage point

  // Create a UserCreditCard linking the isolated user to the seeded card
  const ucRes = await isolatedUser.request.post("/api/user-credit-cards", {
    data: { creditCardId: card.id },
  });
  expect(ucRes.ok()).toBeTruthy();
  const uc = await ucRes.json();

  const bookingRes = await isolatedUser.request.post("/api/bookings", {
    data: {
      userCreditCardId: uc.id,
      propertyName: `Card Reward Reflection ${crypto.randomUUID()}`,
      checkIn: `${new Date().getFullYear()}-09-01`,
      checkOut: `${new Date().getFullYear()}-09-03`,
      numNights: 2,
      pretaxCost: 200,
      taxAmount: 20,
      totalCost: 220,
    },
  });
  expect(bookingRes.ok()).toBeTruthy();
  const booking = await bookingRes.json();

  const { page } = isolatedUser;

  try {
    // View booking detail and note initial card reward text
    await page.goto(`/bookings/${booking.id}`);
    const cardRewardEl = page.getByTestId("breakdown-card-reward");
    await expect(cardRewardEl).toBeVisible();
    const initialText = await cardRewardEl.textContent();

    // Admin updates rewardRate
    const updateRes = await adminRequest.put(`/api/credit-cards/${card.id}`, {
      data: { rewardRate: newRate },
    });
    expect(updateRes.ok()).toBeTruthy();

    // Reload and assert the value changed
    await page.reload();
    await expect(cardRewardEl).toBeVisible();
    const updatedText = await cardRewardEl.textContent();
    expect(updatedText).not.toBe(initialText);
  } finally {
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await isolatedUser.request.delete(`/api/user-credit-cards/${uc.id}`);
    // Restore original rate
    await adminRequest.put(`/api/credit-cards/${card.id}`, {
      data: { rewardRate: originalRate },
    });
  }
});
```

- [ ] **Step 2: Run the credit cards tests**

```bash
npx playwright test e2e/settings-credit-cards.spec.ts
```

Expected: all tests pass (existing + 1 new).

- [ ] **Step 3: Commit**

```bash
git add e2e/settings-credit-cards.spec.ts
git commit -m "test: credit card reward rate change reflected in booking cost breakdown"
```

---

### Task 9: Open PR2

- [ ] **Step 1: Push and open PR**

Use the `commit-push-pr` skill to push the branch and open a PR targeting `main`.

PR title: `test: credit card reward rate reflection in booking cost breakdown (issue #64)`

PR body should reference issue #64 and note this is the final PR completing the cascade E2E coverage.

---

## Done

After PR2 merges, all items from issue #64 are covered (except Point Types, deferred per the issue itself).
