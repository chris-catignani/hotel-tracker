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

  it("renders benefits as a table with reward label and value", async () => {
    mockSuccess();
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("benefits-list")).toBeInTheDocument());
    const row = screen.getByTestId("benefit-item-b1");
    expect(row).toHaveTextContent("Cashback");
    expect(row).toHaveTextContent("$25.00 cashback");
  });

  it("shows Per stay basis note when promo has no nightsStackable restrictions", async () => {
    mockSuccess();
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("benefit-item-b1")).toBeInTheDocument());
    expect(screen.getByTestId("benefit-item-b1")).toHaveTextContent("Per stay");
  });

  it("shows Per night basis when promo-level restrictions have nightsStackable and minNightsRequired=1", async () => {
    const promoPerNight = {
      ...BASE_PROMO,
      restrictions: {
        id: "r1",
        minSpend: null,
        minNightsRequired: 1,
        nightsStackable: true,
        spanStays: true,
        maxStayCount: null,
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
    mockSuccess(promoPerNight);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("benefit-item-b1")).toBeInTheDocument());
    expect(screen.getByTestId("benefit-item-b1")).toHaveTextContent("Per night");
  });

  it("shows Per N nights basis when benefit-level restrictions have nightsStackable and minNightsRequired>1", async () => {
    const promoPerThreeNights = {
      ...BASE_PROMO,
      benefits: [
        {
          id: "b1",
          promotionId: "promo-1",
          rewardType: "points",
          valueType: "fixed",
          value: "3000",
          certType: null,
          sortOrder: 0,
          restrictions: {
            id: "br1",
            minSpend: null,
            minNightsRequired: 3,
            nightsStackable: true,
            spanStays: true,
            maxStayCount: null,
            maxRewardCount: null,
            maxRedemptionValue: null,
            maxTotalBonusPoints: 21000,
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
        },
      ],
    };
    mockSuccess(promoPerThreeNights);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("benefit-item-b1")).toBeInTheDocument());
    expect(screen.getByTestId("benefit-item-b1")).toHaveTextContent("Per 3 nights");
    expect(screen.getByTestId("benefit-item-b1")).toHaveTextContent("21,000");
  });

  it("shows benefit-level restriction note alongside basis", async () => {
    const promoWithBenefitRestriction = {
      ...BASE_PROMO,
      benefits: [
        {
          id: "b1",
          promotionId: "promo-1",
          rewardType: "eqn",
          valueType: "fixed",
          value: "1",
          certType: null,
          sortOrder: 0,
          restrictions: {
            id: "br1",
            minSpend: null,
            minNightsRequired: null,
            nightsStackable: false,
            spanStays: false,
            maxStayCount: null,
            maxRewardCount: null,
            maxRedemptionValue: null,
            maxTotalBonusPoints: null,
            oncePerSubBrand: true,
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
        },
      ],
    };
    mockSuccess(promoWithBenefitRestriction);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("benefit-item-b1")).toBeInTheDocument());
    expect(screen.getByTestId("benefit-item-b1")).toHaveTextContent("Per stay");
    expect(screen.getByTestId("benefit-item-b1")).toHaveTextContent("Once Per Sub-brand");
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

  it("renders ordinal label when tier min and max are equal", async () => {
    const promoWithSingleStayTier = {
      ...BASE_PROMO,
      benefits: [],
      tiers: [
        {
          id: "t1",
          promotionId: "promo-1",
          minStays: 2,
          maxStays: 2,
          minNights: null,
          maxNights: null,
          benefits: [
            {
              id: "tb1",
              promotionId: null,
              promotionTierId: "t1",
              rewardType: "cashback",
              valueType: "fixed",
              value: "5000.00",
              certType: null,
              sortOrder: 0,
              restrictions: null,
            },
          ],
        },
      ],
    };
    mockSuccess(promoWithSingleStayTier);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("tier-requirement-t1")).toBeInTheDocument());
    expect(screen.getByTestId("tier-requirement-t1")).toHaveTextContent("2nd stay");
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

  it("shows hotel chain restriction when hotelChainId is set", async () => {
    const promoWithChainRestriction = {
      ...BASE_PROMO,
      restrictions: {
        id: "r1",
        minSpend: null,
        minNightsRequired: null,
        nightsStackable: false,
        spanStays: false,
        maxStayCount: null,
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
        hotelChainId: "chain-1",
        hotelChain: { name: "IHG" },
        prerequisiteStayCount: null,
        prerequisiteNightCount: null,
        subBrandRestrictions: [],
        tieInCards: [],
      },
    };
    mockSuccess(promoWithChainRestriction);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("restrictions-card")).toBeInTheDocument());
    expect(screen.getByTestId("restriction-hotel-chain")).toHaveTextContent("IHG");
  });

  it("shows human-readable booking source labels", async () => {
    const promoWithBookingSource = {
      ...BASE_PROMO,
      restrictions: {
        id: "r1",
        minSpend: null,
        minNightsRequired: null,
        nightsStackable: false,
        spanStays: false,
        maxStayCount: null,
        maxRewardCount: null,
        maxRedemptionValue: null,
        maxTotalBonusPoints: null,
        oncePerSubBrand: false,
        bookByDate: null,
        registrationDeadline: null,
        validDaysAfterRegistration: null,
        tieInRequiresPayment: false,
        allowedPaymentTypes: [],
        allowedBookingSources: ["direct_app"],
        allowedCountryCodes: [],
        allowedAccommodationTypes: [],
        hotelChainId: null,
        prerequisiteStayCount: null,
        prerequisiteNightCount: null,
        subBrandRestrictions: [],
        tieInCards: [],
      },
    };
    mockSuccess(promoWithBookingSource);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("restrictions-card")).toBeInTheDocument());
    expect(screen.getByTestId("restriction-booking-sources")).toHaveTextContent("Mobile App");
    expect(screen.getByTestId("restriction-booking-sources")).not.toHaveTextContent("direct_app");
  });

  it("shows sub-brand names instead of counts", async () => {
    const promoWithSubBrands = {
      ...BASE_PROMO,
      restrictions: {
        id: "r1",
        minSpend: null,
        minNightsRequired: null,
        nightsStackable: false,
        spanStays: false,
        maxStayCount: null,
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
        subBrandRestrictions: [
          {
            id: "sr1",
            hotelChainSubBrandId: "sub-1",
            mode: "include",
            hotelChainSubBrand: { name: "Aloft" },
          },
        ],
        tieInCards: [],
      },
    };
    mockSuccess(promoWithSubBrands);
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("restrictions-card")).toBeInTheDocument());
    expect(screen.getByTestId("restriction-sub-brands")).toHaveTextContent("Aloft only");
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

  it("renders benefits table with no rows when no benefits and no tiers", async () => {
    mockSuccess({ ...BASE_PROMO, benefits: [] });
    render(<PromotionDetailPage />);
    await waitFor(() => expect(screen.getByTestId("benefits-list")).toBeInTheDocument());
    expect(screen.queryByTestId(/^benefit-item-/)).not.toBeInTheDocument();
  });
});
