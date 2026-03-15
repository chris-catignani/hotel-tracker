import { describe, it, expect } from "vitest";
import { AccorFetcher, parseAccorRates } from "./accor";
import { lowestRefundableCash, lowestAward } from "@/lib/price-fetcher";
import { HOTEL_ID } from "@/lib/constants";

const makeProperty = (overrides = {}) => ({
  id: "prop-1",
  name: "Novotel Kuala Lumpur City Centre",
  hotelChainId: HOTEL_ID.ACCOR,
  chainPropertyId: "C3M1",
  countryCode: "MY",
  ...overrides,
});

describe("AccorFetcher.canFetch", () => {
  const fetcher = new AccorFetcher();

  it("returns true for Accor property with chainPropertyId", () => {
    expect(fetcher.canFetch(makeProperty())).toBe(true);
  });

  it("returns false for non-Accor property", () => {
    expect(fetcher.canFetch(makeProperty({ hotelChainId: HOTEL_ID.HYATT }))).toBe(false);
  });

  it("returns false for Accor property without chainPropertyId", () => {
    expect(fetcher.canFetch(makeProperty({ chainPropertyId: null }))).toBe(false);
  });
});

// Minimal response fixture helpers
const makeOffer = (
  roomName: string,
  amount: number,
  cancellationCode: string,
  cancellationLabel: string,
  currency = "USD"
): object => ({
  id: `offer-${roomName}-${cancellationCode}-${amount}`,
  accommodation: { name: roomName },
  pricing: {
    currency,
    main: {
      amount,
      simplifiedPolicies: {
        cancellation: { code: cancellationCode, label: cancellationLabel },
      },
    },
  },
});

const makeResponse = (offers: object[]): object => ({
  data: {
    hotelOffers: {
      offersSelection: { offers },
    },
  },
});

