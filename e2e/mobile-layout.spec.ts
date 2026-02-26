import { test, expect } from "./fixtures";

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

  test("should display booking card view instead of tables", async ({ page, testBooking }) => {
    await page.goto("/bookings");

    const cardList = page.getByTestId("bookings-list-mobile");
    await expect(cardList).toBeVisible();
    await expect(page.getByTestId("bookings-list-desktop")).not.toBeVisible();
    await expect(cardList.getByText(testBooking.propertyName)).toBeVisible();

    // On Dashboard, should show mobile card view for recent bookings
    await page.goto("/");
    const recentCards = page.getByTestId("recent-bookings-mobile");
    await expect(recentCards).toBeVisible();
    await expect(page.getByTestId("recent-bookings-desktop")).not.toBeVisible();
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

    await expect(actions).toHaveClass(/sticky/);
    await expect(actions).toHaveClass(/bottom-0/);
  });

  test("should display promotion card view instead of tables", async ({ page, testPromotion }) => {
    await page.goto("/promotions");

    const mobileList = page.getByTestId("promotions-list-mobile");
    await expect(mobileList).toBeVisible();
    await expect(page.getByTestId("promotions-list-desktop")).not.toBeVisible();
    await expect(mobileList.getByText(testPromotion.name)).toBeVisible();
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

  test("should display table view on desktop", async ({ page, testBooking }) => {
    await page.goto("/bookings");

    await expect(page.getByTestId("bookings-list-desktop")).toBeVisible();
    await expect(page.getByTestId("bookings-list-mobile")).not.toBeVisible();
    await expect(page.getByRole("cell", { name: testBooking.propertyName })).toBeVisible();

    // On Dashboard, should show table
    await page.goto("/");
    await expect(page.getByTestId("recent-bookings-desktop")).toBeVisible();
    await expect(page.getByTestId("recent-bookings-mobile")).not.toBeVisible();
  });

  test("should display promotion table view on desktop", async ({ page, testPromotion }) => {
    await page.goto("/promotions");

    const desktopList = page.getByTestId("promotions-list-desktop");
    await expect(desktopList).toBeVisible();
    await expect(page.getByTestId("promotions-list-mobile")).not.toBeVisible();
    await expect(desktopList.getByRole("cell", { name: testPromotion.name })).toBeVisible();
  });
});
