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

// Compute great-circle interpolation points between two [lng, lat] coordinates.
// Returns numPoints+1 points forming a geodesic arc.
function greatCirclePoints(
  from: [number, number],
  to: [number, number],
  numPoints = 50
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(from[1]);
  const lng1 = toRad(from[0]);
  const lat2 = toRad(to[1]);
  const lng2 = toRad(to[0]);

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

function flyToStop(map: maplibregl.Map, stop: TravelStop, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    map.once("moveend", resolve);
    map.flyTo({
      center: [stop.lng, stop.lat],
      zoom: 6,
      duration: durationMs,
      curve: 1.5,
    });
  });
}

// completedFeatures contains arcs already fully drawn; the new arc is appended live.
function animateArc(
  map: maplibregl.Map,
  points: [number, number][],
  completedFeatures: Feature[],
  durationMs: number,
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
      const count = Math.max(2, Math.ceil(t * points.length));
      const source = map.getSource("arcs") as maplibregl.GeoJSONSource;
      source.setData({
        type: "FeatureCollection",
        features: [
          ...completedFeatures,
          {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: points.slice(0, count) },
          },
        ],
      });
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        completedFeatures.push({
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: points },
        } satisfies Feature);
        resolve();
      }
    }
    requestAnimationFrame(frame);
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
    // Reset cancellation flag on each mount — required because React Strict Mode
    // unmounts and remounts components in dev, which would leave cancelledRef=true.
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
    });

    mapRef.current = map;

    map.on("load", () => {
      map.addSource("arcs", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "arcs-layer",
        type: "line",
        source: "arcs",
        paint: {
          "line-color": "#60a5fa",
          "line-width": 2,
          "line-opacity": 0.85,
          "line-blur": 2,
        },
      });
    });

    map.on("error", (e) => {
      console.error("MapLibre error:", e.error);
    });

    return () => {
      cancelledRef.current = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // stops identity is stable per modal open — intentional single-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isPlaying || animationStartedRef.current) return;
    animationStartedRef.current = true;

    async function runAnimation() {
      const map = mapRef.current;
      if (!map) {
        console.warn("[TravelMap] runAnimation: map not initialized");
        return;
      }

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

        await flyToStop(map, stop, 1500 / speedRef.current);
        if (cancelledRef.current) return;

        const el = document.createElement("div");
        el.style.cssText =
          "width:10px;height:10px;border-radius:50%;background:#a78bfa;box-shadow:0 0 8px #a78bfa,0 0 16px #7c3aed;";
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map);
        markersRef.current.push(marker);

        if (i > 0) {
          const prev = stops[i - 1];
          const arcPoints = greatCirclePoints([prev.lng, prev.lat], [stop.lng, stop.lat]);
          await animateArc(
            map,
            arcPoints,
            completedArcFeaturesRef.current,
            600 / speedRef.current,
            () => cancelledRef.current
          );
          if (cancelledRef.current) return;
        }

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
