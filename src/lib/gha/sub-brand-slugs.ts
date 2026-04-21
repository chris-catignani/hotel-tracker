export const GHA_SUB_BRAND_SLUGS: Record<string, string> = {
  anantara: "Anantara Hotels & Resorts",
  asmallworld: "ASMALLWORLD",
  avani: "Avani Hotels & Resorts",
  "campbell-gray": "Campbell Gray Hotels",
  capella: "Capella Hotels & Resorts",
  corinthia: "Corinthia Hotels",
  elewana: "Elewana Collection",
  kempinski: "Kempinski Hotels",
  leela: "The Leela Palaces, Hotels and Resorts",
  lungarno: "Lungarno Collection",
  "minor-hotels": "Minor Hotels",
  "nh-hotels-resorts": "NH Hotels & Resorts",
  nhcollection: "NH Collection",
  nhow: "nhow Hotels",
  niccolo: "Niccolo Hotels",
  oaks: "Oaks Hotels, Resorts & Suites",
  omni: "Omni Hotels & Resorts",
  outrigger: "Outrigger Resorts",
  "pan-pacific": "Pan Pacific Hotels & Resorts",
  parkroyal: "PARKROYAL Hotels & Resorts",
  rotana: "Rotana Hotels & Resorts",
  tivoli: "Tivoli Hotels & Resorts",
  "ultratravel-collection": "Ultratravel Collection",
};

export function subBrandNameForSlug(slug: string): string {
  return (
    GHA_SUB_BRAND_SLUGS[slug] ??
    slug
      .split("-")
      .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
      .join(" ")
  );
}

export const GHA_NON_PROPERTY_SEGMENTS = new Set<string>([
  "search",
  "member",
  "our-partners",
  "destination-guides",
  "support",
]);

export const GHA_COLLECTION_SLUGS_DEPRIO = new Set<string>(["ultratravel-collection"]);
