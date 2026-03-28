# Axiom Observability Design

**Date:** 2026-03-28
**Issue:** #326 — Add tracking for inbound email success/failure and parsing statistics

## Overview

Replace the custom health dashboard metrics with Axiom as the single observability platform. Add structured logging to the email ingestion pipeline and cron jobs. Simplify the `/health` page to a static links hub.

## Architecture

Add `next-axiom` to the project. It provides a `Logger` class that sends structured JSON fields directly to Axiom, configured via two environment variables:

- `AXIOM_TOKEN` — API token (server-side only)
- `NEXT_PUBLIC_AXIOM_DATASET` — dataset name

All logs flow to Axiom via the Vercel log drain. The existing Sentry integration is unchanged — `logger.warn` and `logger.error` continue to capture to Sentry alongside Axiom.

## `logger.ts` Integration

Update `logger.ts` to wrap a `next-axiom` `Logger` instance internally. The public interface is unchanged:

```typescript
logger.info(message: string, extra?: Record<string, unknown>)
logger.warn(message: string, extra?: Record<string, unknown>)
logger.error(message: string, error?: unknown, extra?: Record<string, unknown>)
```

Each method passes `message` as the Axiom log message and spreads `extra` as top-level structured fields. This means all existing log call sites get Axiom structured fields automatically — no call-site changes required.

## `withRouteLogging` Wrapper

A higher-order function composed with `next-axiom`'s `withAxiom`. Applied to route handlers that need observability:

```typescript
export default withAxiom(withRouteLogging("cron:exchange-rates", handler));
```

Logs automatically:

- **On entry:** `method`, `pathname`
- **On success:** `status`, `durationMs`
- **On unhandled error:** `error` (also forwarded to Sentry via `logger.error`)

Applied to:

- `src/app/api/inbound-email/route.ts`
- `src/app/api/cron/refresh-exchange-rates/route.ts`

Note: price watch refresh runs as a GitHub Actions workflow, not a Next.js route — it is not instrumented here.

No Next.js middleware — `withRouteLogging` covers the routes we care about with richer context.

## Email Ingestion Instrumentation

No call-site changes needed — all existing log calls get Axiom structured fields via the updated `logger.ts`. One addition: standardize an `outcome` field on the five terminal log calls so Axiom can filter and aggregate by result:

| Existing log message                                        | `outcome` value  |
| ----------------------------------------------------------- | ---------------- |
| `inbound-email: booking created`                            | `success`        |
| `inbound-email: parse failed`                               | `parse_failed`   |
| `inbound-email: duplicate booking, skipping`                | `duplicate`      |
| `inbound-email: discarding email — no matching user`        | `user_not_found` |
| `inbound-email: failed to fetch email body from Resend API` | `fetch_failed`   |

This enables Axiom queries like:

- Success rate over time
- Failure breakdown by `outcome`
- Volume by `chain`

## Cron Job Instrumentation

`withRouteLogging` handles start/complete/error logging automatically. Each handler adds one business-level log call on success:

**Exchange rates cron:**

```typescript
logger.info("cron:exchange-rates: stats", {
  currenciesUpdated,
  bookingsLocked,
  pointTypesRefreshed,
});
```

Price watch runs via GitHub Actions and is not a Next.js route — no instrumentation needed here.

## Health Dashboard Simplification

`/health` is rewritten as a static server component (no `"use client"`, no data fetching, no auto-refresh). It renders a simple card grid linking to external services:

| Link           | Purpose                                            |
| -------------- | -------------------------------------------------- |
| Axiom          | Logs, email ingestion stats, job health dashboards |
| Sentry         | Errors and warnings                                |
| GitHub Actions | CI status                                          |
| Vercel         | Deployments                                        |

The Axiom link uses `NEXT_PUBLIC_AXIOM_DATASET` to build a direct URL to the dataset. The Sentry link uses the existing `SENTRY_ORG` / `SENTRY_PROJECT` env vars (unchanged).

### Deleted Files

- `src/app/api/health/route.ts`
- `src/lib/health-utils.ts`
- `src/lib/health-utils.test.ts`
- `src/app/health/page.test.tsx`

## Axiom Dashboards

After instrumentation is in place, create two dashboards in the Axiom UI (not part of this code implementation):

**Email Ingestion Dashboard:**

- Total emails received per day
- Success rate over time
- Failure breakdown by `outcome`
- Volume by `chain`

**Job Health Dashboard:**

- Exchange rate cron: last run, duration, currencies updated
- Cron failure alert (monitor: no heartbeat in 25h)
- Price watch: tracked via GitHub Actions directly (not Axiom)

## Testing

- Unit test `withRouteLogging` — verify it logs entry/success/error fields correctly
- Update `inbound-email/route.test.ts` — verify `outcome` field is present in log calls
- No tests needed for the new health page (static, no logic)
- Delete health page and health-utils tests
