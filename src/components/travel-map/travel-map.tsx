"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Feature } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TravelStop } from "@/app/api/travel-map/route";

export interface TravelMapProps {
  stops: TravelStop[];
  isPlaying: boolean;
  speed: number;
  onUpdate: (stopIndex: number, tickedNights: number) => void;
  onComplete: () => void;
}

function greatCirclePoints(
  from: [number, number],
  to: [number, number],
  numPoints = 50
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(from[1]),
    lng1 = toRad(from[0]);
  const lat2 = toRad(to[1]),
    lng2 = toRad(to[0]);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat1 - lat2) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng1 - lng2) / 2) ** 2
      )
    );
  if (d === 0) return Array(numPoints + 1).fill(from) as [number, number][];
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return points;
}

function normalizeLngPath(points: [number, number][]): [number, number][] {
  if (points.length < 2) return points;
  const result: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    let lng = points[i][0];
    const prev = result[i - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (prev - lng > 180) lng += 360;
    result.push([lng, points[i][1]]);
  }
  return result;
}

function gcDistanceKm(from: [number, number], to: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(from[1]),
    lng1 = toRad(from[0]);
  const lat2 = toRad(to[1]),
    lng2 = toRad(to[0]);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat1 - lat2) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng1 - lng2) / 2) ** 2
      )
    );
  return d * 6371;
}

function zoomForDistance(km: number): number {
  if (km < 10) return 14;
  if (km < 50) return 12;
  if (km < 300) return 8;
  if (km < 2000) return 6;
  if (km < 6000) return 4;
  return 3;
}

const ARC_PAINT = {
  "line-color": "#60a5fa",
  "line-width": 4,
  "line-opacity": 0.85,
  "line-blur": 2,
};

// Fly to a stop while drawing the current leg's arc progressively.
//
// Two separate GeoJSON sources keep the cost constant per frame:
//   arcs-completed — all finished legs, uploaded once per leg (never touched during flyTo)
//   arcs-current   — only the leg being drawn right now (≤51 points), updated on each move
//
// The key insight: previously we uploaded ALL arcs on every frame, so cost grew O(n legs).
// Now only arcs-current is updated during animation — always a fixed small payload.
function flyToStopWithArc(
  map: maplibregl.Map,
  fromStop: TravelStop | null,
  toStop: TravelStop,
  zoom: number,
  durationMs: number,
  completedFeatures: Feature[],
  cancelled: () => boolean
): Promise<void> {
  return new Promise((resolve) => {
    const to: [number, number] = [toStop.lng, toStop.lat];

    if (fromStop) {
      const from: [number, number] = [fromStop.lng, fromStop.lat];
      const arcPoints = normalizeLngPath(greatCirclePoints(from, to));
      const totalDist = gcDistanceKm(from, to);

      const completedSource = map.getSource("arcs-completed") as maplibregl.GeoJSONSource;
      const currentSource = map.getSource("arcs-current") as maplibregl.GeoJSONSource;

      // Snapshot completed arcs once — won't change while this leg animates.
      completedSource.setData({ type: "FeatureCollection", features: completedFeatures });

      let lastCount = 0;
      function updateCurrentArc() {
        if (cancelled()) return;
        const center = map.getCenter();
        const t =
          totalDist > 0 ? Math.min(gcDistanceKm(from, [center.lng, center.lat]) / totalDist, 1) : 1;
        const count = Math.max(2, Math.ceil(t * arcPoints.length));
        if (count === lastCount) return;
        lastCount = count;
        currentSource.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: arcPoints.slice(0, count) },
            },
          ],
        });
      }

      map.on("move", updateCurrentArc);

      map.once("moveend", () => {
        map.off("move", updateCurrentArc);
        if (!cancelled()) {
          completedFeatures.push({
            type: "Feature" as const,
            properties: {},
            geometry: { type: "LineString" as const, coordinates: arcPoints },
          } satisfies Feature);
          completedSource.setData({ type: "FeatureCollection", features: completedFeatures });
          currentSource.setData({ type: "FeatureCollection", features: [] });
        }
        resolve();
      });
    } else {
      map.once("moveend", resolve);
    }

    map.flyTo({ center: to, zoom, duration: durationMs, curve: 1.5 });
  });
}

function animateNightCounter(
  target: number,
  durationMs: number,
  onTick: (n: number) => void,
  cancelled: () => boolean
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now: number) {
      if (cancelled()) {
        resolve();
        return;
      }
      const t = Math.min((now - start) / durationMs, 1);
      onTick(Math.round(t * target));
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function rafDelay(ms: number, cancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    function check(now: number) {
      if (cancelled()) {
        resolve();
        return;
      }
      if (now - start >= ms) resolve();
      else requestAnimationFrame(check);
    }
    requestAnimationFrame(check);
  });
}

export function TravelMap({ stops, isPlaying, speed, onUpdate, onComplete }: TravelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const cancelledRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const animationStartedRef = useRef(false);
  const completedArcFeaturesRef = useRef<Feature[]>([]);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    cancelledRef.current = false;
    animationStartedRef.current = false;

    if (!containerRef.current || stops.length === 0) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
            tileSize: 256,
            attribution:
              "© <a href='https://carto.com'>CARTO</a> © <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
          },
        },
        layers: [{ id: "carto-layer", type: "raster", source: "carto" }],
      },
      center: [stops[0].lng, stops[0].lat],
      zoom: 2,
      interactive: false,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Completed arcs — stable during each leg's animation.
      map.addSource("arcs-completed", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "arcs-completed-layer",
        type: "line",
        source: "arcs-completed",
        paint: ARC_PAINT,
      });

      // Current arc — only this source is updated during flyTo (≤51 points, constant cost).
      map.addSource("arcs-current", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "arcs-current-layer",
        type: "line",
        source: "arcs-current",
        paint: ARC_PAINT,
      });
    });

    map.on("error", (e) => console.error("MapLibre error:", e.error));

    return () => {
      cancelledRef.current = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isPlaying || animationStartedRef.current) return;
    animationStartedRef.current = true;

    async function runAnimation() {
      const map = mapRef.current;
      if (!map) return;

      if (!map.isStyleLoaded()) {
        await new Promise<void>((resolve) => map.once("load", resolve));
      }

      for (let i = 0; i < stops.length; i++) {
        if (cancelledRef.current) return;

        while (!isPlayingRef.current && !cancelledRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (cancelledRef.current) return;

        const stop = stops[i];
        const prev = i > 0 ? stops[i - 1] : null;
        const distKm = prev ? gcDistanceKm([prev.lng, prev.lat], [stop.lng, stop.lat]) : null;
        const zoom = distKm !== null ? zoomForDistance(distKm) : 6;

        await flyToStopWithArc(
          map,
          prev,
          stop,
          zoom,
          1500 / speedRef.current,
          completedArcFeaturesRef.current,
          () => cancelledRef.current
        );
        if (cancelledRef.current) return;

        const el = document.createElement("div");
        el.style.cssText =
          "width:10px;height:10px;border-radius:50%;background:#a78bfa;box-shadow:0 0 8px #a78bfa,0 0 16px #7c3aed;";
        markersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(map)
        );

        onUpdate(i, 0);
        await animateNightCounter(
          stop.numNights,
          800 / speedRef.current,
          (n) => onUpdate(i, n),
          () => cancelledRef.current
        );
        if (cancelledRef.current) return;

        await rafDelay(1000 / speedRef.current, () => cancelledRef.current);
        if (cancelledRef.current) return;
      }

      onComplete();
    }

    runAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  return <div ref={containerRef} className="w-full h-full" data-testid="travel-map-container" />;
}
