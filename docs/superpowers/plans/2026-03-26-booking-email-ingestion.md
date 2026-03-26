# Booking Email Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically create bookings when a user forwards a hotel confirmation email to `bookings@yourdomain.com`.

**Architecture:** Resend Inbound delivers forwarded emails to `POST /api/inbound-email`. The webhook identifies the user (via `From` header), identifies the hotel chain (via sender domain), decodes and parses the email with Claude API (Haiku) using a chain-specific terminology guide, then creates the booking using the existing service utilities (`findOrCreateProperty`, `calculatePoints`, `matchPromotionsForBooking`). New `confirmationNumber`, `ingestionMethod`, and `needsReview` fields on `Booking` support idempotency and a "needs attention" UI.

**Tech Stack:** Next.js App Router, Prisma, Anthropic SDK (`claude-haiku-4-5-20251001`), Resend (inbound + outbound), Vitest

**Spec:** `docs/superpowers/specs/2026-03-26-booking-email-ingestion-design.md`

---

## File Map

**New files:**

- `src/lib/email-ingestion/types.ts` — ParsedBookingData, ChainGuide interfaces
- `src/lib/email-ingestion/chain-guides/hyatt.ts` — Hyatt sender domains + terminology
- `src/lib/email-ingestion/chain-guides/marriott.ts` — Marriott sender domains + terminology
- `src/lib/email-ingestion/chain-guides/ihg.ts` — IHG sender domains + terminology
- `src/lib/email-ingestion/chain-guides/index.ts` — Domain → guide registry + lookup
- `src/lib/email-ingestion/email-parser.ts` — QP decode, text extraction, Claude API call
- `src/lib/email-ingestion/ingest-booking.ts` — Orchestrates booking creation from parsed data
- `src/app/api/inbound-email/route.ts` — Webhook handler (auth, user lookup, dispatch)
- `src/lib/__tests__/email-ingestion/email-parser.test.ts`
- `src/lib/__tests__/email-ingestion/ingest-booking.test.ts`
- `src/lib/__tests__/email-ingestion/inbound-email-route.test.ts`

**Modified files:**

- `prisma/schema.prisma` — 3 new Booking fields + `IngestionMethod` enum
- `src/lib/types.ts` — Add `confirmationNumber` to `BookingFormData`; add `needsReview`, `ingestionMethod`, `confirmationNumber` to `Booking`
- `src/app/api/bookings/route.ts` — Accept `confirmationNumber` in POST body
- `src/app/api/bookings/[id]/route.ts` — Accept `confirmationNumber` in PUT body; always clear `needsReview` on PUT
- `src/components/bookings/booking-form.tsx` — Add optional Confirmation Number field
- `src/lib/email.ts` — Add `sendIngestionConfirmation` and `sendIngestionError`
- `src/app/page.tsx` — Add "needs attention" callout card
- `src/app/bookings/page.tsx` — Add amber badge on rows where `needsReview=true`
- `.env.example` — Add `ANTHROPIC_API_KEY`, `INBOUND_EMAIL_WEBHOOK_SECRET`, `RESEND_INBOUND_EMAIL`

---

## Task 1: Schema Migration

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add IngestionMethod enum and 3 fields to the Booking model**

In `prisma/schema.prisma`, add the enum (alongside other enums) and the three new fields to the `Booking` model:

```prisma
enum IngestionMethod {
  manual
  email
}
```

In the `Booking` model, add after the `notes` field:

```prisma
  confirmationNumber    String?
  ingestionMethod       IngestionMethod  @default(manual)
  needsReview           Boolean          @default(false)
```

- [ ] **Step 2: Create and apply the migration**

```bash
npx prisma migrate dev --name add_booking_ingestion_fields
```

Expected output: migration file created + applied, Prisma client regenerated.

- [ ] **Step 3: Restart the dev server** to pick up the new Prisma client.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add confirmationNumber, ingestionMethod, needsReview to Booking"
```

---

## Task 2: Type Updates

**Files:**

- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add `confirmationNumber` to `BookingFormData`**

In `src/lib/types.ts`, add to the `BookingFormData` interface (after `notes`):

```typescript
confirmationNumber: string | null;
```

- [ ] **Step 2: Add ingestion fields to the `Booking` interface**

In `src/lib/types.ts`, add to the `Booking` interface (after `notes`):

```typescript
confirmationNumber: string | null;
ingestionMethod: "manual" | "email";
needsReview: boolean;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ingestion fields to BookingFormData and Booking types"
```

---

## Task 3: Booking Form — Confirmation Number Field

**Files:**

- Modify: `src/components/bookings/booking-form.tsx`
- Modify: `src/app/api/bookings/route.ts`
- Modify: `src/app/api/bookings/[id]/route.ts`

- [ ] **Step 1: Add `confirmationNumber` to form state in `booking-form.tsx`**

Find the `useState` block where form fields are initialised and add:

```typescript
const [confirmationNumber, setConfirmationNumber] = useState<string>(
  booking?.confirmationNumber ?? ""
);
```

- [ ] **Step 2: Add the input field to the form JSX**

Add an optional Confirmation Number field in the Notes section (near the bottom of the form, before or after the Notes textarea):

```tsx
<div className="space-y-2">
  <Label htmlFor="confirmation-number">Confirmation Number</Label>
  <Input
    id="confirmation-number"
    placeholder="Optional"
    value={confirmationNumber}
    onChange={(e) => setConfirmationNumber(e.target.value)}
  />
