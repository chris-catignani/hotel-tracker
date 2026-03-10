import prisma from "@/lib/prisma";

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api";
const FALLBACK_BASE = "https://{date}.currency-api.pages.dev";

/**
 * Fetch rate from fawazahmed0/exchange-api: 1 fromCurrency = X USD.
 * Pass a date string (YYYY-MM-DD) for historical rates, or "latest" for current.
 * Historical data available from approximately March 2024 onward.
 */
export async function fetchExchangeRate(
  fromCurrency: string,
  date: string | "latest"
): Promise<number> {
  if (fromCurrency === "USD") return 1;

  const currency = fromCurrency.toLowerCase();
  const dateStr = date === "latest" ? "latest" : date;
  const path = `/v1/currencies/${currency}.json`;

  const primaryUrl = `${CDN_BASE}@${dateStr}${path}`;
  const fallbackUrl = `${FALLBACK_BASE.replace("{date}", dateStr)}${path}`;

  let res = await fetch(primaryUrl, { cache: "no-store" });
  if (!res.ok) {
    res = await fetch(fallbackUrl, { cache: "no-store" });
  }
  if (!res.ok) {
    throw new Error(`Exchange rate API error for ${fromCurrency}: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, Record<string, number>>;
  const rate = data[currency]?.usd;
  if (typeof rate !== "number" || isNaN(rate)) {
    throw new Error(`Invalid rate returned for ${fromCurrency}`);
  }

  return rate;
}

/**
 * Get the current cached exchange rate from the local DB.
 * Returns null if no rate exists yet for the currency.
 */
export async function getCurrentRate(fromCurrency: string): Promise<number | null> {
  if (fromCurrency === "USD") return 1;

  const row = await prisma.exchangeRate.findUnique({
    where: { fromCurrency_toCurrency: { fromCurrency, toCurrency: "USD" } },
  });

  return row ? Number(row.rate) : null;
}

/**
 * Resolve the rate for a hotel chain's calculationCurrency (e.g. EUR for Accor).
 * Checks the DB cache first; falls back to a live API fetch if not cached.
 * Returns null for USD (no conversion needed).
 */
export async function resolveCalcCurrencyRate(currency: string): Promise<number | null> {
  if (currency === "USD") return null;
  const cached = await getCurrentRate(currency);
  if (cached != null) return cached;
  return fetchExchangeRate(currency, "latest");
}
