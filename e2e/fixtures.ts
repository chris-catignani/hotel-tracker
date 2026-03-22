import { test as base, type APIRequestContext, type Page } from "@playwright/test";
import crypto from "crypto";

const YEAR = new Date().getFullYear();

type TestFixtures = {
  testBooking: {
    id: string;
    propertyName: string;
    hotelChainName: string;
    request: APIRequestContext;
    page: Page;
  };
  apartmentBooking: { id: string; propertyName: string; request: APIRequestContext; page: Page };
  pastYearBooking: { id: string; propertyName: string; request: APIRequestContext; page: Page };
  testPromotion: { id: string; name: string; request: APIRequestContext; page: Page };
  testHotelChain: { id: string; name: string };
  testSubBrand: (name?: string) => Promise<{ id: string; name: string; hotelChainId: string }>;
  /**
   * A single isolated user with both a current-year and past-year booking.
   * Use in year-filter tests so that both years appear in the year selector.
   * The page is logged in as this isolated user.
   */
  twoYearBookings: {
    currentYearBookingId: string;
    pastYearBookingId: string;
    request: APIRequestContext;
    page: Page;
  };
  /**
   * An isolated per-test user with their own request context and browser page.
   * Use for all tests that create bookings or promotions. The page is logged in
   * as this isolated user. Data created via this fixture is invisible to other
   * parallel tests.
   */
  isolatedUser: { request: APIRequestContext; page: Page };
  /**
   * Admin user's API request context. Use ONLY for reference data CRUD
   * (hotel chains, credit cards, portals, sub-brands). Never use for
   * bookings or promotions.
   */
  adminRequest: APIRequestContext;
  /**
   * Admin user's browser page. Use ONLY for admin UI tests (e.g. Settings).
   * Always pair with adminRequest for any data created during the test.
   */
  adminPage: Page;
};

