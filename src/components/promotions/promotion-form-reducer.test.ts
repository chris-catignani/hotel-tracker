import { describe, it, expect } from "vitest";
import {
  promotionFormReducer,
  buildInitialState,
  toFormBenefit,
  toFormTier,
  PromotionFormState,
} from "./promotion-form-reducer";
import { DEFAULT_BENEFIT } from "./benefit-row";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeState(overrides?: Partial<PromotionFormState>): PromotionFormState {
  return { ...buildInitialState(), ...overrides };
}

// ── buildInitialState ────────────────────────────────────────────────────────

describe("buildInitialState", () => {
  it("uses sensible defaults when called with no initialData", () => {
    const state = buildInitialState();
    expect(state.name).toBe("");
    expect(state.type).toBe("loyalty");
    expect(state.isTiered).toBe(false);
    expect(state.benefits).toHaveLength(1);
    expect(state.tiers).toHaveLength(1);
    expect(state.activeRestrictions.size).toBe(0);
  });

  it("assigns stable _id to each benefit and tier", () => {
    const state = buildInitialState();
    expect(typeof state.benefits[0]._id).toBe("string");
    expect(state.benefits[0]._id.length).toBeGreaterThan(0);
    expect(typeof state.tiers[0]._id).toBe("string");
    expect(typeof state.tiers[0].benefits[0]._id).toBe("string");
  });

  it("populates from initialData", () => {
    const state = buildInitialState({
      name: "Summer Offer",
      type: "credit_card",
      creditCardId: "card-1",
      startDate: "2025-06-01",
    });
    expect(state.name).toBe("Summer Offer");
    expect(state.type).toBe("credit_card");
    expect(state.creditCardId).toBe("card-1");
    expect(state.startDate).toBe("2025-06-01");
  });

  it("sets isTiered when tiers are present", () => {
    const state = buildInitialState({
      tiers: [
        {
          minStays: 1,
          maxStays: 2,
          minNights: null,
          maxNights: null,
          benefits: [{ ...DEFAULT_BENEFIT }],
        },
      ],
    });
    expect(state.isTiered).toBe(true);
    expect(state.tiers).toHaveLength(1);
    expect(state.tiers[0].minStays).toBe(1);
  });
});

// ── SET_FIELD ────────────────────────────────────────────────────────────────

describe("SET_FIELD", () => {
  it("updates a scalar field", () => {
    const state = makeState();
    const next = promotionFormReducer(state, { type: "SET_FIELD", field: "name", value: "New" });
    expect(next.name).toBe("New");
    expect(next).not.toBe(state); // new reference
  });

  it("updates isTiered", () => {
    const state = makeState({ isTiered: false });
    const next = promotionFormReducer(state, {
      type: "SET_FIELD",
      field: "isTiered",
      value: true,
    });
    expect(next.isTiered).toBe(true);
  });
});

// ── LOAD_INITIAL_DATA ────────────────────────────────────────────────────────

describe("LOAD_INITIAL_DATA", () => {
  it("replaces state with freshly built initial state", () => {
    const state = makeState({ name: "old name" });
    const next = promotionFormReducer(state, {
      type: "LOAD_INITIAL_DATA",
      initialData: { name: "new name", type: "credit_card" },
    });
    expect(next.name).toBe("new name");
    expect(next.type).toBe("credit_card");
  });
});

// ── Flat benefit actions ─────────────────────────────────────────────────────

describe("ADD_BENEFIT", () => {
  it("appends a new benefit with a unique _id", () => {
    const state = makeState();
    const next = promotionFormReducer(state, { type: "ADD_BENEFIT" });
    expect(next.benefits).toHaveLength(2);
    expect(next.benefits[1]._id).not.toBe(next.benefits[0]._id);
  });
});

