// Types for the USGS Earthquake Hazards Program GeoJSON summary feeds.
// Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

export interface UsgsProperties {
  mag: number | null;
  place: string | null;
  time: number | null; // epoch ms, origin time
  updated: number | null; // epoch ms, last revision
  tz: number | null; // deprecated by USGS; kept for completeness
  url: string | null;
  detail: string | null;
  felt: number | null; // number of felt reports
  cdi: number | null; // community intensity
  mmi: number | null; // ShakeMap instrumental intensity
  alert: "green" | "yellow" | "orange" | "red" | null; // PAGER level
  status: "automatic" | "reviewed" | "deleted" | string | null;
  tsunami: number | null; // 1 when a tsunami message was issued
  sig: number | null; // USGS significance 0-1000
  net: string | null; // contributing network id
  code: string | null;
  ids: string | null;
  sources: string | null;
  types: string | null; // e.g. ",dyfi,origin,shakemap,"
  nst: number | null;
  dmin: number | null;
  rms: number | null;
  gap: number | null;
  magType: string | null;
  type: string | null; // earthquake, quarry blast, ...
  title: string | null;
}

export interface UsgsFeature {
  type: "Feature";
  id: string;
  properties: UsgsProperties;
  geometry: { type: "Point"; coordinates: [number, number, number] } | null;
}

export interface UsgsCollection {
  type: "FeatureCollection";
  metadata?: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: UsgsFeature[];
  bbox?: number[];
}

// Normalized event used by the whole UI. Nullable source fields stay nullable.
export interface QuakeEvent {
  id: string;
  mag: number | null;
  place: string | null;
  time: number; // origin time, ms; events without one are dropped at ingest
  updated: number | null;
  lat: number;
  lon: number;
  depthKm: number | null;
  status: string | null;
  url: string | null;
  felt: number | null;
  cdi: number | null;
  mmi: number | null;
  alert: string | null;
  tsunami: number | null;
  sig: number | null;
  net: string | null;
  magType: string | null;
  type: string | null;
  hasShakemap: boolean;
  region: string; // best-effort parsed from place
  isIndonesia: boolean;
  source: EventSource; // which agency published this event
  // BMKG-only fields (null for USGS events):
  tsunamiPotential: string | null; // BMKG "Potensi" text, e.g. tsunami potential statement
  feltArea: string | null; // BMKG "Dirasakan" felt-area report
  bmkgShakemapUrl: string | null; // BMKG shakemap image, when published
  bmkgLists: BmkgListKind[]; // which BMKG lists contain this event (empty for USGS)
}

export type EventSource = "usgs" | "bmkg";
export type BmkgListKind = "terkini" | "dirasakan";
export type IndonesiaSource = EventSource;

export type TimeRangeKey = "1h" | "24h" | "7d" | "30d";
export type GeoFilter = "world" | "indonesia";
export type ThemeMode = "dark" | "light";

export interface FeedState {
  status: "connecting" | "live" | "stale" | "offline";
  lastSuccess: number | null; // ms epoch of last successful fetch
  lastAttempt: number | null;
  error: string | null;
  eventCount: number;
}

export interface EventFilters {
  minMag: number;
  maxDepthKm: number | null; // null = no cap
  status: "all" | "reviewed" | "automatic";
  search: string;
}

export interface AlertRule {
  id: string;
  label: string;
  minMag: number;
  indonesiaOnly: boolean;
  enabled: boolean;
}

export interface AlertItem {
  key: string; // ruleId:eventId — dedupe key
  ruleLabel: string;
  eventId: string;
  mag: number | null;
  place: string | null;
  time: number;
  url: string | null;
}

export const TIME_RANGES: { key: TimeRangeKey; label: string; feed: string; ms: number }[] = [
  { key: "1h", label: "1H", feed: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson", ms: 3600e3 },
  { key: "24h", label: "24H", feed: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson", ms: 86400e3 },
  { key: "7d", label: "7D", feed: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson", ms: 7 * 86400e3 },
  { key: "30d", label: "30D", feed: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson", ms: 30 * 86400e3 },
];

// Indonesia bounding box used by the geographic filter (approximate archipelago extent).
export const INDONESIA_BBOX = { minLon: 94.5, maxLon: 141.5, minLat: -11.5, maxLat: 6.5 };
