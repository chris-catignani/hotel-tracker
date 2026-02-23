# Gemini CLI Project Mandates

This file provides foundational mandates for Gemini CLI (gemini-cli) when working in this repository.

## Engineering Mandates

- **Savings Explanations:** When adding new promotion types, portal reward options, or modifying loyalty logic, you **MUST** update the `getNetCostBreakdown` function in `src/lib/net-cost.ts` to include detailed, human-readable explanations (description and formula) for the new logic.
- **Cost Basis:** All explanations must explicitly state whether the calculation is based on the **pre-tax cost** or the **total cost**.
- **UI Consistency:** Ensure the `CostBreakdown` component (src/components/cost-breakdown.tsx) is updated as necessary to accommodate any new breakdown items or calculation types.

## Testing Mandates

- **Test Coverage:** ALWAYS write unit tests (Vitest/RTL) for every feature or fix created. ALWAYS write E2E tests (Playwright) for features that involve UI flows. E2E tests run in CI.
- **Precise Selectors:** ALWAYS use `data-testid` attributes on React components for specific values or elements to be tested (e.g., `data-testid="stat-value-total-bookings"`). This avoids ambiguity and ensures tests are robust against formatting changes.

### E2E Test Design

**Isolation strategy:** Each test that needs data creates it via direct API calls and deletes it afterward. Tests MUST NOT create data through the UI — UI form navigation is slow and timing-sensitive (especially the date picker).

**Fixtures:** `e2e/fixtures.ts` exports a custom `test` object with reusable fixtures:

- `testBooking` — creates a booking via `POST /api/bookings` with a UUID-unique property name, yields it to the test, then deletes it via `DELETE /api/bookings/:id` after the test.

Always import `test` and `expect` from `./fixtures` (not from `@playwright/test`) in spec files.

**Reference data** (hotel chains, credit cards, portals) is seeded once in `e2e/global-setup.ts` and treated as read-only.

## GitHub CLI

- **Do NOT use `gh pr view --comments`** — it queries the deprecated Projects (classic) GraphQL API and returns exit code 1.
- To read PR review comments use: `gh api repos/{owner}/{repo}/pulls/{pr}/comments`
- To read general PR/issue comments use: `gh api repos/{owner}/{repo}/issues/{pr}/comments`
- To read review summaries use: `gh api repos/{owner}/{repo}/pulls/{pr}/reviews`
