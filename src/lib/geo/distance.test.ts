import { describe, it, expect } from "vitest";
import { haversineMiles, boundingBox } from "./distance";

describe("haversineMiles", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMiles(40, -70, 40, -70)).toBeCloseTo(0, 3);
  });

  it("returns approximately 69 miles for a 1-degree latitude difference", () => {
    expect(haversineMiles(40, -70, 41, -70)).toBeCloseTo(69, 0);
  });

  it("returns approximately 3,933 miles between NYC (40.71,-74.00) and London (51.51,-0.13)", () => {
    expect(haversineMiles(40.71, -74.0, 51.51, -0.13)).toBeCloseTo(3459, -2);
  });
});

describe("boundingBox", () => {
  it("returns a box that always contains the center", () => {
    const box = boundingBox(40, -70, 10);
    expect(box.minLat).toBeLessThan(40);
    expect(box.maxLat).toBeGreaterThan(40);
    expect(box.minLng).toBeLessThan(-70);
    expect(box.maxLng).toBeGreaterThan(-70);
  });

  it("widens longitude range nearer the equator (smaller |lat|)", () => {
    const atEquator = boundingBox(0, 0, 10);
    const atPole = boundingBox(80, 0, 10);
    expect(atEquator.maxLng - atEquator.minLng).toBeLessThan(atPole.maxLng - atPole.minLng);
  });
});
