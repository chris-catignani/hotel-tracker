# Axiom Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Axiom as the single observability platform for structured logging, email ingestion metrics, and cron job health — replacing the custom health dashboard.

**Architecture:** Install `next-axiom` and wire it into `logger.ts` (keeping the existing `info/warn/error` interface unchanged). Create a `withRouteLogging` HOF for automatic request/response logging. Wrap the inbound-email and exchange-rate cron routes. Add a standardized `outcome` field to email ingestion terminal log calls. Rewrite the health page as a static links hub and delete the custom health API and utilities.

**Tech Stack:** next-axiom, Next.js 16 App Router, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-axiom-observability-design.md`

---

## File Map

**Created:**

- `src/lib/route-logging.ts` — `withRouteLogging` HOF
- `src/lib/route-logging.test.ts` — unit tests for the wrapper

**Modified:**

- `next.config.ts` — compose `withAxiom` into the config chain
- `src/lib/logger.ts` — add `next-axiom` log calls alongside existing Sentry + console
- `src/lib/logger.test.ts` — add `next-axiom` mock and assertions
- `src/app/api/inbound-email/route.ts` — wrap with `withAxiom`+`withRouteLogging`, add `outcome` field
- `src/app/api/inbound-email/route.test.ts` — mock `next-axiom`/`route-logging`, assert `outcome` field
- `src/app/api/cron/refresh-exchange-rates/route.ts` — wrap + add stats log
- `src/app/health/page.tsx` — rewrite as static links hub

**Deleted:**

- `src/app/api/health/route.ts`
- `src/lib/health-utils.ts`
- `src/lib/health-utils.test.ts`
- `src/app/health/page.test.tsx`

---

## Task 1: Install next-axiom and configure

**Files:**

- Modify: `package.json` (via npm install)
- Modify: `next.config.ts`

- [ ] **Step 1: Install next-axiom**

```bash
npm install next-axiom
```

Expected: `next-axiom` appears in `package.json` dependencies.

- [ ] **Step 2: Wrap Next.js config with withAxiom**

Replace `next.config.ts` with:

```typescript
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { withAxiom } from "next-axiom";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(withAxiom(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    automaticVercelMonitors: false,
  },
});
```

- [ ] **Step 3: Add env vars to .env.local (do not commit)**

These are required for Axiom to receive logs:

```
AXIOM_TOKEN=<your_axiom_api_token>
NEXT_PUBLIC_AXIOM_DATASET=<your_dataset_name>
NEXT_PUBLIC_AXIOM_URL=https://app.axiom.co/<your-org-slug>
```

Create an Axiom account at https://axiom.co, create a dataset, and generate an API token with ingest + query permissions. Set up a Vercel log drain in Axiom under Settings → Integrations. `NEXT_PUBLIC_AXIOM_URL` is used by the health page to link directly to your Axiom workspace — it is optional (defaults to `https://app.axiom.co`).

- [ ] **Step 4: Commit**

```bash
git add next.config.ts package.json package-lock.json
git commit -m "chore: install and configure next-axiom"
```

---

## Task 2: Update logger.ts to send structured fields to Axiom

**Files:**

- Modify: `src/lib/logger.ts`
- Modify: `src/lib/logger.test.ts`

- [ ] **Step 1: Write failing tests for Axiom integration**

In `src/lib/logger.test.ts`, add a `vi.mock` for `next-axiom` and import the mocked `log` object. Place the mock alongside the existing Sentry mocks at the top of the file, and add new test cases inside the existing `describe("logger")` block.