describe("parseAccorRates", () => {
  it("returns empty array for empty response", () => {
    expect(parseAccorRates({})).toEqual([]);
  });

  it("returns empty array when offers array is empty", () => {
    expect(parseAccorRates(makeResponse([]))).toEqual([]);
  });

  it("parses a single refundable offer correctly", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free of charge"),
    ]);
    const rates = parseAccorRates(data);
    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      roomId: "Superior room, 1 king bed",
      roomName: "Superior room, 1 king bed",
      ratePlanCode: "FREE_CANCELLATION",
      ratePlanName: "Cancel free of charge",
      cashPrice: 101.31,
      cashCurrency: "USD",
      awardPrice: null,
      isRefundable: "REFUNDABLE",
      isCorporate: false,
    });
  });

  it("parses a non-refundable offer correctly", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable"),
    ]);
    const rates = parseAccorRates(data);
    expect(rates[0].isRefundable).toBe("NON_REFUNDABLE");
  });

  it("marks unknown cancellation codes as UNKNOWN refundability", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 95.0, "PARTIAL_CANCELLATION", "Partial refund"),
    ]);
    const rates = parseAccorRates(data);
    expect(rates[0].isRefundable).toBe("UNKNOWN");
  });

  it("award price is always null — Accor ALL is cashback, not points redemption", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free"),
    ]);
    const rates = parseAccorRates(data);
    expect(rates[0].awardPrice).toBeNull();
  });

  it("deduplicates same roomName + cancellationCode, keeping the cheaper price", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 107.34, "FREE_CANCELLATION", "Cancel free"),
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free"),
    ]);
    const rates = parseAccorRates(data);
    expect(rates).toHaveLength(1);
    expect(rates[0].cashPrice).toBe(101.31);
  });

  it("keeps separate entries for different cancellation codes on the same room", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable"),
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free"),
    ]);
    const rates = parseAccorRates(data);
    expect(rates).toHaveLength(2);
    const codes = rates.map((r) => r.ratePlanCode).sort();
    expect(codes).toEqual(["FREE_CANCELLATION", "NO_CANCELLATION"]);
  });

  it("keeps separate entries for different room types", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable"),
      makeOffer("Deluxe room, city view, 1 king bed", 103.93, "NO_CANCELLATION", "Non-refundable"),
    ]);
    const rates = parseAccorRates(data);
    expect(rates).toHaveLength(2);
  });

  it("skips offers with missing or zero amount", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 0, "FREE_CANCELLATION", "Cancel free"),
      makeOffer("Superior room, 1 king bed", -10, "NO_CANCELLATION", "Non-refundable"),
    ]);
    expect(parseAccorRates(data)).toHaveLength(0);
  });

  it("skips offers with missing room name", () => {
    const data = {
      data: {
        hotelOffers: {
          offersSelection: {
            offers: [
              {
                id: "offer-1",
                accommodation: {},
                pricing: {
                  currency: "USD",
                  main: {
                    amount: 101.31,
                    simplifiedPolicies: {
                      cancellation: { code: "FREE_CANCELLATION", label: "Cancel free" },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    };
    expect(parseAccorRates(data)).toHaveLength(0);
  });

  it("parses a realistic multi-room response (from live fixture)", () => {
    // Fixture based on actual API response for hotelId C3M1 (Novotel KL)
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable"),
      makeOffer("Superior room, 1 king bed", 93.32, "NO_CANCELLATION", "Non-refundable"),
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free"),
      makeOffer("Superior room, 1 king bed", 107.34, "FREE_CANCELLATION", "Cancel free"),
      makeOffer("Superior room, 2 single beds", 87.29, "NO_CANCELLATION", "Non-refundable"),
      makeOffer("Superior room, 2 single beds", 101.31, "FREE_CANCELLATION", "Cancel free"),
      makeOffer("Deluxe room, city view, 1 king bed", 103.93, "NO_CANCELLATION", "Non-refundable"),
      makeOffer("Deluxe room, city view, 1 king bed", 120.6, "FREE_CANCELLATION", "Cancel free"),
    ]);
    const rates = parseAccorRates(data);
    // 3 room types × 2 cancellation policies = 6 unique entries
    expect(rates).toHaveLength(6);
    // Cheapest NO_CANCELLATION for "Superior room, 1 king bed" should be 87.29
    const supKingNonRef = rates.find(
      (r) => r.roomName === "Superior room, 1 king bed" && r.ratePlanCode === "NO_CANCELLATION"
    );
    expect(supKingNonRef?.cashPrice).toBe(87.29);
    // Cheapest FREE_CANCELLATION for "Superior room, 1 king bed" should be 101.31
    const supKingRef = rates.find(
      (r) => r.roomName === "Superior room, 1 king bed" && r.ratePlanCode === "FREE_CANCELLATION"
    );
    expect(supKingRef?.cashPrice).toBe(101.31);
  });

  it("lowestRefundableCash returns cheapest FREE_CANCELLATION rate", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable"),
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free"),
      makeOffer("Deluxe room, city view, 1 king bed", 103.93, "NO_CANCELLATION", "Non-refundable"),
      makeOffer("Deluxe room, city view, 1 king bed", 120.6, "FREE_CANCELLATION", "Cancel free"),
    ]);
    const rates = parseAccorRates(data);
    const { price, currency } = lowestRefundableCash(rates);
    expect(price).toBe(101.31);
    expect(currency).toBe("USD");
  });

  it("lowestAward is always null — no points redemption rates", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free"),
    ]);
    const rates = parseAccorRates(data);
    expect(lowestAward(rates)).toBeNull();
  });

  it("all rates have isCorporate=false", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable"),
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free"),
    ]);
    const rates = parseAccorRates(data);
    expect(rates.every((r) => r.isCorporate === false)).toBe(true);
  });

  it("uses USD as default currency when currency is missing", () => {
    const data = {
      data: {
        hotelOffers: {
          offersSelection: {
            offers: [
              {
                id: "offer-1",
                accommodation: { name: "Superior room" },
                pricing: {
                  main: {
                    amount: 100,
                    simplifiedPolicies: {
                      cancellation: { code: "FREE_CANCELLATION", label: "Cancel free" },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    };
    const rates = parseAccorRates(data);
    expect(rates[0].cashCurrency).toBe("USD");
  });
});
