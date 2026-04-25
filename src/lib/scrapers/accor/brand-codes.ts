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
  SAM: null,
};

export function subBrandNameForCode(
  code: string,
  logger: { warn: (message: string, extra?: Record<string, unknown>) => void }
): string | null {
  if (Object.prototype.hasOwnProperty.call(ACCOR_BRAND_CODES, code)) {
    return ACCOR_BRAND_CODES[code];
  }
  logger.warn("accor_ingest:unknown_brand_code", { code });
  return null;
}
