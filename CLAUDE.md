# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint

npm run db:migrate   # Create + apply a new migration (dev only) + clear .next cache
npm run db:deploy    # Apply pending migrations (production / CI)
npm run db:generate  # Regenerate Prisma client only
npm run db:seed      # Seed reference data (hotels, cards, portals)

npm run test         # Run unit tests (Vitest)
npm run test:e2e     # Run functional E2E tests (Playwright)
```

After schema changes: restart the dev server to pick up the new Prisma client.

## Workflow Mandates

**Schema changes:** Always show the proposed `prisma/schema.prisma` diff to the user for review and approval _before_ implementing API routes, types, UI, or tests. This prevents rework when the design needs adjustment.

**Migration workflow:**

- Dev: `npm run db:migrate` — `prisma migrate dev`, prompts for a name, generates SQL in `prisma/migrations/`, applies it, clears `.next`.
- Production / CI: `npm run db:deploy` — `prisma migrate deploy`, applies pending migrations only.
- Never use `prisma db push` — no audit trail, no production story.

## Architecture

**Framework:** Next.js 16 App Router, TypeScript, Prisma 6, PostgreSQL, Tailwind CSS 4, shadcn/ui
**Path alias:** `@/*` → `src/*`

### Data Model

```
HotelChain ← Property ← Booking → CreditCard
                 ↓           ↓
            PriceWatch   BookingPromotion ← Promotion
                 ↓
        PriceWatchBooking (per booking thresholds)
                 ↓
          PriceSnapshot (fetched prices)
ShoppingPortal ← Booking
```

Non-obvious fields worth knowing:

- `Booking.propertyId` is **required** — geo data (`countryCode`, `city`, etc.) lives on `Property`, not `Booking`
- `Booking.accommodationType` — enum: `hotel | apartment`, `@default(hotel)`
- `Property.chainPropertyId` — chain-specific scraper ID (e.g. spiritCode for Hyatt)
- `PriceWatch`: `@@unique([userId, propertyId])`; links to `PriceWatchBooking[]` (per-booking thresholds) and `PriceSnapshot[]`
- `PromotionRestrictions.allowedAccommodationTypes[]` — empty array = unrestricted (all types allowed)
- `GeoCache` — caches Google Places results keyed by normalized query string

### Net Cost Formula

```
Net Cost = totalCost - promotionSavings - portalCashback - cardReward - loyaltyPointsValue
```

**Mandate:** Whenever adding new promotion types, portal reward options, or modifying loyalty logic, you **MUST**:

1. Update `getNetCostBreakdown` in `src/lib/net-cost.ts` with human-readable explanations that explicitly state whether the calculation uses **pre-tax cost** or **total cost**.
2. Update `CostBreakdown` (`src/components/cost-breakdown.tsx`) for any new breakdown items.

- `portalCashback` = portalCashbackRate × basis (`portalCashbackOnTotal ? totalCost : pretaxCost`)
- `cardReward` = totalCost × creditCard.rewardRate × creditCard.pointValue
- `loyaltyPointsValue` = loyaltyPointsEarned × hotel.pointValue (pre-tax basis)

### Promotion Matching & Orphaned Logic

Three tiers evaluated in order:

1. **Structural Match (Invisible if Mismatched):** Any structural criterion fails → promotion hidden from UI, no badge.
   - Fields: Hotel Chain, Credit Card, Shopping Portal, Sub-brand, Stay Dates, Registration Deadline, Book-by Date, Booking Source, Payment Type, Tie-in Cards, **Accommodation Type**.
   - **Loyalty promos are always structurally invisible for apartment bookings.**
2. **Hard Caps (Maxed Out):** Cap hit → show $0, no badge. Fields: Max Stay Count, Once Per Sub-brand, Max Reward Count.
3. **Fulfillment (Pre-qualifying vs. Orphaned):** Evaluated only if structural match passes and no hard cap hit.
   - **Pre-qualifying:** Requirements not yet met but future booked stays could complete them → $0 with "Pre-qualifying" badge.
   - **Orphaned:** Requirements not met AND no future stays can complete them → $0 with "Orphaned" badge.

#### Span-stays partial cycle display (`net-cost.ts`)

Incomplete final cycle earns $0. Label depends on whether the cap was exhausted:

- **"Orphaned Reward Cycle"**: cap NOT exhausted — `floor(eligibleNightsAtBooking / minNightsRequired) × benefitValue < maxTotalBonusPoints`
- **"Capped Reward Cycle"**: cap WAS exhausted — `floor(...) × benefitValue >= maxTotalBonusPoints`

`eligibleNightsAtBooking` (stored on `BookingPromotionBenefit`) = cumulative eligible nights at END of this booking. Source of truth for all span-stays display calculations in `net-cost.ts`.

### Loyalty Points Auto-Calculation

- **Percentage-based (e.g. Marriott):** `pretaxCost × baseRate × (1 + bonusPercentage)`
- **Fixed-rate (e.g. GHA):** `pretaxCost × fixedRate`
- Calculated server-side in the booking API and client-side via `src/lib/loyalty-utils.ts`. User can override.
- **Not applicable** to apartment bookings — loyalty fields are hidden in the form.

### Apartment / Short-term Rental Stays

- `Booking.accommodationType = apartment` hides hotel chain, sub-brand, loyalty program, and certificate payment fields in the booking form. Price Watch is also hidden (list, card, and detail pages).
- Geo search omits `includedType: "lodging"` for apartments so addresses and short-term rentals resolve correctly.
- Promotion matching treats accommodation type as a **structural rule** — promos with `allowedAccommodationTypes` set are invisible to bookings of the wrong type. Loyalty promos are always invisible for apartment bookings.
- Dashboard has an All / Hotels / Apartments filter toggle (persisted in localStorage). Apartment bookings appear as a single "Apartments / Short-term Rentals" row in the accommodation summary table, pinned to the bottom regardless of sort. The Sub-brand breakdown widget excludes apartment bookings.

### Authentication & Authorization

- **IDOR protection:** Use `findFirst({ where: { id, userId } })` — never `findUnique` with only `id`, as it does not verify ownership.
- **Role-gating:** Reference data routes (hotel-chains, cards, portals, etc.) require `ADMIN` for writes. Use `requireAdmin()` from `src/lib/auth-utils.ts`.
- All user-data routes (bookings, promotions, user-statuses) must be scoped to `userId` via `getAuthenticatedUserId()`.

### Important Gotchas

- Prisma `Decimal` fields return as **strings** from API responses — always wrap with `Number()`
- **`Booking.propertyId` is required** — resolve it via `findOrCreateProperty()` in `src/lib/property-utils.ts` on every booking create/update
- **Geo confirmation:** The booking form blocks submission until the user selects a property from autocomplete or uses the manual entry modal (`geoConfirmed` must be `true`). `PropertyNameCombobox` and `ManualGeoModal` handle this flow.
- After switching geo API providers: `DELETE FROM geo_cache;` to flush stale results
- After seeding with explicit IDs, sync Postgres sequences to avoid unique-constraint errors: `SELECT setval('<table>_id_seq', (SELECT MAX(id) FROM <table>));`
- Settings page uses controlled `Dialog` components with separate open/edit state variables
- PostgreSQL on WSL2: `sudo service postgresql start`
- `react-hooks/set-state-in-effect` is intentionally suppressed in a few data-fetching effects; use `useCallback` + `useEffect` to avoid it elsewhere

## Testing

**Framework:** Vitest + React Testing Library (unit), Playwright (E2E)

### Standards

- **ALWAYS** write unit tests (Vitest/RTL) for every new feature or bug fix.
- **ALWAYS** write E2E tests (Playwright) for features that involve UI flows.
- Use `data-testid` attributes for test selectors — never text content (e.g. `data-testid="stat-value-total-bookings"`).
- Extract business logic into pure functions for unit testing without Prisma mocks (see `promotion-matching.ts`).
- Mock large/browser-only deps in unit tests (e.g. `recharts`).
- When testing cost calculations, verify the description/formula explicitly states cost basis (pre-tax vs total).

### E2E Design

- Create test data via direct API calls; **never through the UI** (slow, timing-sensitive, especially the date picker).
- Import `test` and `expect` from `./fixtures` (not `@playwright/test`) so fixtures are available.
- `testBooking` and `apartmentBooking` fixtures in `e2e/fixtures.ts` — create via `POST /api/bookings`, auto-delete after test.
- Reference data (hotel chains, cards, portals) is seeded once in `e2e/global-setup.ts`; treat as read-only.
- `e2e/**` has `react-hooks/rules-of-hooks` disabled in `eslint.config.mjs` (Playwright `use` callback false positive) — no per-line disables needed.

### Unit Test Design

- Don't use manual `act()` — `render()` and `userEvent` v14+ handle it internally.
- Prefer `userEvent` over `fireEvent`.
- Common mocks (next/link, next/navigation, FocusScope) centralized in `vitest-setup.ts`.
- Keep `testTimeout` at 30s in `vitest.config.ts`.

## GitHub CLI

- **Sub-issue linking:** When creating sub-tasks for a parent issue, always formally link them using the GraphQL `addSubIssue` mutation.
- **Workflow:** ALWAYS create a feature branch. NEVER commit to `main`. NOTIFY the user to test locally before creating a PR. NEVER merge or delete a branch without explicit instruction.
- **Do NOT use `gh pr view --comments`** — it queries the deprecated Projects (classic) GraphQL API and returns exit code 1.
  - PR inline comments: `gh api repos/{owner}/{repo}/pulls/{pr}/comments`
  - General PR/issue comments: `gh api repos/{owner}/{repo}/issues/{pr}/comments`
  - Review summaries: `gh api repos/{owner}/{repo}/pulls/{pr}/reviews`
