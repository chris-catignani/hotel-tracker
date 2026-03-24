# Error Handling & Observability Design

**Issue:** [#288 — Improve error logging and actionability](https://github.com/chris-catignani/hotel-tracker/issues/288)
**Date:** 2026-03-24

---

## Goal

Eliminate silent errors across the app, ensure Sentry captures structured context for every failure, and establish a repeatable pattern for all future features to follow.

Two specific outcomes:

- **Developer experience:** every error in Sentry is actionable — grouped by static message, enriched with structured context (resource IDs, status codes), never polluted with interpolated strings.
- **User experience:** no silent failures. Every fetch error shows an `ErrorBanner`. Every mutation failure shows a toast.

---

## New Utilities

### `src/lib/api-fetch.ts` — `apiFetch<T>()`

A typed wrapper around `fetch`. Handles HTTP mechanics and error extraction only. No logging, no state management.

**Signature:**

```ts
apiFetch<T>(
  url: string,
  opts?: {
    method?: "GET" | "POST" | "PUT" | "DELETE"  // defaults to "GET"
    body?: unknown                               // JSON serialized
  }
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: Error }>
```

- `ok: true` — `data` is the parsed response body
- `ok: false` — `status` is the HTTP status code; `error` is an `Error` whose `message` is the extracted server message (from the `.error` response field, or a generic fallback), passed directly to `logger.error` for Sentry
- **HTTP errors** (non-2xx responses): `error = new Error(extractedMessage)` — created inside `apiFetch` at the point of detection, giving a more useful stack trace than one pointing to `logger.ts`
- **Network errors** (fetch throws — DNS failure, connection refused, etc.): `error = new Error("Network error", { cause: originalError })` — uses the native JS error cause chain to preserve the original. Call sites never need their own `try/catch`.

Internally uses the existing `extractApiError` utility.

**Example — standard mutation:**

```ts
const result = await apiFetch(`/api/bookings/${id}`, { method: "DELETE" });

if (!result.ok) {
  logger.error("Failed to delete booking", result.error, { bookingId: id, status: result.status });
  toast.error("Failed to delete booking. Please try again.");
  return;
}

toast.success("Booking deleted");
router.push("/bookings");
```

**Example — expected / OK error (caller suppresses logging):**

```ts
const result = await apiFetch<Booking>(`/api/bookings/${id}`);

if (!result.ok) {
  if (result.status === 404) return null; // expected, don't log
  logger.error("Failed to fetch booking", result.error, { bookingId: id, status: result.status });
  return null;
}

return result.data;
```

---

### `src/hooks/use-api-query.ts` — `useApiQuery<T>()`

A React hook that manages the full lifecycle of a data fetch: fires on mount, tracks loading/data/error state. Does not log — the caller provides an `onError` callback for that, keeping the logging decision at the call site.

**Signature:**

```ts
useApiQuery<T>(
  url: string,
  opts?: {
    onError?: (err: { status: number; error: Error }) => void
  }
): {
  data: T | null
  loading: boolean
  error: { status: number; error: Error } | null
  clearError: () => void   // resets hook's error state — pass to ErrorBanner's onDismiss
  refetch: () => void      // re-triggers the fetch manually
}
```

Internally uses `apiFetch`.

**Behaviour notes:**

- A change in `url` triggers a new fetch automatically (equivalent to calling `refetch()`).
- Calling `refetch()` does not clear `error` — the previous error persists until a successful response. Use `clearError()` to dismiss it explicitly.
- `onError` is captured in a ref internally. This means identity changes never trigger a re-fetch, and the ref is always current so there are no stale closure issues. `useCallback` is not required but is still good practice if the callback captures expensive reactive values.

**Example — standard data fetch:**

```ts
const { data: bookings, loading, error, clearError } = useApiQuery<Booking[]>("/api/bookings", {
  onError: (err) => logger.error("Failed to fetch bookings", err.error, { status: err.status })
})

if (loading) return <Spinner />

return (
  <>
    <ErrorBanner
      error={error ? "Failed to load bookings. Please try again." : null}
      onDismiss={clearError}
    />
    {bookings && <BookingList bookings={bookings} />}
  </>
)
```

**Example — status-specific error messages:**

```ts
const { data, loading, error, clearError } = useApiQuery<Promotion[]>("/api/promotions", {
  onError: (err) => logger.error("Failed to fetch promotions", err.error, { status: err.status }),
});

const errorMessage = !error
  ? null
  : error.status === 404
    ? "No promotions found."
    : "Failed to load promotions. Please try again.";
```

---

## Server-Side Enhancement

### `apiError()` context param

Add an optional `context` record to `apiError()` so route handlers can pass structured resource context (IDs, operation details) without interpolating them into the message string.

**Updated signature:**

```ts
apiError(
  message: string,
  error: unknown,
  status?: number,
  request?: NextRequest,
  context?: Record<string, unknown>  // ← new
)
```

**Example:**

```ts
// Before
return apiError("Failed to fetch booking", error, 500, request);

// After
return apiError("Failed to fetch booking", error, 500, request, { bookingId: id });
```

The `context` is forwarded to `logger.error()` alongside `path` and `method`, ensuring Sentry groups by the static message while still carrying the resource ID for triage.

---

## The Pattern

All new and migrated code follows these rules:

| Scenario                    | Tool          | Error UI        | Logging                             |
| --------------------------- | ------------- | --------------- | ----------------------------------- |
| Data fetching (GET)         | `useApiQuery` | `<ErrorBanner>` | `onError` callback → `logger.error` |
| Mutations (POST/PUT/DELETE) | `apiFetch`    | `toast.error()` | `logger.error()` at call site       |
| Expected / OK errors        | `apiFetch`    | none            | caller decides whether to log       |

### Logging rules

1. **Static messages only.** The message string passed to `logger.error` must never contain dynamic values. Sentry groups errors by message — interpolation creates a unique group per resource ID.

   ```ts
   // ✗ Wrong — unique Sentry group per booking
   logger.error(`Failed to delete booking ${id}`, result.error);

   // ✓ Correct — all delete failures grouped together
   logger.error("Failed to delete booking", result.error, { bookingId: id });
   ```

2. **Structured context as params.** All dynamic data (IDs, status codes, user context) goes in the third `extra` argument.

3. **Always pass `result.error` as the second argument when using `apiFetch`.** `apiFetch` always populates `error` on failure — an `Error` captured at the point of detection inside the API layer. This gives Sentry a more useful stack trace than one pointing to `logger.ts`. For `catch` blocks outside of `apiFetch`, pass the caught error directly.

   ```ts
   // apiFetch error — pass result.error
   if (!result.ok) {
     logger.error("Failed to delete booking", result.error, { bookingId: id, status: result.status })
   }

   // Caught exception outside apiFetch — pass the error object directly
   try { ... } catch (e) {
     logger.error("Unexpected error", e, { bookingId: id })
   }
   ```

4. **No manual `Sentry.captureException` in components.** All Sentry reporting flows through `logger.error`. This keeps one place to change if Sentry configuration evolves.

5. **Server routes pass resource context.** All `[id]` routes pass the resource ID to `apiError()` via the new `context` param.

---

## Pages to Fix

### Silent errors — no user feedback today

| File                             | Problem                                                                    | Fix                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/app/promotions/page.tsx`    | Fetch and delete failures call `logger.error` only — nothing shown to user | Migrate fetch to `useApiQuery` + `ErrorBanner`; migrate delete to `apiFetch` + `toast` |
| `src/app/bookings/[id]/page.tsx` | No error handling at all                                                   | Migrate fetch to `useApiQuery` + `ErrorBanner`                                         |

### Manual `Sentry.captureException` in components

| File                           | Problem                                                    | Fix                                                       |
| ------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------- |
| `src/app/page.tsx` (dashboard) | Calls `Sentry.captureException` directly after fetch error | Replace with `logger.error` via `useApiQuery`'s `onError` |
| `src/app/bookings/page.tsx`    | Same                                                       | Same                                                      |

### Mutations using `ErrorBanner` instead of toasts

| File                                  | Mutations affected                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/price-watch/page.tsx`        | Update price watch, delete price watch, save spirit code                                                                                                                                                                                                                                                                                         |
| `src/app/bookings/[id]/edit/page.tsx` | Save booking                                                                                                                                                                                                                                                                                                                                     |
| `src/app/bookings/new/page.tsx`       | Two issues: (1) create-booking fetch has no `try/catch` — a network error throws uncaught; migrating to `apiFetch` fixes this since `apiFetch` catches network errors internally. (2) price-watch `logger.error` uses an interpolated message string (`\`Price watch creation failed: ${message}\``) — migrate to static message + context param |
| All settings tabs                     | Audit — migrate all mutation errors to `apiFetch` + toasts                                                                                                                                                                                                                                                                                       |

### Settings tabs to audit

`src/components/settings/`: `credit-card-accordion-item.tsx`, `credit-cards-tab.tsx`, `ota-agencies-tab.tsx`, `user-status-tab.tsx`, `card-benefits-section.tsx`, `hotel-chains-tab.tsx`, `my-cards-tab.tsx`, `properties-tab.tsx`, `point-types-tab.tsx`, `shopping-portals-tab.tsx`

---

## What Is Not Changing

| Item                                                  | Reason                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/app/error.tsx`                                   | Global React error boundary — Sentry capture there is correct           |
| `src/lib/logger.ts`                                   | Already correct                                                         |
| `sentry.server.config.ts` / `sentry.client.config.ts` | Already correct                                                         |
| `src/components/sentry-user-context.tsx`              | Already correct                                                         |
| All existing server-side `apiError()` call sites      | Already consistent; only getting the new context param at `[id]` routes |

---

## New Dependency

**Sonner** — toast notification library, the idiomatic shadcn/ui pairing. Add `<Toaster />` to the root layout (`src/app/layout.tsx`). No visual reconciliation with `ErrorBanner` is required — they serve different roles (inline persistent vs. transient overlay).

---

## Testing

- Unit tests for `apiFetch` covering: success response, non-ok response with `.error` body, non-ok response without body (fallback message), network error (fetch throws — verify returned as `{ ok: false, status: 0 }`)
- Unit tests for `useApiQuery` covering: loading state, success, error state, `clearError`, `refetch`, `onError` callback invoked on failure
- Unit test for updated `apiError`: verify that `context` fields are merged into the `extra` object forwarded to `logger.error` (and therefore Sentry)
- Existing E2E tests provide regression coverage for all migrated pages — no new E2E tests needed beyond confirming the existing suite passes
