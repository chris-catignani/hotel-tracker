import { describe, it, expect } from "vitest";
import { HiltonFetcher, parseHiltonRoomRates } from "./hilton";
import { lowestRefundableCash, lowestAward } from "@/lib/price-fetcher";
import { HOTEL_ID } from "@/lib/constants";

const makeProperty = (overrides = {}) => ({
  id: "prop-1",
  name: "Hilton Kuala Lumpur",
  hotelChainId: HOTEL_ID.HILTON,
  chainPropertyId: "KULDT",
  countryCode: "MY" as string | null,
  ...overrides,
});

describe("HiltonFetcher.canFetch", () => {
  const fetcher = new HiltonFetcher();

  it("returns true for Hilton property with ctyhocn", () => {
    expect(fetcher.canFetch(makeProperty())).toBe(true);
  });

  it("returns false for non-Hilton property", () => {
    expect(fetcher.canFetch(makeProperty({ hotelChainId: HOTEL_ID.HYATT }))).toBe(false);
  });

  it("returns false for Hilton property without ctyhocn", () => {
    expect(fetcher.canFetch(makeProperty({ chainPropertyId: null }))).toBe(false);
  });
});

// --- Helpers for building mock getRoomRates responses ---

const makeRoomOnlyRate = (
  ratePlanCode: string,
  rateAmount: number,
  overrides: {
    ratePlanName?: string;
    nonRefundable?: boolean;
    advancePurchase?: boolean;
  } = {}
) => ({
  ratePlanCode,
  rateAmount,
  guarantee: { nonRefundable: overrides.nonRefundable ?? false },
  ratePlan: {
    ratePlanName: overrides.ratePlanName ?? "Standard Rate",
    advancePurchase: overrides.advancePurchase ?? false,
  },
});

const makeRedemptionRate = (
  pointsRate: number,
  overrides: {
    ratePlanCode?: string;
    ratePlanName?: string;
    nonRefundable?: boolean;
    redemptionType?: string;
  } = {}
) => ({
  ratePlanCode: overrides.ratePlanCode ?? "STND",
  pointDetails: { pointsRate },
  ratePlan: {
    ratePlanName: overrides.ratePlanName ?? "Standard Award",
    redemptionType: overrides.redemptionType ?? "STANDARD_REWARD",
  },
  guarantee: { nonRefundable: overrides.nonRefundable ?? false },
});

const makeRoomRatesResponse = (
  roomTypeCode: string,
  roomTypeName: string,
  roomOnlyRates: object[],
  redemptionRoomRates: object[] = [],
  currencyCode = "USD"
) => ({
  data: {
    hotel: {
      shopAvail: {
        currencyCode,
        roomTypes: [
          {
            roomTypeCode,
            roomTypeName,
            roomOnlyRates,
            redemptionRoomRates,
          },
        ],
      },
    },
  },
});

// ---

