import { describe, it, expect } from "vitest";
import { resolveValuation, BenefitValuationData } from "./benefit-valuations";
import { ValuationValueType, BenefitType } from "@prisma/client";

describe("benefit-valuations resolution logic", () => {
  const mockValuations: BenefitValuationData[] = [
    {
      id: "global-eqn",
      hotelChainId: null,
      isEqn: true,
      certType: null,
      benefitType: null,
      value: 10,
      valueType: "dollar" as ValuationValueType,
    },
    {
      id: "hyatt-eqn",
      hotelChainId: "hyatt",
      isEqn: true,
      certType: null,
      benefitType: null,
      value: 20,
      valueType: "dollar" as ValuationValueType,
    },
    {
      id: "global-breakfast",
      hotelChainId: null,
      isEqn: false,
      certType: null,
      benefitType: "free_breakfast" as BenefitType,
      value: 15,
      valueType: "dollar" as ValuationValueType,
    },
  ];

  it("should use chain-specific override if present", () => {
    const result = resolveValuation(mockValuations, {
      hotelChainId: "hyatt",
      isEqn: true,
    });
    expect(result.value).toBe(20);
  });

  it("should fall back to global default if no chain override", () => {
    const result = resolveValuation(mockValuations, {
      hotelChainId: "marriott",
      isEqn: true,
    });
    expect(result.value).toBe(10);
  });

  it("should use global default when no chainId provided", () => {
    const result = resolveValuation(mockValuations, {
      benefitType: "free_breakfast" as BenefitType,
    });
    expect(result.value).toBe(15);
  });

  it("should ignore null values (representing deletions) and fall back", () => {
    const valuationsWithDeletion: BenefitValuationData[] = [
      ...mockValuations,
      {
        id: "deleted-override",
        hotelChainId: "hyatt",
        isEqn: false,
        certType: null,
        benefitType: "free_breakfast" as BenefitType,
        value: null,
        valueType: "dollar" as ValuationValueType,
      },
    ];

    const result = resolveValuation(valuationsWithDeletion, {
      hotelChainId: "hyatt",
      benefitType: "free_breakfast" as BenefitType,
    });
    // Should fall back to the global default ($15) because the Hyatt override was set to null
    expect(result.value).toBe(15);
  });

  it("should use system hardcoded fallbacks if nothing found in DB", () => {
    const result = resolveValuation([], { isEqn: true });
    expect(result.value).toBe(10);

    const result2 = resolveValuation([], { benefitType: "dining_credit" as BenefitType });
    expect(result2.value).toBe(0);
  });
});
