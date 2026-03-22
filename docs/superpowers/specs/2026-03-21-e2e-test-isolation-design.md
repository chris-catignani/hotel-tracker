# E2E Test Isolation Design

**Date:** 2026-03-21
**Status:** Approved
**Problem:** Flaky E2E tests that fail when running the full suite but pass individually, and keep
re-appearing as new features are added.

---

## Root Cause

Two compounding issues:

1. **Shared admin user for mutable data.** Most test fixtures (`testBooking`, `apartmentBooking`,
   `testPromotion`) create data as the admin user. With 2 parallel workers, a booking created by
   Test A is visible on the admin dashboard when Test B reads it — causing wrong counts, wrong
   totals, and wrong recent-bookings lists.

2. **Seeded bookings and promotions pollute the baseline.** `global-setup.ts` calls
   `npm run db:seed`, which runs `seedBookings()` and `seedPromotions()` for the admin user. Any
   test that asserts on aggregate data (dashboard stats, booking counts) must account for this
   unpredictable baseline.

The pattern has been: each flaky test gets a targeted patch (`isolatedUserWithPage`,
`mode: "serial"`, date fixes), but the underlying shared-state architecture stays in place and new
tests keep re-introducing the problem.

---

## Solution Overview

Three changes that together make structural contamination impossible:

1. **Separate E2E seed** — reference data only, no bookings or promotions
2. **Isolated-user fixtures as default** — all mutable data is created under per-test users
3. **Remove implicit admin access** — no default storageState; admin is opt-in and explicitly named

---

## Section 1: E2E Seed (`prisma/seed-e2e.ts`)

Create a new `prisma/seed-e2e.ts` that seeds reference data only. It must also create the admin
user (email/password from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars, same as `seed.ts`)
so that `adminRequest` / `adminPage` can authenticate and `auth.spec.ts` can test the login flow.

**Seeded:**

- Admin user (required for `adminRequest` / `adminPage` authentication)
- Hotel chains, sub-brands, elite statuses
- Point types
- Credit cards, shopping portals, OTA agencies
- `UserCreditCard` rows for the admin user (stable IDs referenced by some tests via
  `USER_CREDIT_CARD_ID`)
- `UserStatus` rows for the admin user
- Exchange rates

**Explicitly excluded:**

- `seedBookings()` — no bookings for any user
- `seedPromotions()` — no promotions for any user
- `recalculateLoyaltyForHotelChain()` loop — safe to exclude because isolated user fixtures create
  bookings fresh via the API, which calculates loyalty points server-side at creation time; this
  loop is only needed to update stored values on _existing_ bookings when rates change
- `reapplyBenefitForAllUsers()` loop — only relevant when seeded bookings exist

Update `global-setup.ts` to run `ts-node prisma/seed-e2e.ts` (via a new `seed:e2e` npm script)
instead of `npx prisma db seed`. The `prisma db push --force-reset` step is unchanged — it
continues to wipe and reseed the DB before every run, so any accumulated test data from prior runs
is cleared automatically.

The main `prisma/seed.ts` is **unchanged** — it still creates demo bookings and promotions for
local development.

**Result:** Admin user starts with zero bookings and zero promotions on every E2E run. Dashboard
stats are predictable from test data alone.

---

## Section 2: Fixture Redesign (`e2e/fixtures.ts`)

### New base fixture: `isolatedUser`

Creates a unique user via `POST /api/auth/register`, authenticates via CSRF +
`POST /api/auth/callback/credentials` (same pattern as the existing `isolatedUserWithPage`
fixture), then opens a browser context and page logged in as that user.

```typescript
isolatedUser: {
  request: APIRequestContext;
  page: Page;
}
```

**Teardown:** Closes the page, closes the browser context, disposes the request context. The user
row is left in the DB and cleaned up by the `prisma db push --force-reset` at the start of the
next run. No user-deletion API endpoint is needed. This matches the behavior of the existing
`isolatedUserWithPage` fixture.

### New `adminPage` fixture

