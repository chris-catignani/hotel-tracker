# Spec: Surface `needsReview` Flag on Booking Detail Page

## Overview

Bookings created via email ingestion are saved with `needsReview: true`, but this flag has no dismiss mechanism. The bookings list and dashboard already show the flag as a badge/count. This spec adds a dismissible banner on the booking detail page so users can acknowledge they've verified the auto-parsed details.

## API

**New handler:** `PATCH /api/bookings/[id]`

- Accepts `{ needsReview: boolean }`
- Performs an ownership check via `findFirst({ where: { id, userId } })` then updates with `prisma.booking.update({ where: { id }, data: { needsReview } })`
- Scoped to `userId` via `getAuthenticatedUserId()` (IDOR protection)
- Returns the updated booking (or just 200 — detail page refetches anyway)
- No other fields accepted; this is intentionally narrow

The existing `PUT` handler is unchanged. The complex promotion-matching, exchange-rate, and loyalty logic it contains is not needed for a simple flag flip.

## UI

**Location:** Booking detail page (`src/app/bookings/[id]/page.tsx`), between the page header and the Booking Info card.

**Condition:** Rendered only when `booking.needsReview === true`.

**Content:**

> "This booking was auto-imported from email — please verify the details are correct."
> [Mark as reviewed] button

**Behavior:**

1. User clicks "Mark as reviewed"
2. `PATCH /api/bookings/:id` called with `{ needsReview: false }`
3. On success: `refetchBooking()` — banner disappears
4. On failure: `toast.error(...)` — same pattern as `toggleVerified`

**Not shown on edit page** — the edit form's PUT doesn't pass `needsReview`, so a dismiss button there would mislead the user into thinking their edits were also saved.

## Types

Add `needsReview: boolean` to the `Booking` interface in the detail page (it's already in the bookings-list page interface and `src/lib/types.ts`).

## Tests

**Unit (Vitest):** `PATCH /api/bookings/[id]` handler

- Returns 200 and updates `needsReview: false` for the booking owner
- Returns 401 for unauthenticated requests
- Returns 404 when booking belongs to a different user

**E2E (Playwright):**

- Create a booking with `needsReview: true` via API
- Navigate to detail page — banner is visible
- Click "Mark as reviewed" — banner disappears
- Refresh — banner still gone
