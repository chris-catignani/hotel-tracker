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

const GOOGLE_RESPONSE = {
  places: [
    {
      displayName: { text: "Marriott Times Square" },
      addressComponents: [
        { longText: "New York", shortText: "New York", types: ["locality"] },
        { longText: "United States", shortText: "US", types: ["country"] },
      ],
      location: { latitude: 40.758, longitude: -73.9855 },
    },
  ],
};

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
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-api-key");
  });

  it("returns empty array for short queries", async () => {
    const result = await searchProperties("ab");
    expect(result).toEqual([]);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns cached results without calling Google", async () => {
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

  it("calls Google Places API on cache miss and caches the result", async () => {
    mockFindUnique.mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => GOOGLE_RESPONSE,
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await searchProperties("Marriott Times Square");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("places.googleapis.com"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Marriott Times Square"),
      })
    );
    expect(results).toHaveLength(1);
    expect(results[0].displayName).toBe("Marriott Times Square");
    expect(results[0].countryCode).toBe("US");
    expect(results[0].city).toBe("New York");
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("sends includedType=lodging to filter for hotels only", async () => {
    mockFindUnique.mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchProperties("Park Hyatt Kuala Lumpur");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.includedType).toBe("lodging");
    expect(body.languageCode).toBe("en");
  });

  it("returns country code as ISO alpha-2 directly from Google response", async () => {
    mockFindUnique.mockResolvedValue(null);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          places: [
            {
              displayName: { text: "Park Hyatt Kuala Lumpur" },
              addressComponents: [
                { longText: "Kuala Lumpur", shortText: "Kuala Lumpur", types: ["locality"] },
                { longText: "Malaysia", shortText: "MY", types: ["country"] },
              ],
              location: { latitude: 3.1419, longitude: 101.7008 },
            },
            {
              displayName: { text: "The Serangoon House" },
              addressComponents: [
                { longText: "Singapore", shortText: "Singapore", types: ["locality"] },
                { longText: "Singapore", shortText: "SG", types: ["country"] },
              ],
              location: { latitude: 1.3113, longitude: 103.8547 },
            },
          ],
        }),
      })
    );

    const results = await searchProperties("Park Hyatt");
    expect(results[0].countryCode).toBe("MY");
    expect(results[1].countryCode).toBe("SG");
  });

  it("returns empty array when Google API returns non-ok response", async () => {
    mockFindUnique.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden" })
    );

    const results = await searchProperties("Marriott Times Square");
    expect(results).toEqual([]);
  });

  it("returns empty array when GOOGLE_PLACES_API_KEY is not set", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    mockFindUnique.mockResolvedValue(null);

    const results = await searchProperties("Marriott Times Square");
    expect(results).toEqual([]);
  });

  it("returns empty array when Google returns no places", async () => {
    mockFindUnique.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    const results = await searchProperties("xyzzy hotel nonexistent");
    expect(results).toEqual([]);
  });

  it("falls back to postal_town when locality is missing", async () => {
    mockFindUnique.mockResolvedValue(null);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          places: [
            {
              displayName: { text: "Some Country Hotel" },
              addressComponents: [
                { longText: "Surrey", shortText: "Surrey", types: ["postal_town"] },
                { longText: "United Kingdom", shortText: "GB", types: ["country"] },
              ],
              location: { latitude: 51.3, longitude: -0.4 },
            },
          ],
        }),
      })
    );

    const results = await searchProperties("Some Country Hotel Surrey");
    expect(results[0].city).toBe("Surrey");
    expect(results[0].countryCode).toBe("GB");
  });
});
