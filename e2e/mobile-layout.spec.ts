import { test, expect, Page } from "@playwright/test";

async function createBooking(page: Page, name: string, chain: string, cost: string) {
  await page.goto("/bookings/new");
  await page.getByText(/Select hotel chain.../i).click();
  await page.getByRole("option", { name: chain }).click();
  await page.getByLabel(/Property Name/i).fill(name);

  // Check-in Date
  await page.getByTestId("date-picker-trigger-checkIn").click();
  const calendar = page.locator('[data-slot="popover-content"]');
  await expect(calendar).toBeVisible();
  // Select day 10 from the grid
  await calendar.getByRole("button", { name: "10", exact: true }).first().click();
  await expect(calendar).not.toBeVisible();

  // Check-out Date
  await page.getByTestId("date-picker-trigger-checkOut").click();
  await expect(calendar).toBeVisible();
  // Select day 15
  await calendar.getByRole("button", { name: "15", exact: true }).first().click();
  await expect(calendar).not.toBeVisible();

  await page.getByLabel(/Pre-tax Cost/i).fill(cost);
  await page.getByLabel(/Total Cost/i).fill((Number(cost) * 1.2).toString());
  await page.getByRole("button", { name: /Create Booking/i }).click();
  await page.waitForURL("/bookings");
}

test.describe("Mobile Layout & Responsive Components", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test("should show mobile navigation and hide desktop sidebar", async ({ page }) => {
    await page.goto("/");

    // Desktop sidebar should be hidden
    await expect(page.getByTestId("sidebar")).not.toBeVisible();

    // Mobile header and hamburger menu should be visible
    await expect(page.getByTestId("mobile-header-title")).toBeVisible();
    await expect(page.getByTestId("mobile-nav-toggle")).toBeVisible();
  });

  test("should toggle the mobile navigation drawer", async ({ page }) => {
    await page.goto("/");

    // Open drawer
    await page.getByTestId("mobile-nav-toggle").click();

    // Scoped check to avoid strict mode violation (one in sidebar, one in mobile content)
    const drawer = page.getByTestId("mobile-nav-content");
    await expect(drawer).toBeVisible();

    // Verify navigation links are present in the drawer
    await expect(drawer.getByTestId("nav-item-dashboard")).toBeVisible();
    await expect(drawer.getByTestId("nav-item-bookings")).toBeVisible();

    // Close drawer by clicking a link
    await drawer.getByTestId("nav-item-bookings").click();
    await expect(page.getByTestId("mobile-nav-content")).not.toBeVisible();
    await expect(page.url()).toContain("/bookings");
  });

  test("should display booking card view instead of tables", async ({ page }) => {
    const hotelName = `Mobile Hotel ${Date.now()}`;
    await createBooking(page, hotelName, "Hilton", "200");

    // 2. On Bookings page, should show mobile card view
    const cardList = page.getByTestId("bookings-list-mobile");
    await expect(cardList).toBeVisible();
    await expect(page.getByTestId("bookings-list-desktop")).not.toBeVisible();
    await expect(cardList.getByText(hotelName)).toBeVisible();

    // 3. On Dashboard, should show mobile card view for recent bookings
    await page.goto("/");
    const recentCards = page.getByTestId("recent-bookings-mobile");
    await expect(recentCards).toBeVisible();
    await expect(page.getByTestId("recent-bookings-desktop")).not.toBeVisible();
    // We don't strictly check for hotelName here because it might be pushed out
    // of the 'top 5' by other parallel tests, but we verified it on the Bookings page.
  });

  test("should have horizontally scrollable tabs on Settings page", async ({ page }) => {
    await page.goto("/settings");
    const tabsList = page.getByRole("tablist");
    await expect(tabsList).toBeVisible();

    // Check that the container has overflow-x-auto
    const scrollContainer = page.locator("div.overflow-x-auto").filter({ has: tabsList });
    await expect(scrollContainer).toBeVisible();
    await expect(scrollContainer).toHaveCSS("overflow-x", "auto");
  });

  test("should display promotion form in a single column on mobile", async ({ page }) => {
    await page.goto("/promotions/new");

    // The grid should have 1 column on mobile (grid-cols-1)
    const firstGrid = page.locator("form div.grid").first();
    await expect(firstGrid).toBeVisible();
    await expect(firstGrid).toHaveClass(/grid-cols-1/);

    // Verify stacking by checking the bounding box of two adjacent elements
    // Using labels from the grid
    const typeLabel = page.getByText("Type", { exact: true });
    const valueTypeLabel = page.getByText("Value Type", { exact: true });

    await expect(typeLabel).toBeVisible();
    await expect(valueTypeLabel).toBeVisible();

    const typeBox = await typeLabel.boundingBox();
    const valueTypeBox = await valueTypeLabel.boundingBox();

    if (typeBox && valueTypeBox) {
      // On mobile, they should be vertically stacked
      expect(valueTypeBox.y).toBeGreaterThan(typeBox.y);
    }
  });

  test("should have a sticky action bar in the booking form on mobile", async ({ page }) => {
    await page.goto("/bookings/new");
    const actions = page.getByTestId("booking-form-submit").locator("..");
    await expect(actions).toBeVisible();

    // Verify it has sticky class or check its position during scroll if possible
    // For now, we check if it's visible at the bottom of the viewport
    await expect(actions).toHaveClass(/sticky/);
    await expect(actions).toHaveClass(/bottom-0/);
  });
});

test.describe("Desktop Layout (Verification)", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("should show desktop sidebar and hide mobile header", async ({ page }) => {
    await page.goto("/");

    // Desktop sidebar should be visible
    await expect(page.getByTestId("sidebar")).toBeVisible();

    // Mobile header should be hidden
    await expect(page.getByTestId("mobile-header-title")).not.toBeVisible();
    await expect(page.getByTestId("mobile-nav-toggle")).not.toBeVisible();
  });

  test("should display table view on desktop", async ({ page }) => {
    const hotelName = `Desktop Hotel ${Date.now()}`;
    await createBooking(page, hotelName, "Marriott", "300");

    // 2. On Bookings page, should show table
    await expect(page.getByTestId("bookings-list-desktop")).toBeVisible();
    await expect(page.getByTestId("bookings-list-mobile")).not.toBeVisible();
    await expect(page.getByRole("cell", { name: hotelName })).toBeVisible();

    // 3. On Dashboard, should show table
    await page.goto("/");
    await expect(page.getByTestId("recent-bookings-desktop")).toBeVisible();
    await expect(page.getByTestId("recent-bookings-mobile")).not.toBeVisible();
  });
});
