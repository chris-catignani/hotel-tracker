import { render, screen, act, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreditCardsTab } from "./credit-cards-tab";

const mockCards = [
  {
    id: 1,
    name: "Amex Platinum",
    rewardType: "points",
    rewardRate: 5,
    pointTypeId: null,
    pointType: null,
    isDeleted: false,
  },
  {
    id: 2,
    name: "Chase Sapphire",
    rewardType: "points",
    rewardRate: 3,
    pointTypeId: null,
    pointType: null,
    isDeleted: false,
  },
];

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
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/credit-cards"))
        return Promise.resolve({ ok: true, json: async () => [mockCards[0]] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<CreditCardsTab />);
    });

    // Check that it's present in both mobile and desktop views
    expect(screen.getByTestId("credit-card-card-name")).toHaveTextContent("Amex Platinum");
    expect(screen.getByTestId("credit-card-table-name")).toHaveTextContent("Amex Platinum");
  });

  it("shows a Delete button for each credit card", async () => {
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

    // Each card in the mobile/desktop view has a delete button
    const deleteButtons = screen.getAllByTestId("delete-credit-card-button");
    // 2 cards × 2 views = 4 buttons total
    expect(deleteButtons.length).toBe(4);
  });

  it("opens confirmation dialog when Delete is clicked", async () => {
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/credit-cards"))
        return Promise.resolve({ ok: true, json: async () => [mockCards[0]] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<CreditCardsTab />);
    });

    // Click first delete button (mobile view)
    const deleteButtons = screen.getAllByTestId("delete-credit-card-button");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    expect(screen.getByText("Delete Credit Card?")).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete "Amex Platinum"/)).toBeInTheDocument();
  });

  it("calls DELETE API and refreshes list after confirming deletion", async () => {
    const fetchMock = vi
      .mocked(global.fetch)
      .mockImplementation((url: string, options?: RequestInit) => {
        if (
          url === "/api/credit-cards" &&
          (!options || options.method === undefined || options.method === "GET")
        )
          return Promise.resolve({ ok: true, json: async () => [mockCards[0]] } as Response);
        if (url.includes("/api/point-types"))
          return Promise.resolve({ ok: true, json: async () => [] } as Response);
        if (url === "/api/credit-cards/1" && options?.method === "DELETE")
          return Promise.resolve({ ok: true } as Response);
        return Promise.reject(new Error(`Unknown: ${url}`));
      });

    await act(async () => {
      render(<CreditCardsTab />);
    });

    // Open delete dialog
    const deleteButtons = screen.getAllByTestId("delete-credit-card-button");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    // Confirm deletion
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-dialog-confirm-button"));
    });

    // Verify DELETE was called
    expect(fetchMock).toHaveBeenCalledWith("/api/credit-cards/1", { method: "DELETE" });
    // Verify list was refreshed (fetch called again for credit cards)
    const cardFetchCalls = fetchMock.mock.calls.filter(
      ([url, opts]) =>
        url === "/api/credit-cards" && (!opts || !opts.method || opts.method === "GET")
    );
    expect(cardFetchCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows error if deletion fails", async () => {
    vi.mocked(global.fetch).mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/credit-cards" && (!options || !options.method || options.method === "GET"))
        return Promise.resolve({ ok: true, json: async () => [mockCards[0]] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("/api/credit-cards/1") && options?.method === "DELETE")
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({}),
        } as Response);
      return Promise.reject(new Error(`Unknown: ${url}`));
    });

    await act(async () => {
      render(<CreditCardsTab />);
    });

    const deleteButtons = screen.getAllByTestId("delete-credit-card-button");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-dialog-confirm-button"));
    });

    expect(screen.getByText(/Failed to delete credit card/i)).toBeInTheDocument();
  });

  it("does not call DELETE if dialog is cancelled", async () => {
    const fetchMock = vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/credit-cards"))
        return Promise.resolve({ ok: true, json: async () => [mockCards[0]] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<CreditCardsTab />);
    });

    const deleteButtons = screen.getAllByTestId("delete-credit-card-button");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    // Cancel the dialog
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const deleteCalls = fetchMock.mock.calls.filter(([, opts]) => opts?.method === "DELETE");
    expect(deleteCalls.length).toBe(0);
  });

  it("shows desktop table delete button", async () => {
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes("/api/credit-cards"))
        return Promise.resolve({ ok: true, json: async () => [mockCards[0]] } as Response);
      if (url.includes("/api/point-types"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    await act(async () => {
      render(<CreditCardsTab />);
    });

    const desktopView = screen.getByTestId("credit-cards-desktop");
    const deleteBtn = within(desktopView).getByTestId("delete-credit-card-button");
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn).toHaveTextContent("Delete");
  });
});
