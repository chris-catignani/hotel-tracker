import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { getCurrentRate, getOrFetchHistoricalRate } from "./exchange-rate";
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
    exchangeRateHistory: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Mock logger to avoid Sentry side-effects in tests
vi.mock("./logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const prismaMock = prisma as unknown as {
  exchangeRate: { findUnique: Mock };
  exchangeRateHistory: { findUnique: Mock; upsert: Mock };
};

describe("getOrFetchHistoricalRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 1 for USD without any DB or API calls", async () => {
    const rate = await getOrFetchHistoricalRate("USD", "2025-01-01");
    expect(rate).toBe(1);
    expect(prismaMock.exchangeRateHistory.findUnique).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("uses current cached rate for today's date without calling the historical API", async () => {
    const today = new Date().toISOString().split("T")[0];
    prismaMock.exchangeRate.findUnique.mockResolvedValueOnce({ rate: "0.63" });

    const rate = await getOrFetchHistoricalRate("AUD", today);
    expect(rate).toBe(0.63);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(prismaMock.exchangeRateHistory.findUnique).not.toHaveBeenCalled();
  });

  it("uses current cached rate for future dates without calling the historical API", async () => {
    prismaMock.exchangeRate.findUnique.mockResolvedValueOnce({ rate: "0.63" });

    const rate = await getOrFetchHistoricalRate("AUD", "2099-01-01");
    expect(rate).toBe(0.63);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns cached historical rate without calling the API on cache hit", async () => {
    prismaMock.exchangeRateHistory.findUnique.mockResolvedValueOnce({ rate: "0.65" });

    const rate = await getOrFetchHistoricalRate("AUD", "2025-06-01");
    expect(rate).toBe(0.65);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches from API on cache miss and stores the result", async () => {
    prismaMock.exchangeRateHistory.findUnique.mockResolvedValueOnce(null);
    prismaMock.exchangeRateHistory.upsert.mockResolvedValueOnce({});
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ aud: { usd: 0.64 } }),
    });

    const rate = await getOrFetchHistoricalRate("AUD", "2025-06-01");
    expect(rate).toBe(0.64);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(prismaMock.exchangeRateHistory.upsert).toHaveBeenCalledTimes(1);
  });

  it("falls back to current cached rate when the API fails", async () => {
    prismaMock.exchangeRateHistory.findUnique.mockResolvedValueOnce(null);
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    prismaMock.exchangeRate.findUnique.mockResolvedValueOnce({ rate: "0.63" });

    const rate = await getOrFetchHistoricalRate("AUD", "2025-06-01");
    expect(rate).toBe(0.63);
    expect(prismaMock.exchangeRateHistory.upsert).not.toHaveBeenCalled();
  });

  it("returns null when the API fails and no current rate is cached", async () => {
    prismaMock.exchangeRateHistory.findUnique.mockResolvedValueOnce(null);
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    prismaMock.exchangeRate.findUnique.mockResolvedValueOnce(null);

    const rate = await getOrFetchHistoricalRate("AUD", "2025-06-01");
    expect(rate).toBeNull();
    expect(prismaMock.exchangeRateHistory.upsert).not.toHaveBeenCalled();
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
