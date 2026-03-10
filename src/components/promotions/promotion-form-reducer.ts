import {
  PromotionType,
  PromotionBenefitFormData,
  PromotionTierFormData,
  PromotionFormData,
  PromotionRestrictionsFormData,
  PromotionRestrictionsData,
  EMPTY_RESTRICTIONS,
} from "@/lib/types";
import { DEFAULT_BENEFIT } from "./benefit-row";
import { RestrictionKey, deriveActiveRestrictions } from "./restriction-cards";

// ── Internal types (keyed items for stable React rendering) ──────────────────

export type BenefitItem = PromotionBenefitFormData & { _id: string };

export type TierItem = Omit<PromotionTierFormData, "benefits"> & {
  _id: string;
  benefits: BenefitItem[];
};

// ── State ────────────────────────────────────────────────────────────────────

export interface PromotionFormState {
  name: string;
  type: PromotionType;
  hotelChainId: string;
  creditCardId: string;
  shoppingPortalId: string;
  benefits: BenefitItem[];
  isTiered: boolean;
  tierRequirementType: "stays" | "nights";
  tiers: TierItem[];
  startDate: string;
  endDate: string;
  restrictions: PromotionRestrictionsFormData;
  activeRestrictions: Set<RestrictionKey>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function makeBenefitItem(b: PromotionBenefitFormData): BenefitItem {
  return { ...b, _id: crypto.randomUUID() };
}

export function makeTierItem(t: PromotionTierFormData): TierItem {
  return { ...t, benefits: t.benefits.map(makeBenefitItem), _id: crypto.randomUUID() };
}

/** Strip internal `_id` fields before API submission. */
export function toFormBenefit({ _id: _ignored, ...rest }: BenefitItem): PromotionBenefitFormData {
  return rest;
}

export function toFormTier({ _id: _ignored, benefits, ...rest }: TierItem): PromotionTierFormData {
  return { ...rest, benefits: benefits.map(toFormBenefit) };
}

const DEFAULT_TIER: PromotionTierFormData = {
  minStays: null,
  maxStays: null,
  minNights: null,
  maxNights: null,
  benefits: [{ ...DEFAULT_BENEFIT }],
};

// ── Restrictions mapping ─────────────────────────────────────────────────────

export function mapApiRestrictionsToForm(
  r: PromotionRestrictionsData | PromotionRestrictionsFormData | null | undefined
): PromotionRestrictionsFormData {
  if (!r) return { ...EMPTY_RESTRICTIONS };
  if ("subBrandIncludeIds" in r) return r as PromotionRestrictionsFormData;
  return {
    minSpend: r.minSpend != null ? String(r.minSpend) : "",
    minNightsRequired: r.minNightsRequired != null ? String(r.minNightsRequired) : "",
    nightsStackable: r.nightsStackable ?? false,
    spanStays: r.spanStays ?? false,
    maxStayCount: r.maxStayCount != null ? String(r.maxStayCount) : "",
    maxRewardCount: r.maxRewardCount != null ? String(r.maxRewardCount) : "",
    maxRedemptionValue: r.maxRedemptionValue != null ? String(r.maxRedemptionValue) : "",
    maxTotalBonusPoints: r.maxTotalBonusPoints != null ? String(r.maxTotalBonusPoints) : "",
    oncePerSubBrand: r.oncePerSubBrand ?? false,
    bookByDate: r.bookByDate ? new Date(r.bookByDate).toISOString().split("T")[0] : "",
    registrationDeadline: r.registrationDeadline
      ? new Date(r.registrationDeadline).toISOString().split("T")[0]
      : "",
    validDaysAfterRegistration:
      r.validDaysAfterRegistration != null ? String(r.validDaysAfterRegistration) : "",
    registrationDate: "",
    tieInRequiresPayment: r.tieInRequiresPayment ?? false,
    allowedPaymentTypes: r.allowedPaymentTypes ?? [],
    allowedBookingSources: r.allowedBookingSources ?? [],
    allowedCountryCodes: r.allowedCountryCodes ?? [],
    hotelChainId: r.hotelChainId ?? "",
    prerequisiteStayCount: r.prerequisiteStayCount != null ? String(r.prerequisiteStayCount) : "",
    prerequisiteNightCount:
      r.prerequisiteNightCount != null ? String(r.prerequisiteNightCount) : "",
    subBrandIncludeIds: (r.subBrandRestrictions ?? [])
      .filter((s) => s.mode === "include")
      .map((s) => s.hotelChainSubBrandId),
    subBrandExcludeIds: (r.subBrandRestrictions ?? [])
      .filter((s) => s.mode === "exclude")
      .map((s) => s.hotelChainSubBrandId),
    tieInCreditCardIds: (r.tieInCards ?? []).map((c) => c.creditCardId),
  };
}

// ── Initial state ────────────────────────────────────────────────────────────

export type InitialFormData = Partial<PromotionFormData> & {
  restrictions?: PromotionRestrictionsData | PromotionRestrictionsFormData | null;
};

export function buildInitialState(initialData?: InitialFormData): PromotionFormState {
  const mappedRestrictions = mapApiRestrictionsToForm(initialData?.restrictions);
  const hasTiers = !!(initialData?.tiers && initialData.tiers.length > 0);
  const hasFlat = !!(initialData?.benefits && initialData.benefits.length > 0);

  return {
    name: initialData?.name || "",
    type: (initialData?.type as PromotionType) || "loyalty",
    hotelChainId: initialData?.hotelChainId || "",
    creditCardId: initialData?.creditCardId || "",
    shoppingPortalId: initialData?.shoppingPortalId || "",
    benefits: hasFlat
      ? initialData!.benefits!.map(makeBenefitItem)
      : [makeBenefitItem({ ...DEFAULT_BENEFIT })],
    isTiered: hasTiers,
    tierRequirementType: initialData?.tierRequirementType || "stays",
    tiers: hasTiers ? initialData!.tiers!.map(makeTierItem) : [makeTierItem({ ...DEFAULT_TIER })],
    startDate: initialData?.startDate || "",
    endDate: initialData?.endDate || "",
    restrictions: mappedRestrictions,
    activeRestrictions: deriveActiveRestrictions(mappedRestrictions),
  };
}

// ── Actions ──────────────────────────────────────────────────────────────────

type ScalarFields = Pick<
  PromotionFormState,
  | "name"
  | "type"
  | "hotelChainId"
  | "creditCardId"
  | "shoppingPortalId"
  | "startDate"
  | "endDate"
  | "isTiered"
  | "tierRequirementType"
>;

type SetFieldAction = {
  [K in keyof ScalarFields]: { type: "SET_FIELD"; field: K; value: ScalarFields[K] };
}[keyof ScalarFields];

export type Action =
  | SetFieldAction
  | { type: "LOAD_INITIAL_DATA"; initialData: InitialFormData }
  // Flat benefits
  | { type: "ADD_BENEFIT" }
  | { type: "UPDATE_BENEFIT"; index: number; benefit: PromotionBenefitFormData }
  | { type: "REMOVE_BENEFIT"; index: number }
  // Tiers
  | { type: "ADD_TIER" }
  | { type: "REMOVE_TIER"; tierIndex: number }
  | { type: "UPDATE_TIER"; tierIndex: number; updates: Partial<Omit<TierItem, "_id" | "benefits">> }
  | { type: "ADD_TIER_BENEFIT"; tierIndex: number }
  | {
      type: "UPDATE_TIER_BENEFIT";
      tierIndex: number;
      benefitIndex: number;
      benefit: PromotionBenefitFormData;
    }
  | { type: "REMOVE_TIER_BENEFIT"; tierIndex: number; benefitIndex: number }
  // Restrictions
  | { type: "ADD_RESTRICTION"; key: RestrictionKey }
  | { type: "REMOVE_RESTRICTION"; key: RestrictionKey }
  | { type: "UPDATE_RESTRICTIONS"; updates: Partial<PromotionRestrictionsFormData> };

// ── Reducer ──────────────────────────────────────────────────────────────────

export function promotionFormReducer(
  state: PromotionFormState,
  action: Action
): PromotionFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };

    case "LOAD_INITIAL_DATA":
      return buildInitialState(action.initialData);

    // ── Flat benefits ───────────────────────────────────────────────────────

    case "ADD_BENEFIT":
      return {
        ...state,
        benefits: [
          ...state.benefits,
          makeBenefitItem({ ...DEFAULT_BENEFIT, sortOrder: state.benefits.length }),
        ],
      };

    case "UPDATE_BENEFIT":
      return {
        ...state,
        benefits: state.benefits.map((b, i) =>
          i === action.index ? { ...action.benefit, _id: b._id } : b
        ),
      };

    case "REMOVE_BENEFIT":
      return {
        ...state,
        benefits: state.benefits.filter((_, i) => i !== action.index),
      };

    // ── Tiers ───────────────────────────────────────────────────────────────

    case "ADD_TIER": {
      const last = state.tiers[state.tiers.length - 1];
      const newTier: TierItem =
        state.tierRequirementType === "stays"
          ? makeTierItem({
              minStays: (last?.maxStays ?? last?.minStays ?? 0) + 1,
              maxStays: null,
              minNights: null,
              maxNights: null,
              benefits: [{ ...DEFAULT_BENEFIT }],
            })
          : makeTierItem({
              minStays: null,
              maxStays: null,
              minNights: (last?.maxNights ?? last?.minNights ?? 0) + 1,
              maxNights: null,
              benefits: [{ ...DEFAULT_BENEFIT }],
            });
      return { ...state, tiers: [...state.tiers, newTier] };
    }

    case "REMOVE_TIER":
      return {
        ...state,
        tiers: state.tiers.filter((_, i) => i !== action.tierIndex),
      };

    case "UPDATE_TIER":
      return {
        ...state,
        tiers: state.tiers.map((t, i) =>
          i === action.tierIndex ? { ...t, ...action.updates } : t
        ),
      };

    case "ADD_TIER_BENEFIT":
      return {
        ...state,
        tiers: state.tiers.map((t, i) =>
          i === action.tierIndex
            ? {
                ...t,
                benefits: [
                  ...t.benefits,
                  makeBenefitItem({ ...DEFAULT_BENEFIT, sortOrder: t.benefits.length }),
                ],
              }
            : t
        ),
      };

    case "UPDATE_TIER_BENEFIT":
      return {
        ...state,
        tiers: state.tiers.map((t, i) =>
          i === action.tierIndex
            ? {
                ...t,
                benefits: t.benefits.map((b, bi) =>
                  bi === action.benefitIndex ? { ...action.benefit, _id: b._id } : b
                ),
              }
            : t
        ),
      };

    case "REMOVE_TIER_BENEFIT":
      return {
        ...state,
        tiers: state.tiers.map((t, i) =>
          i === action.tierIndex
            ? { ...t, benefits: t.benefits.filter((_, bi) => bi !== action.benefitIndex) }
            : t
        ),
      };

    // ── Restrictions ────────────────────────────────────────────────────────

    case "ADD_RESTRICTION":
      return {
        ...state,
        activeRestrictions: new Set([...state.activeRestrictions, action.key]),
      };

    case "REMOVE_RESTRICTION": {
      const next = new Set(state.activeRestrictions);
      next.delete(action.key);
      const cleared = restrictionClearedValues(action.key);
      return {
        ...state,
        activeRestrictions: next,
        restrictions: { ...state.restrictions, ...cleared },
      };
    }

    case "UPDATE_RESTRICTIONS":
      return {
        ...state,
        restrictions: { ...state.restrictions, ...action.updates },
      };

    default:
      return state;
  }
}

/** Values to clear from `restrictions` when a restriction card is removed. */
function restrictionClearedValues(key: RestrictionKey): Partial<PromotionRestrictionsFormData> {
  switch (key) {
    case "min_spend":
      return { minSpend: "" };
    case "book_by_date":
      return { bookByDate: "" };
    case "min_nights":
      return { minNightsRequired: "", nightsStackable: false, spanStays: false };
    case "redemption_caps":
      return {
        maxStayCount: "",
        maxRewardCount: "",
        maxRedemptionValue: "",
        maxTotalBonusPoints: "",
      };
    case "tie_in_cards":
      return { tieInCreditCardIds: [], tieInRequiresPayment: false };
    case "registration":
      return { registrationDeadline: "", validDaysAfterRegistration: "", registrationDate: "" };
    case "payment_type":
      return { allowedPaymentTypes: [] };
    case "booking_source":
      return { allowedBookingSources: [] };
    case "hotel_chain":
      return { hotelChainId: "" };
    case "sub_brand_scope":
      return { subBrandIncludeIds: [], subBrandExcludeIds: [] };
    default:
      return {};
  }
}
