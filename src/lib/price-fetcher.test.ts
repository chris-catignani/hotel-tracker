import { describe, it, expect, vi } from "vitest";
import { selectFetcher, type PriceFetcher, type FetchableProperty } from "./price-fetcher";

const makeProperty = (overrides: Partial<FetchableProperty> = {}): FetchableProperty => ({
  id: "prop-1",
  name: "Test Hotel",
  hotelChainId: "hyatt-id",
  chainPropertyId: "chiph",
  ...overrides,
});

const makeFetcher = (canFetchResult: boolean): PriceFetcher => ({
  canFetch: vi.fn().mockReturnValue(canFetchResult),
  fetchPrice: vi.fn().mockResolvedValue({
    cashPrice: 250,
    cashCurrency: "USD",
    awardPrice: 15000,
    source: "test",
  }),
});

describe("selectFetcher", () => {
  it("returns the first fetcher that can handle the property", () => {
    const f1 = makeFetcher(false);
    const f2 = makeFetcher(true);
    const f3 = makeFetcher(true);
    const result = selectFetcher(makeProperty(), [f1, f2, f3]);
    expect(result).toBe(f2);
    expect(f1.canFetch).toHaveBeenCalled();
    expect(f2.canFetch).toHaveBeenCalled();
    expect(f3.canFetch).not.toHaveBeenCalled();
  });

  it("returns null if no fetcher can handle the property", () => {
    const f1 = makeFetcher(false);
    const f2 = makeFetcher(false);
    expect(selectFetcher(makeProperty(), [f1, f2])).toBeNull();
  });

  it("returns null for empty fetcher list", () => {
    expect(selectFetcher(makeProperty(), [])).toBeNull();
  });
});
