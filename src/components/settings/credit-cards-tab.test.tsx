import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreditCardsTab } from "./credit-cards-tab";

describe("CreditCardsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders correctly", async () => {
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/credit-cards"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<CreditCardsTab />);
    });

    expect(screen.getByText("Credit Cards")).toBeInTheDocument();
    expect(screen.getByTestId("add-credit-card-button")).toBeInTheDocument();
  });

  it("shows fetched credit cards", async () => {
    const mockCards = [{ id: 1, name: "Amex Platinum", rewardType: "points", rewardRate: 5 }];
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/credit-cards"))
        return Promise.resolve({ ok: true, json: async () => mockCards } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<CreditCardsTab />);
    });

    expect(screen.getAllByText("Amex Platinum")[0]).toBeInTheDocument();
  });
});
