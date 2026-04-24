import { countryNameToCode } from "./country-name-to-code";

export interface GhaParsedProperty {
  chainPropertyId: string | null;
  chainUrlPath: string;
  name: string;
  subBrandSlug: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  countryCode: string | null;
  unknownCountryName: string | null;
  zipCode: string | null;
}

const SCRIPT_RE = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

type LocationNode = { parentLocation?: { content?: { name?: string; _location?: unknown } } };

function parseCoord(val: string | number | null | undefined): number | null {
  const n = parseFloat(String(val));
  return isFinite(n) ? n : null;
}

function extractCountryName(location: unknown): string | null {
  if (!location || typeof location !== "object") return null;
  const content = (location as LocationNode).parentLocation?.content;
  if (!content) return null;
  if (typeof content.name === "string") return content.name;
  return extractCountryName(content._location);
}

export function parseGhaPropertyNextData(html: string, urlPath: string): GhaParsedProperty | null {
  const match = html.match(SCRIPT_RE);
  if (!match) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    return null;
  }

  const page = (payload as { props?: { pageProps?: { page?: Record<string, unknown> } } })?.props
    ?.pageProps?.page;
  if (!page) return null;

  const info = page._info as { id?: unknown } | undefined;
  if (info?.id == null) return null;

  const subBrandSlug = urlPath.split("/").filter(Boolean)[0] ?? "";
  if (!subBrandSlug) return null;

  const location = page.location as
    | { address?: string; latitude?: string | number; longitude?: string | number }
    | undefined;
  const city = page.city as
    | {
        name?: string;
        _location?: unknown;
      }
    | undefined;

  const countryName = extractCountryName(city?._location);
  const countryCode = countryName ? countryNameToCode(countryName) : null;

  return {
    chainPropertyId: info?.id != null ? String(info.id) : null,
    chainUrlPath: urlPath,
    name: typeof page.name === "string" ? page.name : "",
    subBrandSlug,
    address: typeof location?.address === "string" ? location.address : null,
    latitude: parseCoord(location?.latitude),
    longitude: parseCoord(location?.longitude),
    city: typeof city?.name === "string" ? city.name : null,
    countryCode,
    unknownCountryName: countryName && countryCode === null ? countryName : null,
    zipCode: typeof page.zipCode === "string" ? page.zipCode : null,
  };
}
