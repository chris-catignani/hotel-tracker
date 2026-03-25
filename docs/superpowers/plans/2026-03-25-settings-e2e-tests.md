# Settings Page E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add E2E tests for all 8 settings tabs (CRUD coverage), split into two PRs.

**Architecture:** Each tab gets its own spec file. User-scoped tabs (My Status, My Cards) use `isolatedUser`; admin tabs use `adminPage`/`adminRequest`. All test data created via API, cleaned up in `finally`. No serial test modes. Missing `data-testid` attributes added to components as discovered per tab.

**Tech Stack:** Playwright, TypeScript, Next.js App Router, custom `test`/`expect` from `e2e/fixtures.ts`

**Commit note:** Intermediate per-task `git commit` steps below are local development commits and do not require the `commit-push-pr` skill. Tasks 3 and 11 (opening PRs) explicitly use the skill.

**Spec:** `docs/superpowers/specs/2026-03-25-settings-e2e-tests-design.md`

---

## File Map

### PR 1 — User Tabs

| Action | File                                          |
| ------ | --------------------------------------------- |
| Modify | `src/components/settings/user-status-tab.tsx` |
| Create | `e2e/settings-my-status.spec.ts`              |
| Modify | `src/components/settings/my-cards-tab.tsx`    |
| Create | `e2e/settings-my-cards.spec.ts`               |

### PR 2 — Admin Tabs

| Action | File                                           |
| ------ | ---------------------------------------------- |
| Modify | `src/components/settings/hotel-chains-tab.tsx` |
| Create | `e2e/settings-hotel-chains.spec.ts`            |
| Create | `e2e/settings-credit-cards.spec.ts`            |
| Create | `e2e/settings-shopping-portals.spec.ts`        |
| Modify | `src/components/settings/ota-agencies-tab.tsx` |
| Create | `e2e/settings-ota-agencies.spec.ts`            |
| Create | `e2e/settings-point-types.spec.ts`             |
| Create | `e2e/settings-properties.spec.ts`              |
| Modify | `e2e/booking-benefits.spec.ts`                 |
| Delete | `e2e/card-benefits.spec.ts`                    |

---

## Existing `data-testid` Inventory

Before adding new testids, know what already exists:

**`user-status-tab.tsx`:** `user-status-table`, `partnership-checkbox-${p.id}` — **missing:** status AppSelect per chain

**`my-cards-tab.tsx`:** `add-my-card-button`, `add-card-select`, `add-my-card-save`, `edit-my-card-save`, `my-card-row`, `my-card-name`, `my-cards-empty`, `my-cards-desktop` — **missing:** Edit/Delete buttons on desktop table rows

**`hotel-chains-tab.tsx`:** `add-hotel-chain-button`, `hotel-chain-table-row`, `hotel-chain-table-name` — **missing:** Sub-brands and Edit buttons

**`credit-card-accordion-item.tsx`:** `credit-card-accordion`, `accordion-header-${card.id}`, `credit-card-card-name`, `edit-credit-card-name-button`, `credit-card-name-input`, `save-credit-card-name-button`, `delete-credit-card-button` — **no additions needed**

**`card-benefits-section.tsx`** (rendered inside accordion): `add-card-benefit-button`, `add-description-input`, `add-value-input`, `add-period-select`, `add-card-benefit-save`, `card-benefit-row`, `card-benefit-description` — these use a `prefix` prop set to `"add"`, so the rendered testids are the literal strings above. **No additions needed.**

**`shopping-portals-tab.tsx`:** `add-portal-button`, `portal-row`, `portal-name` — **no additions needed** (no delete UI)

**`ota-agencies-tab.tsx`:** `add-agency-button`, `agency-row`, `agency-name` — **missing:** Edit/Delete buttons on table rows

**`point-types-tab.tsx`:** `add-point-type-button`, `point-type-row`, `point-type-name` — **no additions needed**

---

## PR 1 — User Tabs

---

### Task 1: My Status tab — add testids + write spec

**Files:**

- Modify: `src/components/settings/user-status-tab.tsx`
- Create: `e2e/settings-my-status.spec.ts`

- [ ] **Step 1: Add `data-testid` to the status AppSelect in `user-status-tab.tsx`**

In the `TableBody`, each chain row renders an `AppSelect`. Add a testid keyed by chain id:

```tsx
// user-status-tab.tsx ~line 128
<AppSelect
  value={currentStatus?.eliteStatusId ? currentStatus.eliteStatusId : "none"}
  onValueChange={(v) => handleStatusChange(chain.id, v)}
  options={[...]}
  className="w-[200px]"
  placeholder="Select status..."
  data-testid={`status-select-${chain.id}`}
/>
```

- [ ] **Step 2: Write `e2e/settings-my-status.spec.ts`**

