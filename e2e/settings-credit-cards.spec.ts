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
      await adminPage.getByLabel("Base Rate").fill("0.02");
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

      // Expand the accordion item and edit within it
      const accordionHeader = adminPage.getByTestId(`accordion-header-${card.id}`);
      await accordionHeader.click();
      await accordionHeader.getByTestId("edit-credit-card-name-button").click();
      await accordionHeader.getByTestId("credit-card-name-input").fill(updated);
      await accordionHeader.getByTestId("save-credit-card-name-button").click();

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
