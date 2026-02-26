export const HOTEL_ID = {
  HILTON: "c1v12til5p1ebxu77368umx5z",
  MARRIOTT: "c9uc76fdp3v95dccffxsa3h31",
  HYATT: "cxjdwg32a8xf7by36md0mdvuu",
  IHG: "co5ll49okbgq0fbceti8p0dpd",
  GHA_DISCOVERY: "cwizlxi70wnbaq3qehma0fhbz",
  ACCOR: "cv53wjloc78ambkei5wlnsvfn",
} as const;

export const SUB_BRAND_ID = {
  MARRIOTT: {
    AUTOGRAPH_COLLECTION: "chp49do4y7cqmn8hslv1mybao",
    CITIZENM: "c6bbtoocrvncdrrbk132ja590",
    MOXY: "c4bwgkazkhr249673vbyrssjq",
    TRIBUTE_PORTFOLIO: "ceaflewyzoa8xcdfui5f510n0",
  },
  HYATT: {
    PARK_HYATT: "cd7oxx4b5kfe0rq65x74ha3gu",
    HYATT_CENTRIC: "c6b6y4o6u20bqlv0fjuvb9k6i",
    HYATT_PLACE: "cwf3srsbp7rv61q9c9f9zbapb",
  },
  IHG: {
    HOLIDAY_INN_EXPRESS: "cdfi8ldn9nllyjjrfqgeho0be",
    HOTEL_INDIGO: "caugp7vwgq7oy52v7h22eoj7f",
  },
  GHA_DISCOVERY: {
    SUNWAY: "c0qxg9nbkd2qzlaz7cl0ek05c",
    PARKROYAL: "cj7yen4u5zazxezcgzore4e71",
    PARKROYAL_COLLECTION: "clsi50jt27f0upikgefn4y84v",
  },
  ACCOR: {
    IBIS_STYLES: "cv2toj341anbybixocwk8voaq",
  },
} as const;

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CHF",
  "MXN",
  "SGD",
  "HKD",
  "MYR",
  "NTD",
  "THB",
  "IDR",
  "NZD",
];

export const PAYMENT_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "points", label: "Points (Award Stay)" },
  { value: "cert", label: "Certificate(s) (Free Night)" },
  { value: "points_cert", label: "Points + Certificate(s)" },
  { value: "cash_points", label: "Cash + Points" },
  { value: "cash_cert", label: "Cash + Certificate(s)" },
  { value: "cash_points_cert", label: "Cash + Points + Certificate(s)" },
] as const;

export const BOOKING_SOURCE_OPTIONS = [
  { value: "direct_web", label: "Direct — Hotel Chain Website" },
  { value: "direct_app", label: "Direct — Hotel Chain App" },
  { value: "ota", label: "Online Travel Agency (OTA)" },
  { value: "other", label: "Other" },
];

export const BENEFIT_TYPE_OPTIONS = [
  { value: "free_breakfast", label: "Free Breakfast" },
  { value: "dining_credit", label: "Dining Credit" },
  { value: "spa_credit", label: "Spa Credit" },
  { value: "room_upgrade", label: "Room Upgrade" },
  { value: "late_checkout", label: "Late Checkout" },
  { value: "early_checkin", label: "Early Check-in" },
  { value: "other", label: "Other" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hotel",
  airline: "Airline",
  transferable: "Transferable",
};

export const BENEFIT_REWARD_TYPE_OPTIONS = [
  { value: "cashback", label: "Cashback" },
  { value: "points", label: "Points" },
  { value: "certificate", label: "Certificate" },
  { value: "eqn", label: "Bonus EQNs" },
] as const;

export const DEFAULT_EQN_VALUE = 10.0;
