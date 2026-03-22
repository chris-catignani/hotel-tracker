# E2E Test Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate E2E flakiness by making all tests structurally isolated — isolated users own
their own data, no default admin session leaks between parallel workers.

**Architecture:** Create a reference-only E2E seed (no bookings/promotions). Introduce three new
fixtures (`isolatedUser`, `adminRequest`, `adminPage`) to replace the implicit admin `request` and
`page`. Update all data fixtures (`testBooking`, etc.) to use isolated users and expose
`{ request, page }`. Migrate all spec files. Remove the default `storageState` from
`playwright.config.ts` last, after all call sites are updated.

**Tech Stack:** Playwright, TypeScript, Auth.js v5 Credentials provider, Prisma 6, tsx

**Spec:** `docs/superpowers/specs/2026-03-21-e2e-test-isolation-design.md`

---

## File Map

| File                                       | Action     | What changes                                                                               |
| ------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------ |
| `prisma/seed-e2e.ts`                       | **Create** | Reference-only seed (admin user + reference data, no bookings/promotions)                  |
| `package.json`                             | **Modify** | Add `seed:e2e` script                                                                      |
| `e2e/global-setup.ts`                      | **Modify** | Use `seed:e2e` instead of `db:seed`                                                        |
| `e2e/fixtures.ts`                          | **Modify** | Add `isolatedUser`, `adminPage`, `adminRequest`; update data fixtures; retire old fixtures |
| `playwright.config.ts`                     | **Modify** | Remove `storageState` + `dependencies` from chromium project; remove `setup` project       |
| `e2e/auth.setup.ts`                        | **Delete** | No longer needed                                                                           |
| `e2e/smoke.spec.ts`                        | **Modify** | Use `isolatedUser.page`                                                                    |
| `e2e/mobile-layout.spec.ts`                | **Modify** | Use `isolatedUser.page`                                                                    |
| `e2e/booking-benefits-mobile.spec.ts`      | **Modify** | Use `isolatedUser.page`                                                                    |
| `e2e/booking-crud.spec.ts`                 | **Modify** | Use `testBooking.page`                                                                     |
| `e2e/apartment-stays.spec.ts`              | **Modify** | Use `apartmentBooking.page`                                                                |
| `e2e/geo-property-search.spec.ts`          | **Modify** | Use `testBooking.page`                                                                     |
| `e2e/pre-qualifying-details.spec.ts`       | **Modify** | Use `isolatedUser` for page                                                                |
| `e2e/multi-currency.spec.ts`               | **Modify** | Use `isolatedUser.page` (creates bookings inline)                                          |
| `e2e/price-watch.spec.ts`                  | **Modify** | Use `testBooking.page`                                                                     |
| `e2e/year-filter.spec.ts`                  | **Modify** | Use `pastYearBooking.page`                                                                 |
| `e2e/dashboard.spec.ts`                    | **Modify** | Use `isolatedUser` (creates bookings inline)                                               |
| `e2e/promotions.spec.ts`                   | **Modify** | Use `testPromotion.page` / `isolatedUser.page`                                             |
| `e2e/geo-promotion-restrictions.spec.ts`   | **Modify** | Replace `request` (admin) with `isolatedUser.request` for bookings/promotions              |
| `e2e/promotion-chain-restrictions.spec.ts` | **Modify** | Replace `request` (admin) with `isolatedUser.request` for bookings/promotions              |
| `e2e/promotion-cascading.spec.ts`          | **Modify** | Replace `request` (admin) with `isolatedUser.request` for bookings/promotions              |
| `e2e/promotion-exclusions.spec.ts`         | **Modify** | Replace `request` (admin) with `isolatedUser.request` for bookings/promotions              |
| `e2e/auth.spec.ts`                         | **Verify** | Already isolated; confirm no `setup` project dependency declaration                        |
| `e2e/net-cost-consistency.spec.ts`         | **Modify** | Replace `isolatedUserWithPage` → `isolatedUser`; remove `mode: "serial"`                   |
| `e2e/partnership-earns.spec.ts`            | **Modify** | Replace `isolatedUserWithPage` → `isolatedUser`                                            |
| `e2e/card-benefits.spec.ts`                | **Modify** | Admin block → `adminPage`/`adminRequest`; booking block → `isolatedUser`                   |
| `CLAUDE.md`                                | **Modify** | Add E2E isolation rules                                                                    |
| `memory/feedback_pre_push_checklist.md`    | **Modify** | Add isolation check                                                                        |

---

## Task 1: Create `prisma/seed-e2e.ts`

**Files:**

- Create: `prisma/seed-e2e.ts`
- Modify: `package.json`
- Modify: `e2e/global-setup.ts`

`seed-e2e.ts` is a copy of `seed.ts` with `seedBookings`, `seedPromotions`,
`recalculateLoyaltyForHotelChain`, and `reapplyBenefitForAllUsers` removed. Everything else
(admin user, point types, hotel chains, elite statuses, sub-brands, credit cards, portals,
agencies, UserCreditCard rows, UserStatus rows, exchange rates, card benefits, partnership earns)
stays exactly as-is. The `ADMIN_USER_ID` is still needed because `UserCreditCard` and `UserStatus`
rows reference it.