export const test = base.extend<TestFixtures>({
  adminRequest: async ({ playwright, baseURL }, use) => {
    const resolvedBase = baseURL ?? "http://127.0.0.1:3001";
    const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
    const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

    const adminReq = await playwright.request.newContext({ baseURL: resolvedBase });

    const csrfRes = await adminReq.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    await adminReq.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, callbackUrl: resolvedBase, redirect: "false" },
    });

    await use(adminReq);
    await adminReq.dispose();
  },

  adminPage: async ({ playwright, browser, baseURL }, use) => {
    const resolvedBase = baseURL ?? "http://127.0.0.1:3001";
    const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
    const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

    const adminReq = await playwright.request.newContext({ baseURL: resolvedBase });

    const csrfRes = await adminReq.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    await adminReq.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, callbackUrl: resolvedBase, redirect: "false" },
    });

    const storageState = await adminReq.storageState();
    const context = await browser.newContext({ baseURL: resolvedBase, storageState });
    const page = await context.newPage();

    await use(page);

    await page.close();
    await context.close();
    await adminReq.dispose();
  },

  isolatedUser: async ({ playwright, browser, baseURL }, use) => {
    const resolvedBase = baseURL ?? "http://127.0.0.1:3001";
    const email = `test-isolated-${crypto.randomUUID()}@example.com`;
    const password = "testpass123";

    const userRequest = await playwright.request.newContext({ baseURL: resolvedBase });

    await userRequest.post("/api/auth/register", {
      data: { email, password, name: "Isolated Test User" },
    });

    const csrfRes = await userRequest.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    await userRequest.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, callbackUrl: resolvedBase, redirect: "false" },
    });

    const storageState = await userRequest.storageState();
    const context = await browser.newContext({ baseURL: resolvedBase, storageState });
    const page = await context.newPage();

    await use({ request: userRequest, page });

    await page.close();
    await context.close();
    await userRequest.dispose();
  },

  testHotelChain: async ({ adminRequest }, use) => {
    const uniqueName = `Test Chain ${crypto.randomUUID()}`;
    const res = await adminRequest.post("/api/hotel-chains", {
      data: { name: uniqueName },
    });
    const chain = await res.json();
    await use({ id: chain.id, name: uniqueName });
    await adminRequest.delete(`/api/hotel-chains/${chain.id}`);
  },

  testSubBrand: async ({ adminRequest, testHotelChain }, use) => {
    const subBrands: string[] = [];
    const createSubBrand = async (name?: string) => {
      const uniqueName = name || `Test SubBrand ${crypto.randomUUID()}`;
      const res = await adminRequest.post(
        `/api/hotel-chains/${testHotelChain.id}/hotel-chain-sub-brands`,
        {
          data: { name: uniqueName },
        }
      );
      const subBrand = await res.json();
      subBrands.push(subBrand.id);
      return subBrand as { id: string; name: string; hotelChainId: string };
    };

    await use(createSubBrand);

    for (const id of subBrands) {
      await adminRequest.delete(`/api/hotel-chain-sub-brands/${id}`);
    }
  },

  testBooking: async ({ isolatedUser, adminRequest }, use) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const uniqueName = `Test Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: `${YEAR}-08-10`,
        checkOut: `${YEAR}-08-15`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    const booking = await res.json();
    await use({
      id: booking.id,
      propertyName: uniqueName,
      hotelChainName: chain.name,
      request: isolatedUser.request,
      page: isolatedUser.page,
    });
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  },

  apartmentBooking: async ({ isolatedUser }, use) => {
    const uniqueName = `Test Apartment ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        accommodationType: "apartment",
        hotelChainId: null,
        propertyName: uniqueName,
        checkIn: `${YEAR}-08-20`,
        checkOut: `${YEAR}-08-27`,
        numNights: 7,
        pretaxCost: 600,
        taxAmount: 60,
        totalCost: 660,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "FR",
        city: "Paris",
      },
    });
    const booking = await res.json();
    await use({
      id: booking.id,
      propertyName: uniqueName,
      request: isolatedUser.request,
      page: isolatedUser.page,
    });
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  },

  pastYearBooking: async ({ isolatedUser, adminRequest }, use) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    // Use a firmly past year (current - 1) with explicit YYYY-MM-DD dates
    const pastYear = new Date().getFullYear() - 1;
    const uniqueName = `Test Past Year Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: `${pastYear}-06-01`,
        checkOut: `${pastYear}-06-05`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    const booking = await res.json();
    await use({
      id: booking.id,
      propertyName: uniqueName,
      request: isolatedUser.request,
      page: isolatedUser.page,
    });
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  },

  /**
   * A single isolated user with both a current-year booking and a past-year
   * booking. Use in year-filter tests that need the year selector to show
   * both years (since buildYearOptions only includes years with actual
   * bookings — current year is NOT always present by default).
   */
  twoYearBookings: async ({ isolatedUser, adminRequest }, use) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const pastYear = new Date().getFullYear() - 1;
    const currentYear = new Date().getFullYear();

    const currentRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Current Year Hotel ${crypto.randomUUID()}`,
        checkIn: `${currentYear}-08-10`,
        checkOut: `${currentYear}-08-15`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    const currentBooking = await currentRes.json();

    const pastRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Past Year Hotel ${crypto.randomUUID()}`,
        checkIn: `${pastYear}-06-01`,
        checkOut: `${pastYear}-06-05`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    const pastBooking = await pastRes.json();

    await use({
      currentYearBookingId: currentBooking.id,
      pastYearBookingId: pastBooking.id,
      request: isolatedUser.request,
      page: isolatedUser.page,
    });

    await isolatedUser.request.delete(`/api/bookings/${currentBooking.id}`);
    await isolatedUser.request.delete(`/api/bookings/${pastBooking.id}`);
  },

  testPromotion: async ({ isolatedUser }, use) => {
    const uniqueName = `Test Promo ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: uniqueName,
        type: "loyalty",
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 25,
            certType: null,
            sortOrder: 0,
          },
        ],
      },
    });
    const promotion = await res.json();
    await use({
      id: promotion.id,
      name: uniqueName,
      request: isolatedUser.request,
      page: isolatedUser.page,
    });
    await isolatedUser.request.delete(`/api/promotions/${promotion.id}`);
  },
});

export { expect } from "@playwright/test";
