import { describe, it, expect } from "vitest";
import { IhgFetcher, parseIhgRates } from "./ihg";
import { lowestRefundableCash, lowestAward } from "@/lib/price-fetcher";
import { HOTEL_ID } from "@/lib/constants";

const makeProperty = (overrides = {}) => ({
  id: "prop-1",
  name: "InterContinental Chicago",
  hotelChainId: HOTEL_ID.IHG,
  chainPropertyId: "ORDHA",
  ...overrides,
});

describe("IhgFetcher.canFetch", () => {
  const fetcher = new IhgFetcher();

  it("returns true for IHG property with mnemonic", () => {
    expect(fetcher.canFetch(makeProperty())).toBe(true);
  });

  it("returns false for non-IHG property", () => {
    expect(fetcher.canFetch(makeProperty({ hotelChainId: HOTEL_ID.HYATT }))).toBe(false);
  });

  it("returns false for IHG property without mnemonic", () => {
    expect(fetcher.canFetch(makeProperty({ chainPropertyId: null }))).toBe(false);
  });
});

// Minimal IHG response fixture
const makeResponse = (
  offers: object[],
  productDefinitions?: object[],
  propertyCurrency = "USD"
) => ({
  hotels: [
    {
      propertyCurrency,
      productDefinitions: productDefinitions ?? [
        { inventoryTypeCode: "KNGX", inventoryTypeName: "King Standard Room" },
        { inventoryTypeCode: "DBLX", inventoryTypeName: "Double Standard Room" },
      ],
      rateDetails: { offers },
    },
  ],
});

const makeOffer = (
  ratePlanCode: string,
  inventoryTypeCode: string,
  amountBeforeTax: string,
  isRefundable = true
) => ({
  ratePlanCode,
  productUses: [{ inventoryTypeCode }],
  policies: { isRefundable },
  totalRate: { amountBeforeTax },
});

