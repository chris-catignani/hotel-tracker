import { describe, it, expect } from "vitest";
import { HiltonFetcher, parseHiltonRoomRates } from "./price-watch";
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
    cxlPolicyCode?: string;
    hhonorsDiscountRate?: object | null;
  } = {}
) => ({
  ratePlanCode,
  rateAmount,
  guarantee: {
    nonRefundable: overrides.nonRefundable ?? false,
    ...(overrides.cxlPolicyCode !== undefined && { cxlPolicyCode: overrides.cxlPolicyCode }),
  },
  ratePlan: {
    ratePlanName: overrides.ratePlanName ?? "Standard Rate",
    advancePurchase: overrides.advancePurchase ?? false,
  },
  hhonorsDiscountRate: overrides.hhonorsDiscountRate ?? null,
});

const makePackageRate = (
  ratePlanCode: string,
  rateAmount: number,
  ratePlanName = "Package Rate"
) => ({
  ratePlanCode,
  rateAmount,
  guarantee: { nonRefundable: false },
  ratePlan: { ratePlanName, advancePurchase: false },
});

const makeRedemptionRate = (
  pointsRate: number,
  overrides: {
    ratePlanCode?: string;
    ratePlanName?: string;
    nonRefundable?: boolean;
    redemptionType?: string;
    cxlPolicyCode?: string;
  } = {}
) => ({
  ratePlanCode: overrides.ratePlanCode ?? "STND",
  pointDetails: [{ pointsRate }],
  ratePlan: {
    ratePlanName: overrides.ratePlanName ?? "Standard Award",
    redemptionType: overrides.redemptionType ?? "STANDARD_REWARD",
  },
  guarantee: {
    nonRefundable: overrides.nonRefundable ?? false,
    ...(overrides.cxlPolicyCode !== undefined && { cxlPolicyCode: overrides.cxlPolicyCode }),
  },
});

