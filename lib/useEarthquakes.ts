"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertItem, AlertRule, EventFilters, FeedState, GeoFilter, QuakeEvent, TIME_RANGES, TimeRangeKey } from "./types";
import { fetchUsgsFeed, FeedError } from "./usgs";
import { playAlertSound } from "./sound";
import { fetchBmkgEvents, BmkgError } from "./bmkg";
import { fetchJmaEvents, JmaError, JMA_MIN_REFRESH_MS } from "./jma";

export const REFRESH_OPTIONS = [
  { label: "30s", ms: 30_000 },
  { label: "60s", ms: 60_000 },
  { label: "2 min", ms: 120_000 },
  { label: "5 min", ms: 300_000 },
];
export const DEFAULT_REFRESH_MS = 60_000; // USGS feeds update roughly once a minute

interface LoaderResult {
  events: QuakeEvent[];
  feed: FeedState;
  newIds: Set<string>;
  reload: () => void;
}

// Shared polling loader: tracks connectivity honestly (LIVE only after a real
// success, STALE with last-good data on failure, OFFLINE with no data at all),
// and flashes rows that are new since the previous successful fetch.
function useEventLoader(
  fetcher: (signal: AbortSignal) => Promise<QuakeEvent[]>,
  resetKey: string, // change forces state reset + refetch
  refreshMs: number,
  sourceLabel: string,
): LoaderResult {
  const [events, setEvents] = useState<QuakeEvent[]>([]);
  const [feed, setFeed] = useState<FeedState>({ status: "connecting", lastSuccess: null, lastAttempt: null, error: null, eventCount: 0 });
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const inFlight = useRef(false);
  const knownIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return; // never overlap refresh requests
    inFlight.current = true;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20_000);
    const attempted = Date.now();
    try {
      const fresh = await fetcher(ctrl.signal);
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
      const known = e instanceof FeedError || e instanceof BmkgError || e instanceof JmaError;
      const msg = isAbort ? `${sourceLabel} feed request timed out (20s)` : known ? (e as Error).message : `Unexpected error: ${(e as Error).message}`;
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
  }, [fetcher, sourceLabel]);

  // Reset when the resetKey changes (e.g. USGS time range switch), then refetch.
  useEffect(() => {
    setEvents([]);
    setFeed({ status: "connecting", lastSuccess: null, lastAttempt: null, error: null, eventCount: 0 });
    knownIds.current = new Set();
    primed.current = false;
    load();
  }, [load, resetKey]);

  useEffect(() => {
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [load, refreshMs]);

  return { events, feed, newIds, reload: load };
}

export function useEarthquakes(range: TimeRangeKey, refreshMs: number): LoaderResult {
  const url = TIME_RANGES.find((r) => r.key === range)!.feed;
  const fetcher = useCallback((signal: AbortSignal) => fetchUsgsFeed(url, signal).then((r) => r.events), [url]);
  return useEventLoader(fetcher, url, refreshMs, "USGS");
}

// BMKG publishes fixed-size bulletins (latest 15 M5.0+ and latest 15 felt events),
// not time-bounded feeds, so the time range does not change what is fetched.
export function useBmkg(refreshMs: number): LoaderResult {
  return useEventLoader(fetchBmkgEvents, "bmkg", refreshMs, "BMKG");
}

// JMA publishes a rolling ~30-day list of reports (not time-bounded feeds). The undocumented
// endpoint is cached for 60s upstream, so we never poll it faster than that, whatever the UI
// refresh setting is.
export function useJma(refreshMs: number): LoaderResult {
  return useEventLoader(fetchJmaEvents, "jma", Math.max(refreshMs, JMA_MIN_REFRESH_MS), "JMA");
}

export function applyFilters(events: QuakeEvent[], geo: GeoFilter, f: EventFilters): QuakeEvent[] {
  const q = f.search.trim().toLowerCase();
  return events.filter((e) => {
    if (geo === "indonesia" && !e.isIndonesia) return false;
    if (geo === "japan" && !e.isJapan) return false;
    if ((e.mag ?? -Infinity) < f.minMag) return false;
    if (f.maxDepthKm !== null && e.depthKm !== null && e.depthKm > f.maxDepthKm) return false;
    if (f.status !== "all" && e.status !== f.status) return false;
    if (q && !(e.place ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
}

const SOUND_KEY = "quakewatch:alert-sound";

export function useAlerts(events: QuakeEvent[]) {
  const [rules, setRules] = useState<AlertRule[]>(() => [
    { id: "r5", label: "Magnitude 5.0+", minMag: 5.0, indonesiaOnly: false, enabled: true },
    { id: "r6", label: "Magnitude 6.0+", minMag: 6.0, indonesiaOnly: false, enabled: true },
  ]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  // Sound defaults on; the stored choice is read after mount to avoid an SSR/client mismatch.
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      setSoundEnabledState(localStorage.getItem(SOUND_KEY) !== "off");
    } catch {
      // storage unavailable: keep the default
    }
  }, []);

  const setSoundEnabled = useCallback((on: boolean) => {
    setSoundEnabledState(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      // storage unavailable: the toggle still works for this session
    }
  }, []);

  useEffect(() => {
    const fresh: AlertItem[] = [];
    for (const e of events) {
      for (const r of rules) {
        if (!r.enabled || (e.mag ?? -Infinity) < r.minMag) continue;
        if (r.indonesiaOnly && !e.isIndonesia) continue;
        const key = `${r.id}:${e.id}`; // one alert per rule per event, ever
        if (fired.current.has(key)) continue;
        fired.current.add(key);
        fresh.push({ key, ruleLabel: r.label, eventId: e.id, mag: e.mag, place: e.place, time: e.time, url: e.url, source: e.source });
      }
    }
    if (fresh.length) {
      setAlerts((prev) => [...fresh, ...prev].slice(0, 50));
      if (soundEnabled) playAlertSound();
    }
  }, [events, rules, soundEnabled]);

  return useMemo(
    () => ({ rules, setRules, alerts, clearAlerts: () => setAlerts([]), soundEnabled, setSoundEnabled }),
    [rules, alerts, soundEnabled, setSoundEnabled],
  );
}
