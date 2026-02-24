export const HOTEL_ID = {
  HILTON: 1,
  MARRIOTT: 2,
  HYATT: 3,
  IHG: 4,
  GHA_DISCOVERY: 5,
  ACCOR: 6,
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
  { value: "fixed_points", label: "Fixed Points" },
  { value: "points_multiplier", label: "Points Multiplier" },
  { value: "certificate", label: "Certificate" },
  { value: "eqn", label: "Bonus EQNs" },
] as const;