</div>
```

- [ ] **Step 3: Include `confirmationNumber` in the submit payload**

Find where the form builds the payload object (the object passed to `onSubmit`) and add:

```typescript
confirmationNumber: confirmationNumber.trim() || null,
```

- [ ] **Step 4: Accept `confirmationNumber` in `POST /api/bookings/route.ts`**

In `src/app/api/bookings/route.ts`, destructure `confirmationNumber` from the request body and include it in the `prisma.booking.create()` data:

```typescript
const { ..., confirmationNumber } = await req.json()
// ...in prisma.booking.create({ data: { ..., confirmationNumber: confirmationNumber ?? null } })
```

- [ ] **Step 5: Accept `confirmationNumber` + clear `needsReview` in `PUT /api/bookings/[id]/route.ts`**

In `src/app/api/bookings/[id]/route.ts`, destructure `confirmationNumber` from the request body and always set `needsReview: false` unconditionally in the update data:

```typescript
const { ..., confirmationNumber } = await req.json()
// In the data object:
needsReview: false,
...(confirmationNumber !== undefined && { confirmationNumber: confirmationNumber ?? null }),
```

- [ ] **Step 6: Commit**

```bash
git add src/components/bookings/booking-form.tsx \
        src/app/api/bookings/route.ts \
        src/app/api/bookings/[id]/route.ts
git commit -m "feat: add confirmation number field to booking form and API"
```

---

## Task 4: Install Anthropic SDK + Env Vars

**Files:**

- Modify: `package.json` (via npm install)
- Modify: `.env.example`

- [ ] **Step 1: Install the Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Update `.env.example`**

Add after the Resend section:

```bash
# ── Email Ingestion ────────────────────────────────────────────────────────────
# Claude API key for parsing hotel confirmation emails
ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Shared secret to authenticate Resend inbound email webhooks
# Generate with: openssl rand -base64 32
INBOUND_EMAIL_WEBHOOK_SECRET="your-webhook-secret-here"

# The inbound email address users forward confirmations to (configured in Resend)
RESEND_INBOUND_EMAIL="bookings@yourdomain.com"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: install @anthropic-ai/sdk and add ingestion env vars"
```

---

## Task 5: Email Ingestion Types

**Files:**

- Create: `src/lib/email-ingestion/types.ts`

- [ ] **Step 1: Write the types**

Create `src/lib/email-ingestion/types.ts`:

```typescript
export type BookingType = "cash" | "points" | "cert";

export interface TerminologyMapping {
  /** Text found in the email (case-insensitive substring match) */
  emailText: string;
  bookingType: BookingType;
}

export interface ChainGuide {
  /** Human-readable chain name, matching HotelChain.name in the DB */
  chainName: string;
  /** Sender email domains for this chain */
  senderDomains: string[];
  /** Chain-specific terminology that Claude needs to interpret correctly */
  terminologyMappings: TerminologyMapping[];
  /** Any additional notes to include in the Claude prompt for this chain */
  promptNotes?: string;
}