```typescript
import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";

test.describe("Settings — My Status", () => {
  test("status table shows hotel chains", async ({ isolatedUser }) => {
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId("user-status-table")).toBeVisible();
    // At least one data row visible (seeded chains exist)
    await expect(page.getByTestId("user-status-table").getByRole("row").first()).toBeVisible();
  });

  test("selecting an elite status persists after reload", async ({ isolatedUser }) => {
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId("user-status-table")).toBeVisible();

    // Select a seeded Hyatt elite status
    // Seeded Hyatt statuses: Discoverist, Explorist, Globalist
    await page.getByTestId(`status-select-${HOTEL_ID.HYATT}`).click();
    await page.getByRole("option", { name: "Explorist" }).click();

    await page.reload();
    await expect(page.getByTestId("user-status-table")).toBeVisible();
    await expect(page.getByTestId(`status-select-${HOTEL_ID.HYATT}`)).toContainText("Explorist");
  });

  test("resetting status to base member persists after reload", async ({ isolatedUser }) => {
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId("user-status-table")).toBeVisible();

    // First set a non-base status, then reset it
    await page.getByTestId(`status-select-${HOTEL_ID.HYATT}`).click();
    await page.getByRole("option", { name: "Explorist" }).click();

    await page.getByTestId(`status-select-${HOTEL_ID.HYATT}`).click();
    await page.getByRole("option", { name: "Base Member / No Status" }).click();

    await page.reload();
    await expect(page.getByTestId("user-status-table")).toBeVisible();
    await expect(page.getByTestId(`status-select-${HOTEL_ID.HYATT}`)).toContainText(
      "Base Member / No Status"
    );
  });

  test("enabling a partnership persists after reload", async ({ isolatedUser }) => {
    // Relies on seeded partnership earn data (global-setup.ts seeds partnership earns)
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByTestId("tab-my-status")).toBeVisible();

    // Find all partnership checkboxes and pick the first one
    const checkboxes = page.locator('[data-testid^="partnership-checkbox-"]');
    const checkboxCount = await checkboxes.count();
    if (checkboxCount === 0) {
      test.skip();
      return;
    }

    // Extract the stable testid of the first checkbox so we can re-query it after reload
    const firstCheckbox = checkboxes.first();
    const testId = await firstCheckbox.getAttribute("data-testid");
    if (!testId) throw new Error("Could not read partnership checkbox testid");

    // Ensure it ends up enabled: enable if currently disabled
    const isChecked = await firstCheckbox.isChecked();
    if (!isChecked) {
      await firstCheckbox.click();
    }

    // Verify it persists after reload using the stable testid
    await page.reload();
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId(testId)).toBeChecked();
  });
});
```

- [ ] **Step 3: Run the spec**

```bash
npx playwright test e2e/settings-my-status.spec.ts --project=chromium
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/user-status-tab.tsx e2e/settings-my-status.spec.ts
git commit -m "test: E2E coverage for Settings — My Status tab"
```

---

### Task 2: My Cards tab — add testids + write spec

**Files:**

- Modify: `src/components/settings/my-cards-tab.tsx`
- Create: `e2e/settings-my-cards.spec.ts`

- [ ] **Step 1: Add `data-testid` to Edit/Delete buttons in the desktop table**

In `my-cards-tab.tsx`, the desktop table's action cell (around line 390):

```tsx
<div className="flex gap-2">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleEdit(card)}
    data-testid="my-card-edit-button"
  >
    Edit
  </Button>
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleDeleteClick(card)}
    data-testid="my-card-delete-button"
  >
    Delete
  </Button>
</div>
```

- [ ] **Step 2: Write `e2e/settings-my-cards.spec.ts`**