For tests that need to navigate admin UI (e.g., the Settings page for card benefit CRUD). Logs in
as the seeded admin user using `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars via the same
CSRF + credentials flow.

```typescript
adminPage: Page; // browser page logged in as admin user
```

**Teardown:** Closes the browser context.

### New `adminRequest` fixture

Replaces the old default `request` fixture (admin). Reference data CRUD only — hotel chains,
credit cards, portals, sub-brands. Never used for bookings or promotions.

```typescript
adminRequest: APIRequestContext; // admin role, reference data CRUD only
```

**Cleanup responsibility:** Tests that create reference data via `adminRequest` are responsible for
deleting it in teardown — the same pattern `testHotelChain` and `testSubBrand` already follow.

### Updated data fixtures

`testBooking`, `apartmentBooking`, `pastYearBooking` (existing fixture, migrated), and
`testPromotion` are rebuilt on top of `isolatedUser`. They no longer use the admin `request`
fixture.

Each exposes the isolated user context alongside the created data:

```typescript
testBooking: {
  id: string;
  propertyName: string;
  hotelChainName: string;
  request: APIRequestContext; // isolated user's request
  page: Page; // isolated user's page
}

apartmentBooking: {
  id: string;
  propertyName: string;
  request: APIRequestContext;
  page: Page;
}

pastYearBooking: {
  id: string;
  propertyName: string;
  request: APIRequestContext;
  page: Page;
}

testPromotion: {
  id: string;
  name: string;
  request: APIRequestContext;
  page: Page;
}
```

### Retired fixtures

- `isolatedUserRequest` — superseded by `isolatedUser`; `card-benefits.spec.ts` is migrated as
  part of this work
- `isolatedUserWithPage` — superseded by `isolatedUser`; `net-cost-consistency.spec.ts` and
  `partnership-earns.spec.ts` are migrated as part of this work

### `testHotelChain` and `testSubBrand`

These create reference data and continue to use `adminRequest` internally. No change to their
external API.

### Test call site patterns

```typescript
// Common case: booking test with isolated user
test("...", async ({ testBooking }) => {
  await testBooking.page.goto(`/bookings/${testBooking.id}`);
});

// Admin UI test (e.g. Settings CRUD)
test("...", async ({ adminPage, adminRequest }) => {
  await adminPage.goto("/settings");
  // create reference data via adminRequest, clean up in finally
});