export interface ParsedBookingData {
  propertyName: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  numNights: number;
  bookingType: BookingType;
  confirmationNumber: string | null;
  // Cash bookings
  currency: string | null;
  pretaxCost: number | null;
  taxAmount: number | null;
  totalCost: number | null;
  // Award bookings
  pointsRedeemed: number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email-ingestion/types.ts
git commit -m "feat: add email ingestion types"
```

---

## Task 6: Chain Guides

**Files:**

- Create: `src/lib/email-ingestion/chain-guides/hyatt.ts`
- Create: `src/lib/email-ingestion/chain-guides/marriott.ts`
- Create: `src/lib/email-ingestion/chain-guides/ihg.ts`
- Create: `src/lib/email-ingestion/chain-guides/index.ts`

- [ ] **Step 1: Create Hyatt guide**

Create `src/lib/email-ingestion/chain-guides/hyatt.ts`:

```typescript
import type { ChainGuide } from "../types";

export const hyattGuide: ChainGuide = {
  chainName: "Hyatt",
  senderDomains: ["reservations.hyatt.com", "hyatt.com"],
  terminologyMappings: [
    {
      emailText: "STANDARD ROOM FREE NIGHT",
      bookingType: "points",
    },
    {
      emailText: "FREE NIGHT AWARD",
      bookingType: "cert",
    },
  ],
  promptNotes:
    'Hyatt points redemptions are labelled "STANDARD ROOM FREE NIGHT" or similar — ' +
    'this means bookingType = "points", NOT "cert". ' +
    'Certificate stays are labelled "FREE NIGHT AWARD". ' +
    "For points bookings the pretaxCost/taxAmount/totalCost should be null. " +
    'Points redeemed may appear in a "Rate information" section.',
};
```

- [ ] **Step 2: Create Marriott guide**

Create `src/lib/email-ingestion/chain-guides/marriott.ts`:

```typescript
import type { ChainGuide } from "../types";

export const marriottGuide: ChainGuide = {
  chainName: "Marriott",
  senderDomains: ["marriott.com", "email.marriott.com", "info.marriott.com"],
  terminologyMappings: [
    {
      emailText: "Marriott Bonvoy Certificate Number",
      bookingType: "cert",
    },
  ],
  promptNotes:
    'If a "Marriott Bonvoy Certificate Number" field is present, bookingType = "cert". ' +
    'If points are redeemed but no certificate number is shown, bookingType = "points". ' +
    'The points redeemed amount appears in a "Summary of Points" or "Total Points Redeemed" section.',
};
```

- [ ] **Step 3: Create IHG guide**

Create `src/lib/email-ingestion/chain-guides/ihg.ts`:

```typescript
import type { ChainGuide } from "../types";

export const ihgGuide: ChainGuide = {
  chainName: "IHG",
  senderDomains: ["ihg.com", "email.ihg.com", "ihghotels.com"],
  terminologyMappings: [
    {
      emailText: "Reward Nights",
      bookingType: "points",
    },
  ],
  promptNotes:
    '"Reward Nights" means bookingType = "points". ' +
    "The points redeemed amount appears near the rate section. " +
    "IHG sometimes shows points earned (not redeemed) — " +
    "only populate pointsRedeemed, not points earned.",
};
```

- [ ] **Step 4: Create the registry**

Create `src/lib/email-ingestion/chain-guides/index.ts`:

```typescript
import { hyattGuide } from "./hyatt";
import { marriottGuide } from "./marriott";
import { ihgGuide } from "./ihg";
import type { ChainGuide } from "../types";

const ALL_GUIDES: ChainGuide[] = [hyattGuide, marriottGuide, ihgGuide];

const DOMAIN_TO_GUIDE = new Map<string, ChainGuide>(
  ALL_GUIDES.flatMap((guide) => guide.senderDomains.map((domain) => [domain, guide]))
);

/**
 * Extract the domain from an email address string.
 * Handles "Name <email@domain.com>" and "email@domain.com" formats.
 */
export function extractDomain(emailAddress: string): string {
  const match = emailAddress.match(/<([^>]+)>/) ?? emailAddress.match(/(\S+)/);
  const address = match ? match[1] : emailAddress;
  return address.split("@")[1]?.toLowerCase() ?? "";
}

/**
 * Returns the ChainGuide for the given sender email domain, or null if unknown.
 */
export function getChainGuide(senderEmail: string): ChainGuide | null {
  const domain = extractDomain(senderEmail);
  return DOMAIN_TO_GUIDE.get(domain) ?? null;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-ingestion/chain-guides/
git commit -m "feat: add chain-specific parsing guides for Hyatt, Marriott, IHG"
```

---

## Task 7: Email Parser

**Files:**

- Create: `src/lib/email-ingestion/email-parser.ts`
- Create: `src/lib/__tests__/email-ingestion/email-parser.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/email-ingestion/email-parser.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { hyattGuide } from "@/lib/email-ingestion/chain-guides/hyatt";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "../../__tests__/fixtures/emails", name), "utf-8");