```typescript
import crypto from "crypto";
import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";

const YEAR = new Date().getFullYear();

test.describe("Settings — My Cards", () => {
  test("shows empty state when user has no cards", async ({ isolatedUser }) => {
    const { page } = isolatedUser;
    await page.goto("/settings");
    await page.getByRole("tab", { name: "My Cards" }).click();
    await expect(page.getByTestId("tab-my-cards")).toBeVisible();
    await expect(page.getByTestId("my-cards-empty")).toBeVisible();
  });

  test("adds a card and it appears in the table", async ({ isolatedUser, adminRequest }) => {
    const { page } = isolatedUser;

    // Create a card product for the test
    const cardRes = await adminRequest.post("/api/credit-cards", {
      data: { name: `Test Card ${crypto.randomUUID()}`, rewardType: "cashback", rewardRate: 0.02 },
    });
    const card = await cardRes.json();

    try {
      await page.goto("/settings");
      await page.getByRole("tab", { name: "My Cards" }).click();
      await expect(page.getByTestId("tab-my-cards")).toBeVisible();

      await page.getByTestId("add-my-card-button").click();
      await page.getByTestId("add-card-select").click();
      await page.getByRole("option", { name: card.name }).click();
      await page.getByTestId("add-my-card-save").click();

      await expect(
        page
          .getByTestId("my-cards-desktop")
          .locator('[data-testid="my-card-row"]')
          .filter({ has: page.getByTestId("my-card-name").filter({ hasText: card.name }) })
      ).toBeVisible();
    } finally {
      // Clean up: find and delete the user credit card
      const uccRes = await isolatedUser.request.get("/api/user-credit-cards");
      const uccs = await uccRes.json();
      const ucc = uccs.find((u: { creditCardId: string }) => u.creditCardId === card.id);
      if (ucc) await isolatedUser.request.delete(`/api/user-credit-cards/${ucc.id}`);
      await adminRequest.delete(`/api/credit-cards/${card.id}`);
    }
  });

  test("edits a card nickname and it updates in the table", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const { page, request } = isolatedUser;

    const cardRes = await adminRequest.post("/api/credit-cards", {
      data: { name: `Edit Card ${crypto.randomUUID()}`, rewardType: "cashback", rewardRate: 0.02 },
    });
    const card = await cardRes.json();
    const uccRes = await request.post("/api/user-credit-cards", {
      data: { creditCardId: card.id },
    });
    const ucc = await uccRes.json();

    try {
      await page.goto("/settings");
      await page.getByRole("tab", { name: "My Cards" }).click();
      await expect(page.getByTestId("tab-my-cards")).toBeVisible();

      const row = page
        .getByTestId("my-cards-desktop")
        .locator('[data-testid="my-card-row"]')
        .filter({ has: page.getByTestId("my-card-name").filter({ hasText: card.name }) });

      await row.getByTestId("my-card-edit-button").click();

      const nickname = `Nick ${crypto.randomUUID().slice(0, 8)}`;
      await page.getByTestId("edit-nickname-input").fill(nickname);
      await page.getByTestId("edit-my-card-save").click();

      await expect(
        page
          .getByTestId("my-cards-desktop")
          .locator('[data-testid="my-card-row"]')
          .filter({ has: page.getByTestId("my-card-name").filter({ hasText: card.name }) })
      ).toContainText(nickname);
    } finally {
      await request.delete(`/api/user-credit-cards/${ucc.id}`);
      await adminRequest.delete(`/api/credit-cards/${card.id}`);
    }
  });

  test("deletes a card and it is removed from the table", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const { page, request } = isolatedUser;

    const cardRes = await adminRequest.post("/api/credit-cards", {
      data: { name: `Del Card ${crypto.randomUUID()}`, rewardType: "cashback", rewardRate: 0.02 },
    });
    const card = await cardRes.json();
    const uccRes = await request.post("/api/user-credit-cards", {
      data: { creditCardId: card.id },
    });
    const ucc = await uccRes.json();

    try {
      await page.goto("/settings");
      await page.getByRole("tab", { name: "My Cards" }).click();
      await expect(page.getByTestId("tab-my-cards")).toBeVisible();

      const row = page
        .getByTestId("my-cards-desktop")
        .locator('[data-testid="my-card-row"]')
        .filter({ has: page.getByTestId("my-card-name").filter({ hasText: card.name }) });

      await row.getByTestId("my-card-delete-button").click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

      await expect(row).not.toBeVisible();
    } finally {
      // UCC may already be deleted; ignore 404
      await request.delete(`/api/user-credit-cards/${ucc.id}`).catch(() => {});
      await adminRequest.delete(`/api/credit-cards/${card.id}`);
    }
  });

  test("shows toast when deleting a card referenced by a booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const { page, request } = isolatedUser;

    const cardRes = await adminRequest.post("/api/credit-cards", {
      data: { name: `409 Card ${crypto.randomUUID()}`, rewardType: "cashback", rewardRate: 0.02 },
    });
    const card = await cardRes.json();
    const uccRes = await request.post("/api/user-credit-cards", {
      data: { creditCardId: card.id },
    });
    const ucc = await uccRes.json();
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `409 Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-09-01`,
        checkOut: `${YEAR}-09-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        userCreditCardId: ucc.id,
        currency: "USD",
      },
    });
    const booking = await bookingRes.json();

    try {
      await page.goto("/settings");
      await page.getByRole("tab", { name: "My Cards" }).click();
      await expect(page.getByTestId("tab-my-cards")).toBeVisible();

      const row = page
        .getByTestId("my-cards-desktop")
        .locator('[data-testid="my-card-row"]')
        .filter({ has: page.getByTestId("my-card-name").filter({ hasText: card.name }) });

      await row.getByTestId("my-card-delete-button").click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

      await expect(
        page.getByText("Cannot delete: this card instance is referenced by existing bookings.")
      ).toBeVisible();
      // Card still present
      await expect(row).toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/user-credit-cards/${ucc.id}`);
      await adminRequest.delete(`/api/credit-cards/${card.id}`);
    }
  });
});
```

- [ ] **Step 3: Run the spec**

```bash
npx playwright test e2e/settings-my-cards.spec.ts --project=chromium
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/my-cards-tab.tsx e2e/settings-my-cards.spec.ts
git commit -m "test: E2E coverage for Settings — My Cards tab"
```

---

### Task 3: Open PR 1

- [ ] **Step 1: Invoke the commit-push-pr skill**

Use the `commit-push-pr` skill to push and open PR 1. PR title: "test: E2E tests for Settings user tabs (My Status, My Cards)". Mention closes part of #64.

---

## PR 2 — Admin Tabs

---

### Task 4: Hotel Chains tab — add testids + write spec

**Files:**

- Modify: `src/components/settings/hotel-chains-tab.tsx`
- Create: `e2e/settings-hotel-chains.spec.ts`

- [ ] **Step 1: Add `data-testid` to Sub-brands and Edit buttons in the desktop table**

In `hotel-chains-tab.tsx`, the desktop table action cell (around line 491):

```tsx
<div className="flex gap-2">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => openSubBrands(hotelChain)}
    data-testid="hotel-chain-sub-brands-button"
  >
    Sub-brands
  </Button>
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleEdit(hotelChain)}
    data-testid="hotel-chain-edit-button"
  >
    Edit
  </Button>
</div>
```

- [ ] **Step 2: Write `e2e/settings-hotel-chains.spec.ts`**

```typescript
import crypto from "crypto";
import { test, expect } from "./fixtures";

test.describe("Settings — Hotel Chains", () => {
  test("adds a hotel chain and it appears in the table", async ({ adminPage, adminRequest }) => {
    const name = `Test Chain ${crypto.randomUUID()}`;
    let chainId: string | null = null;
    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Hotel Chains" }).click();
      await expect(adminPage.getByTestId("tab-hotels")).toBeVisible();

      await adminPage.getByTestId("add-hotel-chain-button").click();
      await adminPage.getByLabel("Name").fill(name);
      await adminPage.getByRole("button", { name: "Save" }).click();

      const row = adminPage
        .locator('[data-testid="hotel-chain-table-row"]')
        .filter({ has: adminPage.getByTestId("hotel-chain-table-name").filter({ hasText: name }) });
      await expect(row).toBeVisible();

      // Record id for cleanup
      const chains = await adminRequest.get("/api/hotel-chains");
      const chain = (await chains.json()).find((c: { name: string }) => c.name === name);
      chainId = chain?.id ?? null;
    } finally {
      if (chainId) await adminRequest.delete(`/api/hotel-chains/${chainId}`);
    }
  });

  test("edits a hotel chain name and it updates in the table", async ({
    adminPage,
    adminRequest,
  }) => {
    const original = `Chain Edit ${crypto.randomUUID()}`;
    const updated = `Chain Updated ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/hotel-chains", { data: { name: original } });
    const chain = await res.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Hotel Chains" }).click();
      await expect(adminPage.getByTestId("tab-hotels")).toBeVisible();

      const row = adminPage.locator('[data-testid="hotel-chain-table-row"]').filter({
        has: adminPage.getByTestId("hotel-chain-table-name").filter({ hasText: original }),
      });

      await row.getByTestId("hotel-chain-edit-button").click();
      await adminPage.getByLabel("Name").fill(updated);
      await adminPage.getByRole("button", { name: "Save" }).click();

      await expect(
        adminPage.locator('[data-testid="hotel-chain-table-row"]').filter({
          has: adminPage.getByTestId("hotel-chain-table-name").filter({ hasText: updated }),
        })
      ).toBeVisible();
    } finally {
      await adminRequest.delete(`/api/hotel-chains/${chain.id}`);
    }
  });

  test("adds a sub-brand via the sub-brands dialog", async ({ adminPage, adminRequest }) => {
    const chainName = `Sub Chain ${crypto.randomUUID()}`;
    const sbName = `Sub Brand ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/hotel-chains", { data: { name: chainName } });
    const chain = await res.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Hotel Chains" }).click();
      await expect(adminPage.getByTestId("tab-hotels")).toBeVisible();

      const row = adminPage.locator('[data-testid="hotel-chain-table-row"]').filter({
        has: adminPage.getByTestId("hotel-chain-table-name").filter({ hasText: chainName }),
      });

      await row.getByTestId("hotel-chain-sub-brands-button").click();
      await adminPage.getByLabel("Name *").fill(sbName);
      await adminPage.getByRole("button", { name: "Add Sub-brand" }).click();

      await expect(adminPage.getByText(sbName)).toBeVisible();
    } finally {
      await adminRequest.delete(`/api/hotel-chains/${chain.id}`);
    }
  });

  test("deletes a sub-brand via the sub-brands dialog", async ({ adminPage, adminRequest }) => {
    const chainName = `Del Sub Chain ${crypto.randomUUID()}`;
    const sbName = `Del Sub Brand ${crypto.randomUUID()}`;
    const chainRes = await adminRequest.post("/api/hotel-chains", { data: { name: chainName } });
    const chain = await chainRes.json();
    const sbRes = await adminRequest.post(`/api/hotel-chains/${chain.id}/hotel-chain-sub-brands`, {
      data: { name: sbName },
    });
    const sb = await sbRes.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Hotel Chains" }).click();
      await expect(adminPage.getByTestId("tab-hotels")).toBeVisible();

      const row = adminPage.locator('[data-testid="hotel-chain-table-row"]').filter({
        has: adminPage.getByTestId("hotel-chain-table-name").filter({ hasText: chainName }),
      });

      await row.getByTestId("hotel-chain-sub-brands-button").click();
      await expect(adminPage.getByText(sbName)).toBeVisible();

      // Click the × delete button next to the sub-brand
      await adminPage
        .getByRole("dialog")
        .getByText(sbName)
        .locator("..")
        .getByRole("button")
        .click();

      await expect(adminPage.getByText(sbName)).not.toBeVisible();
    } finally {
      // Sub-brand may already be deleted; ignore 404
      await adminRequest.delete(`/api/hotel-chain-sub-brands/${sb.id}`).catch(() => {});
      await adminRequest.delete(`/api/hotel-chains/${chain.id}`);
    }
  });
});
```

- [ ] **Step 3: Run the spec**

```bash
npx playwright test e2e/settings-hotel-chains.spec.ts --project=chromium
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/hotel-chains-tab.tsx e2e/settings-hotel-chains.spec.ts
git commit -m "test: E2E coverage for Settings — Hotel Chains tab"
```

---

### Task 5: Credit Cards tab — write spec (absorb card-benefits CRUD test)

**Files:**

- Create: `e2e/settings-credit-cards.spec.ts`

No new testids needed — `credit-card-accordion-item.tsx` already has: `accordion-header-${card.id}`, `edit-credit-card-name-button`, `credit-card-name-input`, `save-credit-card-name-button`, `credit-card-card-name`, `add-card-benefit-button`, `add-description-input`, `add-value-input`, `add-period-select`, `add-card-benefit-save`, `card-benefit-row`, `card-benefit-description`.

- [ ] **Step 1: Write `e2e/settings-credit-cards.spec.ts`**

```typescript
import crypto from "crypto";
import { test, expect } from "./fixtures";
import { CREDIT_CARD_ID } from "../prisma/seed-ids";

test.describe("Settings — Credit Cards", () => {
  test("adds a credit card and it appears in the accordion", async ({
    adminPage,
    adminRequest,
  }) => {
    const name = `Test CC ${crypto.randomUUID()}`;
    let cardId: string | null = null;
    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Credit Cards" }).click();
      await expect(adminPage.getByTestId("tab-credit-cards")).toBeVisible();

      await adminPage.getByTestId("add-credit-card-button").click();
      await adminPage.getByLabel("Name").fill(name);
      await adminPage.getByLabel("Reward Rate").fill("0.02");
      await adminPage.getByRole("button", { name: "Save" }).click();

      // Accordion item for new card should be visible
      await expect(
        adminPage.locator('[data-testid="credit-card-accordion"]').filter({
          has: adminPage.getByTestId("credit-card-card-name").filter({ hasText: name }),
        })
      ).toBeVisible();

      const cards = await adminRequest.get("/api/credit-cards");
      const card = (await cards.json()).find((c: { name: string }) => c.name === name);
      cardId = card?.id ?? null;
    } finally {
      if (cardId) await adminRequest.delete(`/api/credit-cards/${cardId}`);
    }
  });

  test("edits a credit card name inline", async ({ adminPage, adminRequest }) => {
    const original = `Edit CC ${crypto.randomUUID()}`;
    const updated = `Updated CC ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/credit-cards", {
      data: { name: original, rewardType: "cashback", rewardRate: 0.01 },
    });
    const card = await res.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Credit Cards" }).click();
      await expect(adminPage.getByTestId("tab-credit-cards")).toBeVisible();

      // Expand the accordion item
      await adminPage.getByTestId(`accordion-header-${card.id}`).click();
      await adminPage.getByTestId("edit-credit-card-name-button").click();
      await adminPage.getByTestId("credit-card-name-input").fill(updated);
      await adminPage.getByTestId("save-credit-card-name-button").click();

      await expect(
        adminPage.getByTestId("credit-card-card-name").filter({ hasText: updated })
      ).toBeVisible();
    } finally {
      await adminRequest.delete(`/api/credit-cards/${card.id}`);
    }
  });

  // Moved from card-benefits.spec.ts
  test("creates a card benefit (moved from card-benefits.spec.ts)", async ({
    adminPage,
    adminRequest,
  }) => {
    const description = `Quarterly hotel credit ${crypto.randomUUID().slice(0, 8)}`;
    await adminPage.goto("/settings");
    await adminPage.getByRole("tab", { name: "Credit Cards" }).click();
    await expect(adminPage.getByTestId("tab-credit-cards")).toBeVisible();

    await adminPage
      .getByTestId(`accordion-header-${CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM}`)
      .click();
    await adminPage.getByTestId("add-card-benefit-button").click();

    await adminPage.getByTestId("add-description-input").fill(description);
    await adminPage.getByTestId("add-value-input").fill("50");
    await adminPage.getByTestId("add-period-select").click();
    await adminPage.getByRole("option", { name: "Quarterly" }).click();
    await adminPage.getByTestId("add-card-benefit-save").click();

    await expect(
      adminPage.locator('[data-testid="card-benefit-row"]').filter({
        has: adminPage.getByTestId("card-benefit-description").filter({ hasText: description }),
      })
    ).toBeVisible();

    // Clean up
    const benefits = (await (await adminRequest.get("/api/card-benefits")).json()) as {
      id: string;
      description: string;
    }[];
    const created = benefits.find((b) => b.description === description);
    if (created) await adminRequest.delete(`/api/card-benefits/${created.id}`);
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test e2e/settings-credit-cards.spec.ts --project=chromium
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 3: Commit**

```bash
git add e2e/settings-credit-cards.spec.ts
git commit -m "test: E2E coverage for Settings — Credit Cards tab"
```

---

### Task 6: Shopping Portals tab — write spec

**Files:**

- Create: `e2e/settings-shopping-portals.spec.ts`

No new testids needed — existing: `add-portal-button`, `portal-row`, `portal-name`. No delete UI in component.

- [ ] **Step 1: Write `e2e/settings-shopping-portals.spec.ts`**

```typescript
import crypto from "crypto";
import { test, expect } from "./fixtures";

test.describe("Settings — Shopping Portals", () => {
  test("adds a portal and it appears in the table", async ({ adminPage, adminRequest }) => {
    const name = `Test Portal ${crypto.randomUUID()}`;
    let portalId: string | null = null;
    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Shopping Portals" }).click();
      await expect(adminPage.getByTestId("tab-portals")).toBeVisible();

      await adminPage.getByTestId("add-portal-button").click();
      await adminPage.getByLabel("Name").fill(name);
      await adminPage.getByRole("button", { name: "Save" }).click();

      await expect(
        adminPage
          .locator('[data-testid="portal-row"]')
          .filter({ has: adminPage.getByTestId("portal-name").filter({ hasText: name }) })
      ).toBeVisible();

      const portals = await adminRequest.get("/api/portals");
      const portal = (await portals.json()).find((p: { name: string }) => p.name === name);
      portalId = portal?.id ?? null;
    } finally {
      if (portalId) await adminRequest.delete(`/api/portals/${portalId}`);
    }
  });

  test("edits a portal name and it updates in the table", async ({ adminPage, adminRequest }) => {
    const original = `Edit Portal ${crypto.randomUUID()}`;
    const updated = `Updated Portal ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/portals", {
      data: { name: original, rewardType: "cashback" },
    });
    const portal = await res.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Shopping Portals" }).click();
      await expect(adminPage.getByTestId("tab-portals")).toBeVisible();

      const row = adminPage
        .locator('[data-testid="portal-row"]')
        .filter({ has: adminPage.getByTestId("portal-name").filter({ hasText: original }) });

      await row.getByRole("button", { name: "Edit" }).click();
      await adminPage.getByLabel("Name").fill(updated);
      await adminPage.getByRole("button", { name: "Save" }).click();

      await expect(
        adminPage
          .locator('[data-testid="portal-row"]')
          .filter({ has: adminPage.getByTestId("portal-name").filter({ hasText: updated }) })
      ).toBeVisible();
    } finally {
      await adminRequest.delete(`/api/portals/${portal.id}`);
    }
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test e2e/settings-shopping-portals.spec.ts --project=chromium
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 3: Commit**

