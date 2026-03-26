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

  test("updated card reward rate is reflected in existing booking cost breakdown", async ({
    isolatedUser,
    adminRequest,
    testHotelChain,
  }) => {
    // Find a seeded credit card with a cashback rewardRate
    const cardsRes = await adminRequest.get("/api/credit-cards");
    const cards = await cardsRes.json();
    const card = cards.find(
      (c: { rewardRate: number | null }) => c.rewardRate != null && Number(c.rewardRate) > 0
    );
    if (!card) {
      test.skip();
      return;
    }

    const originalRate = Number(card.rewardRate);
    const newRate = originalRate + 0.01; // bump by 1 percentage point

    let uc: { id: string } | undefined;
    let booking: { id: string } | undefined;

    try {
      // Create a UserCreditCard linking the isolated user to the seeded card
      const ucRes = await isolatedUser.request.post("/api/user-credit-cards", {
        data: { creditCardId: card.id },
      });
      expect(ucRes.ok()).toBeTruthy();
      uc = await ucRes.json();

      const bookingRes = await isolatedUser.request.post("/api/bookings", {
        data: {
          userCreditCardId: uc!.id,
          hotelChainId: testHotelChain.id,
          propertyName: `Card Reward Reflection ${crypto.randomUUID()}`,
          checkIn: `${new Date().getFullYear()}-09-01`,
          checkOut: `${new Date().getFullYear()}-09-03`,
          numNights: 2,
          pretaxCost: 200,
          taxAmount: 20,
          totalCost: 220,
        },
      });
      expect(bookingRes.ok()).toBeTruthy();
      booking = await bookingRes.json();

      const { page } = isolatedUser;

      // View booking detail and note initial card reward text
      await page.goto(`/bookings/${booking!.id}`);
      const cardRewardEl = page.getByTestId("breakdown-card-reward");
      await expect(cardRewardEl).toBeVisible();
      const initialText = await cardRewardEl.textContent();

      // Admin updates rewardRate
      const updateRes = await adminRequest.put(`/api/credit-cards/${card.id}`, {
        data: { rewardRate: newRate },
      });
      expect(updateRes.ok()).toBeTruthy();

      // Reload and wait for booking data to re-fetch before asserting
      await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes(`/api/bookings/${booking!.id}`) && r.status() === 200
        ),
        page.reload(),
      ]);
      await expect(cardRewardEl).toBeVisible();
      const updatedText = await cardRewardEl.textContent();
      expect(updatedText).not.toBe(initialText);
    } finally {
      if (booking) await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      if (uc) await isolatedUser.request.delete(`/api/user-credit-cards/${uc.id}`);
      // Restore original rate
      await adminRequest.put(`/api/credit-cards/${card.id}`, {
        data: { rewardRate: originalRate },
      });
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
