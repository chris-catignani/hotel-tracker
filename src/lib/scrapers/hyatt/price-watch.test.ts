import { describe, it, expect } from "vitest";
import {
  HyattFetcher,
  parseHyattRates,
  parseCashRates,
  buildAwardMap,
  parseRefundability,
} from "./price-watch";
import { lowestRefundableCash, lowestAward } from "@/lib/price-fetcher";
import { HOTEL_ID } from "@/lib/constants";

const makeProperty = (overrides = {}) => ({
  id: "prop-1",
  name: "Park Hyatt Chicago",
  hotelChainId: HOTEL_ID.HYATT,
  chainPropertyId: "chiph",
  countryCode: null as string | null,
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

  it("excludes non-refundable plans from lowest cash (Melbourne integration)", () => {
    // Covers both Melbourne properties: StandardX uses "NON", Hyatt Centric uses "13M"
    const data = {
      roomRates: {
        KING: {
          currencyCode: "AUD",
          ratePlans: [
            { id: "MYHIAP", rate: 281.74, penaltyCode: "13M" }, // non-refundable advance purchase
            { id: "MYHI", rate: 337.42, penaltyCode: "48H" }, // refundable
            { id: "ADPR", rate: 200.5, penaltyCode: "NON" }, // non-refundable advance purchase
            { id: "RACK", rate: 364.14, penaltyCode: "48H" }, // refundable
          ],
        },
      },
    };
    const rates = parseCashRates(data);
    expect(rates.find((r) => r.ratePlanCode === "MYHIAP")?.isRefundable).toBe("NON_REFUNDABLE");
    expect(rates.find((r) => r.ratePlanCode === "ADPR")?.isRefundable).toBe("NON_REFUNDABLE");
    expect(rates.find((r) => r.ratePlanCode === "MYHI")?.isRefundable).toBe("REFUNDABLE");
    expect(rates.find((r) => r.ratePlanCode === "RACK")?.isRefundable).toBe("REFUNDABLE");
    const { price } = lowestRefundableCash(rates);
    expect(price).toBe(337.42);
  });

  it("falls back to summary price when no ratePlans", () => {
    const data = {
      roomRates: { "room-1": { lowestPublicRate: 199, currencyCode: "USD" } },
    };
    const rates = parseCashRates(data);
    expect(rates).toHaveLength(1);
    expect(rates[0].cashPrice).toBe(199);
  });

  it("multiplies per-night rate plan price by numNights for total stay", () => {
    const data = {
      roomRates: {
        KNGX: {
          currencyCode: "USD",
          ratePlans: [{ id: "STANDARD", rate: 200, penaltyCode: "48H", currencyCode: "USD" }],
        },
      },
    };
    const rates = parseCashRates(data, 3);
    expect(rates[0].cashPrice).toBe(600);
  });

  it("multiplies summary price by numNights when no ratePlans", () => {
    const data = {
      roomRates: { "room-1": { lowestPublicRate: 199, currencyCode: "USD" } },
    };
    const rates = parseCashRates(data, 3);
    expect(rates[0].cashPrice).toBe(597);
  });

  it("returns empty array when roomRates is empty", () => {
    expect(parseCashRates({ roomRates: {} })).toHaveLength(0);
  });
});

describe("parseRefundability", () => {
  // Refundable: time-window codes ≤72h seen in real API responses
  it.each([
    ["24H", "REFUNDABLE"], // Hyatt Centric Melbourne — Member Rate
    ["48H", "REFUNDABLE"], // Hyatt Centric Melbourne — Standard Rate
    ["72H", "REFUNDABLE"], // Hyatt Centric Melbourne — Pet Friendly
    ["24H:1NT", "REFUNDABLE"], // StandardX Melbourne — Standard Rate (RACK)
    ["48HRS:1NT", "REFUNDABLE"], // StandardX Melbourne — Member Rate (MYHI)
    ["1D", "REFUNDABLE"], // hypothetical day-based code (24h)
    ["2D", "REFUNDABLE"], // hypothetical day-based code (48h)
    ["3D", "REFUNDABLE"], // hypothetical day-based code (72h)
  ])("%s → REFUNDABLE", (code, expected) => {
    expect(parseRefundability(code)).toBe(expected);
  });

  // Non-refundable: known codes + beyond-72h cases
  it.each([
    ["CNR", "NON_REFUNDABLE"], // Cancellation Not Refundable
    ["NON", "NON_REFUNDABLE"], // Non-Refundable (StandardX Melbourne — PKG3, MYHIAP, ADPR)
    ["13M", "NON_REFUNDABLE"], // 13-month advance purchase (Hyatt Centric Melbourne — MYHIAP)
    ["96H", "NON_REFUNDABLE"], // 96h > 72h threshold
    ["4D", "NON_REFUNDABLE"], // 4 days = 96h > 72h threshold
    ["FLEX", "NON_REFUNDABLE"], // unrecognised code → conservative default
  ])("%s → NON_REFUNDABLE", (code, expected) => {
    expect(parseRefundability(code)).toBe(expected);
  });

  it("undefined → REFUNDABLE (no penalty = no cancellation fee)", () => {
    expect(parseRefundability(undefined)).toBe("REFUNDABLE");
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

  it("multiplies lowestAvgPointValue by numNights for total stay points", () => {
    const data = {
      roomRates: { KNGX: { lowestAvgPointValue: 25000, currencyCode: "USD" } },
    };
    const map = buildAwardMap(data, 3);
    expect(map.get("KNGX")).toEqual({ points: 75000, currency: "USD" });
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
