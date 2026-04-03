import type { TravelStop } from "@/app/api/travel-map/route";

export type AnimationStop = TravelStop & { isHome?: boolean };

export interface HomebaseEntry {
  address: string;
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export const HOMEBASE_STORAGE_KEY = "travel-map-homebase";
const HOMEBASE_GAP_THRESHOLD_DAYS = 5;

export const HOME_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" style="filter:drop-shadow(0 0 8px #f59e0b);display:block;"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="#f59e0b" stroke-width="2"/></svg>`;

export function insertHomebaseStops(stops: TravelStop[], homebase: HomebaseEntry): AnimationStop[] {
  const result: AnimationStop[] = [];
  for (let i = 0; i < stops.length; i++) {
    result.push(stops[i]);
    if (i < stops.length - 1) {
      const checkOut = new Date(stops[i].checkIn);
      checkOut.setDate(checkOut.getDate() + stops[i].numNights);
      const nextCheckIn = new Date(stops[i + 1].checkIn);
      const gapDays = (nextCheckIn.getTime() - checkOut.getTime()) / (1000 * 60 * 60 * 24);
      if (gapDays > HOMEBASE_GAP_THRESHOLD_DAYS) {
        result.push({
          id: `home-${stops[i].id}`,
          propertyName: homebase.city || "Home",
          city: homebase.city,
          countryCode: homebase.countryCode,
          checkIn: checkOut.toISOString().slice(0, 10),
          numNights: 0,
          lat: homebase.lat,
          lng: homebase.lng,
          isHome: true,
        });
      }
    }
  }
  return result;
}
