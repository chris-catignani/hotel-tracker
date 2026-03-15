import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    priceWatch: { findMany: vi.fn(), update: vi.fn() },
    priceSnapshot: { create: vi.fn() },
  },
}));

// Partial mock: keep real lowestRefundableCash / lowestAward, only mock selectFetcher
vi.mock("@/lib/price-fetcher", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/price-fetcher")>();
  return { ...actual, selectFetcher: vi.fn() };
});

vi.mock("@/lib/email", () => ({ sendPriceDropAlert: vi.fn() }));
vi.mock("@/lib/exchange-rate", () => ({ getCurrentRate: vi.fn() }));

import prisma from "@/lib/prisma";
import { selectFetcher } from "@/lib/price-fetcher";
import { sendPriceDropAlert } from "@/lib/email";
import { getCurrentRate } from "@/lib/exchange-rate";
import { runPriceWatchRefresh, fixedRateAwardPoints } from "./price-watch-refresh";
import { HOTEL_ID } from "@/lib/constants";

function makeWatch({
  currency = "USD",
  cashThreshold = "300",
  awardThreshold = null as number | null,
  hotelChainId = null as string | null,
} = {}) {
  return {
    id: "watch-1",
    property: { id: "prop-1", name: "Test Hotel", chainPropertyId: "chiph", hotelChainId },
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

// Scraper result using the new PriceFetchResult shape
const USD_SCRAPER_RESULT = {
  source: "hyatt_browser",
  rates: [
    {
      roomId: "room-1",
      roomName: "Standard Room",
      ratePlanCode: "STANDARD",
      ratePlanName: "Standard Rate",
      cashPrice: 250,
      cashCurrency: "USD",
      awardPrice: 20000,
      isRefundable: "REFUNDABLE",
      isCorporate: false,
    },
  ],
};

const mockFetcher = { canFetch: vi.fn(() => true), fetchPrice: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.priceWatch.update).mockResolvedValue({} as never);
  vi.mocked(prisma.priceSnapshot.create).mockResolvedValue({ id: "snap-1" } as never);
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
    it("converts USD scraper price to EUR booking currency before comparing", async () => {
      // EUR booking, threshold €230
      // Scraper returns $250 USD (1 USD = 1 USD, 1 EUR = 1.08 USD) → €250/1.08 ≈ €231.48 — above threshold → no alert
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ currency: "EUR", cashThreshold: "230" }),
      ] as never);
      vi.mocked(getCurrentRate).mockImplementation(async (currency) =>
        currency === "USD" ? 1 : currency === "EUR" ? 1.08 : null
      );

      const result = await runPriceWatchRefresh([]);

      expect(getCurrentRate).toHaveBeenCalledWith("USD");
      expect(getCurrentRate).toHaveBeenCalledWith("EUR");
      expect(result.results[0].alerts).toBe(0);
      expect(sendPriceDropAlert).not.toHaveBeenCalled();
    });

    it("fires alert when converted price is below the threshold", async () => {
      // EUR booking, threshold €240
      // Scraper returns $250 USD → €250/1.08 ≈ €231.48 — below threshold → alert
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ currency: "EUR", cashThreshold: "240" }),
      ] as never);
      vi.mocked(getCurrentRate).mockImplementation(async (currency) =>
        currency === "USD" ? 1 : currency === "EUR" ? 1.08 : null
      );

      const result = await runPriceWatchRefresh([]);

      expect(result.results[0].alerts).toBe(1);
      expect(sendPriceDropAlert).toHaveBeenCalledOnce();
    });

    it("handles cross-currency: MYR scraper price vs EUR booking", async () => {
      // EUR booking, threshold €200
      // Scraper returns 1000 MYR (1 MYR = 0.21 USD, 1 EUR = 1.08 USD)
      // 1000 MYR * 0.21 = $210 USD / 1.08 = €194.44 — below threshold → alert
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ currency: "EUR", cashThreshold: "200" }),
      ] as never);
      vi.mocked(mockFetcher.fetchPrice).mockResolvedValue({
        source: "ihg_api",
        rates: [
          {
            roomId: "room-1",
            roomName: "Classic Room",
            ratePlanCode: "IGCOR",
            ratePlanName: "Best Flexible Rate",
            cashPrice: 1000,
            cashCurrency: "MYR",
            awardPrice: null,
            isRefundable: "REFUNDABLE",
            isCorporate: false,
          },
        ],
      });
      vi.mocked(getCurrentRate).mockImplementation(async (currency) =>
        currency === "MYR" ? 0.21 : currency === "EUR" ? 1.08 : null
      );

      const result = await runPriceWatchRefresh([]);

      expect(result.results[0].alerts).toBe(1);
      expect(sendPriceDropAlert).toHaveBeenCalledOnce();
    });

    it("falls back to raw comparison when exchange rate is unavailable", async () => {
      // EUR booking, threshold €230, rates unavailable → raw $250 > €230 → no alert
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ currency: "EUR", cashThreshold: "230" }),
      ] as never);
      vi.mocked(getCurrentRate).mockResolvedValue(null);

      const result = await runPriceWatchRefresh([]);

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

  describe("fixed-rate award prices (GHA and Accor)", () => {
    const GHA_RATE = {
      roomId: "room-1",
      roomName: "Deluxe Room",
      ratePlanCode: "FLEX",
      ratePlanName: "Flexible Rate",
      cashPrice: 200,
      cashCurrency: "USD",
      awardPrice: null as number | null,
      isRefundable: "REFUNDABLE" as const,
      isCorporate: false,
    };

    it("populates awardPrice for GHA watch using cash price in USD", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ hotelChainId: HOTEL_ID.GHA_DISCOVERY }),
      ] as never);
      vi.mocked(mockFetcher.fetchPrice).mockResolvedValue({
        source: "gha_api",
        rates: [{ ...GHA_RATE, cashPrice: 200, cashCurrency: "USD" }],
      });

      await runPriceWatchRefresh([]);

      const createCall = vi.mocked(prisma.priceSnapshot.create).mock.calls[0][0];
      expect(createCall.data.rooms.create[0].awardPrice).toBe(20000); // $200 × 100
    });

    it("populates awardPrice for GHA watch with non-USD cash price", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ hotelChainId: HOTEL_ID.GHA_DISCOVERY }),
      ] as never);
      vi.mocked(mockFetcher.fetchPrice).mockResolvedValue({
        source: "gha_api",
        rates: [{ ...GHA_RATE, cashPrice: 1000, cashCurrency: "MYR" }],
      });
      // 1 MYR = 0.21 USD → 1000 MYR = $210 → 21000 points
      vi.mocked(getCurrentRate).mockImplementation(async (c) => (c === "MYR" ? 0.21 : null));

      await runPriceWatchRefresh([]);

      const createCall = vi.mocked(prisma.priceSnapshot.create).mock.calls[0][0];
      expect(createCall.data.rooms.create[0].awardPrice).toBe(21000);
    });

    it("populates awardPrice for Accor watch converting local → USD → EUR", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ hotelChainId: HOTEL_ID.ACCOR }),
      ] as never);
      vi.mocked(mockFetcher.fetchPrice).mockResolvedValue({
        source: "accor_api",
        // 100000 KRW; 1 KRW = 0.00072 USD; 1 EUR = 1.08 USD
        // → $72 USD / 1.08 = €66.67 → 6667 points
        rates: [{ ...GHA_RATE, cashPrice: 100000, cashCurrency: "KRW" }],
      });
      vi.mocked(getCurrentRate).mockImplementation(async (c) => {
        if (c === "KRW") return 0.00072;
        if (c === "EUR") return 1.08;
        return null;
      });

      await runPriceWatchRefresh([]);

      const createCall = vi.mocked(prisma.priceSnapshot.create).mock.calls[0][0];
      expect(createCall.data.rooms.create[0].awardPrice).toBe(6667);
    });

    it("does not overwrite an existing awardPrice set by the scraper", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ hotelChainId: HOTEL_ID.GHA_DISCOVERY }),
      ] as never);
      vi.mocked(mockFetcher.fetchPrice).mockResolvedValue({
        source: "gha_api",
        rates: [{ ...GHA_RATE, cashPrice: 200, cashCurrency: "USD", awardPrice: 99999 }],
      });

      await runPriceWatchRefresh([]);

      const createCall = vi.mocked(prisma.priceSnapshot.create).mock.calls[0][0];
      expect(createCall.data.rooms.create[0].awardPrice).toBe(99999);
    });

    it("leaves awardPrice null when exchange rate is unavailable", async () => {
      vi.mocked(prisma.priceWatch.findMany).mockResolvedValue([
        makeWatch({ hotelChainId: HOTEL_ID.GHA_DISCOVERY }),
      ] as never);
      vi.mocked(mockFetcher.fetchPrice).mockResolvedValue({
        source: "gha_api",
        rates: [{ ...GHA_RATE, cashPrice: 1000, cashCurrency: "MYR" }],
      });
      vi.mocked(getCurrentRate).mockResolvedValue(null);

      await runPriceWatchRefresh([]);

      const createCall = vi.mocked(prisma.priceSnapshot.create).mock.calls[0][0];
      expect(createCall.data.rooms.create[0].awardPrice).toBeNull();
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

describe("fixedRateAwardPoints", () => {
  describe("GHA Discovery — 1 point = $0.01 USD", () => {
    it("calculates points from USD cash price", () => {
      expect(fixedRateAwardPoints(200, "USD", HOTEL_ID.GHA_DISCOVERY, 1, null)).toBe(20000);
    });

    it("calculates points from non-USD cash price via USD conversion", () => {
      // 1000 MYR × 0.21 USD/MYR = $210 → 21000 points
      expect(fixedRateAwardPoints(1000, "MYR", HOTEL_ID.GHA_DISCOVERY, 0.21, null)).toBe(21000);
    });

    it("returns null when cashCurrencyToUSD is unavailable for non-USD price", () => {
      expect(fixedRateAwardPoints(1000, "MYR", HOTEL_ID.GHA_DISCOVERY, null, null)).toBeNull();
    });

    it("rounds fractional points to nearest integer", () => {
      // $100.005 × 100 = 10000.5 → rounds to 10001
      expect(fixedRateAwardPoints(100.005, "USD", HOTEL_ID.GHA_DISCOVERY, 1, null)).toBe(10001);
    });
  });

  describe("Accor ALL — 1 point = €0.01", () => {
    it("calculates points from USD cash price via EUR", () => {
      // $108 USD / 1.08 EUR/USD = €100 → 10000 points
      expect(fixedRateAwardPoints(108, "USD", HOTEL_ID.ACCOR, 1, 1.08)).toBe(10000);
    });

    it("calculates points from non-USD cash price via USD bridge to EUR", () => {
      // 100000 KRW × 0.00072 USD/KRW = $72 USD / 1.08 = €66.67 → 6667 points
      expect(fixedRateAwardPoints(100000, "KRW", HOTEL_ID.ACCOR, 0.00072, 1.08)).toBe(6667);
    });

    it("returns null when eurToUSD is unavailable", () => {
      expect(fixedRateAwardPoints(100, "USD", HOTEL_ID.ACCOR, 1, null)).toBeNull();
    });

    it("returns null when cashCurrencyToUSD is unavailable for non-USD price", () => {
      expect(fixedRateAwardPoints(1000, "KRW", HOTEL_ID.ACCOR, null, 1.08)).toBeNull();
    });
  });

  describe("other chains", () => {
    it("returns null for chains without fixed award rates", () => {
      expect(fixedRateAwardPoints(200, "USD", HOTEL_ID.HYATT, 1, null)).toBeNull();
      expect(fixedRateAwardPoints(200, "USD", HOTEL_ID.MARRIOTT, 1, null)).toBeNull();
    });
  });
});
