## Commands

```bash
npm run db:migrate   # Create + apply a new migration (dev only) + clear .next cache
                     # To skip interactive name prompt: npx prisma migrate dev --name <migration_name>
                     # Never use prisma db push — no audit trail, no production story
npm run db:deploy    # Apply pending migrations (production / CI)
npm run db:generate  # Regenerate Prisma client only
npm run db:seed      # Seed reference data (hotels, cards, portals)
```

After schema changes: restart the dev server to pick up the new Prisma client.

## Workflow Mandates

**Schema changes:** Always show the proposed `prisma/schema.prisma` diff to the user for review and approval _before_ implementing API routes, types, UI, or tests. This prevents rework when the design needs adjustment.

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

- `PromotionRestrictions.allowedAccommodationTypes[]` — empty array = unrestricted (all types allowed)

### Net Cost Formula

```
Net Cost = totalCost + pointsRedeemedValue + certsValue
           - promotionSavings - portalCashback - cardReward - loyaltyPointsValue
```

All USD amounts use `toUSD(nativeAmount, booking.lockedExchangeRate)` — `lockedExchangeRate` is locked at check-in (1 for USD, historical rate for past non-USD, null for future non-USD).

**Net cost changes:** use `hotel-tracker:net-cost-changes` skill when adding promotion types, portal rewards, or modifying loyalty/cost logic.

### Promotion Matching & Orphaned Logic

Three tiers evaluated in order:

1. **Structural Match (Invisible if Mismatched):** Any structural criterion fails → promotion hidden from UI, no badge.
   - Fields: Hotel Chain, Credit Card, Shopping Portal, Sub-brand, Stay Dates, Registration Deadline, Book-by Date, Booking Source, Payment Type, Tie-in Cards, **Accommodation Type**.
   - **Loyalty promos are always structurally invisible for apartment bookings.**
2. **Hard Caps (Maxed Out):** Cap hit → show $0, no badge. Fields: Max Stay Count, Once Per Sub-brand, Max Reward Count.
3. **Fulfillment (Pre-qualifying vs. Orphaned):** Evaluated only if structural match passes and no hard cap hit.
   - **Pre-qualifying:** Requirements not yet met but future booked stays could complete them → $0 with "Pre-qualifying" badge.
   - **Orphaned:** Requirements not met AND no future stays can complete them → $0 with "Orphaned" badge.

### Loyalty Points Auto-Calculation

- Calculated server-side in the booking API and client-side via `src/lib/loyalty-utils.ts`. User can override.
- **Foreign-currency programs (e.g. Accor):** `PointType` has `programCurrency` (e.g. `EUR`) and `programCentsPerPoint`. `usdCentsPerPoint` is refreshed daily by the exchange rate cron. `Booking.lockedLoyaltyUsdCentsPerPoint` snapshots `programCentsPerPoint × programCurrency/USD rate` at check-in so past stay values don't drift with FX.
  - **Critical:** always use `getOrFetchHistoricalRate(pt.programCurrency, date)` — NOT the booking currency rate — since `programCentsPerPoint` is denominated in `programCurrency` regardless of what the guest paid in.

### Apartment / Short-term Rental Stays

- `Booking.accommodationType = apartment` hides hotel chain, sub-brand, loyalty, cert payment, and Price Watch. Geo search omits `includedType: "lodging"` so addresses resolve correctly.
- Dashboard filter toggle (All / Hotels / Apartments) persisted in localStorage. Apartment bookings pinned to bottom of accommodation summary table; excluded from Sub-brand breakdown widget.

### Email Ingestion

- Chain-specific parsing guides live in `src/lib/email-ingestion/chain-guides.ts` — add a new entry here when adding support for a new hotel chain
- The `from` address identifies the user; `sender` identifies the hotel chain

### Authentication & Authorization

- **IDOR protection:** Use `findFirst({ where: { id, userId } })` — never `findUnique` with only `id`, as it does not verify ownership.
- **Role-gating:** Reference data routes (hotel-chains, cards, portals, etc.) require `ADMIN` for writes. Use `requireAdmin()` from `src/lib/auth-utils.ts`.
- All user-data routes (bookings, promotions, user-statuses) must be scoped to `userId` via `getAuthenticatedUserId()`.

