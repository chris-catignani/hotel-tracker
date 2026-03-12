import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    priceWatch: { findMany: vi.fn(), update: vi.fn() },
    priceSnapshot: { create: vi.fn() },
  },
}));

vi.mock("@/lib/price-fetcher", () => ({ selectFetcher: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendPriceDropAlert: vi.fn() }));
vi.mock("@/lib/exchange-rate", () => ({ getCurrentRate: vi.fn() }));

import prisma from "@/lib/prisma";
import { selectFetcher } from "@/lib/price-fetcher";
import { sendPriceDropAlert } from "@/lib/email";
import { getCurrentRate } from "@/lib/exchange-rate";
import { runPriceWatchRefresh } from "./price-watch-refresh";

function makeWatch({
  currency = "USD",
  cashThreshold = "300",
  awardThreshold = null as number | null,
} = {}) {
  return {
    id: "watch-1",
    property: { id: "prop-1", name: "Test Hotel", chainPropertyId: "chiph" },
    user: { email: "user@test.com" },
    bookings: [
      {
        cashThreshold,
        awardThreshold,
        booking: {
          id: "booking-1",
          checkIn: new Date("2026-06-01"),
          checkOut: new Date("2026-06-03"),
          totalCost: "480",
          currency,
        },
      },
    ],
  };
}

const USD_SCRAPER_RESULT = {
  cashPrice: 250,
  cashCurrency: "USD",
  awardPrice: 20000,
  source: "hyatt_browser",
};

const mockFetcher = { canFetch: vi.fn(() => true), fetchPrice: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.priceWatch.update).mockResolvedValue({} as never);
  vi.mocked(prisma.priceSnapshot.create).mockResolvedValue({} as never);
  vi.mocked(selectFetcher).mockReturnValue(mockFetcher);
  vi.mocked(mockFetcher.fetchPrice).mockResolvedValue(USD_SCRAPER_RESULT);
  vi.mocked(sendPriceDropAlert).mockResolvedValue(undefined);
  vi.mocked(getCurrentRate).mockResolvedValue(null);
});

describe("runPriceWatchRefresh", () => {
  describe("USD booking — no currency conversion needed", () => {
    it("fires alert when scraper price is below the USD threshold", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([makeWatch()] as never);

      const result = await runPriceWatchRefresh([]);

      expect(result.results[0].alerts).toBe(1);
      expect(sendPriceDropAlert).toHaveBeenCalledOnce();
      expect(getCurrentRate).not.toHaveBeenCalled();
    });

    it("does not fire alert when scraper price is above the USD threshold", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ cashThreshold: "200" }), // threshold 200, price 250 → no alert
      ] as never);

      const result = await runPriceWatchRefresh([]);

      expect(result.results[0].alerts).toBe(0);
      expect(sendPriceDropAlert).not.toHaveBeenCalled();
    });
  });

  describe("non-USD booking — currency conversion", () => {
    it("converts USD scraper price to booking currency before comparing", async () => {
      // EUR booking, threshold €230
      // Scraper returns $250 USD; 1 EUR = 1.08 USD → $250 / 1.08 ≈ €231.48 — above threshold → no alert
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ currency: "EUR", cashThreshold: "230" }),
      ] as never);
      vi.mocked(getCurrentRate).mockResolvedValue(1.08);

      const result = await runPriceWatchRefresh([]);

      expect(getCurrentRate).toHaveBeenCalledWith("EUR");
      expect(result.results[0].alerts).toBe(0);
      expect(sendPriceDropAlert).not.toHaveBeenCalled();
    });

    it("fires alert when converted price is below the threshold", async () => {
      // EUR booking, threshold €240
      // Scraper returns $250 USD; 1 EUR = 1.08 USD → $250 / 1.08 ≈ €231.48 — below threshold → alert
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ currency: "EUR", cashThreshold: "240" }),
      ] as never);
      vi.mocked(getCurrentRate).mockResolvedValue(1.08);

      const result = await runPriceWatchRefresh([]);

      expect(getCurrentRate).toHaveBeenCalledWith("EUR");
      expect(result.results[0].alerts).toBe(1);
      expect(sendPriceDropAlert).toHaveBeenCalledOnce();
    });

    it("falls back to raw comparison when exchange rate is unavailable", async () => {
      // EUR booking, threshold €230, rate unavailable → raw $250 > €230 → no alert
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ currency: "EUR", cashThreshold: "230" }),
      ] as never);
      vi.mocked(getCurrentRate).mockResolvedValue(null);

      const result = await runPriceWatchRefresh([]);

      expect(getCurrentRate).toHaveBeenCalledWith("EUR");
      expect(result.results[0].alerts).toBe(0);
    });
  });

  describe("award threshold", () => {
    it("fires alert when award price is below the award threshold", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ cashThreshold: "500", awardThreshold: 25000 }), // cash not met (250 < 500 ✓), award met (20000 < 25000 ✓)
      ] as never);

      const result = await runPriceWatchRefresh([]);

      expect(result.results[0].alerts).toBe(1);
      expect(sendPriceDropAlert).toHaveBeenCalledOnce();
    });

    it("does not fire alert when award price is above the award threshold", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ cashThreshold: null as unknown as string, awardThreshold: 15000 }), // 20000 > 15000 → no alert
      ] as never);

      const result = await runPriceWatchRefresh([]);

      expect(result.results[0].alerts).toBe(0);
      expect(sendPriceDropAlert).not.toHaveBeenCalled();
    });
  });

  describe("no fetcher available", () => {
    it("skips snapshot and alert when no fetcher matches the property", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([makeWatch()] as never);
      vi.mocked(selectFetcher).mockReturnValue(null);

      const result = await runPriceWatchRefresh([]);

      expect(result.results[0].snapshots).toBe(0);
      expect(result.results[0].alerts).toBe(0);
      expect(prisma.priceSnapshot.create).not.toHaveBeenCalled();
      expect(sendPriceDropAlert).not.toHaveBeenCalled();
    });
  });
});
