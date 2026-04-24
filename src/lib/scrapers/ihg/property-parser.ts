interface IhgHotelContent {
  hotelCode?: string;
  brandInfo?: { brandName?: string };
  profile?: {
    gdsName?: string;
    latLong?: { latitude?: string; longitude?: string };
    hotelStatus?: string;
  };
  address?: {
    isoCountryCode?: string;
    translatedMainAddress?: {
      city?: Array<{ value?: string }>;
      line1?: Array<{ value?: string }>;
    };
  };
}

interface IhgProfileResponse {
  hotelContent?: IhgHotelContent[];
}

export interface IhgParsedProperty {
  chainPropertyId: string;
  name: string;
  subBrandName: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function parseIhgProfile(raw: unknown): IhgParsedProperty | null {
  const resp = raw as IhgProfileResponse;
  const content = resp?.hotelContent?.[0];
  if (!content) return null;

  const hotelCode = content.hotelCode;
  if (!hotelCode) return null;

  if (content.profile?.hotelStatus !== "OPEN") return null;

  const rawName = content.profile?.gdsName ?? "";
  const name = rawName.replace(/ by IHG$/i, "").trim();

  const latStr = content.profile?.latLong?.latitude;
  const lngStr = content.profile?.latLong?.longitude;

  return {
    chainPropertyId: hotelCode,
    name,
    subBrandName: content.brandInfo?.brandName ?? "",
    address: content.address?.translatedMainAddress?.line1?.[0]?.value ?? null,
    city: content.address?.translatedMainAddress?.city?.[0]?.value ?? null,
    countryCode: content.address?.isoCountryCode ?? null,
    latitude: latStr != null ? parseFloat(latStr) : null,
    longitude: lngStr != null ? parseFloat(lngStr) : null,
  };
}
