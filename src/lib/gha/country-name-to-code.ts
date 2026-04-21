import { COUNTRIES } from "@/lib/countries";

const ALIASES: Record<string, string> = {
  "united states of america": "US",
  "u.s.a.": "US",
  usa: "US",
  "czech republic": "CZ",
  czechia: "CZ",
  "south korea": "KR",
  "korea, republic of": "KR",
  russia: "RU",
  vietnam: "VN",
  "viet nam": "VN",
};

const NAME_TO_CODE: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const c of COUNTRIES) m.set(c.name.toLowerCase(), c.code);
  for (const [alias, code] of Object.entries(ALIASES)) m.set(alias, code);
  return m;
})();

export function countryNameToCode(name: string): string | null {
  return NAME_TO_CODE.get(name.trim().toLowerCase()) ?? null;
}
