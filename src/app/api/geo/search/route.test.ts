import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/geo/search/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/observability", () => ({
  withObservability: (handler: unknown) => handler,
}));

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/auth";

const mockSearchPlaces = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("@/services/geo-lookup", () => ({
  searchPlaces: mockSearchPlaces,
}));

function authed() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "u1" },
    expires: "2099-01-01",
  } as never);
}

describe("GET /api/geo/search — isHotel flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it("passes isHotel=false when accommodationType param is omitted", async () => {
    const req = new NextRequest("http://localhost/api/geo/search?q=paris");
    await GET(req);
    expect(mockSearchPlaces).toHaveBeenCalledWith("paris", false);
  });

  it("passes isHotel=true when accommodationType=hotel", async () => {
    const req = new NextRequest("http://localhost/api/geo/search?q=paris&accommodationType=hotel");
    await GET(req);
    expect(mockSearchPlaces).toHaveBeenCalledWith("paris", true);
  });

  it("passes isHotel=false when accommodationType=apartment", async () => {
    const req = new NextRequest(
      "http://localhost/api/geo/search?q=paris&accommodationType=apartment"
    );
    await GET(req);
    expect(mockSearchPlaces).toHaveBeenCalledWith("paris", false);
  });

  it("returns empty array when query is shorter than 3 chars", async () => {
    const req = new NextRequest("http://localhost/api/geo/search?q=pa");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockSearchPlaces).not.toHaveBeenCalled();
  });
});