describe("UPDATE_BENEFIT", () => {
  it("updates the benefit at the given index while preserving _id", () => {
    const state = makeState();
    const originalId = state.benefits[0]._id;
    const next = promotionFormReducer(state, {
      type: "UPDATE_BENEFIT",
      index: 0,
      benefit: { ...DEFAULT_BENEFIT, value: 500 },
    });
    expect(next.benefits[0].value).toBe(500);
    expect(next.benefits[0]._id).toBe(originalId);
  });

  it("does not mutate other benefits", () => {
    const state = promotionFormReducer(makeState(), { type: "ADD_BENEFIT" });
    const id1 = state.benefits[0]._id;
    const next = promotionFormReducer(state, {
      type: "UPDATE_BENEFIT",
      index: 1,
      benefit: { ...DEFAULT_BENEFIT, value: 999 },
    });
    expect(next.benefits[0]._id).toBe(id1);
    expect(next.benefits[0].value).not.toBe(999);
  });
});

describe("REMOVE_BENEFIT", () => {
  it("removes the benefit at the given index", () => {
    const state = promotionFormReducer(makeState(), { type: "ADD_BENEFIT" });
    const idToKeep = state.benefits[1]._id;
    const next = promotionFormReducer(state, { type: "REMOVE_BENEFIT", index: 0 });
    expect(next.benefits).toHaveLength(1);
    expect(next.benefits[0]._id).toBe(idToKeep);
  });
});

// ── Tier actions ─────────────────────────────────────────────────────────────

describe("ADD_TIER", () => {
  it("appends a new tier with a unique _id", () => {
    const state = makeState({ isTiered: true, tierRequirementType: "stays" });
    const next = promotionFormReducer(state, { type: "ADD_TIER" });
    expect(next.tiers).toHaveLength(2);
    expect(next.tiers[1]._id).not.toBe(next.tiers[0]._id);
  });

  it("sets minStays based on the last tier's maxStays", () => {
    const state = makeState({ isTiered: true, tierRequirementType: "stays" });
    const withMax = promotionFormReducer(state, {
      type: "UPDATE_TIER",
      tierIndex: 0,
      updates: { minStays: 1, maxStays: 3 },
    });
    const next = promotionFormReducer(withMax, { type: "ADD_TIER" });
    expect(next.tiers[1].minStays).toBe(4);
  });

  it("sets minNights when tierRequirementType is nights", () => {
    const state = makeState({ isTiered: true, tierRequirementType: "nights" });
    const withMax = promotionFormReducer(state, {
      type: "UPDATE_TIER",
      tierIndex: 0,
      updates: { minNights: 5, maxNights: 9 },
    });
    const next = promotionFormReducer(withMax, { type: "ADD_TIER" });
    expect(next.tiers[1].minNights).toBe(10);
  });
});

describe("REMOVE_TIER", () => {
  it("removes the tier at the given index", () => {
    const withTwo = promotionFormReducer(makeState({ isTiered: true }), { type: "ADD_TIER" });
    const idToKeep = withTwo.tiers[1]._id;
    const next = promotionFormReducer(withTwo, { type: "REMOVE_TIER", tierIndex: 0 });
    expect(next.tiers).toHaveLength(1);
    expect(next.tiers[0]._id).toBe(idToKeep);
  });
});

describe("UPDATE_TIER", () => {
  it("updates only the specified tier fields", () => {
    const state = makeState({ isTiered: true });
    const originalId = state.tiers[0]._id;
    const next = promotionFormReducer(state, {
      type: "UPDATE_TIER",
      tierIndex: 0,
      updates: { minStays: 2 },
    });
    expect(next.tiers[0].minStays).toBe(2);
    expect(next.tiers[0]._id).toBe(originalId);
  });
});

// ── Tier benefit actions ─────────────────────────────────────────────────────

describe("ADD_TIER_BENEFIT", () => {
  it("appends a new benefit to the specified tier", () => {
    const state = makeState({ isTiered: true });
    const next = promotionFormReducer(state, { type: "ADD_TIER_BENEFIT", tierIndex: 0 });
    expect(next.tiers[0].benefits).toHaveLength(2);
    expect(next.tiers[0].benefits[1]._id).not.toBe(next.tiers[0].benefits[0]._id);
  });
});