Full updated `src/lib/logger.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import * as SentryNext from "@sentry/nextjs";
import * as SentryNode from "@sentry/node";
import { log as axiomLog } from "next-axiom";
import { logger } from "./logger";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("next-axiom", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  it("info() should log to console and NOT to Sentry", () => {
    logger.info("test info", { foo: "bar" });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] test info {"foo":"bar"}')
    );
    expect(SentryNext.captureMessage).not.toHaveBeenCalled();
    expect(SentryNode.captureMessage).not.toHaveBeenCalled();
  });

  it("warn() should log to console and Sentry message", () => {
    logger.warn("test warn", { foo: "bar" });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] test warn {"foo":"bar"}')
    );
    const sentry =
      (SentryNext.captureMessage as Mock).mock.calls.length > 0 ? SentryNext : SentryNode;
    expect(sentry.captureMessage).toHaveBeenCalledWith("test warn", {
      level: "warning",
      extra: { foo: "bar" },
    });
  });

  it("error() should log to console and Sentry exception", () => {
    const err = new Error("boom");
    logger.error("test error", err, { foo: "bar" });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] test error {"foo":"bar"}'),
      err
    );
    const sentry =
      (SentryNext.captureException as Mock).mock.calls.length > 0 ? SentryNext : SentryNode;
    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      extra: {
        foo: "bar",
        originalMessage: "test error",
      },
    });
  });

  it("error() should convert string errors to Error objects for Sentry", () => {
    logger.error("test error string", "not an error object");
    const sentry =
      (SentryNext.captureException as Mock).mock.calls.length > 0 ? SentryNext : SentryNode;
    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.anything());
    const captured = (sentry.captureException as Mock).mock.calls[0][0];
    expect(captured.message).toBe("not an error object");
  });

  it("info() should send structured fields to Axiom", () => {
    logger.info("test info", { foo: "bar" });
    expect(axiomLog.info).toHaveBeenCalledWith("test info", { foo: "bar" });
  });

  it("warn() should send structured fields to Axiom", () => {
    logger.warn("test warn", { foo: "bar" });
    expect(axiomLog.warn).toHaveBeenCalledWith("test warn", { foo: "bar" });
  });

  it("error() should send structured fields to Axiom with error details", () => {
    const err = new Error("boom");
    logger.error("test error", err, { foo: "bar" });
    expect(axiomLog.error).toHaveBeenCalledWith("test error", {
      foo: "bar",
      errorMessage: "boom",
      errorStack: expect.any(String),
    });
  });

  it("error() with string error should include errorMessage in Axiom fields", () => {
    logger.error("test error string", "not an error object");
    expect(axiomLog.error).toHaveBeenCalledWith("test error string", {
      errorMessage: "not an error object",
      errorStack: undefined,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/logger.test.ts
```

Expected: FAIL on the four new Axiom test cases.

- [ ] **Step 3: Update logger.ts to call next-axiom**

Replace `src/lib/logger.ts` with:

```typescript
import * as SentryNext from "@sentry/nextjs";
import * as SentryNode from "@sentry/node";
import { log as axiomLog } from "next-axiom";

/**
 * Unified Logger to handle console logging, Sentry reporting, and Axiom structured logging
 * across all environments. Selects the appropriate Sentry SDK (Next.js vs. Node.js).
 */

const IS_SERVER = typeof window === "undefined";
const IS_NEXT = process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge";

// Standalone Node workers (e.g., price watch refresh) use @sentry/node.
// Next.js (server & client) uses @sentry/nextjs.
const Sentry = IS_NEXT || !IS_SERVER ? SentryNext : SentryNode;

function formatMessage(message: string, extra?: Record<string, unknown>): string {
  if (extra && Object.keys(extra).length > 0) {
    return `${message} ${JSON.stringify(extra)}`;
  }
  return message;
}

export const logger = {
  info(message: string, extra?: Record<string, unknown>) {
    console.log(`[INFO] ${formatMessage(message, extra)}`);
    axiomLog.info(message, extra);
  },

  warn(message: string, extra?: Record<string, unknown>) {
    const formatted = formatMessage(message, extra);
    console.warn(`[WARN] ${formatted}`);
    Sentry.captureMessage(message, {
      level: "warning",
      extra,
    });
    axiomLog.warn(message, extra);
  },

  error(message: string, error?: unknown, extra?: Record<string, unknown>) {
    const formatted = formatMessage(message, extra);
    console.error(`[ERROR] ${formatted}`, error);

    const errObj = error instanceof Error ? error : new Error(String(error || message));
    Sentry.captureException(errObj, {
      extra: {
        ...extra,
        originalMessage: message,
      },
    });
    axiomLog.error(message, {
      ...extra,
      errorMessage:
        error instanceof Error ? error.message : error !== undefined ? String(error) : undefined,
      errorStack: error instanceof Error ? error.stack : undefined,
    });
  },
};
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npx vitest run src/lib/logger.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logger.ts src/lib/logger.test.ts
git commit -m "feat: add Axiom structured logging to logger"
```

---

## Task 3: Create withRouteLogging wrapper

**Files:**

