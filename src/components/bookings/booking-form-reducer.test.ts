import { describe, it, expect } from "vitest";
import {
  bookingFormReducer,
  buildInitialState,
  INITIAL_STATE,
  toPaymentType,
  BookingFormState,
} from "./booking-form-reducer";
import type { Booking, ShoppingPortal } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    hotelChainId: "chain-1",
    hotelChainSubBrandId: null,
    propertyId: "prop-1",
    property: {
      id: "prop-1",
      name: "Test Hotel",
      placeId: null,
      hotelChainId: "chain-1",
      countryCode: null,
      city: null,
      address: null,
      latitude: null,
      longitude: null,
      starRating: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    checkIn: "2026-03-01T00:00:00.000Z",
    checkOut: "2026-03-05T00:00:00.000Z",
    numNights: 4,
    pretaxCost: "200",
    taxAmount: "20",
    totalCost: "220",
    currency: "USD",
    exchangeRate: "1",
    isFutureEstimate: false,
    creditCardId: null,
    shoppingPortalId: null,
    portalCashbackRate: null,
    portalCashbackOnTotal: false,
    loyaltyPointsEarned: null,
    pointsRedeemed: null,
    bookingSource: null,
    otaAgencyId: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    hotelChain: {
      id: "chain-1",
      name: "Test Chain",
      loyaltyProgram: null,
      basePointRate: null,
      pointType: null,
      userStatus: null,
    },
    hotelChainSubBrand: null,
    creditCard: null,
    shoppingPortal: null,
    otaAgency: null,
    bookingPromotions: [],
    certificates: [],
    benefits: [],
    ...overrides,
  } as unknown as Booking;
}

function makePortal(overrides: Partial<ShoppingPortal> = {}): ShoppingPortal {
  return {
    id: "portal-1",
    name: "Test Portal",
    rewardType: "cashback",
    pointTypeId: null,
    pointType: null,
    ...overrides,
  } as ShoppingPortal;
}

// ---------------------------------------------------------------------------
// toPaymentType
// ---------------------------------------------------------------------------

describe("toPaymentType", () => {
  it("returns 'cash' for a standard cash booking", () => {
    expect(toPaymentType(220, null, [])).toBe("cash");
  });

  it("returns 'points' when only points redeemed", () => {
    expect(toPaymentType(0, 40000, [])).toBe("points");
  });

  it("returns 'cert' when only certificate used", () => {
    expect(toPaymentType(0, null, [{ certType: "marriott_35k" }])).toBe("cert");
  });

  it("returns 'cash_points' for mixed cash + points", () => {
    expect(toPaymentType(50, 20000, [])).toBe("cash_points");
  });

  it("returns 'cash_cert' for mixed cash + cert", () => {
    expect(toPaymentType(50, null, [{ certType: "marriott_35k" }])).toBe("cash_cert");
  });

  it("returns 'points_cert' for mixed points + cert", () => {
    expect(toPaymentType(0, 20000, [{ certType: "marriott_35k" }])).toBe("points_cert");
  });

  it("returns 'cash_points_cert' for all three", () => {
    expect(toPaymentType(50, 20000, [{ certType: "marriott_35k" }])).toBe("cash_points_cert");
  });
});

// ---------------------------------------------------------------------------
// buildInitialState
// ---------------------------------------------------------------------------

