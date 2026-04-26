import { describe, it, expect, vi } from "vitest";
import { fetchAccorProperties } from "./property-fetcher";

function makePageResponse(features: object[], page: number, pageCount: number) {
  return {
    type: "FeatureCollection",
    features,
    pagination: { page, pageCount },
  };
}

function makeFeature(storeId: string) {
  return { type: "Feature", properties: { store_id: storeId }, geometry: null };
}

describe("fetchAccorProperties", () => {
  it("returns all features from a single page", async () => {
    const mockFetchPage = vi
      .fn()
      .mockResolvedValue(makePageResponse([makeFeature("0001"), makeFeature("0002")], 1, 1));

    const result = await fetchAccorProperties({ fetchPage: mockFetchPage, requestDelayMs: 0 });

    expect(mockFetchPage).toHaveBeenCalledTimes(1);
    expect(mockFetchPage).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(2);
  });

  it("paginates through multiple pages sequentially", async () => {
    const mockFetchPage = vi
      .fn()
      .mockResolvedValueOnce(makePageResponse([makeFeature("0001"), makeFeature("0002")], 1, 3))
      .mockResolvedValueOnce(makePageResponse([makeFeature("0003"), makeFeature("0004")], 2, 3))
      .mockResolvedValueOnce(makePageResponse([makeFeature("0005")], 3, 3));

    const result = await fetchAccorProperties({ fetchPage: mockFetchPage, requestDelayMs: 0 });

    expect(mockFetchPage).toHaveBeenCalledTimes(3);
    expect(mockFetchPage).toHaveBeenNthCalledWith(1, 1);
    expect(mockFetchPage).toHaveBeenNthCalledWith(2, 2);
    expect(mockFetchPage).toHaveBeenNthCalledWith(3, 3);
    expect(result).toHaveLength(5);
  });

  it("respects limit — stops after collecting enough features", async () => {
    const mockFetchPage = vi
      .fn()
      .mockResolvedValue(
        makePageResponse([makeFeature("0001"), makeFeature("0002"), makeFeature("0003")], 1, 5)
      );

    const result = await fetchAccorProperties({
      fetchPage: mockFetchPage,
      requestDelayMs: 0,
      limit: 2,
    });

    expect(result).toHaveLength(2);
    expect(mockFetchPage).toHaveBeenCalledTimes(1);
  });

  it("throws when fetchPage rejects", async () => {
    const mockFetchPage = vi.fn().mockRejectedValue(new Error("Woosmap HTTP 503 on page 1"));

    await expect(
      fetchAccorProperties({ fetchPage: mockFetchPage, requestDelayMs: 0 })
    ).rejects.toThrow("Woosmap HTTP 503 on page 1");
  });

  it("handles empty features array gracefully", async () => {
    const mockFetchPage = vi.fn().mockResolvedValue(makePageResponse([], 1, 1));

    const result = await fetchAccorProperties({ fetchPage: mockFetchPage, requestDelayMs: 0 });
    expect(result).toHaveLength(0);
  });
});
