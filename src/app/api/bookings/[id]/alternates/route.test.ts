import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth-utils", () => ({
  getAuthenticatedUserId: vi.fn(),
}));
vi.mock("@/services/alternate-candidates", () => ({
  findAlternateCandidates: vi.fn(),
}));

import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { findAlternateCandidates } from "@/services/alternate-candidates";
import { GET } from "./route";

describe("GET /api/bookings/[id]/alternates", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    (getAuthenticatedUserId as ReturnType<typeof vi.fn>).mockResolvedValue(
      new NextResponse(null, { status: 401 })
    );
    const req = new NextRequest("http://localhost/api/bookings/b1/alternates?hotelChainIds=c1");
    const res = await GET(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(401);
  });

  it("parses query params and delegates to the service", async () => {
    (getAuthenticatedUserId as ReturnType<typeof vi.fn>).mockResolvedValue("u1");
    (findAlternateCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([
      { propertyId: "p1", name: "X", distanceMiles: 2.3 },
    ]);
    const req = new NextRequest(
      "http://localhost/api/bookings/b1/alternates?hotelChainIds=c1,c2&radiusMiles=25"
    );
    const res = await GET(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(200);
    expect(findAlternateCandidates).toHaveBeenCalledWith("u1", "b1", {
      hotelChainIds: ["c1", "c2"],
      radiusMiles: 25,
    });
    const body = await res.json();
    expect(body).toEqual([{ propertyId: "p1", name: "X", distanceMiles: 2.3 }]);
  });

  it("defaults radiusMiles to 10 when omitted", async () => {
    (getAuthenticatedUserId as ReturnType<typeof vi.fn>).mockResolvedValue("u1");
    (findAlternateCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/bookings/b1/alternates?hotelChainIds=c1");
    await GET(req, { params: Promise.resolve({ id: "b1" }) });
    expect(findAlternateCandidates).toHaveBeenCalledWith(
      "u1",
      "b1",
      expect.objectContaining({ radiusMiles: 10 })
    );
  });

  it("passes empty hotelChainIds when param is omitted (all chains)", async () => {
    (getAuthenticatedUserId as ReturnType<typeof vi.fn>).mockResolvedValue("u1");
    (findAlternateCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/bookings/b1/alternates");
    await GET(req, { params: Promise.resolve({ id: "b1" }) });
    expect(findAlternateCandidates).toHaveBeenCalledWith(
      "u1",
      "b1",
      expect.objectContaining({ hotelChainIds: [] })
    );
  });
});
