# Axiom Metrics Expansion Design

**Date:** 2026-03-29
**Issue:** #337

## Overview

Expand observability coverage by setting up a Vercel Log Drain (zero-code HTTP metrics for all routes) and adding structured business-level events to key routes. Also standardises the event naming scheme across all existing and new instrumentation.

---

## Part 1: Vercel Log Drain

Set up the Axiom Vercel integration via the Vercel dashboard (no code changes required).

**What it provides automatically:**
- HTTP access logs for every route: method, path, status code, response duration, bytes, region
- All stdout/stderr from serverless functions (captures `logger.info/warn/error` output)
- Deploy events: start, success, failure with git SHA, branch, environment, build duration

This replaces the need for middleware-based HTTP metrics and makes `withRouteLogging` redundant for HTTP-level observability.

**Setup:** Vercel Dashboard → Project → Integrations → Axiom → Enable Log Drain.

---

## Part 2: Remove `withRouteLogging`

With the log drain handling HTTP metrics, `withRouteLogging` is redundant. Remove it from the 2 existing routes. Keep `withAxiom` on those routes to ensure the Axiom SDK buffer flushes before the serverless function terminates.

- `cron/refresh-exchange-rates/route.ts`: `withAxiom(withRouteLogging(...))` → `withAxiom(handler)`
- `inbound-email/route.ts`: `withAxiom(withRouteLogging(...))` → `withAxiom(handler)`

`route-logging.ts` can be deleted once both usages are removed.

---

## Part 3: Standardised Event Naming Scheme

All `logger.info/warn/error` events use the format:

```
resource:action
```

- Lowercase, snake_case
- Colon separator
- Resource = noun (booking, inbound-email, auth, geo, exchange_rates)
- Action = past-tense verb or noun (created, updated, deleted, searched, refreshed)
- No prefix — Vercel Log Drain HTTP access logs are structurally distinct (different fields) so no collision risk

All business events include `userId` where an authenticated user is in scope.

---

## Part 4: Existing Route — Event Renames

### `cron/refresh-exchange-rates`

| Old | New |
|-----|-----|
| `"cron:exchange-rates: stats"` | `"exchange_rates:refreshed"` |

Fields unchanged: `currenciesUpdated`, `currenciesNotFound`, `bookingsLocked`, `pointTypesRefreshed`, `bookingsReevaluated`.

No `userId` — this is a system cron with no user scope.

### `inbound-email`

| Old | New | Notes |
|-----|-----|-------|
| `"inbound-email: received"` | `"inbound-email:received"` | Remove `from` field (PII). Keep `subject`. |
| `"inbound-email: discarding email — wrong recipient"` | `"inbound-email:discarded"` | Add `reason: "wrong_recipient"`. Remove `to` field (PII). |
| `"inbound-email: discarding email — no matching user"` | `"inbound-email:user_not_found"` | Remove `from` field (PII). |
| `"inbound-email: parse failed"` | `"inbound-email:parse_failed"` | Add `userId`. Remove `from` field (PII). |
| `"inbound-email: duplicate booking, skipping"` | `"inbound-email:duplicate"` | Add `userId`. Keep `bookingId`, `confirmationNumber`. |
| `"inbound-email: booking created"` | `"inbound-email:booking_created"` | Add `userId`. Keep `bookingId`, `property`, `checkIn`. |
| `"inbound-email: claude parsed"` | _(deleted)_ | Debug-level, not a useful metric. |

Error logs (`logger.error`) keep their existing descriptive messages — they route to Sentry and don't need the naming scheme.

---

## Part 5: New Route Instrumentation

Inline `logger.info` calls added after the key operation in each handler. No `withAxiom` wrapper needed — events reach Axiom via the Vercel Log Drain stdout capture.

### `POST /api/bookings`

Event: `"booking:created"`

```
userId, bookingId, accommodationType, checkIn, checkOut,
numNights, totalCost, currency, ingestionMethod, promotionsApplied
```

### `PUT /api/bookings/[id]`

Event: `"booking:updated"`

```
userId, bookingId, fieldsUpdated   // fieldsUpdated = Object.keys(data)
```

### `DELETE /api/bookings/[id]`

Event: `"booking:deleted"`

```
userId, bookingId
```

### `POST /api/auth/register`

Event: `"auth:registered"`

```
outcome: "success" | "duplicate"
userId   // only present on outcome: "success"
```

No email address — PII.

### `GET /api/geo/search`

Event: `"geo:searched"`

```
userId, accommodationType, resultCount, durationMs
```

Short-circuit (query < 3 chars) returns `[]` silently — not logged.

---

## Testing

- Unit tests for any helper logic changes (none expected — changes are additive logger calls)
- The 2 existing routes have no unit tests for logging; no new tests required for rename-only changes
- No E2E tests needed — logging side effects are not user-visible behaviour
