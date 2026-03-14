import { describe, it, expect } from "vitest";
import { HyattFetcher, parseHyattRates, parseCashRates, buildAwardMap } from "./hyatt";
import { lowestRefundableCash, lowestAward } from "@/lib/price-fetcher";
import { HOTEL_ID } from "@/lib/constants";

const makeProperty = (overrides = {}) => ({
  id: "prop-1",
  name: "Park Hyatt Chicago",
  hotelChainId: HOTEL_ID.HYATT,
  chainPropertyId: "chiph",
  ...overrides,
});

describe("HyattFetcher.canFetch", () => {
  const fetcher = new HyattFetcher();

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

describe("parseCashRates", () => {
  it("returns one entry per cash rate plan, no award entries", () => {
    const data = {
      roomRates: {
        KNGX: {
          currencyCode: "USD",
          lowestAvgPointValue: 5000,
          ratePlans: [
            { id: "STANDARD", rate: 300, penaltyCode: "48H", currencyCode: "USD" },
            { id: "MEMBER", rate: 280, penaltyCode: "24H", currencyCode: "USD" },
          ],
        },
      },
    };

    const rates = parseCashRates(data);
    expect(rates).toHaveLength(2);
    expect(rates.every((r) => r.awardPrice === null)).toBe(true);
    expect(rates.every((r) => r.ratePlanCode !== "AWARD")).toBe(true);
  });

  it("uses roomType.title as roomName when available", () => {
    const data = {
      roomRates: {
        KNGX: {
          roomType: { title: "1 King Bed" },
          ratePlans: [{ id: "STD", rate: 300, currencyCode: "USD" }],
        },
      },
    };
    const rates = parseCashRates(data);
    expect(rates[0].roomName).toBe("1 King Bed");
  });

  it("falls back to roomKey when roomType.title is absent", () => {
    const data = {
      roomRates: {
        KNGX: {
          ratePlans: [{ id: "STD", rate: 300, currencyCode: "USD" }],
        },
      },
    };
    const rates = parseCashRates(data);
    expect(rates[0].roomName).toBe("KNGX");
  });

  it("marks non-refundable plans correctly", () => {
    const data = {
      roomRates: {
        "room-1": {
          ratePlans: [
            { id: "AP", rate: 200, penaltyCode: "CNR" },
            { id: "STD", rate: 250, penaltyCode: "48H" },
          ],
        },
      },
    };
    const rates = parseCashRates(data);
    expect(rates.find((r) => r.ratePlanCode === "AP")?.isRefundable).toBe(false);
    expect(rates.find((r) => r.ratePlanCode === "STD")?.isRefundable).toBe(true);
    const { price } = lowestRefundableCash(rates);
    expect(price).toBe(250);
  });

  it("falls back to summary price when no ratePlans", () => {
    const data = {
      roomRates: { "room-1": { lowestPublicRate: 199, currencyCode: "USD" } },
    };
    const rates = parseCashRates(data);
    expect(rates).toHaveLength(1);
    expect(rates[0].cashPrice).toBe(199);
  });

  it("returns empty array when roomRates is empty", () => {
    expect(parseCashRates({ roomRates: {} })).toHaveLength(0);
  });
});

describe("buildAwardMap", () => {
  it("extracts lowestAvgPointValue per room", () => {
    const data = {
      roomRates: {
        KNGX: { lowestAvgPointValue: 5000, currencyCode: "MYR" },
        TWNX: { lowestAvgPointValue: 5000, currencyCode: "MYR" },
        BALK: {}, // no award price
      },
    };
    const map = buildAwardMap(data);
    expect(map.size).toBe(2);
    expect(map.get("KNGX")).toEqual({ points: 5000, currency: "MYR" });
    expect(map.get("TWNX")).toEqual({ points: 5000, currency: "MYR" });
    expect(map.has("BALK")).toBe(false);
  });

  it("returns empty map when no rooms have award prices", () => {
    const data = { roomRates: { KNGX: { lowestCashRate: 300 } } };
    expect(buildAwardMap(data).size).toBe(0);
  });
});

describe("parseHyattRates (legacy wrapper)", () => {
  it("returns cash + award entries from a single response", () => {
    const data = {
      roomRates: {
        "rate-1": {
          lowestCashRate: 320,
          currencyCode: "USD",
          lowestAvgPointValue: 25000,
          ratePlans: [{ id: "STANDARD", rate: 320, penaltyCode: "48H", currencyCode: "USD" }],
        },
        "rate-2": {
          lowestCashRate: 280,
          currencyCode: "USD",
          lowestAvgPointValue: 18000,
          ratePlans: [{ id: "MEMBER", rate: 280, penaltyCode: "24H", currencyCode: "USD" }],
        },
      },
    };

    const rates = parseHyattRates(data);
    // 2 cash plan entries + 2 award entries
    expect(rates).toHaveLength(4);

    const { price: cash, currency } = lowestRefundableCash(rates);
    expect(cash).toBe(280);
    expect(currency).toBe("USD");

    expect(lowestAward(rates)).toBe(18000);
  });
});
