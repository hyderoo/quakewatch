// JMA (Japan Meteorological Agency) earthquake report list.
// Endpoint: https://www.jma.go.jp/bosai/quake/data/list.json
//
// IMPORTANT: this is the JSON file that JMA's own "bosai" website reads. It is NOT a
// documented or supported public API, so JMA can change or remove it without notice.
// Verified 2026-10-16: HTTP 200, CORS "access-control-allow-origin: *", cache-control
// max-age=60, ~225 entries covering the latest ~30 days.
//
// Reuse terms: JMA Public Data License v1.0 (https://www.jma.go.jp/jma/en/copyright.html):
// credit "Source: Japan Meteorological Agency website" and state that the data was edited or
// processed. Never present QuakeWatch output as made by the government.
//
// Entry shape (strings unless noted):
//   eid  event id          at   origin time, ISO with +09:00     ttl / en_ttl  report type
//   anm / en_anm  region    cod  "+lat+lon-depth_m/" (depth negative metres; may be absent)
//   mag  JMA magnitude (Mj) maxi max shindo intensity            rdt  report issue time
//   ctt  report creation time "YYYYMMDDhhmmss"
// The list mixes report types and the same event can appear in several reports.

import { QuakeEvent } from "./types";
import { inIndonesia, inJapan } from "./usgs";

export const JMA_LIST_URL = "https://www.jma.go.jp/bosai/quake/data/list.json";
export const JMA_SITE_URL = "https://www.jma.go.jp/";
export const JMA_COPYRIGHT_URL = "https://www.jma.go.jp/jma/en/copyright.html";
export const JMA_EVENT_PAGE = "https://www.jma.go.jp/bosai/map.html#contents=earthquake_map";
export const JMA_MIN_REFRESH_MS = 60_000; // upstream cache is 60s; polling faster gains nothing

interface JmaRawItem {
  eid?: unknown;
  at?: unknown;
  rdt?: unknown;
  ctt?: unknown;
  ttl?: unknown;
  en_ttl?: unknown;
  anm?: unknown;
  en_anm?: unknown;
  cod?: unknown;
  mag?: unknown;
  maxi?: unknown;
}

export class JmaError extends Error {
  constructor(message: string, public readonly kind: "http" | "network" | "parse") {
    super(message);
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// "+32.3+130.4-10000/" -> lat 32.3, lon 130.4, depth 10 km. Far-field reports omit depth ("+07.5-080.8/").
export function parseJmaCod(cod: string): { lat: number; lon: number; depthKm: number | null } | null {
  const m = cod.match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)(?:([+-]\d+(?:\.\d+)?))?\/?$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  let depthKm: number | null = null;
  if (m[3] !== undefined) {
    const d = -parseFloat(m[3]) / 1000;
    if (Number.isFinite(d) && d >= 0 && d < 1000) depthKm = d;
  }
  return { lat, lon, depthKm };
}

const SHINDO_ORDER = ["1", "2", "3", "4", "5-", "5+", "6-", "6+", "7"];
const shindoRank = (s: string | null) => (s ? SHINDO_ORDER.indexOf(s) : -1);

// Normalizes the raw list. Reports without hypocenter coordinates or a numeric magnitude
// (e.g. "seismic intensity flash" reports) cannot be placed on a map and are dropped.
// Several reports can describe one event (same eid): the newest usable report wins, and
// the highest published max intensity across all reports of that eid is kept.
export function normalizeJmaList(raw: unknown[]): QuakeEvent[] {
  const byEid = new Map<string, { ctt: string; event: QuakeEvent }>();
  const maxiByEid = new Map<string, string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const it = r as JmaRawItem;
    const eid = str(it.eid);
    const maxi = str(it.maxi);
    if (eid && shindoRank(maxi) > shindoRank(maxiByEid.get(eid) ?? null)) maxiByEid.set(eid, maxi);
    const at = str(it.at);
    const time = Date.parse(at);
    if (!eid || !Number.isFinite(time)) continue;
    const pos = parseJmaCod(str(it.cod));
    if (!pos) continue; // no hypocenter in this report
    const magS = str(it.mag);
    if (!/^-?\d+(\.\d+)?$/.test(magS)) continue; // empty or "M unknown"
    const mag = parseFloat(magS);
    const ctt = str(it.ctt);
    const prev = byEid.get(eid);
    if (prev && prev.ctt > ctt) continue;
    const rdt = Date.parse(str(it.rdt));
    const region = (str(it.en_anm) || str(it.anm) || "Unknown location").replace(/\s+/g, " ").replace(/\s+,/g, ",");
    byEid.set(eid, {
      ctt,
      event: {
        id: `jma-${eid}`,
        mag,
        place: region,
        time,
        updated: null,
        lat: pos.lat,
        lon: pos.lon,
        depthKm: pos.depthKm,
        status: null,
        url: JMA_EVENT_PAGE,
        felt: null,
        cdi: null,
        mmi: null,
        alert: null,
        tsunami: null,
        sig: null,
        net: "JMA",
        magType: "Mj",
        type: "earthquake",
        hasShakemap: false,
        region,
        isIndonesia: inIndonesia(pos.lon, pos.lat),
        isJapan: inJapan(pos.lon, pos.lat),
        source: "jma",
        tsunamiPotential: null,
        feltArea: null,
        bmkgShakemapUrl: null,
        bmkgLists: [],
        maxIntensity: null,
        jmaReportType: str(it.en_ttl) || null,
        jmaReportedAt: Number.isFinite(rdt) ? rdt : null,
      },
    });
  }
  const events: QuakeEvent[] = [];
  for (const [eid, { event }] of byEid) {
    event.maxIntensity = maxiByEid.get(eid) || null;
    events.push(event);
  }
  events.sort((a, b) => b.time - a.time);
  return events;
}

export async function fetchJmaEvents(signal?: AbortSignal): Promise<QuakeEvent[]> {
  let res: Response;
  try {
    res = await fetch(JMA_LIST_URL, { signal, cache: "no-store" });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new JmaError(`Network error contacting JMA: ${(e as Error).message}`, "network");
  }
  if (!res.ok) throw new JmaError(`JMA endpoint returned HTTP ${res.status}`, "http");
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new JmaError("JMA endpoint returned malformed JSON", "parse");
  }
  // Schema guard: the endpoint is undocumented, so refuse anything that does not look like the
  // known report list instead of showing misleading data. A changed shape -> STALE/OFFLINE.
  if (!Array.isArray(json)) throw new JmaError("JMA list had an unexpected shape (not an array); the undocumented format may have changed", "parse");
  if (json.length > 0) {
    const recognised = json.filter((x) => x && typeof x === "object" && typeof (x as JmaRawItem).eid === "string" && typeof (x as JmaRawItem).at === "string").length;
    if (recognised / json.length < 0.8) throw new JmaError("JMA list entries lack the expected fields (eid/at); the undocumented format may have changed", "parse");
  }
  return normalizeJmaList(json);
}
