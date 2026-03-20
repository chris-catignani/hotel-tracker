import { BenefitPeriod } from "@prisma/client";

/** Returns the period key string for a given date and period type.
 *  annual     → "2025"
 *  semi_annual → "2025-H1" | "2025-H2"
 *  quarterly  → "2025-Q1" … "2025-Q4"
 *  monthly    → "2025-01" … "2025-12"
 */
export function getPeriodKey(date: Date, period: BenefitPeriod): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12

  switch (period) {
    case "annual":
      return `${year}`;
    case "semi_annual":
      return month <= 6 ? `${year}-H1` : `${year}-H2`;
    case "quarterly":
      return `${year}-Q${Math.ceil(month / 3)}`;
    case "monthly":
      return `${year}-${String(month).padStart(2, "0")}`;
  }
}
