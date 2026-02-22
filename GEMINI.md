# Gemini CLI Project Mandates

This file provides foundational mandates for Gemini CLI (gemini-cli) when working in this repository.

## Engineering Mandates

- **Savings Explanations:** When adding new promotion types, portal reward options, or modifying loyalty logic, you **MUST** update the `getNetCostBreakdown` function in `src/lib/net-cost.ts` to include detailed, human-readable explanations (description and formula) for the new logic.
- **Cost Basis:** All explanations must explicitly state whether the calculation is based on the **pre-tax cost** or the **total cost**.
- **UI Consistency:** Ensure the `CostBreakdown` component (src/components/cost-breakdown.tsx) is updated as necessary to accommodate any new breakdown items or calculation types.

## Testing Mandates

- **Test Coverage:** ALWAYS write both unit tests (Vitest/RTL) and E2E tests (Playwright) for every feature or fix created.
- **Precise Selectors:** ALWAYS use `data-testid` attributes on React components for specific values or elements to be tested (e.g., `data-testid="stat-value-total-bookings"`). This avoids ambiguity and ensures tests are robust against formatting changes.