- Create: `src/lib/route-logging.ts`
- Create: `src/lib/route-logging.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/route-logging.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { withRouteLogging } from "./route-logging";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

function makeRequest(method = "POST", url = "https://example.com/api/test") {
  return new NextRequest(url, { method });
}

describe("withRouteLogging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs request entry with method and pathname", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRouteLogging("my-route", handler);

    await wrapped(makeRequest("POST", "https://example.com/api/my-route"));

    expect(mockLogger.info).toHaveBeenCalledWith("my-route: request", {
      method: "POST",
      pathname: "/api/my-route",
    });
  });

  it("logs completion with status and durationMs", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }, { status: 200 }));
    const wrapped = withRouteLogging("my-route", handler);

    await wrapped(makeRequest());

    expect(mockLogger.info).toHaveBeenCalledWith(
      "my-route: completed",
      expect.objectContaining({ status: 200, durationMs: expect.any(Number) })
    );
  });

  it("logs error and re-throws on unhandled exception", async () => {
    const err = new Error("handler blew up");
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withRouteLogging("my-route", handler);

    await expect(wrapped(makeRequest())).rejects.toThrow("handler blew up");

    expect(mockLogger.error).toHaveBeenCalledWith(
      "my-route: failed",
      err,
      expect.objectContaining({ durationMs: expect.any(Number) })
    );
  });

  it("calls the original handler with all arguments", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRouteLogging("my-route", handler);
    const req = makeRequest();
    const extra = { params: { id: "123" } };

    await wrapped(req, extra);

    expect(handler).toHaveBeenCalledWith(req, extra);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/route-logging.test.ts
```

Expected: FAIL — `Cannot find module './route-logging'`.

- [ ] **Step 3: Implement withRouteLogging**

Create `src/lib/route-logging.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

type RouteHandler = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>;

export function withRouteLogging(name: string, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ...args: unknown[]) => {
    const start = Date.now();
    logger.info(`${name}: request`, {
      method: req.method,
      pathname: new URL(req.url).pathname,
    });
    try {
      const response = await handler(req, ...args);
      logger.info(`${name}: completed`, {
        status: response.status,
        durationMs: Date.now() - start,
      });
      return response;
    } catch (error) {
      logger.error(`${name}: failed`, error, { durationMs: Date.now() - start });
      throw error;
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npx vitest run src/lib/route-logging.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/route-logging.ts src/lib/route-logging.test.ts
git commit -m "feat: add withRouteLogging wrapper for structured request/response logging"
```

---

## Task 4: Instrument inbound-email route

**Files:**

- Modify: `src/app/api/inbound-email/route.ts`
- Modify: `src/app/api/inbound-email/route.test.ts`

- [ ] **Step 1: Add mocks and write failing outcome tests**

In `src/app/api/inbound-email/route.test.ts`, add mocks for `next-axiom`, `@/lib/route-logging`, and `@/lib/logger` alongside the existing mocks, then add test cases for the `outcome` field.

