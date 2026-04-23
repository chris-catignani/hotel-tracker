import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/observability", () => ({
  withObservability: (handler: unknown) => handler,
}));

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/auth";

const mockSearchLocalProperties = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("@/services/geo-lookup", () => ({
  searchLocalProperties: mockSearchLocalProperties,
}));

function authed() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "u1" },
    expires: "2099-01-01",
  } as never);
}

import { GET } from "@/app/api/geo/search/local/route";

describe("GET /api/geo/search/local", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it("returns empty array when query is shorter than 3 chars", async () => {
    const req = new NextRequest("http://localhost/api/geo/search/local?q=ab");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockSearchLocalProperties).not.toHaveBeenCalled();
  });

  it("calls searchLocalProperties with query only when hotelChainId is absent", async () => {
    const req = new NextRequest("http://localhost/api/geo/search/local?q=hyatt+chicago");
    await GET(req);
    expect(mockSearchLocalProperties).toHaveBeenCalledWith("hyatt chicago", undefined);
  });

  it("passes hotelChainId to searchLocalProperties when provided", async () => {
    const req = new NextRequest(
      "http://localhost/api/geo/search/local?q=hyatt+chicago&hotelChainId=hyatt-id"
    );
    await GET(req);
    expect(mockSearchLocalProperties).toHaveBeenCalledWith("hyatt chicago", "hyatt-id");
  });

  it("returns results from searchLocalProperties as JSON", async () => {
    const fakeResult = {
      source: "local",
      propertyId: "prop-1",
      hotelChainId: "hyatt-id",
      displayName: "Hyatt Regency Chicago",
      city: "Chicago",
      countryCode: "US",
      address: null,
      latitude: 41.88,
      longitude: -87.62,
    };
    mockSearchLocalProperties.mockResolvedValue([fakeResult]);

    const req = new NextRequest("http://localhost/api/geo/search/local?q=hyatt+chicago");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([fakeResult]);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const req = new NextRequest("http://localhost/api/geo/search/local?q=hyatt");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
