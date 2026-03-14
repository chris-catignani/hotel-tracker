import { describe, it, expect } from "vitest";
import { MarriottFetcher, parseMarriottRates } from "./marriott";
import { lowestRefundableCash, lowestAward } from "@/lib/price-fetcher";
import { HOTEL_ID } from "@/lib/constants";

const makeProperty = (overrides = {}) => ({
  id: "prop-1",
  name: "Atlanta Marriott Marquis",
  hotelChainId: HOTEL_ID.MARRIOTT,
  chainPropertyId: "ATLMQ",
  ...overrides,
});

describe("MarriottFetcher.canFetch", () => {
  const fetcher = new MarriottFetcher();

  it("returns true for Marriott property with MARSHA code", () => {
    expect(fetcher.canFetch(makeProperty())).toBe(true);
  });

  it("returns false for non-Marriott property", () => {
    expect(fetcher.canFetch(makeProperty({ hotelChainId: HOTEL_ID.HYATT }))).toBe(false);
  });

  it("returns false for Marriott property without chainPropertyId", () => {
    expect(fetcher.canFetch(makeProperty({ chainPropertyId: null }))).toBe(false);
  });
});

// ---- helpers ----

const makeEdge = (
  roomType: string,
  roomName: string,
  ratePlanCode: string,
  ratePlanName: string,
  categoryCode: "StandardRates" | "Prepay" | "Packages",
  amount: number,
  currency = "USD",
  decimalPoint = 2
) => ({
  node: {
    basicInformation: {
      name: roomName,
      type: roomType,
      ratePlan: [{ ratePlanCode, ratePlanType: "24.RPT" }],
    },
    availabilityAttributes: {
      productRateCategory: { typeCode: categoryCode },
    },
    rates: {
      name: ratePlanName,
      description: null,
      rateModes: {
        __typename: "HotelRoomRateModesCash" as const,
        averageNightlyRatePerUnit: {
          amount: { amount, currency, decimalPoint },
        },
      },
    },
  },
});

const makeAwardEdge = (
  roomType: string,
  roomName: string,
  ratePlanCode: string,
  ratePlanName: string,
  points: number
) => ({
  node: {
    basicInformation: {
      name: roomName,
      type: roomType,
      ratePlan: [{ ratePlanCode, ratePlanType: "12.RPT" }],
    },
    availabilityAttributes: {
      productRateCategory: { typeCode: "StandardRates" as const },
    },
    rates: {
      name: ratePlanName,
      description: null,
      rateModes: {
        __typename: "HotelRoomRateModesPoints" as const,
        pointsPerUnit: { points, pointsSaved: 0, freeNights: 0 },
      },
    },
  },
});

const makeResponse = (edges: object[]) => ({
  data: {
    commerce: {
      product: {
        searchProductsByProperty: { edges },
      },
    },
  },
});

// ---- parseMarriottRates tests ----

