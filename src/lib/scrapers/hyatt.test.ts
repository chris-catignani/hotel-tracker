import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HyattFetcher } from "./hyatt";
import { HOTEL_ID } from "@/lib/constants";

const makeProperty = (overrides = {}) => ({
  id: "prop-1",
  name: "Park Hyatt Chicago",
  hotelChainId: HOTEL_ID.HYATT,
  chainPropertyId: "chiph",
  ...overrides,
});

describe("HyattFetcher.canFetch", () => {
  const fetcher = new HyattFetcher("test-cookie");

  it("returns true for Hyatt property with spiritCode", () => {
    expect(fetcher.canFetch(makeProperty())).toBe(true);
  });

  it("returns false for non-Hyatt property", () => {
    expect(fetcher.canFetch(makeProperty({ hotelChainId: "marriott-id" }))).toBe(false);
  });

  it("returns false for Hyatt property without spiritCode", () => {
    expect(fetcher.canFetch(makeProperty({ chainPropertyId: null }))).toBe(false);
  });
});

describe("HyattFetcher.fetchPrice", () => {
  const fetcher = new HyattFetcher("test-cookie");

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed cash and award prices from API response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        roomRates: {
          "rate-1": {
            lowestAveragePrice: { value: 320, currency: "USD" },
            lowestAvgPointValue: 25000,
          },
          "rate-2": {
            lowestAveragePrice: { value: 280, currency: "USD" },
            lowestAvgPointValue: 18000,
          },
        },
      }),
    } as Response);

    const result = await fetcher.fetchPrice({
      property: makeProperty(),
      checkIn: "2026-06-01",
      checkOut: "2026-06-03",
    });

    expect(result).not.toBeNull();
    expect(result?.cashPrice).toBe(280);
    expect(result?.cashCurrency).toBe("USD");
    expect(result?.awardPrice).toBe(18000);
    expect(result?.source).toBe("hyatt_scraper");
  });

  it("returns null prices when roomRates is empty", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roomRates: {} }),
    } as Response);

    const result = await fetcher.fetchPrice({
      property: makeProperty(),
      checkIn: "2026-06-01",
      checkOut: "2026-06-03",
    });

    expect(result?.cashPrice).toBeNull();
    expect(result?.awardPrice).toBeNull();
  });

  it("returns null when API responds with non-ok status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    const result = await fetcher.fetchPrice({
      property: makeProperty(),
      checkIn: "2026-06-01",
      checkOut: "2026-06-03",
    });

    expect(result).toBeNull();
  });

  it("returns null when property has no spiritCode", async () => {
    const result = await fetcher.fetchPrice({
      property: makeProperty({ chainPropertyId: null }),
      checkIn: "2026-06-01",
      checkOut: "2026-06-03",
    });

    expect(result).toBeNull();
  });
});