- [ ] **Step 1: Create `prisma/seed-e2e.ts`**

  Copy `prisma/seed.ts` to `prisma/seed-e2e.ts`, then make the following removals:

  Remove the four imports at the top:

  ```typescript
  // Remove these four lines:
  import { seedBookings } from "./seed-bookings";
  import { seedPromotions } from "./seed-promotions";
  import { recalculateLoyaltyForHotelChain } from "../src/lib/loyalty-recalculation";
  import { reapplyBenefitForAllUsers } from "../src/lib/card-benefit-apply";
  ```

  Remove the four calls near the bottom of `main()` (around line 1103–1115):

  ```typescript
  // Remove these calls:
  await seedBookings(ADMIN_USER_ID);
  await seedPromotions(ADMIN_USER_ID);

  for (const hotelId of Object.values(HOTEL_ID)) {
    await recalculateLoyaltyForHotelChain(hotelId, ADMIN_USER_ID);
  }

  for (const benefitId of Object.values(CARD_BENEFIT_ID)) {
    await reapplyBenefitForAllUsers(benefitId);
  }
  ```

  Change the success log at the end:

  ```typescript
  console.log("E2E seed data created successfully");
  ```

- [ ] **Step 2: Add `seed:e2e` script to `package.json`**

  In the `"scripts"` section, after `"db:seed"`:

  ```json
  "db:seed:e2e": "npx tsx prisma/seed-e2e.ts",
  ```

- [ ] **Step 3: Update `e2e/global-setup.ts`**

  Change the seed command from `npx prisma db seed` to `npm run db:seed:e2e`:

  ```typescript
  // Before:
  const seedOutput = execSync("npx prisma db seed", {

  // After:
  const seedOutput = execSync("npm run db:seed:e2e", {
  ```

- [ ] **Step 4: Verify the seed runs**

  ```bash
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hotel_tracker_test" npm run db:seed:e2e
  ```

  Expected: `E2E seed data created successfully` with no errors.

- [ ] **Step 5: Run E2E tests**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

  Expected: all tests pass (removing seeded bookings/promotions should not break any test — they all create their own data).

- [ ] **Step 6: Commit**

  ```bash
  git add prisma/seed-e2e.ts package.json e2e/global-setup.ts
  git commit -m "test: add seed-e2e.ts (reference data only) and wire global-setup to use it"
  ```

---

## Task 2: Add new fixtures to `e2e/fixtures.ts`

**Files:**

- Modify: `e2e/fixtures.ts`

Add `isolatedUser`, `adminRequest`, and `adminPage` fixtures. Update `testHotelChain` and
`testSubBrand` to use `adminRequest` internally. Keep the old `request` fixture as-is for now
(backward compat — removed in Task 11). **Do not** change the data fixtures (`testBooking` etc.)
yet.

- [ ] **Step 1: Add new types to `TestFixtures`**

  In `e2e/fixtures.ts`, extend the `TestFixtures` type:

  ```typescript
  type TestFixtures = {
    // --- NEW ---
    /**
     * An isolated per-test user with their own request context and browser page.
     * Use for all tests that create bookings or promotions. The page is logged in
     * as this isolated user. Data created via this fixture is invisible to other
     * parallel tests.
     */
    isolatedUser: { request: APIRequestContext; page: Page };

    /**
     * Admin user's API request context. Use ONLY for reference data CRUD
     * (hotel chains, credit cards, portals, sub-brands). Never use for
     * bookings or promotions.
     */
    adminRequest: APIRequestContext;

    /**
     * Admin user's browser page. Use ONLY for admin UI tests (e.g. Settings).
     * Always pair with adminRequest for any data created during the test.
     */
    adminPage: Page;

    // ... existing types below (testBooking, etc.) unchanged for now
  };
  ```

- [ ] **Step 2: Implement `isolatedUser` fixture**

  Add after the existing `isolatedUserWithPage` fixture implementation:

  ```typescript
  isolatedUser: async ({ playwright, browser, baseURL }, use) => {
    const resolvedBase = baseURL ?? "http://127.0.0.1:3001";
    const email = `test-isolated-${crypto.randomUUID()}@example.com`;
    const password = "testpass123";

    const userRequest = await playwright.request.newContext({ baseURL: resolvedBase });

    await userRequest.post("/api/auth/register", {
      data: { email, password, name: "Isolated Test User" },
    });

    const csrfRes = await userRequest.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    await userRequest.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, callbackUrl: resolvedBase, redirect: "false" },
    });

    const storageState = await userRequest.storageState();
    const context = await browser.newContext({ baseURL: resolvedBase, storageState });
    const page = await context.newPage();

    await use({ request: userRequest, page });

    await page.close();
    await context.close();
    await userRequest.dispose();
  },
  ```

- [ ] **Step 3: Implement `adminRequest` fixture**

  Add after `isolatedUser`:

  ```typescript
  adminRequest: async ({ playwright, baseURL }, use) => {
    const resolvedBase = baseURL ?? "http://127.0.0.1:3001";
    const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
    const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

    const adminReq = await playwright.request.newContext({ baseURL: resolvedBase });

    const csrfRes = await adminReq.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    await adminReq.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, callbackUrl: resolvedBase, redirect: "false" },
    });

    await use(adminReq);
    await adminReq.dispose();
  },
  ```

