import { QuakeEvent, UsgsCollection, UsgsFeature, INDONESIA_BBOX } from "./types";

export function inIndonesia(lon: number, lat: number): boolean {
  return lon >= INDONESIA_BBOX.minLon && lon <= INDONESIA_BBOX.maxLon && lat >= INDONESIA_BBOX.minLat && lat <= INDONESIA_BBOX.maxLat;
}

// "12 km SSE of Palu, Indonesia" -> "Indonesia"; "Southern Sumatra, Indonesia" -> same.
// Falls back to the full place string when no region can be parsed.
export function parseRegion(place: string | null): string {
  if (!place) return "Unknown region";
  const parts = place.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  const ofMatch = place.match(/\bof\s+(.+)$/i);
  if (ofMatch) return ofMatch[1].trim();
  return parts[0] ?? "Unknown region";
}

export function normalizeFeature(f: UsgsFeature): QuakeEvent | null {
  const p = f.properties;
  const coords = f.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  if (typeof p.time !== "number") return null; // no origin time -> cannot place chronologically
  const [lon, lat, depth] = coords;
  if (typeof lon !== "number" || typeof lat !== "number") return null;
  return {
    id: f.id,
    mag: typeof p.mag === "number" ? p.mag : null,
    place: p.place ?? "Unknown location",
    time: p.time,
    updated: typeof p.updated === "number" ? p.updated : null,
    lat,
    lon,
    depthKm: typeof depth === "number" ? depth : null,
    status: p.status ?? null,
    url: p.url ?? null,
    felt: p.felt ?? null,
    cdi: p.cdi ?? null,
    mmi: p.mmi ?? null,
    alert: p.alert ?? null,
    tsunami: p.tsunami ?? null,
    sig: p.sig ?? null,
    net: p.net ?? null,
    magType: p.magType ?? null,
    type: p.type ?? null,
    hasShakemap: (p.types ?? "").includes("shakemap"),
    region: parseRegion(p.place),
    isIndonesia: inIndonesia(lon, lat),
    source: "usgs",
    tsunamiPotential: null,
    feltArea: null,
    bmkgShakemapUrl: null,
    bmkgLists: [],
  };
}

export class FeedError extends Error {
  constructor(message: string, public readonly kind: "http" | "network" | "parse") {
    super(message);
  }
}

export async function fetchUsgsFeed(url: string, signal?: AbortSignal): Promise<{ events: QuakeEvent[]; raw: number }> {
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: "no-store" });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new FeedError(`Network error contacting USGS: ${(e as Error).message}`, "network");
  }
  if (!res.ok) throw new FeedError(`USGS feed returned HTTP ${res.status}`, "http");
  let json: UsgsCollection;
  try {
    json = (await res.json()) as UsgsCollection;
  } catch {
    throw new FeedError("USGS feed returned malformed JSON", "parse");
  }
  if (!json || !Array.isArray(json.features)) throw new FeedError("USGS feed had an unexpected shape", "parse");
  const seen = new Set<string>();
  const events: QuakeEvent[] = [];
  for (const f of json.features) {
    const ev = normalizeFeature(f);
    if (!ev || seen.has(ev.id)) continue; // dedupe on the USGS event id
    seen.add(ev.id);
    events.push(ev);
  }
  events.sort((a, b) => b.time - a.time); // newest first, by origin time
  return { events, raw: json.features.length };
}
