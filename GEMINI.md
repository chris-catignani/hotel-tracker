# Gemini CLI Project Mandates

This file provides foundational mandates for Gemini CLI (gemini-cli) when working in this repository.

## Schema Change Workflow

**When a task requires Prisma schema changes, always show the proposed schema diff to the user for review and approval _before_ implementing the rest of the code** (API routes, types, UI, tests). This prevents rework when the design needs adjustment.

## App Architecture

- **Single-user bookings and promotions:** Each user has their own isolated bookings and promotions. Promotions and bookings are NOT shared across users. This means race conditions in redemption constraint checks are not a concern — no need to implement database-level serialization or row-level locking.

## Engineering Mandates

- **Savings Explanations:** When adding new promotion types, portal reward options, or modifying loyalty logic, you **MUST** update the `getNetCostBreakdown` function in `src/lib/net-cost.ts` to include detailed, human-readable explanations (description and formula) for the new logic.
- **Cost Basis:** All explanations must explicitly state whether the calculation is based on the **pre-tax cost** or the **total cost**.
- **UI Consistency:** Ensure the `CostBreakdown` component (src/components/cost-breakdown.tsx) is updated as necessary to accommodate any new breakdown items or calculation types.
- **Benefit Value Consistency:** When redemption constraints cap promotion values (e.g., `maxRedemptionValue`, `maxTotalBonusPoints`), the individual `appliedValue` on each `BenefitApplication` must be proportionally scaled to maintain consistency with the total capped `appliedValue`.

### Promotion Matching & Orphaned Logic

Promotions must be matched and labeled according to three tiers evaluated in order:

1. **Structural Match (Invisible if Mismatched):**
   If any structural criteria fail for this booking, the promotion MUST be skipped entirely — hidden from the UI with no badge. There is no "structural orphan" state; structural incompatibility always means invisible.
   - **Fields:** Hotel Chain ID, Credit Card ID, Shopping Portal ID, Sub-brand Restrictions, Stay Dates, Registration Deadline, Book-by Date, Booking Source, Payment Type, and Tie-in Cards.

2. **Hard Caps (Maxed Out):**
   Checked before fulfillment. If a hard limit is reached, show $0 with no badge.
   - **Fields:** Max Stay Count, Once Per Sub-brand, Max Reward Count.

3. **Fulfillment (Pre-qualifying vs. Orphaned):**
   Evaluated only if structural match passes and no hard cap was hit.
   - **Pre-qualifying:** Campaign requirements not yet met (prerequisites, tiers, span-stays nights), but future booked stays exist that could complete it → Show $0 (or pro-rated value for span-stays) with **"Pre-qualifying" badge**.
   - **Orphaned:** Campaign requirements not met AND no future booked stays can complete it → Show **$0** with **"Orphaned" badge**.
   - "Orphaned" specifically means: not enough stays/nights accumulated across the campaign to earn the promotion.

#### Span-stays partial cycle display (`net-cost.ts`)

When a span-stays campaign ends with an incomplete final cycle (`isRemainderOrphaned`), completed cycles earn their full value and the partial cycle earns $0. The partial cycle segment label depends on whether the benefit cap was exhausted:

- **"Orphaned Reward Cycle"**: The cap (`maxTotalBonusPoints` or `maxRedemptionValue`) was NOT exhausted — the cycle simply ran out of eligible nights. Computed as: `floor(eligibleNightsAtBooking / minNightsRequired) × benefitValue < maxTotalBonusPoints`.
- **"Capped Reward Cycle"**: The cap WAS fully exhausted by all completed cycles across the campaign. Computed as: `floor(eligibleNightsAtBooking / minNightsRequired) × benefitValue >= maxTotalBonusPoints`.

`eligibleNightsAtBooking` (stored on `BookingPromotionBenefit`) is the cumulative eligible nights at the END of this booking (prior nights + this booking's nights). This is the source of truth for all span-stays display calculations in `net-cost.ts`.

## Testing Mandates

- **Verification:** ALWAYS run all unit tests (`npm test`) and E2E tests (`npm run test:e2e`) locally before creating or pushing updates to a Pull Request. A task is not considered ready for review until all local tests pass.
- **Test Coverage:** ALWAYS write unit tests (Vitest/RTL) for every feature or fix created. ALWAYS write E2E tests (Playwright) for features that involve UI flows. E2E tests run in CI.
- **Precise Selectors:** ALWAYS use `data-testid` attributes on React components for specific values or elements to be tested (e.g., `data-testid="stat-value-total-bookings"`). This avoids ambiguity and ensures tests are robust against formatting changes.

### E2E Test Design

**Isolation strategy:** Each test that needs data creates it via direct API calls and deletes it afterward. Tests MUST NOT create data through the UI — UI form navigation is slow and timing-sensitive (especially the date picker).

**Fixtures:** `e2e/fixtures.ts` exports a custom `test` object with reusable fixtures:

- `testBooking` — creates a booking via `POST /api/bookings` with a UUID-unique property name, yields it to the test, then deletes it via `DELETE /api/bookings/:id` after the test.

Always import `test` and `expect` from `./fixtures` (not from `@playwright/test`) in spec files.

**Reference data** (hotel chains, credit cards, portals) is seeded once in `e2e/global-setup.ts` and treated as read-only.

## Workflow Mandates

- **Pull Requests:** ALWAYS create a feature branch for any and all code changes. After implementation, notify the user to test the changes locally. ONLY create a Pull Request (PR) after the user has confirmed they have tested and approved the work.
- **Merging:** NEVER merge a PR or delete a feature branch until specifically instructed to do so by the user. NEVER apply changes directly to the main branch. A task is not considered complete until the PR is merged after user approval.

## GitHub CLI

- **Sub-issue linking:** When creating sub-tasks or sub-issues for a parent GitHub issue, ALWAYS formally link them as children using the 'Sub-issues' feature (via GraphQL `addSubIssue` or equivalent) so they appear in the parent's dedicated "Sub-issues" area.
- **Do NOT use `gh pr view --comments`** — it queries the deprecated Projects (classic) GraphQL API and returns exit code 1.
- To read PR review comments use: `gh api repos/{owner}/{repo}/pulls/{pr}/comments`
- To read general PR/issue comments use: `gh api repos/{owner}/{repo}/issues/{pr}/comments`
- To read review summaries use: `gh api repos/{owner}/{repo}/pulls/{pr}/reviews`
