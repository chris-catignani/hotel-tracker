import Anthropic from "@anthropic-ai/sdk";
import type { ChainGuide, ParsedBookingData } from "./types";
import { logger } from "@/lib/logger";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

function buildPrompt(emailText: string, guide: ChainGuide | null): string {
  const chainSection = guide?.promptNotes
    ? `Chain-specific notes for ${guide.chainName}:\n${guide.promptNotes}\n\n`
    : "";

  return `You are extracting booking details from a hotel confirmation email.

${chainSection}Return ONLY valid JSON with these fields (no explanation, no markdown):
{
  "propertyName": string,        // required — the listing or property name as shown in the email (e.g. "The Top Floor Hallenstein Apartment", "Grand Hyatt New York")
  "propertyAddress": string | null,  // full street address for geocoding (e.g. "135 Hallenstein Street, Queenstown 9300, New Zealand"); required for apartments, null for hotels
  "checkIn": string,             // required — YYYY-MM-DD
  "checkOut": string,            // required — YYYY-MM-DD
  "numNights": number,           // required
  "bookingType": "cash" | "points" | "cert",  // required — use "points" if the stay was paid with loyalty points even if the count is unknown
  "confirmationNumber": string | null,
  "hotelChain": string | null,   // parent chain e.g. "Hyatt", "Marriott", "Hilton", "IHG", "Accor"; NOT the sub-brand name
  "subBrand": string | null,     // specific brand e.g. "Kimpton", "Sofitel", "Grand Hyatt"
  "accommodationType": "hotel" | "apartment",  // "apartment" for Airbnb, short-term rentals, serviced apartments; "hotel" otherwise
  "otaAgencyName": string | null,  // OTA agency if booked through one: "AMEX FHR" (Amex Fine Hotels + Resorts), "AMEX THC" (Amex The Hotel Collection), "Chase The Edit", "Airbnb", "Booking.com"; null for direct hotel bookings
  "currency": string | null,     // 3-letter code e.g. "USD", "SGD"
  "nightlyRates": [{ "amount": number }] | null,  // per-night amounts when no pretax total is shown
  "pretaxCost": number | null,   // pretax total if shown directly; null if returning nightlyRates
  "taxLines": [{ "label": string, "amount": number }] | null,  // individual tax/fee line items — positive amounts only; do NOT include discount/savings lines here (those go in discounts[])
  "discounts": [{ "label": string, "amount": number, "type": "accommodation" | "fee" }] | null,  // discount line items: "accommodation" reduces pretaxCost, "fee" reduces taxLines amounts
  "totalCost": number | null,    // cash bookings only
  "pointsRedeemed": number | null,  // award bookings only, null if count not stated
  "certsRedeemed": [{ "certType": string, "count": number }] | null  // cert/cert+points bookings only; use chain-specific certType values from the guide
}

Rules:
- If the email shows per-night rates but no pretax subtotal: populate "nightlyRates", leave "pretaxCost" null
- Never compute sums yourself — return the raw line items and leave the derived fields null
- If the price breakdown includes any discount line items (special offers, savings, promotions), return pretaxCost: null — do not attempt to compute it; the system will derive it automatically. Still populate nightlyRates with the per-night amounts if they are shown. Always return taxLines if tax/fee lines are explicitly shown, even when discounts are present
- taxLines must contain only positive fee/tax line items with known numeric amounts (e.g. "Taxes", "Service fee", "City tax"). Omit any line where the amount is unknown, not shown, or null — if no amounts are available, return taxLines: null. For points bookings (bookingType = "points"), taxLines must be null. Discount and savings lines belong in discounts[], never in taxLines
- Free-night benefits (e.g. "Stay Plus", "Reward Night", "Free Night Award") must be represented as a 0.00 entry in nightlyRates — do NOT add them to discounts
- Chase The Edit and American Express Travel (AMEX FHR/THC) always charge guests in USD — set currency to "USD" for these regardless of hotel location
- For hotelChain, always use the parent group, not the sub-brand. Less obvious parent chains:
  IHG: Kimpton, Six Senses, Regent, voco, Vignette Collection, InterContinental, Crowne Plaza, Hotel Indigo, HUALUXE, Iberostar, avid, Staybridge Suites, Candlewood Suites
  Accor: Sofitel, Fairmont, Raffles, Swissôtel, Pullman, Novotel, Mercure, ibis, MGallery, Mövenpick, Mondrian, Delano, SLS, Mantra, 25hours, Banyan Tree, Angsana
  GHA Discovery: PARKROYAL, Pan Pacific, Anantara, Kempinski, Corinthia, Capella, Tivoli, NH Hotels, NH Collection, Viceroy, Outrigger, Oaks, Minor

Email:
${emailText.slice(0, 12000)}`;
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
 * Given a rough sub-brand string extracted from an email and a list of known
 * sub-brand names from the DB, ask Claude to pick the best match.
 * Returns the exact DB name, or null if nothing is a reasonable match.
 */
export async function matchSubBrand(
  parsedSubBrand: string,
  candidates: string[]
): Promise<string | null> {
  if (candidates.length === 0) return null;
  const prompt = `You are matching a hotel sub-brand name to a known list.

Parsed from email: "${parsedSubBrand}"
Known sub-brands: ${JSON.stringify(candidates)}

Return ONLY the exact string from the list that best matches, or null if none is a reasonable match. No explanation, no markdown.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 64,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()
      .replace(/^"(.*)"$/, "$1"); // strip surrounding quotes if present
    return candidates.includes(text) ? text : null;
  } catch (e) {
    logger.warn("email-parser: matchSubBrand API call failed", { error: e });
    return null;
  }
}

/**
 * Verify that the parsed totals balance within a small tolerance.
 * Logs a warning if they don't to help catch Claude arithmetic errors.
 */
function verifyBalance(parsed: ParsedBookingData): void {
  if (parsed.totalCost === null || !parsed.taxLines) return;
  const rawTaxTotal = parsed.taxLines.reduce((sum, l) => sum + l.amount, 0);
  const feeDiscounts =
    parsed.discounts?.filter((d) => d.type === "fee").reduce((sum, d) => sum + d.amount, 0) ?? 0;
  const accommodationDiscounts =
    parsed.discounts
      ?.filter((d) => d.type === "accommodation")
      .reduce((sum, d) => sum + d.amount, 0) ?? 0;
  const netTax = rawTaxTotal - feeDiscounts;

  let expectedTotal: number | null = null;
  if (parsed.pretaxCost !== null) {
    expectedTotal = parsed.pretaxCost + netTax;
  } else if (parsed.nightlyRates) {
    const nightlyTotal = parsed.nightlyRates.reduce((sum, r) => sum + r.amount, 0);
    const nightlyBase = nightlyTotal - accommodationDiscounts;
    expectedTotal = nightlyBase + netTax;
    // Some hotels (e.g. Marriott) label taxes as "per night per room" — try scaling by numNights.
    // Tolerance scales with numNights because per-night decimal truncation accumulates per night.
    if (
      Math.abs(expectedTotal - parsed.totalCost) > 0.1 &&
      Math.abs(nightlyBase + netTax * parsed.numNights - parsed.totalCost) <= parsed.numNights
    ) {
      return;
    }
  }

  if (expectedTotal !== null && Math.abs(expectedTotal - parsed.totalCost) > 0.1) {
    logger.warn("email-parser: balance check failed", {
      expectedTotal: expectedTotal.toFixed(2),
      parsedTotal: parsed.totalCost.toFixed(2),
    });
  }
}

function preprocessEmail(text: string): string {
  // Strip boilerplate legal sections that appear as standalone headings
  const boilerplateMarker = /^Terms (?:and|&) [Cc]onditions\s*$/m;
  const markerMatch = boilerplateMarker.exec(text);
  const trimmed = markerMatch ? text.slice(0, markerMatch.index) : text;

  return (
    trimmed
      // Replace long angle-bracket URLs with just the origin
      .replace(/<(https?:\/\/[^/>]+)[^>]{40,}>/g, "<$1/>")
      // Strip [image: ...] alt-text lines
      .replace(/\[image:[^\]]*\]\n?/g, "")
      // Strip lines consisting only of invisible Unicode spacers
      // (U+034F combining grapheme joiner, U+00AD soft hyphen, U+200C ZWNJ, U+200B ZWSP, U+FEFF BOM)
      .replace(/^[\s\u034f\u00ad\u200c\u200b\ufeff]+$/gm, "")
      // Collapse 3+ consecutive blank lines down to 2
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export interface ParseEmailDebug {
  rawResponse?: string;
  error?: string;
}

/**
 * Parse a raw email string into structured booking data using Claude.
 * Returns null if parsing fails or required fields are missing.
 *
 * @param rawEmail - Plain text email content (pre-decoded by Resend)
 * @param guide - Chain-specific parsing guide, or null for a generic parse attempt
 * @param debug - Optional container populated with Claude's raw response or error for diagnostics
 */
export async function parseConfirmationEmail(
  rawEmail: string,
  guide: ChainGuide | null,
  debug?: ParseEmailDebug
): Promise<ParsedBookingData | null> {
  const emailText = preprocessEmail(rawEmail);
  if (emailText.length > 12000) {
    logger.warn("email-parser: email truncated for prompt", { originalLength: emailText.length });
  }
  const prompt = buildPrompt(emailText, guide);

  let responseText: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    if (debug) debug.rawResponse = responseText;
  } catch (e) {
    logger.warn("email-parser: Claude API call failed", { error: e });
    if (debug) debug.error = String(e);
    return null;
  }

  try {
    const cleaned = responseText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);
    if (!isValidParsed(parsed)) {
      logger.warn("email-parser: Claude response failed validation", { parsed });
      return null;
    }
    const result = parsed as ParsedBookingData;
    logger.info("email-parser: Claude parsed result", { result });
    verifyBalance(result);
    return result;
  } catch (e) {
    logger.warn("email-parser: failed to parse Claude response as JSON", {
      error: e,
      responseText,
    });
    return null;
  }
}