const makeRoomRatesResponse = (
  roomTypeCode: string,
  roomTypeName: string,
  roomOnlyRates: object[],
  redemptionRoomRates: object[] = [],
  currencyCode = "USD",
  packageRates: object[] = []
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
            packageRates,
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

  it("marks rate as NON_REFUNDABLE when guarantee.cxlPolicyCode is 'NRG'", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("LHHSO1", 92, { cxlPolicyCode: "NRG" }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");

    expect(rates[0].isRefundable).toBe("NON_REFUNDABLE");
  });

  it("marks award rate as NON_REFUNDABLE when guarantee.cxlPolicyCode is 'NRG'", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [],
      [makeRedemptionRate(30000, { cxlPolicyCode: "NRG" })]
    );
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
        { ratePlanCode: "STND", pointDetails: [{ pointsRate: 0 }], ratePlan: {} },
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
      [{ pointDetails: [{ pointsRate: 30000 }], ratePlan: { ratePlanName: "Award" } }]
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

  // --- HHonors Discount Rates ---

  it("parses hhonorsDiscountRate nested in a roomOnlyRate", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLGO", 429, {
        ratePlanName: "Flexible Rate",
        hhonorsDiscountRate: {
          ratePlanCode: "HHDGO",
          rateAmount: 331,
          guarantee: { nonRefundable: false },
          ratePlan: { ratePlanName: "Flexible Rate (Member Discount)", advancePurchase: false },
        },
      }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "MYR");

    // Should have both the standard rate and the member discount rate
    expect(rates).toHaveLength(2);
    expect(rates[0]).toMatchObject({
      ratePlanCode: "HTLGO",
      ratePlanName: "Flexible Rate",
      cashPrice: 429,
      isRefundable: "REFUNDABLE",
    });
    expect(rates[1]).toMatchObject({
      ratePlanCode: "HHDGO",
      ratePlanName: "Flexible Rate (Member Discount)",
      cashPrice: 331,
      isRefundable: "REFUNDABLE",
    });
  });

  it("skips hhonorsDiscountRate when null", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLGO", 429, { hhonorsDiscountRate: null }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(rates).toHaveLength(1);
    expect(rates[0].ratePlanCode).toBe("HTLGO");
  });

  it("skips hhonorsDiscountRate when rateAmount is zero", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLGO", 429, {
        hhonorsDiscountRate: {
          ratePlanCode: "HHDGO",
          rateAmount: 0,
          guarantee: { nonRefundable: false },
          ratePlan: { ratePlanName: "Member Discount", advancePurchase: false },
        },
      }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(rates).toHaveLength(1);
    expect(rates[0].ratePlanCode).toBe("HTLGO");
  });

  it("marks hhonorsDiscountRate as NON_REFUNDABLE when advancePurchase is true", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLAP", 408, {
        ratePlanName: "Advance Purchase",
        advancePurchase: true,
        hhonorsDiscountRate: {
          ratePlanCode: "HHDAP",
          rateAmount: 320,
          guarantee: { nonRefundable: false },
          ratePlan: { ratePlanName: "Advance Purchase (Member)", advancePurchase: true },
        },
      }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(rates).toHaveLength(2);
    expect(rates[1]).toMatchObject({ ratePlanCode: "HHDAP", isRefundable: "NON_REFUNDABLE" });
  });

  it("parses multiple roomOnlyRates each with hhonorsDiscountRate", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [
      makeRoomOnlyRate("HTLGO", 429, {
        hhonorsDiscountRate: {
          ratePlanCode: "HHDGO",
          rateAmount: 331,
          guarantee: { nonRefundable: false },
          ratePlan: { ratePlanName: "Flexible (Member)", advancePurchase: false },
        },
      }),
      makeRoomOnlyRate("HTLBB", 479, {
        ratePlanName: "Breakfast Included",
        hhonorsDiscountRate: {
          ratePlanCode: "HHDBB",
          rateAmount: 375,
          guarantee: { nonRefundable: false },
          ratePlan: { ratePlanName: "Breakfast Included (Member)", advancePurchase: false },
        },
      }),
    ]);
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "MYR");

    // standard HTLGO, discount HHDGO, standard HTLBB, discount HHDBB
    expect(rates).toHaveLength(4);
    expect(rates.map((r) => r.ratePlanCode)).toEqual(["HTLGO", "HHDGO", "HTLBB", "HHDBB"]);
  });

  // --- Package Rates ---

  it("parses packageRates", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [makeRoomOnlyRate("HTLGO", 429)],
      [],
      "MYR",
      [
        makePackageRate("PKGDINE", 500, "Stay and Dine"),
        makePackageRate("PKGSWT", 520, "Sweeten Your Stay"),
      ]
    );
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "MYR");

    expect(rates).toHaveLength(3);
    expect(rates[1]).toMatchObject({
      ratePlanCode: "PKGDINE",
      ratePlanName: "Stay and Dine",
      cashPrice: 500,
      isRefundable: "REFUNDABLE",
      isCorporate: false,
    });
    expect(rates[2]).toMatchObject({
      ratePlanCode: "PKGSWT",
      ratePlanName: "Sweeten Your Stay",
      cashPrice: 520,
    });
  });

  it("skips packageRates with zero rateAmount", () => {
    const data = makeRoomRatesResponse("T2", "Twin Room", [], [], "USD", [
      makePackageRate("PKGZERO", 0, "Zero Package"),
    ]);
    expect(parseHiltonRoomRates(data, "T2", "Twin Room", "USD")).toHaveLength(0);
  });

  it("handles room with no packageRates field", () => {
    const data = {
      data: {
        hotel: {
          shopAvail: {
            currencyCode: "USD",
            roomTypes: [
              {
                roomTypeCode: "T2",
                roomTypeName: "Twin Room",
                roomOnlyRates: [makeRoomOnlyRate("HTLGO", 150)],
                redemptionRoomRates: [],
                // no packageRates key
              },
            ],
          },
        },
      },
    };
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "USD");
    expect(rates).toHaveLength(1);
    expect(rates[0].ratePlanCode).toBe("HTLGO");
  });

  it("parses all three cash rate sources together", () => {
    const data = makeRoomRatesResponse(
      "T2",
      "Twin Room",
      [
        makeRoomOnlyRate("HTLGO", 429, {
          ratePlanName: "Flexible Rate",
          hhonorsDiscountRate: {
            ratePlanCode: "HHDGO",
            rateAmount: 331,
            guarantee: { nonRefundable: false },
            ratePlan: { ratePlanName: "Flexible (Member)", advancePurchase: false },
          },
        }),
      ],
      [makeRedemptionRate(50000)],
      "MYR",
      [makePackageRate("PKGDINE", 500, "Stay and Dine")]
    );
    const rates = parseHiltonRoomRates(data, "T2", "Twin Room", "MYR");

    // HTLGO (standard), HHDGO (member discount), PKGDINE (package), award
    expect(rates).toHaveLength(4);
    const cashRates = rates.filter((r) => r.cashPrice !== null);
    const awardRates = rates.filter((r) => r.awardPrice !== null);
    expect(cashRates).toHaveLength(3);
    expect(awardRates).toHaveLength(1);
    expect(cashRates.map((r) => r.ratePlanCode)).toEqual(["HTLGO", "HHDGO", "PKGDINE"]);
  });
});