describe("parseConfirmationEmail", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new (Anthropic as any)();
    mockCreate = client.messages.create;
  });

  it("calls Claude with decoded email text and chain guide notes", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Hyatt Regency Salt Lake City",
            checkIn: "2027-01-14",
            checkOut: "2027-01-18",
            numNights: 4,
            bookingType: "cash",
            confirmationNumber: "64167883",
            currency: "USD",
            pretaxCost: 591.04,
            taxAmount: 98.5,
            totalCost: 689.54,
            pointsRedeemed: null,
          }),
        },
      ],
    });

    const result = await parseConfirmationEmail(fixture("hyatt-confirmation-cash"), hyattGuide);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.model).toBe("claude-haiku-4-5-20251001");
    expect(callArg.messages[0].content).toContain("Hyatt points redemptions are labelled");

    expect(result).toMatchObject({
      propertyName: "Hyatt Regency Salt Lake City",
      checkIn: "2027-01-14",
      checkOut: "2027-01-18",
      numNights: 4,
      bookingType: "cash",
      confirmationNumber: "64167883",
    });
  });

  it("returns null when Claude response is not valid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Sorry, I could not parse this email." }],
    });

    const result = await parseConfirmationEmail(fixture("hyatt-confirmation-cash"), null);
    expect(result).toBeNull();
  });

  it("returns null when required fields are missing from Claude response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({ propertyName: "Some Hotel", bookingType: "cash" }),
        },
      ],
    });

    const result = await parseConfirmationEmail(fixture("marriott-confirmation-cash"), null);
    expect(result).toBeNull();
  });

  it("uses generic prompt when no chain guide is provided", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Some Hotel",
            checkIn: "2026-05-01",
            checkOut: "2026-05-03",
            numNights: 2,
            bookingType: "cash",
            confirmationNumber: null,
            currency: "USD",
            pretaxCost: 200,
            taxAmount: 30,
            totalCost: 230,
            pointsRedeemed: null,
          }),
        },
      ],
    });

    const result = await parseConfirmationEmail("raw email text", null);
    expect(result).not.toBeNull();
    expect(mockCreate.mock.calls[0][0].messages[0].content).not.toContain("Chain-specific notes");
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run src/lib/__tests__/email-ingestion/email-parser.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/email-ingestion/email-parser'`

- [ ] **Step 3: Implement the email parser**

Create `src/lib/email-ingestion/email-parser.ts`:

````typescript
import Anthropic from "@anthropic-ai/sdk";
import type { ChainGuide, ParsedBookingData } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Decode quoted-printable encoding and strip HTML tags to produce readable text.
 */
export function decodeEmailToText(rawEmail: string): string {
  const qpDecoded = rawEmail
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return qpDecoded
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&zwnj;/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildPrompt(emailText: string, guide: ChainGuide | null): string {
  const chainSection = guide?.promptNotes
    ? `Chain-specific notes for ${guide.chainName}:\n${guide.promptNotes}\n\n`
    : "";

  return `You are extracting booking details from a hotel confirmation email.

${chainSection}Return ONLY valid JSON with these fields (no explanation, no markdown):
{
  "propertyName": string,        // required — the hotel/property name
  "checkIn": string,             // required — YYYY-MM-DD
  "checkOut": string,            // required — YYYY-MM-DD
  "numNights": number,           // required
  "bookingType": "cash" | "points" | "cert",  // required
  "confirmationNumber": string | null,
  "currency": string | null,     // 3-letter code e.g. "USD", "SGD"
  "pretaxCost": number | null,   // cash bookings only, before taxes
  "taxAmount": number | null,    // cash bookings only
  "totalCost": number | null,    // cash bookings only
  "pointsRedeemed": number | null  // award bookings only
}

Email:
${emailText.slice(0, 8000)}`;
}

function isValidParsed(data: unknown): data is ParsedBookingData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.propertyName === "string" &&
    typeof d.checkIn === "string" &&
    typeof d.checkOut === "string" &&
    typeof d.numNights === "number" &&
    ["cash", "points", "cert"].includes(d.bookingType as string)
  );
}

/**
 * Parse a raw email string into structured booking data using Claude.
 * Returns null if parsing fails or required fields are missing.
 *
 * @param rawEmail - Full raw email content (headers + body)
 * @param guide - Chain-specific parsing guide, or null for a generic parse attempt
 */
export async function parseConfirmationEmail(
  rawEmail: string,
  guide: ChainGuide | null
): Promise<ParsedBookingData | null> {
  const emailText = decodeEmailToText(rawEmail);
  const prompt = buildPrompt(emailText, guide);

  let responseText: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
  } catch {
    return null;
  }

  try {
    const cleaned = responseText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);
    return isValidParsed(parsed) ? (parsed as ParsedBookingData) : null;
  } catch {
    return null;
  }
}
````

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/email-ingestion/email-parser.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-ingestion/email-parser.ts \
        src/lib/__tests__/email-ingestion/email-parser.test.ts