```bash
git add e2e/settings-shopping-portals.spec.ts
git commit -m "test: E2E coverage for Settings — Shopping Portals tab"
```

---

### Task 7: OTA Agencies tab — add testids + write spec

**Files:**

- Modify: `src/components/settings/ota-agencies-tab.tsx`
- Create: `e2e/settings-ota-agencies.spec.ts`

- [ ] **Step 1: Add `data-testid` to Edit/Delete buttons in the desktop table**

In `ota-agencies-tab.tsx`, the desktop table action cell (around line 251):

```tsx
<div className="flex gap-2">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleEdit(agency)}
    data-testid="agency-edit-button"
  >
    Edit
  </Button>
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleDeleteClick(agency)}
    data-testid="agency-delete-button"
  >
    Delete
  </Button>
</div>
```

- [ ] **Step 2: Write `e2e/settings-ota-agencies.spec.ts`**

```typescript
import crypto from "crypto";
import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";

const YEAR = new Date().getFullYear();

test.describe("Settings — OTA Agencies", () => {
  test("adds an agency and it appears in the table", async ({ adminPage, adminRequest }) => {
    const name = `Test Agency ${crypto.randomUUID()}`;
    let agencyId: string | null = null;
    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "OTA Agencies" }).click();
      await expect(adminPage.getByTestId("tab-ota-agencies")).toBeVisible();

      await adminPage.getByTestId("add-agency-button").click();
      await adminPage.getByLabel("Name").fill(name);
      await adminPage.getByRole("button", { name: "Save" }).click();

      await expect(
        adminPage
          .locator('[data-testid="agency-row"]')
          .filter({ has: adminPage.getByTestId("agency-name").filter({ hasText: name }) })
      ).toBeVisible();

      const agencies = await adminRequest.get("/api/ota-agencies");
      const agency = (await agencies.json()).find((a: { name: string }) => a.name === name);
      agencyId = agency?.id ?? null;
    } finally {
      if (agencyId) await adminRequest.delete(`/api/ota-agencies/${agencyId}`);
    }
  });

  test("edits an agency name and it updates in the table", async ({ adminPage, adminRequest }) => {
    const original = `Edit Agency ${crypto.randomUUID()}`;
    const updated = `Updated Agency ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/ota-agencies", { data: { name: original } });
    const agency = await res.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "OTA Agencies" }).click();
      await expect(adminPage.getByTestId("tab-ota-agencies")).toBeVisible();

      const row = adminPage
        .locator('[data-testid="agency-row"]')
        .filter({ has: adminPage.getByTestId("agency-name").filter({ hasText: original }) });

      await row.getByTestId("agency-edit-button").click();
      await adminPage.getByLabel("Name").fill(updated);
      await adminPage.getByRole("button", { name: "Save" }).click();

      await expect(
        adminPage
          .locator('[data-testid="agency-row"]')
          .filter({ has: adminPage.getByTestId("agency-name").filter({ hasText: updated }) })
      ).toBeVisible();
    } finally {
      await adminRequest.delete(`/api/ota-agencies/${agency.id}`);
    }
  });

  test("deletes an agency and it is removed from the table", async ({
    adminPage,
    adminRequest,
  }) => {
    const name = `Del Agency ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/ota-agencies", { data: { name } });
    const agency = await res.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "OTA Agencies" }).click();
      await expect(adminPage.getByTestId("tab-ota-agencies")).toBeVisible();

      const row = adminPage
        .locator('[data-testid="agency-row"]')
        .filter({ has: adminPage.getByTestId("agency-name").filter({ hasText: name }) });

      await row.getByTestId("agency-delete-button").click();
      await adminPage.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

      await expect(row).not.toBeVisible();
    } finally {
      // Agency may already be deleted; ignore 404
      await adminRequest.delete(`/api/ota-agencies/${agency.id}`).catch(() => {});
    }
  });

  test("shows toast when deleting an agency referenced by a booking", async ({
    adminPage,
    adminRequest,
    isolatedUser,
  }) => {
    const name = `409 Agency ${crypto.randomUUID()}`;
    const agencyRes = await adminRequest.post("/api/ota-agencies", { data: { name } });
    const agency = await agencyRes.json();
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `409 Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-09-01`,
        checkOut: `${YEAR}-09-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "ota",
        otaAgencyId: agency.id,
      },
    });
    const booking = await bookingRes.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "OTA Agencies" }).click();
      await expect(adminPage.getByTestId("tab-ota-agencies")).toBeVisible();

      const row = adminPage
        .locator('[data-testid="agency-row"]')
        .filter({ has: adminPage.getByTestId("agency-name").filter({ hasText: name }) });

      await row.getByTestId("agency-delete-button").click();
      await adminPage.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

      await expect(
        adminPage.getByText("Cannot delete: this agency is referenced by existing bookings.")
      ).toBeVisible();
      await expect(row).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await adminRequest.delete(`/api/ota-agencies/${agency.id}`);
    }
  });
});
```

- [ ] **Step 3: Run the spec**

```bash
npx playwright test e2e/settings-ota-agencies.spec.ts --project=chromium
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/ota-agencies-tab.tsx e2e/settings-ota-agencies.spec.ts
git commit -m "test: E2E coverage for Settings — OTA Agencies tab"
```

---

### Task 8: Point Types tab — write spec

**Files:**

- Create: `e2e/settings-point-types.spec.ts`

No new testids needed — existing: `add-point-type-button`, `point-type-row`, `point-type-name`.

- [ ] **Step 1: Write `e2e/settings-point-types.spec.ts`**

```typescript
import crypto from "crypto";
import { test, expect } from "./fixtures";

