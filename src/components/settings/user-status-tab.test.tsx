import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserStatusTab } from "./user-status-tab";

describe("UserStatusTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders empty state correctly", async () => {
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/user-statuses"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/hotel-chains"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<UserStatusTab />);
    });

    expect(screen.getByText(/My Elite Status/i)).toBeInTheDocument();
    expect(screen.getByTestId("user-status-table")).toBeInTheDocument();
  });

  it("renders rows for hotel chains", async () => {
    const mockChains = [{ id: 1, name: "Marriott", eliteStatuses: [] }];
    const mockStatuses = [{ hotelChainId: 1, eliteStatusId: null }];

    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/user-statuses"))
        return Promise.resolve({ ok: true, json: async () => mockStatuses } as Response);
      if (url.includes("/api/hotel-chains"))
        return Promise.resolve({ ok: true, json: async () => mockChains } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<UserStatusTab />);
    });

    expect(screen.getByText("Marriott")).toBeInTheDocument();
  });
});
