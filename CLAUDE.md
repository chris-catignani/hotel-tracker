# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint

npm run db:push      # Push schema changes to DB + clear .next cache (use for schema changes)
npm run db:migrate   # Create and apply migrations (named migrations)
npm run db:generate  # Regenerate Prisma client only
npm run db:seed      # Seed reference data (hotels, cards, portals)

npm run test         # Run unit tests (Vitest)
npm run test:e2e     # Run functional E2E tests (Playwright)
```

After schema changes: restart the dev server to pick up the new Prisma client.

## Architecture

**Framework:** Next.js 16 App Router, TypeScript, Prisma 6, PostgreSQL, Tailwind CSS 4, shadcn/ui

**Path alias:** `@/*` → `src/*`

### API Routes (`src/app/api/`)

RESTful routes with Next.js `route.ts` handlers:

- `bookings/` — GET list, POST create; `[id]/` — GET, PUT, DELETE
- `hotel-chains/` — GET list, POST; `[id]/` — GET, PUT, DELETE; `[id]/hotel-chain-sub-brands/` — GET, POST
- `hotel-chain-sub-brands/[id]/` — PUT, DELETE
- `credit-cards/` — GET list, POST; `[id]/` — PUT, DELETE
- `portals/` — GET list, POST; `[id]/` — PUT, DELETE
- `ota-agencies/` — GET list, POST; `[id]/` — PUT, DELETE
- `promotions/` — GET list, POST; `[id]/` — GET, PUT, DELETE
- `booking-promotions/[id]/` — PUT (update `appliedValue`/`verified`)
- `point-types/` — GET list, POST; `[id]/` — PUT, DELETE
- `user-statuses/` — GET list, PUT (upsert elite status per hotel chain)

### Key Library Files (`src/lib/`)

- `prisma.ts` — Singleton Prisma client (avoids hot-reload overhead)
- `promotion-matching.ts` — Core logic: fetches booking, evaluates active promotions against matching criteria (hotel, card, portal, date range, min spend), calculates `appliedValue`, writes `BookingPromotion` records
- `api-error.ts` — Server error responses; includes stack trace in dev, generic message in prod
- `client-error.ts` — Client-side error extraction; verbose with `NEXT_PUBLIC_DEBUG=true`

### Data Model

```
Hotel          ← Booking → CreditCard
                    ↓
               BookingPromotion ← Promotion
ShoppingPortal ← Booking
```

Key fields:

- `Booking`: `pretaxCost`, `taxAmount`, `totalCost`, `portalCashbackRate`, `portalCashbackOnTotal`, `loyaltyPointsEarned`, `pointsRedeemed`, `currency`, `originalAmount`, `bookingSource` (enum: direct_web/direct_app/ota/other), `otaAgencyId`
- `BookingBenefit`: `benefitType` (enum: free_breakfast/dining_credit/spa_credit/room_upgrade/late_checkout/early_checkin/other), `label`, `dollarValue` — tracks non-cash perks received per booking
- `OtaAgency`: simple `name` model; referenced by bookings when `bookingSource = ota`
- `UserStatus`: one row per hotel chain; tracks the user's current elite tier via `eliteStatusId → HotelChainEliteStatus`
- `Promotion`: `type` (credit_card/portal/loyalty), `valueType` (fixed/percentage/points_multiplier), `value`, optional `hotelChainId`/`hotelChainSubBrandId`/`creditCardId`/`shoppingPortalId`, `minSpend`, `startDate`/`endDate`
- `BookingPromotion`: join table with `appliedValue`, `autoApplied`, and `verified`

### Net Cost Formula & Explanations

```
Net Cost = totalCost - promotionSavings - portalCashback - cardReward - loyaltyPointsValue
```

**Mandate:** Whenever adding new promotion types, portal reward options, or modifying loyalty logic, you **MUST**:

1. Update the `getNetCostBreakdown` function in `src/lib/net-cost.ts` to include detailed, human-readable explanations (description and formula) for the new logic. These explanations must explicitly state whether the calculation is based on the **pre-tax cost** or the **total cost**.
2. Update the `CostBreakdown` component (`src/components/cost-breakdown.tsx`) as necessary to accommodate any new breakdown items or calculation types.

- `promotionSavings` = sum(bookingPromotions.appliedValue)
- `portalCashback` = portalCashbackRate × basis (pre-tax or total)
- `cardReward` = totalCost × creditCard.rewardRate × creditCard.pointValue
- `loyaltyPointsValue` = loyaltyPointsEarned × hotel.pointValue (basis is typically pre-tax)

### Loyalty Points Auto-Calculation

`loyaltyPointsEarned` is calculated based on elite status:

- **Percentage-based (e.g. Marriott):** `pretaxCost × baseRate × (1 + bonusPercentage)`
- **Fixed-rate (e.g. GHA):** `pretaxCost × fixedRate`

Calculated server-side in the booking API and client-side in the booking form (user can override).

### UI Pages

- `/` — Dashboard (stats, recent bookings, savings breakdown, hotel chain summary)
- `/bookings`, `/bookings/new`, `/bookings/[id]`, `/bookings/[id]/edit`
- `/promotions`, `/promotions/new`, `/promotions/[id]/edit`
- `/settings` — Tabs: My Status (first), Point Types, Hotel Chains, Credit Cards, Shopping Portals, OTA Agencies

### Mobile Design

The app is fully responsive with a mobile-first approach:

- **Layout:** `MobileHeader` (hamburger + Sheet nav) shown on mobile; `Sidebar` shown only on `lg:` breakpoints. Root layout uses `flex-col lg:flex-row`.
- **Booking list:** `BookingCard` component for mobile (card-based layout); desktop uses a table.
- **Settings tabs:** Horizontally scrollable on mobile (`overflow-x-auto`).
- **Forms:** Responsive grid (`grid-cols-1 sm:grid-cols-2`); sticky bottom action bar on mobile, static on desktop.
- **DatePicker:** Larger tap targets on mobile (`h-11 md:h-9`, `text-base md:text-sm`).
- **Pattern for dual view:** Settings tabs and the bookings list show card views on mobile and table views on desktop using `md:hidden` / `hidden md:block`.

### Shared Utilities

- `src/lib/types.ts` — All TypeScript interfaces and types (centralized; no `any`)
- `src/lib/constants.ts` — `CURRENCIES`, `PAYMENT_TYPES`, `BOOKING_SOURCE_OPTIONS`, `BENEFIT_TYPE_OPTIONS`, `HOTEL_ID`, `CATEGORY_LABELS`
- `src/lib/navigation.ts` — `NAV_ITEMS` array used by both `Sidebar` and `MobileHeader`
- `src/lib/loyalty-utils.ts` — `calculatePointsFromChain()` for client-side loyalty points calculation
- `src/lib/loyalty-recalculation.ts` — Server-side batch re-calculation of loyalty points (e.g. after hotel rates change)

### Important Gotchas

- Prisma `Decimal` fields return as strings from API responses — always wrap with `Number()`
- Settings page uses controlled `Dialog` components with separate open/edit state variables
- `db:push` clears `.next` cache automatically; dev server restart still required after schema changes
- PostgreSQL on WSL2: start with `sudo service postgresql start` if not running
- The `react-hooks/set-state-in-effect` ESLint rule is intentionally suppressed in a few places (e.g. `fetchReferenceData` in booking form); use `useCallback` + `useEffect` pattern to load data without triggering the rule where possible

## Testing

**Framework:** Vitest, React Testing Library (RTL), jsdom, Playwright (E2E)

**Commands:**

- `npm test`: Unit tests
- `npm run test:e2e`: Functional E2E tests (requires `DATABASE_URL_TEST`)

### Standards

- **Test Coverage:** ALWAYS write unit tests (Vitest/RTL) for every new feature or bug fix. ALWAYS write E2E tests (Playwright) for features that involve UI flows.
- **Functional Tests:** Located in `e2e/`. Use Playwright for critical user flows. Ensure tests are isolated and idempotent.
- **Precise Selectors:** ALWAYS use `data-testid` attributes on React components for specific values or elements to be tested (e.g., `data-testid="stat-value-total-bookings"`). This avoids ambiguity and ensures tests are robust against formatting changes.
- **Pure Logic:** Extract core business logic into pure functions (as seen in `promotion-matching.ts`) to allow for simple unit testing without mocking complex Prisma objects.
- **Mocking:** Mock large or browser-only dependencies in tests (e.g., `recharts`) to avoid issues with `jsdom` and keep tests fast.
- **Cost Basis:** When testing cost calculations, always verify that the description/formula explicitly states the cost basis (pre-tax vs total) per the project mandate.

### E2E Test Design

**Isolation strategy:** Each test that needs data creates it via direct API calls and deletes it afterward. Tests MUST NOT create data through the UI — UI form navigation is slow and timing-sensitive (especially the date picker).

**Fixtures:** `e2e/fixtures.ts` exports a custom `test` object (extended from Playwright base) with reusable fixtures:

- `testBooking` — creates a booking via `POST /api/bookings` with a UUID-unique property name, yields it to the test, then deletes it via `DELETE /api/bookings/:id` after the test completes.

Always import `test` and `expect` from `./fixtures` (not from `@playwright/test`) in spec files so fixtures are available.

**Reference data** (hotel chains, credit cards, portals) is seeded once in `e2e/global-setup.ts` and treated as read-only by all tests.

**ESLint note:** Playwright fixtures use a `use` callback parameter that triggers a false positive from `react-hooks/rules-of-hooks`. The `eslint.config.mjs` has an `e2e/**` override that disables this rule — do not add per-line `eslint-disable` comments in E2E files.

### GitHub CLI

- **Do NOT use `gh pr view --comments`** — it queries the deprecated Projects (classic) GraphQL API and returns exit code 1.
- To read PR review comments use: `gh api repos/{owner}/{repo}/pulls/{pr}/comments`
- To read general PR/issue comments use: `gh api repos/{owner}/{repo}/issues/{pr}/comments`
- To read review summaries use: `gh api repos/{owner}/{repo}/pulls/{pr}/reviews`
