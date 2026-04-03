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

export function insertHomebaseStops(stops: TravelStop[], homebase: HomebaseEntry): AnimationStop[] {
  const result: AnimationStop[] = [];
  for (let i = 0; i < stops.length; i++) {
    result.push(stops[i]);
    if (i < stops.length - 1) {
      const checkOut = new Date(stops[i].checkIn);
      checkOut.setDate(checkOut.getDate() + stops[i].numNights);
      const nextCheckIn = new Date(stops[i + 1].checkIn);
      const gapDays = (nextCheckIn.getTime() - checkOut.getTime()) / (1000 * 60 * 60 * 24);
      if (gapDays > 5) {
        result.push({
          id: `home-${i}`,
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
