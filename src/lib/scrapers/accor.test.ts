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
    description?: string | null;
    mealPlanCode?: string;
    mealPlanLabel?: string | null;
    rateLabel?: string | null;
  } = {}
): object => ({
  id: `offer-${roomName}-${cancellationCode}-${amount}`,
  type: options.type ?? "ROOM",
  description: options.description !== undefined ? options.description : null,
  accommodation: { name: roomName },
  mealPlan: {
    code: options.mealPlanCode ?? "EUROPEAN_PLAN",
    label: options.mealPlanLabel !== undefined ? options.mealPlanLabel : null,
  },
  rate: {
    label: options.rateLabel !== undefined ? options.rateLabel : null,
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
    expect(parseAccorRates({}, 1)).toEqual([]);
  });

  it("returns empty array when offers array is empty", () => {
    expect(parseAccorRates(makeResponse([]), 1)).toEqual([]);
  });

  it("parses a single refundable offer using rate.label as ratePlanName", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free", {
        rateLabel: "ADVANCE SAVER RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      roomId: "Superior room, 1 king bed",
      roomName: "Superior room, 1 king bed",
      ratePlanCode: "ROOM|EUROPEAN_PLAN|FREE_CANCELLATION",
      ratePlanName: "ADVANCE SAVER RATE",
      cashPrice: 101.31,
      cashCurrency: "USD",
      awardPrice: null,
      isRefundable: "REFUNDABLE",
      isCorporate: false,
    });
  });

  it("parses a non-refundable offer correctly", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable", {
        rateLabel: "ADVANCE SAVER RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates[0].isRefundable).toBe("NON_REFUNDABLE");
  });

  it("marks unknown cancellation codes as UNKNOWN refundability", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 95.0, "PARTIAL_CANCELLATION", "Partial refund", {
        rateLabel: "FLEXIBLE RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates[0].isRefundable).toBe("UNKNOWN");
  });

  it("award price is always null — Accor ALL is cashback, not points redemption", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free", {
        rateLabel: "ADVANCE SAVER RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates[0].awardPrice).toBeNull();
  });

  it("falls back to 'Room only' when rate.label is null and meal plan is EUROPEAN_PLAN", () => {
    const data = makeResponse([
      makeOffer("Superior room", 100, "FREE_CANCELLATION", "Cancel free", {
        mealPlanCode: "EUROPEAN_PLAN",
        mealPlanLabel: null,
        rateLabel: null,
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates[0].ratePlanName).toBe("Room only");
  });

  it("falls back to meal plan label when rate.label is null for BED_AND_BREAKFAST", () => {
    const data = makeResponse([
      makeOffer("Superior room", 120, "FREE_CANCELLATION", "Cancel free", {
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: null,
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates[0].ratePlanName).toBe("Breakfast included");
  });

  it("uses rate.label as ratePlanName for PACKAGE offers", () => {
    const data = makeResponse([
      makeOffer("Superior room", 130, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "INDULGENCE PACKAGE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates[0].ratePlanName).toBe("INDULGENCE PACKAGE");
  });

  it("falls back to 'Package – {mealPlanLabel}' when rate.label is null for PACKAGE offers", () => {
    const data = makeResponse([
      makeOffer("Superior room", 130, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: null,
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates[0].ratePlanName).toBe("Package – Breakfast included");
  });

  it("keeps ROOM and PACKAGE offers as separate entries even with same rate.label", () => {
    // Defensive: if somehow ROOM and PACKAGE have the same rate.label, they remain separate
    // because the ratePlanCode differs. In practice their labels are always different.
    const data = makeResponse([
      makeOffer("Superior room", 101.31, "FREE_CANCELLATION", "Cancel free", {
        type: "ROOM",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "FLEXIBLE RATE - BREAKFAST INCLUDED",
      }),
      makeOffer("Superior room", 115.0, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "INDULGENCE PACKAGE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates).toHaveLength(2);
    expect(rates.map((r) => r.ratePlanCode).sort()).toEqual([
      "PACKAGE|BED_AND_BREAKFAST|FREE_CANCELLATION",
      "ROOM|BED_AND_BREAKFAST|FREE_CANCELLATION",
    ]);
  });

  it("keeps distinct PACKAGE offers with different rate.labels", () => {
    const data = makeResponse([
      makeOffer("Superior room", 171000, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "INDULGENCE PACKAGE",
        currency: "KRW",
      }),
      makeOffer("Superior room", 171000, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "WELLNESS PACKAGE",
        currency: "KRW",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates).toHaveLength(2);
    expect(rates.map((r) => r.ratePlanName).sort()).toEqual([
      "INDULGENCE PACKAGE",
      "WELLNESS PACKAGE",
    ]);
  });

  it("keeps separate entries for different rate.labels on the same room", () => {
    const data = makeResponse([
      makeOffer("Superior room", 87.29, "NO_CANCELLATION", "Non-refundable", {
        rateLabel: "ADVANCE SAVER RATE",
      }),
      makeOffer("Superior room", 100.0, "FREE_CANCELLATION", "Cancel free", {
        rateLabel: "FLEXIBLE RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates).toHaveLength(2);
  });

  it("deduplicates offers with the same rate.label + cancellation code, keeping cheaper price", () => {
    const data = makeResponse([
      makeOffer("Superior room", 275000, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "INDULGENCE PACKAGE",
        currency: "KRW",
      }),
      makeOffer("Superior room", 266000, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "INDULGENCE PACKAGE",
        currency: "KRW",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates).toHaveLength(1);
    expect(rates[0].cashPrice).toBe(266000);
  });

  it("keeps separate entries for different room types", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable", {
        rateLabel: "ADVANCE SAVER RATE",
      }),
      makeOffer("Deluxe room, city view, 1 king bed", 103.93, "NO_CANCELLATION", "Non-refundable", {
        rateLabel: "ADVANCE SAVER RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(rates).toHaveLength(2);
  });

  it("skips offers with missing or zero amount", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 0, "FREE_CANCELLATION", "Cancel free"),
      makeOffer("Superior room, 1 king bed", -10, "NO_CANCELLATION", "Non-refundable"),
    ]);
    expect(parseAccorRates(data, 1)).toHaveLength(0);
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
                rate: { label: "ADVANCE SAVER RATE" },
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
    expect(parseAccorRates(data, 1)).toHaveLength(0);
  });

  it("parses a realistic Incheon airport response (4 ROOM + 3 PACKAGE rates per room type)", () => {
    // Fixture based on live API response for hotelId B7P1 (ibis Styles Ambassador Incheon Airport)
    // on 2026-04-14. rate.label matches what is displayed on the all.accor.com website.
    const data = makeResponse([
      makeOffer("Superior Room with 1 double bed", 113050, "NO_CANCELLATION", "Non-refundable", {
        mealPlanCode: "EUROPEAN_PLAN",
        mealPlanLabel: null,
        rateLabel: "ADVANCE SAVER RATE",
        currency: "KRW",
      }),
      makeOffer("Superior Room with 1 double bed", 133000, "FREE_CANCELLATION", "Cancel free 6pm", {
        mealPlanCode: "EUROPEAN_PLAN",
        mealPlanLabel: null,
        rateLabel: "FLEXIBLE RATE",
        currency: "KRW",
      }),
      makeOffer("Superior Room with 1 double bed", 135850, "NO_CANCELLATION", "Non-refundable", {
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "ADVANCE SAVER RATE - BREAKFAST INCLUDED",
        currency: "KRW",
      }),
      makeOffer("Superior Room with 1 double bed", 155800, "FREE_CANCELLATION", "Cancel free 6pm", {
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "FLEXIBLE RATE - BREAKFAST INCLUDED",
        currency: "KRW",
      }),
      // 3 distinct PACKAGE offers — distinct rate.labels
      makeOffer("Superior Room with 1 double bed", 161500, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "INDULGENCE PACKAGE",
        currency: "KRW",
      }),
      makeOffer("Superior Room with 1 double bed", 161500, "FREE_CANCELLATION", "Cancel free", {
        type: "PACKAGE",
        mealPlanCode: "BED_AND_BREAKFAST",
        mealPlanLabel: "Breakfast included",
        rateLabel: "WELLNESS PACKAGE",
        currency: "KRW",
      }),
      makeOffer("Superior Room with 1 double bed", 164000, "FREE_CANCELLATION", "Cancel free 6pm", {
        type: "PACKAGE",
        mealPlanCode: "EUROPEAN_PLAN",
        mealPlanLabel: null,
        rateLabel: "Park, Sleep, Fly",
        currency: "KRW",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    // 4 ROOM rates + 3 distinct PACKAGE rates
    expect(rates).toHaveLength(7);

    const rateNames = rates.map((r) => r.ratePlanName).sort();
    expect(rateNames).toEqual([
      "ADVANCE SAVER RATE",
      "ADVANCE SAVER RATE - BREAKFAST INCLUDED",
      "FLEXIBLE RATE",
      "FLEXIBLE RATE - BREAKFAST INCLUDED",
      "INDULGENCE PACKAGE",
      "Park, Sleep, Fly",
      "WELLNESS PACKAGE",
    ]);
  });

  it("divides total stay amount by nights to get per-night cash price", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 200, "FREE_CANCELLATION", "Cancel free", {
        rateLabel: "FLEXIBLE RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 2);
    expect(rates[0].cashPrice).toBe(100);
  });

  it("lowestRefundableCash returns cheapest FREE_CANCELLATION rate", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable", {
        rateLabel: "ADVANCE SAVER RATE",
      }),
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free", {
        rateLabel: "FLEXIBLE RATE",
      }),
      makeOffer("Deluxe room, city view, 1 king bed", 103.93, "NO_CANCELLATION", "Non-refundable", {
        rateLabel: "ADVANCE SAVER RATE",
      }),
      makeOffer("Deluxe room, city view, 1 king bed", 120.6, "FREE_CANCELLATION", "Cancel free", {
        rateLabel: "FLEXIBLE RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    const { price, currency } = lowestRefundableCash(rates);
    expect(price).toBe(101.31);
    expect(currency).toBe("USD");
  });

  it("lowestAward is always null — no points redemption rates", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free", {
        rateLabel: "FLEXIBLE RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
    expect(lowestAward(rates)).toBeNull();
  });

  it("all rates have isCorporate=false", () => {
    const data = makeResponse([
      makeOffer("Superior room, 1 king bed", 87.29, "NO_CANCELLATION", "Non-refundable", {
        rateLabel: "ADVANCE SAVER RATE",
      }),
      makeOffer("Superior room, 1 king bed", 101.31, "FREE_CANCELLATION", "Cancel free", {
        rateLabel: "FLEXIBLE RATE",
      }),
    ]);
    const rates = parseAccorRates(data, 1);
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
                rate: { label: "ADVANCE SAVER RATE" },
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
    const rates = parseAccorRates(data, 1);
    expect(rates[0].cashCurrency).toBe("USD");
  });
});