// Test that creates a custom credit card then a booking
test("...", async ({ adminRequest, isolatedUser }) => {
  const cardRes = await adminRequest.post("/api/credit-cards", { data: { ... } });
  const card = await cardRes.json();
  try {
    const bookingRes = await isolatedUser.request.post("/api/bookings", { data: { ... } });
    const booking = await bookingRes.json();
    try {
      await isolatedUser.page.goto(`/bookings/${booking.id}`);
      // assertions...
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  } finally {
    await adminRequest.delete(`/api/credit-cards/${card.id}`);
  }
});
```

---

## Section 3: Playwright Config (`playwright.config.ts`)

Remove the implicit admin session from the chromium project:

- Remove `storageState: "e2e/.auth/admin.json"` from the chromium project
- Remove `dependencies: ["setup"]` from the chromium project
- Remove the `setup` project entirely
- Delete `e2e/auth.setup.ts`

**Effect:** An unauthenticated browser is redirected to `/login`. Every test that navigates pages
must explicitly use an authenticated fixture.

### Tests requiring migration

The following files use the bare `page` fixture (grep confirmed): `auth.spec.ts`,
`booking-crud.spec.ts`, `card-benefits.spec.ts`, `dashboard.spec.ts`, `mobile-layout.spec.ts`,
`multi-currency.spec.ts`, `net-cost-consistency.spec.ts`, `partnership-earns.spec.ts`,
`price-watch.spec.ts`, `promotions.spec.ts`, `smoke.spec.ts`, `year-filter.spec.ts`. All must be
updated — a bare unauthenticated `page` will redirect to `/login` after `storageState` is removed.

| Test file                         | Change needed                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.spec.ts`                    | Already uses `test.use({ storageState: { cookies: [], origins: [] } })` and reads admin credentials from env vars. No migration needed — just remove the now-deleted `setup` project dependency.                                                                                                                                                           |
| `smoke.spec.ts`                   | Add `isolatedUser` at the `test.describe` level (wraps all tests). Replace `page` with `isolatedUser.page`. Stats render as "0" for an empty user — assertions remain valid.                                                                                                                                                                               |
| `mobile-layout.spec.ts`           | Add `isolatedUser` at the `test.describe` level. Replace `page` with `isolatedUser.page`.                                                                                                                                                                                                                                                                  |
| `booking-benefits-mobile.spec.ts` | Add `isolatedUser` for `/bookings/new` (UI form test only — no form submission, no booking created, no teardown needed beyond fixture disposal).                                                                                                                                                                                                           |
| `dashboard.spec.ts`               | Migrate from `{ page, request }` (admin) to `isolatedUser`. Booking creation moves to `isolatedUser.request`; navigation uses `isolatedUser.page`. Eliminates cross-worker dashboard contamination.                                                                                                                                                        |
| `year-filter.spec.ts`             | Uses `page` (admin) + `pastYearBooking`. After migration, replace `page` with `pastYearBooking.page` — the fixture now provides its own isolated page. Remove the explicit `page` parameter.                                                                                                                                                               |
| `card-benefits.spec.ts`           | "Settings CRUD (admin)" block: replace `{ page, request }` with `{ adminPage, adminRequest }`. "Auto-apply on booking" block: migrate from `isolatedUserRequest` to `isolatedUser`.                                                                                                                                                                        |
| `net-cost-consistency.spec.ts`    | Migrate from `isolatedUserWithPage` to `isolatedUser`. **Remove `test.describe.configure({ mode: "serial" })`.** The admin reference-data creates (credit cards, portals) all use `crypto.randomUUID()` names, so parallel execution is safe. Serial mode was only needed to avoid the dashboard race; with isolated users it is unnecessary and slows CI. |
| `partnership-earns.spec.ts`       | Migrate from `isolatedUserWithPage` to `isolatedUser`. Remove `mode: "serial"` if present.                                                                                                                                                                                                                                                                 |
| `booking-crud.spec.ts`            | Replace `page` with `testBooking.page`. Remove `page` from test parameter list.                                                                                                                                                                                                                                                                            |
| `multi-currency.spec.ts`          | Replace `page` with `testBooking.page` (or `isolatedUser.page` for tests that create their own booking inline). Remove `page` from test parameter list.                                                                                                                                                                                                    |
| `price-watch.spec.ts`             | Replace `page` with `testBooking.page` or `isolatedUser.page`. Remove `page` from test parameter list.                                                                                                                                                                                                                                                     |
| `promotions.spec.ts`              | Replace `page` with `testPromotion.page` or `isolatedUser.page`. Remove `page` from test parameter list.                                                                                                                                                                                                                                                   |

---

## Section 4: Rules and Prevention

### CLAUDE.md additions (E2E Testing section)

```
**E2E test isolation rules:**
- `seed-e2e.ts` provides reference data only. No bookings or promotions are seeded.
- All bookings and promotions are created via isolated user fixtures (testBooking,
  apartmentBooking, testPromotion, isolatedUser). Never create them as admin.
- `adminRequest` is for reference data CRUD only (hotel chains, credit cards, portals,
  sub-brands). Always clean up reference data in teardown.
- `adminPage` is for admin UI navigation only (e.g. Settings page). Always pair with
  `adminRequest` for any data created during the test.
- There is no default `page` or `request` fixture. Every test must explicitly declare
  what user it operates as via fixtures.
- Never use `test.describe.configure({ mode: "serial" })` to work around isolation
  problems — fix the root cause (use an isolated user) instead.
```

### Pre-push checklist addition

```
5. For any new E2E test: confirm it uses testBooking/isolatedUser (not adminRequest)
   for bookings and promotions; adminRequest/adminPage are only for reference data
   and admin UI navigation.
```

---

## What This Does NOT Change

- Unit test setup (`vitest-setup.ts`) — already stable; Radix UI mocks and `userEvent delay:null`
  stay as-is
- The main `prisma/seed.ts` — unchanged, still creates full demo data for local dev
- `testHotelChain` and `testSubBrand` fixture APIs — same shape, internally use `adminRequest`
- CI workflow (`.github/workflows/ci.yml`) — no changes needed; `prisma db push --force-reset`
  already wipes and reseeds the DB before each run
- Number of workers (2) and retry count (1) — unchanged

---

## Future Work (Backlog)

If flakiness resurfaces despite these changes, the next escalation is **per-worker database
sharding**: each Playwright worker runs its own Next.js server on a dedicated port pointing to a
dedicated database. This provides structural isolation at the infrastructure level rather than the
fixture level. See GitHub Issue #283.