git commit -m "feat: add email parser with Claude API and chain guide support"
```

---

## Task 8: Ingestion Notification Emails

**Files:**

- Modify: `src/lib/email.ts`

- [ ] **Step 1: Add two new email functions to `src/lib/email.ts`**

```typescript
export async function sendIngestionConfirmation({
  to,
  propertyName,
  checkIn,
  checkOut,
  bookingId,
}: {
  to: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  bookingId: string;
}): Promise<void> {
  if (!resend) return;
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const bookingUrl = `${appUrl}/bookings/${bookingId}`;
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `Booking created: ${propertyName}`,
    html:
      `<p>Your booking at <strong>${escapeHtml(propertyName)}</strong> ` +
      `(${escapeHtml(checkIn)} – ${escapeHtml(checkOut)}) has been added to your tracker.</p>` +
      `<p><a href="${escapeHtml(bookingUrl)}">View &amp; complete the booking →</a></p>` +
      `<p style="color:#92400e;font-size:0.875rem;">This booking was created from a forwarded email. ` +
      `Open it to add your credit card and any missing details.</p>`,
  });
}

export async function sendIngestionError({
  to,
  reason,
}: {
  to: string;
  reason: string;
}): Promise<void> {
  if (!resend) return;
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const newBookingUrl = `${appUrl}/bookings/new`;
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: "Could not parse your hotel confirmation email",
    html:
      `<p>We received your forwarded hotel confirmation email but couldn't create a booking automatically.</p>` +
      `<p>Reason: ${escapeHtml(reason)}</p>` +
      `<p><a href="${escapeHtml(newBookingUrl)}">Create the booking manually →</a></p>`,
  });
}
```

> Note: `escapeHtml` and `resend` are already defined in `src/lib/email.ts` — reuse them.

- [ ] **Step 2: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: add ingestion confirmation and error email functions"
```

---

## Task 9: Ingest Booking Orchestrator

**Files:**

- Create: `src/lib/email-ingestion/ingest-booking.ts`
- Create: `src/lib/__tests__/email-ingestion/ingest-booking.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/email-ingestion/ingest-booking.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import type { ParsedBookingData } from "@/lib/email-ingestion/types";

vi.mock("@/lib/property-utils", () => ({
  findOrCreateProperty: vi.fn().mockResolvedValue("prop-123"),
}));
vi.mock("@/lib/loyalty-utils", () => ({
  calculatePoints: vi.fn().mockReturnValue(1200),
}));
vi.mock("@/lib/exchange-rate", () => ({
  getOrFetchHistoricalRate: vi.fn().mockResolvedValue(1.0),
  getCurrentRate: vi.fn().mockResolvedValue(1.0),
}));
vi.mock("@/lib/promotion-matching", () => ({
  matchPromotionsForBooking: vi.fn().mockResolvedValue([]),
}));

const mockBookingCreate = vi.fn().mockResolvedValue({ id: "booking-abc" });
const mockBookingFindFirst = vi.fn().mockResolvedValue(null);
const mockHotelChainFindFirst = vi.fn().mockResolvedValue({
  id: "chain-hyatt",
  pointTypes: [
    {
      id: "pt-1",
      programCurrency: null,
      programCentsPerPoint: 0.7,
      usdCentsPerPoint: 0.7,
      basePointRate: 5,
      bonusPercentage: 30,
    },
  ],
});
const mockUserEliteStatusFindFirst = vi.fn().mockResolvedValue({
  bonusPercentage: 30,
  fixedRate: null,
  isFixed: false,
  pointsFloorTo: null,
});

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: { create: mockBookingCreate, findFirst: mockBookingFindFirst },
    hotelChain: { findFirst: mockHotelChainFindFirst },
    userEliteStatus: { findFirst: mockUserEliteStatusFindFirst },
  },
}));

const baseParsed: ParsedBookingData = {
  propertyName: "Hyatt Regency Salt Lake City",
  checkIn: "2027-01-14",
  checkOut: "2027-01-18",
  numNights: 4,
  bookingType: "cash",
  confirmationNumber: "64167883",
  currency: "USD",
  pretaxCost: 591.04,
  taxAmount: 98.5,
  totalCost: 689.54,
  pointsRedeemed: null,
};

describe("ingestBookingFromEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingFindFirst.mockResolvedValue(null);
    mockBookingCreate.mockResolvedValue({ id: "booking-abc" });
  });

  it("creates a booking and returns its id", async () => {
    const result = await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    expect(result).toEqual({ bookingId: "booking-abc", duplicate: false });
    expect(mockBookingCreate).toHaveBeenCalledOnce();
    const createArg = mockBookingCreate.mock.calls[0][0].data;
    expect(createArg.ingestionMethod).toBe("email");
    expect(createArg.needsReview).toBe(true);
    expect(createArg.confirmationNumber).toBe("64167883");
  });

  it("returns duplicate=true and skips creation when confirmationNumber already exists", async () => {
    mockBookingFindFirst.mockResolvedValueOnce({ id: "existing-booking" });
    const result = await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    expect(result).toEqual({ bookingId: "existing-booking", duplicate: true });
    expect(mockBookingCreate).not.toHaveBeenCalled();
  });

  it("still creates booking if confirmationNumber is null (no duplicate check possible)", async () => {
    const result = await ingestBookingFromEmail(
      { ...baseParsed, confirmationNumber: null },
      "user-1",
      "Hyatt"
    );
    expect(result.duplicate).toBe(false);
    expect(mockBookingCreate).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run src/lib/__tests__/email-ingestion/ingest-booking.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/email-ingestion/ingest-booking'`

