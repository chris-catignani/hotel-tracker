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
