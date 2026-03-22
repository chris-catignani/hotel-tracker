import { test, expect } from "./fixtures";

test.describe("Booking Benefits Mobile Layout", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test("should not have horizontal overflow in booking benefits when 'Other' is selected", async ({
    isolatedUser,
  }) => {
    await isolatedUser.page.goto("/bookings/new");

    // Click Add Benefit
    await isolatedUser.page.getByRole("button", { name: "+ Add Benefit" }).click();

    // Select 'Other'
    const typeSelect = isolatedUser.page.getByTestId("benefit-type-select-0");
    await typeSelect.click();
    await isolatedUser.page.getByRole("option", { name: "Other" }).click();

    // The 'Label' field should appear
    const description = isolatedUser.page.getByTestId("benefit-label-input-0");
    await expect(description).toBeVisible();

    // Check for horizontal overflow on the scroll container (usually the body or a wrapper)
    const hasOverflow = await isolatedUser.page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth;
    });

    expect(hasOverflow, "Page should not have horizontal overflow").toBe(false);

    // Check if the benefit row itself is wider than the screen
    const row = typeSelect.locator("..");
    const rowBox = await row.boundingBox();
    if (rowBox) {
      // Allow a tiny margin of error for rounding
      expect(rowBox.width, "Benefit row should not exceed screen width").toBeLessThanOrEqual(375);
    }
  });
});