Full updated `src/app/api/inbound-email/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { POST } from "@/app/api/inbound-email/route";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import { NextRequest } from "next/server";

vi.mock("@/lib/email-ingestion/email-parser", () => ({
  parseConfirmationEmail: vi.fn(),
}));
vi.mock("@/lib/email-ingestion/ingest-booking", () => ({
  ingestBookingFromEmail: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendIngestionConfirmation: vi.fn(),
  sendIngestionError: vi.fn(),
}));

const mockUserFindFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  default: { user: { findFirst: mockUserFindFirst } },
}));

const mockSvixVerify = vi.hoisted(() => vi.fn());
vi.mock("svix", () => ({
  Webhook: class {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verify(...args: any[]) {
      return mockSvixVerify(...args);
    }
  },
}));

// Strip wrappers so POST is the bare handler in tests
vi.mock("next-axiom", () => ({
  withAxiom: (handler: unknown) => handler,
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/route-logging", () => ({
  withRouteLogging: (_name: string, handler: unknown) => handler,
}));

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({
  logger: { info: mockLoggerInfo, warn: mockLoggerWarn, error: mockLoggerError },
}));

process.env.RESEND_WEBHOOK_SIGNING_SECRET = "whsec_test";
process.env.RESEND_INBOUND_EMAIL = "bookings@example.com";
process.env.RESEND_API_KEY = "re_test";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockEmailBody(html: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ html, text: null }),
  });
}

function makePayload(data: Record<string, unknown>, { to = ["bookings@example.com"] } = {}) {
  return { type: "email.received", data: { to, ...data } };
}

function makeRequest(
  data: Record<string, unknown>,
  { validSignature = true, to = ["bookings@example.com"] } = {}
) {
  const payload = makePayload(data, { to });
  if (validSignature) {
    mockSvixVerify.mockReturnValueOnce(payload);
  } else {
    mockSvixVerify.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });
  }
  return new NextRequest("https://example.com/api/inbound-email", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "svix-id": "test-id",
      "svix-timestamp": "123456",
      "svix-signature": "v1,test-sig",
    },
  });
}

describe("POST /api/inbound-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for invalid signature", async () => {
    const req = makeRequest(
      { from: "user@example.com", email_id: "e1" },
      { validSignature: false }
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and discards email addressed to wrong recipient", async () => {
    const req = makeRequest(
      { from: "user@example.com", email_id: "e1" },
      { to: ["other@example.com"] }
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("returns 200 and discards email when user not found, logs outcome: user_not_found", async () => {
    mockSvixVerify.mockReturnValueOnce(
      makePayload({ from: "unknown@example.com", email_id: "e1" })
    );
    mockEmailBody("<html>booking</html>");
    mockUserFindFirst.mockResolvedValueOnce(null);

    const req = makeRequest({ from: "unknown@example.com", email_id: "e1" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inbound-email: discarding email — no matching user",
      expect.objectContaining({ outcome: "user_not_found" })
    );
  });

  it("returns 200 and sends error email when parse fails, logs outcome: parse_failed", async () => {
    mockSvixVerify.mockReturnValueOnce(makePayload({ from: "user@example.com", email_id: "e1" }));
    mockEmailBody("<html>junk</html>");
    mockUserFindFirst.mockResolvedValueOnce({ id: "u1", email: "user@example.com" });
    (parseConfirmationEmail as Mock).mockResolvedValueOnce(null);

    const req = makeRequest({ from: "user@example.com", email_id: "e1" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "inbound-email: parse failed",
      expect.objectContaining({ outcome: "parse_failed" })
    );
  });

  it("logs outcome: duplicate when booking already exists", async () => {
    mockSvixVerify.mockReturnValueOnce(makePayload({ from: "user@example.com", email_id: "e1" }));
    mockEmailBody("<html>booking</html>");
    mockUserFindFirst.mockResolvedValueOnce({ id: "u1", email: "user@example.com" });
    (parseConfirmationEmail as Mock).mockResolvedValueOnce({
      propertyName: "Grand Hyatt",
      checkIn: "2026-04-01",
      checkOut: "2026-04-03",
      confirmationNumber: "ABC123",
    });
    (ingestBookingFromEmail as Mock).mockResolvedValueOnce({ bookingId: "b1", duplicate: true });

    const req = makeRequest({ from: "user@example.com", email_id: "e1" });
    await POST(req);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inbound-email: duplicate booking, skipping",
      expect.objectContaining({ outcome: "duplicate" })
    );
  });

  it("logs outcome: success when booking is created", async () => {
    mockSvixVerify.mockReturnValueOnce(makePayload({ from: "user@example.com", email_id: "e1" }));
    mockEmailBody("<html>booking</html>");
    mockUserFindFirst.mockResolvedValueOnce({ id: "u1", email: "user@example.com" });
    (parseConfirmationEmail as Mock).mockResolvedValueOnce({
      propertyName: "Grand Hyatt",
      checkIn: "2026-04-01",
      checkOut: "2026-04-03",
      confirmationNumber: "ABC123",
    });
    (ingestBookingFromEmail as Mock).mockResolvedValueOnce({ bookingId: "b1", duplicate: false });

    const req = makeRequest({ from: "user@example.com", email_id: "e1" });
    await POST(req);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inbound-email: booking created",
      expect.objectContaining({ outcome: "success" })
    );
  });

  it("returns 500 for transient Resend API errors (allow retry)", async () => {
    mockSvixVerify.mockReturnValueOnce(makePayload({ from: "user@example.com", email_id: "e1" }));
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const req = makeRequest({ from: "user@example.com", email_id: "e1" });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify new outcome tests fail**

```bash
npx vitest run src/app/api/inbound-email/route.test.ts
```

Expected: The new outcome tests FAIL; existing tests may pass or fail depending on mock setup.

- [ ] **Step 3: Update inbound-email route**

Replace `src/app/api/inbound-email/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAxiom } from "next-axiom";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import { sendIngestionConfirmation, sendIngestionError } from "@/lib/email";
import { logger } from "@/lib/logger";
import { withRouteLogging } from "@/lib/route-logging";

