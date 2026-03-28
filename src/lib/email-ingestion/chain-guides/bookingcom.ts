import type { ChainGuide } from "../types";

export const bookingcomGuide: ChainGuide = {
  chainName: "Booking.com",
  senderDomains: ["booking.com", "mailer.booking.com"],
  terminologyMappings: [],
  promptNotes:
    'Booking.com handles both hotels and apartments. Set accommodationType to "apartment" for apartments, serviced apartments, villas, or houses; "hotel" for hotels and traditional accommodations. ' +
    "For apartments set hotelChain and subBrand to null. " +
    'bookingType is always "cash". ' +
    'Use "Booking number" as the confirmationNumber.',
};
