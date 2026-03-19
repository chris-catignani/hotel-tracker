// Stable IDs shared across multiple seed files.
// Define IDs here when they are referenced in more than one seed file.

// One UserCreditCard instance per card product used in seed bookings.
// These are stable so seed-bookings.ts can reference them by ID.
export const USER_CREDIT_CARD_ID = {
  CHASE_SAPPHIRE_RESERVE: "cucccsrcard00000000000001",
  WELLS_FARGO_AUTOGRAPH: "cuccwfacard00000000000001",
} as const;

export const CREDIT_CARD_ID = {
  AMEX_PLATINUM: "cme8yfwy2hfqahb6ync8czd24",
  CHASE_SAPPHIRE_RESERVE: "cw4yg6ftdskwq651p3p8nrvnr",
  CAPITAL_ONE_VENTURE_X: "cwkch5kds4vlhety0vbjxep5m",
  WELLS_FARGO_AUTOGRAPH: "cvn8tp6d6nae4s543nno1qc6p",
} as const;

export const SHOPPING_PORTAL_ID = {
  RAKUTEN: "cj774ttrj5g3wzk24foulu47x",
  TOPCASHBACK: "cnj91ehnjvuu34xnsa8l9lem4",
  BRITISH_AIRWAYS: "cjh7oskumoc40su7j747thqig",
} as const;

export const OTA_AGENCY_ID = {
  AMEX_FHR: "c2kjfusly4a0127ty3vj1ilii",
  AMEX_THC: "c0t44386bltnv0weekdizhsbo",
  CHASE_EDIT: "c656cp2gyguq568kf1ukey5hz",
} as const;
