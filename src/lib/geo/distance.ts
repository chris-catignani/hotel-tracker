const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

export interface LatLngBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Conservative bounding box around (lat, lng) containing every point within radiusMiles. */
export function boundingBox(lat: number, lng: number, radiusMiles: number): LatLngBox {
  const latDelta = radiusMiles / 69;
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 0.0001);
  const lngDelta = radiusMiles / (69 * cos);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}