- [ ] **Step 4: Implement `adminPage` fixture**

  Add after `adminRequest`:

  ```typescript
  adminPage: async ({ playwright, browser, baseURL }, use) => {
    const resolvedBase = baseURL ?? "http://127.0.0.1:3001";
    const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
    const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

    const adminReq = await playwright.request.newContext({ baseURL: resolvedBase });

    const csrfRes = await adminReq.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    await adminReq.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, callbackUrl: resolvedBase, redirect: "false" },
    });

    const storageState = await adminReq.storageState();
    const context = await browser.newContext({ baseURL: resolvedBase, storageState });
    const page = await context.newPage();

    await use(page);

    await page.close();
    await context.close();
    await adminReq.dispose();
  },
  ```

- [ ] **Step 5: Update `testHotelChain` and `testSubBrand` to use `adminRequest`**

  `testHotelChain` currently receives `{ request }` (the admin request via storageState). Change it
  to receive `{ adminRequest }` instead:

  ```typescript
  // Before:
  testHotelChain: async ({ request }, use) => {
    const uniqueName = `Test Chain ${crypto.randomUUID()}`;
    const res = await request.post("/api/hotel-chains", {

  // After:
  testHotelChain: async ({ adminRequest }, use) => {
    const uniqueName = `Test Chain ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/hotel-chains", {
  ```

  And for delete at the end:

  ```typescript
  // Before: await request.delete(`/api/hotel-chains/${chain.id}`);
  // After:  await adminRequest.delete(`/api/hotel-chains/${chain.id}`);
  ```

  For `testSubBrand`, show the full updated implementation (the factory closure pattern needs all references updated):

  ```typescript
  // Before:
  testSubBrand: async ({ request, testHotelChain }, use) => {
    const subBrands: string[] = [];
    const createSubBrand = async (name?: string) => {
      const uniqueName = name || `Test SubBrand ${crypto.randomUUID()}`;
      const res = await request.post(
        `/api/hotel-chains/${testHotelChain.id}/hotel-chain-sub-brands`,
        { data: { name: uniqueName } }
      );
      const subBrand = await res.json();
      subBrands.push(subBrand.id);
      return subBrand as { id: string; name: string; hotelChainId: string };
    };
    await use(createSubBrand);
    for (const id of subBrands) {
      await request.delete(`/api/hotel-chain-sub-brands/${id}`);
    }
  },

  // After:
  testSubBrand: async ({ adminRequest, testHotelChain }, use) => {
    const subBrands: string[] = [];
    const createSubBrand = async (name?: string) => {
      const uniqueName = name || `Test SubBrand ${crypto.randomUUID()}`;
      const res = await adminRequest.post(
        `/api/hotel-chains/${testHotelChain.id}/hotel-chain-sub-brands`,
        { data: { name: uniqueName } }
      );
      const subBrand = await res.json();
      subBrands.push(subBrand.id);
      return subBrand as { id: string; name: string; hotelChainId: string };
    };
    await use(createSubBrand);
    for (const id of subBrands) {
      await adminRequest.delete(`/api/hotel-chain-sub-brands/${id}`);
    }
  },
  ```

- [ ] **Step 6: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors. The new fixture types and updated `testHotelChain`/`testSubBrand`
  signatures must resolve cleanly before continuing.

- [ ] **Step 7: Run E2E tests**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

  Expected: all tests pass. The new fixtures exist but nothing uses them yet.

- [ ] **Step 8: Commit**

  ```bash
  git add e2e/fixtures.ts
  git commit -m "test: add isolatedUser, adminRequest, adminPage fixtures; wire testHotelChain/testSubBrand to adminRequest"
  ```

---

## Task 3: Update data fixtures + migrate booking-using spec files

**Files:**

- Modify: `e2e/fixtures.ts` (update `testBooking`, `apartmentBooking`, `pastYearBooking`, `testPromotion`)
- Modify: `e2e/booking-crud.spec.ts`
- Modify: `e2e/apartment-stays.spec.ts`
- Modify: `e2e/geo-property-search.spec.ts`
- Modify: `e2e/price-watch.spec.ts`
- Modify: `e2e/year-filter.spec.ts`

**IMPORTANT:** The data fixture changes and spec file updates MUST be committed together. Once
`testBooking` creates data as an isolated user, any test that still uses `page` (admin) to navigate
will not see the isolated user's bookings and will fail.

The pattern for each data fixture: wrap the existing body in `isolatedUser`, use
`isolatedUser.request` for API calls, and add `request` and `page` to the yielded value.

- [ ] **Step 1: Update `testBooking` in `e2e/fixtures.ts`**

  ```typescript
  testBooking: async ({ isolatedUser, adminRequest }, use) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const uniqueName = `Test Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: `${YEAR}-08-10`,
        checkOut: `${YEAR}-08-15`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    const booking = await res.json();
    await use({
      id: booking.id,
      propertyName: uniqueName,
      hotelChainName: chain.name,
      request: isolatedUser.request,
      page: isolatedUser.page,
    });
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  },
  ```

