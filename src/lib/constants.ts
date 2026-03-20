export const HOTEL_ID = {
  HILTON: "c1v12til5p1ebxu77368umx5z",
  MARRIOTT: "c9uc76fdp3v95dccffxsa3h31",
  HYATT: "cxjdwg32a8xf7by36md0mdvuu",
  IHG: "co5ll49okbgq0fbceti8p0dpd",
  GHA_DISCOVERY: "cwizlxi70wnbaq3qehma0fhbz",
  ACCOR: "cv53wjloc78ambkei5wlnsvfn",
} as const;

export const SUB_BRAND_ID = {
  HILTON: {
    HILTON: "cmmnj4ily000ylpw8x09l0v31",
  },
  MARRIOTT: {
    AUTOGRAPH_COLLECTION: "chp49do4y7cqmn8hslv1mybao",
    CITIZENM: "c6bbtoocrvncdrrbk132ja590",
    MOXY: "c4bwgkazkhr249673vbyrssjq",
    TRIBUTE_PORTFOLIO: "ceaflewyzoa8xcdfui5f510n0",
  },
  HYATT: {
    ALILA: "cmmnj54i30046lpw8v1nqdjso",
    HYATT_CENTRIC: "c6b6y4o6u20bqlv0fjuvb9k6i",
    HYATT_HOUSE: "cmmepq6ks004jlpl1ghsje2x0",
    HYATT_PLACE: "cwf3srsbp7rv61q9c9f9zbapb",
    HYATT_REGENCY: "cmmnj5hlz004qlpw8bc3yyys8",
    PARK_HYATT: "cd7oxx4b5kfe0rq65x74ha3gu",
    THE_STANDARD: "cmmnj5nos005ilpw8qmcjxwv2",
    THE_STANDARDX: "cmmw44bvp000dl804919wjtpk",
  },
  IHG: {
    HOLIDAY_INN: "cmmnj5l9r006clpw8z261y2vc",
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
    MONDRIAN: "cmmnj6lhf00c6lpw8ro1u3xb0",
    SOFITEL: "cmmnj6o3200cslpw8r2u56g5c",
  },
} as const;

export const CURRENCY_OPTIONS = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "INR", name: "Indian Rupee" },
  { code: "KRW", name: "South Korean Won" },
  { code: "ZAR", name: "South African Rand" },
  { code: "THB", name: "Thai Baht" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "TWD", name: "Taiwan Dollar" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "AED", name: "UAE Dirham" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "ILS", name: "Israeli Shekel" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RON", name: "Romanian Leu" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "LKR", name: "Sri Lankan Rupee" },
] as const;

export const CURRENCIES = CURRENCY_OPTIONS.map((c) => c.code);

/** Maps ISO 3166-1 alpha-2 country codes to their primary currency code. */
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  // Euro zone
  AT: "EUR",
  BE: "EUR",
  CY: "EUR",
  EE: "EUR",
  FI: "EUR",
  FR: "EUR",
  DE: "EUR",
  GR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LV: "EUR",
  LT: "EUR",
  LU: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SK: "EUR",
  SI: "EUR",
  ES: "EUR",
  HR: "EUR",
  // Asia-Pacific
  JP: "JPY",
  CN: "CNY",
  AU: "AUD",
  HK: "HKD",
  SG: "SGD",
  NZ: "NZD",
  KR: "KRW",
  TH: "THB",
  ID: "IDR",
  MY: "MYR",
  PH: "PHP",
  TW: "TWD",
  VN: "VND",
  IN: "INR",
  // Americas
  CA: "CAD",
  MX: "MXN",
  BR: "BRL",
  // Europe (non-Euro)
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  TR: "TRY",
  // Middle East & Africa
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  IL: "ILS",
  EG: "EGP",
  ZA: "ZAR",
  NG: "NGN",
  // South Asia
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
};

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

export const BOOKING_SOURCE_LABELS: Record<string, string> = {
  direct_web: "Direct Web",
  direct_app: "Mobile App",
  ota: "OTA (Expedia, etc.)",
  other: "Other",
};

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

export const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", label: "Hotel" },
  { value: "apartment", label: "Apartment / Short-term Rental" },
] as const;
