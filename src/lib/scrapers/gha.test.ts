import { describe, it, expect } from "vitest";
import { GhaFetcher, parseGhaRates } from "./gha";
import { lowestRefundableCash, lowestAward } from "@/lib/price-fetcher";
import { HOTEL_ID } from "@/lib/constants";

const makeProperty = (overrides = {}) => ({
  id: "prop-1",
  name: "Kempinski Hotel Mall of the Emirates Dubai",
  hotelChainId: HOTEL_ID.GHA_DISCOVERY,
  chainPropertyId: "23084",
  countryCode: null as string | null,
  ...overrides,
});

describe("GhaFetcher.canFetch", () => {
  const fetcher = new GhaFetcher();

  it("returns true for GHA property with objectId", () => {
    expect(fetcher.canFetch(makeProperty())).toBe(true);
  });

  it("returns false for non-GHA property", () => {
    expect(fetcher.canFetch(makeProperty({ hotelChainId: HOTEL_ID.HYATT }))).toBe(false);
  });

  it("returns false for GHA property without chainPropertyId", () => {
    expect(fetcher.canFetch(makeProperty({ chainPropertyId: null }))).toBe(false);
  });
});

// Minimal GHA response fixture
const makeRoom = (roomCode: string, roomName: string, rates: object[]): object => ({
  roomCode,
  roomName,
  rates,
});

const makeRate = (
  rateCode: string,
  rateName: string,
  price: number,
  currency = "AED",
  memberRate = false
): object => ({
  rateCode,
  rateName,
  price,
  currency,
  memberRate,
});