- [ ] **Step 3: Implement the orchestrator**

Create `src/lib/email-ingestion/ingest-booking.ts`:

```typescript
import prisma from "@/lib/prisma";
import { findOrCreateProperty } from "@/lib/property-utils";
import { calculatePoints } from "@/lib/loyalty-utils";
import { getOrFetchHistoricalRate, getCurrentRate } from "@/lib/exchange-rate";
import { matchPromotionsForBooking } from "@/lib/promotion-matching";
import type { ParsedBookingData } from "./types";

export interface IngestResult {
  bookingId: string;
  duplicate: boolean;
}

/**
 * Create a Booking from parsed email data.
 * Returns { bookingId, duplicate: true } if a booking with the same
 * (userId, confirmationNumber) already exists — no new record is created.
 */
export async function ingestBookingFromEmail(
  parsed: ParsedBookingData,
  userId: string,
  chainName: string | null
): Promise<IngestResult> {
  // Duplicate check
  if (parsed.confirmationNumber) {
    const existing = await prisma.booking.findFirst({
      where: { userId, confirmationNumber: parsed.confirmationNumber },
    });
    if (existing) return { bookingId: existing.id, duplicate: true };
  }

  // Resolve hotel chain
  const hotelChain = chainName
    ? await prisma.hotelChain.findFirst({
        where: { name: { contains: chainName, mode: "insensitive" } },
        include: { pointTypes: true },
      })
    : null;

  // Resolve property
  const propertyId = await findOrCreateProperty({
    propertyName: parsed.propertyName,
    hotelChainId: hotelChain?.id ?? null,
  });

  // Lock exchange rate
  const currency = parsed.currency ?? "USD";
  const today = new Date().toISOString().split("T")[0];
  const isPastCheckIn = parsed.checkIn <= today;
  let lockedExchangeRate: number | null = null;
  if (currency === "USD") {
    lockedExchangeRate = 1;
  } else if (isPastCheckIn) {
    lockedExchangeRate = await getOrFetchHistoricalRate(currency, parsed.checkIn);
  }
  // Future non-USD stays: lockedExchangeRate remains null

  // Calculate loyalty points
  let loyaltyPointsEarned: number | null = null;
  if (hotelChain && parsed.bookingType === "cash" && parsed.pretaxCost !== null) {
    const pointType = hotelChain.pointTypes[0];
    if (pointType) {
      const eliteStatus = await prisma.userEliteStatus.findFirst({
        where: { userId, hotelChainId: hotelChain.id },
      });
      const calcCurrency = pointType.programCurrency ?? "USD";
      const calcCurrencyToUsdRate = calcCurrency === "USD" ? 1 : await getCurrentRate(calcCurrency);
      loyaltyPointsEarned = calculatePoints({
        pretaxCost: parsed.pretaxCost,
        basePointRate: Number(pointType.basePointRate ?? 0),
        calculationCurrency: calcCurrency,
        calcCurrencyToUsdRate,
        eliteStatus: eliteStatus
          ? {
              bonusPercentage: eliteStatus.bonusPercentage ?? undefined,
              fixedRate: eliteStatus.fixedRate ?? undefined,
              isFixed: eliteStatus.isFixed,
              pointsFloorTo: eliteStatus.pointsFloorTo ?? undefined,
            }
          : null,
      });
    }
  }

  const booking = await prisma.booking.create({
    data: {
      userId,
      hotelChainId: hotelChain?.id ?? null,
      accommodationType: "hotel",
      propertyId,
      checkIn: new Date(parsed.checkIn),
      checkOut: new Date(parsed.checkOut),
      numNights: parsed.numNights,
      pretaxCost: parsed.pretaxCost ?? 0,
      taxAmount: parsed.taxAmount ?? 0,
      totalCost: parsed.totalCost ?? 0,
      currency,
      lockedExchangeRate,
      pointsRedeemed: parsed.pointsRedeemed ?? null,
      loyaltyPointsEarned,
      confirmationNumber: parsed.confirmationNumber ?? null,
      ingestionMethod: "email",
      needsReview: true,
      paymentTiming: "postpaid",
    },
  });

  await matchPromotionsForBooking(booking.id);

  return { bookingId: booking.id, duplicate: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/email-ingestion/ingest-booking.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-ingestion/ingest-booking.ts \
        src/lib/__tests__/email-ingestion/ingest-booking.test.ts
git commit -m "feat: add ingest-booking orchestrator with duplicate detection"
```

