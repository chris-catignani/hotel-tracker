# Error Handling & Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate silent errors, standardize Sentry-friendly logging, and establish repeatable fetch/mutation patterns across all pages.

**Architecture:** Two new client-side utilities (`apiFetch`, `useApiQuery`) wrap `fetch` with consistent error extraction. Mutations use `apiFetch` + `toast.error()`. Data fetches use `useApiQuery` + `ErrorBanner`. Server `apiError()` gains an optional `context` param so `[id]` routes can pass resource IDs to Sentry without polluting static message strings.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest + RTL (unit tests), Sonner (toast notifications, new dependency), existing `logger.ts` / `api-error.ts` / `extractApiError` utilities.

**Spec:** `docs/superpowers/specs/2026-03-24-error-handling-design.md`

---

## File Map

### New files

| File                              | Responsibility                                                 |
| --------------------------------- | -------------------------------------------------------------- |
| `src/lib/api-fetch.ts`            | Typed `fetch` wrapper — HTTP mechanics + error extraction only |
| `src/lib/api-fetch.test.ts`       | Unit tests for `apiFetch`                                      |
| `src/hooks/use-api-query.ts`      | React hook — full GET lifecycle (loading / data / error)       |
| `src/hooks/use-api-query.test.ts` | Unit tests for `useApiQuery`                                   |

### Modified files