describe("parseMarriottRates", () => {
  it("returns empty array for empty responses", () => {
    expect(parseMarriottRates([])).toEqual([]);
  });

  it("returns empty array when edges are absent", () => {
    expect(parseMarriottRates([{}])).toEqual([]);
  });

  it("parses a StandardRates cash rate as refundable", () => {
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge(
          "d000000002",
          "1 King Bed, Guest Room",
          "XDRZ",
          "Flexible Rate",
          "StandardRates",
          15900
        ),
      ]),
    ]);

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      roomId: "1 King Bed, Guest Room",
      roomName: "1 King Bed, Guest Room",
      ratePlanCode: "XDRZ",
      ratePlanName: "Flexible Rate",
      cashPrice: 159,
      cashCurrency: "USD",
      awardPrice: null,
      isRefundable: true,
      isCorporate: false,
    });
  });

  it("parses a Prepay rate as non-refundable", () => {
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge("genr", "Guest Room", "AP0J", "Prepay Non-refundable", "Prepay", 13600),
      ]),
    ]);

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      ratePlanCode: "AP0J",
      cashPrice: 136,
      isRefundable: false,
    });
  });

  it("parses a Packages rate as refundable", () => {
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge(
          "quen",
          "Moxy Deluxe",
          "ARWA",
          "Stay Elite ®Every Stay Counts",
          "Packages",
          20881,
          "MYR"
        ),
      ]),
    ]);

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      ratePlanCode: "ARWA",
      ratePlanName: "Stay Elite ®Every Stay Counts",
      cashPrice: 208.81,
      cashCurrency: "MYR",
      isRefundable: true,
    });
  });

  it("correctly applies decimalPoint to convert amount", () => {
    // amount=25000, decimalPoint=2 → 250.00
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge("king", "King Room", "XDRZ", "Flexible Rate", "StandardRates", 25000, "USD", 2),
      ]),
    ]);
    expect(rates[0].cashPrice).toBe(250);
  });

  it("parses award (points-only) rates", () => {
    const rates = parseMarriottRates([
      makeResponse([makeAwardEdge("king", "King Room", "BONV", "Bonvoy Award Rate", 30000)]),
    ]);

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      cashPrice: null,
      awardPrice: 30000,
      isRefundable: true,
      isCorporate: false,
    });
  });

  it("deduplicates rates with the same roomName+ratePlanName across multiple responses", () => {
    const edge = makeEdge(
      "d000000002",
      "1 King Bed",
      "XDRZ",
      "Flexible Rate",
      "StandardRates",
      15900
    );
    const rates = parseMarriottRates([makeResponse([edge]), makeResponse([edge])]);
    expect(rates).toHaveLength(1);
  });

  it("deduplicates physical room variants with same name but different roomId", () => {
    // Marriott returns multiple inventory IDs (d000000038–d000000041) for the same room type
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge(
          "d000000038",
          "2 Double Beds, City View",
          "XDRZ",
          "Flexible Rate",
          "StandardRates",
          40400
        ),
        makeEdge(
          "d000000039",
          "2 Double Beds, City View",
          "XDRZ",
          "Flexible Rate",
          "StandardRates",
          40400
        ),
        makeEdge(
          "d000000040",
          "2 Double Beds, City View",
          "XDRZ",
          "Flexible Rate",
          "StandardRates",
          40400
        ),
        makeEdge(
          "d000000041",
          "2 Double Beds, City View",
          "XDRZ",
          "Flexible Rate",
          "StandardRates",
          40400
        ),
      ]),
    ]);
    expect(rates).toHaveLength(1);
    expect(rates[0].roomId).toBe("2 Double Beds, City View");
  });

  it("keeps member and non-member rates separate when they share the same ratePlanCode", () => {
    // Both use ratePlanCode XDRZ but have different ratePlanNames and prices
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge(
          "d000000038",
          "2 Double Beds, City View",
          "XDRZ",
          "Member Flexible Rate",
          "StandardRates",
          39200
        ),
        makeEdge(
          "d000000038",
          "2 Double Beds, City View",
          "XDRZ",
          "Flexible Rate",
          "StandardRates",
          40400
        ),
      ]),
    ]);
    expect(rates).toHaveLength(2);
    expect(rates.map((r) => r.ratePlanName)).toEqual(["Member Flexible Rate", "Flexible Rate"]);
  });

  it("merges rates from multiple responses (member + standard calls)", () => {
    const memberEdge = makeEdge(
      "d000000002",
      "1 King Bed",
      "MEMBER1",
      "Member Rate",
      "StandardRates",
      15100
    );
    const standardEdge = makeEdge("genr", "Guest Room", "AP0J", "Prepay Rate", "Prepay", 13600);
    const rates = parseMarriottRates([makeResponse([memberEdge]), makeResponse([standardEdge])]);
    expect(rates).toHaveLength(2);
  });

  it("parses non-USD currency", () => {
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge("king", "King Room", "XDRZ", "Flexible Rate", "StandardRates", 59900, "MYR", 2),
      ]),
    ]);
    expect(rates[0].cashCurrency).toBe("MYR");
    expect(rates[0].cashPrice).toBe(599);
  });

  it("skips cash rates with zero or negative amounts", () => {
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge("king", "King Room", "XDRZ", "Flexible Rate", "StandardRates", 0),
        makeEdge("king", "King Room", "XDRZ2", "Another Rate", "StandardRates", -100),
      ]),
    ]);
    expect(rates).toHaveLength(0);
  });

  it("returns rates for multiple room types", () => {
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge(
          "d000000002",
          "1 King Bed, Guest Room",
          "XDRZ",
          "Flexible Rate",
          "StandardRates",
          15900
        ),
        makeEdge("genr", "Guest Room", "AP0J", "Prepay Rate", "Prepay", 13600),
        makeEdge("city", "Skyline View", "XDRZ", "Flexible Rate", "StandardRates", 17900),
      ]),
    ]);
    expect(rates).toHaveLength(3);
  });

  it("all rates have isCorporate=false", () => {
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge("d000000002", "1 King Bed", "XDRZ", "Flexible Rate", "StandardRates", 15900),
        makeEdge("genr", "Guest Room", "AP0J", "Prepay Rate", "Prepay", 13600),
      ]),
    ]);
    expect(rates.every((r) => r.isCorporate === false)).toBe(true);
  });

  it("lowestRefundableCash picks the cheapest refundable rate", () => {
    const rates = parseMarriottRates([
      makeResponse([
        makeEdge("d000000002", "1 King Bed", "XDRZ", "Flexible Rate", "StandardRates", 15900),
        makeEdge("genr", "Guest Room", "AP0J", "Prepay Rate", "Prepay", 13600),
        makeEdge("twin", "Twin Room", "XDRZ", "Flexible Rate", "StandardRates", 14200),
      ]),
    ]);
    const { price, currency } = lowestRefundableCash(rates);
    expect(price).toBe(142);
    expect(currency).toBe("USD");
  });

  it("lowestAward picks the cheapest award rate", () => {
    const rates = parseMarriottRates([
      makeResponse([
        makeAwardEdge("king", "King Room", "BONV", "Award Rate", 35000),
        makeAwardEdge("twin", "Twin Room", "BONV2", "Award Rate", 30000),
      ]),
    ]);
    expect(lowestAward(rates)).toBe(30000);
  });

  it("uses the fixture file without throwing", async () => {
    const { default: fixture } = await import("./__fixtures__/marriott-sample-response.json");
    const rates = parseMarriottRates([fixture]);
    // Fixture has 2 StandardRates + 2 Prepay + 2 Packages; all included → 6 rates
    expect(rates.length).toBeGreaterThan(0);
    expect(rates.every((r) => r.isCorporate === false)).toBe(true);
  });
});
