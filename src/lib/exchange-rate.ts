import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Both URLs use the same fawazahmed0 dataset — the fallback is a mirror, not a different source.
// Historical data is only available from ~March 2024 onward; older dates will 404 on both.
const CDN_BASE = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api";
const FALLBACK_BASE = "https://{date}.currency-api.pages.dev";

/**
 * Fetch rate from fawazahmed0/exchange-api: 1 fromCurrency = X USD.
 * Pass a date string (YYYY-MM-DD) for historical rates, or "latest" for current.
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
    const err = new Error(`Exchange rate API error for ${fromCurrency}: ${res.status}`);
    (err as Error & { url: string }).url = fallbackUrl;
    throw err;
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

/**
 * Get the historical exchange rate for a currency on a specific date (YYYY-MM-DD).
 * Checks ExchangeRateHistory cache first; on miss, fetches from the API and stores
 * the result so subsequent lookups for the same date are instant.
 * For future dates, falls back to the current cached rate.
 * Returns null if the API fetch fails (e.g. dates before ~March 2024 have no data).
 */
export async function getOrFetchHistoricalRate(
  fromCurrency: string,
  date: string
): Promise<number | null> {
  if (fromCurrency === "USD") return 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = new Date(date) < today;

  if (!isPast) {
    // Today or future date — use current cached rate as best estimate.
    // Historical APIs don't have today's data until the day is over.
    return getCurrentRate(fromCurrency);
  }

  // Check historical cache first
  const cached = await prisma.exchangeRateHistory.findUnique({
    where: {
      fromCurrency_toCurrency_date: {
        fromCurrency,
        toCurrency: "USD",
        date: new Date(date),
      },
    },
  });
  if (cached) return Number(cached.rate);

  // Cache miss — fetch from external API and store.
  // Use upsert to handle concurrent requests for the same date (race condition).
  let rate: number;
  try {
    rate = await fetchExchangeRate(fromCurrency, date);
  } catch (err) {
    // The fawazahmed0 API only has data from ~March 2024 onward — older dates will 404.
    // Return null gracefully so callers degrade rather than crash.
    logger.warn("Historical exchange rate fetch failed", {
      fromCurrency,
      date,
      url: (err as Error & { url?: string }).url,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
    return null;
  }
  try {
    await prisma.exchangeRateHistory.upsert({
      where: {
        fromCurrency_toCurrency_date: {
          fromCurrency,
          toCurrency: "USD",
          date: new Date(date),
        },
      },
      update: {},
      create: {
        fromCurrency,
        toCurrency: "USD",
        date: new Date(date),
        rate,
      },
    });
  } catch (upsertErr) {
    // P2002: two concurrent requests raced past the findUnique cache-miss check and
    // both tried to insert the same row. The winner already wrote it — re-fetch.
    if (
      !(upsertErr instanceof Prisma.PrismaClientKnownRequestError && upsertErr.code === "P2002")
    ) {
      throw upsertErr;
    }
    const existing = await prisma.exchangeRateHistory.findUnique({
      where: {
        fromCurrency_toCurrency_date: {
          fromCurrency,
          toCurrency: "USD",
          date: new Date(date),
        },
      },
    });
    if (existing) return Number(existing.rate);
    // Winning request deleted the row before we could re-fetch (pathological).
    // Fall through and return the rate we fetched from the API above.
  }
  return rate;
}
