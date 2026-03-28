import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/bookings/[id]/route";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/auth";

const mockBookingFindFirst = vi.hoisted(() => vi.fn());
const mockBookingUpdate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      findFirst: mockBookingFindFirst,
      update: mockBookingUpdate,
    },
  },
}));

function makeRequest(body: unknown, id = "booking-1") {
  return new NextRequest(`http://localhost/api/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "booking-1") {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/bookings/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await PATCH(makeRequest({ needsReview: false }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when booking belongs to a different user", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    mockBookingFindFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ needsReview: false }), makeParams());
    expect(res.status).toBe(404);
    expect(mockBookingUpdate).not.toHaveBeenCalled();
  });

  it("sets needsReview: false and returns 200", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    mockBookingFindFirst.mockResolvedValue({ id: "booking-1" });
    mockBookingUpdate.mockResolvedValue({ id: "booking-1", needsReview: false });
    const res = await PATCH(makeRequest({ needsReview: false }), makeParams());
    expect(res.status).toBe(200);
    expect(mockBookingUpdate).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { needsReview: false },
    });
    const body = await res.json();
    expect(body.needsReview).toBe(false);
  });
});