| File                                                     | Change                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/api-error.ts`                                   | Add optional `context` param forwarded to `logger.error`                             |
| `src/lib/api-error.test.ts`                              | Add test for context forwarding                                                      |
| `src/app/layout.tsx`                                     | Add `<Toaster />` from `sonner`                                                      |
| `src/app/page.tsx`                                       | Replace `Sentry.captureException` with `logger.error` via `useApiQuery`              |
| `src/app/bookings/page.tsx`                              | Same; also migrate delete to `apiFetch` + `toast`                                    |
| `src/app/promotions/page.tsx`                            | Migrate fetch to `useApiQuery`; migrate delete to `apiFetch` + `toast`               |
| `src/app/bookings/[id]/page.tsx`                         | Add error handling via `useApiQuery`; migrate `toggleVerified` to `apiFetch`         |
| `src/app/price-watch/page.tsx`                           | Migrate all mutations to `apiFetch` + `toast`                                        |
| `src/app/bookings/[id]/edit/page.tsx`                    | Migrate fetch to `useApiQuery`; migrate save to `apiFetch` + `toast`                 |
| `src/app/bookings/new/page.tsx`                          | Migrate create + price-watch creation to `apiFetch`; fix interpolated logger message |
| `src/components/settings/hotel-chains-tab.tsx`           | Migrate mutations to `apiFetch` + `toast`                                            |
| `src/components/settings/credit-cards-tab.tsx`           | Same                                                                                 |
| `src/components/settings/credit-card-accordion-item.tsx` | Same                                                                                 |
| `src/components/settings/my-cards-tab.tsx`               | Same                                                                                 |
| `src/components/settings/ota-agencies-tab.tsx`           | Same                                                                                 |
| `src/components/settings/user-status-tab.tsx`            | Same                                                                                 |
| `src/components/settings/card-benefits-section.tsx`      | Same                                                                                 |
| `src/components/settings/properties-tab.tsx`             | Same                                                                                 |
| `src/components/settings/point-types-tab.tsx`            | Same                                                                                 |
| `src/components/settings/shopping-portals-tab.tsx`       | Same                                                                                 |
| All `[id]` API route files (15 files)                    | Add `context: { id }` to every `apiError()` call                                     |

---

## Task 1: Install Sonner + Wire `<Toaster />` into Layout

**Files:**

- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install sonner**

```bash
npm install sonner
```

- [ ] **Step 2: Add `<Toaster />` to the root layout**

In `src/app/layout.tsx`, add inside `<SessionProvider>` (after `<SentryUserContext />`):

```tsx
import { Toaster } from "sonner";
// …inside <SessionProvider>:
<SentryUserContext />
<Toaster richColors position="top-right" />
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on localhost:3000 with no import errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx package.json package-lock.json
git commit -m "feat: install sonner and add Toaster to root layout"
```

---

## Task 2: `apiFetch` Utility — Tests + Implementation

**Files:**

- Create: `src/lib/api-fetch.ts`
- Create: `src/lib/api-fetch.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/api-fetch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch } from "./api-fetch";

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("apiFetch", () => {
  it("returns ok:true with parsed data on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, name: "Test" }),
    } as Response);

    const result = await apiFetch<{ id: number; name: string }>("/api/test");
    expect(result).toEqual({ ok: true, data: { id: 1, name: "Test" } });
  });

  it("returns ok:false with error message from .error field on non-2xx", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    } as Response);

    const result = await apiFetch("/api/test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe("Not found");
    }
  });

  it("returns ok:false with fallback message when response body has no .error field", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const result = await apiFetch("/api/test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.message).toBeTruthy(); // generic fallback
    }
  });

  it("returns ok:false with status 0 and cause chain on network error", async () => {
    const networkErr = new Error("Connection refused");
    vi.mocked(global.fetch).mockRejectedValue(networkErr);

    const result = await apiFetch("/api/test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(0);
      expect(result.error.message).toBe("Network error");
      expect((result.error as Error & { cause: unknown }).cause).toBe(networkErr);
    }
  });

  it("forwards method and JSON-serialized body", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/api/test", { method: "POST", body: { name: "hello" } });
    expect(global.fetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "hello" }),
    });
  });

  it("accepts PATCH method", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/api/test", { method: "PATCH", body: { verified: true } });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("defaults to GET and no body when opts omitted", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/api/test");
    expect(global.fetch).toHaveBeenCalledWith("/api/test", {
      method: "GET",
      headers: {},
      body: undefined,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- src/lib/api-fetch.test.ts
```

Expected: FAIL — "Cannot find module './api-fetch'"

- [ ] **Step 3: Implement `apiFetch`**

Create `src/lib/api-fetch.ts`:

```ts
import { extractApiError } from "./client-error";

type ApiFetchResult<T> = { ok: true; data: T } | { ok: false; status: number; error: Error };

export async function apiFetch<T>(
  url: string,
  opts?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  }
): Promise<ApiFetchResult<T>> {
  const method = opts?.method ?? "GET";
  const hasBody = opts?.body !== undefined;

  try {
    const res = await fetch(url, {
      method,
      headers: hasBody ? { "Content-Type": "application/json" } : {},
      body: hasBody ? JSON.stringify(opts!.body) : undefined,
    });

    if (!res.ok) {
      const message = await extractApiError(res, "An unexpected error occurred.");
      return { ok: false, status: res.status, error: new Error(message) };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: new Error("Network error", { cause: e }),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- src/lib/api-fetch.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-fetch.ts src/lib/api-fetch.test.ts
git commit -m "feat: add apiFetch typed fetch wrapper with structured error results"
```

---

## Task 3: `useApiQuery` Hook — Tests + Implementation

**Files:**

- Create: `src/hooks/use-api-query.ts`
- Create: `src/hooks/use-api-query.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/use-api-query.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useApiQuery } from "./use-api-query";

function okResponse(data: unknown) {
  return Promise.resolve({ ok: true, json: async () => data } as Response);
}

function errorResponse(status: number, error: string) {
  return Promise.resolve({ ok: false, status, json: async () => ({ error }) } as Response);
}

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("useApiQuery", () => {
  it("starts in loading state", () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useApiQuery("/api/test"));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets data and clears loading on success", async () => {
    vi.mocked(global.fetch).mockReturnValue(okResponse([{ id: 1 }]));
    const { result } = renderHook(() => useApiQuery<{ id: number }[]>("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 1 }]);
    expect(result.current.error).toBeNull();
  });

  it("sets error and invokes onError on failure", async () => {
    vi.mocked(global.fetch).mockReturnValue(errorResponse(500, "Server error"));
    const onError = vi.fn();
    const { result } = renderHook(() => useApiQuery("/api/test", { onError }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.status).toBe(500);
    expect(result.current.error?.error.message).toBe("Server error");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith({
      status: 500,
      error: expect.any(Error),
    });
  });

  it("clearError resets error state", async () => {
    vi.mocked(global.fetch).mockReturnValue(errorResponse(500, "Server error"));
    const { result } = renderHook(() => useApiQuery("/api/test"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it("refetch re-triggers the fetch", async () => {
    vi.mocked(global.fetch).mockReturnValue(okResponse({ count: 1 }));
    const { result } = renderHook(() => useApiQuery("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    vi.mocked(global.fetch).mockReturnValue(okResponse({ count: 2 }));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.data).toEqual({ count: 2 }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("refetch does not clear existing error — error persists until success", async () => {
    vi.mocked(global.fetch).mockReturnValue(errorResponse(500, "Oops"));
    const { result } = renderHook(() => useApiQuery("/api/test"));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // refetch also fails
    vi.mocked(global.fetch).mockReturnValue(errorResponse(500, "Still bad"));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  it("a new url triggers a fresh fetch", async () => {
    vi.mocked(global.fetch).mockReturnValue(okResponse({ page: 1 }));
    const { result, rerender } = renderHook(({ url }) => useApiQuery(url), {
      initialProps: { url: "/api/test?page=1" },
    });
    await waitFor(() => expect(result.current.data).toEqual({ page: 1 }));

    vi.mocked(global.fetch).mockReturnValue(okResponse({ page: 2 }));
    rerender({ url: "/api/test?page=2" });
    await waitFor(() => expect(result.current.data).toEqual({ page: 2 }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("onError identity change does not trigger a re-fetch", async () => {
    vi.mocked(global.fetch).mockReturnValue(okResponse([]));
    const { result, rerender } = renderHook(({ cb }) => useApiQuery("/api/test", { onError: cb }), {
      initialProps: { cb: vi.fn() },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    rerender({ cb: vi.fn() }); // new function identity
    expect(global.fetch).toHaveBeenCalledTimes(1); // no extra fetch
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- src/hooks/use-api-query.test.ts
```

Expected: FAIL — "Cannot find module './use-api-query'"

- [ ] **Step 3: Implement `useApiQuery`**

Create `src/hooks/use-api-query.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

interface QueryError {
  status: number;
  error: Error;
}

interface UseApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: QueryError | null;
  clearError: () => void;
  refetch: () => void;
}

export function useApiQuery<T>(
  url: string,
  opts?: { onError?: (err: QueryError) => void }
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<QueryError | null>(null);

  // Capture onError in a ref so identity changes don't cause re-fetches
  const onErrorRef = useRef(opts?.onError);
  useEffect(() => {
    onErrorRef.current = opts?.onError;
  });

  // fetchId ensures stale responses are discarded
  const fetchIdRef = useRef(0);

  const doFetch = useCallback(async () => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    const result = await apiFetch<T>(url);
    if (id !== fetchIdRef.current) return; // stale — a newer fetch is in flight
    setLoading(false);
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      const queryError: QueryError = { status: result.status, error: result.error };
      setError(queryError);
      onErrorRef.current?.(queryError);
    }
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    doFetch();
  }, [doFetch]);

  const clearError = useCallback(() => setError(null), []);
  const refetch = useCallback(() => doFetch(), [doFetch]);

  return { data, loading, error, clearError, refetch };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- src/hooks/use-api-query.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-api-query.ts src/hooks/use-api-query.test.ts
git commit -m "feat: add useApiQuery hook for data-fetch lifecycle management"
```

---

## Task 4: `apiError` — Add `context` Param

**Files:**

- Modify: `src/lib/api-error.ts`
- Modify: `src/lib/api-error.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/api-error.test.ts` (inside the existing `describe("apiError")`):

```ts
it("merges context fields into logger.error extra", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const { logger } = await import("./logger");
  const loggerSpy = vi.spyOn(logger, "error");

  apiError("Failed to fetch booking", new Error("DB error"), 500, undefined, {
    bookingId: "b-123",
  });

  expect(loggerSpy).toHaveBeenCalledWith(
    "Failed to fetch booking",
    expect.any(Error),
    expect.objectContaining({ bookingId: "b-123" })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/lib/api-error.test.ts
```

Expected: FAIL — the new test fails because `context` isn't yet forwarded.

- [ ] **Step 3: Update `apiError` signature and implementation**

Update `src/lib/api-error.ts`:

```ts
export function apiError(
  message: string,
  error: unknown,
  status: number = 500,
  request?: NextRequest,
  context?: Record<string, unknown>   // ← new param
) {
  const isDev = process.env.NODE_ENV === "development";

  logger.error(message, error, {
    path: request?.nextUrl.pathname,
    method: request?.method,
    ...context,   // ← merge context into extra
  });
  // … rest of function unchanged
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- src/lib/api-error.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-error.ts src/lib/api-error.test.ts
git commit -m "feat: add optional context param to apiError for structured Sentry context"
```

---

## Task 5: Migrate Dashboard Page (`src/app/page.tsx`)

**Files:**

- Modify: `src/app/page.tsx`

The dashboard currently calls `Sentry.captureException` directly. Replace with `useApiQuery` + `logger.error` via `onError`.

- [ ] **Step 1: Locate the fetch block**

In `src/app/page.tsx`, find the `fetchBookings` / `useEffect` block (around line 230). It uses:

- `fetch("/api/bookings")`
- `Sentry.captureException(...)` on error
- `setFetchError(message)` + `ErrorBanner`

- [ ] **Step 2: Refactor to `useApiQuery`**

Replace the `fetchBookings` callback + `useEffect` + `loading` / `fetchError` states with:

```tsx
import { useApiQuery } from "@/hooks/use-api-query";
import { logger } from "@/lib/logger";
// Remove: import * as Sentry from "@sentry/nextjs"
// Remove: import { extractApiError } from "@/lib/client-error"

const {
  data: bookings,
  loading,
  error: fetchError,
  clearError,
} = useApiQuery<BookingWithRelations[]>("/api/bookings", {
  onError: (err) => logger.error("Failed to fetch bookings", err.error, { status: err.status }),
});
```

Replace `<ErrorBanner error={fetchError} onDismiss={() => setFetchError(null)} />` with:

```tsx
<ErrorBanner
  error={fetchError ? "Failed to load bookings. Please try again." : null}
  onDismiss={clearError}
/>
```

Remove: `useState` for `bookings`, `loading`, `fetchError`; the `fetchBookings` callback; `useEffect`; `Sentry` import; `extractApiError` import. The `bookings` list now comes from `useApiQuery` — default it to `[]` where `null` would break downstream: `const safeBookings = bookings ?? []`.

- [ ] **Step 3: Run lint + unit tests**

```bash
npm run lint && npm run test
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix: replace Sentry.captureException with logger.error via useApiQuery on dashboard"
```

---

## Task 6: Migrate Bookings List Page (`src/app/bookings/page.tsx`)

**Files:**

- Modify: `src/app/bookings/page.tsx`

Currently: `Sentry.captureException` for fetch, raw `fetch` + `setDeleteError` text (not toast) for delete.

- [ ] **Step 1: Replace fetch with `useApiQuery`**

Remove the `fetchBookings` callback, the `useEffect`, and the `Sentry` / `extractApiError` imports.
Replace `bookings`, `loading`, `fetchError` state with:

```tsx
import { useApiQuery } from "@/hooks/use-api-query";
import { logger } from "@/lib/logger";
// Remove: import * as Sentry from "@sentry/nextjs"
// Remove: import { extractApiError } from "@/lib/client-error"

const {
  data: bookingsData,
  loading,
  error: fetchError,
  clearError,
  refetch: refetchBookings,
} = useApiQuery<Booking[]>("/api/bookings", {
  onError: (err) => logger.error("Failed to fetch bookings", err.error, { status: err.status }),
});
const bookings = bookingsData ?? [];
```

Replace `<ErrorBanner error={fetchError} onDismiss={() => setFetchError(null)} />` with:

```tsx
<ErrorBanner
  error={fetchError ? "Failed to load bookings. Please try again." : null}
  onDismiss={clearError}
/>
```

- [ ] **Step 2: Migrate delete mutation to `apiFetch` + toast**

Remove the `deleteError` state and the `<p data-testid="booking-delete-error">` element.

```tsx
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";

const handleDeleteConfirm = async () => {
  if (bookingToDelete === null) return;
  setDeleteOpen(false);
  const result = await apiFetch(`/api/bookings/${bookingToDelete}`, { method: "DELETE" });
  if (!result.ok) {
    logger.error("Failed to delete booking", result.error, {
      bookingId: bookingToDelete,
      status: result.status,
    });
    toast.error("Failed to delete booking. Please try again.");
    return;
  }
  setBookingToDelete(null);
  refetchBookings();
};
```

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint && npm run test
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/bookings/page.tsx
git commit -m "fix: replace Sentry.captureException with logger.error; migrate delete to toast"
```

---

## Task 7: Migrate Promotions Page (`src/app/promotions/page.tsx`)

**Files:**

- Modify: `src/app/promotions/page.tsx`

Currently: fetch silently ignores errors (no user feedback), delete silently ignores errors.

- [ ] **Step 1: Replace fetch with `useApiQuery`**

Remove the `promotions` state, `loading` state, `fetchPromotions` callback, `useEffect`.

```tsx
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
// Remove: import { logger } (keep if still used, otherwise remove)

const {
  data: promotionsData,
  loading,
  error: fetchError,
  clearError,
  refetch: refetchPromotions,
} = useApiQuery<Promotion[]>("/api/promotions", {
  onError: (err) => logger.error("Failed to fetch promotions", err.error, { status: err.status }),
});
const promotions = promotionsData ?? [];
```

Add `<ErrorBanner>` at the top of the returned JSX (import `ErrorBanner` from `@/components/ui/error-banner`):

```tsx
<ErrorBanner
  error={fetchError ? "Failed to load promotions. Please try again." : null}
  onDismiss={clearError}
/>
```

- [ ] **Step 2: Migrate delete to `apiFetch` + toast**

```tsx
const handleDelete = async (id: string) => {
  if (!confirm("Are you sure you want to delete this promotion?")) return;
  const result = await apiFetch(`/api/promotions/${id}`, { method: "DELETE" });
  if (!result.ok) {
    logger.error("Failed to delete promotion", result.error, {
      promotionId: id,
      status: result.status,
    });
    toast.error("Failed to delete promotion. Please try again.");
    return;
  }
  refetchPromotions();
};
```

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/app/promotions/page.tsx
git commit -m "fix: add ErrorBanner for fetch errors and toast for delete errors on promotions page"
```

---

## Task 8: Migrate Booking Detail Page (`src/app/bookings/[id]/page.tsx`)

**Files:**

- Modify: `src/app/bookings/[id]/page.tsx`

Currently: fetch has no error handling at all; `toggleVerified` has no error handling.

- [ ] **Step 1: Replace `fetchBooking` with `useApiQuery`**

Remove the `booking` state, `loading` state, `fetchBooking` callback, `useEffect`.

```tsx
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { ErrorBanner } from "@/components/ui/error-banner";

const {
  data: booking,
  loading,
  error: fetchError,
  clearError,
  refetch: refetchBooking,
} = useApiQuery<Booking>(`/api/bookings/${id}`, {
  onError: (err) =>
    logger.error("Failed to fetch booking", err.error, { bookingId: id, status: err.status }),
});
```

Update the loading guard:

```tsx
if (loading) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Booking Details</h1>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
```

Add `<ErrorBanner>` above the existing `if (!booking)` check's return or as an early render:

```tsx
// After the loading check:
if (fetchError) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Booking Details</h1>
      <ErrorBanner error="Failed to load booking. Please try again." onDismiss={clearError} />
    </div>
  );
}
```

- [ ] **Step 2: Migrate `toggleVerified` to `apiFetch` + toast**

```tsx
const toggleVerified = async (bp: BookingPromotion) => {
  const result = await apiFetch(`/api/booking-promotions/${bp.id}`, {
    method: "PATCH",
    body: { verified: !bp.verified },
  });
  if (!result.ok) {
    logger.error("Failed to update promotion verification", result.error, {
      bookingPromotionId: bp.id,
      status: result.status,
    });
    toast.error("Failed to update. Please try again.");
    return;
  }
  refetchBooking();
};
```

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/app/bookings/[id]/page.tsx
git commit -m "fix: add error handling to booking detail page fetch and toggleVerified mutation"
```

---

## Task 9: Migrate Price Watch Page (`src/app/price-watch/page.tsx`)

**Files:**

- Modify: `src/app/price-watch/page.tsx`

Currently: three mutations (`handleToggle`, `handleDelete`, `handleSaveChainPropertyId`) use `setError` + `ErrorBanner`. Fetch has no error handling at all.

- [ ] **Step 1: Add `useApiQuery` for the initial fetch**

Replace `loadWatches` callback + `useEffect` + `loading`/`watches` state:

```tsx
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

const {
  data: watchesData,
  loading,
  error: fetchError,
  clearError,
  refetch: refetchWatches,
} = useApiQuery<PriceWatch[]>("/api/price-watches", {
  onError: (err) =>
    logger.error("Failed to fetch price watches", err.error, { status: err.status }),
});
const watches = watchesData ?? [];
```

Add `<ErrorBanner>` for the fetch error (replace existing `<ErrorBanner error={error} ...>`):

```tsx
<ErrorBanner
  error={fetchError ? "Failed to load price watches. Please try again." : null}
  onDismiss={clearError}
/>
```

- [ ] **Step 2: Migrate `handleToggle` to `apiFetch` + toast**

```tsx
const handleToggle = async (watch: PriceWatch, enabled: boolean) => {
  setTogglingId(watch.id);
  const result = await apiFetch<PriceWatch>(`/api/price-watches/${watch.id}`, {
    method: "PUT",
    body: { isEnabled: enabled },
  });
  setTogglingId(null);
  if (!result.ok) {
    logger.error("Failed to update price watch", result.error, {
      priceWatchId: watch.id,
      status: result.status,
    });
    toast.error("Failed to update price watch. Please try again.");
    return;
  }
  // Optimistic update from response
  refetchWatches();
};
```

- [ ] **Step 3: Migrate `handleDelete` to `apiFetch` + toast**

```tsx
const handleDelete = async (watch: PriceWatch) => {
  if (!confirm(`Stop watching prices for ${pruneHotelName(watch.property.name)}?`)) return;
  setDeletingId(watch.id);
  const result = await apiFetch(`/api/price-watches/${watch.id}`, { method: "DELETE" });
  setDeletingId(null);
  if (!result.ok) {
    logger.error("Failed to delete price watch", result.error, {
      priceWatchId: watch.id,
      status: result.status,
    });
    toast.error("Failed to delete price watch. Please try again.");
    return;
  }
  refetchWatches();
};
```

- [ ] **Step 4: Migrate `handleSaveChainPropertyId` to `apiFetch` + toast**

```tsx
const handleSaveChainPropertyId = async (propertyId: string) => {
  setSavingPropertyId(propertyId);
  const result = await apiFetch<{ chainPropertyId: string | null }>(
    `/api/properties/${propertyId}`,
    {
      method: "PUT",
      body: { chainPropertyId: editingValue.trim() || null },
    }
  );
  setSavingPropertyId(null);
  if (!result.ok) {
    logger.error("Failed to save chain property ID", result.error, {
      propertyId,
      status: result.status,
    });
    toast.error("Failed to save. Please try again.");
    return;
  }
  const saved = editingValue.trim() || null;
  refetchWatches(); // simplest — re-fetch rather than manual optimistic patch
  setEditingPropertyId(null);
  setEditingValue("");
};
```

Remove `error` state, `extractApiError` import, and the now-unused `setError(null)` calls.

- [ ] **Step 5: Run lint + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 6: Commit**

```bash
git add src/app/price-watch/page.tsx
git commit -m "fix: migrate price-watch mutations to apiFetch+toast and add fetch error handling"
```

---

## Task 10: Migrate Booking Edit + New Pages

**Files:**

- Modify: `src/app/bookings/[id]/edit/page.tsx`
- Modify: `src/app/bookings/new/page.tsx`

### Edit page

Currently: raw `fetch` for load; mutation uses `setError` + `ErrorBanner`.

- [ ] **Step 1: Replace fetch with `useApiQuery`; migrate save to `apiFetch` + toast**

In `src/app/bookings/[id]/edit/page.tsx`:

```tsx
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
// Remove: import { extractApiError } from "@/lib/client-error"

const {
  data: booking,
  loading,
  error: fetchError,
  clearError,
} = useApiQuery<Booking>(`/api/bookings/${id}`, {
  onError: (err) =>
    logger.error("Failed to fetch booking", err.error, { bookingId: id, status: err.status }),
});
```

The `<ErrorBanner error={error} ...>` can now serve as the fetch error banner:

```tsx
<ErrorBanner
  error={fetchError ? "Failed to load booking. Please try again." : null}
  onDismiss={clearError}
/>
```

Migrate `handleSubmit`:

```tsx
const handleSubmit = async (data: BookingFormData) => {
  setSubmitting(true);
  const result = await apiFetch<Booking>(`/api/bookings/${id}`, {
    method: "PUT",
    body: data,
  });
  setSubmitting(false);
  if (!result.ok) {
    logger.error("Failed to update booking", result.error, {
      bookingId: id,
      status: result.status,
    });
    toast.error("Failed to save booking. Please try again.");
    return;
  }
  router.push(`/bookings/${id}`);
};
```

Remove: `error` state, `setError`, `fetchData` callback, separate `useEffect`.

### New booking page

Currently: (1) no `try/catch` around create — network errors would throw uncaught; (2) price-watch `logger.error` uses an interpolated message string.

- [ ] **Step 2: Migrate create + price-watch creation to `apiFetch`; fix interpolated log message**

In `src/app/bookings/new/page.tsx`:

```tsx
import { apiFetch } from "@/lib/api-fetch";
// Remove: import { extractApiError } from "@/lib/client-error"

const handleSubmit = async (data: BookingFormData) => {
  setError(null);
  setSubmitting(true);

  const result = await apiFetch<{ id: string; propertyId: string }>("/api/bookings", {
    method: "POST",
    body: data,
  });

  if (!result.ok) {
    setSubmitting(false);
    logger.error("Failed to create booking", result.error, { status: result.status });
    setError("Failed to create booking. Please try again.");
    return;
  }

  const booking = result.data;

  if (priceWatchEnabled) {
    const watchResult = await apiFetch("/api/price-watches", {
      method: "POST",
      body: {
        propertyId: booking.propertyId,
        isEnabled: true,
        bookingId: booking.id,
        cashThreshold: cashThreshold ? Number(cashThreshold) : null,
        awardThreshold: awardThreshold ? Number(awardThreshold) : null,
      },
    });
    if (!watchResult.ok) {
      // Price watch failure is non-fatal; booking already created
      logger.error("Failed to create price watch", watchResult.error, {
        bookingId: booking.id,
        propertyId: booking.propertyId,
        status: watchResult.status,
      });
    }
  }

  router.push(`/bookings/${booking.id}`);
};
```

Note: the `error` state + `<ErrorBanner>` for the create mutation are acceptable here (this is not a settings tab mutation — it's the primary form submission, blocking the submit flow).

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/app/bookings/[id]/edit/page.tsx src/app/bookings/new/page.tsx
git commit -m "fix: migrate booking edit/new pages to apiFetch; fix interpolated logger message"
```

---

## Task 11: Migrate Settings Tabs — Batch 1

**Files:**

- Modify: `src/components/settings/hotel-chains-tab.tsx`
- Modify: `src/components/settings/credit-cards-tab.tsx`
- Modify: `src/components/settings/credit-card-accordion-item.tsx`

**Pattern for all settings tab mutations:**

```tsx
// Before
const res = await fetch("/api/hotel-chains", { method: "POST", ... });
if (!res.ok) {
  setError(await extractApiError(res, "Failed to add hotel chain."));
  return;
}

// After
const result = await apiFetch("/api/hotel-chains", { method: "POST", body: data });
if (!result.ok) {
  logger.error("Failed to add hotel chain", result.error, { status: result.status });
  toast.error("Failed to add hotel chain. Please try again.");
  return;
}
```

The `error` state and `<ErrorBanner>` remain for **GET** errors only. After migration, mutations no longer call `setError` — they call `toast.error()`.

- [ ] **Step 1: Migrate `hotel-chains-tab.tsx` mutations**

Add imports:

```tsx
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
```

Migrate each of: `handleAddHotelChain`, `handleEditHotelChain`, `handleAddSubBrand`, `handleDeleteSubBrand`.
Keep `setError` only for the initial `loadData()` GET.

- [ ] **Step 2: Migrate `credit-cards-tab.tsx` mutations**

Same pattern. Migrate: `handleAdd`, `handleEdit`, `handleDelete`.

- [ ] **Step 3: Migrate `credit-card-accordion-item.tsx` mutations**

Same pattern. Migrate all mutation handlers in this component.

- [ ] **Step 4: Run lint + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/hotel-chains-tab.tsx \
        src/components/settings/credit-cards-tab.tsx \
        src/components/settings/credit-card-accordion-item.tsx
git commit -m "fix: migrate settings mutation errors to apiFetch+toast (batch 1)"
```

---

## Task 12: Migrate Settings Tabs — Batch 2

**Files:**

- Modify: `src/components/settings/my-cards-tab.tsx`
- Modify: `src/components/settings/ota-agencies-tab.tsx`
- Modify: `src/components/settings/user-status-tab.tsx`

Apply the same pattern as Task 11:

- Add `apiFetch`, `logger`, `toast` imports.
- Migrate each mutation handler to `apiFetch` + `logger.error` + `toast.error()`.
- Keep `setError` + `ErrorBanner` only for GET errors.

- [ ] **Step 1: Migrate `my-cards-tab.tsx` mutations** (add, edit, delete user credit cards)

- [ ] **Step 2: Migrate `ota-agencies-tab.tsx` mutations** (add, edit, delete OTA agencies)

- [ ] **Step 3: Migrate `user-status-tab.tsx` mutations** (save/update user statuses)

- [ ] **Step 4: Run lint + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/my-cards-tab.tsx \
        src/components/settings/ota-agencies-tab.tsx \
        src/components/settings/user-status-tab.tsx
git commit -m "fix: migrate settings mutation errors to apiFetch+toast (batch 2)"
```

---

## Task 13: Migrate Settings Tabs — Batch 3

**Files:**

- Modify: `src/components/settings/card-benefits-section.tsx`
- Modify: `src/components/settings/properties-tab.tsx`
- Modify: `src/components/settings/point-types-tab.tsx`
- Modify: `src/components/settings/shopping-portals-tab.tsx`

Same pattern as Tasks 11–12.

- [ ] **Step 1: Migrate `card-benefits-section.tsx` mutations** (add, edit, delete card benefits)

- [ ] **Step 2: Migrate `properties-tab.tsx` mutations** (add, edit, delete properties)

- [ ] **Step 3: Migrate `point-types-tab.tsx` mutations** (add, edit, delete point types)

- [ ] **Step 4: Migrate `shopping-portals-tab.tsx` mutations** (add, edit, delete portals)

- [ ] **Step 5: Run lint + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/card-benefits-section.tsx \
        src/components/settings/properties-tab.tsx \
        src/components/settings/point-types-tab.tsx \
        src/components/settings/shopping-portals-tab.tsx
git commit -m "fix: migrate settings mutation errors to apiFetch+toast (batch 3)"
```

---

## Task 14: Add `context` Param to `[id]` API Routes — Batch 1

**Files (batch 1):**

- Modify: `src/app/api/bookings/[id]/route.ts`
- Modify: `src/app/api/promotions/[id]/route.ts`
- Modify: `src/app/api/booking-promotions/[id]/route.ts`
- Modify: `src/app/api/price-watches/[id]/route.ts`
- Modify: `src/app/api/price-watches/[id]/snapshots/route.ts`

**Pattern:**

```ts
// Before
return apiError("Failed to fetch booking", error, 500, request);

// After
return apiError("Failed to fetch booking", error, 500, request, { bookingId: id });
```

Every `apiError()` call in a route that has an `[id]` segment should pass `{ <resourceType>Id: id }` as the fifth argument. Extract `id` from `params` at the top of each handler.

- [ ] **Step 1: Update `bookings/[id]/route.ts`**

Find every `apiError(...)` call. Add `{ bookingId: id }` as the context.
Example: `apiError("Failed to fetch booking", error, 500, request, { bookingId: id })`

- [ ] **Step 2: Update `promotions/[id]/route.ts`**

Add `{ promotionId: id }` context to all `apiError()` calls.

- [ ] **Step 3: Update `booking-promotions/[id]/route.ts`**

Add `{ bookingPromotionId: id }` context.

- [ ] **Step 4: Update `price-watches/[id]/route.ts`** and **`price-watches/[id]/snapshots/route.ts`**

Add `{ priceWatchId: id }` context.

- [ ] **Step 5: Run lint + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/bookings/[id]/route.ts \
        src/app/api/promotions/[id]/route.ts \
        src/app/api/booking-promotions/[id]/route.ts \
        src/app/api/price-watches/[id]/route.ts \
        src/app/api/price-watches/[id]/snapshots/route.ts
git commit -m "fix: add resource context to apiError calls in [id] routes (batch 1)"
```

---

## Task 15: Add `context` Param to `[id]` API Routes — Batch 2

**Files (batch 2):**

- Modify: `src/app/api/hotel-chains/[id]/route.ts`
- Modify: `src/app/api/hotel-chains/[id]/hotel-chain-sub-brands/route.ts`
- Modify: `src/app/api/hotel-chain-sub-brands/[id]/route.ts`
- Modify: `src/app/api/properties/[id]/route.ts`
- Modify: `src/app/api/credit-cards/[id]/route.ts`
- Modify: `src/app/api/user-credit-cards/[id]/route.ts`
- Modify: `src/app/api/portals/[id]/route.ts`
- Modify: `src/app/api/ota-agencies/[id]/route.ts`
- Modify: `src/app/api/card-benefits/[id]/route.ts`
- Modify: `src/app/api/point-types/[id]/route.ts`

Apply the same pattern: add `{ <resourceType>Id: id }` context to every `apiError()` call.

Resource → context key mapping:
| File | Context key |
|---|---|
| `hotel-chains/[id]` | `hotelChainId` |
| `hotel-chains/[id]/hotel-chain-sub-brands` | `hotelChainId` |
| `hotel-chain-sub-brands/[id]` | `subBrandId` |
| `properties/[id]` | `propertyId` |
| `credit-cards/[id]` | `creditCardId` |
| `user-credit-cards/[id]` | `userCreditCardId` |
| `portals/[id]` | `portalId` |
| `ota-agencies/[id]` | `otaAgencyId` |
| `card-benefits/[id]` | `cardBenefitId` |
| `point-types/[id]` | `pointTypeId` |

- [ ] **Step 1: Update all 10 route files** following the pattern above.

- [ ] **Step 2: Run lint + tests**

```bash
npm run lint && npm run test
```

- [ ] **Step 3: Commit**

```bash
git add \
  src/app/api/hotel-chains/[id]/route.ts \
  src/app/api/hotel-chains/[id]/hotel-chain-sub-brands/route.ts \
  src/app/api/hotel-chain-sub-brands/[id]/route.ts \
  src/app/api/properties/[id]/route.ts \
  src/app/api/credit-cards/[id]/route.ts \
  src/app/api/user-credit-cards/[id]/route.ts \
  src/app/api/portals/[id]/route.ts \
  src/app/api/ota-agencies/[id]/route.ts \
  src/app/api/card-benefits/[id]/route.ts \
  src/app/api/point-types/[id]/route.ts
git commit -m "fix: add resource context to apiError calls in [id] routes (batch 2)"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run full unit test suite**

```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 3: Run E2E tests**

```bash
npm run test:e2e
```

Expected: All existing E2E tests pass. (No new E2E tests required per spec.)

- [ ] **Step 4: Smoke-test the dev server manually**

Start the dev server (`npm run dev`) and verify:

- Dashboard loads and `<ErrorBanner>` appears if `/api/bookings` is broken (simulate by temporarily breaking it)
- Bookings list loads
- Promotions page loads and delete shows a toast on failure
- Price Watch page loads
- Settings page mutations show toasts rather than inline banners on error

- [ ] **Step 5: Final commit if any cleanup needed**

If any stray `extractApiError` imports, unused `Sentry` imports, or unused `error` states remain, clean them up:

```bash
npm run lint && npm run test
git add -A
git commit -m "chore: clean up unused error-handling imports after migration"
```
