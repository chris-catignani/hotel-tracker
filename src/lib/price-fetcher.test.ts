import { describe, it, expect, vi } from "vitest";
import {
  selectFetcher,
  lowestRefundableAward,
  type PriceFetcher,
  type FetchableProperty,
  type RoomRate,
} from "./price-fetcher";

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

const makeRate = (awardPrice: number | null, isRefundable: RoomRate["isRefundable"]): RoomRate => ({
  roomId: "r1",
  roomName: "Standard Room",
  ratePlanCode: "RATE",
  ratePlanName: "Rate",
  cashPrice: 100,
  cashCurrency: "USD",
  awardPrice,
  isRefundable,
  isCorporate: false,
});

describe("lowestRefundableAward", () => {
  it("returns null when no rates have award prices", () => {
    expect(lowestRefundableAward([makeRate(null, "REFUNDABLE")])).toBeNull();
  });

  it("returns the lowest award price among REFUNDABLE rates", () => {
    const rates = [makeRate(20000, "REFUNDABLE"), makeRate(15000, "REFUNDABLE")];
    expect(lowestRefundableAward(rates)).toBe(15000);
  });

  it("returns the lowest award price among UNKNOWN rates (e.g. GHA)", () => {
    const rates = [makeRate(20000, "UNKNOWN"), makeRate(15000, "UNKNOWN")];
    expect(lowestRefundableAward(rates)).toBe(15000);
  });

  it("prefers refundable/unknown over non-refundable when both exist", () => {
    // NON_REFUNDABLE is cheaper but should be skipped in favour of REFUNDABLE
    const rates = [makeRate(10000, "NON_REFUNDABLE"), makeRate(16000, "REFUNDABLE")];
    expect(lowestRefundableAward(rates)).toBe(16000);
  });

  it("falls back to lowest non-refundable when no refundable/unknown award rates exist", () => {
    // e.g. Hyatt award nights are typically NON_REFUNDABLE
    const rates = [makeRate(25000, "NON_REFUNDABLE"), makeRate(12000, "NON_REFUNDABLE")];
    expect(lowestRefundableAward(rates)).toBe(12000);
  });
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