describe("buildInitialState", () => {
  it("populates fields from a cash booking", () => {
    const state = buildInitialState(makeBooking(), []);
    expect(state.hotelChainId).toBe("chain-1");
    expect(state.propertyName).toBe("Test Hotel");
    expect(state.pretaxCost).toBe("200");
    expect(state.totalCost).toBe("220");
    expect(state.currency).toBe("USD");
    expect(state.paymentType).toBe("cash");
    expect(state.showErrors).toBe(false);
  });

  it("sets hotelChainSubBrandId to 'none' when null", () => {
    const state = buildInitialState(makeBooking({ hotelChainSubBrandId: null }), []);
    expect(state.hotelChainSubBrandId).toBe("none");
  });

  it("sets hotelChainSubBrandId from data when present", () => {
    const state = buildInitialState(makeBooking({ hotelChainSubBrandId: "sb-1" }), []);
    expect(state.hotelChainSubBrandId).toBe("sb-1");
  });

  it("converts cashback portal rate to percentage (×100)", () => {
    const booking = makeBooking({
      shoppingPortalId: "portal-1",
      portalCashbackRate: "0.05",
    });
    const state = buildInitialState(booking, [makePortal({ rewardType: "cashback" })]);
    expect(state.portalCashbackRate).toBe("5");
  });

  it("keeps points portal rate as-is (no ×100)", () => {
    const booking = makeBooking({
      shoppingPortalId: "portal-1",
      portalCashbackRate: "5",
    });
    const state = buildInitialState(booking, [makePortal({ rewardType: "points" })]);
    expect(state.portalCashbackRate).toBe("5");
  });

  it("sets paymentType to 'points' for award booking", () => {
    const state = buildInitialState(makeBooking({ totalCost: "0", pointsRedeemed: 40000 }), []);
    expect(state.paymentType).toBe("points");
    expect(state.pointsRedeemed).toBe("40000");
  });

  it("maps benefits from booking data", () => {
    const booking = makeBooking({
      benefits: [
        {
          id: "ben-1",
          benefitType: "free_breakfast",
          label: null,
          dollarValue: "25",
        },
      ],
    } as Partial<Booking>);
    const state = buildInitialState(booking, []);
    expect(state.benefits).toHaveLength(1);
    expect(state.benefits[0].type).toBe("free_breakfast");
    expect(state.benefits[0].dollarValue).toBe("25");
    expect(state.benefits[0]._id).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

describe("bookingFormReducer", () => {
  describe("SET_FIELD", () => {
    it("updates a scalar string field", () => {
      const next = bookingFormReducer(INITIAL_STATE, {
        type: "SET_FIELD",
        field: "propertyName",
        value: "Grand Hyatt",
      });
      expect(next.propertyName).toBe("Grand Hyatt");
    });

    it("updates a boolean field", () => {
      const next = bookingFormReducer(INITIAL_STATE, {
        type: "SET_FIELD",
        field: "portalCashbackOnTotal",
        value: true,
      });
      expect(next.portalCashbackOnTotal).toBe(true);
    });

    it("sets showErrors to true", () => {
      const next = bookingFormReducer(INITIAL_STATE, {
        type: "SET_FIELD",
        field: "showErrors",
        value: true,
      });
      expect(next.showErrors).toBe(true);
    });
  });

  describe("SET_CHECK_IN", () => {
    it("sets checkIn when no date", () => {
      const next = bookingFormReducer(INITIAL_STATE, { type: "SET_CHECK_IN", date: undefined });
      expect(next.checkIn).toBe("");
    });

    it("sets checkIn and advances checkOut to day+1 when checkOut is unset", () => {
      const date = new Date("2026-03-10T12:00:00");
      const next = bookingFormReducer(INITIAL_STATE, { type: "SET_CHECK_IN", date });
      expect(next.checkIn).toBe("2026-03-10");
      expect(next.checkOut).toBe("2026-03-11");
    });

    it("preserves checkOut when it is already after checkIn", () => {
      const state: BookingFormState = { ...INITIAL_STATE, checkOut: "2026-03-15" };
      const date = new Date("2026-03-10T12:00:00");
      const next = bookingFormReducer(state, { type: "SET_CHECK_IN", date });
      expect(next.checkIn).toBe("2026-03-10");
      expect(next.checkOut).toBe("2026-03-15");
    });

    it("advances checkOut when checkIn moves to equal checkOut date", () => {
      const state: BookingFormState = { ...INITIAL_STATE, checkOut: "2026-03-10" };
      const date = new Date("2026-03-10T12:00:00");
      const next = bookingFormReducer(state, { type: "SET_CHECK_IN", date });
      expect(next.checkIn).toBe("2026-03-10");
      expect(next.checkOut).toBe("2026-03-11");
    });
  });

  describe("SET_PAYMENT_TYPE", () => {
    it("sets paymentType", () => {
      const next = bookingFormReducer(INITIAL_STATE, {
        type: "SET_PAYMENT_TYPE",
        paymentType: "points",
      });
      expect(next.paymentType).toBe("points");
    });

    it("clears pointsRedeemed when switching away from points", () => {
      const state: BookingFormState = {
        ...INITIAL_STATE,
        paymentType: "cash_points",
        pointsRedeemed: "40000",
      };
      const next = bookingFormReducer(state, { type: "SET_PAYMENT_TYPE", paymentType: "cash" });
      expect(next.pointsRedeemed).toBe("");
    });

    it("preserves pointsRedeemed when staying on points type", () => {
      const state: BookingFormState = {
        ...INITIAL_STATE,
        paymentType: "points",
        pointsRedeemed: "40000",
      };
      const next = bookingFormReducer(state, {
        type: "SET_PAYMENT_TYPE",
        paymentType: "cash_points",
      });
      expect(next.pointsRedeemed).toBe("40000");
    });

    it("clears certificates when switching away from cert", () => {
      const state: BookingFormState = {
        ...INITIAL_STATE,
        paymentType: "cash_cert",
        certificates: ["marriott_35k"],
      };
      const next = bookingFormReducer(state, { type: "SET_PAYMENT_TYPE", paymentType: "cash" });
      expect(next.certificates).toEqual([]);
    });
  });

  describe("SET_HOTEL_CHAIN_ID", () => {
    it("sets hotelChainId and resets sub-brand", () => {
      const state: BookingFormState = {
        ...INITIAL_STATE,
        hotelChainId: "chain-1",
        hotelChainSubBrandId: "sb-1",
      };
      const next = bookingFormReducer(state, {
        type: "SET_HOTEL_CHAIN_ID",
        hotelChainId: "chain-2",
      });
      expect(next.hotelChainId).toBe("chain-2");
      expect(next.hotelChainSubBrandId).toBe("none");
    });

    it("filters out certificates that don't belong to the new chain", () => {
      // Empty certs are always kept; certs with no matching CERT_TYPE_OPTIONS entry are removed
      const state: BookingFormState = {
        ...INITIAL_STATE,
        hotelChainId: "chain-1",
        certificates: ["", "unknown_cert_for_chain1"],
      };
      const next = bookingFormReducer(state, {
        type: "SET_HOTEL_CHAIN_ID",
        hotelChainId: "chain-2",
      });
      // The empty cert is kept; "unknown_cert_for_chain1" has no matching CERT_TYPE_OPTIONS entry so it is removed
      expect(next.certificates).toEqual([""]);
    });
  });

  describe("SET_BOOKING_SOURCE", () => {
    it("sets bookingSource and clears otaAgencyId when not OTA", () => {
      const state: BookingFormState = {
        ...INITIAL_STATE,
        bookingSource: "ota",
        otaAgencyId: "agency-1",
      };
      const next = bookingFormReducer(state, {
        type: "SET_BOOKING_SOURCE",
        bookingSource: "direct_web",
      });
      expect(next.bookingSource).toBe("direct_web");
      expect(next.otaAgencyId).toBe("none");
    });

    it("preserves otaAgencyId when source is OTA", () => {
      const state: BookingFormState = { ...INITIAL_STATE, otaAgencyId: "agency-1" };
      const next = bookingFormReducer(state, {
        type: "SET_BOOKING_SOURCE",
        bookingSource: "ota",
      });
      expect(next.bookingSource).toBe("ota");
      expect(next.otaAgencyId).toBe("agency-1");
    });

    it("converts 'none' to empty string", () => {
      const next = bookingFormReducer(INITIAL_STATE, {
        type: "SET_BOOKING_SOURCE",
        bookingSource: "none",
      });
      expect(next.bookingSource).toBe("");
    });
  });

  describe("certificate actions", () => {
    it("ADD_CERTIFICATE appends an empty string", () => {
      const next = bookingFormReducer(INITIAL_STATE, { type: "ADD_CERTIFICATE" });
      expect(next.certificates).toEqual([""]);
    });

    it("UPDATE_CERTIFICATE updates the value at index", () => {
      const state: BookingFormState = { ...INITIAL_STATE, certificates: ["", ""] };
      const next = bookingFormReducer(state, {
        type: "UPDATE_CERTIFICATE",
        index: 1,
        value: "marriott_35k",
      });
      expect(next.certificates).toEqual(["", "marriott_35k"]);
    });

    it("REMOVE_CERTIFICATE removes the entry at index", () => {
      const state: BookingFormState = {
        ...INITIAL_STATE,
        certificates: ["marriott_35k", "marriott_50k"],
      };
      const next = bookingFormReducer(state, { type: "REMOVE_CERTIFICATE", index: 0 });
      expect(next.certificates).toEqual(["marriott_50k"]);
    });
  });

  describe("benefit actions", () => {
    it("ADD_BENEFIT appends a blank item with a stable _id", () => {
      const next = bookingFormReducer(INITIAL_STATE, { type: "ADD_BENEFIT" });
      expect(next.benefits).toHaveLength(1);
      expect(next.benefits[0].type).toBe("");
      expect(next.benefits[0]._id).toBeDefined();
    });

    it("UPDATE_BENEFIT updates the specified field", () => {
      const state = bookingFormReducer(INITIAL_STATE, { type: "ADD_BENEFIT" });
      const id = state.benefits[0]._id;
      const next = bookingFormReducer(state, {
        type: "UPDATE_BENEFIT",
        index: 0,
        field: "type",
        value: "free_breakfast",
      });
      expect(next.benefits[0].type).toBe("free_breakfast");
      // _id is preserved
      expect(next.benefits[0]._id).toBe(id);
    });

    it("REMOVE_BENEFIT removes the entry at index", () => {
      let state = bookingFormReducer(INITIAL_STATE, { type: "ADD_BENEFIT" });
      state = bookingFormReducer(state, { type: "ADD_BENEFIT" });
      expect(state.benefits).toHaveLength(2);
      const next = bookingFormReducer(state, { type: "REMOVE_BENEFIT", index: 0 });
      expect(next.benefits).toHaveLength(1);
    });
  });

  describe("LOAD_INITIAL_DATA", () => {
    it("replaces all form state with data from the booking", () => {
      const booking = makeBooking({
        property: {
          id: "prop-1",
          name: "Loaded Hotel",
          placeId: null,
          chainPropertyId: null,
          hotelChainId: "chain-1",
          countryCode: null,
          city: null,
          address: null,
          latitude: null,
          longitude: null,
          starRating: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        currency: "EUR",
      });
      const next = bookingFormReducer(INITIAL_STATE, {
        type: "LOAD_INITIAL_DATA",
        initialData: booking,
        portals: [],
      });
      expect(next.propertyName).toBe("Loaded Hotel");
      expect(next.currency).toBe("EUR");
      expect(next.showErrors).toBe(false);
    });
  });

  describe("geo actions", () => {
    it("SET_PROPERTY_GEO sets all geo fields and marks geoConfirmed", () => {
      const next = bookingFormReducer(INITIAL_STATE, {
        type: "SET_PROPERTY_GEO",
        result: {
          placeId: "abc123",
          displayName: "Park Hyatt Kuala Lumpur",
          city: "Kuala Lumpur",
          countryCode: "MY",
          address: "123 Jalan Test, Kuala Lumpur",
          latitude: 3.1419,
          longitude: 101.7008,
        },
      });
      expect(next.propertyName).toBe("Park Hyatt Kuala Lumpur");
      expect(next.countryCode).toBe("MY");
      expect(next.city).toBe("Kuala Lumpur");
      expect(next.latitude).toBe(3.1419);
      expect(next.longitude).toBe(101.7008);
      expect(next.geoConfirmed).toBe(true);
    });

    it("CLEAR_GEO clears geo fields and sets geoConfirmed to false", () => {
      const confirmed = bookingFormReducer(INITIAL_STATE, {
        type: "SET_PROPERTY_GEO",
        result: {
          placeId: null,
          displayName: "Some Hotel",
          city: "London",
          countryCode: "GB",
          address: null,
          latitude: 51.5,
          longitude: -0.1,
        },
      });
      expect(confirmed.geoConfirmed).toBe(true);

      const cleared = bookingFormReducer(confirmed, { type: "CLEAR_GEO" });
      expect(cleared.geoConfirmed).toBe(false);
      expect(cleared.countryCode).toBeNull();
      expect(cleared.city).toBeNull();
      expect(cleared.latitude).toBeNull();
      expect(cleared.longitude).toBeNull();
      // propertyName is preserved (user is still typing)
      expect(cleared.propertyName).toBe("Some Hotel");
    });

    it("RESET_PROPERTY clears propertyName and all geo fields", () => {
      const confirmed = bookingFormReducer(INITIAL_STATE, {
        type: "SET_PROPERTY_GEO",
        result: {
          placeId: null,
          displayName: "Some Hotel",
          city: "London",
          countryCode: "GB",
          address: null,
          latitude: 51.5,
          longitude: -0.1,
        },
      });
      const reset = bookingFormReducer(confirmed, { type: "RESET_PROPERTY" });
      expect(reset.propertyName).toBe("");
      expect(reset.geoConfirmed).toBe(false);
      expect(reset.countryCode).toBeNull();
      expect(reset.city).toBeNull();
      expect(reset.latitude).toBeNull();
      expect(reset.longitude).toBeNull();
    });

    it("buildInitialState populates geo from booking.property", () => {
      const booking = makeBooking({
        property: {
          id: "prop-1",
          name: "Test Hotel",
          placeId: null,
          chainPropertyId: null,
          hotelChainId: "chain-1",
          countryCode: "SG",
          city: "Singapore",
          address: null,
          latitude: null,
          longitude: null,
          starRating: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      });
      const state = buildInitialState(booking, []);
      expect(state.geoConfirmed).toBe(true);
      expect(state.countryCode).toBe("SG");
      expect(state.city).toBe("Singapore");
    });

    it("buildInitialState sets geoConfirmed true even when property has no countryCode", () => {
      const state = buildInitialState(makeBooking(), []);
      expect(state.geoConfirmed).toBe(true); // existing bookings always confirmed
      expect(state.countryCode).toBeNull();
    });
  });
});
