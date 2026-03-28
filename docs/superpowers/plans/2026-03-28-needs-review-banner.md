# needsReview Banner — Booking Detail Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a dismissible "needs review" banner on the booking detail page for bookings auto-imported from email, and let users clear the flag via a new PATCH endpoint.

**Architecture:** Add a narrow `PATCH /api/bookings/[id]` handler that only accepts `{ needsReview: boolean }`. The detail page reads `needsReview` from the existing booking fetch, conditionally renders an amber banner, and calls PATCH on dismiss then refetches.

**Tech Stack:** Next.js App Router, Prisma, Vitest (unit), Playwright (E2E), Tailwind CSS, shadcn/ui

---

## Files

| File                                      | Change                                              |
| ----------------------------------------- | --------------------------------------------------- |
| `src/app/api/bookings/[id]/route.ts`      | Add `PATCH` export                                  |
| `src/app/api/bookings/[id]/route.test.ts` | New — unit tests for PATCH                          |
| `src/app/bookings/[id]/page.tsx`          | Add `needsReview` to `Booking` type + render banner |
| `e2e/booking-email-ingestion.spec.ts`     | Add E2E test for banner dismiss flow                |

---

## Task 1: Add PATCH handler to `/api/bookings/[id]/route.ts`

**Files:**

- Modify: `src/app/api/bookings/[id]/route.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/app/api/bookings/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/bookings/[id]/route";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/auth";

const mockBookingFindFirst = vi.hoisted(() => vi.fn());
const mockBookingUpdate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      findFirst: mockBookingFindFirst,
      update: mockBookingUpdate,
    },
  },
}));

function makeRequest(body: unknown, id = "booking-1") {
  return new NextRequest(`http://localhost/api/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "booking-1") {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/bookings/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await PATCH(makeRequest({ needsReview: false }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when booking belongs to a different user", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    mockBookingFindFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ needsReview: false }), makeParams());
    expect(res.status).toBe(404);
    expect(mockBookingUpdate).not.toHaveBeenCalled();
  });

  it("sets needsReview: false and returns 200", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    mockBookingFindFirst.mockResolvedValue({ id: "booking-1" });
    mockBookingUpdate.mockResolvedValue({ id: "booking-1", needsReview: false });
    const res = await PATCH(makeRequest({ needsReview: false }), makeParams());
    expect(res.status).toBe(200);
    expect(mockBookingUpdate).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { needsReview: false },
    });
    const body = await res.json();
    expect(body.needsReview).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/bookings/[id]/route.test.ts
