export interface HyattParsedProperty {
  chainPropertyId: string;
  name: string;
  subBrandName: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  chainUrlPath: string | null;
}

export interface ParseResult {
  properties: HyattParsedProperty[];
  skippedCount: number;
}

interface RawProperty {
  spiritCode: string;
  openStatus: string;
  name: string;
  brand?: { label?: string };
  location?: {
    addressLine1?: string;
    city?: string;
    country?: { key?: string };
    geolocation?: { latitude?: number; longitude?: number } | null;
  };
  url?: string | null;
}

type StoreProperties = Record<
  string,
  Record<string, Record<string, Record<string, RawProperty[]>>>
>;

function extractStoreProperties(html: string): StoreProperties | null {
  const idx = html.indexOf("window.STORE = ");
  if (idx === -1) return null;
  const jsonStart = html.indexOf("{", idx);
  if (jsonStart === -1) return null;
  const scriptEnd = html.indexOf("</script>", jsonStart);
  if (scriptEnd === -1) return null;
  const jsonStr = html.substring(jsonStart, scriptEnd).trim().replace(/;$/, "");
  try {
    const store = JSON.parse(jsonStr);
    return store?.properties ?? null;
  } catch {
    return null;
  }
}

function urlToPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

function mapProperty(raw: RawProperty): HyattParsedProperty {
  const geo = raw.location?.geolocation;
  return {
    chainPropertyId: raw.spiritCode,
    name: raw.name,
    subBrandName: raw.brand?.label ?? "",
    address: raw.location?.addressLine1 ?? null,
    city: raw.location?.city ?? null,
    countryCode: raw.location?.country?.key ?? null,
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
    chainUrlPath: urlToPath(raw.url),
  };
}

export function parseHyattStore(html: string): ParseResult {
  const storeProperties = extractStoreProperties(html);
  if (!storeProperties) return { properties: [], skippedCount: 0 };

  const properties: HyattParsedProperty[] = [];
  let skippedCount = 0;

  for (const byBrand of Object.values(storeProperties)) {
    for (const byCountry of Object.values(byBrand)) {
      for (const byState of Object.values(byCountry)) {
        for (const rawList of Object.values(byState)) {
          for (const raw of rawList) {
            if (raw.openStatus === "NOT_BOOKABLE") {
              skippedCount++;
              continue;
            }
            properties.push(mapProperty(raw));
          }
        }
      }
    }
  }

  return { properties, skippedCount };
}
