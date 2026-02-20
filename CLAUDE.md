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

### Net Cost Formula

```
Net Cost = totalCost - promotionSavings - portalCashback - cardReward - loyaltyPointsValue

promotionSavings  = sum(bookingPromotions.appliedValue)
portalCashback    = portalCashbackRate × totalCost
cardReward        = totalCost × creditCard.rewardRate × creditCard.pointValue
loyaltyPointsValue = loyaltyPointsEarned × hotel.pointValue
```

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
