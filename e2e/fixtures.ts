import { test as base, type APIRequestContext, type Page } from "@playwright/test";
import crypto from "crypto";
import { CREDIT_CARD_ID } from "../prisma/seed-ids";

const YEAR = new Date().getFullYear();

type TestFixtures = {
  testBooking: { id: string; propertyName: string; hotelChainName: string };
  apartmentBooking: { id: string; propertyName: string };
  pastYearBooking: { id: string; propertyName: string };
  testPromotion: { id: string; name: string };
  testHotelChain: { id: string; name: string };
  testSubBrand: (name?: string) => Promise<{ id: string; name: string; hotelChainId: string }>;
  /**
   * An isolated per-test user with their own AMEX Business Platinum UserCreditCard.
   * Use this fixture in card-benefit tests to prevent parallel chromium/webkit runs
   * from sharing bookings and accidentally exhausting each other's benefit caps.
   * Use the `request` field for booking API calls; use the default `request` fixture
   * (admin) for card benefit CRUD.
   */
  isolatedUserRequest: { request: APIRequestContext; userCreditCardId: string };
  /**
   * An isolated per-test user with both an API request context and a browser page.
   * Use this when a test needs to assert UI state (e.g. dashboard) that is scoped
   * to the current user — the page is logged in as the isolated user so their
   * dashboard only shows their own bookings.
   * Use the default `request` fixture (admin) for reference-data writes (credit
   * cards, portals, hotel chains).
   */
  isolatedUserWithPage: { page: Page; request: APIRequestContext };
};

export const test = base.extend<TestFixtures>({
  testHotelChain: async ({ request }, use) => {
    const uniqueName = `Test Chain ${crypto.randomUUID()}`;
    const res = await request.post("/api/hotel-chains", {
      data: { name: uniqueName },
    });
    const chain = await res.json();
    await use({ id: chain.id, name: uniqueName });
    await request.delete(`/api/hotel-chains/${chain.id}`);
  },

  testSubBrand: async ({ request, testHotelChain }, use) => {
    const subBrands: string[] = [];
    const createSubBrand = async (name?: string) => {
      const uniqueName = name || `Test SubBrand ${crypto.randomUUID()}`;
      const res = await request.post(
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
      await request.delete(`/api/hotel-chain-sub-brands/${id}`);
    }
  },

  testBooking: async ({ request }, use) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const uniqueName = `Test Hotel ${crypto.randomUUID()}`;
    const res = await request.post("/api/bookings", {
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
    await use({ id: booking.id, propertyName: uniqueName, hotelChainName: chain.name });
    await request.delete(`/api/bookings/${booking.id}`);
  },

  apartmentBooking: async ({ request }, use) => {
    const uniqueName = `Test Apartment ${crypto.randomUUID()}`;
    const res = await request.post("/api/bookings", {
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
    await use({ id: booking.id, propertyName: uniqueName });
    await request.delete(`/api/bookings/${booking.id}`);
  },

  pastYearBooking: async ({ request }, use) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    // Use a firmly past year (current - 1) with explicit YYYY-MM-DD dates
    const pastYear = new Date().getFullYear() - 1;
    const uniqueName = `Test Past Year Hotel ${crypto.randomUUID()}`;
    const res = await request.post("/api/bookings", {
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
    await use({ id: booking.id, propertyName: uniqueName });
    await request.delete(`/api/bookings/${booking.id}`);
  },

  isolatedUserRequest: async ({ playwright, baseURL }, use) => {
    const resolvedBase = baseURL ?? "http://127.0.0.1:3001";
    const email = `test-isolated-${crypto.randomUUID()}@example.com`;
    const password = "testpass123";

    // Use a single request context throughout — it accumulates cookies automatically.
    const userRequest = await playwright.request.newContext({ baseURL: resolvedBase });

    // Register user (unauthenticated endpoint)
    await userRequest.post("/api/auth/register", {
      data: { email, password, name: "Isolated Test User" },
    });

    // Obtain the CSRF token (also sets the authjs.csrf-token cookie on the context)
    const csrfRes = await userRequest.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    // Sign in via next-auth's credentials callback — sets authjs.session-token cookie
    await userRequest.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password, callbackUrl: resolvedBase, redirect: "false" },
    });

    // Create a UserCreditCard for this user (AMEX Business Platinum)
    const cardRes = await userRequest.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await cardRes.json()) as { id: string };

    await use({ request: userRequest, userCreditCardId });

    // Cleanup: delete the UserCreditCard then dispose the context
    // (bookings/benefits are cleaned in each test's own finally block)
    await userRequest.delete(`/api/user-credit-cards/${userCreditCardId}`);
    await userRequest.dispose();
  },

  isolatedUserWithPage: async ({ playwright, browser, baseURL }, use) => {
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

    // Share the session cookies with a real browser context so the page is
    // logged in as the same isolated user.
    const storageState = await userRequest.storageState();
    const context = await browser.newContext({ baseURL: resolvedBase, storageState });
    const page = await context.newPage();

    await use({ page, request: userRequest });

    await page.close();
    await context.close();
    await userRequest.dispose();
  },

  testPromotion: async ({ request }, use) => {
    const uniqueName = `Test Promo ${crypto.randomUUID()}`;
    const res = await request.post("/api/promotions", {
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
    await use({ id: promotion.id, name: uniqueName });
    await request.delete(`/api/promotions/${promotion.id}`);
  },
});

export { expect } from "@playwright/test";
