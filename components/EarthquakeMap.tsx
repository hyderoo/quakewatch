"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";

const WORKER_URL = `${typeof window !== "undefined" ? window.location.origin : ""}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/maplibre-gl-worker.mjs`;
maplibregl.setWorkerUrl(WORKER_URL); // must be absolute: maplibre resolves relative URLs against an invalid placeholder base
import { QuakeEvent, ThemeMode } from "@/lib/types";
import { MAG_STOPS, DEPTH_STOPS, magColor } from "@/lib/scale";
import { Layers, Satellite, Mountain } from "lucide-react";

export const BASEMAP_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const;

function satelliteStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/{fontstack}/{range}.pbf",
    sources: {
      esri: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "Imagery (c) Esri, Maxar, Earthstar Geographics",
      },
    },
    layers: [{ id: "esri", type: "raster", source: "esri" }],
  };
}

export type BasemapKey = "dark" | "light" | "satellite";
export interface FlyToRequest { center: [number, number]; zoom: number; nonce: number }

export const QUICK_VIEWS: { key: string; label: string; center: [number, number]; zoom: number }[] = [
  { key: "world", label: "World", center: [30, 10], zoom: 1.6 },
  { key: "indonesia", label: "Indonesia", center: [118, -2.5], zoom: 4 },
  { key: "sea", label: "SE Asia", center: [110, 5], zoom: 3.4 },
  { key: "japan", label: "Japan", center: [138, 37], zoom: 3.8 },
  { key: "pacific", label: "Ring of Fire", center: [195, 15], zoom: 2 },
];

