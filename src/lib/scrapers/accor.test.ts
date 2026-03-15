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
  options: {
    currency?: string;
    type?: string;
    mealPlanCode?: string;
    mealPlanLabel?: string | null;
  } = {}
): object => ({
  id: `offer-${roomName}-${cancellationCode}-${amount}`,
  type: options.type ?? "ROOM",
  accommodation: { name: roomName },
  mealPlan: {
    code: options.mealPlanCode ?? "EUROPEAN_PLAN",
    label: options.mealPlanLabel !== undefined ? options.mealPlanLabel : null,
  },
  pricing: {
    currency: options.currency ?? "USD",
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

  it("parses a single refundable room-only offer correctly", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free"),
    ]);
    const rates = parseAccorRates(data);
    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      roomId: "Superior room, 1 king bed",
      roomName: "Superior room, 1 king bed",
      ratePlanCode: "ROOM|EUROPEAN_PLAN|FREE_CANCELLATION",
      ratePlanName: "Room only",
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

  it("uses 'Room only' as ratePlanName when EUROPEAN_PLAN label is null", () => {
    const data = makeResponse([
      makeOffer("Superior room", 100, "FREE_CANCELLATION", "Cancel free", {
        mealPlanCode: "EUROPEAN_PLAN",
        mealPlanLabel: null,
      }),
    ]);
    const rates = parseAccorRates(data);
    expect(rates[0].ratePlanName).toBe("Room only");
  });

  it("uses the meal plan label as ratePlanName for BED_AND_BREAKFAST", () => {
    const data = makeResponse([
      makeOffer("Superior room", 120, "FREE_CANCELLATION", "Cancel free", {
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
      }),
    ]);
    const rates = parseAccorRates(data);
    expect(rates[0].ratePlanName).toBe("Breakfast included");
  });

  it("prefixes ratePlanName with 'Package –' for PACKAGE type offers", () => {
    const data = makeResponse([
      makeOffer("Superior room", 130, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
      }),
    ]);
    const rates = parseAccorRates(data);
    expect(rates[0].ratePlanName).toBe("Package – Breakfast included");
  });

  it("keeps ROOM and PACKAGE offers as separate entries even with same meal plan and cancellation", () => {
    const data = makeResponse([
      makeOffer("Superior room", 101.31, "FREE_CANCELLATION", "Cancel free", {
        type: "ROOM",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
      }),
      makeOffer("Superior room", 115.0, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
      }),
    ]);
    const rates = parseAccorRates(data);
    expect(rates).toHaveLength(2);
    expect(rates.map((r) => r.ratePlanCode).sort()).toEqual([
      "PACKAGE|BED_AND_BREAKFAST|FREE_CANCELLATION",
      "ROOM|BED_AND_BREAKFAST|FREE_CANCELLATION",
    ]);
  });

  it("keeps separate entries for different meal plans on the same room and cancellation", () => {
    const data = makeResponse([
      makeOffer("Superior room", 87.29, "NO_CANCELLATION", "Non-refundable", {
        mealPlanCode: "EUROPEAN_PLAN",
        mealPlanLabel: null,
      }),
      makeOffer("Superior room", 100.0, "NO_CANCELLATION", "Non-refundable", {
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
      }),
    ]);
    const rates = parseAccorRates(data);
    expect(rates).toHaveLength(2);
  });

  it("deduplicates same roomName + type + mealPlanCode + cancellationCode, keeping the cheaper price", () => {
    // Two PACKAGE BED_AND_BREAKFAST FREE_CANCELLATION offers at different prices
    const data = makeResponse([
      makeOffer("Superior room", 266000, "FREE_CANCELLATION", "Cancel by 2pm", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        currency: "KRW",
      }),
      makeOffer("Superior room", 266000, "FREE_CANCELLATION", "Cancel by 11:59pm", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        currency: "KRW",
      }),
    ]);
    const rates = parseAccorRates(data);
    expect(rates).toHaveLength(1);
    expect(rates[0].cashPrice).toBe(266000);
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
                type: "ROOM",
                accommodation: {},
                mealPlan: { code: "EUROPEAN_PLAN", label: null },
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

  it("parses a realistic Incheon airport response (4 ROOM + 2 PACKAGE rates per room type)", () => {
    // Fixture based on live API response for hotelId B7P1 (ibis Styles Ambassador Incheon Airport)
    const data = makeResponse([
      makeOffer("Superior Room with 1 double bed", 201875, "NO_CANCELLATION", "Non-refundable", {
        mealPlanCode: "EUROPEAN_PLAN",
        mealPlanLabel: null,
        currency: "KRW",
      }),
      makeOffer("Superior Room with 1 double bed", 224675, "NO_CANCELLATION", "Non-refundable", {
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        currency: "KRW",
      }),
      makeOffer("Superior Room with 1 double bed", 237500, "FREE_CANCELLATION", "Cancel free", {
        mealPlanCode: "EUROPEAN_PLAN",
        mealPlanLabel: null,
        currency: "KRW",
      }),
      makeOffer("Superior Room with 1 double bed", 260300, "FREE_CANCELLATION", "Cancel free", {
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        currency: "KRW",
      }),
      // Two PACKAGE+BED_AND_BREAKFAST+FREE_CANCELLATION at the same price → deduped to 1
      makeOffer("Superior Room with 1 double bed", 266000, "FREE_CANCELLATION", "Cancel by 2pm", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        currency: "KRW",
      }),
      makeOffer(
        "Superior Room with 1 double bed",
        266000,
        "FREE_CANCELLATION",
        "Cancel by 11:59pm",
        {
          type: "PACKAGE",
          mealPlanCode: "BED_AND_BREAKFAST",
          mealPlanLabel: "Breakfast included",
          currency: "KRW",
        }
      ),
      makeOffer("Superior Room with 1 double bed", 274000, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "EUROPEAN_PLAN",
        mealPlanLabel: null,
        currency: "KRW",
      }),
    ]);
    const rates = parseAccorRates(data);
    // 4 ROOM rates + 2 unique PACKAGE rates (2 dupes → 1)
    expect(rates).toHaveLength(6);

    const roomOnly = rates.filter((r) => r.ratePlanName === "Room only");
    const breakfast = rates.filter((r) => r.ratePlanName === "Breakfast included");
    const pkgBreakfast = rates.filter((r) => r.ratePlanName === "Package – Breakfast included");
    const pkgRoomOnly = rates.filter((r) => r.ratePlanName === "Package – Room only");
    expect(roomOnly).toHaveLength(2); // non-refundable + refundable
    expect(breakfast).toHaveLength(2); // non-refundable + refundable
    expect(pkgBreakfast).toHaveLength(1);
    expect(pkgRoomOnly).toHaveLength(1);
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
                type: "ROOM",
                accommodation: { name: "Superior room" },
                mealPlan: { code: "EUROPEAN_PLAN", label: null },
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
