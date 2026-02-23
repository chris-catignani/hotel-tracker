import { render, screen, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShoppingPortalsTab } from "./shopping-portals-tab";

describe("ShoppingPortalsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders correctly", async () => {
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/portals"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<ShoppingPortalsTab />);
    });

    expect(screen.getByText("Shopping Portals")).toBeInTheDocument();
    expect(screen.getByTestId("add-portal-button")).toBeInTheDocument();
  });

  it("shows fetched portals", async () => {
    const mockPortals = [{ id: 1, name: "Rakuten", rewardType: "cashback" }];
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/portals"))
        return Promise.resolve({ ok: true, json: async () => mockPortals } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<ShoppingPortalsTab />);
    });

    const desktopView = screen.getByTestId("portals-desktop");
    expect(within(desktopView).getByText("Rakuten")).toBeInTheDocument();
  });
});