- [ ] **Step 2: Update `apartmentBooking` in `e2e/fixtures.ts`**

  ```typescript
  apartmentBooking: async ({ isolatedUser }, use) => {
    const uniqueName = `Test Apartment ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        accommodationType: "apartment",
        hotelChainId: null,
        propertyName: uniqueName,
        checkIn: `${YEAR}-08-20`,
        checkOut: `${YEAR}-08-27`,
        numNights: 7,
        pretaxCost: 600,
        taxAmount: 60,
        totalCost: 660,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "FR",
        city: "Paris",
      },
    });
    const booking = await res.json();
    await use({ id: booking.id, propertyName: uniqueName, request: isolatedUser.request, page: isolatedUser.page });
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  },
  ```

- [ ] **Step 3: Update `pastYearBooking` in `e2e/fixtures.ts`**

  ```typescript
  pastYearBooking: async ({ isolatedUser, adminRequest }, use) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const pastYear = new Date().getFullYear() - 1;
    const uniqueName = `Test Past Year Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: `${pastYear}-06-01`,
        checkOut: `${pastYear}-06-05`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    const booking = await res.json();
    await use({ id: booking.id, propertyName: uniqueName, request: isolatedUser.request, page: isolatedUser.page });
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  },
  ```

- [ ] **Step 4: Update `testPromotion` in `e2e/fixtures.ts`**

  ```typescript
  testPromotion: async ({ isolatedUser }, use) => {
    const uniqueName = `Test Promo ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: uniqueName,
        type: "loyalty",
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 25,
            certType: null,
            sortOrder: 0,
          },
        ],
      },
    });
    const promotion = await res.json();
    await use({ id: promotion.id, name: uniqueName, request: isolatedUser.request, page: isolatedUser.page });
    await isolatedUser.request.delete(`/api/promotions/${promotion.id}`);
  },
  ```

- [ ] **Step 5: Update `e2e/booking-crud.spec.ts`**

  In every test signature that has `{ page, ..., testBooking }`:
  - Remove `page` from the destructuring
  - Replace every `page.` call with `testBooking.page.`
  - Replace every `request.` call with `testBooking.request.` (when creating/deleting user-owned data)

  Example before:

  ```typescript
  test("...", async ({ page, request, testBooking }) => {
    await page.goto(`/bookings/${testBooking.id}`);
  ```

  Example after:

  ```typescript
  test("...", async ({ testBooking }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}`);
  ```

  Note: `request` calls that create/fetch reference data (hotel chains, portals) should use
  `adminRequest` instead. `request` calls that create/delete bookings should use
  `testBooking.request`.

- [ ] **Step 6: Update `e2e/apartment-stays.spec.ts`**

  Replace `{ page, ..., apartmentBooking }` → remove `page`, use `apartmentBooking.page` for
  navigation.

- [ ] **Step 7: Update `e2e/geo-property-search.spec.ts`**

  Replace `{ page, ..., testBooking }` → remove `page`, use `testBooking.page`.

- [ ] **Step 8: Update `e2e/price-watch.spec.ts`**

  Replace `{ page, ..., testBooking }` → remove `page`, use `testBooking.page`. Reference data
  (hotel chains, portals) should use `adminRequest` instead of bare `request`.

- [ ] **Step 9: Update `e2e/year-filter.spec.ts`**

  Replace `{ page, ..., pastYearBooking }` → remove `page`, use `pastYearBooking.page`. Tests that
  used `pastYearBooking: _` (unused) can remove the underscore — the fixture still sets up the data.

- [ ] **Step 10: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors. The updated fixture return types (`testBooking`, `apartmentBooking`, etc.)
  now include `request` and `page` — confirm all spec files resolve these fields correctly.

- [ ] **Step 11: Run E2E tests**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

  Expected: all tests pass.

- [ ] **Step 12: Commit**

  ```bash
  git add e2e/fixtures.ts e2e/booking-crud.spec.ts e2e/apartment-stays.spec.ts \
    e2e/geo-property-search.spec.ts e2e/price-watch.spec.ts e2e/year-filter.spec.ts
  git commit -m "test: migrate data fixtures to isolated users; update booking/apartment/price-watch/year-filter specs"
  ```

---

## Task 4: Migrate page-only specs to `isolatedUser`

**Files:**

- Modify: `e2e/smoke.spec.ts`
- Modify: `e2e/mobile-layout.spec.ts`
- Modify: `e2e/booking-benefits-mobile.spec.ts`

These tests don't create data — they just need an authenticated browser.

- [ ] **Step 1: Update `e2e/smoke.spec.ts`**

  In `beforeEach`, replace `{ page }` with `{ isolatedUser }` and navigate via `isolatedUser.page`.
  In each test body, replace `{ page }` with `{ isolatedUser }` and replace all `page.` with
  `isolatedUser.page.`. Playwright shares fixture instances between `beforeEach` and the test body
  within the same test execution — no extra wiring needed.

  ```typescript
  test.describe("Smoke Test", () => {
    test.beforeEach(async ({ isolatedUser }) => {
      await isolatedUser.page.goto("/");
    });

    test("should load the dashboard and show initial stats", async ({ isolatedUser }) => {
      await expect(isolatedUser.page).toHaveTitle(/Hotel Tracker/i);
      await expect(isolatedUser.page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
      await expect(isolatedUser.page.getByTestId("stat-value-total-bookings")).toBeVisible();
      await expect(isolatedUser.page.getByTestId("stat-value-cash")).toBeVisible();
    });

    test("should navigate to settings and see tabs", async ({ isolatedUser }) => {
      await isolatedUser.page
        .getByRole("link", { name: /Settings/i })
        .first()
        .click();
      await expect(isolatedUser.page).toHaveURL(/\/settings/);
      await expect(isolatedUser.page.getByTestId("tab-my-status")).toBeVisible();
      await expect(isolatedUser.page.getByTestId("tab-point-types")).toBeAttached();
    });
  });
  ```

- [ ] **Step 2: Update `e2e/mobile-layout.spec.ts`**

  Same pattern: add `isolatedUser` at describe level, replace all `page.` with
  `isolatedUser.page.`. Remove `page` from all test parameter lists.

- [ ] **Step 3: Update `e2e/booking-benefits-mobile.spec.ts`**

  Replace `{ page }` with `{ isolatedUser }` and `page.` with `isolatedUser.page.`.

- [ ] **Step 4: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors.

- [ ] **Step 5: Run E2E tests**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add e2e/smoke.spec.ts e2e/mobile-layout.spec.ts e2e/booking-benefits-mobile.spec.ts
  git commit -m "test: migrate smoke/mobile-layout/booking-benefits-mobile to isolatedUser"
  ```

---

## Task 5: Migrate `dashboard.spec.ts`

**Files:**

- Modify: `e2e/dashboard.spec.ts`

Dashboard tests create bookings inline (not via `testBooking` fixture). Each test must switch from
`{ page, request }` (admin) to `{ isolatedUser }`.

- [ ] **Step 1: Update each test in `e2e/dashboard.spec.ts`**

  Pattern for every test:

  ```typescript
  // Before:
  test("...", async ({ page, request }) => {
    const chains = await request.get("/api/hotel-chains");
    // ...
    const bookingRes = await request.post("/api/bookings", { data: { ... } });
    // ...
    await page.goto("/");
    // ...
    await request.delete(`/api/bookings/${booking.id}`);

  // After:
  test("...", async ({ isolatedUser, adminRequest }) => {
    const chains = await adminRequest.get("/api/hotel-chains");   // reference data → adminRequest
    // ...
    const bookingRes = await isolatedUser.request.post("/api/bookings", { data: { ... } });
    // ...
    await isolatedUser.page.goto("/");
    // ...
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  ```

  Rule: any `request.get(...)` fetching reference data (hotel chains, portals, cards) → use
  `adminRequest`. Any `request.post/delete(...)` for bookings → use `isolatedUser.request`. Any
  `page.goto/getBy...` → use `isolatedUser.page`.

- [ ] **Step 2: Run E2E tests for this file only**

  ```bash
  npm run test:e2e -- --project=chromium e2e/dashboard.spec.ts
  ```

  Expected: all tests in this file pass.

- [ ] **Step 3: Run full E2E suite**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add e2e/dashboard.spec.ts
  git commit -m "test: migrate dashboard.spec.ts to isolatedUser — eliminates cross-worker contamination"
  ```

---

## Task 6: Migrate `promotions.spec.ts` and promotion restriction specs

**Files:**

- Modify: `e2e/promotions.spec.ts`
- Modify: `e2e/geo-promotion-restrictions.spec.ts`
- Modify: `e2e/promotion-chain-restrictions.spec.ts`
- Modify: `e2e/promotion-cascading.spec.ts`
- Modify: `e2e/promotion-exclusions.spec.ts`

`promotions.spec.ts` is large (933 lines) and uses `testPromotion` fixture and inline `request`
calls. The four promotion-restriction spec files also use `request` (admin) to create bookings and
promotions — they must be migrated too. Pattern for all: `testPromotion.request` or
`isolatedUser.request` for user-scoped data, `adminRequest` for reference data, `testPromotion.page`
or `isolatedUser.page` for navigation.

- [ ] **Step 1: Update `e2e/promotions.spec.ts`**

  For every test that uses `{ page, request, testPromotion }`:
  - Remove `page` from destructuring
  - Replace `page.` with `testPromotion.page.`
  - Replace `request.post("/api/promotions", ...)` with `testPromotion.request.post(...)`
  - Keep `request.get("/api/hotel-chains")` etc. (reference data) but rename to `adminRequest`
  - Add `adminRequest` to destructuring where needed for reference data

  For tests that create bookings inline for promotion matching:

  ```typescript
  // Before: await request.post("/api/bookings", { ... })
  // After:  await testPromotion.request.post("/api/bookings", { ... })
  ```

  Tests that assert on the promotions list page: use `testPromotion.page` to navigate to
  `/promotions`.

- [ ] **Step 2: Migrate `e2e/geo-promotion-restrictions.spec.ts`**

  This file uses `request` for both bookings and promotions in `afterEach` and each test. The
  `createdPromoIds` / `createdBookingIds` arrays are currently declared at the `describe` level —
  **this is a problem**: if they accumulate IDs across tests, each `afterEach` will try to delete
  IDs from all previous tests, causing double-delete errors on the second+ test.

  Fix: move the arrays inside each `test` body and pass them to the `createGeoPromo` / `createBooking`
  helpers, then clean up at the end of each test using `try/finally` instead of `afterEach`. Or
  reset the arrays in `beforeEach`. The `try/finally` approach is cleaner:

  ```typescript
  test("...", async ({ isolatedUser, adminRequest }) => {
    const createdPromoIds: string[] = [];
    const createdBookingIds: string[] = [];
    try {
      const chains = await adminRequest.get("/api/hotel-chains");  // reference data
      const promo = await createGeoPromo(isolatedUser.request, createdPromoIds, { ... });
      const booking = await createBooking(isolatedUser.request, createdBookingIds, { ... });
      // assertions...
    } finally {
      for (const id of createdBookingIds) await isolatedUser.request.delete(`/api/bookings/${id}`);
      for (const id of createdPromoIds) await isolatedUser.request.delete(`/api/promotions/${id}`);
    }
  });
  ```

  Update `createGeoPromo` / `createBooking` helpers to accept the ID array as an argument instead
  of closing over the describe-level variable. Remove `test.afterEach` once all tests use `try/finally`.

  Note: The `createGeoPromo` / `createBooking` helper functions currently accept a
  `request: APIRequestContext` argument — update their signatures to also accept the ID array
  (`ids: string[]`) so each test can manage its own cleanup list. See the `try/finally` pattern
  above.

- [ ] **Step 3: Migrate `e2e/promotion-chain-restrictions.spec.ts`**

  Uses `{ request, testHotelChain }`. Replace `request` with `isolatedUser` for user-scoped data:
  - `request.post("/api/promotions", ...)` → `isolatedUser.request.post(...)`
  - `request.post("/api/bookings", ...)` → `isolatedUser.request.post(...)`
  - `request.delete(...)` in cleanup → `isolatedUser.request.delete(...)`
  - Reference data fetches (hotel chains) are already via `testHotelChain` fixture (no change needed).

- [ ] **Step 4: Migrate `e2e/promotion-cascading.spec.ts`**

  Same pattern as Step 3: replace inline `request` for bookings/promotions with `isolatedUser.request`.

- [ ] **Step 5: Migrate `e2e/promotion-exclusions.spec.ts`**

  Same pattern: uses `{ request, testHotelChain, testSubBrand }`. Replace `request` (for
  bookings/promotions) with `isolatedUser.request`. `testHotelChain` and `testSubBrand` already
  use `adminRequest` internally — no change needed for those.

- [ ] **Step 6: Run file-specific tests**

  ```bash
  npm run test:e2e -- --project=chromium e2e/promotions.spec.ts e2e/geo-promotion-restrictions.spec.ts e2e/promotion-chain-restrictions.spec.ts e2e/promotion-cascading.spec.ts e2e/promotion-exclusions.spec.ts
  ```

- [ ] **Step 7: Run full suite**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add e2e/promotions.spec.ts e2e/geo-promotion-restrictions.spec.ts \
    e2e/promotion-chain-restrictions.spec.ts e2e/promotion-cascading.spec.ts \
    e2e/promotion-exclusions.spec.ts
  git commit -m "test: migrate promotions and promotion-restriction specs to isolated users"
  ```

---

## Task 7: Migrate `multi-currency.spec.ts` and `pre-qualifying-details.spec.ts`

**Files:**

- Modify: `e2e/multi-currency.spec.ts`
- Modify: `e2e/pre-qualifying-details.spec.ts`

Both create bookings inline (not via `testBooking`) so they need `isolatedUser` directly.

- [ ] **Step 1: Update `e2e/multi-currency.spec.ts`**

  Replace `{ page, request }` with `{ isolatedUser, adminRequest }`. Apply the same reference
  data / user-data split as in Task 5.

- [ ] **Step 2: Update `e2e/pre-qualifying-details.spec.ts`**

  Same pattern. This file creates multiple bookings per test (span-stays scenarios) — all creation
  goes through `isolatedUser.request`, all navigation through `isolatedUser.page`.

- [ ] **Step 3: Run E2E tests**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add e2e/multi-currency.spec.ts e2e/pre-qualifying-details.spec.ts
  git commit -m "test: migrate multi-currency and pre-qualifying-details to isolatedUser"
  ```

---

## Task 8: Migrate already-isolated specs

**Files:**

- Modify: `e2e/net-cost-consistency.spec.ts`
- Modify: `e2e/partnership-earns.spec.ts`
- Modify: `e2e/card-benefits.spec.ts`

These already use `isolatedUserWithPage` or `isolatedUserRequest`. Simple rename + serial mode
removal.

- [ ] **Step 1: Update `e2e/net-cost-consistency.spec.ts`**
  - Replace `isolatedUserWithPage` with `isolatedUser` in destructuring
  - Replace `isolatedUserWithPage.page` with `isolatedUser.page`
  - Replace `isolatedUserWithPage.request` with `isolatedUser.request`
  - **Remove `test.describe.configure({ mode: "serial" })`** — no longer needed
  - Reference data creates (credit cards, portals) use `adminRequest` (they did before via the old
    `request` fixture — confirm they're using `request` and rename to `adminRequest`)

- [ ] **Step 2: Update `e2e/partnership-earns.spec.ts`**

  Same rename: `isolatedUserWithPage` → `isolatedUser`. Check for and remove `mode: "serial"` if
  present.

- [ ] **Step 3: Update `e2e/card-benefits.spec.ts` — admin block**

  The "Settings CRUD (admin)" `test.describe` block currently uses `{ page, request }`. Change to
  `{ adminPage, adminRequest }`:

  ```typescript
  // Before:
  test("creates a card benefit", async ({ page, request }) => {
    await page.goto("/settings");
    // ... API cleanup via request.delete(...)

  // After:
  test("creates a card benefit", async ({ adminPage, adminRequest }) => {
    await adminPage.goto("/settings");
    // ... API cleanup via adminRequest.delete(...)
  ```

- [ ] **Step 4: Update `e2e/card-benefits.spec.ts` — booking block**

  The "Auto-apply on booking" `test.describe` block uses `isolatedUserRequest`. Change to
  `isolatedUser`. The old `isolatedUserRequest` fixture pre-created a `UserCreditCard` in fixture
  setup — we now create it inline in each test with explicit teardown. Use `try/finally` to
  guarantee cleanup ordering:

  ```typescript
  // Before:
  test("...", async ({ request, isolatedUserRequest }) => {
    const bookingRes = await isolatedUserRequest.request.post("/api/bookings", { ... });
    // ... userCreditCardId: isolatedUserRequest.userCreditCardId
    await request.delete(`/api/card-benefits/${cardBenefit.id}`);

  // After:
  test("...", async ({ adminRequest, isolatedUser }) => {
    // Card benefit is reference data → adminRequest
    const cardBenefitRes = await adminRequest.post("/api/card-benefits", { data: { ... } });
    const cardBenefit = await cardBenefitRes.json();
    try {
      // UserCreditCard belongs to the isolated user
      const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
        data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
      });
      const { id: userCreditCardId } = await uccRes.json();
      try {
        const bookingRes = await isolatedUser.request.post("/api/bookings", { data: { ... } });
        const booking = await bookingRes.json();
        try {
          // assertions...
        } finally {
          await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
        }
      } finally {
        await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      }
    } finally {
      await adminRequest.delete(`/api/card-benefits/${cardBenefit.id}`);
    }
  });
  ```

  Note: card benefit CRUD (create/delete) is reference data → use `adminRequest` (formerly `request`).

- [ ] **Step 5: Run E2E tests**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add e2e/net-cost-consistency.spec.ts e2e/partnership-earns.spec.ts e2e/card-benefits.spec.ts
  git commit -m "test: migrate net-cost-consistency/partnership-earns/card-benefits to new fixtures; remove serial mode"
  ```

---

## Task 9: Remove `storageState` from `playwright.config.ts` and delete `auth.setup.ts`

**Files:**

- Modify: `playwright.config.ts`
- Delete: `e2e/auth.setup.ts`

This is the final structural change. At this point every spec file must be using explicit
authenticated fixtures — no test should rely on the default admin storageState.

- [ ] **Step 1: Verify `e2e/auth.spec.ts` has no `setup` project dependency**

  The spec confirms `auth.spec.ts` already uses `test.use({ storageState: { cookies: [], origins: [] } })` and reads admin credentials from env vars — no migration needed. But confirm it has no project-level dependency on the `setup` project:

  ```bash
  grep -n "dependencies\|setup" e2e/auth.spec.ts
  ```

  Expected: no matches (dependency declarations live in `playwright.config.ts`, not in spec files). If anything is found, remove it before continuing.

- [ ] **Step 2: Verify no spec uses bare `page` from admin storageState**

  ```bash
  for f in e2e/*.spec.ts; do
    if grep -q "^\s*page[,\s]" "$f"; then
      echo "CHECK: $f"
      grep -n "^\s*page[,\s]" "$f"
    fi
  done
  ```

  Expected: only files where `page` comes from `isolatedUser.page`, `testBooking.page`, etc. If any
  file still has a plain `page` fixture that isn't sourced from a new fixture, fix it before
  continuing.

- [ ] **Step 3: Update `playwright.config.ts`**

  In the `chromium` project, remove `storageState` and `dependencies`:

  ```typescript
  // Before:
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      storageState: "e2e/.auth/admin.json",
    },
    dependencies: ["setup"],
  },

  // After:
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
    },
  },
  ```

  Remove the entire `setup` project:

  ```typescript
  // Remove:
  {
    name: "setup",
    testMatch: "**/auth.setup.ts",
  },
  ```

- [ ] **Step 4: Delete `e2e/auth.setup.ts`**

  ```bash
  git rm e2e/auth.setup.ts
  ```

- [ ] **Step 5: Run E2E tests**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

  Expected: all tests pass. If any test redirects to `/login`, it means it still depends on the
  admin storageState — go back and fix its fixture usage before this commit.

- [ ] **Step 6: Commit**

  ```bash
  git add playwright.config.ts
  git commit -m "test: remove default admin storageState from playwright.config; delete auth.setup.ts"
  ```

---

## Task 10: Retire old fixtures from `e2e/fixtures.ts`

**Files:**

- Modify: `e2e/fixtures.ts`

Remove `isolatedUserRequest`, `isolatedUserWithPage`, and the old `request` fixture (backed by
admin storageState). These are no longer referenced by any spec file.

- [ ] **Step 1: Verify no spec references old fixtures**

  ```bash
  grep -r "isolatedUserRequest\|isolatedUserWithPage\b" e2e/*.spec.ts
  grep -rn "^\s*request[,\s]" e2e/*.spec.ts | grep -v "adminRequest\|isolatedUser\|testBooking\|testPromotion"
  ```

  Expected: no matches. If any appear, fix the spec first.

- [ ] **Step 2: Remove old fixture types from `TestFixtures`**

  Remove `isolatedUserRequest` and `isolatedUserWithPage` from the type definition.

- [ ] **Step 3: Remove old fixture implementations**

  Delete the `isolatedUserRequest` and `isolatedUserWithPage` fixture implementations from the
  `base.extend<TestFixtures>({...})` block.

- [ ] **Step 4: Confirm no `request` override exists in `fixtures.ts`**

  The old admin authentication came from `storageState` set on the chromium project in
  `playwright.config.ts` — that was removed in Task 9. Playwright's built-in `request` fixture was
  never overridden in `e2e/fixtures.ts`; there is no custom `request` entry in `TestFixtures`.
  This step is a verification, not a removal:

  ```bash
  grep -n '"request"\|request:' e2e/fixtures.ts
  ```

  Expected: no matches (the `request` parameter that appeared in old fixture signatures was
  Playwright's built-in, injected from project-level storageState, not a custom fixture). No code
  changes needed — just confirm the grep returns nothing.

- [ ] **Step 5: Run E2E tests**

  ```bash
  npm run test:e2e -- --project=chromium
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add e2e/fixtures.ts
  git commit -m "test: retire isolatedUserRequest, isolatedUserWithPage, and old request fixture"
  ```

---

## Task 11: Update `CLAUDE.md` and pre-push checklist

**Files:**

- Modify: `CLAUDE.md`
- Modify: `memory/feedback_pre_push_checklist.md`

- [ ] **Step 1: Add E2E isolation rules to `CLAUDE.md`**

  In the `## Testing` → `### E2E Design` section, add after the existing E2E rules:

  ```markdown
  **E2E test isolation rules:**

  - `seed-e2e.ts` provides reference data only. No bookings or promotions are seeded.
    Admin user starts with zero mutable data on every E2E run.
  - All bookings and promotions are created via isolated user fixtures (`testBooking`,
    `apartmentBooking`, `testPromotion`, `isolatedUser`). Never create them as admin.
  - `adminRequest` is for reference data CRUD only (hotel chains, credit cards, portals,
    sub-brands). Always clean up reference data in teardown (`finally` block).
  - `adminPage` is for admin UI navigation only (e.g. Settings page). Always pair with
    `adminRequest` for any data created during the test.
  - There is no default `page` or `request` fixture. Every test must explicitly declare
    what user it operates as via fixtures.
  - Never use `test.describe.configure({ mode: "serial" })` to work around isolation
    problems — fix the root cause (use an isolated user) instead.
  - If flakiness resurfaces after these changes, escalate to per-worker DB sharding
    (see GitHub Issue #283) — do not patch individual tests.
  ```

- [ ] **Step 2: Add item to pre-push checklist**

  In `memory/feedback_pre_push_checklist.md`, add:

  ```markdown
  5. For any new E2E test: confirm it uses `testBooking`/`isolatedUser` (not `adminRequest`)
     for bookings and promotions. `adminRequest`/`adminPage` are only for reference data
     and admin UI navigation.
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add CLAUDE.md memory/feedback_pre_push_checklist.md
  git commit -m "docs: add E2E isolation rules to CLAUDE.md and pre-push checklist"
  ```

---

## Verification

After all tasks are complete:

- [ ] Run the full E2E suite twice in a row to check for flakiness:

  ```bash
  npm run test:e2e -- --project=chromium
  npm run test:e2e -- --project=chromium
  ```

- [ ] Run unit tests to confirm nothing was accidentally broken:

  ```bash
  npm test
  ```

- [ ] Run TypeScript check:

  ```bash
  npx tsc --noEmit
  ```

- [ ] Run lint:

  ```bash
  npm run lint
  ```

Expected: all green, twice. If any E2E test is still flaky, check whether it:

1. Still uses `request` (admin) to create user-scoped data — should use `isolatedUser.request`
2. Still uses bare `page` without a fixture source — should use a fixture's `.page`
3. Asserts on aggregate data as admin — should use `isolatedUser` so the baseline is clean

If flakiness persists after confirming the above, consult GitHub Issue #283 for the per-worker DB
escalation path.
