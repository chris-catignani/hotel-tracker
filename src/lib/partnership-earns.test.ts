import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolvePartnershipEarns } from "./partnership-earns";

// Mock getOrFetchHistoricalRate so tests don't hit the external API or DB
vi.mock("./exchange-rate", () => ({
  getOrFetchHistoricalRate: vi.fn(),
}));

import { getOrFetchHistoricalRate } from "./exchange-rate";

const ACCOR_ID = "cv53wjloc78ambkei5wlnsvfn";
const ACCOR_QANTAS_EARN = {
  id: "cpartnership0accorqantas1",
  name: "Accor–Qantas",
  hotelChainId: ACCOR_ID,
  earnRate: 3,
  earnCurrency: "AUD",
  countryCodes: ["AU", "SG", "NZ", "JP"],
  pointType: { name: "Qantas Points", category: "airline", usdCentsPerPoint: 0.012 },
};

const APAC_BOOKING = {
  hotelChainId: ACCOR_ID,
  pretaxCost: 100,
  exchangeRate: 1, // USD booking
  property: { countryCode: "AU" },
  checkIn: "2025-01-10",
};

describe("resolvePartnershipEarns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates Qantas miles for Accor APAC booking", async () => {
    // 1 AUD = 0.63 USD, so pretaxCostUSD=100, pretaxAUD=100/0.63≈158.73, miles=158.73*3≈476.19, value=476.19*0.012≈$5.71
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValue(0.63);

    const results = await resolvePartnershipEarns(APAC_BOOKING, [ACCOR_QANTAS_EARN]);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Accor–Qantas");
    const pretaxAUD = 100 / 0.63;
    const expected = pretaxAUD * 3 * 0.012;
    expect(results[0].earnedValue).toBeCloseTo(expected);
  });

  it("returns empty array when no enabled earns provided", async () => {
    const results = await resolvePartnershipEarns(APAC_BOOKING, []);
    expect(results).toEqual([]);
    expect(getOrFetchHistoricalRate).not.toHaveBeenCalled();
  });

  it("filters out earns for non-matching hotel chain", async () => {
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValue(0.63);

    const results = await resolvePartnershipEarns(
      { ...APAC_BOOKING, hotelChainId: "cx123notaccor" },
      [ACCOR_QANTAS_EARN]
    );

    expect(results).toEqual([]);
  });

  it("filters out earns for non-APAC country", async () => {
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValue(0.63);

    const results = await resolvePartnershipEarns(
      { ...APAC_BOOKING, property: { countryCode: "US" } },
      [ACCOR_QANTAS_EARN]
    );

    expect(results).toEqual([]);
  });

  it("filters out earns when property countryCode is null", async () => {
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValue(0.63);

    const results = await resolvePartnershipEarns(
      { ...APAC_BOOKING, property: { countryCode: null } },
      [ACCOR_QANTAS_EARN]
    );

    expect(results).toEqual([]);
  });

  it("correctly converts non-USD booking to earn currency", async () => {
    // AUD booking: pretaxCost=200 AUD, exchangeRate=0.63 (1 AUD = 0.63 USD)
    // pretaxCostUSD = 200 * 0.63 = 126
    // pretaxCostAUD = 126 / 0.63 = 200
    // miles = 200 * 3 = 600, value = 600 * 0.012 = $7.20
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValue(0.63);

    const results = await resolvePartnershipEarns(
      { ...APAC_BOOKING, pretaxCost: 200, exchangeRate: 0.63 },
      [ACCOR_QANTAS_EARN]
    );

    expect(results).toHaveLength(1);
    expect(results[0].earnedValue).toBeCloseTo(7.2);
  });

  it("returns empty when earn currency rate is unavailable (null)", async () => {
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValue(null);

    const results = await resolvePartnershipEarns(APAC_BOOKING, [ACCOR_QANTAS_EARN]);

    expect(results).toEqual([]);
  });

  it("applies earn with no hotel chain restriction to any chain", async () => {
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValue(0.63);

    const unrestricted = {
      ...ACCOR_QANTAS_EARN,
      hotelChainId: null,
      countryCodes: [], // no country restriction either
    };

    const results = await resolvePartnershipEarns(
      { ...APAC_BOOKING, hotelChainId: "cx123someotherchain" },
      [unrestricted]
    );

    expect(results).toHaveLength(1);
  });

  it("includes a CalculationDetail in the result", async () => {
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValue(0.63);

    const results = await resolvePartnershipEarns(APAC_BOOKING, [ACCOR_QANTAS_EARN]);

    expect(results[0].calc).toBeDefined();
    expect(results[0].calc.label).toBe("Accor–Qantas");
    expect(results[0].calc.groups).toHaveLength(1);
    expect(results[0].calc.groups[0].segments[0].formula).toContain("AUD");
  });
});
