import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HotelChainsTab } from "./hotel-chains-tab";

describe("HotelChainsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders correctly", async () => {
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/hotel-chains"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<HotelChainsTab />);
    });

    expect(screen.getByText("Hotel Chains")).toBeInTheDocument();
    expect(screen.getByTestId("add-hotel-chain-button")).toBeInTheDocument();
  });

  it("shows fetched hotel chains", async () => {
    const mockChains = [
      {
        id: 1,
        name: "Marriott",
        loyaltyProgram: "Bonvoy",
        basePointRate: 10,
        hotelChainSubBrands: [],
      },
    ];
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/hotel-chains"))
        return Promise.resolve({ ok: true, json: async () => mockChains } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<HotelChainsTab />);
    });

    expect(screen.getByText("Marriott")).toBeInTheDocument();
  });
});
