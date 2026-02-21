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
```

After schema changes: restart the dev server to pick up the new Prisma client.

## Architecture

**Framework:** Next.js 16 App Router, TypeScript, Prisma 6, PostgreSQL, Tailwind CSS 4, shadcn/ui

**Path alias:** `@/*` → `src/*`

### API Routes (`src/app/api/`)

RESTful routes with Next.js `route.ts` handlers:
- `bookings/` — GET list, POST create; `[id]/` — GET, PUT, DELETE
- `hotels/`, `credit-cards/`, `portals/` — CRUD
- `promotions/` — CRUD

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
- `Booking`: `pretaxCost`, `taxAmount`, `totalCost`, `portalCashbackRate`, `loyaltyPointsEarned`
- `Promotion`: `type` (hotel/credit_card/portal/loyalty), `valueType` (fixed/percentage/points_multiplier), `value`, optional `hotelId`/`creditCardId`/`shoppingPortalId`, `minSpend`, `startDate`/`endDate`
- `BookingPromotion`: join table with `appliedValue` and `autoApplied`

### Net Cost Formula & Explanations

```
Net Cost = totalCost - promotionSavings - portalCashback - cardReward - loyaltyPointsValue
```

**Mandate:** Whenever adding new promotion types, portal reward options, or modifying loyalty logic, you **MUST** update the `getNetCostBreakdown` function in `src/lib/net-cost.ts` to include detailed, human-readable explanations (description and formula) for the new logic. These explanations must explicitly state whether the calculation is based on the **pre-tax cost** or the **total cost**.

- `promotionSavings`  = sum(bookingPromotions.appliedValue)
- `portalCashback`    = portalCashbackRate × basis (pre-tax or total)
- `cardReward`        = totalCost × creditCard.rewardRate × creditCard.pointValue
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
- `/settings` — Tabs for Hotel Chains, Credit Cards, Shopping Portals (all editable)

### Important Gotchas

- Prisma `Decimal` fields return as strings from API responses — always wrap with `Number()`
- Settings page uses controlled `Dialog` components with separate open/edit state variables
- `db:push` clears `.next` cache automatically; dev server restart still required after schema changes
- PostgreSQL on WSL2: start with `sudo service postgresql start` if not running

## Testing

**Framework:** Vitest, React Testing Library (RTL), jsdom

**Command:** `npm test`

### Standards

- **Precise Selectors:** ALWAYS use `data-testid` attributes on React components for specific values or elements to be tested (e.g., `data-testid="stat-value-total-bookings"`). This avoids ambiguity and ensures tests are robust against formatting changes.
- **Pure Logic:** Extract core business logic into pure functions (as seen in `promotion-matching.ts`) to allow for simple unit testing without mocking complex Prisma objects.
- **Mocking:** Mock large or browser-only dependencies in tests (e.g., `recharts`) to avoid issues with `jsdom` and keep tests fast.
- **Cost Basis:** When testing cost calculations, always verify that the description/formula explicitly states the cost basis (pre-tax vs total) per the project mandate.
