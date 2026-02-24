import { test as base } from "@playwright/test";

type TestFixtures = {
  testBooking: { id: number; propertyName: string; hotelChainName: string };
  testPromotion: { id: number; name: string };
};

export const test = base.extend<TestFixtures>({
  testBooking: async ({ request }, use) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const uniqueName = `Test Hotel ${crypto.randomUUID()}`;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: "2025-01-10",
        checkOut: "2025-01-15",
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking = await res.json();
    await use({ id: booking.id, propertyName: uniqueName, hotelChainName: chain.name });
    await request.delete(`/api/bookings/${booking.id}`);
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
        isActive: true,
      },
    });
    const promotion = await res.json();
    await use({ id: promotion.id, name: uniqueName });
    await request.delete(`/api/promotions/${promotion.id}`);
  },
});

export { expect } from "@playwright/test";
