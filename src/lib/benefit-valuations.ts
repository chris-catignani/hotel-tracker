import prisma from "@/lib/prisma";
import { BenefitType, CertType, ValuationValueType } from "@prisma/client";

export interface BenefitValuationData {
  id: string;
  hotelChainId: string | null;
  isEqn: boolean;
  certType: CertType | null;
  benefitType: BenefitType | null;
  value: number | null;
  valueType: ValuationValueType;
}

/**
 * Fetches all benefit valuations from the database.
 * Used by API routes to provide data to the frontend.
 */
export async function getAllValuations(): Promise<BenefitValuationData[]> {
  const valuations = await prisma.benefitValuation.findMany();
  return valuations.map((v) => ({
    ...v,
    value: Number(v.value),
  }));
}

/**
 * Resolves a valuation for a specific benefit, considering chain-specific overrides
 * and falling back to global defaults.
 */
export function resolveValuation(
  valuations: BenefitValuationData[],
  params: {
    hotelChainId?: string | null;
    isEqn?: boolean;
    certType?: CertType | null;
    benefitType?: BenefitType | null;
  }
): { value: number; valueType: ValuationValueType } {
  const { hotelChainId, isEqn = false, certType = null, benefitType = null } = params;

  // 1. Try to find an exact match for this hotel chain
  if (hotelChainId) {
    const override = valuations.find(
      (v) =>
        v.hotelChainId === hotelChainId &&
        v.isEqn === isEqn &&
        v.certType === certType &&
        v.benefitType === benefitType &&
        v.value !== null
    );
    if (override) return { value: override.value as number, valueType: override.valueType };
  }

  // 2. Fall back to global default (hotelChainId is null)
  const globalDefault = valuations.find(
    (v) =>
      v.hotelChainId === null &&
      v.isEqn === isEqn &&
      v.certType === certType &&
      v.benefitType === benefitType &&
      v.value !== null
  );

  if (globalDefault)
    return { value: globalDefault.value as number, valueType: globalDefault.valueType };

  // 3. System hardcoded fallbacks (if DB is somehow missing the seed data)
  if (isEqn) return { value: 10.0, valueType: "dollar" };

  // Default for certs if missing is 0 (though seed should provide them)
  return { value: 0, valueType: "dollar" };
}
