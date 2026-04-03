import { describe, it, expect } from "vitest";
import { insertHomebaseStops } from "./travel-map-utils";
import type { HomebaseEntry } from "./travel-map-utils";
import type { TravelStop } from "@/app/api/travel-map/route";

const HOME: HomebaseEntry = {
  address: "123 Main St, Springfield",
  city: "Springfield",
  countryCode: "US",
  lat: 40.0,
  lng: -75.0,
};

function stop(checkIn: string, numNights: number): TravelStop {
  return {
    id: `stop-${checkIn}`,
    propertyName: "Test Hotel",
    city: "Test City",
    countryCode: "FR",
    checkIn,
    numNights,
    lat: 48.0,
    lng: 2.0,
  };
}

describe("insertHomebaseStops", () => {
  it("returns a single stop unchanged", () => {
    const stops = [stop("2024-01-01", 3)];
    expect(insertHomebaseStops(stops, HOME)).toEqual(stops);
  });

  it("does not insert home stop when gap is exactly 5 days", () => {
    // checkout Jan 4, next checkin Jan 9 = gap 5 days (not > 5)
    const stops = [stop("2024-01-01", 3), stop("2024-01-09", 2)];
    const result = insertHomebaseStops(stops, HOME);
    expect(result).toHaveLength(2);
  });

  it("inserts home stop when gap is 6 days (> 5)", () => {
    // checkout Jan 4, next checkin Jan 10 = gap 6 days
    const stops = [stop("2024-01-01", 3), stop("2024-01-10", 2)];
    const result = insertHomebaseStops(stops, HOME);
    expect(result).toHaveLength(3);
    expect(result[1].isHome).toBe(true);
    expect(result[1].lat).toBe(HOME.lat);
    expect(result[1].lng).toBe(HOME.lng);
    expect(result[1].numNights).toBe(0);
    expect(result[1].checkIn).toBe("2024-01-04");
    expect(result[1].countryCode).toBe("US");
  });

  it("uses homebase city as propertyName on home stop", () => {
    const stops = [stop("2024-01-01", 3), stop("2024-01-10", 2)];
    const result = insertHomebaseStops(stops, HOME);
    expect(result[1].propertyName).toBe("Springfield");
  });

  it("falls back to 'Home' when homebase city is empty", () => {
    const noCity: HomebaseEntry = { ...HOME, city: "" };
    const stops = [stop("2024-01-01", 3), stop("2024-01-10", 2)];
    const result = insertHomebaseStops(stops, noCity);
    expect(result[1].propertyName).toBe("Home");
  });

  it("inserts multiple home stops when multiple gaps exceed 5 days", () => {
    const stops = [
      stop("2024-01-01", 3), // checkout Jan 4
      stop("2024-01-10", 2), // checkin Jan 10 → gap 6 days → home
      stop("2024-01-19", 1), // checkin Jan 19, checkout Jan 12 → gap 7 days → home
    ];
    const result = insertHomebaseStops(stops, HOME);
    expect(result).toHaveLength(5);
    expect(result[1].isHome).toBe(true);
    expect(result[3].isHome).toBe(true);
  });

  it("does not insert home stop between consecutive stays with no gap", () => {
    // checkout Jan 4, next checkin Jan 4 = gap 0 days
    const stops = [stop("2024-01-01", 3), stop("2024-01-04", 2)];
    const result = insertHomebaseStops(stops, HOME);
    expect(result).toHaveLength(2);
  });

  it("assigns a unique id to each home stop", () => {
    const stops = [stop("2024-01-01", 3), stop("2024-01-10", 2), stop("2024-01-20", 1)];
    const result = insertHomebaseStops(stops, HOME);
    const homeIds = result.filter((s) => s.isHome).map((s) => s.id);
    expect(new Set(homeIds).size).toBe(homeIds.length);
  });
});