describe("parseGhaRates", () => {
  it("returns empty array for empty response", () => {
    expect(parseGhaRates({})).toEqual([]);
  });

  it("returns empty array when rooms array is empty", () => {
    expect(parseGhaRates({ rooms: [] })).toEqual([]);
  });

  it("sets isRefundable to UNKNOWN for all rates — cancellable is resolved via a separate per-rate API call", () => {
    const data = {
      rooms: [
        makeRoom("D1D", "Superior Room", [
          makeRate("GHAPREF", "GHA DISCOVERY Preferential Rate - Room Only", 1079, "AED", true),
          makeRate("IDDRRMBB", "DISCOVERY Flexible Rate", 552),
          makeRate("IDDRRMBA", "DISCOVERY Advance Purchase", 325),
          makeRate("EARLY10", "Early Booker Rate - Room Only", 1080),
          makeRate("VBRRGP", "Best Available Rate - Room Only", 500),
        ]),
      ],
    };
    const rates = parseGhaRates(data);
    // parseGhaRates alone cannot determine refundability — enrichRefundability()
    // must be called separately to populate isRefundable from the rate detail API.
    expect(rates.every((r) => r.isRefundable === "UNKNOWN")).toBe(true);
  });

  it("award price is always null — GHA has no point redemptions", () => {
    const data = {
      rooms: [
        makeRoom("D1D", "Superior Room", [
          makeRate("DAILY", "Fully Flexible Rate - Room Only", 1199),
        ]),
      ],
    };
    const rates = parseGhaRates(data);
    expect(rates[0].awardPrice).toBeNull();
  });

  it("deduplicates rates with the same roomName and rateCode, keeping the cheaper price", () => {
    const data = {
      rooms: [
        makeRoom("SSK", "Studio Suite", [
          makeRate("IDDRRMBB", "DISCOVERY Flexible Rate", 500, "MYR"),
        ]),
        makeRoom("SST", "Studio Suite", [
          makeRate("IDDRRMBB", "DISCOVERY Flexible Rate", 450, "MYR"),
        ]),
      ],
    };
    const rates = parseGhaRates(data);
    expect(rates).toHaveLength(1);
    expect(rates[0].cashPrice).toBe(450);
    expect(rates[0].roomName).toBe("Studio Suite");
  });

  it("divides total price by numNights to get per-night rate", () => {
    const data = {
      rooms: [
        makeRoom("D1D", "Superior Room", [
          makeRate("GHAPREF", "GHA DISCOVERY Preferential Rate - Room Only", 2158, "AED", true),
        ]),
      ],
    };
    const rates = parseGhaRates(data, 2);
    expect(rates[0].cashPrice).toBe(1079);
  });

  it("skips rates with zero or negative price", () => {
    const data = {
      rooms: [
        makeRoom("D1D", "Superior Room", [
          makeRate("DAILY", "Fully Flexible Rate", 0),
          makeRate("EARLY10", "Early Booker", -100),
        ]),
      ],
    };
    expect(parseGhaRates(data)).toHaveLength(0);
  });

  it("skips rooms missing roomCode or roomName", () => {
    const data = {
      rooms: [
        { roomName: "Superior Room", rates: [makeRate("DAILY", "Fully Flexible Rate", 1199)] },
        { roomCode: "D1D", rates: [makeRate("DAILY", "Fully Flexible Rate", 1199)] },
      ],
    };
    expect(parseGhaRates(data)).toHaveLength(0);
  });

  it("parses multiple rooms with multiple rates", () => {
    const data = {
      rooms: [
        makeRoom("D1D", "Superior Room", [
          makeRate("GHAPREF", "GHA DISCOVERY Preferential Rate - Room Only", 1079, "AED", true),
          makeRate("DAILY", "Fully Flexible Rate - Room Only", 1199, "AED"),
          makeRate("EARLY10", "Early Booker Rate - Room Only", 1080, "AED"),
        ]),
        makeRoom("C1D", "Deluxe Room", [
          makeRate("GHAPREF", "GHA DISCOVERY Preferential Rate - Room Only", 1169, "AED", true),
          makeRate("DAILY", "Fully Flexible Rate - Room Only", 1299, "AED"),
        ]),
      ],
    };
    const rates = parseGhaRates(data);
    expect(rates).toHaveLength(5);
    expect(rates.map((r) => r.roomId)).toEqual(["D1D", "D1D", "D1D", "C1D", "C1D"]);
  });

  it("lowestRefundableCash excludes NON_REFUNDABLE rates and includes REFUNDABLE and UNKNOWN", () => {
    const data = {
      rooms: [
        makeRoom("D1D", "Superior Room", [
          makeRate("EARLYBIRD", "Early Bird Rate", 800, "AED"),
          makeRate("FLEXRATE", "Best Flexible Rate", 1079, "AED"),
        ]),
        makeRoom("C1D", "Deluxe Room", [
          makeRate("FLEXRATE", "Best Flexible Rate", 1299, "AED"),
          makeRate("UNKNOWN_RATE", "Some Rate", 900, "AED"),
        ]),
      ],
    };
    const rates = parseGhaRates(data);
    // Simulate enrichment: early bird is non-refundable, flex is refundable
    rates.find((r) => r.ratePlanCode === "EARLYBIRD")!.isRefundable = "NON_REFUNDABLE";
    rates.find((r) => r.ratePlanCode === "FLEXRATE" && r.roomId === "D1D")!.isRefundable =
      "REFUNDABLE";
    rates.find((r) => r.ratePlanCode === "FLEXRATE" && r.roomId === "C1D")!.isRefundable =
      "REFUNDABLE";
    // UNKNOWN_RATE stays UNKNOWN

    const { price, currency } = lowestRefundableCash(rates);
    // Should pick the cheapest non-NON_REFUNDABLE rate (UNKNOWN_RATE at 900, not EARLYBIRD at 800)
    expect(price).toBe(900);
    expect(currency).toBe("AED");
  });

  it("lowestAward is always null — no redemption rates", () => {
    const data = {
      rooms: [makeRoom("D1D", "Superior Room", [makeRate("DAILY", "Fully Flexible Rate", 1199)])],
    };
    const rates = parseGhaRates(data);
    expect(lowestAward(rates)).toBeNull();
  });

  it("all rates have isCorporate=false", () => {
    const data = {
      rooms: [
        makeRoom("D1D", "Superior Room", [
          makeRate("GHAPREF", "GHA DISCOVERY Preferential Rate - Room Only", 1079, "AED", true),
          makeRate("DAILY", "Fully Flexible Rate - Room Only", 1199, "AED"),
        ]),
      ],
    };
    const rates = parseGhaRates(data);
    expect(rates.every((r) => r.isCorporate === false)).toBe(true);
  });
});
