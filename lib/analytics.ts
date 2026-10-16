import { QuakeEvent, TimeRangeKey } from "./types";

export interface TimelineBucket { label: string; start: number; count: number }
export interface HistogramBin { label: string; count: number }
export interface RegionCount { region: string; count: number; strongest: number | null }

// Bucket size adapts to the selected range: 10-minute bins for 1H,
// hourly for 24H, daily for 7D/30D, weekly on demand for 30D.
export function buildTimeline(events: QuakeEvent[], range: TimeRangeKey, weekly = false, now: number = Date.now()): TimelineBucket[] {
  const rangeMs = { "1h": 3600e3, "24h": 86400e3, "7d": 7 * 86400e3, "30d": 30 * 86400e3 }[range];
  const binMs = range === "1h" ? 600e3 : range === "24h" ? 3600e3 : weekly ? 7 * 86400e3 : 86400e3;
  const start = Math.floor((now - rangeMs) / binMs) * binMs;
  const n = Math.max(1, Math.ceil((now - start) / binMs));
  const buckets: TimelineBucket[] = Array.from({ length: n }, (_, i) => ({
    start: start + i * binMs, count: 0,
    label: binMs < 86400e3
      ? new Date(start + i * binMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
      : new Date(start + i * binMs).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  for (const e of events) {
    const idx = Math.floor((e.time - start) / binMs);
    if (idx >= 0 && idx < n) buckets[idx].count++;
  }
  return buckets;
}

export function magnitudeHistogram(events: QuakeEvent[]): HistogramBin[] {
  const bins = new Map<number, number>();
  for (const e of events) {
    if (e.mag === null) continue;
    const b = Math.floor(e.mag * 2) / 2; // 0.5-wide bins
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }
  return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([b, count]) => ({ label: `${b.toFixed(1)}-${(b + 0.5).toFixed(1)}`, count }));
}

export const DEPTH_BINS = [
  { label: "0-10", min: 0, max: 10 },
  { label: "10-30", min: 10, max: 30 },
  { label: "30-70", min: 30, max: 70 },
  { label: "70-150", min: 70, max: 150 },
  { label: "150-300", min: 150, max: 300 },
  { label: "300-700", min: 300, max: 700 },
];

export function depthHistogram(events: QuakeEvent[]): HistogramBin[] {
  const counts = DEPTH_BINS.map(() => 0);
  let unknown = 0;
  for (const e of events) {
    if (e.depthKm === null) { unknown++; continue; }
    const idx = DEPTH_BINS.findIndex((b) => e.depthKm! >= b.min && e.depthKm! < b.max);
    if (idx >= 0) counts[idx]++;
  }
  const out = DEPTH_BINS.map((b, i) => ({ label: `${b.label} km`, count: counts[i] }));
  if (unknown > 0) out.push({ label: "unknown", count: unknown });
  return out;
}

export function regionalActivity(events: QuakeEvent[], limit = 8): RegionCount[] {
  const map = new Map<string, { count: number; strongest: number | null }>();
  for (const e of events) {
    const cur = map.get(e.region) ?? { count: 0, strongest: null };
    cur.count++;
    if (e.mag !== null && (cur.strongest === null || e.mag > cur.strongest)) cur.strongest = e.mag;
    map.set(e.region, cur);
  }
  return [...map.entries()]
    .map(([region, v]) => ({ region, count: v.count, strongest: v.strongest }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function strongestEvents(events: QuakeEvent[], limit = 5): QuakeEvent[] {
  return events.filter((e) => e.mag !== null).sort((a, b) => (b.mag ?? 0) - (a.mag ?? 0)).slice(0, limit);
}

export interface Kpis {
  total: number;
  m45: number;
  m60: number;
  strongest: QuakeEvent | null;
  latest: QuakeEvent | null;
}

export function computeKpis(events: QuakeEvent[]): Kpis {
  return {
    total: events.length,
    m45: events.filter((e) => (e.mag ?? -Infinity) >= 4.5).length,
    m60: events.filter((e) => (e.mag ?? -Infinity) >= 6.0).length,
    strongest: strongestEvents(events, 1)[0] ?? null,
    latest: events[0] ?? null, // events are sorted newest-first at ingest
  };
}
