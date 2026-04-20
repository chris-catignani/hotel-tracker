import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { certTypeLabel, certTypeShortLabel } from "./cert-types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as a currency string.
 * Defaults to USD. Pass a currency code (e.g., "EUR") for other currencies.
 */
export function formatCurrency(
  amount: number,
  currency = "USD",
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

/**
 * Formats a date string into MM/DD/YY format.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  const yearStr = String(year).slice(-2);
  return `${month}/${day}/${yearStr}`;
}

/**
 * Prunes verbose suffixes from Google Places hotel names for compact list display.
 * Only for display — does not modify stored data.
 *
 * Rules applied in order:
 *   1. Chain attribution: "... by IHG / by Hilton / etc."
 *   2. "a/an [Brand] Hotel" soft-brand label: ", a Tribute Portfolio Hotel"
 *   3. "[Brand] Collection [by Chain]" soft-brand label: ", Autograph Collection", ", Curio Collection by Hilton"
 *   4. "[Brand] Portfolio" soft-brand label: ", Tribute Portfolio"
 *   5. "Design Hotels" specific case
 */
export function pruneHotelName(name: string): string {
  return name
    .replace(/\s+by\s+(IHG|Hilton|Marriott|Hyatt|Accor|GHA)$/i, "")
    .replace(/,\s+an?\s+[^,]+\s+Hotel$/i, "")
    .replace(/,\s+[^,]*Collection(?:\s+by\s+\w+)?$/i, "")
    .replace(/,\s+[^,]*Portfolio$/i, "")
    .replace(/,\s+Design\s+Hotels$/i, "")
    .trim();
}

/** Returns the number of nights between two YYYY-MM-DD date strings. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (24 * 60 * 60 * 1000)
  );
}

/**
 * Formats a list of certificates into a human-readable string.
 */
export function formatCerts(certificates: { certType: string }[], short: boolean = false): string {
  if (certificates.length === 0) return "—";
  const counts: Record<string, number> = {};
  for (const cert of certificates) {
    const label = short ? certTypeShortLabel(cert.certType) : certTypeLabel(cert.certType);
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([desc, count]) => (count > 1 ? `${count} × ${desc}` : desc))
    .join(", ");
}