```

Expected: FAIL — `PATCH` is not exported from the route.

- [ ] **Step 3: Add the PATCH handler**

In `src/app/api/bookings/[id]/route.ts`, add this export after the existing `PUT` function (before `DELETE`):

```typescript
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { needsReview } = await request.json();

    const exists = await prisma.booking.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) return apiError("Booking not found", null, 404, request, { bookingId: id });

    const booking = await prisma.booking.update({
      where: { id },
      data: { needsReview },
    });

    return NextResponse.json(booking);
  } catch (error) {
    return apiError("Failed to update booking", error, 500, request, { bookingId: id });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/bookings/[id]/route.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bookings/[id]/route.ts src/app/api/bookings/[id]/route.test.ts
git commit -m "feat: add PATCH /api/bookings/[id] to clear needsReview flag"
```

---

## Task 2: Add `needsReview` banner to booking detail page

**Files:**

- Modify: `src/app/bookings/[id]/page.tsx`

- [ ] **Step 1: Add `needsReview` to the `Booking` interface**

In `src/app/bookings/[id]/page.tsx`, find the `Booking` interface (line ~112) and add `needsReview: boolean` after `isFutureEstimate`:

```typescript
interface Booking extends Omit<NetCostBooking, "bookingPromotions" | "userCreditCard"> {
  id: string;
  // ... existing fields ...
  isFutureEstimate?: boolean;
  exchangeRateEstimated?: boolean;
  loyaltyPointsEstimated?: boolean;
  needsReview: boolean;          // ← add this line
  userCreditCardId: string | null;
  // ...
```

- [ ] **Step 2: Add `dismissingReview` state and `dismissReview` handler**

In `BookingDetailPage`, add state and handler alongside the existing `toggleVerified` function:

```typescript
const [dismissingReview, setDismissingReview] = useState(false);

const dismissReview = async () => {
  setDismissingReview(true);
  const result = await apiFetch(`/api/bookings/${id}`, {
    method: "PATCH",
    body: { needsReview: false },
  });
  setDismissingReview(false);
  if (!result.ok) {
    logger.error("Failed to dismiss review flag", result.error, {
      bookingId: id,
      status: result.status,
    });
    toast.error("Failed to update. Please try again.");
    return;
  }
  refetchBooking();
};
```

Add `useState` to the existing React import at the top if it isn't there already — check first. `apiFetch`, `logger`, `toast`, and `refetchBooking` are all already in scope.

- [ ] **Step 3: Render the banner**

In the return JSX, insert the banner between the `<div className="flex items-center justify-between">` header block and the `{/* Booking Info Card */}` comment. The banner is only rendered when `booking.needsReview` is true:

```tsx
{
  booking.needsReview && (
    <div
      className="flex items-center justify-between rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-amber-800"
      data-testid="needs-review-banner"
    >
      <p className="text-sm">
        This booking was auto-imported from email — please verify the details are correct.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="ml-4 shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
        onClick={dismissReview}
        disabled={dismissingReview}
        data-testid="dismiss-review-button"
      >
        {dismissingReview ? "Saving…" : "Mark as reviewed"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/bookings/[id]/page.tsx
git commit -m "feat: show needs-review banner on booking detail page"
```

---

## Task 3: E2E test for banner dismiss flow

**Files:**

- Modify: `e2e/booking-email-ingestion.spec.ts`

- [ ] **Step 1: Add the E2E test**

Append this test inside the existing `test.describe("Email Ingestion — needs-review UI", ...)` block in `e2e/booking-email-ingestion.spec.ts`:

```typescript
test("detail page shows needs-review banner and dismisses it", async ({ isolatedUser }) => {
  const propertyName = `Review Detail Hotel ${crypto.randomUUID()}`;
  const res = await isolatedUser.request.post("/api/bookings", {
    data: {
      propertyName,
      checkIn: `${YEAR}-07-01`,
      checkOut: `${YEAR}-07-04`,
      numNights: 3,
      pretaxCost: 300,
      taxAmount: 30,
      totalCost: 330,
      currency: "USD",
      bookingSource: "direct_web",
      countryCode: "US",
      city: "Salt Lake City",
      needsReview: true,
      ingestionMethod: "email",
    },
  });
  const booking = await res.json();

  try {
    // Banner is visible on the detail page
    await isolatedUser.page.goto(`/bookings/${booking.id}`);
    await isolatedUser.page.waitForLoadState("networkidle");
    await expect(isolatedUser.page.getByTestId("needs-review-banner")).toBeVisible();

    // Dismiss the banner
    await isolatedUser.page.getByTestId("dismiss-review-button").click();
    await expect(isolatedUser.page.getByTestId("needs-review-banner")).not.toBeVisible();

    // Reload — banner stays gone
    await isolatedUser.page.reload();
    await isolatedUser.page.waitForLoadState("networkidle");
    await expect(isolatedUser.page.getByTestId("needs-review-banner")).not.toBeVisible();
  } finally {
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  }
});
```

- [ ] **Step 2: Run the E2E test**

```bash
npx playwright test e2e/booking-email-ingestion.spec.ts --grep "detail page shows needs-review banner"
```

Expected: PASS.

- [ ] **Step 3: Run the full E2E file to make sure nothing regressed**

```bash
npx playwright test e2e/booking-email-ingestion.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/booking-email-ingestion.spec.ts
git commit -m "test: E2E coverage for needs-review banner dismiss on booking detail page"
```
