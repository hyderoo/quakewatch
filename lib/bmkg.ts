// BMKG open earthquake data (Badan Meteorologi, Klimatologi, dan Geofisika, Indonesia).
// Docs: https://data.bmkg.go.id/gempabumi/
// Endpoints are CORS-enabled (Access-Control-Allow-Origin: *), rate limit 60 req/min/IP,
// and carry a mandatory BMKG attribution requirement.
//
// Honesty notes:
// - gempaterkini.json lists only the latest 15 events of M5.0+.
// - gempadirasakan.json lists only the latest 15 felt events.
// - autogempa.json is the single latest automatic event (adds a shakemap image).
// These are bulletins, not a complete catalog.

import { BmkgListKind, QuakeEvent } from "./types";
import { inIndonesia, inJapan } from "./usgs";

export const BMKG_ENDPOINTS = {
  autogempa: "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
  terkini: "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json",
  dirasakan: "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json",
} as const;

export const BMKG_TERKINI_PAGE = "https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg";
export const BMKG_DIRASAKAN_PAGE = "https://www.bmkg.go.id/gempabumi/gempabumi-dirasakan.bmkg";
const SHAKEMAP_BASE = "https://data.bmkg.go.id/DataMKG/TEWS/";

interface BmkgRawItem {
  Tanggal?: string;
  Jam?: string;
  DateTime?: string;
  Coordinates?: string; // "lat,lon"
  Lintang?: string;
  Bujur?: string;
  Magnitude?: string;
  Kedalaman?: string; // "76 km"
  Wilayah?: string;
  Potensi?: string;
  Dirasakan?: string;
  Shakemap?: string; // filename hosted under SHAKEMAP_BASE
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function mergeKey(item: BmkgRawItem): string | null {
  if (!item.DateTime || !item.Coordinates) return null;
  return `${item.DateTime}|${item.Coordinates}`;
}

function normalizeItem(item: BmkgRawItem, list: BmkgListKind): { key: string; event: QuakeEvent } | null {
  const key = mergeKey(item);
  if (!key) return null;
  const time = Date.parse(item.DateTime!);
  if (!Number.isFinite(time)) return null;
  const [latS, lonS] = item.Coordinates!.split(",");
  const lat = parseFloat(latS), lon = parseFloat(lonS);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const mag = parseNum(item.Magnitude);
  const depthKm = parseNum(item.Kedalaman);
  const shakemapUrl = item.Shakemap ? SHAKEMAP_BASE + item.Shakemap : null;
  const event: QuakeEvent = {
    id: `bmkg-${time}-${lat.toFixed(2)},${lon.toFixed(2)}`,
    mag,
    place: item.Wilayah ?? "Unknown location",
    time,
    updated: null, // BMKG bulletins do not expose a revision timestamp
    lat,
    lon,
    depthKm,
    status: null, // BMKG does not publish a USGS-style review status
    url: list === "terkini" ? BMKG_TERKINI_PAGE : BMKG_DIRASAKAN_PAGE,
    felt: null,
    cdi: null,
    mmi: null,
    alert: null,
    tsunami: null, // tsunami info is the free-text tsunamiPotential, not a flag
    sig: null,
    net: "BMKG",
    magType: null,
    type: "earthquake",
    hasShakemap: shakemapUrl !== null,
    region: item.Wilayah ?? "Unknown region",
    isIndonesia: inIndonesia(lon, lat),
    isJapan: inJapan(lon, lat),
    source: "bmkg",
    tsunamiPotential: item.Potensi ?? null,
    feltArea: item.Dirasakan ?? null,
    bmkgShakemapUrl: shakemapUrl,
    bmkgLists: [list],
    maxIntensity: null,
    jmaReportType: null,
    jmaReportedAt: null,
  };
  return { key, event };
}

export class BmkgError extends Error {
  constructor(message: string, public readonly kind: "http" | "network" | "parse") {
    super(message);
  }
}

async function fetchList(url: string, signal?: AbortSignal): Promise<BmkgRawItem[]> {
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: "no-store" });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new BmkgError(`Network error contacting BMKG: ${(e as Error).message}`, "network");
  }
  if (!res.ok) throw new BmkgError(`BMKG endpoint returned HTTP ${res.status} (${url.split("/").pop()})`, "http");
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new BmkgError("BMKG endpoint returned malformed JSON", "parse");
  }
  const gempa = (json as { Infogempa?: { gempa?: BmkgRawItem | BmkgRawItem[] } })?.Infogempa?.gempa;
  if (!gempa) return [];
  return Array.isArray(gempa) ? gempa : [gempa]; // autogempa is a single object, the lists are arrays
}

// Fetches all three BMKG endpoints and merges them by origin time + coordinates.
// The merged set is the union of both lists; the latest automatic event only
// contributes its shakemap image / felt report when it matches a listed event.
export async function fetchBmkgEvents(signal?: AbortSignal): Promise<QuakeEvent[]> {
  const [terkini, dirasakan, autogempa] = await Promise.all([
    fetchList(BMKG_ENDPOINTS.terkini, signal),
    fetchList(BMKG_ENDPOINTS.dirasakan, signal),
    fetchList(BMKG_ENDPOINTS.autogempa, signal),
  ]);
  const byKey = new Map<string, QuakeEvent>();
  for (const item of terkini) {
    const n = normalizeItem(item, "terkini");
    if (n) byKey.set(n.key, n.event);
  }
  for (const item of dirasakan) {
    const n = normalizeItem(item, "dirasakan");
    if (!n) continue;
    const existing = byKey.get(n.key);
    if (existing) {
      if (!existing.bmkgLists.includes("dirasakan")) existing.bmkgLists.push("dirasakan");
      existing.feltArea = existing.feltArea ?? n.event.feltArea;
    } else {
      byKey.set(n.key, n.event);
    }
  }
  for (const item of autogempa) {
    const key = mergeKey(item);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      if (item.Shakemap && !existing.bmkgShakemapUrl) {
        existing.bmkgShakemapUrl = SHAKEMAP_BASE + item.Shakemap;
        existing.hasShakemap = true;
      }
      existing.feltArea = existing.feltArea ?? item.Dirasakan ?? null;
      existing.tsunamiPotential = existing.tsunamiPotential ?? item.Potensi ?? null;
    }
    // autogempa duplicates a listed event in practice; if it does not, leaving it
    // out is deliberate: the dashboard displays the two published lists, and the
    // header status only claims what was fetched.
  }
  const events = [...byKey.values()];
  events.sort((a, b) => b.time - a.time); // newest first, matching the USGS ingest
  return events;
}
