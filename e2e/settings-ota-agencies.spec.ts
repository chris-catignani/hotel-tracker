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