describe("parseIhgRates", () => {
  it("returns empty array for empty response", () => {
    expect(parseIhgRates({})).toEqual([]);
  });

  it("returns empty array when hotels array is empty", () => {
    expect(parseIhgRates({ hotels: [] })).toEqual([]);
  });

  it("returns empty array when offers array is empty", () => {
    expect(parseIhgRates(makeResponse([]))).toEqual([]);
  });

  it("parses a refundable cash rate (IGCOR) with known name", () => {
    const data = makeResponse([makeOffer("IGCOR", "KNGX", "299.00", true)]);
    const rates = parseIhgRates(data);

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      roomId: "KNGX",
      roomName: "King Standard Room",
      ratePlanCode: "IGCOR",
      ratePlanName: "Best Flexible Rate",
      cashPrice: 299,
      cashCurrency: "USD",
      awardPrice: null,
      isRefundable: true,
      isCorporate: false,
    });
  });

  it("parses a non-refundable cash rate using isRefundable from policies", () => {
    const data = makeResponse([makeOffer("IDAPF", "KNGX", "199.00", false)]);
    const rates = parseIhgRates(data);

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      ratePlanCode: "IDAPF",
      ratePlanName: "Advance Purchase",
      cashPrice: 199,
      isRefundable: false,
    });
  });

  it("parses unknown regional cash rate codes and uses code as ratePlanName fallback", () => {
    const data = makeResponse([makeOffer("IDMAF", "KNGX", "459.90", false)]);
    const rates = parseIhgRates(data);

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      ratePlanCode: "IDMAF",
      ratePlanName: "IDMAF",
      cashPrice: 459.9,
      isRefundable: false,
    });
  });

  it("defaults isRefundable to true when policies field is missing", () => {
    const offer = {
      ratePlanCode: "IGCOR",
      productUses: [{ inventoryTypeCode: "KNGX" }],
      totalRate: { amountBeforeTax: "299.00" },
    };
    const rates = parseIhgRates(makeResponse([offer]));
    expect(rates[0].isRefundable).toBe(true);
  });

  it("parses an award rate (IVANI) — points = amountBeforeTax × 100", () => {
    const data = makeResponse([makeOffer("IVANI", "KNGX", "300.00")]);
    const rates = parseIhgRates(data);

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      ratePlanCode: "IVANI",
      ratePlanName: "Reward Night",
      cashPrice: null,
      awardPrice: 30000,
      isRefundable: true,
    });
  });

  it("parses all IVAN award variants as award rates", () => {
    const codes = ["IVAN1", "IVAN3", "IVAN5", "IVAN6", "IVAN7", "IVANI"];
    const offers = codes.map((code) => makeOffer(code, "KNGX", "250.00"));
    const rates = parseIhgRates(makeResponse(offers));

    expect(rates).toHaveLength(codes.length);
    for (const rate of rates) {
      expect(rate.awardPrice).toBe(25000);
      expect(rate.cashPrice).toBeNull();
    }
  });

  it("uses propertyCurrency for cash rates", () => {
    const data = makeResponse([makeOffer("IGCOR", "KNGX", "599.00")], undefined, "MYR");
    const rates = parseIhgRates(data);
    expect(rates[0].cashCurrency).toBe("MYR");
  });

  it("falls back to USD when propertyCurrency is absent", () => {
    const data = {
      hotels: [
        {
          productDefinitions: [{ inventoryTypeCode: "KNGX", inventoryTypeName: "King Room" }],
          rateDetails: { offers: [makeOffer("IGCOR", "KNGX", "299.00")] },
          // no propertyCurrency
        },
      ],
    };
    const rates = parseIhgRates(data);
    expect(rates[0].cashCurrency).toBe("USD");
  });

  it("uses inventoryTypeCode as roomName fallback when inventoryTypeName is absent", () => {
    const data = makeResponse(
      [makeOffer("IGCOR", "KNGX", "299.00")],
      [{ inventoryTypeCode: "KNGX" }]
    );
    const rates = parseIhgRates(data);
    expect(rates[0].roomName).toBe("KNGX");
  });

  it("uses inventoryTypeCode as roomId and roomName when room not in productDefinitions", () => {
    const data = makeResponse([makeOffer("IGCOR", "UNKN", "299.00")]);
    const rates = parseIhgRates(data);
    expect(rates[0].roomId).toBe("UNKN");
    expect(rates[0].roomName).toBe("UNKN");
  });

  it("skips offers with zero or negative amounts", () => {
    const data = makeResponse([
      makeOffer("IGCOR", "KNGX", "0.00"),
      makeOffer("IGCOR", "DBLX", "-10.00"),
    ]);
    expect(parseIhgRates(data)).toHaveLength(0);
  });

  it("skips offers missing totalRate or amountBeforeTax", () => {
    const offers = [
      { ratePlanCode: "IGCOR", productUses: [{ inventoryTypeCode: "KNGX" }] },
      {
        ratePlanCode: "IGCOR",
        productUses: [{ inventoryTypeCode: "KNGX" }],
        totalRate: {},
      },
    ];
    expect(parseIhgRates(makeResponse(offers))).toHaveLength(0);
  });

  it("returns rates for multiple rooms", () => {
    const data = makeResponse([
      makeOffer("IGCOR", "KNGX", "299.00", true),
      makeOffer("IGCOR", "DBLX", "249.00", true),
    ]);
    const rates = parseIhgRates(data);
    expect(rates).toHaveLength(2);
    expect(rates.map((r) => r.roomId)).toEqual(["KNGX", "DBLX"]);
  });

  it("parses all offers including unknown regional codes", () => {
    const data = makeResponse([
      makeOffer("IGCOR", "KNGX", "599.00", true),
      makeOffer("IDAPF", "KNGX", "511.00", false),
      makeOffer("IDMAF", "KNGX", "459.90", false),
      makeOffer("IKPCM", "KNGX", "623.00", true),
      makeOffer("IVANI", "KNGX", "139.77", true),
    ]);
    const rates = parseIhgRates(data);
    expect(rates).toHaveLength(5);
    const cashRates = rates.filter((r) => r.cashPrice !== null);
    const awardRates = rates.filter((r) => r.awardPrice !== null);
    expect(cashRates).toHaveLength(4);
    expect(awardRates).toHaveLength(1);
  });

  it("lowestRefundableCash picks the cheapest refundable rate across rooms", () => {
    const data = makeResponse([
      makeOffer("IGCOR", "KNGX", "299.00", true),
      makeOffer("IDAPF", "KNGX", "199.00", false),
      makeOffer("IGCOR", "DBLX", "249.00", true),
    ]);
    const rates = parseIhgRates(data);
    const { price, currency } = lowestRefundableCash(rates);
    expect(price).toBe(249);
    expect(currency).toBe("USD");
  });

  it("lowestAward picks the cheapest award rate across rooms", () => {
    const data = makeResponse([
      makeOffer("IVANI", "KNGX", "300.00"),
      makeOffer("IVANI", "DBLX", "250.00"),
    ]);
    const rates = parseIhgRates(data);
    expect(lowestAward(rates)).toBe(25000);
  });

  it("all rates have isCorporate=false", () => {
    const data = makeResponse([
      makeOffer("IGCOR", "KNGX", "299.00"),
      makeOffer("IDAPF", "DBLX", "199.00", false),
    ]);
    const rates = parseIhgRates(data);
    expect(rates.every((r) => r.isCorporate === false)).toBe(true);
  });
});
