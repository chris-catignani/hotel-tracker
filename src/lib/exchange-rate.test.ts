import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { fetchExchangeRate, getCurrentRate } from "./exchange-rate";
import prisma from "./prisma";

// Mock the fetch global
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock Prisma
vi.mock("./prisma", () => ({
  default: {
    exchangeRate: {
      findUnique: vi.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  exchangeRate: { findUnique: Mock };
};

describe("fetchExchangeRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 1 immediately for USD without fetching", async () => {
    const rate = await fetchExchangeRate("USD", "latest");
    expect(rate).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches rate from primary CDN URL and returns usd rate", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ eur: { usd: 1.08 } }),
    });

    const rate = await fetchExchangeRate("EUR", "latest");
    expect(rate).toBe(1.08);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("cdn.jsdelivr.net");
    expect(mockFetch.mock.calls[0][0]).toContain("eur.json");
  });

  it("fetches historical rate using date string in URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sgd: { usd: 0.74 } }),
    });

    await fetchExchangeRate("SGD", "2024-06-01");
    expect(mockFetch.mock.calls[0][0]).toContain("2024-06-01");
    expect(mockFetch.mock.calls[0][0]).toContain("sgd.json");
  });

  it("falls back to secondary URL when primary returns non-ok response", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ krw: { usd: 0.00073 } }) });

    const rate = await fetchExchangeRate("KRW", "2024-08-15");
    expect(rate).toBeCloseTo(0.00073);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain("cdn.jsdelivr.net");
    expect(mockFetch.mock.calls[1][0]).toContain("currency-api.pages.dev");
  });

  it("throws when both primary and fallback return non-ok responses", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(fetchExchangeRate("MYR", "2024-10-01")).rejects.toThrow(
      "Exchange rate API error for MYR: 503"
    );
  });

  it("throws when the response has no usd field for the currency", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ eur: { gbp: 0.86 } }), // missing usd
    });

    await expect(fetchExchangeRate("EUR", "latest")).rejects.toThrow(
      "Invalid rate returned for EUR"
    );
  });

  it("throws when usd rate is NaN", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ eur: { usd: NaN } }),
    });

    await expect(fetchExchangeRate("EUR", "latest")).rejects.toThrow(
      "Invalid rate returned for EUR"
    );
  });
});

describe("getCurrentRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 1 for USD without querying the DB", async () => {
    const rate = await getCurrentRate("USD");
    expect(rate).toBe(1);
    expect(prismaMock.exchangeRate.findUnique).not.toHaveBeenCalled();
  });

  it("returns the stored rate when a row exists for the currency", async () => {
    prismaMock.exchangeRate.findUnique.mockResolvedValueOnce({
      fromCurrency: "EUR",
      toCurrency: "USD",
      rate: "1.0850",
    });

    const rate = await getCurrentRate("EUR");
    expect(rate).toBe(1.085);
    expect(prismaMock.exchangeRate.findUnique).toHaveBeenCalledWith({
      where: { fromCurrency_toCurrency: { fromCurrency: "EUR", toCurrency: "USD" } },
    });
  });

  it("returns null when no row exists for the currency", async () => {
    prismaMock.exchangeRate.findUnique.mockResolvedValueOnce(null);

    const rate = await getCurrentRate("SGD");
    expect(rate).toBeNull();
  });
});
