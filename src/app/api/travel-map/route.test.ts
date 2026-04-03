import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/travel-map/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/observability", () => ({
  withObservability: (handler: unknown) => handler,
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/auth";

const mockBookingFindMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  default: {
    booking: { findMany: mockBookingFindMany },
  },
}));

function makeRequest() {
  return new NextRequest("http://localhost/api/travel-map", { method: "GET" });
}

describe("GET /api/travel-map", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingFindMany.mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns only bookings with coordinates, scoped to userId", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    await GET(makeRequest());
    expect(mockBookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          property: {
            latitude: { not: null },
            longitude: { not: null },
          },
        },
      })
    );
  });

  it("orders bookings by checkIn ascending", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    await GET(makeRequest());
    expect(mockBookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { checkIn: "asc" } })
    );
  });

  it("maps bookings to TravelStop shape", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01",
    } as never);
    mockBookingFindMany.mockResolvedValue([
      {
        id: "booking-1",
        checkIn: new Date("2024-06-12"),
        numNights: 3,
        property: {
          name: "Park Hyatt Paris",
          city: "Paris",
          countryCode: "FR",
          latitude: 48.8566,
          longitude: 2.3522,
        },
      },
    ]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      {
        id: "booking-1",
        propertyName: "Park Hyatt Paris",
        city: "Paris",
        countryCode: "FR",
        checkIn: "2024-06-12",
        numNights: 3,
        lat: 48.8566,
        lng: 2.3522,
      },
    ]);
  });

  it("does not return bookings from other users", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-2" },
      expires: "2099-01-01",
    } as never);
    await GET(makeRequest());
    expect(mockBookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-2" }),
      })
    );
    expect(mockBookingFindMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });
});
