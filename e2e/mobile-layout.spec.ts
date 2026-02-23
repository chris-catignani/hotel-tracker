import { test, expect } from "@playwright/test";

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
    // 1. Create a booking first so we have data to display
    await page.goto("/bookings/new");
    
    // Select Hotel Chain
    await page.getByText(/Select hotel chain.../i).click();
    await page.getByRole("option", { name: /Hilton/i }).click();

    await page.getByLabel(/Property Name/i).fill(hotelName);
    await page.getByLabel(/Check-in/i).fill("2026-05-01");
    await page.getByLabel(/Check-out/i).fill("2026-05-03");
    await page.getByLabel(/Pre-tax Cost/i).fill("200");
    await page.getByLabel(/Total Cost/i).fill("240");
    await page.getByRole("button", { name: /Create Booking/i }).click();

    await page.waitForURL("/bookings");

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
    // 1. Create a booking first
    await page.goto("/bookings/new");

    // Select Hotel Chain
    await page.getByText(/Select hotel chain.../i).click();
    await page.getByRole("option", { name: /Marriott/i }).click();

    await page.getByLabel(/Property Name/i).fill(hotelName);
    await page.getByLabel(/Check-in/i).fill("2026-06-01");
    await page.getByLabel(/Check-out/i).fill("2026-06-03");
    await page.getByLabel(/Pre-tax Cost/i).fill("300");
    await page.getByLabel(/Total Cost/i).fill("350");
    await page.getByRole("button", { name: /Create Booking/i }).click();

    await page.waitForURL("/bookings");

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
