import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyCardsTab } from "./my-cards-tab";
import { UserCreditCard } from "@/lib/types";

const mockCard: UserCreditCard = {
  id: "ucc-1",
  userId: "user-1",
  creditCardId: "cc-1",
  creditCard: {
    id: "cc-1",
    name: "Chase Sapphire Preferred",
    rewardType: "points",
    rewardRate: 0.02,
    pointTypeId: null,
    pointType: null,
    isDeleted: false,
    rewardRules: [],
  },
  nickname: null,
  openedDate: null,
  closedDate: null,
  createdAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    if (String(url).includes("/api/user-credit-cards")) {
      return { ok: true, json: async () => [mockCard] } as Response;
    }
    if (String(url).includes("/api/credit-cards")) {
      return {
        ok: true,
        json: async () => [{ id: "cc-1", name: "Chase Sapphire Preferred" }],
      } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
});

describe("MyCardsTab", () => {
  it("renders the card list", async () => {
    render(<MyCardsTab />);
    await waitFor(() => {
      expect(screen.getAllByTestId("my-card-name")[0]).toHaveTextContent(
        "Chase Sapphire Preferred"
      );
    });
  });

  it("shows empty state when no cards", async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/api/user-credit-cards")) {
        return { ok: true, json: async () => [] } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    });
    render(<MyCardsTab />);
    await waitFor(() => {
      expect(screen.getByTestId("my-cards-empty")).toBeInTheDocument();
    });
  });

  it("opens add dialog when Add Card button is clicked", async () => {
    const user = userEvent.setup();
    render(<MyCardsTab />);
    await waitFor(() => screen.getByTestId("add-my-card-button"));
    await user.click(screen.getByTestId("add-my-card-button"));
    expect(screen.getByText("Add Card Instance")).toBeInTheDocument();
  });

  it("shows active badge for active cards", async () => {
    render(<MyCardsTab />);
    await waitFor(() => {
      expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    });
  });

  it("shows nickname in card label when set", async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/api/user-credit-cards")) {
        return {
          ok: true,
          json: async () => [{ ...mockCard, nickname: "#1" }],
        } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    });
    render(<MyCardsTab />);
    await waitFor(() => {
      // Mobile card shows combined label with nickname
      const cards = screen.queryAllByTestId("my-card-card");
      expect(cards.length).toBeGreaterThan(0);
      expect(screen.getAllByTestId("my-card-name")[0]).toHaveTextContent(
        "Chase Sapphire Preferred (#1)"
      );
    });
  });
});