---

## Task 10: Inbound Email Webhook

**Files:**

- Create: `src/app/api/inbound-email/route.ts`
- Create: `src/lib/__tests__/email-ingestion/inbound-email-route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/email-ingestion/inbound-email-route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/inbound-email/route";
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

const mockUserFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: { user: { findFirst: mockUserFindFirst } },
}));

const SECRET = "test-secret";
process.env.INBOUND_EMAIL_WEBHOOK_SECRET = SECRET;

function makeRequest(body: object, secret = SECRET) {
  return new NextRequest("http://localhost/api/inbound-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": secret,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/inbound-email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for invalid webhook secret", async () => {
    const res = await POST(makeRequest({}, "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 200 and discards if user not found", async () => {
    mockUserFindFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ from: "unknown@gmail.com", html: "" }));
    expect(res.status).toBe(200);
    const { sendIngestionError } = await import("@/lib/email");
    expect(sendIngestionError).not.toHaveBeenCalled();
  });

  it("sends error email if parsing returns null", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "u1", email: "chris@gmail.com" });
    const { parseConfirmationEmail } = await import("@/lib/email-ingestion/email-parser");
    vi.mocked(parseConfirmationEmail).mockResolvedValue(null);
    const { sendIngestionError } = await import("@/lib/email");

    // sender domain matches Hyatt guide — guide will be found, parse still fails
    const res = await POST(
      makeRequest({
        from: "chris@gmail.com",
        sender: "noreply@reservations.hyatt.com",
        html: "<p>email</p>",
      })
    );
    expect(res.status).toBe(200);
    expect(sendIngestionError).toHaveBeenCalledWith(
      expect.objectContaining({ to: "chris@gmail.com", reason: expect.stringContaining("Hyatt") })
    );
  });

  it("creates booking and sends confirmation on success", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "u1", email: "chris@gmail.com" });
    const { parseConfirmationEmail } = await import("@/lib/email-ingestion/email-parser");
    vi.mocked(parseConfirmationEmail).mockResolvedValue({
      propertyName: "Hyatt Regency SLC",
      checkIn: "2027-01-14",
      checkOut: "2027-01-18",
      numNights: 4,
      bookingType: "cash",
      confirmationNumber: "12345",
      currency: "USD",
      pretaxCost: 500,
      taxAmount: 80,
      totalCost: 580,
      pointsRedeemed: null,
    });
    const { ingestBookingFromEmail } = await import("@/lib/email-ingestion/ingest-booking");
    vi.mocked(ingestBookingFromEmail).mockResolvedValue({ bookingId: "bk-1", duplicate: false });
    const { sendIngestionConfirmation } = await import("@/lib/email");

    const res = await POST(
      makeRequest({
        from: "chris@gmail.com",
        sender: "noreply@reservations.hyatt.com",
        html: "<p>email</p>",
      })
    );
    expect(res.status).toBe(200);
    expect(sendIngestionConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: "chris@gmail.com", bookingId: "bk-1" })
    );
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run src/lib/__tests__/email-ingestion/inbound-email-route.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/inbound-email/route'`

- [ ] **Step 3: Implement the webhook handler**

