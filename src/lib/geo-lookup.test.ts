import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeoResult } from "@/lib/types";

// Mock Prisma before importing geo-lookup
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

const NOMINATIM_RESPONSE = [
  {
    place_id: 1,
    display_name: "Marriott Times Square, West 45th Street, New York",
    lat: "40.7580",
    lon: "-73.9855",
    address: {
      hotel: "Marriott Times Square",
      city: "New York",
      country_code: "us",
    },
  },
];

const EXPECTED_RESULT: GeoResult = {
  displayName: "Marriott Times Square",
  city: "New York",
  countryCode: "US",
  latitude: 40.758,
  longitude: -73.9855,
};

describe("searchProperties", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUpsert.mockResolvedValue({} as never);
  });

  it("returns empty array for short queries", async () => {
    const result = await searchProperties("ab");
    expect(result).toEqual([]);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns cached results without calling Nominatim", async () => {
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

  it("calls Nominatim on cache miss and caches the result", async () => {
    mockFindUnique.mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => NOMINATIM_RESPONSE,
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await searchProperties("Marriott Times Square");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("Marriott+Times+Square"),
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.any(String) }),
      })
    );
    expect(results).toHaveLength(1);
    expect(results[0].displayName).toBe("Marriott Times Square");
    expect(results[0].countryCode).toBe("US");
    expect(results[0].city).toBe("New York");
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("returns empty array when Nominatim returns non-ok response", async () => {
    mockFindUnique.mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", mockFetch);

    const results = await searchProperties("Marriott Times Square");
    expect(results).toEqual([]);
  });

  it("uses town as city when city is missing from address", async () => {
    mockFindUnique.mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 2,
          display_name: "Some Hotel, Some Town",
          lat: "51.5",
          lon: "-0.1",
          address: { amenity: "Some Hotel", town: "Some Town", country_code: "gb" },
        },
      ],
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await searchProperties("Some Hotel");
    expect(results[0].city).toBe("Some Town");
    expect(results[0].countryCode).toBe("GB");
  });

  it("falls back to display_name first word when no hotel/amenity in address", async () => {
    mockFindUnique.mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 3,
          display_name: "Park Hyatt, Sydney, Australia",
          lat: "-33.8",
          lon: "151.2",
          address: { city: "Sydney", country_code: "au" },
        },
      ],
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await searchProperties("Park Hyatt Sydney");
    expect(results[0].displayName).toBe("Park Hyatt");
    expect(results[0].countryCode).toBe("AU");
  });
});
