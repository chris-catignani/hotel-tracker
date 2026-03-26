# Booking Email Ingestion — Design Spec

**Date:** 2026-03-26
**Issue:** [#257](https://github.com/chris-catignani/hotel-tracker/issues/257)
**Status:** Approved, ready for implementation planning

---

## Context

Booking entry is currently 100% manual — a user fills in the full booking form for every stay. The goal is to eliminate most of that work by automatically creating bookings from hotel confirmation emails, with the user only needing to review and optionally add missing fields (credit card, shopping portal) after the fact.

---

## Approach: Email Forward + Claude API Parsing

When a hotel confirmation email arrives, the user forwards it to `bookings@yourdomain.com` — either manually or via a Gmail auto-forward rule (user preference). Resend Inbound receives the email and delivers it to a webhook. The webhook identifies the chain, parses the email with Claude API using a chain-specific guide, and creates the booking automatically.

---

## End-to-End Flow

```
Hotel sends confirmation email
  → User manually forwards it to bookings@yourdomain.com
  → Resend Inbound receives email
  → POST /api/inbound-email (webhook)
      1. Verify Resend HMAC signature → 401 if invalid
      2. Extract forwarding user email from headers → look up User by email
         → silently discard if no matching user found
      3. Identify hotel chain from sender domain
         → send error email + stop if unrecognized sender
      4. Decode quoted-printable HTML → extract text
      5. Load chain-specific parsing guide
      6. Call Claude API (Haiku) with email text + guide → structured JSON
      7. Validate required fields (checkIn, checkOut, propertyName)
         → send error email + stop if missing
      8. Check for duplicate: existing booking with (userId, confirmationNumber)
         → silently skip if found (idempotent)
      9. Resolve property via findOrCreateProperty() + Google Places
     10. Calculate loyalty points via calculatePoints() using stored elite status
     11. Create booking: ingestionMethod=email, needsReview=true, confirmationNumber set
     12. Run matchPromotionsForBooking()
     13. Send confirmation email to user with link to new booking
```

---

## User Identification

Single inbound address: `bookings@yourdomain.com`

Single inbound address: `bookings@yourdomain.com`

User is identified by matching the `From` header of the forwarded email against registered account emails. When a user forwards an email, Gmail sends it from their own address (e.g. `chris@gmail.com`), which appears in the `From` header.

**Setup requirement:** the email address the user forwards from must match their app login email. For users who sign in via Google OAuth this is automatic. Users who sign in with a different email will need to ensure the addresses match or add their forwarding address in account settings (future enhancement).

If no matching account is found, the email is silently discarded (avoids leaking whether accounts exist).

---

## Chain-Specific Parsing Guides

Guides live in `src/lib/email-ingestion/chain-guides/` as typed objects, keyed by sender domain. Each guide provides:

- Field label names specific to that chain
- Terminology mappings for award booking types

Known mappings to handle:

| Chain    | Email text                                     | Correct interpretation        |
| -------- | ---------------------------------------------- | ----------------------------- |
| Hyatt    | `"STANDARD ROOM FREE NIGHT"`                   | Points redemption, not a cert |
| Hyatt    | `"FREE NIGHT AWARD"`                           | Certificate redemption        |
| Marriott | `"Marriott Bonvoy Certificate Number"` present | Certificate used              |
| Marriott | Points redeemed shown, no cert #               | Points redemption             |
| IHG      | `"Reward Nights"`                              | Points redemption             |

Guides are extended in code as new chains are added — no prompt changes required.

**Unknown chains:** if the sender domain doesn't match a known chain, attempt a generic Claude parse (no chain guide) before rejecting. If Claude can extract the required fields, create the booking. Only reject if required fields are still missing. This allows the system to handle new chains opportunistically before a guide is written for them.

---

## Fields Extracted vs. Calculated vs. Left Blank

| Field                                       | Source                                                   |
| ------------------------------------------- | -------------------------------------------------------- |
| Property name, checkIn, checkOut, numNights | Parsed from email                                        |
| Total cost, pretaxCost, taxAmount, currency | Parsed from email (cash bookings)                        |
| pointsRedeemed                              | Parsed from email (award bookings)                       |
| confirmationNumber                          | Parsed from email                                        |
| hotelChainId                                | Derived from sender domain                               |
| bookingSource                               | Left null — we can't determine web vs. app from email    |
| loyaltyPointsEarned                         | Calculated via `calculatePoints()` + stored elite status |
| lockedExchangeRate                          | Set via existing exchange rate logic                     |
| userCreditCardId                            | **Left blank** — user fills in if desired                |
| shoppingPortalId                            | **Left blank** — not applicable for direct bookings      |
| benefits, certificates                      | **Left blank** — not in confirmation emails              |

---

## Data Model Changes

```prisma
enum IngestionMethod {
  manual
  email
}

// Added to Booking model:
confirmationNumber  String?          // optional; populated by ingestion, enterable via UI
ingestionMethod     IngestionMethod  @default(manual)
needsReview         Boolean          @default(false)
```

**New env var:** `INBOUND_EMAIL_WEBHOOK_SECRET` — Resend HMAC secret for webhook verification.

---

## "Needs Attention" UI

**Definition:** `needsReview = true`
**Cleared:** when the user edits and saves the booking (any PUT to `/api/bookings/[id]` clears it)

**Surfaces in two places:**

1. **Dashboard** — callout card: "X bookings need review" with link to filtered bookings list
2. **/bookings list** — amber badge on affected rows

---

## Booking Form Changes

- Add optional `Confirmation Number` text field (visible for all bookings, not just ingested ones)
- Populated automatically for email-ingested bookings
- Editable by the user for manually entered bookings

---

## Error Handling

| Scenario                                                  | Behavior                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Invalid HMAC signature                                    | 401, no action                                                             |
| Unknown sender domain                                     | Attempt generic Claude parse; reject only if required fields still missing |
| Parse failure / Claude returns unusable data              | Error email: couldn't parse, link to create manually                       |
| Missing required fields (checkIn, checkOut, propertyName) | Error email: couldn't parse, link to create manually                       |
| Property not geo-resolvable                               | Create booking with property name only, `needsReview=true`                 |
| Duplicate (same userId + confirmationNumber)              | Silent skip — idempotent                                                   |

All error emails include a direct link to the manual booking creation form.

---

## Security

- **Webhook auth:** Resend HMAC signature verified on every request
- **User identification:** Forwarding email matched against registered accounts; no user = silent discard
- **No credentials stored:** User's hotel account credentials never touch the app
- **No email OAuth:** User grants no access to their email inbox

---

## Testing

**Unit tests (Vitest):**

- 6 fixture emails (`src/lib/__tests__/fixtures/emails/`) → assert correct parsed output for each (property, dates, cost, points, booking type, confirmation number)
- Chain guide terminology mappings (Hyatt free night = points, not cert; etc.)
- Duplicate detection: same `(userId, confirmationNumber)` → skip; different → create
- `needsReview` cleared on booking PUT

**Integration tests:**

- Mock Resend webhook payload + mock Claude API → assert booking created with correct fields
- Invalid HMAC → assert 401
- Unknown sender domain → assert error email sent, no booking created
- Missing required fields → assert error email sent, no booking created

**No E2E tests** — flow is webhook-driven with no UI entry point; covered by unit + integration.

---

## Follow-up: Self-Improving Rules (tracked in [#324](https://github.com/chris-catignani/hotel-tracker/issues/324))

- Log rejected emails (sender domain, reason, subject) to enable building rules for new chains
- Track field-level edits on email-ingested bookings to identify where parsing guides need improvement
- Eventually: surface edit patterns in an admin view to proactively update chain guides

---

## Key Existing Utilities to Reuse

| Utility                            | File                            | Usage                                 |
| ---------------------------------- | ------------------------------- | ------------------------------------- |
| `findOrCreateProperty()`           | `src/lib/property-utils.ts`     | Resolve property from name + chain    |
| `calculatePoints()`                | `src/lib/loyalty-utils.ts`      | Auto-calculate earned points          |
| `getOrFetchHistoricalRate()`       | `src/lib/exchange-rate.ts`      | Lock exchange rate at check-in        |
| `matchPromotionsForBooking()`      | `src/lib/promotion-matching.ts` | Auto-apply promotions                 |
| `sendPriceDropAlert()` pattern     | `src/lib/email.ts`              | Pattern for confirmation/error emails |
| `POST /api/bookings` service logic | `src/app/api/bookings/route.ts` | Reuse booking creation logic          |
