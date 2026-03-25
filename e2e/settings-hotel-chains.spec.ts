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
      const sbRow = adminPage
        .getByRole("dialog")
        .locator('[data-testid="sub-brand-row"]')
        .filter({ has: adminPage.getByTestId("sub-brand-name").filter({ hasText: sbName }) });
      await sbRow.getByTestId("sub-brand-delete-button").click();

      await expect(adminPage.getByText(sbName)).not.toBeVisible();
    } finally {
      // Sub-brand may already be deleted; ignore 404
      await adminRequest.delete(`/api/hotel-chain-sub-brands/${sb.id}`).catch(() => {});
      await adminRequest.delete(`/api/hotel-chains/${chain.id}`);
    }
  });
});
