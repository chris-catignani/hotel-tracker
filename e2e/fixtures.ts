import { test as base } from "@playwright/test";

type TestFixtures = {
  testBooking: { id: number; propertyName: string; hotelChainName: string };
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
});

export { expect } from "@playwright/test";