describe("parseHiltonRoomRates", () => {
  it("returns empty array for empty/null response", () => {
    expect(parseHiltonRoomRates(null, "T2", "Twin Room", "USD")).toEqual([]);
    expect(parseHiltonRoomRates({}, "T2", "Twin Room", "USD")).toEqual([]);
    expect(parseHiltonRoomRates({ data: {} }, "T2", "Twin Room", "USD")).toEqual([]);
  });

  it("returns empty array when roomTypes is empty", () => {
    const data = {
      data: { hotel: { shopAvail: { currencyCode: "USD", roomTypes: [] } } },
    };
    expect(parseHiltonRoomRates(data, "T2", "Twin Room", "USD")).toEqual([]);
  });

  it("parses a refundable cash rate", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLGO", 150, { ratePlanName: "Best Flexible Rate" }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      roomId: "T2",
      roomName: "Twin Room",
      ratePlanCode: "HTLGO",
      ratePlanName: "Best Flexible Rate",
      cashPrice: 150,
      cashCurrency: "USD",
      awardPrice: null,
      isRefundable: "REFUNDABLE",
      isCorporate: false,
    });
  });

  it("marks rate as NON_REFUNDABLE when guarantee.nonRefundable is true", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLSAV", 120, { ratePlanName: "Save More", nonRefundable: true }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");

    expect(rates[0].isRefundable).toBe("NON_REFUNDABLE");
  });

  it("marks rate as NON_REFUNDABLE when ratePlan.advancePurchase is true", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLAP", 110, { ratePlanName: "Advance Purchase", advancePurchase: true }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");

    expect(rates[0].isRefundable).toBe("NON_REFUNDABLE");
  });

  it("falls back to ratePlanCode as ratePlanName when ratePlan is absent", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      { ratePlanCode: "HTLGO", rateAmount: 150, guarantee: { nonRefundable: false } },
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(rates[0].ratePlanName).toBe("HTLGO");
  });

  it("skips cash rates with zero or missing rateAmount", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLGO", 0),
      { ratePlanCode: "HTLSAV" }, // no rateAmount
    ]);
    expect(parseHiltonRoomRates(data, "T2", "Twin Room", "USD")).toHaveLength(0);
  });

  it("skips cash rates with missing ratePlanCode", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      { rateAmount: 150, guarantee: { nonRefundable: false } },
    ]);
    expect(parseHiltonRoomRates(data, "T2", "Twin Room", "USD")).toHaveLength(0);
  });

  it("parses an award (redemption) rate", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [], [makeRedemptionRate(30000)]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      roomId: "T2",
      roomName: "Twin Room",
      ratePlanCode: "STND",
      ratePlanName: "Standard Award",
      cashPrice: null,
      awardPrice: 30000,
      isRefundable: "REFUNDABLE",
      isCorporate: false,
    });
  });

  it("marks award rate as NON_REFUNDABLE when guarantee.nonRefundable is true", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [],
      [makeRedemptionRate(30000, { nonRefundable: true })]
    );
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(rates[0].isRefundable).toBe("NON_REFUNDABLE");
  });

  it("skips award rate when pointsRate is 0 or missing", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [],
      [
        { ratePlanCode: "STND", pointDetails: { pointsRate: 0 }, ratePlan: {} },
        { ratePlanCode: "STND", ratePlan: {} }, // no pointDetails
      ]
    );
    expect(parseHiltonRoomRates(data, "T2", "Twin Room", "USD")).toHaveLength(0);
  });

  it("only uses the first redemptionRoomRate (first: 1 in query)", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [],
      [
        makeRedemptionRate(30000, { ratePlanCode: "STND" }),
        makeRedemptionRate(40000, { ratePlanCode: "PREM" }),
      ]
    );
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    // Only the first redemption rate should be included
    const awardRates = rates.filter((r) => r.awardPrice !== null);
    expect(awardRates).toHaveLength(1);
    expect(awardRates[0].ratePlanCode).toBe("STND");
  });

  it("parses multiple cash rates for the same room", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLGO", 150, { ratePlanName: "Best Flexible" }),
      makeRoomOnlyRate("HTLSAV", 120, { ratePlanName: "Save More", nonRefundable: true }),
      makeRoomOnlyRate("HTLAP", 100, { ratePlanName: "Advance Purchase", advancePurchase: true }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");

    expect(rates).toHaveLength(3);
    expect(rates.map((r) => r.ratePlanCode)).toEqual(["HTLGO", "HTLSAV", "HTLAP"]);
    expect(rates.map((r) => r.isRefundable)).toEqual([
      "REFUNDABLE",
      "NON_REFUNDABLE",
      "NON_REFUNDABLE",
    ]);
  });

  it("parses cash rates and award rate together", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [makeRoomOnlyRate("HTLGO", 150), makeRoomOnlyRate("HTLSAV", 120, { nonRefundable: true })],
      [makeRedemptionRate(30000)]
    );
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");

    expect(rates).toHaveLength(3);
    const cashRates = rates.filter((r) => r.cashPrice !== null);
    const awardRates = rates.filter((r) => r.awardPrice !== null);
    expect(cashRates).toHaveLength(2);
    expect(awardRates).toHaveLength(1);
  });

  it("uses currencyCode from response body over caller-supplied currency", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [makeRoomOnlyRate("HTLGO", 599)],
      [],
      "MYR"
    );
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(rates[0].cashCurrency).toBe("MYR");
  });

  it("falls back to caller-supplied currency when response has no currencyCode", () => {
    const data = {
      data: {
        hotel: {
          shopAvail: {
            roomTypes: [
              {
                roomTypeCode: "T2",
                roomTypeName: "Twin Room",
                roomOnlyRates: [makeRoomOnlyRate("HTLGO", 150)],
              },
            ],
          },
        },
      },
    };
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "EUR");
    expect(rates[0].cashCurrency).toBe("EUR");
  });

  it("uses award ratePlanCode fallback 'AWARD' when absent", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [],
      [{ pointDetails: { pointsRate: 30000 }, ratePlan: { ratePlanName: "Award" } }]
    );
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(rates[0].ratePlanCode).toBe("AWARD");
  });

  it("all rates have isCorporate=false", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [makeRoomOnlyRate("HTLGO", 150), makeRoomOnlyRate("HTLSAV", 120, { nonRefundable: true })],
      [makeRedemptionRate(30000)]
    );
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(rates.every((r) => r.isCorporate === false)).toBe(true);
  });

  it("lowestRefundableCash returns the cheapest refundable cash rate", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLGO", 150),
      makeRoomOnlyRate("HTLSAV", 120, { nonRefundable: true }),
      makeRoomOnlyRate("HTLMID", 130),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    const { price } = lowestRefundableCash(rates);
    expect(price).toBe(130);
  });

  it("lowestAward returns the award rate", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [makeRoomOnlyRate("HTLGO", 150)],
      [makeRedemptionRate(25000)]
    );
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(lowestAward(rates)).toBe(25000);
  });
});
