import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { certTypeLabel, certTypeShortLabel } from "./cert-types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as a currency string (USD).
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a date string into MM/DD/YYYY format.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month}/${day}/${year}`;
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
