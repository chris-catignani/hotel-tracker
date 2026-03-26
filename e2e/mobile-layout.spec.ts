import { test, expect } from "./fixtures";

test.describe("Mobile Layout & Responsive Components", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test("should show mobile navigation and hide desktop sidebar", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/");

    // Desktop sidebar should be hidden
    await expect(isolatedUser.page.getByTestId("sidebar")).not.toBeVisible();

    // Mobile header and hamburger menu should be visible
    await expect(isolatedUser.page.getByTestId("mobile-header-title")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("mobile-nav-toggle")).toBeVisible();
  });

  test("should toggle the mobile navigation drawer", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/");

    // Open drawer
    await isolatedUser.page.getByTestId("mobile-nav-toggle").click();

    // Scoped check to avoid strict mode violation (one in sidebar, one in mobile content)
    const drawer = isolatedUser.page.getByTestId("mobile-nav-content");
    await expect(drawer).toBeVisible();

    // Verify navigation links are present in the drawer
    await expect(drawer.getByTestId("nav-item-dashboard")).toBeVisible();
    await expect(drawer.getByTestId("nav-item-bookings")).toBeVisible();

    // Close drawer by clicking a link
    await drawer.getByTestId("nav-item-bookings").click();
    await expect(isolatedUser.page.getByTestId("mobile-nav-content")).not.toBeVisible();
    await expect(isolatedUser.page).toHaveURL(/\/bookings/);
  });

  test("should display booking card view instead of tables", async ({ testBooking }) => {
    await testBooking.page.goto("/bookings");

    const cardList = testBooking.page.getByTestId("bookings-list-mobile");
    await expect(cardList).toBeVisible();
    await expect(testBooking.page.getByTestId("bookings-list-desktop")).not.toBeVisible();
    await expect(cardList.getByText(testBooking.propertyName)).toBeVisible();

    // On Dashboard, should show mobile card view for recent bookings
    await testBooking.page.goto("/");
    const recentCards = testBooking.page.getByTestId("recent-bookings-mobile");
    await expect(recentCards).toBeVisible();
    await expect(testBooking.page.getByTestId("recent-bookings-desktop")).not.toBeVisible();
  });

  test("should have horizontally scrollable tabs on Settings page", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/settings");
    const tabsList = isolatedUser.page.getByRole("tablist");
    await expect(tabsList).toBeVisible();

    // Check that the container has overflow-x-auto
    const scrollContainer = isolatedUser.page
      .locator("div.overflow-x-auto")
      .filter({ has: tabsList });
    await expect(scrollContainer).toBeVisible();
    await expect(scrollContainer).toHaveCSS("overflow-x", "auto");
  });

  test("should display promotion form in a single column on mobile", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/promotions/new");

    // The grid should have 1 column on mobile (grid-cols-1)
    const firstGrid = isolatedUser.page.getByTestId("promotion-form-main-grid");
    await expect(firstGrid).toBeVisible();
    await expect(firstGrid).toHaveClass(/grid-cols-1/);

    // Verify stacking by checking the bounding box of two adjacent elements
    const nameLabel = isolatedUser.page.getByText("Promotion Name", { exact: false });
    const typeLabel = isolatedUser.page.getByText("Promotion Type", { exact: false });

    await expect(nameLabel).toBeVisible();
    await expect(typeLabel).toBeVisible();

    const nameBox = await nameLabel.boundingBox();
    const typeBox = await typeLabel.boundingBox();

    if (nameBox && typeBox) {
      // On mobile, they should be vertically stacked
      expect(typeBox.y).toBeGreaterThan(nameBox.y);
    }
  });

  test("should have a sticky action bar in the booking form on mobile", async ({
    isolatedUser,
  }) => {
    await isolatedUser.page.goto("/bookings/new");
    const actions = isolatedUser.page.getByTestId("booking-form-submit").locator("..");
    await expect(actions).toBeVisible();

    await expect(actions).toHaveClass(/sticky/);
    await expect(actions).toHaveClass(/bottom-0/);
  });

  test("should display promotion card view instead of tables", async ({ testPromotion }) => {
    await testPromotion.page.goto("/promotions");

    const mobileList = testPromotion.page.getByTestId("promotions-list-mobile");
    await expect(mobileList).toBeVisible();
    await expect(testPromotion.page.getByTestId("promotions-list-desktop")).not.toBeVisible();
    await expect(mobileList.getByText(testPromotion.name)).toBeVisible();
  });
});

test.describe("Desktop Layout (Verification)", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("should show desktop sidebar and hide mobile header", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/");

    // Desktop sidebar should be visible
    await expect(isolatedUser.page.getByTestId("sidebar")).toBeVisible();

    // Mobile header should be hidden
    await expect(isolatedUser.page.getByTestId("mobile-header-title")).not.toBeVisible();
    await expect(isolatedUser.page.getByTestId("mobile-nav-toggle")).not.toBeVisible();
  });

  test("should display table view on desktop", async ({ testBooking }) => {
    await testBooking.page.goto("/bookings");
    await testBooking.page.waitForLoadState("networkidle");

    await expect(testBooking.page.getByTestId("bookings-list-desktop")).toBeVisible();
    await expect(testBooking.page.getByTestId("bookings-list-mobile")).not.toBeVisible();
    await expect(
      testBooking.page.getByRole("cell", { name: testBooking.propertyName })
    ).toBeVisible();

    // On Dashboard, should show table
    await testBooking.page.goto("/");
    await testBooking.page.waitForLoadState("networkidle");
    await expect(testBooking.page.getByTestId("recent-bookings-desktop")).toBeVisible();
    await expect(testBooking.page.getByTestId("recent-bookings-mobile")).not.toBeVisible();
  });

  test("should display promotion table view on desktop", async ({ testPromotion }) => {
    await testPromotion.page.goto("/promotions");

    const desktopList = testPromotion.page.getByTestId("promotions-list-desktop");
    await expect(desktopList).toBeVisible();
    await expect(testPromotion.page.getByTestId("promotions-list-mobile")).not.toBeVisible();
    await expect(desktopList.getByRole("cell", { name: testPromotion.name })).toBeVisible();
  });
});
