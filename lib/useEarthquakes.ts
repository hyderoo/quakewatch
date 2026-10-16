"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertItem, AlertRule, EventFilters, FeedState, GeoFilter, QuakeEvent, TIME_RANGES, TimeRangeKey } from "./types";
import { fetchUsgsFeed, FeedError } from "./usgs";

export const REFRESH_OPTIONS = [
  { label: "30s", ms: 30_000 },
  { label: "60s", ms: 60_000 },
  { label: "2 min", ms: 120_000 },
  { label: "5 min", ms: 300_000 },
];
export const DEFAULT_REFRESH_MS = 60_000; // USGS feeds update roughly once a minute

export function useEarthquakes(range: TimeRangeKey, refreshMs: number) {
  const [events, setEvents] = useState<QuakeEvent[]>([]);
  const [feed, setFeed] = useState<FeedState>({ status: "connecting", lastSuccess: null, lastAttempt: null, error: null, eventCount: 0 });
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const inFlight = useRef(false);
  const knownIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const url = TIME_RANGES.find((r) => r.key === range)!.feed;

  const load = useCallback(async () => {
    if (inFlight.current) return; // never overlap refresh requests
    inFlight.current = true;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20_000);
    const attempted = Date.now();
    try {
      const { events: fresh } = await fetchUsgsFeed(url, ctrl.signal);
      const added = new Set<string>();
      if (primed.current) {
        for (const e of fresh) if (!knownIds.current.has(e.id)) added.add(e.id);
      } else {
        primed.current = true; // first load: everything is "known", nothing flashes
      }
      knownIds.current = new Set(fresh.map((e) => e.id));
      setEvents(fresh);
      setFeed({ status: "live", lastSuccess: Date.now(), lastAttempt: attempted, error: null, eventCount: fresh.length });
      if (added.size > 0) {
        setNewIds(added);
        setTimeout(() => setNewIds(new Set()), 4000);
      }
    } catch (e) {
      const isAbort = (e as Error).name === "AbortError"; // our 20s timeout
      const msg = isAbort ? "USGS feed request timed out (20s)" : e instanceof FeedError ? e.message : `Unexpected error: ${(e as Error).message}`;
      setFeed((prev) => ({
        status: prev.lastSuccess ? "stale" : "offline",
        lastSuccess: prev.lastSuccess,
        lastAttempt: attempted,
        error: msg,
        eventCount: prev.eventCount,
      }));
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
    }
  }, [url]);

  // Reset when the feed URL changes (time range switch), then refetch.
  useEffect(() => {
    setEvents([]);
    setFeed({ status: "connecting", lastSuccess: null, lastAttempt: null, error: null, eventCount: 0 });
    knownIds.current = new Set();
    primed.current = false;
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [load, refreshMs]);

  return { events, feed, newIds, reload: load };
}

export function applyFilters(events: QuakeEvent[], geo: GeoFilter, f: EventFilters): QuakeEvent[] {
  const q = f.search.trim().toLowerCase();
  return events.filter((e) => {
    if (geo === "indonesia" && !e.isIndonesia) return false;
    if ((e.mag ?? -Infinity) < f.minMag) return false;
    if (f.maxDepthKm !== null && e.depthKm !== null && e.depthKm > f.maxDepthKm) return false;
    if (f.status !== "all" && e.status !== f.status) return false;
    if (q && !(e.place ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
}

export function useAlerts(events: QuakeEvent[]) {
  const [rules, setRules] = useState<AlertRule[]>(() => [
    { id: "r5", label: "Magnitude 5.0+", minMag: 5.0, indonesiaOnly: false, enabled: true },
    { id: "r6", label: "Magnitude 6.0+", minMag: 6.0, indonesiaOnly: false, enabled: true },
  ]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh: AlertItem[] = [];
    for (const e of events) {
      for (const r of rules) {
        if (!r.enabled || (e.mag ?? -Infinity) < r.minMag) continue;
        if (r.indonesiaOnly && !e.isIndonesia) continue;
        const key = `${r.id}:${e.id}`; // one alert per rule per event, ever
        if (fired.current.has(key)) continue;
        fired.current.add(key);
        fresh.push({ key, ruleLabel: r.label, eventId: e.id, mag: e.mag, place: e.place, time: e.time, url: e.url });
      }
    }
    if (fresh.length) setAlerts((prev) => [...fresh, ...prev].slice(0, 50));
  }, [events, rules]);

  return useMemo(() => ({ rules, setRules, alerts, clearAlerts: () => setAlerts([]) }), [rules, alerts]);
}
