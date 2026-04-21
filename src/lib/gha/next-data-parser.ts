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
  zipCode: string | null;
  chainCategories: string[];
}

const SCRIPT_RE = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

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

  const info = page._info as { id?: unknown; type?: unknown } | undefined;
  if (info?.type !== "hotel") return null;

  const subBrandSlug = urlPath.split("/").filter(Boolean)[0] ?? "";
  if (!subBrandSlug) return null;

  const location = page.location as
    | { address?: string; latitude?: number; longitude?: number }
    | undefined;
  const city = page.city as
    | {
        name?: string;
        _location?: { parentLocation?: { content?: { name?: string } } };
      }
    | undefined;
  const categories = Array.isArray(page.categories)
    ? (page.categories as { name?: unknown }[])
        .map((c) => (typeof c.name === "string" ? c.name : null))
        .filter((s): s is string => s !== null)
    : [];

  const countryName = city?._location?.parentLocation?.content?.name ?? null;

  return {
    chainPropertyId: info?.id != null ? String(info.id) : null,
    chainUrlPath: urlPath,
    name: typeof page.name === "string" ? page.name : "",
    subBrandSlug,
    address: typeof location?.address === "string" ? location.address : null,
    latitude: typeof location?.latitude === "number" ? location.latitude : null,
    longitude: typeof location?.longitude === "number" ? location.longitude : null,
    city: typeof city?.name === "string" ? city.name : null,
    countryCode: countryName ? countryNameToCode(countryName) : null,
    zipCode: typeof page.zipCode === "string" ? page.zipCode : null,
    chainCategories: categories,
  };
}
