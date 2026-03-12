import { describe, it, expect } from "vitest";
import { HyattFetcher, parseHyattRates } from "./hyatt";
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

describe("parseHyattRates", () => {
  it("returns a RoomRate entry per rate plan and per award room", () => {
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

  it("marks non-refundable plans correctly and excludes from lowestRefundableCash", () => {
    const data = {
      roomRates: {
        "room-1": {
          ratePlans: [
            { id: "AP", rate: 200, penaltyCode: "CNR" }, // Non-refundable
            { id: "STD", rate: 250, penaltyCode: "48H" }, // Refundable
          ],
        },
      },
    };

    const rates = parseHyattRates(data);
    expect(rates).toHaveLength(2);

    const nonRefundable = rates.find((r) => r.ratePlanCode === "AP");
    expect(nonRefundable?.isRefundable).toBe(false);
    expect(nonRefundable?.cashPrice).toBe(200);

    const refundable = rates.find((r) => r.ratePlanCode === "STD");
    expect(refundable?.isRefundable).toBe(true);
    expect(refundable?.cashPrice).toBe(250);

    // lowestRefundableCash picks the refundable one, not the cheaper non-refundable
    const { price } = lowestRefundableCash(rates);
    expect(price).toBe(250);
  });

  it("returns empty array when roomRates is empty", () => {
    expect(parseHyattRates({ roomRates: {} })).toHaveLength(0);
  });

  it("falls back to summary price when no ratePlans", () => {
    const data = {
      roomRates: {
        "room-1": {
          lowestPublicRate: 199,
          currencyCode: "USD",
        },
      },
    };

    const rates = parseHyattRates(data);
    expect(rates).toHaveLength(1);
    expect(rates[0].cashPrice).toBe(199);
    expect(rates[0].isRefundable).toBe(true);
  });
});