test.describe("Settings — Point Types", () => {
  test("adds a point type and it appears in the table", async ({ adminPage, adminRequest }) => {
    const name = `Test PT ${crypto.randomUUID()}`;
    let ptId: string | null = null;
    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Point Types" }).click();
      await expect(adminPage.getByTestId("tab-point-types")).toBeVisible();

      await adminPage.getByTestId("add-point-type-button").click();
      await adminPage.getByLabel("Name *").fill(name);
      await adminPage.getByLabel("USD Value per Point ($) *").fill("0.005");
      await adminPage.getByRole("button", { name: "Save" }).click();

      await expect(
        adminPage
          .locator('[data-testid="point-type-row"]')
          .filter({ has: adminPage.getByTestId("point-type-name").filter({ hasText: name }) })
      ).toBeVisible();

      const pts = await adminRequest.get("/api/point-types");
      const pt = (await pts.json()).find((p: { name: string }) => p.name === name);
      ptId = pt?.id ?? null;
    } finally {
      if (ptId) await adminRequest.delete(`/api/point-types/${ptId}`);
    }
  });

  test("edits a point type name and it updates in the table", async ({
    adminPage,
    adminRequest,
  }) => {
    const original = `Edit PT ${crypto.randomUUID()}`;
    const updated = `Updated PT ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/point-types", {
      data: { name: original, category: "hotel", usdCentsPerPoint: 0.005 },
    });
    const pt = await res.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Point Types" }).click();
      await expect(adminPage.getByTestId("tab-point-types")).toBeVisible();

      const row = adminPage
        .locator('[data-testid="point-type-row"]')
        .filter({ has: adminPage.getByTestId("point-type-name").filter({ hasText: original }) });

      await row.getByRole("button", { name: "Edit" }).click();
      await adminPage.getByLabel("Name *").fill(updated);
      await adminPage.getByRole("button", { name: "Save" }).click();

      await expect(
        adminPage
          .locator('[data-testid="point-type-row"]')
          .filter({ has: adminPage.getByTestId("point-type-name").filter({ hasText: updated }) })
      ).toBeVisible();
    } finally {
      await adminRequest.delete(`/api/point-types/${pt.id}`);
    }
  });

  test("deletes a point type and it is removed from the table", async ({
    adminPage,
    adminRequest,
  }) => {
    const name = `Del PT ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/point-types", {
      data: { name, category: "hotel", usdCentsPerPoint: 0.005 },
    });
    const pt = await res.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Point Types" }).click();
      await expect(adminPage.getByTestId("tab-point-types")).toBeVisible();

      const row = adminPage
        .locator('[data-testid="point-type-row"]')
        .filter({ has: adminPage.getByTestId("point-type-name").filter({ hasText: name }) });

      await row.getByRole("button", { name: "Delete" }).click();
      await adminPage.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

      await expect(row).not.toBeVisible();
    } finally {
      await adminRequest.delete(`/api/point-types/${pt.id}`).catch(() => {});
    }
  });

  test("shows toast when deleting a point type in use by a hotel chain", async ({
    adminPage,
    adminRequest,
  }) => {
    const ptName = `409 PT ${crypto.randomUUID()}`;
    const chainName = `409 Chain ${crypto.randomUUID()}`;
    const ptRes = await adminRequest.post("/api/point-types", {
      data: { name: ptName, category: "hotel", usdCentsPerPoint: 0.005 },
    });
    const pt = await ptRes.json();
    const chainRes = await adminRequest.post("/api/hotel-chains", {
      data: { name: chainName, pointTypeId: pt.id },
    });
    const chain = await chainRes.json();

    try {
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Point Types" }).click();
      await expect(adminPage.getByTestId("tab-point-types")).toBeVisible();

      const row = adminPage
        .locator('[data-testid="point-type-row"]')
        .filter({ has: adminPage.getByTestId("point-type-name").filter({ hasText: ptName }) });

      await row.getByRole("button", { name: "Delete" }).click();
      await adminPage.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

      await expect(
        adminPage.getByText(
          "Cannot delete: this point type is in use by hotel chains, cards, or portals."
        )
      ).toBeVisible();
      await expect(row).toBeVisible();
    } finally {
      await adminRequest.delete(`/api/hotel-chains/${chain.id}`);
      await adminRequest.delete(`/api/point-types/${pt.id}`);
    }
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test e2e/settings-point-types.spec.ts --project=chromium
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 3: Commit**

```bash
git add e2e/settings-point-types.spec.ts
git commit -m "test: E2E coverage for Settings — Point Types tab"
```

---

### Task 9: Properties tab — write spec

**Files:**

- Create: `e2e/settings-properties.spec.ts`

The Properties tab is admin-only. Audit `properties-tab.tsx` for existing testids and add any needed for the property rows. The test is a basic smoke check — verify visibility and that seeded properties appear.

- [ ] **Step 1: Audit `properties-tab.tsx` for testids**

Read `src/components/settings/properties-tab.tsx` fully and note any `data-testid` attributes. Add a `data-testid="property-row"` to property table rows if not already present.

- [ ] **Step 2: Write `e2e/settings-properties.spec.ts`**

```typescript
import { test, expect } from "./fixtures";

test.describe("Settings — Properties", () => {
  test("Properties tab is visible to admin", async ({ adminPage }) => {
    await adminPage.goto("/settings");
    await expect(adminPage.getByRole("tab", { name: "Properties" })).toBeVisible();
  });

  test("Properties tab is not visible to regular users", async ({ isolatedUser }) => {
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: "Properties" })).not.toBeVisible();
  });

  test("properties list shows seeded properties", async ({ adminPage }) => {
    await adminPage.goto("/settings");
    await adminPage.getByRole("tab", { name: "Properties" }).click();
    await expect(adminPage.getByTestId("tab-properties")).toBeVisible();
    // Seeded data contains properties; verify at least one row exists
    await expect(adminPage.locator('[data-testid="property-row"]').first()).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the spec**

```bash
npx playwright test e2e/settings-properties.spec.ts --project=chromium
```

Expected: all tests pass. Fix any failures (likely missing testid on property rows) before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/properties-tab.tsx e2e/settings-properties.spec.ts
git commit -m "test: E2E coverage for Settings — Properties tab"
```

---

### Task 10: Migrate card-benefits "Auto-apply" tests and delete `card-benefits.spec.ts`

**Files:**

- Modify: `e2e/booking-benefits.spec.ts`
- Delete: `e2e/card-benefits.spec.ts`

- [ ] **Step 1: Move the "Auto-apply on booking" tests from `card-benefits.spec.ts` to `booking-benefits.spec.ts`**

Open `e2e/card-benefits.spec.ts` and find the `test.describe("Card Benefits — Auto-apply on booking", ...)` block. Move the entire block to the bottom of `e2e/booking-benefits.spec.ts`. Preserve the existing imports and ensure any new imports needed are added.

- [ ] **Step 2: Delete `e2e/card-benefits.spec.ts`**

```bash
rm e2e/card-benefits.spec.ts
```

- [ ] **Step 3: Run the affected specs to verify nothing broke**

```bash
npx playwright test e2e/booking-benefits.spec.ts --project=chromium
npx playwright test e2e/settings-credit-cards.spec.ts --project=chromium
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/booking-benefits.spec.ts
git rm e2e/card-benefits.spec.ts
git commit -m "refactor: move card benefit auto-apply tests to booking-benefits.spec.ts, delete card-benefits.spec.ts"
```

---

### Task 11: Open PR 2

- [ ] **Step 1: Invoke the commit-push-pr skill**

Use the `commit-push-pr` skill to push and open PR 2. PR title: "test: E2E tests for Settings admin tabs". Mention closes #64.
