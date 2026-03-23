import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreditCardsTab } from "./credit-cards-tab";

const mockCards = [
  {
    id: "1",
    name: "Amex Platinum",
    rewardType: "points",
    rewardRate: 5,
    pointTypeId: null,
    pointType: null,
    rewardRules: [],
    isDeleted: false,
  },
  {
    id: "2",
    name: "Chase Sapphire",
    rewardType: "points",
    rewardRate: 3,
    pointTypeId: null,
    pointType: null,
    rewardRules: [],
    isDeleted: false,
  },
];

// CreditCardAccordionItem renders sub-components that fetch data — mock them
vi.mock("./credit-card-accordion-item", () => ({
  CreditCardAccordionItem: ({
    card,
    onRefetch,
  }: {
    card: { id: string; name: string };
    onRefetch: () => void;
  }) => (
    <div data-testid="credit-card-accordion">
      <span data-testid="credit-card-card-name">{card.name}</span>
      <button data-testid="delete-credit-card-button" onClick={onRefetch}>
        Delete
      </button>
    </div>
  ),
}));

describe("CreditCardsTab", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((input: string | Request | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes("/api/credit-cards"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/hotel-chains"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/ota-agencies"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/card-benefits"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });
  });

  it("renders correctly", async () => {
    render(<CreditCardsTab />);

    expect(screen.getByText("Credit Cards")).toBeInTheDocument();
    expect(screen.getByTestId("add-credit-card-button")).toBeInTheDocument();
  });

  it("shows empty state message", async () => {
    render(<CreditCardsTab />);

    expect(await screen.findByTestId("credit-cards-empty")).toBeInTheDocument();
    expect(screen.getByText(/No credit cards/i)).toBeInTheDocument();
  });

  it("shows fetched credit cards", async () => {
    vi.mocked(global.fetch).mockImplementation((input: string | Request | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes("/api/credit-cards"))
        return Promise.resolve({ ok: true, json: async () => [mockCards[0]] } as Response);
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<CreditCardsTab />);

    expect(await screen.findByTestId("credit-card-card-name")).toHaveTextContent("Amex Platinum");
  });

  it("shows a Delete button for each credit card", async () => {
    vi.mocked(global.fetch).mockImplementation((input: string | Request | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes("/api/credit-cards"))
        return Promise.resolve({ ok: true, json: async () => mockCards } as Response);
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });

    render(<CreditCardsTab />);

    const deleteButtons = await screen.findAllByTestId("delete-credit-card-button");
    expect(deleteButtons.length).toBe(2);
  });

  it("opens add dialog when Add Credit Card is clicked", async () => {
    const user = userEvent.setup();

    render(<CreditCardsTab />);

    await user.click(screen.getByTestId("add-credit-card-button"));
    expect(screen.getByText(/Add a credit card\. You can configure/i)).toBeInTheDocument();
  });
});
