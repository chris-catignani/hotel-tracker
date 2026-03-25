# Settings Page E2E Tests — Design Spec

**Date:** 2026-03-25
**Scope:** CRUD coverage for all 8 settings tabs. Cascading-effect tests are out of scope for now.
**Issue:** Closes #64 (partially — CRUD only; cascading effects deferred)

---

## File Structure

```
e2e/
  settings-my-status.spec.ts        # PR 1 — user-scoped
  settings-my-cards.spec.ts         # PR 1 — user-scoped
  settings-hotel-chains.spec.ts     # PR 2 — admin-scoped
  settings-credit-cards.spec.ts     # PR 2 — admin-scoped (absorbs card-benefits.spec.ts)
  settings-shopping-portals.spec.ts # PR 2 — admin-scoped
  settings-ota-agencies.spec.ts     # PR 2 — admin-scoped
  settings-point-types.spec.ts      # PR 2 — admin-scoped
  settings-properties.spec.ts       # PR 2 — admin-scoped
```

`e2e/card-benefits.spec.ts` is deleted in PR 2; its test is moved into `settings-credit-cards.spec.ts`.

---

## Fixtures

| Tab              | Fixture                      |
| ---------------- | ---------------------------- |
| My Status        | `isolatedUser`               |
| My Cards         | `isolatedUser`               |
| Hotel Chains     | `adminPage` + `adminRequest` |
| Credit Cards     | `adminPage` + `adminRequest` |
| Shopping Portals | `adminPage` + `adminRequest` |
| OTA Agencies     | `adminPage` + `adminRequest` |
| Point Types      | `adminPage` + `adminRequest` |
| Properties       | `adminPage` + `adminRequest` |

All test data is created and deleted via API. No UI-driven setup.
Each test is fully independent — no `test.describe.configure({ mode: "serial" })`.

---

## Coverage Per Tab

### My Status (`settings-my-status.spec.ts`)

Uses `isolatedUser`.

- Page loads and the status table shows seeded hotel chains
- Selecting an elite status saves it — verified by re-navigating to the page and checking the dropdown value
- Resetting to "Base Member / No Status" saves correctly
- Partnership toggle: enabling a partnership persists after reload; disabling it also persists

### My Cards (`settings-my-cards.spec.ts`)

Uses `isolatedUser`.

- Empty state shown when the user has no cards
- **Add:** opens dialog, selects a card product, submits → card appears in the table
- **Edit:** opens edit dialog, changes nickname → updated value visible in table
- **Delete:** confirm dialog → card no longer in table
- **409 conflict:** attempting to delete a card referenced by a booking shows a toast error and the card remains

### Hotel Chains (`settings-hotel-chains.spec.ts`)

Uses `adminPage` + `adminRequest`.

- **Add:** create a hotel chain with a unique name → appears in table; delete via API in `finally`
- **Edit:** update the chain's name → new name visible in table
- **Sub-brands — add:** open sub-brands dialog, add a sub-brand → appears in the dialog list
- **Sub-brands — delete:** delete a sub-brand → removed from the dialog list

### Credit Cards (`settings-credit-cards.spec.ts`)

Uses `adminPage` + `adminRequest`. Absorbs the existing card benefit test from `card-benefits.spec.ts`.

- **Add:** create a credit card → appears in the accordion list
- **Edit:** update the card name → new name visible in accordion
- **Card benefit (moved from card-benefits.spec.ts):** expand accordion, add a card benefit → appears in benefits table

### Shopping Portals (`settings-shopping-portals.spec.ts`)

Uses `adminPage` + `adminRequest`.

- **Add:** create a portal → appears in table
- **Edit:** update name → updated in table
- **Delete:** confirm → removed from table

### OTA Agencies (`settings-ota-agencies.spec.ts`)

Uses `adminPage` + `adminRequest`.

- **Add:** create an agency → appears in table
- **Edit:** update name → updated in table
- **Delete:** confirm → removed from table
- **409 conflict:** attempting to delete an agency referenced by a booking shows a toast error and the agency remains

### Point Types (`settings-point-types.spec.ts`)

Uses `adminPage` + `adminRequest`.

- **Add:** create a point type → appears in table
- **Edit:** update name → updated in table

### Properties (`settings-properties.spec.ts`)

Uses `adminPage` + `adminRequest`.

- **Admin-only visibility:** Properties tab is visible when logged in as admin
- **Read:** seeded properties appear in the list (basic smoke check)

---

## data-testid Additions

Each tab will be audited during implementation. Minimal testids will be added to components only where needed to support the tests above. No speculative additions.

---

## PR Plan

**PR 1 — User tabs**

- `e2e/settings-my-status.spec.ts`
- `e2e/settings-my-cards.spec.ts`
- Any `data-testid` additions to `user-status-tab.tsx` and `my-cards-tab.tsx`

**PR 2 — Admin tabs**

- `e2e/settings-hotel-chains.spec.ts`
- `e2e/settings-credit-cards.spec.ts`
- `e2e/settings-shopping-portals.spec.ts`
- `e2e/settings-ota-agencies.spec.ts`
- `e2e/settings-point-types.spec.ts`
- `e2e/settings-properties.spec.ts`
- Delete `e2e/card-benefits.spec.ts`
- Any `data-testid` additions to the relevant tab components
