import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeoResult } from "@/lib/types";

vi.mock("@/lib/prisma", () => ({
  default: {
    geoCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { searchProperties } from "@/lib/geo-lookup";

const mockFindUnique = vi.mocked(prisma.geoCache.findUnique);
const mockUpsert = vi.mocked(prisma.geoCache.upsert);

const HERE_RESPONSE = {
  items: [
    {
      title: "Marriott Times Square",
      address: {
        city: "New York",
        countryCode: "USA", // HERE returns alpha-3
      },
      position: { lat: 40.758, lng: -73.9855 },
    },
  ],
};

const EXPECTED_RESULT: GeoResult = {
  displayName: "Marriott Times Square",
  city: "New York",
  countryCode: "US", // converted to alpha-2
  latitude: 40.758,
  longitude: -73.9855,
};

describe("searchProperties", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUpsert.mockResolvedValue({} as never);
    vi.stubEnv("HERE_API_KEY", "test-api-key");
  });

  it("returns empty array for short queries", async () => {
    const result = await searchProperties("ab");
    expect(result).toEqual([]);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns cached results without calling HERE", async () => {
    mockFindUnique.mockResolvedValue({
      id: 1,
      queryKey: "marriott times",
      results: [EXPECTED_RESULT],
      resolvedAt: new Date(),
    } as never);

    const results = await searchProperties("Marriott Times");
    expect(results).toEqual([EXPECTED_RESULT]);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { queryKey: "marriott times" } });
  });

  it("calls HERE API on cache miss and caches the result", async () => {
    mockFindUnique.mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => HERE_RESPONSE,
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await searchProperties("Marriott Times Square");

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("geocode.search.hereapi.com"));
    expect(results).toHaveLength(1);
    expect(results[0].displayName).toBe("Marriott Times Square");
    expect(results[0].countryCode).toBe("US");
    expect(results[0].city).toBe("New York");
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("converts HERE alpha-3 country codes to alpha-2", async () => {
    mockFindUnique.mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            title: "Park Hyatt Kuala Lumpur",
            address: { city: "Kuala Lumpur", countryCode: "MYS" },
            position: { lat: 3.1419, lng: 101.7008 },
          },
          {
            title: "The Serangoon House",
            address: { city: "Singapore", countryCode: "SGP" },
            position: { lat: 1.3113, lng: 103.8547 },
          },
          {
            title: "ibis Styles Ambassador",
            address: { city: "Incheon", countryCode: "KOR" },
            position: { lat: 37.481, lng: 126.42 },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await searchProperties("Park Hyatt");
    expect(results[0].countryCode).toBe("MY");
    expect(results[1].countryCode).toBe("SG");
    expect(results[2].countryCode).toBe("KR");
  });

  it("returns empty array when HERE API returns non-ok response", async () => {
    mockFindUnique.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized" })
    );

    const results = await searchProperties("Marriott Times Square");
    expect(results).toEqual([]);
  });

  it("returns empty array when HERE_API_KEY is not set", async () => {
    vi.stubEnv("HERE_API_KEY", "");
    mockFindUnique.mockResolvedValue(null);

    const results = await searchProperties("Marriott Times Square");
    expect(results).toEqual([]);
  });

  it("falls back to county when city is missing from address", async () => {
    mockFindUnique.mockResolvedValue(null);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              title: "Some Resort",
              address: { county: "Maui County", countryCode: "USA" },
              position: { lat: 20.7, lng: -156.4 },
            },
          ],
        }),
      })
    );

    const results = await searchProperties("Some Resort Maui");
    expect(results[0].city).toBe("Maui County");
    expect(results[0].countryCode).toBe("US");
  });
});