### Important Gotchas

- Prisma `Decimal` fields return as **strings** from API responses — always wrap with `Number()`
- **`Booking.propertyId` is required** — resolve it via `findOrCreateProperty()` in `src/lib/property-utils.ts` on every booking create/update. This function is P2002-safe: catches unique constraint races and re-fetches by `(name, hotelChainId)`.
- **Locked fields:** `Booking.lockedExchangeRate` and `Booking.lockedLoyaltyUsdCentsPerPoint` are written once when `checkIn <= today` (by CREATE/PUT routes and the exchange rate cron). Never recomputed after that.
- **Geo confirmation:** The booking form blocks submission until the user selects a property from autocomplete or uses the manual entry modal (`geoConfirmed` must be `true`). `PropertyNameCombobox` and `ManualGeoModal` handle this flow.
- Settings page uses controlled `Dialog` components with separate open/edit state variables
- `react-hooks/set-state-in-effect` is intentionally suppressed in a few data-fetching effects; use `useCallback` + `useEffect` to avoid it elsewhere
- Error handling: `src/lib/api-error.ts` (server) + `src/lib/client-error.ts` (client). Set `NEXT_PUBLIC_DEBUG=true` in `.env` for detailed errors in UI

## Testing

**Framework:** Vitest + React Testing Library (unit), Playwright (E2E)

### Standards

- **ALWAYS** write unit tests (Vitest/RTL) for every new feature or bug fix.
- **ALWAYS** write E2E tests (Playwright) for features that involve UI flows.
- Use `data-testid` attributes for test selectors — never text content (e.g. `data-testid="stat-value-total-bookings"`).

### E2E Design

- Create test data via direct API calls; **never through the UI** (slow, timing-sensitive, especially the date picker).
- Import `test` and `expect` from `./fixtures` (not `@playwright/test`) so fixtures are available.
- `testBooking` and `apartmentBooking` fixtures in `e2e/fixtures.ts` — create via `POST /api/bookings`, auto-delete after test.
- Reference data (hotel chains, cards, portals) is seeded once in `e2e/global-setup.ts`; treat as read-only.
- `e2e/**` has `react-hooks/rules-of-hooks` disabled in `eslint.config.mjs` (Playwright `use` callback false positive) — no per-line disables needed.

#### E2E Isolation Rules (mandatory for all new tests)

- **Use `isolatedUser`** for every test that creates bookings, promotions, or asserts user-scoped UI (dashboard, bookings list). Never use the default `page`/`request` fixtures for user data — they are not authenticated after the removal of `auth.setup.ts`.
- **Use `adminRequest`** for reference-data writes (hotel chains, credit cards, portals, sub-brands) and `adminPage` for admin UI tests (Settings).
- **Never use `isolatedUserWithPage` or `isolatedUserRequest`** — these legacy fixtures have been removed. Use `isolatedUser` instead.
- **No `test.describe.configure({ mode: "serial" })`** — each test must be fully independent. Shared state between serial tests causes flakiness under parallel workers.
- **UserCreditCard in card-benefit tests**: create inline at test start via `isolatedUser.request.post("/api/user-credit-cards", ...)` and delete in the `finally` block. Do not rely on a fixture to pre-create it.

## GitHub CLI

- **GitHub MCP plugin is configured** — use `mcp__plugin_github_github__*` tools for GitHub operations where available (reading issues/PRs, creating issues, searching, etc.). Prefer MCP tools over `gh api` calls for read operations.
- **Playwright MCP plugin is configured** — use `mcp__plugin_playwright_playwright__*` tools for browser automation and UI verification against the running dev server without writing Playwright test files.
- **PR CI polling:** Use `gh pr checks <number>` at 30-second intervals (`sleep 30` between calls). Never use `--watch`.
- **Do NOT use `gh pr view --comments`** — it queries the deprecated Projects (classic) GraphQL API and returns exit code 1. Use MCP tools instead: `pull_request_read`, `pull_request_review_write`, or `gh api` directly.
