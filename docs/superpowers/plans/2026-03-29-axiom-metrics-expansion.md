# Axiom Metrics Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Axiom observability by setting up a Vercel Log Drain, removing the now-redundant `withRouteLogging` wrapper, standardising event names, and adding business-level logging to five key routes.

**Architecture:** The Vercel Log Drain handles HTTP-level metrics (method, path, status, duration) for all routes automatically. Structured business events are logged inline via `logger.info` at the point of each key operation. No middleware or route wrappers needed for new routes.

**Tech Stack:** Next.js 16 App Router, TypeScript, `next-axiom` (`logger` from `@/lib/logger`), Vercel Log Drain → Axiom.

---

## File Map

| File                                               | Change                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| `src/lib/route-logging.ts`                         | **Delete**                                      |
| `src/app/api/cron/refresh-exchange-rates/route.ts` | Remove `withRouteLogging`, rename event         |
| `src/app/api/inbound-email/route.ts`               | Remove `withRouteLogging`, rename/clean events  |
| `src/app/api/bookings/route.ts`                    | Add `booking:created` event to POST             |
| `src/app/api/bookings/[id]/route.ts`               | Add `booking:updated`, `booking:deleted` events |
| `src/app/api/auth/register/route.ts`               | Add `auth:registered` event                     |
| `src/app/api/geo/search/route.ts`                  | Add `geo:searched` event                        |

---

## Task 1: Set up Vercel Log Drain (manual — no code)

- [ ] **Step 1: Enable the Axiom integration in Vercel**

  In the Vercel dashboard: Project → Integrations → find Axiom → Enable Log Drain. Select the same dataset used by `NEXT_PUBLIC_AXIOM_DATASET`.

  This automatically forwards to Axiom:
  - HTTP access logs for every route (method, path, status, duration, region)
  - All stdout/stderr from serverless functions (captures all `logger.*` output)
  - Deploy events (git SHA, branch, environment, build duration)

  No code changes. No commit needed.

---

## Task 2: Clean up cron route — remove wrapper, rename event

**Files:**

- Modify: `src/app/api/cron/refresh-exchange-rates/route.ts`

- [ ] **Step 1: Remove `withRouteLogging` import and rename the stats event**

  Open `src/app/api/cron/refresh-exchange-rates/route.ts`.

  Remove this import line:

  ```typescript
  import { withRouteLogging } from "@/lib/route-logging";
  ```

  Rename the stats event (line 113):

  ```typescript
  // Before:
  logger.info("cron:exchange-rates: stats", {

  // After:
  logger.info("exchange_rates:refreshed", {
  ```

  Update the export (last line of file):

  ```typescript
  // Before:
  export const GET = withAxiom(withRouteLogging("cron:exchange-rates", handler));

  // After:
  export const GET = withAxiom(handler);
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/cron/refresh-exchange-rates/route.ts
  git commit -m "refactor: remove withRouteLogging from cron route, rename event to exchange_rates:refreshed"
  ```

---

## Task 3: Clean up inbound-email route — remove wrapper, rename and sanitise events

**Files:**

- Modify: `src/app/api/inbound-email/route.ts`

- [ ] **Step 1: Remove `withRouteLogging` import**

  Remove this import line:

  ```typescript
  import { withRouteLogging } from "@/lib/route-logging";
  ```

- [ ] **Step 2: Rename and sanitise all log events**

  Apply each change below in order. The line references are approximate — search for the old string.

  **"received" event** — rename, drop PII `from` field:

  ```typescript
  // Before:
  logger.info("inbound-email: received", { from: forwarderEmail, subject: data.subject });

  // After:
  logger.info("inbound-email:received", { subject: data.subject });
  ```

  **"wrong recipient" event** — rename, drop PII `to` field:

  ```typescript
  // Before:
  logger.info("inbound-email: discarding email — wrong recipient", { to: data.to });

  // After:
  logger.info("inbound-email:discarded", { reason: "wrong_recipient" });
  ```

  **"no matching user" event** — rename, drop PII `from` field:

  ```typescript
  // Before:
  logger.info("inbound-email: discarding email — no matching user", {
    from: forwarderEmail,
    outcome: "user_not_found",
  });

  // After:
  logger.info("inbound-email:user_not_found");
  ```

  **"claude parsed" event** — delete entirely (debug-level, not a metric):

  ```typescript
  // Delete this line:
  logger.info("inbound-email: claude parsed", { parsed });
  ```

  **"parse failed" event** — rename, drop PII `from` field, add `userId`:

  ```typescript
  // Before:
  logger.warn("inbound-email: parse failed", { from: forwarderEmail, outcome: "parse_failed" });

  // After:
  logger.warn("inbound-email:parse_failed", { userId: user.id });
  ```

  **"duplicate" event** — rename, drop `outcome` field (name is now the outcome), add `userId`:

  ```typescript
  // Before:
  logger.info("inbound-email: duplicate booking, skipping", {
    bookingId,
    confirmationNumber: parsed.confirmationNumber,
    outcome: "duplicate",
  });

  // After:
  logger.info("inbound-email:duplicate", {
    bookingId,
    confirmationNumber: parsed.confirmationNumber,
    userId: user.id,
  });
  ```

  **"booking created" event** — rename, drop `outcome` field, add `userId`:

  ```typescript
  // Before:
  logger.info("inbound-email: booking created", {
    bookingId,
    property: parsed.propertyName,
    checkIn: parsed.checkIn,
    outcome: "success",
  });

  // After:
  logger.info("inbound-email:booking_created", {
    bookingId,
    property: parsed.propertyName,
    checkIn: parsed.checkIn,
    userId: user.id,
  });
  ```

