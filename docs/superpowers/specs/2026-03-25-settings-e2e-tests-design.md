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
  settings-credit-cards.spec.ts     # PR 2 — admin-scoped (absorbs card-benefits.spec.ts CRUD test)
  settings-shopping-portals.spec.ts # PR 2 — admin-scoped
  settings-ota-agencies.spec.ts     # PR 2 — admin-scoped
  settings-point-types.spec.ts      # PR 2 — admin-scoped
  settings-properties.spec.ts       # PR 2 — admin-scoped
```

`e2e/card-benefits.spec.ts` is deleted in PR 2. Its Settings CRUD test moves into
`settings-credit-cards.spec.ts`. Its "Auto-apply on booking" tests move into
`e2e/booking-benefits.spec.ts` (which already exists).

---

## Fixtures

| Tab              | Fixture                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| My Status        | `isolatedUser`                                                              |
| My Cards         | `isolatedUser` (+ `adminRequest` for the 409 test)                          |
| Hotel Chains     | `adminPage` + `adminRequest`                                                |
| Credit Cards     | `adminPage` + `adminRequest`                                                |
| Shopping Portals | `adminPage` + `adminRequest`                                                |
| OTA Agencies     | `adminPage` + `adminRequest` (+ `isolatedUser` for the 409 test)            |
| Point Types      | `adminPage` + `adminRequest`                                                |
| Properties       | `adminPage` (visibility check) + `isolatedUser` (negative visibility check) |

All test data is created and deleted via API. No UI-driven setup.
Each test is fully independent — no `test.describe.configure({ mode: "serial" })`.

---

## Coverage Per Tab

### My Status (`settings-my-status.spec.ts`)

Uses `isolatedUser`.

- Page loads and the status table shows seeded hotel chains
- Selecting an elite status saves it — verified by re-navigating to the page and checking the
  dropdown value persists
- Resetting to "Base Member / No Status" saves correctly — test first sets a non-base status
  within the same test body, then resets it, then re-navigates to verify
- Partnership toggle: relies on seeded partnership earn data from `global-setup.ts`. Enabling a
  partnership persists after reload; disabling it also persists.

**Implementation note:** `AppSelect` dropdowns in the status table have no `data-testid` today.
Per-chain selectors will need `data-testid={`status-select-${chain.id}`}` (or similar) added to
`user-status-tab.tsx`.

### My Cards (`settings-my-cards.spec.ts`)

Uses `isolatedUser`. The 409 conflict test also requires `adminRequest`.

- Empty state shown when the user has no cards
- **Add:** opens dialog, selects a card product, submits → card appears in the table
- **Edit:** opens edit dialog, changes nickname → updated value visible in table
- **Delete:** confirm dialog → card no longer in table
- **409 conflict:** create a card product via `adminRequest`, create a `UserCreditCard` via
  `isolatedUser.request`, create a booking referencing that UCC via `isolatedUser.request`,
  then attempt to delete the UCC from the UI → toast error appears and card remains

### Hotel Chains (`settings-hotel-chains.spec.ts`)

Uses `adminPage` + `adminRequest`. Tab trigger label is "Hotel Chains";
`TabsContent` testid is `tab-hotels`.

- **Add:** create a hotel chain with a unique name → appears in table; clean up via `adminRequest`
  in `finally`
- **Edit:** update the chain's name → new name visible in table
- **Sub-brands — add:** open sub-brands dialog, add a sub-brand → appears in the dialog list
- **Sub-brands — delete:** delete a sub-brand → removed from the dialog list

### Credit Cards (`settings-credit-cards.spec.ts`)

Uses `adminPage` + `adminRequest`. Absorbs the Settings CRUD test from `card-benefits.spec.ts`.

- **Add:** create a credit card → appears in the accordion list
- **Edit:** update the card name → new name visible in accordion
- **Card benefit (moved from `card-benefits.spec.ts`):** expand accordion, add a card benefit →
  appears in benefits table

### Shopping Portals (`settings-shopping-portals.spec.ts`)

Uses `adminPage` + `adminRequest`. The component has no delete UI — only Add and Edit are tested.
`TabsContent` testid is `tab-portals`.

- **Add:** create a portal → appears in table
- **Edit:** update name → updated in table

### OTA Agencies (`settings-ota-agencies.spec.ts`)

Uses `adminPage` + `adminRequest`. The 409 conflict test also requires `isolatedUser`.

- **Add:** create an agency → appears in table
- **Edit:** update name → updated in table
- **Delete:** confirm → removed from table
- **409 conflict:** create a fresh agency via `adminRequest`, create a booking referencing it via
  `isolatedUser.request`, then attempt to delete the agency from the admin UI → toast error appears
  and agency remains

### Point Types (`settings-point-types.spec.ts`)

Uses `adminPage` + `adminRequest`.

- **Add:** create a point type → appears in table
- **Edit:** update name → updated in table
- **Delete:** confirm dialog → removed from table
- **409 conflict:** create a point type via `adminRequest`, associate it with a hotel chain
  (also via `adminRequest`), then attempt to delete it from the admin UI → toast error appears
  and row remains; clean up the hotel chain and point type via API in `finally`

### Properties (`settings-properties.spec.ts`)

Uses `adminPage` for positive check, `isolatedUser` for negative check.

- **Admin can see the tab:** Properties tab trigger is visible when logged in as admin
- **Regular user cannot see the tab:** Properties tab trigger is not rendered for a non-admin user
  (verified with `isolatedUser`)
- **Read:** seeded properties appear in the list (basic smoke check via `adminPage`)

---

## data-testid Additions

Each tab will be audited during implementation. Minimal testids will be added to components only
where needed to support the tests above. No speculative additions.

Known gaps identified before implementation:

- `user-status-tab.tsx`: status `AppSelect` per chain needs `data-testid={`status-select-${chain.id}`}`
- `user-status-tab.tsx`: partnership checkbox already has `data-testid={`partnership-checkbox-${p.id}`}`

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
- Move "Auto-apply on booking" tests from `card-benefits.spec.ts` → `booking-benefits.spec.ts`
- Delete `e2e/card-benefits.spec.ts`
- Any `data-testid` additions to the relevant tab components
