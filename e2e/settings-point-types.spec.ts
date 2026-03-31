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
      await adminPage.getByLabel("Short Name *").fill("TestPT");
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
      data: { name: original, shortName: "EditPT", category: "hotel", usdCentsPerPoint: 0.005 },
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
      data: { name, shortName: "DelPT", category: "hotel", usdCentsPerPoint: 0.005 },
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
      data: { name: ptName, shortName: "409PT", category: "hotel", usdCentsPerPoint: 0.005 },
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
