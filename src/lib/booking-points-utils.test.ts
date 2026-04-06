import { describe, it, expect } from "vitest";
import { calculateCCPointsEarned, calculatePortalPointsEarned } from "./booking-points-utils";

const baseBooking = {
  totalCost: "487",
  pretaxCost: "450",
  lockedExchangeRate: "1",
  hotelChainId: "chain-hyatt",
  otaAgencyId: null,
};

describe("calculateCCPointsEarned", () => {
  it("returns null when no credit card", () => {
    expect(calculateCCPointsEarned({ ...baseBooking, userCreditCard: null })).toBeNull();
  });

  it("returns null when card rewardType is cashback", () => {
    expect(
      calculateCCPointsEarned({
        ...baseBooking,
        userCreditCard: {
          creditCard: { rewardType: "cashback", rewardRate: "0.02", rewardRules: [] },
        },
      })
    ).toBeNull();
  });

  it("uses base rewardRate when no matching rule", () => {
    // 487 USD * 3 pts/$ = 1461
    expect(
      calculateCCPointsEarned({
        ...baseBooking,
        userCreditCard: {
          creditCard: { rewardType: "points", rewardRate: "3", rewardRules: [] },
        },
      })
    ).toBe(1461);
  });

  it("prefers chain-specific multiplier rule over base rate", () => {
    // chain rule: 5x → 487 * 5 = 2435
    expect(
      calculateCCPointsEarned({
        ...baseBooking,
        userCreditCard: {
          creditCard: {
            rewardType: "points",
            rewardRate: "3",
            rewardRules: [
              {
                rewardType: "multiplier",
                rewardValue: "5",
                hotelChainId: "chain-hyatt",
                otaAgencyId: null,
              },
            ],
          },
        },
      })
    ).toBe(2435);
  });

  it("uses OTA-specific rule when booking source is OTA", () => {
    // ota rule: 2x → 487 * 2 = 974
    expect(
      calculateCCPointsEarned({
        ...baseBooking,
        hotelChainId: null,
        otaAgencyId: "ota-expedia",
        userCreditCard: {
          creditCard: {
            rewardType: "points",
            rewardRate: "1",
            rewardRules: [
              {
                rewardType: "multiplier",
                rewardValue: "2",
                hotelChainId: null,
                otaAgencyId: "ota-expedia",
              },
            ],
          },
        },
      })
    ).toBe(974);
  });

  it("uses OTA rule when booking has both hotelChainId and otaAgencyId", () => {
    // booking has chain-hyatt AND ota-expedia
    // card has chain rule (5x) and OTA rule (2x)
    // expected: OTA rule wins (487 * 2 = 974)
    expect(
      calculateCCPointsEarned({
        ...baseBooking,
        hotelChainId: "chain-hyatt",
        otaAgencyId: "ota-expedia",
        userCreditCard: {
          creditCard: {
            rewardType: "points",
            rewardRate: "1",
            rewardRules: [
              {
                rewardType: "multiplier",
                rewardValue: "5",
                hotelChainId: "chain-hyatt",
                otaAgencyId: null,
              },
              {
                rewardType: "multiplier",
                rewardValue: "2",
                hotelChainId: null,
                otaAgencyId: "ota-expedia",
              },
            ],
          },
        },
      })
    ).toBe(974);
  });

  it("applies fixed rule as a flat amount", () => {
    // 487 * 3 base + 5000 fixed = 1461 + 5000 = 6461
    expect(
      calculateCCPointsEarned({
        ...baseBooking,
        userCreditCard: {
          creditCard: {
            rewardType: "points",
            rewardRate: "3",
            rewardRules: [
              {
                rewardType: "fixed",
                rewardValue: "5000",
                hotelChainId: "chain-hyatt",
                otaAgencyId: null,
              },
            ],
          },
        },
      })
    ).toBe(6461);
  });

  it("sums multiple fixed rules", () => {
    // 487 * 3 base + 2000 + 3000 fixed = 1461 + 5000 = 6461
    expect(
      calculateCCPointsEarned({
        ...baseBooking,
        userCreditCard: {
          creditCard: {
            rewardType: "points",
            rewardRate: "3",
            rewardRules: [
              {
                rewardType: "fixed",
                rewardValue: "2000",
                hotelChainId: "chain-hyatt",
                otaAgencyId: null,
              },
              {
                rewardType: "fixed",
                rewardValue: "3000",
                hotelChainId: "chain-hyatt",
                otaAgencyId: null,
              },
            ],
          },
        },
      })
    ).toBe(6461);
  });

  it("applies exchange rate to non-USD total", () => {
    // 200 EUR * 1.1 rate * 3 pts/$ = 660
    expect(
      calculateCCPointsEarned({
        totalCost: "200",
        pretaxCost: "180",
        lockedExchangeRate: "1.1",
        hotelChainId: null,
        otaAgencyId: null,
        userCreditCard: {
          creditCard: { rewardType: "points", rewardRate: "3", rewardRules: [] },
        },
      })
    ).toBe(660);
  });

  it("returns null when totalCost is zero", () => {
    expect(
      calculateCCPointsEarned({
        ...baseBooking,
        totalCost: "0",
        userCreditCard: {
          creditCard: { rewardType: "points", rewardRate: "3", rewardRules: [] },
        },
      })
    ).toBeNull();
  });
});

describe("calculatePortalPointsEarned", () => {
  it("returns null when no portal", () => {
    expect(
      calculatePortalPointsEarned({
        ...baseBooking,
        shoppingPortal: null,
        portalCashbackRate: "5",
        portalCashbackOnTotal: true,
      })
    ).toBeNull();
  });

  it("returns null when portal rewardType is cashback", () => {
    expect(
      calculatePortalPointsEarned({
        ...baseBooking,
        shoppingPortal: { rewardType: "cashback" },
        portalCashbackRate: "5",
        portalCashbackOnTotal: true,
      })
    ).toBeNull();
  });

  it("calculates points on total cost when portalCashbackOnTotal is true", () => {
    // 487 * 5 pts/$ = 2435
    expect(
      calculatePortalPointsEarned({
        ...baseBooking,
        shoppingPortal: { rewardType: "points" },
        portalCashbackRate: "5",
        portalCashbackOnTotal: true,
      })
    ).toBe(2435);
  });

  it("calculates points on pretax cost when portalCashbackOnTotal is false", () => {
    // 450 * 5 pts/$ = 2250
    expect(
      calculatePortalPointsEarned({
        ...baseBooking,
        shoppingPortal: { rewardType: "points" },
        portalCashbackRate: "5",
        portalCashbackOnTotal: false,
      })
    ).toBe(2250);
  });

  it("applies exchange rate", () => {
    // 200 EUR * 1.1 rate * 3 pts/$ = 660
    expect(
      calculatePortalPointsEarned({
        totalCost: "200",
        pretaxCost: "180",
        lockedExchangeRate: "1.1",
        hotelChainId: null,
        otaAgencyId: null,
        shoppingPortal: { rewardType: "points" },
        portalCashbackRate: "3",
        portalCashbackOnTotal: true,
      })
    ).toBe(660);
  });

  it("returns null when portalCashbackRate is null", () => {
    expect(
      calculatePortalPointsEarned({
        ...baseBooking,
        shoppingPortal: { rewardType: "points" },
        portalCashbackRate: null,
        portalCashbackOnTotal: true,
      })
    ).toBeNull();
  });
});