- [ ] **Step 3: Update the export**

  ```typescript
  // Before:
  export const POST = withAxiom(withRouteLogging("inbound-email", handler));

  // After:
  export const POST = withAxiom(handler);
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/api/inbound-email/route.ts
  git commit -m "refactor: remove withRouteLogging from inbound-email route, standardise event names, remove PII fields"
  ```

---

## Task 4: Delete `route-logging.ts`

**Files:**

- Delete: `src/lib/route-logging.ts`

- [ ] **Step 1: Confirm no remaining usages**

  ```bash
  grep -r "withRouteLogging\|route-logging" src/
  ```

  Expected: no output. If any remain, fix them before deleting.

- [ ] **Step 2: Delete the file**

  ```bash
  rm src/lib/route-logging.ts
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add -A
  git commit -m "refactor: delete route-logging.ts — replaced by Vercel Log Drain"
  ```

---

## Task 5: Add `booking:created` event to POST /api/bookings

**Files:**

- Modify: `src/app/api/bookings/route.ts`

- [ ] **Step 1: Add `logger` import**

  Add to the imports at the top of `src/app/api/bookings/route.ts`:

  ```typescript
  import { logger } from "@/lib/logger";
  ```

- [ ] **Step 2: Log the event after promotion matching**

  In the `POST` handler, find the line:

  ```typescript
  const appliedPromoIds = await matchPromotionsForBooking(booking.id);
  ```

  Immediately after it, add:

  ```typescript
  logger.info("booking:created", {
    userId,
    bookingId: booking.id,
    accommodationType: (accommodationType ?? "hotel") as string,
    checkIn,
    checkOut,
    numNights: Number(numNights),
    totalCost: Number(totalCost),
    currency: resolvedCurrency,
    ingestionMethod: (ingestionMethod ?? "manual") as string,
    promotionsApplied: appliedPromoIds.length,
  });
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/bookings/route.ts
  git commit -m "feat: log booking:created event with business fields"
  ```

---

## Task 6: Add `booking:updated` and `booking:deleted` events to /api/bookings/[id]

**Files:**

- Modify: `src/app/api/bookings/[id]/route.ts`

- [ ] **Step 1: Add `logger` import**

  Add to the imports at the top of `src/app/api/bookings/[id]/route.ts`:

  ```typescript
  import { logger } from "@/lib/logger";
  ```

- [ ] **Step 2: Log `booking:updated` in the PUT handler**

  In the `PUT` handler, find the line:

  ```typescript
  const booking = await prisma.booking.update({
    where: { id },
    data,
  });
  ```

  Immediately after it, add:

  ```typescript
  logger.info("booking:updated", {
    userId,
    bookingId: id,
    fieldsUpdated: Object.keys(data),
  });
  ```

- [ ] **Step 3: Log `booking:deleted` in the DELETE handler**

  In the `DELETE` handler, find the line:

  ```typescript
  await prisma.booking.delete({
    where: { id },
  });
  ```

  Immediately after it, add:

  ```typescript
  logger.info("booking:deleted", {
    userId,
    bookingId: id,
  });
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/api/bookings/[id]/route.ts
  git commit -m "feat: log booking:updated and booking:deleted events"
  ```

---

## Task 7: Add `auth:registered` event to POST /api/auth/register

**Files:**

- Modify: `src/app/api/auth/register/route.ts`

- [ ] **Step 1: Add `logger` import**

  Add to the imports at the top of `src/app/api/auth/register/route.ts`:

  ```typescript
  import { logger } from "@/lib/logger";
  ```

- [ ] **Step 2: Log the duplicate outcome before the early return**

  Find the block:

  ```typescript
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }
  ```

  Update it to:

  ```typescript
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info("auth:registered", { outcome: "duplicate" });
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }
  ```

- [ ] **Step 3: Log the success outcome after the user is created**

  Find the block:

  ```typescript
  const user = await prisma.user.create({
    data: { email, password: hashed, name: name || null },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
  ```

  Update it to:

  ```typescript
  const user = await prisma.user.create({
    data: { email, password: hashed, name: name || null },
    select: { id: true, email: true, name: true, role: true },
  });

  logger.info("auth:registered", { outcome: "success", userId: user.id });
  return NextResponse.json(user, { status: 201 });
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/api/auth/register/route.ts
  git commit -m "feat: log auth:registered event with outcome"
  ```

---

## Task 8: Add `geo:searched` event to GET /api/geo/search

**Files:**

- Modify: `src/app/api/geo/search/route.ts`

- [ ] **Step 1: Add `logger` import**

  Add to the imports at the top of `src/app/api/geo/search/route.ts`:

  ```typescript
  import { logger } from "@/lib/logger";
  ```

- [ ] **Step 2: Add timing and log the event**

  Find the block:

  ```typescript
  const results = await searchProperties(q, isHotel);
  return NextResponse.json(results);
  ```

  Replace it with:

  ```typescript
  const start = Date.now();
  const results = await searchProperties(q, isHotel);
  logger.info("geo:searched", {
    userId,
    accommodationType: accommodationType ?? "hotel",
    resultCount: results.length,
    durationMs: Date.now() - start,
  });
  return NextResponse.json(results);
  ```

  Note: the short-circuit return for `q.trim().length < 3` is intentionally not logged — it fires on every keystroke and has no signal value.

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/geo/search/route.ts
  git commit -m "feat: log geo:searched event with resultCount and durationMs"
  ```