const PLATES_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/plates.json`;
const QUAKE_LAYER_IDS = ["quakes-hit", "quakes-points", "quakes-ring-new", "quakes-ring-selected", "cluster-count", "clusters"];

const pointRadius: maplibregl.ExpressionSpecification = ["min", 18, ["+", 3, ["*", 2.1, ["max", 0, ["coalesce", ["get", "mag"], 1]]]]];
const pointColor: maplibregl.ExpressionSpecification = ["step", ["coalesce", ["get", "mag"], -1], "#94a3b8", 0, MAG_STOPS[0].color, 2.5, MAG_STOPS[1].color, 4.5, MAG_STOPS[2].color, 6, MAG_STOPS[3].color, 7, MAG_STOPS[4].color];
const depthStrokeColor: maplibregl.ExpressionSpecification = ["step", ["coalesce", ["get", "depth"], -1], "rgba(148,163,184,0.6)", 0, DEPTH_STOPS[0].stroke, 70, DEPTH_STOPS[1].stroke, 300, DEPTH_STOPS[2].stroke];
const depthStrokeWidth: maplibregl.ExpressionSpecification = ["step", ["coalesce", ["get", "depth"], -1], 1, 0, DEPTH_STOPS[0].width, 70, DEPTH_STOPS[1].width, 300, DEPTH_STOPS[2].width];

interface Props {
  events: QuakeEvent[];
  theme: ThemeMode;
  selectedId: string | null;
  newIds: Set<string>;
  flyTo: FlyToRequest | null;
  onSelect: (id: string | null) => void;
  loading: boolean;
}

export default function EarthquakeMap({ events, theme, selectedId, newIds, flyTo, onSelect, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const readyRef = useRef(false);
  const [basemap, setBasemap] = useState<BasemapKey | null>(null);
  const [showPlates, setShowPlates] = useState(true);
  const [clustering, setClustering] = useState(true);
  const effectiveBasemap: BasemapKey = basemap ?? (theme === "dark" ? "dark" : "light");
  const lastBasemapRef = useRef<BasemapKey>("dark");

  const eventsRef = useRef(events);
  const selectedIdRef = useRef(selectedId);
  const newIdsRef = useRef(newIds);
  const onSelectRef = useRef(onSelect);
  const clusteringRef = useRef(clustering);
  const showPlatesRef = useRef(showPlates);
  eventsRef.current = events;
  selectedIdRef.current = selectedId;
  newIdsRef.current = newIds;
  onSelectRef.current = onSelect;
  clusteringRef.current = clustering;
  showPlatesRef.current = showPlates;

  const toGeoJSON = (evs: QuakeEvent[]): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: evs.map((e) => ({
      type: "Feature",
      properties: { id: e.id, mag: e.mag, depth: e.depthKm, place: e.place ?? "Unknown location", time: e.time },
      geometry: { type: "Point", coordinates: [e.lon, e.lat] },
    })),
  });

  // Idempotent: removes our layers/sources safely (layers first), then re-adds everything.
  const ensureLayers = (map: maplibregl.Map) => {
    for (const id of [...QUAKE_LAYER_IDS, "plates"]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource("quakes")) map.removeSource("quakes");
    if (map.getSource("plates")) map.removeSource("plates");

    map.addSource("plates", { type: "geojson", data: PLATES_URL });
    map.addLayer({
      id: "plates", type: "line", source: "plates",
      layout: { visibility: showPlatesRef.current ? "visible" : "none" },
      paint: { "line-color": "#8b98b0", "line-width": 1, "line-opacity": 0.55, "line-dasharray": [3, 2] },
    });

    const clustered = clusteringRef.current;
    map.addSource("quakes", { type: "geojson", data: toGeoJSON(eventsRef.current), cluster: clustered, clusterMaxZoom: 7, clusterRadius: 44 });
    if (clustered) {
      map.addLayer({
        id: "clusters", type: "circle", source: "quakes", filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#164e63", 20, "#155e75", 100, "#0e7490"],
          "circle-radius": ["step", ["get", "point_count"], 14, 20, 18, 100, 24],
          "circle-opacity": 0.85, "circle-stroke-color": "#22d3ee", "circle-stroke-width": 1, "circle-stroke-opacity": 0.5,
        },
      });
      map.addLayer({
        id: "cluster-count", type: "symbol", source: "quakes", filter: ["has", "point_count"],
        layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
        paint: { "text-color": "#e2e8f0" },
      });
    }
    const pointFilter: maplibregl.FilterSpecification = clustered ? ["!", ["has", "point_count"]] : ["literal", true];
    map.addLayer({
      id: "quakes-ring-selected", type: "circle", source: "quakes",
      filter: ["all", pointFilter, ["==", ["get", "id"], selectedIdRef.current ?? ""]],
      paint: { "circle-radius": ["+", pointRadius, 5], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#22d3ee", "circle-stroke-width": 2.5 },
    });
    map.addLayer({
      id: "quakes-ring-new", type: "circle", source: "quakes",
      filter: ["all", pointFilter, ["in", ["get", "id"], ["literal", [...newIdsRef.current]]]],
      paint: { "circle-radius": ["+", pointRadius, 4], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#fbbf24", "circle-stroke-width": 2, "circle-stroke-opacity": 0.9 },
    });
    // Mirrors lib/scale.ts: radius = 3 + min(15, mag*2.1); color = magnitude class; stroke = depth class.
    map.addLayer({
      id: "quakes-points", type: "circle", source: "quakes", filter: pointFilter,
      paint: { "circle-radius": pointRadius, "circle-color": pointColor, "circle-opacity": 0.82, "circle-stroke-color": depthStrokeColor, "circle-stroke-width": depthStrokeWidth },
    });
    // Larger invisible hit targets for touch devices.
    map.addLayer({
      id: "quakes-hit", type: "circle", source: "quakes", filter: pointFilter,
      paint: { "circle-radius": ["+", pointRadius, 8], "circle-opacity": 0 },
    });
  };

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES.dark,
      center: [118, -2.5],
      zoom: 3,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    mapRef.current = map;

    map.on("load", () => {
      readyRef.current = true;
      ensureLayers(map);
    });
    map.on("style.load", () => {
      if (readyRef.current) ensureLayers(map); // setStyle() drops runtime sources/layers
    });

    map.on("click", "quakes-hit", (e) => {
      const f = e.features?.[0];
      if (f?.properties?.id) onSelectRef.current(String(f.properties.id));
    });
    map.on("click", "clusters", async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const src = map.getSource("quakes") as maplibregl.GeoJSONSource;
      try {
        const zoom = await src.getClusterExpansionZoom(f.properties?.cluster_id);
        const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
        map.easeTo({ center: [lon, lat], zoom });
      } catch { /* cluster gone after refresh — ignore */ }
    });
    map.on("click", (e) => {
      const layers = ["quakes-hit", "clusters"].filter((l) => map.getLayer(l));
      if (layers.length === 0) return;
      const hits = map.queryRenderedFeatures(e.point, { layers });
      if (hits.length === 0) onSelectRef.current(null);
    });
    map.on("mousemove", "quakes-hit", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f) return;
      const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
      const mag = f.properties?.mag;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 })
        .setLngLat([lon, lat])
        .setHTML(`<strong>${mag === null || mag === undefined ? "M—" : "M" + Number(mag).toFixed(1)}</strong> · ${f.properties?.place}`)
        .addTo(map);
    });
    map.on("mouseleave", "quakes-hit", () => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    });

    return () => {
      popupRef.current?.remove();
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push data updates into the source without re-creating layers.
  useEffect(() => {
    const src = mapRef.current?.getSource("quakes") as maplibregl.GeoJSONSource | undefined;
    src?.setData(toGeoJSON(events));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Selection ring / new-event ring filters.
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("quakes-ring-selected")) return;
    const pf: maplibregl.FilterSpecification = clustering ? ["!", ["has", "point_count"]] : ["literal", true];
    map.setFilter("quakes-ring-selected", ["all", pf, ["==", ["get", "id"], selectedId ?? ""]]);
    map.setFilter("quakes-ring-new", ["all", pf, ["in", ["get", "id"], ["literal", [...newIds]]]]);
  }, [selectedId, newIds, clustering]);

  useEffect(() => {
    if (flyTo && mapRef.current) mapRef.current.flyTo({ center: flyTo.center, zoom: flyTo.zoom, duration: 900 });
  }, [flyTo]);

  // Basemap switching (style.load re-adds our layers).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lastBasemapRef.current === effectiveBasemap) return;
    lastBasemapRef.current = effectiveBasemap;
    map.setStyle(effectiveBasemap === "satellite" ? satelliteStyle() : BASEMAP_STYLES[effectiveBasemap]);
  }, [effectiveBasemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("plates")) map.setLayoutProperty("plates", "visibility", showPlates ? "visible" : "none");
  }, [showPlates]);

  // Clustering toggle = rebuild our layers.
  useEffect(() => {
    if (readyRef.current && mapRef.current) ensureLayers(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clustering]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" aria-label="Earthquake map" />
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/30">
          <div className="panel px-4 py-2 text-sm mut">Loading USGS feed…</div>
        </div>
      )}
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
        <div className="panel flex items-center gap-1 p-1" role="group" aria-label="Basemap">
          {(["dark", "light", "satellite"] as BasemapKey[]).map((k) => (
            <button key={k} onClick={() => setBasemap(k)} aria-pressed={effectiveBasemap === k}
              className={`kbd-focus flex items-center gap-1 rounded px-2 py-1 text-[11px] ${effectiveBasemap === k ? "bg-cyan-500/20 text-cyan-300" : "mut hover:text-cyan-200"}`}>
              {k === "satellite" ? <Satellite size={12} /> : <Layers size={12} />}
              {k === "dark" ? "Dark" : k === "light" ? "Light" : "Satellite"}
            </button>
          ))}
        </div>
        <div className="panel flex items-center gap-1 p-1" role="group" aria-label="Map layers">
          <button onClick={() => setShowPlates((v) => !v)} aria-pressed={showPlates}
            className={`kbd-focus flex items-center gap-1 rounded px-2 py-1 text-[11px] ${showPlates ? "bg-cyan-500/20 text-cyan-300" : "mut hover:text-cyan-200"}`}>
            <Mountain size={12} /> Plate boundaries
          </button>
          <button onClick={() => setClustering((v) => !v)} aria-pressed={clustering}
            className={`kbd-focus rounded px-2 py-1 text-[11px] ${clustering ? "bg-cyan-500/20 text-cyan-300" : "mut hover:text-cyan-200"}`}>
            Clusters
          </button>
        </div>
      </div>
      <MapLegend />
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="panel absolute bottom-8 right-2 z-10 w-44 p-2 text-[10px]" aria-label="Map legend">
      <div className="mb-1 font-semibold uppercase tracking-wide mut">Magnitude</div>
      <div className="mb-2 flex items-end gap-1.5">
        {[2, 4, 6, 7.5].map((m) => (
          <span key={m} className="grid place-items-center rounded-full" style={{ width: 8 + m * 2.4, height: 8 + m * 2.4, background: magColor(m) + "cc" }}>
            <span className="sr-only">M{m}</span>
          </span>
        ))}
      </div>
      <div className="mb-2 space-y-0.5">
        {MAG_STOPS.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="mut">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="mb-1 font-semibold uppercase tracking-wide mut">Depth (ring)</div>
      <div className="space-y-0.5">
        {DEPTH_STOPS.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-slate-300" style={{ opacity: d.width / 1.5 }} />
            <span className="mut">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 border-t pt-1 mut" style={{ borderColor: "var(--border)" }}>Dashed gray: tectonic plate boundaries (Bird 2003)</div>
    </div>
  );
}
