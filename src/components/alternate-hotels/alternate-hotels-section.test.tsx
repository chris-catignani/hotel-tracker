import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AlternateHotelsSection } from "./alternate-hotels-section";

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));
import { apiFetch } from "@/lib/api-fetch";

const MOCK_CHAINS = [
  { id: "chain-1", name: "GHA Discovery" },
  { id: "chain-2", name: "IHG" },
];

const MOCK_CANDIDATES = [
  {
    propertyId: "p1",
    name: "Alternate A",
    hotelChainName: "GHA Discovery",
    distanceMiles: 3.2,
    hotelChainId: "chain-1",
    chainCategories: [],
    isWatched: false,
    priceWatchId: null,
    cashThreshold: null,
    awardThreshold: null,
  },
];

describe("AlternateHotelsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === "/api/hotel-chains") return Promise.resolve({ ok: true, data: MOCK_CHAINS });
      return Promise.resolve({ ok: true, data: MOCK_CANDIDATES });
    });
  });

  it("is collapsed by default, expanding loads chains and candidates", async () => {
    render(<AlternateHotelsSection bookingId="b1" anchorHasGps={true} currency="USD" />);
    expect(screen.queryByText("Alternate A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("alternate-hotels-toggle"));

    await waitFor(() => expect(screen.getByText("Alternate A")).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/api/bookings/b1/alternates?"));
  });

  it("shows empty-state when the API returns no candidates", async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === "/api/hotel-chains") return Promise.resolve({ ok: true, data: MOCK_CHAINS });
      return Promise.resolve({ ok: true, data: [] });
    });
    render(<AlternateHotelsSection bookingId="b1" anchorHasGps={true} currency="USD" />);
    fireEvent.click(screen.getByTestId("alternate-hotels-toggle"));
    await waitFor(() => expect(screen.getByTestId("alternate-hotels-empty")).toBeInTheDocument());
  });

  it("omits radiusMiles from request when anchor has no GPS", async () => {
    render(<AlternateHotelsSection bookingId="b1" anchorHasGps={false} currency="USD" />);
    fireEvent.click(screen.getByTestId("alternate-hotels-toggle"));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/api/bookings/b1/alternates"))
    );
    const url = (apiFetch as ReturnType<typeof vi.fn>).mock.calls.find((args: unknown[]) =>
      (args[0] as string).includes("/alternates")
    )?.[0] as string;
    expect(url).not.toContain("radiusMiles");
  });
});
