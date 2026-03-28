import Anthropic from "@anthropic-ai/sdk";
import type { ChainGuide, ParsedBookingData } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

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
  "bookingType": "cash" | "points" | "cert",  // required — use "points" if the stay was paid with loyalty points even if the count is unknown
  "confirmationNumber": string | null,
  "hotelChain": string | null,   // parent chain e.g. "Hyatt", "Marriott", "Hilton", "IHG", "Accor"; NOT the sub-brand name
  "subBrand": string | null,     // specific brand e.g. "Kimpton", "Sofitel", "Grand Hyatt"
  "accommodationType": "hotel" | "apartment",  // "apartment" for Airbnb, short-term rentals, serviced apartments; "hotel" otherwise
  "otaAgencyName": string | null,  // OTA agency if booked through one: "AMEX FHR" (Amex Fine Hotels + Resorts), "AMEX THC" (Amex The Hotel Collection), "Chase The Edit", "Airbnb", "Booking.com"; null for direct hotel bookings
  "currency": string | null,     // 3-letter code e.g. "USD", "SGD"
  "nightlyRates": [{ "amount": number }] | null,  // per-night amounts when no pretax total is shown
  "pretaxCost": number | null,   // pretax total if shown directly; null if returning nightlyRates
  "taxAmount": number | null,    // tax total for the entire stay if shown directly; null if nightlyRates is populated
  "totalCost": number | null,    // cash bookings only
  "pointsRedeemed": number | null  // award bookings only, null if count not stated
}

Rules:
- If the email shows per-night rates but no pretax subtotal: populate "nightlyRates", leave "pretaxCost" and "taxAmount" null
- Never compute sums yourself — return the raw line items and leave the derived fields null
- For hotelChain, always use the parent group, not the sub-brand. Less obvious parent chains:
  IHG: Kimpton, Six Senses, Regent, voco, Vignette Collection, InterContinental, Crowne Plaza, Hotel Indigo, HUALUXE, Iberostar, avid, Staybridge Suites, Candlewood Suites
  Accor: Sofitel, Fairmont, Raffles, Swissôtel, Pullman, Novotel, Mercure, ibis, MGallery, Mövenpick, Mondrian, Delano, SLS, Mantra, 25hours, Banyan Tree, Angsana
  GHA Discovery: PARKROYAL, Pan Pacific, Anantara, Kempinski, Corinthia, Capella, Tivoli, NH Hotels, NH Collection, Viceroy, Outrigger, Oaks, Minor

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
  } catch {
    return null;
  }
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
      model: MODEL,
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
