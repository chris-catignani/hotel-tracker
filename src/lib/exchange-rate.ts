import prisma from "@/lib/prisma";

/**
 * Fetch rate from Frankfurter API: 1 fromCurrency = X USD.
 * Pass a date string (YYYY-MM-DD) for historical rates, or "latest" for current.
 */
export async function fetchRateFromFrankfurter(
  fromCurrency: string,
  date: string | "latest"
): Promise<number> {
  if (fromCurrency === "USD") return 1;

  const url =
    date === "latest"
      ? `https://api.frankfurter.app/latest?from=${fromCurrency}&to=USD`
      : `https://api.frankfurter.app/${date}?from=${fromCurrency}&to=USD`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Frankfurter API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { rates: { USD: number } };
  const rate = data.rates?.USD;
  if (typeof rate !== "number" || isNaN(rate)) {
    throw new Error(`Invalid rate returned from Frankfurter for ${fromCurrency}`);
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