describe("UPDATE_TIER_BENEFIT", () => {
  it("updates the benefit while preserving _id", () => {
    const state = makeState({ isTiered: true });
    const originalId = state.tiers[0].benefits[0]._id;
    const next = promotionFormReducer(state, {
      type: "UPDATE_TIER_BENEFIT",
      tierIndex: 0,
      benefitIndex: 0,
      benefit: { ...DEFAULT_BENEFIT, value: 1000 },
    });
    expect(next.tiers[0].benefits[0].value).toBe(1000);
    expect(next.tiers[0].benefits[0]._id).toBe(originalId);
  });
});

describe("REMOVE_TIER_BENEFIT", () => {
  it("removes the benefit at the given index from the specified tier", () => {
    const withTwo = promotionFormReducer(makeState({ isTiered: true }), {
      type: "ADD_TIER_BENEFIT",
      tierIndex: 0,
    });
    const idToKeep = withTwo.tiers[0].benefits[1]._id;
    const next = promotionFormReducer(withTwo, {
      type: "REMOVE_TIER_BENEFIT",
      tierIndex: 0,
      benefitIndex: 0,
    });
    expect(next.tiers[0].benefits).toHaveLength(1);
    expect(next.tiers[0].benefits[0]._id).toBe(idToKeep);
  });
});

// ── Restriction actions ──────────────────────────────────────────────────────

describe("ADD_RESTRICTION", () => {
  it("adds the restriction key to activeRestrictions", () => {
    const state = makeState();
    const next = promotionFormReducer(state, { type: "ADD_RESTRICTION", key: "min_spend" });
    expect(next.activeRestrictions.has("min_spend")).toBe(true);
  });
});

describe("REMOVE_RESTRICTION", () => {
  it("removes the restriction key and clears its fields", () => {
    const withRestriction = promotionFormReducer(
      makeState({ restrictions: { ...buildInitialState().restrictions, minSpend: "100" } }),
      { type: "ADD_RESTRICTION", key: "min_spend" }
    );
    const next = promotionFormReducer(withRestriction, {
      type: "REMOVE_RESTRICTION",
      key: "min_spend",
    });
    expect(next.activeRestrictions.has("min_spend")).toBe(false);
    expect(next.restrictions.minSpend).toBe("");
  });

  it("clears all fields for redemption_caps", () => {
    const state = makeState({
      restrictions: {
        ...buildInitialState().restrictions,
        maxStayCount: "5",
        maxRewardCount: "3",
        maxRedemptionValue: "200",
        maxTotalBonusPoints: "10000",
      },
    });
    const next = promotionFormReducer(state, {
      type: "REMOVE_RESTRICTION",
      key: "redemption_caps",
    });
    expect(next.restrictions.maxStayCount).toBe("");
    expect(next.restrictions.maxRedemptionValue).toBe("");
    expect(next.restrictions.maxTotalBonusPoints).toBe("");
  });
});

describe("UPDATE_RESTRICTIONS", () => {
  it("merges partial restriction updates", () => {
    const state = makeState();
    const next = promotionFormReducer(state, {
      type: "UPDATE_RESTRICTIONS",
      updates: { minSpend: "50" },
    });
    expect(next.restrictions.minSpend).toBe("50");
    // Other restriction fields unchanged
    expect(next.restrictions.bookByDate).toBe(state.restrictions.bookByDate);
  });
});

// ── toFormBenefit / toFormTier ────────────────────────────────────────────────

describe("toFormBenefit", () => {
  it("strips _id from a BenefitItem", () => {
    const state = buildInitialState();
    const item = state.benefits[0];
    const form = toFormBenefit(item);
    expect("_id" in form).toBe(false);
    expect(form.value).toBe(item.value);
  });
});

describe("toFormTier", () => {
  it("strips _id from a TierItem and its benefits", () => {
    const state = buildInitialState();
    const item = state.tiers[0];
    const form = toFormTier(item);
    expect("_id" in form).toBe(false);
    expect("_id" in form.benefits[0]).toBe(false);
  });
});