/**
 * Resend Inbound email webhook.
 *
 * Resend wraps the email in an envelope:
 * {
 *   type: "email.received",
 *   created_at: string,
 *   data: {
 *     to: string[],      // recipient addresses
 *     from: string,      // forwarding user's email address
 *     subject: string,
 *     html: string,      // full raw email HTML
 *     text: string,
 *   }
 * }
 */
interface ResendInboundPayload {
  type: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject?: string;
  };
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const signingSecret = process.env.RESEND_WEBHOOK_SIGNING_SECRET;
  const inboundEmail = process.env.RESEND_INBOUND_EMAIL;
  if (!signingSecret || !inboundEmail) {
    logger.error(
      "inbound-email: missing RESEND_WEBHOOK_SIGNING_SECRET or RESEND_INBOUND_EMAIL env var"
    );
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const rawBody = await req.text();

  // Verify Resend webhook signature via svix
  const wh = new Webhook(signingSecret);
  let payload: ResendInboundPayload;
  try {
    payload = wh.verify(rawBody, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as ResendInboundPayload;
  } catch (err) {
    logger.warn("inbound-email: svix signature verification failed", { error: err });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = payload;

  // Filter to only process emails addressed to the designated inbound address
  if (!data.to.includes(inboundEmail)) {
    logger.info("inbound-email: discarding email — wrong recipient", { to: data.to });
    return NextResponse.json({ ok: true });
  }

  const forwarderEmail = data.from ?? "";

  logger.info("inbound-email: received", { from: forwarderEmail, subject: data.subject });

  // Fetch full email body from Resend — webhook payload only contains metadata
  const emailRes = await fetch(`https://api.resend.com/emails/receiving/${data.email_id}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  if (!emailRes.ok) {
    logger.error("inbound-email: failed to fetch email body from Resend API", {
      status: emailRes.status,
      emailId: data.email_id,
      outcome: "fetch_failed",
    });
    // 404 may be timing (email not yet available) and 5xx are transient — let Resend retry
    // Other 4xx are permanent failures (e.g. bad API key) — ack to prevent pointless retries
    const isTransient = emailRes.status === 404 || emailRes.status >= 500;
    return NextResponse.json({ ok: true }, { status: isTransient ? 500 : 200 });
  }
  const emailData = (await emailRes.json()) as { html?: string | null; text?: string | null };
  const rawEmail = emailData.html ?? emailData.text ?? "";

  // Identify user
  const user = await prisma.user.findFirst({
    where: { email: forwarderEmail },
  });
  if (!user) {
    logger.info("inbound-email: discarding email — no matching user", {
      from: forwarderEmail,
      outcome: "user_not_found",
    });
    return NextResponse.json({ ok: true });
  }

  // Resend doesn't expose the original sender domain for forwarded emails,
  // so we can't identify the chain — pass null and let Claude parse without chain hints
  const parsed = await parseConfirmationEmail(rawEmail, null);
  logger.info("inbound-email: claude parsed", { parsed });
  if (!parsed) {
    logger.warn("inbound-email: parse failed", { from: forwarderEmail, outcome: "parse_failed" });
    await sendIngestionError({
      to: user.email!,
      reason: "We couldn't recognise the booking details in this email.",
    });
    return NextResponse.json({ ok: true });
  }

  // Create booking
  const { bookingId, duplicate } = await ingestBookingFromEmail(parsed, user.id, null);

  if (duplicate) {
    logger.info("inbound-email: duplicate booking, skipping", {
      bookingId,
      confirmationNumber: parsed.confirmationNumber,
      outcome: "duplicate",
    });
  } else {
    logger.info("inbound-email: booking created", {
      bookingId,
      property: parsed.propertyName,
      checkIn: parsed.checkIn,
      outcome: "success",
    });
    await sendIngestionConfirmation({
      to: user.email!,
      propertyName: parsed.propertyName,
      checkIn: parsed.checkIn,
      checkOut: parsed.checkOut,
      bookingId,
    });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withAxiom(withRouteLogging("inbound-email", handler));
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
npx vitest run src/app/api/inbound-email/route.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/inbound-email/route.ts src/app/api/inbound-email/route.test.ts
git commit -m "feat: wrap inbound-email with Axiom/withRouteLogging, add outcome field to log calls"
```

---

## Task 5: Instrument exchange rate cron

**Files:**

- Modify: `src/app/api/cron/refresh-exchange-rates/route.ts`

- [ ] **Step 1: Update cron route**

Replace `src/app/api/cron/refresh-exchange-rates/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAxiom } from "next-axiom";
import prisma from "@/lib/prisma";
import { getCurrentRate } from "@/lib/exchange-rate";
import { finalizeCheckedInBookings } from "@/lib/booking-enrichment";
import { apiError } from "@/lib/api-error";
import { CURRENCIES } from "@/lib/constants";
import { reevaluateBookings } from "@/lib/promotion-matching";
import { logger } from "@/lib/logger";
import { withRouteLogging } from "@/lib/route-logging";

const RATES_CDN =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const RATES_FALLBACK = "https://latest.currency-api.pages.dev/v1/currencies/usd.json";

async function handler(request: NextRequest) {
  try {
    // Validate cron secret
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    // Step 1: Fetch all current rates in one request and upsert into ExchangeRate table
    const nonUsdCurrencies = CURRENCIES.filter((c) => c !== "USD");
    const upsertResults: string[] = [];

    try {
      let ratesRes = await fetch(RATES_CDN, { cache: "no-store" });
      if (!ratesRes.ok) ratesRes = await fetch(RATES_FALLBACK, { cache: "no-store" });
      if (!ratesRes.ok) throw new Error(`Rates API error: ${ratesRes.status}`);

      const ratesData = (await ratesRes.json()) as { usd: Record<string, number> };
      const rawRates = ratesData.usd; // 1 USD = X foreign

      for (const currency of nonUsdCurrencies) {
        const usdPerForeign = rawRates[currency.toLowerCase()];
        if (typeof usdPerForeign !== "number" || isNaN(usdPerForeign) || usdPerForeign === 0) {
          upsertResults.push(`${currency}=>NOT_FOUND`);
          continue;
        }
        const rate = 1 / usdPerForeign; // 1 foreign = X USD
        await prisma.exchangeRate.upsert({
          where: { fromCurrency_toCurrency: { fromCurrency: currency, toCurrency: "USD" } },
          update: { rate },
          create: { fromCurrency: currency, toCurrency: "USD", rate },
        });
        upsertResults.push(`${currency}=>${rate.toFixed(6)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Cron job failed during batch rate fetch", err, { context: "BATCH_FETCH" });
      upsertResults.push(`BATCH_FETCH=>ERROR: ${message}`);
    }

    // Step 2: Lock in exchange rates for past-due future bookings
    const lockedBookingIds = await finalizeCheckedInBookings();

    // Step 3: Refresh USD value for foreign-currency PointTypes
    const pointTypesUpdated: string[] = [];
    const pointTypeBookingIds = new Set<string>();

    try {
      const foreignPointTypes = await prisma.pointType.findMany({
        where: { programCurrency: { not: null } },
        include: { hotelChains: { select: { id: true } } },
      });

      for (const pt of foreignPointTypes) {
        if (!pt.programCurrency || pt.programCentsPerPoint == null) continue;
        const rate = await getCurrentRate(pt.programCurrency);
        if (rate == null) {
          pointTypesUpdated.push(`${pt.name}=>NO_RATE`);
          continue;
        }
        const newUsd = Number(Number(pt.programCentsPerPoint) * rate).toFixed(6);
        await prisma.pointType.update({
          where: { id: pt.id },
          data: { usdCentsPerPoint: newUsd },
        });
        pointTypesUpdated.push(`${pt.name}=>${newUsd}`);

        // Collect booking IDs that have promotions linked to hotel chains using this point type
        const hotelChainIds = pt.hotelChains.map((hc) => hc.id);
        if (hotelChainIds.length > 0) {
          const affectedBookings = await prisma.booking.findMany({
            where: {
              hotelChainId: { in: hotelChainIds },
              bookingPromotions: { some: {} },
              checkIn: { gt: today },
            },
            select: { id: true },
          });
          for (const b of affectedBookings) pointTypeBookingIds.add(b.id);
        }
      }

      if (pointTypeBookingIds.size > 0) {
        await reevaluateBookings([...pointTypeBookingIds]);
      }
    } catch (err) {
      logger.error("Cron job failed during point type USD refresh", err, {
        context: "REFRESH_POINT_TYPE_USD",
      });
      pointTypesUpdated.push(`POINT_TYPE_REFRESH=>ERROR`);
    }

    logger.info("cron:exchange-rates: stats", {
      currenciesUpdated: upsertResults.filter(
        (r) => !r.includes("ERROR") && !r.includes("NOT_FOUND")
      ).length,
      currenciesNotFound: upsertResults.filter((r) => r.includes("NOT_FOUND")).length,
      bookingsLocked: lockedBookingIds.length,
      pointTypesRefreshed: pointTypesUpdated.filter(
        (r) => !r.includes("ERROR") && !r.includes("NO_RATE")
      ).length,
      bookingsReevaluated: pointTypeBookingIds.size,
    });

    return NextResponse.json({
      success: true,
      ratesUpdated: upsertResults,
      bookingsLocked: lockedBookingIds.length,
      pointTypesRefreshed: pointTypesUpdated,
      bookingsReevaluated: pointTypeBookingIds.size,
      date: todayStr,
    });
  } catch (error) {
    return apiError("Failed to refresh exchange rates", error, 500, request);
  }
}

export const GET = withAxiom(withRouteLogging("cron:exchange-rates", handler));
```

- [ ] **Step 2: Run existing tests to verify they still pass**

```bash
npx vitest run src/app/api/cron/
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/refresh-exchange-rates/route.ts
git commit -m "feat: wrap exchange rate cron with Axiom/withRouteLogging, add stats logging"
```

---

## Task 6: Rewrite health page and delete old files

**Files:**

- Modify: `src/app/health/page.tsx`
- Delete: `src/app/api/health/route.ts`
- Delete: `src/lib/health-utils.ts`
- Delete: `src/lib/health-utils.test.ts`
- Delete: `src/app/health/page.test.tsx`

- [ ] **Step 1: Delete files that are no longer needed**

```bash
git rm src/app/api/health/route.ts src/lib/health-utils.ts src/lib/health-utils.test.ts src/app/health/page.test.tsx
```

- [ ] **Step 2: Rewrite health page as static links hub**

Replace `src/app/health/page.tsx` with:

```typescript
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface ServiceLink {
  title: string;
  description: string;
  href: string | null;
  unconfiguredMessage?: string;
}

function buildSentryUrl(): string | null {
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (!org || !project) return null;
  return `https://sentry.io/organizations/${org}/issues/?project=${project}&query=is%3Aunresolved&statsPeriod=24h`;
}

export default function HealthPage() {
  const links: ServiceLink[] = [
    {
      title: "Axiom",
      description: "Logs, email ingestion stats, and job health dashboards",
      href: process.env.NEXT_PUBLIC_AXIOM_URL ?? "https://app.axiom.co",
    },
    {
      title: "Sentry",
      description: "Errors and warnings (unresolved issues, 24h)",
      href: buildSentryUrl(),
      unconfiguredMessage: "Set SENTRY_ORG + SENTRY_PROJECT to enable",
    },
    {
      title: "GitHub Actions",
      description: "CI status and workflows",
      href: "https://github.com/chris-catignani/hotel-tracker/actions",
    },
    {
      title: "Vercel",
      description: "Deployments and logs",
      href: "https://vercel.com/dashboard",
    },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <h1 className="text-2xl font-bold shrink-0">Health</h1>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">External Services</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {links.map(({ title, description, href, unconfiguredMessage }) =>
              href ? (
                <Link
                  key={title}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                </Link>
              ) : (
                <div
                  key={title}
                  className="flex items-center justify-between rounded-lg border p-4 opacity-50"
                >
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {unconfiguredMessage ?? description}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```bash
npx vitest run
```

Expected: All tests PASS. No references to deleted files.

- [ ] **Step 4: Commit**

```bash
git add src/app/health/page.tsx
git commit -m "feat: replace health dashboard with static links hub, remove custom metrics"
```
