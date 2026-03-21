# E2E Test Isolation Design

**Date:** 2026-03-21
**Status:** Approved
**Problem:** Flaky E2E tests that fail when running the full suite but pass individually, and keep re-appearing as new features are added.

---

## Root Cause

Two compounding issues:

1. **Shared admin user for mutable data.** Most test fixtures (`testBooking`, `apartmentBooking`, `testPromotion`) create data as the admin user. With 2 parallel workers, a booking created by Test A is visible on the admin dashboard when Test B reads it — causing wrong counts, wrong totals, and wrong recent-bookings lists.

2. **Seeded bookings and promotions pollute the baseline.** `global-setup.ts` calls `npm run db:seed`, which runs `seedBookings()` and `seedPromotions()` for the admin user. Any test that asserts on aggregate data (dashboard stats, booking counts) must account for this unpredictable baseline.

The pattern has been: each flaky test gets a targeted patch (`isolatedUserWithPage`, `mode: "serial"`, date fixes), but the underlying shared-state architecture stays in place and new tests keep re-introducing the problem.

---

## Solution Overview

Three changes that together make structural contamination impossible:

1. **Separate E2E seed** — reference data only, no bookings or promotions
2. **Isolated-user fixtures as default** — all mutable data is created under per-test users
3. **Remove implicit admin access** — no default storageState; admin is opt-in and explicitly named

---

## Section 1: E2E Seed (`prisma/seed-e2e.ts`)

Create a new `prisma/seed-e2e.ts` that seeds only reference data:

- Hotel chains, sub-brands, elite statuses
- Point types
- Credit cards, shopping portals, OTA agencies
- `UserCreditCard` rows for the admin user (stable IDs used by some tests)
- `UserStatus` rows for the admin user
- Exchange rates

**Explicitly excluded:**

- `seedBookings()` — no bookings for any user
- `seedPromotions()` — no promotions for any user
- `recalculateLoyaltyForHotelChain()` loop — only needed for seeded bookings
- `reapplyBenefitForAllUsers()` loop — only needed for seeded bookings

Update `global-setup.ts` to run `seed-e2e.ts` instead of the main `seed.ts`. Add a `seed:e2e` npm script.

The main `prisma/seed.ts` is **unchanged** — it still creates demo bookings and promotions for local development.

**Result:** Admin user starts with zero bookings and zero promotions on every E2E run. Dashboard stats are predictable from test data alone.

---

## Section 2: Fixture Redesign (`e2e/fixtures.ts`)

### New base fixture: `isolatedUser`

Creates a unique user, authenticates via CSRF + credentials, opens a browser context and page logged in as that user.

```typescript
isolatedUser: {
  request: APIRequestContext;
  page: Page;
}
```

Teardown: closes page and browser context, disposes request context, deletes the user via API.

### Updated data fixtures

`testBooking`, `apartmentBooking`, `pastYearBooking`, and `testPromotion` are rebuilt on top of `isolatedUser`. They no longer use the admin `request` fixture.

Each returns its isolated user context alongside the created data:

```typescript
testBooking: {
  id: string;
  propertyName: string;
  hotelChainName: string;
  request: APIRequestContext; // isolated user's request
  page: Page; // isolated user's page
}
```

Same shape for `apartmentBooking`, `pastYearBooking`, and `testPromotion`.

### New `adminRequest` fixture

The old default `request` fixture (admin) is replaced by an explicitly named `adminRequest`. It is documented as **reference data only**: hotel chains, credit cards, portals, sub-brands. Never used for bookings or promotions.

```typescript
adminRequest: APIRequestContext; // admin role, reference data CRUD only
```

### Retired fixtures

- `isolatedUserRequest` — superseded by the base `isolatedUser` fixture
- `isolatedUserWithPage` — superseded by the base `isolatedUser` fixture

### Test call site pattern

```typescript
// Common case: test that creates a booking and asserts on its detail page
test('...', async ({ testBooking }) => {
  await testBooking.page.goto(`/bookings/${testBooking.id}`);
  // ...
});

// Test that creates a custom credit card (reference data) then a booking
test('...', async ({ adminRequest, isolatedUser }) => {
  const card = await adminRequest.post('/api/credit-cards', { data: { ... } });
  const ucc = await isolatedUser.request.post('/api/user-credit-cards', {
    data: { creditCardId: card.json().id }
  });
  const booking = await isolatedUser.request.post('/api/bookings', { data: { ... } });
  await isolatedUser.page.goto(`/bookings/${booking.json().id}`);
  // cleanup in finally block
});
```

### `testHotelChain` and `testSubBrand`

These create reference data and continue to use `adminRequest` internally. No change to their external API.

---

## Section 3: Playwright Config (`playwright.config.ts`)

Remove the implicit admin session from the chromium project:

- Remove `storageState: "e2e/.auth/admin.json"` from the chromium project
- Remove `dependencies: ["setup"]` from the chromium project
- Remove the `setup` project entirely
- Delete `e2e/auth.setup.ts`

**Effect:** An unauthenticated browser is redirected to `/login`. Every test that navigates pages must explicitly use an authenticated fixture (`testBooking.page`, `isolatedUser.page`, etc.). No implicit state.

### Tests requiring migration to explicit fixtures

| Test file                            | Change needed                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `smoke.spec.ts`                      | Add `isolatedUser` fixture for page navigation                                           |
| `mobile-layout.spec.ts`              | Add `isolatedUser` fixture for page navigation                                           |
| `booking-benefits-mobile.spec.ts`    | Add `isolatedUser` fixture for `/bookings/new`                                           |
| `auth.spec.ts`                       | Remove `setup` dependency; test login flow directly (already uses unauthenticated pages) |
| All others using `testBooking`, etc. | Switch from `page` to `testBooking.page`                                                 |

---

## Section 4: Rules and Prevention

### CLAUDE.md additions (E2E Testing section)

```
**E2E test isolation rules:**
- `seed-e2e.ts` provides reference data only. No bookings or promotions are seeded.
- All bookings and promotions are created via isolated user fixtures (testBooking,
  apartmentBooking, testPromotion, isolatedUser). Never create them as admin.
- `adminRequest` is for reference data CRUD only (hotel chains, credit cards, portals,
  sub-brands). If you are using `adminRequest`, you must be creating or deleting
  reference data — never bookings or promotions.
- There is no default `page` or `request` fixture. Every test must explicitly declare
  what user it operates as via fixtures.
- Never use `test.describe.configure({ mode: "serial" })` to work around isolation
  problems — fix the root cause (use an isolated user) instead.
```

### Pre-push checklist addition

```
5. For any new E2E test: confirm it uses testBooking/isolatedUser (not adminRequest)
   for bookings and promotions; adminRequest is only for reference data.
```

---

## What This Does NOT Change

- Unit test setup (`vitest-setup.ts`) — already stable; Radix UI mocks and `userEvent delay:null` stay as-is
- The main `prisma/seed.ts` — unchanged, still creates full demo data for local dev
- `testHotelChain` and `testSubBrand` fixture APIs — same shape, internally use `adminRequest`
- CI workflow (`.github/workflows/ci.yml`) — no changes needed
- Number of workers (2) and retry count (1) — unchanged

---

## Future Work (Backlog)

If flakiness resurfaces despite these changes, the next escalation is **per-worker database sharding**: each Playwright worker runs its own Next.js server on a dedicated port pointing to a dedicated database. This provides structural isolation at the infrastructure level rather than the fixture level. See GitHub Issue [to be created].
