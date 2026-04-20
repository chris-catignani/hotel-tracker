import { test, expect } from "./fixtures";

const YEAR = new Date().getFullYear();

test.describe("promotion: booked after registration", () => {
  test("transitions between pre-qualifying, orphaned, and matching based on bookingDate", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    // 1. Promotion with requireBookedAfterRegistration = true, no registrationDate yet.
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Register-then-book ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 25,
            certType: null,
            sortOrder: 0,
            restrictions: null,
          },
        ],
        restrictions: {
          requireBookedAfterRegistration: true,
        },
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // 2. Booking with bookingDate BEFORE any registrationDate — pre-qualifying
    //    (rule is on but user has not registered yet).
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Booked-After-Reg Stay ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-03`,
        numNights: 2,
        pretaxCost: 360,
        taxAmount: 40,
        totalCost: 400,
        currency: "USD",
        bookingDate: `${YEAR}-04-10`,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    const getAppliedPromo = async () => {
      const res = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
      expect(res.ok()).toBeTruthy();
      const fresh = await res.json();
      const applied = fresh.bookingPromotions.find(
        (bp: { promotionId: string }) => bp.promotionId === promo.id
      );
      expect(applied, `promotion ${promo.id} not attached to booking`).toBeDefined();
      return applied;
    };

    let applied = await getAppliedPromo();
    expect(applied.isPreQualifying).toBe(true);
    expect(applied.isOrphaned).toBe(false);
    expect(Number(applied.appliedValue)).toBe(0);

    // 3. Register the user AFTER the booking date → orphaned (booked before reg).
    const updateRegRes = await isolatedUser.request.put(`/api/promotions/${promo.id}`, {
      data: {
        name: promo.name,
        type: promo.type,
        hotelChainId: testHotelChain.id,
        benefits: promo.benefits.map(
          (b: {
            rewardType: string;
            valueType: string;
            value: number;
            certType: string | null;
            sortOrder: number;
          }) => ({
            rewardType: b.rewardType,
            valueType: b.valueType,
            value: b.value,
            certType: b.certType,
            sortOrder: b.sortOrder,
            restrictions: null,
          })
        ),
        restrictions: {
          requireBookedAfterRegistration: true,
          registrationDate: `${YEAR}-04-15`,
        },
      },
    });
    expect(updateRegRes.ok()).toBeTruthy();

    // Trigger a re-match by touching the booking.
    await isolatedUser.request.put(`/api/bookings/${booking.id}`, {
      data: { bookingDate: `${YEAR}-04-10` },
    });

    applied = await getAppliedPromo();
    expect(applied.isOrphaned).toBe(true);
    expect(applied.isPreQualifying).toBe(false);
    expect(Number(applied.appliedValue)).toBe(0);

    // 4. Move bookingDate to ON registrationDate → rule passes, reward applies.
    await isolatedUser.request.put(`/api/bookings/${booking.id}`, {
      data: { bookingDate: `${YEAR}-04-15` },
    });

    applied = await getAppliedPromo();
    expect(applied.isOrphaned).toBe(false);
    expect(applied.isPreQualifying).toBe(false);
    expect(Number(applied.appliedValue)).toBe(25);

    // 5. Clear bookingDate → orphaned again (rule on, reg present, no booking date).
    await isolatedUser.request.put(`/api/bookings/${booking.id}`, {
      data: { bookingDate: null },
    });

    applied = await getAppliedPromo();
    expect(applied.isOrphaned).toBe(true);
    expect(Number(applied.appliedValue)).toBe(0);

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });
});
