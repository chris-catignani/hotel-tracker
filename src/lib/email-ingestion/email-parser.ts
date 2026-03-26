import Anthropic from "@anthropic-ai/sdk";
import type { ChainGuide, ParsedBookingData } from "./types";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

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
    const response = await getClient().messages.create({
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
