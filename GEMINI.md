# Gemini CLI Project Mandates

This file provides foundational mandates for Gemini CLI (gemini-cli) when working in this repository.

## Engineering Mandates

- **Savings Explanations:** When adding new promotion types, portal reward options, or modifying loyalty logic, you **MUST** update the `getNetCostBreakdown` function in `src/lib/net-cost.ts` to include detailed, human-readable explanations (description and formula) for the new logic.
- **Cost Basis:** All explanations must explicitly state whether the calculation is based on the **pre-tax cost** or the **total cost**.
- **UI Consistency:** Ensure the `CostBreakdown` component (src/components/cost-breakdown.tsx) is updated as necessary to accommodate any new breakdown items or calculation types.
