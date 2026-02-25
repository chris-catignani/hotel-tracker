import { test as base } from "@playwright/test";

type TestFixtures = {
  testBooking: { id: string; propertyName: string; hotelChainName: string };
  testPromotion: { id: string; name: string };
  testHotelChain: { id: string; name: string };
  testSubBrand: (name?: string) => Promise<{ id: string; name: string; hotelChainId: string }>;
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
