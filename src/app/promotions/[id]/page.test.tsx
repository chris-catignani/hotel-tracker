import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PromotionDetailPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "promo-1" }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const BASE_PROMO = {
  id: "promo-1",
  name: "Summer Bonus",
  type: "loyalty",
  hotelChainId: "chain-1",
  creditCardId: null,
  shoppingPortalId: null,
  startDate: "2026-06-01T00:00:00.000Z",
  endDate: "2026-08-31T00:00:00.000Z",
  restrictions: null,
  userPromotions: [],
  createdAt: "2026-01-01T00:00:00Z",
  hotelChain: { id: "chain-1", name: "Hyatt" },
  creditCard: null,
  shoppingPortal: null,
  benefits: [
    {
      id: "b1",
      promotionId: "promo-1",
      rewardType: "cashback",
      valueType: "fixed",
      value: "25.00",
      certType: null,
      sortOrder: 0,
      restrictions: null,
    },
  ],
  tiers: [],
};

function mockSuccess(promo: object = BASE_PROMO) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => promo,
  });
}

describe("PromotionDetailPage", () => {
  beforeEach(() => mockFetch.mockReset());

  it("renders hero card with name, type badge, and linked entity", async () => {
    mockSuccess();
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("hero-promo-name")).toBeInTheDocument());
    expect(screen.getByTestId("hero-promo-name")).toHaveTextContent("Summer Bonus");
    expect(screen.getByTestId("hero-promo-type")).toHaveTextContent("Loyalty");
    expect(screen.getByTestId("hero-linked-to")).toHaveTextContent("Hyatt");
  });

  it("renders date stats — start and end show formatted dates, registration shows dash", async () => {
    mockSuccess();
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("hero-start-date")).toBeInTheDocument());
    expect(screen.getByTestId("hero-start-date")).toHaveTextContent("06/01/26");
    expect(screen.getByTestId("hero-end-date")).toHaveTextContent("08/31/26");
    expect(screen.getByTestId("hero-registration-date")).toHaveTextContent("—");
  });

  it("renders simple benefits list when there are no tiers", async () => {
    mockSuccess();
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("benefits-list")).toBeInTheDocument());
    expect(screen.getByTestId("benefit-item-b1")).toHaveTextContent("$25.00 cashback");
  });

  it("renders tier table when tiers are present", async () => {
    const promoWithTiers = {
      ...BASE_PROMO,
      benefits: [],
      tiers: [
        {
          id: "t1",
          promotionId: "promo-1",
          minStays: 2,
          maxStays: 3,
          minNights: null,
          maxNights: null,
          benefits: [
            {
              id: "tb1",
              promotionId: null,
              promotionTierId: "t1",
              rewardType: "cashback",
              valueType: "fixed",
              value: "50.00",
              certType: null,
              sortOrder: 0,
              restrictions: null,
            },
          ],
        },
      ],
    };
    mockSuccess(promoWithTiers);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("tier-requirement-t1")).toBeInTheDocument());
    expect(screen.getByTestId("tier-requirement-t1")).toHaveTextContent("2–3 stays");
    expect(screen.getByTestId("tier-benefits-t1")).toHaveTextContent("$50.00 cashback");
  });

  it("omits restrictions card when restrictions is null", async () => {
    mockSuccess();
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("hero-promo-name")).toBeInTheDocument());
    expect(screen.queryByTestId("restrictions-card")).not.toBeInTheDocument();
  });

  it("renders restrictions card with only the non-null fields", async () => {
    const promoWithRestrictions = {
      ...BASE_PROMO,
      restrictions: {
        id: "r1",
        minSpend: null,
        minNightsRequired: 3,
        nightsStackable: false,
        spanStays: false,
        maxStayCount: 5,
        maxRewardCount: null,
        maxRedemptionValue: null,
        maxTotalBonusPoints: null,
        oncePerSubBrand: false,
        bookByDate: null,
        registrationDeadline: null,
        validDaysAfterRegistration: null,
        tieInRequiresPayment: false,
        allowedPaymentTypes: [],
        allowedBookingSources: [],
        allowedCountryCodes: [],
        allowedAccommodationTypes: [],
        hotelChainId: null,
        prerequisiteStayCount: null,
        prerequisiteNightCount: null,
        subBrandRestrictions: [],
        tieInCards: [],
      },
    };
    mockSuccess(promoWithRestrictions);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("restrictions-card")).toBeInTheDocument());
    expect(screen.getByTestId("restriction-min-nights")).toHaveTextContent("3");
    expect(screen.getByTestId("restriction-max-stays")).toHaveTextContent("5");
    expect(screen.queryByTestId("restriction-min-spend")).not.toBeInTheDocument();
  });

  it("shows error banner when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    });
    render(<PromotionDetailPage />);
    await waitFor(() =>
      expect(screen.getByText("Failed to load promotion. Please try again.")).toBeInTheDocument()
    );
  });

  it("shows em-dash in hero linked-to when no chain, card, or portal", async () => {
    mockSuccess({
      ...BASE_PROMO,
      hotelChain: null,
      creditCard: null,
      shoppingPortal: null,
      hotelChainId: null,
    });
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("hero-linked-to")).toBeInTheDocument());
    expect(screen.getByTestId("hero-linked-to")).toHaveTextContent("—");
  });

  it("renders tier requirement using nights when minNights/maxNights are set", async () => {
    const promoWithNightTier = {
      ...BASE_PROMO,
      benefits: [],
      tiers: [
        {
          id: "t2",
          promotionId: "promo-1",
          minStays: null,
          maxStays: null,
          minNights: 3,
          maxNights: null,
          benefits: [
            {
              id: "tb2",
              promotionId: null,
              promotionTierId: "t2",
              rewardType: "points",
              valueType: "multiplier",
              value: "2",
              certType: null,
              sortOrder: 0,
              restrictions: null,
            },
          ],
        },
      ],
    };
    mockSuccess(promoWithNightTier);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("tier-requirement-t2")).toBeInTheDocument());
    expect(screen.getByTestId("tier-requirement-t2")).toHaveTextContent("3+ nights");
  });

  it("renders empty benefits list when no benefits and no tiers", async () => {
    mockSuccess({ ...BASE_PROMO, benefits: [] });
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("benefits-list")).toBeInTheDocument());
    expect(screen.getByTestId("benefits-list")).toBeEmptyDOMElement();
  });
});
