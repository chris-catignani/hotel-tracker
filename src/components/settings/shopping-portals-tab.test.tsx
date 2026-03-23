import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShoppingPortalsTab } from "./shopping-portals-tab";

describe("ShoppingPortalsTab", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("renders correctly", async () => {
    vi.mocked(global.fetch).mockImplementation((input: string | Request | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes("/api/portals"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<ShoppingPortalsTab />);

    expect(screen.getByText("Shopping Portals")).toBeInTheDocument();
    expect(screen.getByTestId("add-portal-button")).toBeInTheDocument();
  });

  it("shows empty state message", async () => {
    vi.mocked(global.fetch).mockImplementation((input: string | Request | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes("/api/portals"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<ShoppingPortalsTab />);

    expect(await screen.findByTestId("portals-empty")).toBeInTheDocument();
    expect(screen.getByText(/No shopping portals/i)).toBeInTheDocument();
    expect(screen.getByText(/Add portals like Rakuten/i)).toBeInTheDocument();
  });

  it("shows fetched portals", async () => {
    const mockPortals = [{ id: "1", name: "Rakuten", rewardType: "cashback" }];
    vi.mocked(global.fetch).mockImplementation((input: string | Request | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes("/api/portals"))
        return Promise.resolve({ ok: true, json: async () => mockPortals } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<ShoppingPortalsTab />);

    const desktopView = await screen.findByTestId("portals-desktop");
    expect(within(desktopView).getByText("Rakuten")).toBeInTheDocument();
  });
});