Create `src/app/api/inbound-email/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getChainGuide, extractDomain } from "@/lib/email-ingestion/chain-guides";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import { sendIngestionConfirmation, sendIngestionError } from "@/lib/email";

/**
 * Resend Inbound email webhook.
 *
 * Configure the webhook URL in Resend as:
 *   https://yourdomain.com/api/inbound-email
 * and set the custom header x-webhook-secret to INBOUND_EMAIL_WEBHOOK_SECRET.
 *
 * Expected payload from Resend Inbound:
 * {
 *   from: string,      // forwarding user's email address
 *   sender: string,    // original sender (the hotel)
 *   subject: string,
 *   html: string,      // full raw email HTML (may include headers)
 *   text: string,
 * }
 *
 * Note: verify the exact payload shape in Resend's inbound documentation
 * and adjust field names here if needed.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth check
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.INBOUND_EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const forwarderEmail = body.from ?? "";
  const senderEmail = body.sender ?? body.from ?? "";
  const rawEmail = body.html ?? body.text ?? "";

  // Identify user
  const user = await prisma.user.findFirst({
    where: { email: forwarderEmail },
  });
  if (!user) {
    // Silently discard — do not leak account existence
    return NextResponse.json({ ok: true });
  }

  // Identify chain
  const guide = getChainGuide(senderEmail);

  // Parse email (guide may be null for unknown chains — generic parse attempted)
  const parsed = await parseConfirmationEmail(rawEmail, guide);
  if (!parsed) {
    await sendIngestionError({
      to: user.email!,
      reason: guide
        ? `We couldn't extract the required fields from your ${guide.chainName} confirmation.`
        : "We couldn't recognise the booking details in this email.",
    });
    return NextResponse.json({ ok: true });
  }

  // Create booking
  const { bookingId, duplicate } = await ingestBookingFromEmail(
    parsed,
    user.id,
    guide?.chainName ?? null
  );

  if (!duplicate) {
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/email-ingestion/inbound-email-route.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/inbound-email/route.ts \
        src/lib/__tests__/email-ingestion/inbound-email-route.test.ts
git commit -m "feat: add inbound email webhook endpoint"
```

---

## Task 11: "Needs Attention" — Bookings List Badge

**Files:**

- Modify: `src/app/bookings/page.tsx`

- [ ] **Step 1: Ensure the API returns `needsReview`**

Check `GET /api/bookings/route.ts` — the query that fetches bookings should already include `needsReview` since it's a new Prisma field and most queries use `select: *` or omit select. Verify by checking the select clause; if it uses an explicit select, add `needsReview: true`.

- [ ] **Step 2: Add amber badge to booking rows in `src/app/bookings/page.tsx`**

Find the `<TableCell>` rendering the property name (around line 283). Add the badge after the property name/sub-brand block:

```tsx
{
  booking.needsReview && (
    <Badge
      variant="outline"
      className="border-amber-400 bg-amber-50 text-amber-700 text-xs shrink-0"
    >
      Review
    </Badge>
  );
}
```

Ensure `Badge` is imported from `@/components/ui/badge`.

- [ ] **Step 3: Commit**

```bash
git add src/app/bookings/page.tsx
git commit -m "feat: add amber Review badge on bookings needing attention"
```

---

## Task 12: "Needs Attention" — Dashboard Callout

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Fetch `needsReview` count on the dashboard**

In `src/app/page.tsx`, find where booking data is fetched (the API call or server-side data loading). Add a count of bookings where `needsReview = true`. If the dashboard already loads bookings, derive the count client-side:

```typescript
const needsReviewCount = bookings.filter((b) => b.needsReview).length;
```

If bookings are not already loaded on the dashboard, add a targeted API call or a new server-side fetch:

```typescript
// In the data-fetching section:
const needsReviewCount = await prisma.booking.count({
  where: { userId, needsReview: true },
});
```

- [ ] **Step 2: Add the callout card JSX after the ErrorBanner (around line 444 in `src/app/page.tsx`)**

```tsx
{
  needsReviewCount > 0 && (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-amber-600 font-medium text-sm">
          {needsReviewCount} booking{needsReviewCount !== 1 ? "s" : ""} need
          {needsReviewCount === 1 ? "s" : ""} review
        </span>
        <span className="text-amber-500 text-sm">
          — created from forwarded emails. Add your credit card and other details.
        </span>
      </div>
      <a
        href="/bookings?filter=needs-review"
        className="text-amber-700 text-sm font-medium underline underline-offset-2"
      >
        View →
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Add `?filter=needs-review` support to `/bookings` page (optional)**

In `src/app/bookings/page.tsx`, read the `filter` query param and if it equals `needs-review`, pre-filter the bookings list to show only `needsReview=true` rows. This is a simple `useSearchParams` or server-side param read.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/bookings/page.tsx
git commit -m "feat: add needs-attention callout on dashboard and bookings filter"
```

---

## Verification

After all tasks complete, verify end-to-end manually:

1. **Schema:** `npx prisma studio` — open a Booking record and confirm `confirmationNumber`, `ingestionMethod`, `needsReview` columns exist.

2. **Booking form:** Create a booking manually, enter a confirmation number, save — confirm it appears when you reopen the booking.

3. **Webhook (local):** Use [ngrok](https://ngrok.com) or similar to expose localhost, configure Resend Inbound to POST to your tunnel, then forward a real Hyatt/Marriott/IHG confirmation email and confirm the booking appears in the tracker with `needsReview=true`.

4. **"Needs attention" UI:** The forwarded booking should show the amber Review badge in `/bookings` and the callout on the dashboard.

5. **Clear on edit:** Edit the ingested booking, save — confirm `needsReview` clears and the badge disappears.

6. **Full test suite:**

```bash
npx vitest run
npx playwright test
```

All tests should pass.
