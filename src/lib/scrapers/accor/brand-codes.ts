export const ACCOR_BRAND_CODES: Record<string, string | null> = {
  IBH: "Ibis",
  IBS: "Ibis Styles",
  IBB: "Ibis Budget",
  ETP: "Ibis Budget",
  NOV: "Novotel",
  NOL: "Novotel",
  SUI: "Novotel",
  MER: "Mercure",
  BME: "Mercure",
  MEI: "Mercure",
  MEL: "Mercure",
  SOL: "Sofitel",
  SOF: "Sofitel",
  PUL: "Pullman",
  MOV: "Mövenpick",
  ADG: "Adagio",
  ADA: "Adagio",
  ADP: "Adagio",
  MSH: "Mama Shelter",
  FAI: "Fairmont",
  SEB: "The Sebel",
  HOF: "hotelF1",
  MGA: "MGallery",
  MGS: "MGallery",
  SWI: "Swissôtel",
  SWL: "Swissôtel",
  BAN: "Banyan Tree",
  RIX: "Rixos Hotels",
  TWF: "25hours Hotels",
  RAF: "Raffles",
  JOE: "JO&JOE",
  MTA: "Mantra Hotels",
  BKF: "BreakFree Hotels",
  PEP: "Peppers Hotels",
  MOD: "Mondrian Hotel",
  "21C": "21c Museum Hotels",
  ANG: "Angsana",
  ART: "Art Series",
  DHA: "Dhawa",
  GRE: "greet",
  MTS: "Mantis",
  SO: "SO/",
  SOU: "Handwritten Collection",
  TRI: "TRIBE",
  // Ennismore/Lifestyle brands (acquired via SBE Entertainment / Ennismore merger)
  HOX: "The Hoxton",
  SLS: "SLS Hotels",
  HYD: "Hyde Hotels",
  DEL: "Delano Hotels",
  TOR: "Morgans Originals",
  REH: "The Redbury",
  OUR: "Our Habitas",
  PSC: "Paris Society Collection",
  // Luxury brands
  OEX: "Orient Express Hotels",
  EMB: "Emblems Collection",
  FAE: "Faena Hotels",
  FAR: "Fairmont Residences",
  // Asia minimalist resort brand
  GAR: "Garrya",
  // Extended-stay / serviced apartment brands
  MOL: "Mövenpick Living",
  CAS: "Cassia",
  HOM: "Homm",
  // Rock/lifestyle brand (franchise)
  HAR: "Hard Rock Hotel",
  // Additional Ibis Budget code
  ASE: "Ibis Budget",
  // Hotels classified under "Other brands" on the Accor website
  SAM: "Other brands",
};

export function subBrandNameForCode(
  code: string,
  logger: { warn: (message: string, extra?: Record<string, unknown>) => void },
  context?: Record<string, unknown>
): string | null {
  if (Object.prototype.hasOwnProperty.call(ACCOR_BRAND_CODES, code)) {
    return ACCOR_BRAND_CODES[code];
  }
  logger.warn("accor_ingest:unknown_brand_code", { code, ...context });
  return null;
}
