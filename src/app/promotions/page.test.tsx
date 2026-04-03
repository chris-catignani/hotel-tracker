import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PromotionsPage from "./page";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const PAST = "2020-01-01";
const FUTURE = "2099-12-31";

const makePromo = (id: string, name: string, startDate: string | null, endDate: string | null) => ({
  id,
  name,
  type: "loyalty",
  benefits: [],
  tiers: [],
  hotelChainId: null,
  creditCardId: null,
  shoppingPortalId: null,
  startDate,
  endDate,
  restrictions: null,
  userPromotions: [],
  createdAt: "2025-01-01T00:00:00Z",
});

const ONGOING_PROMO = makePromo("1", "Ongoing Promo", PAST, FUTURE);
const EXPIRED_PROMO = makePromo("2", "Expired Promo", PAST, PAST);
const UPCOMING_PROMO = makePromo("3", "Upcoming Promo", FUTURE, FUTURE);
const NO_DATES_PROMO = makePromo("4", "No Dates Promo", null, null);

const ALL_PROMOS = [ONGOING_PROMO, EXPIRED_PROMO, UPCOMING_PROMO, NO_DATES_PROMO];

function mockFetchSuccess(promos = ALL_PROMOS) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => promos,
  });
}

async function renderAndWait(promos = ALL_PROMOS) {
  mockFetchSuccess(promos);
  render(<PromotionsPage />);
  await waitFor(() => screen.getByTestId("status-filter"));
  return within(screen.getByTestId("promotions-list-desktop"));
}

describe("PromotionsPage status filter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("defaults to Ongoing filter and shows only ongoing promos", async () => {
    const desktop = await renderAndWait();

    expect(desktop.getByText("Ongoing Promo")).toBeInTheDocument();
    expect(desktop.getByText("No Dates Promo")).toBeInTheDocument();
    expect(desktop.queryByText("Expired Promo")).not.toBeInTheDocument();
    expect(desktop.queryByText("Upcoming Promo")).not.toBeInTheDocument();
  });

  it("shows expired promos under Expired filter", async () => {
    await renderAndWait();

    await userEvent.click(screen.getByTestId("status-filter-expired"));

    const desktop = within(screen.getByTestId("promotions-list-desktop"));
    expect(desktop.getByText("Expired Promo")).toBeInTheDocument();
    expect(desktop.queryByText("Ongoing Promo")).not.toBeInTheDocument();
    expect(desktop.queryByText("Upcoming Promo")).not.toBeInTheDocument();
  });

  it("shows upcoming promos under Upcoming filter", async () => {
    await renderAndWait();

    await userEvent.click(screen.getByTestId("status-filter-upcoming"));

    const desktop = within(screen.getByTestId("promotions-list-desktop"));
    expect(desktop.getByText("Upcoming Promo")).toBeInTheDocument();
    expect(desktop.queryByText("Ongoing Promo")).not.toBeInTheDocument();
    expect(desktop.queryByText("Expired Promo")).not.toBeInTheDocument();
  });

  it("shows all promos under All filter", async () => {
    await renderAndWait();

    await userEvent.click(screen.getByTestId("status-filter-all"));

    const desktop = within(screen.getByTestId("promotions-list-desktop"));
    expect(desktop.getByText("Ongoing Promo")).toBeInTheDocument();
    expect(desktop.getByText("Expired Promo")).toBeInTheDocument();
    expect(desktop.getByText("Upcoming Promo")).toBeInTheDocument();
    expect(desktop.getByText("No Dates Promo")).toBeInTheDocument();
  });

  it("shows empty state when no promos match the filter", async () => {
    mockFetchSuccess([EXPIRED_PROMO]);
    render(<PromotionsPage />);

    // Default is Ongoing — no ongoing promos, so empty state should show
    await waitFor(() => {
      expect(screen.getByTestId("promotions-empty")).toBeInTheDocument();
    });
  });
});
