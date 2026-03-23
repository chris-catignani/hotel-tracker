import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserStatusTab } from "./user-status-tab";

const PARTNERSHIP_ID = "cpartnership0accorqantas1";
const MOCK_PARTNERSHIP: MockPartnership = {
  id: PARTNERSHIP_ID,
  name: "Accor–Qantas",
  isEnabled: false,
  earnRate: 3,
  earnCurrency: "AUD",
  pointType: { name: "Qantas Points", category: "airline", usdCentsPerPoint: 0.012 },
};

type MockPartnership = {
  id: string;
  name: string;
  isEnabled: boolean;
  earnRate: number;
  earnCurrency: string;
  pointType: { name: string; category: string; usdCentsPerPoint: number };
};

function mockFetch(partnerships: MockPartnership[] = []) {
  vi.mocked(global.fetch).mockImplementation((input: string | Request | URL) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes("/api/user-statuses"))
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    if (url.includes("/api/hotel-chains"))
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    if (url.includes("/api/partnership-earns"))
      return Promise.resolve({ ok: true, json: async () => partnerships } as Response);
    return Promise.reject(new Error("Unknown URL"));
  });
}

describe("UserStatusTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders empty state correctly", async () => {
    mockFetch();
    render(<UserStatusTab />);

    expect(screen.getByText(/My Elite Status/i)).toBeInTheDocument();
    expect(screen.getByTestId("user-status-table")).toBeInTheDocument();
  });

  it("renders rows for hotel chains", async () => {
    const mockChains = [{ id: "1", name: "Marriott", eliteStatuses: [] }];
    const mockStatuses = [{ hotelChainId: "1", eliteStatusId: null }];

    vi.mocked(global.fetch).mockImplementation((input: string | Request | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes("/api/user-statuses"))
        return Promise.resolve({ ok: true, json: async () => mockStatuses } as Response);
      if (url.includes("/api/hotel-chains"))
        return Promise.resolve({ ok: true, json: async () => mockChains } as Response);
      if (url.includes("/api/partnership-earns"))
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<UserStatusTab />);

    expect(await screen.findByText("Marriott")).toBeInTheDocument();
  });

  it("does not render partnerships section when none exist", async () => {
    mockFetch([]);
    render(<UserStatusTab />);

    expect(screen.queryByText(/Hotel Partnerships/i)).not.toBeInTheDocument();
  });

  it("renders partnership checkboxes when partnerships exist", async () => {
    mockFetch([MOCK_PARTNERSHIP]);
    render(<UserStatusTab />);

    expect(await screen.findByText(/Hotel Partnerships/i)).toBeInTheDocument();
    const checkbox = await screen.findByTestId(`partnership-checkbox-${PARTNERSHIP_ID}`);
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("shows checkbox as checked when partnership is enabled", async () => {
    mockFetch([{ ...MOCK_PARTNERSHIP, isEnabled: true }]);
    render(<UserStatusTab />);

    expect(await screen.findByTestId(`partnership-checkbox-${PARTNERSHIP_ID}`)).toBeChecked();
  });

  it("calls POST /api/user-partnership-earns when toggling a checkbox", async () => {
    mockFetch([MOCK_PARTNERSHIP]);
    const user = userEvent.setup();
    render(<UserStatusTab />);

    vi.mocked(global.fetch).mockImplementation(
      (input: string | Request | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.includes("/api/user-partnership-earns") && init?.method === "POST")
          return Promise.resolve({
            ok: true,
            json: async () => ({ isEnabled: true }),
          } as Response);
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
    );

    const checkbox = await screen.findByTestId(`partnership-checkbox-${PARTNERSHIP_ID}`);
    await user.click(checkbox);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/user-partnership-earns",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ partnershipEarnId: PARTNERSHIP_ID, isEnabled: true }),
      })
    );
  });
});
