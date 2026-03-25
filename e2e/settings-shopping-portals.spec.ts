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
