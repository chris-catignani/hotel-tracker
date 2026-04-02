import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { CURRENCIES } from "@/lib/constants";
import { reevaluateBookings } from "@/services/promotion-apply";

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

  const todayStr = new Date().toISOString().split("T")[0];
  const isPast = date < todayStr;

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

const RATES_CDN = `${CDN_BASE}@latest/v1/currencies/usd.json`;
const RATES_FALLBACK = `${FALLBACK_BASE.replace("{date}", "latest")}/v1/currencies/usd.json`;

/**
 * Fetch all supported non-USD exchange rates and upsert them into the ExchangeRate table.
 * Returns a log of results per currency (e.g. "EUR=>1.082345" or "XXX=>NOT_FOUND").
 */
export async function refreshAllExchangeRates(): Promise<string[]> {
  const nonUsdCurrencies = CURRENCIES.filter((c) => c !== "USD");

  let ratesRes = await fetch(RATES_CDN, { cache: "no-store" });
  if (!ratesRes.ok) ratesRes = await fetch(RATES_FALLBACK, { cache: "no-store" });
  if (!ratesRes.ok) throw new Error(`Rates API error: ${ratesRes.status}`);

  const ratesData = (await ratesRes.json()) as { usd: Record<string, number> };
  const rawRates = ratesData.usd; // 1 USD = X foreign

  const settled = await Promise.allSettled(
    nonUsdCurrencies.map(async (currency) => {
      const usdPerForeign = rawRates[currency.toLowerCase()];
      if (typeof usdPerForeign !== "number" || isNaN(usdPerForeign) || usdPerForeign === 0) {
        return `${currency}=>NOT_FOUND`;
      }
      const rate = 1 / usdPerForeign; // 1 foreign = X USD
      await prisma.exchangeRate.upsert({
        where: { fromCurrency_toCurrency: { fromCurrency: currency, toCurrency: "USD" } },
        update: { rate },
        create: { fromCurrency: currency, toCurrency: "USD", rate },
      });
      return `${currency}=>${rate.toFixed(6)}`;
    })
  );
  return settled.map((r, i) =>
    r.status === "fulfilled" ? r.value : `${nonUsdCurrencies[i]}=>ERROR: ${r.reason}`
  );
}

export interface RefreshPointTypeUsdResult {
  pointTypesUpdated: string[];
  bookingsReevaluated: number;
}

/**
 * Refresh the USD value for all foreign-currency PointTypes and reevaluate
 * any future bookings whose promotions depend on those point types.
 */
export async function refreshPointTypeUsdValues(today: Date): Promise<RefreshPointTypeUsdResult> {
  const pointTypesUpdated: string[] = [];
  const pointTypeBookings = new Map<string, string>(); // bookingId → userId

  const foreignPointTypes = await prisma.pointType.findMany({
    where: { programCurrency: { not: null } },
    include: { hotelChains: { select: { id: true } } },
  });

  // Fetch all needed rates in parallel before the loop
  const uniqueCurrencies = [
    ...new Set(foreignPointTypes.map((pt) => pt.programCurrency).filter(Boolean) as string[]),
  ];
  const rateValues = await Promise.all(uniqueCurrencies.map((c) => getCurrentRate(c)));
  const rateMap = new Map(uniqueCurrencies.map((c, i) => [c, rateValues[i]]));

  // Only collect chain IDs for point types that have a valid rate — chains with NO_RATE
  // don't need reevaluation since their USD value didn't change.
  const activeChainIds = new Set<string>();
  for (const pt of foreignPointTypes) {
    if (pt.programCurrency && rateMap.get(pt.programCurrency) != null) {
      for (const hc of pt.hotelChains) activeChainIds.add(hc.id);
    }
  }

  // Run booking query and point type updates concurrently; allSettled ensures a failed
  // point type update doesn't prevent the booking query result from being used.
  const [bookingResult, updateResults] = await Promise.all([
    activeChainIds.size > 0
      ? prisma.booking.findMany({
          where: {
            hotelChainId: { in: [...activeChainIds] },
            bookingPromotions: { some: {} },
            checkIn: { gt: today },
          },
          select: { id: true, userId: true },
        })
      : Promise.resolve([]),
    Promise.allSettled(
      foreignPointTypes.map(async (pt) => {
        if (!pt.programCurrency || pt.programCentsPerPoint == null) return;
        const rate = rateMap.get(pt.programCurrency);
        if (rate == null) {
          pointTypesUpdated.push(`${pt.name}=>NO_RATE`);
          return;
        }
        const newUsd = Number(Number(pt.programCentsPerPoint) * rate).toFixed(6);
        await prisma.pointType.update({
          where: { id: pt.id },
          data: { usdCentsPerPoint: newUsd },
        });
        pointTypesUpdated.push(`${pt.name}=>${newUsd}`);
      })
    ),
  ]);
  const affectedBookings = bookingResult;
  for (const r of updateResults) {
    if (r.status === "rejected") pointTypesUpdated.push(`POINT_TYPE_UPDATE=>ERROR: ${r.reason}`);
  }

  for (const b of affectedBookings) pointTypeBookings.set(b.id, b.userId);

  if (pointTypeBookings.size > 0) {
    const byUser = new Map<string, string[]>();
    for (const [id, userId] of pointTypeBookings) {
      const arr = byUser.get(userId) ?? [];
      arr.push(id);
      byUser.set(userId, arr);
    }
    await Promise.all([...byUser].map(([userId, ids]) => reevaluateBookings(ids, userId)));
  }

  return { pointTypesUpdated, bookingsReevaluated: pointTypeBookings.size };
}
