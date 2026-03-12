import { describe, it, expect } from "vitest";
import { HyattFetcher } from "./hyatt";
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

describe("HyattFetcher.parseRates (private logic)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetcher = new HyattFetcher() as any;

  it("returns parsed cash and award prices from API response", () => {
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

    const result = fetcher.parseRates(data);

    expect(result).not.toBeNull();
    expect(result?.cashPrice).toBe(280);
    expect(result?.cashCurrency).toBe("USD");
    expect(result?.awardPrice).toBe(18000);
  });

  it("prioritizes refundable rates over cheaper non-refundable ones", () => {
    const data = {
      roomRates: {
        "room-1": {
          ratePlans: [
            { id: "AP", rate: 200, penaltyCode: "CNR" }, // Non-refundable (CNR)
            { id: "STD", rate: 250, penaltyCode: "48H" }, // Refundable
          ],
        },
      },
    };

    const result = fetcher.parseRates(data);
    expect(result?.cashPrice).toBe(250); // Should pick the refundable one even if more expensive
  });

  it("returns null prices when roomRates is empty", () => {
    const result = fetcher.parseRates({ roomRates: {} });
    expect(result).toBeNull();
  });
});
