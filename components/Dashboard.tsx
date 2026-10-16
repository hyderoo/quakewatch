"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EventFilters, GeoFilter, IndonesiaSource, JapanSource, ThemeMode, TIME_RANGES, TimeRangeKey } from "@/lib/types";
import { useAlerts, useEarthquakes, useBmkg, useJma, applyFilters, DEFAULT_REFRESH_MS } from "@/lib/useEarthquakes";
import { computeKpis } from "@/lib/analytics";
import { haversineKm, fmtClock } from "@/lib/format";
import Header from "./Header";
import KpiBar from "./KpiBar";
import EarthquakeMap, { FlyToRequest, QUICK_VIEWS } from "./EarthquakeMap";
import EventFeed from "./EventFeed";
import DetailsPanel from "./DetailsPanel";
import Charts from "./Charts";
import AlertCenter from "./AlertCenter";
import IndonesiaPanel from "./IndonesiaPanel";
import JapanPanel from "./JapanPanel";
import Footer from "./Footer";

function parseCoords(s: string): [number, number] | null {
  const m = s.trim().match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lat, lon];
}

const SOURCE_LABEL = { usgs: "USGS Earthquake Hazards Program", bmkg: "BMKG open data", jma: "JMA (Japan Meteorological Agency)" } as const;

export default function Dashboard() {
  const [range, setRange] = useState<TimeRangeKey>("24h");
  const [geo, setGeo] = useState<GeoFilter>("world");
  // Indonesia view defaults to BMKG (the official Indonesian agency); USGS stays one click away.
  const [indonesiaSource, setIndonesiaSource] = useState<IndonesiaSource>("bmkg");
  // Japan view defaults to JMA (the national agency); USGS stays one click away.
  const [japanSource, setJapanSource] = useState<JapanSource>("jma");
  const [filters, setFilters] = useState<EventFilters>({ minMag: 0, maxDepthKm: null, status: "all", search: "" });
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToRequest | null>(null);

  const usgs = useEarthquakes(range, refreshMs);
  const bmkg = useBmkg(refreshMs);
  const jma = useJma(refreshMs);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const bmkgActive = geo === "indonesia" && indonesiaSource === "bmkg";
  const jmaActive = geo === "japan" && japanSource === "jma";
  const activeSrc: "usgs" | "bmkg" | "jma" = bmkgActive ? "bmkg" : jmaActive ? "jma" : "usgs";
  const rangeMs = TIME_RANGES.find((r) => r.key === range)!.ms;

  // BMKG and JMA lists are not time-bounded feeds, so we apply the selected range ourselves.
  const bmkgRanged = useMemo(() => {
    const cutoff = Date.now() - rangeMs;
    return bmkg.events.filter((e) => e.time >= cutoff);
  }, [bmkg.events, rangeMs]);
  const jmaRanged = useMemo(() => {
    const cutoff = Date.now() - rangeMs;
    return jma.events.filter((e) => e.time >= cutoff);
  }, [jma.events, rangeMs]);

  const loaders = { usgs, bmkg, jma } as const;
  const activeEvents = bmkgActive ? bmkgRanged : jmaActive ? jmaRanged : usgs.events;
  const activeFeed = loaders[activeSrc].feed;
  const activeNewIds = loaders[activeSrc].newIds;
  const otherFeed = geo === "indonesia"
    ? (bmkgActive ? { label: "USGS", feed: usgs.feed } : { label: "BMKG", feed: bmkg.feed })
    : geo === "japan"
      ? (jmaActive ? { label: "USGS", feed: usgs.feed } : { label: "JMA", feed: jma.feed })
      : null;

  const { rules, setRules, alerts, clearAlerts } = useAlerts(activeEvents);

  const coordQuery = parseCoords(filters.search);
  const filtered = useMemo(() => {
    const f = coordQuery ? { ...filters, search: "" } : filters; // coordinate search pans the map instead of filtering rows
    return applyFilters(activeEvents, geo, f);
  }, [activeEvents, geo, filters, coordQuery]);

  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const indonesiaEvents = useMemo(() => activeEvents.filter((e) => e.isIndonesia), [activeEvents]);
  const japanEvents = useMemo(() => activeEvents.filter((e) => e.isJapan), [activeEvents]);
  const selected = useMemo(() => activeEvents.find((e) => e.id === selectedId) ?? null, [activeEvents, selectedId]);

  const flyToEvent = (id: string) => {
    const e = activeEvents.find((x) => x.id === id);
    if (!e) return;
    setFlyTo({ center: [e.lon, e.lat], zoom: 6, nonce: Date.now() });
  };
  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    if (id) flyToEvent(id);
  };

  // Switching source invalidates the USGS-only review-status filter and any selection.
  const switchIndonesiaSource = (src: IndonesiaSource) => {
    setIndonesiaSource(src);
    setSelectedId(null);
    if (src === "bmkg" && filters.status !== "all") setFilters({ ...filters, status: "all" });
  };
  const switchJapanSource = (src: JapanSource) => {
    setJapanSource(src);
    setSelectedId(null);
    if (src === "jma" && filters.status !== "all") setFilters({ ...filters, status: "all" });
  };

  // Coordinate search: fly to the point and select the nearest event within 1000 km.
  const lastCoord = useRef<string>("");
  useEffect(() => {
    if (!coordQuery || activeEvents.length === 0) return;
    const key = coordQuery.join(",");
    if (key === lastCoord.current) return;
    lastCoord.current = key;
    const [lat, lon] = coordQuery;
    let best: { id: string; d: number; lon: number; lat: number } | null = null;
    for (const e of activeEvents) {
      const d = haversineKm(lat, lon, e.lat, e.lon);
      if (!best || d < best.d) best = { id: e.id, d, lon: e.lon, lat: e.lat };
    }
    if (best) {
      setFlyTo({ center: [best.lon, best.lat], zoom: 6, nonce: Date.now() });
      if (best.d <= 1000) setSelectedId(best.id);
    }
  }, [coordQuery, activeEvents]);

  const loading = activeFeed.status === "connecting";
  const reloadAll = () => { usgs.reload(); bmkg.reload(); jma.reload(); };

  return (
    <div className="flex min-h-screen flex-col gap-2">
      <Header feed={activeFeed} sourceLabel={SOURCE_LABEL[activeSrc]} otherFeed={otherFeed}
        range={range} setRange={setRange} geo={geo} setGeo={setGeo}
        search={filters.search} setSearch={(s) => setFilters({ ...filters, search: s })}
        theme={theme} toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        refreshMs={refreshMs} setRefreshMs={setRefreshMs} onRefreshNow={reloadAll} />

      <main className="mx-2 flex flex-1 flex-col gap-2">
        {geo === "indonesia" && (
          <div className="panel flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2" aria-label="Indonesia data source">
            <span className="text-[11px] font-semibold uppercase tracking-widest mut">Indonesia source</span>
            <div className="flex items-center gap-1" role="group" aria-label="Indonesia data source toggle">
              {(["bmkg", "usgs"] as IndonesiaSource[]).map((src) => (
                <button key={src} onClick={() => switchIndonesiaSource(src)} aria-pressed={indonesiaSource === src}
                  className={`kbd-focus rounded px-2 py-1 text-[11px] ${indonesiaSource === src ? "bg-cyan-500/20 text-cyan-300" : "mut hover:text-cyan-200"}`}>
                  {src === "bmkg" ? "BMKG (official)" : "USGS"}
                </button>
              ))}
            </div>
            <span className={`flex items-center gap-1.5 text-[11px] ${bmkg.feed.status === "live" ? "text-emerald-400" : bmkg.feed.status === "connecting" ? "text-slate-400" : bmkg.feed.status === "stale" ? "text-amber-400" : "text-red-400"}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${bmkg.feed.status === "live" ? "bg-emerald-400" : bmkg.feed.status === "connecting" ? "bg-slate-400" : bmkg.feed.status === "stale" ? "bg-amber-400" : "bg-red-500"}`} />
              BMKG {bmkg.feed.status.toUpperCase()}
              {bmkg.feed.lastSuccess && <span className="mut">· {fmtClock(bmkg.feed.lastSuccess)}</span>}
            </span>
            <span className="text-[11px] mut">
              BMKG lists cover only the latest 15 M5.0+ and 15 felt events — not a complete catalog.
            </span>
          </div>
        )}
        {geo === "japan" && (
          <div className="panel flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2" aria-label="Japan data source">
            <span className="text-[11px] font-semibold uppercase tracking-widest mut">Japan source</span>
            <div className="flex items-center gap-1" role="group" aria-label="Japan data source toggle">
              {(["jma", "usgs"] as JapanSource[]).map((src) => (
                <button key={src} onClick={() => switchJapanSource(src)} aria-pressed={japanSource === src}
                  className={`kbd-focus rounded px-2 py-1 text-[11px] ${japanSource === src ? "bg-cyan-500/20 text-cyan-300" : "mut hover:text-cyan-200"}`}>
                  {src === "jma" ? "JMA (official)" : "USGS"}
                </button>
              ))}
            </div>
            <span className={`flex items-center gap-1.5 text-[11px] ${jma.feed.status === "live" ? "text-emerald-400" : jma.feed.status === "connecting" ? "text-slate-400" : jma.feed.status === "stale" ? "text-amber-400" : "text-red-400"}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${jma.feed.status === "live" ? "bg-emerald-400" : jma.feed.status === "connecting" ? "bg-slate-400" : jma.feed.status === "stale" ? "bg-amber-400" : "bg-red-500"}`} />
              JMA {jma.feed.status.toUpperCase()}
              {jma.feed.lastSuccess && <span className="mut">· {fmtClock(jma.feed.lastSuccess)}</span>}
            </span>
            <span className="text-[11px] mut">
              JMA list covers roughly the latest 30 days from an unofficial, undocumented endpoint. Magnitude is JMA&apos;s Mj, which can differ from USGS Mw.
            </span>
          </div>
        )}
        <KpiBar kpis={kpis} range={range} loading={loading} />

        <div className="grid flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Map occupies ~65% of the main content width on desktop */}
          <div className="panel relative h-[62vh] min-h-[420px] overflow-hidden lg:h-[calc(100vh-230px)]">
            <EarthquakeMap events={filtered} theme={theme} selectedId={selectedId} newIds={activeNewIds}
              flyTo={flyTo} onSelect={handleSelect} loading={loading} />
            <div className="absolute bottom-8 left-2 z-10 hidden gap-1 md:flex" role="group" aria-label="Quick map views">
              {QUICK_VIEWS.map((v) => (
                <button key={v.key} onClick={() => {
                  // Quick views also switch the data scope, so e.g. Japan never flies
                  // the camera to a region the active filter (Indonesia/BMKG) hides.
                  setGeo(v.key === "indonesia" ? "indonesia" : v.key === "japan" ? "japan" : "world");
                  setFlyTo({ center: v.center, zoom: v.zoom, nonce: Date.now() });
                }}
                  className="kbd-focus panel px-2 py-1 text-[11px] mut hover:text-cyan-300">
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <EventFeed events={filtered} filters={filters} setFilters={setFilters}
            selectedId={selectedId} onSelect={handleSelect} newIds={activeNewIds} loading={loading}
            showStatusFilter={activeSrc === "usgs"}
            emptyHint={bmkgActive ? "BMKG publishes only the latest 15 M5.0+ and 15 felt events; there may be nothing inside this range yet." : jmaActive ? "JMA lists about the last 30 days of reports; there may be no located events inside this range." : undefined} />
        </div>

        <IndonesiaPanel events={indonesiaEvents} source={bmkgActive ? "bmkg" : "usgs"} bmkgFeed={bmkg.feed}
          onFocus={() => { setGeo("indonesia"); setFlyTo({ center: [118, -2.5], zoom: 4, nonce: Date.now() }); }} />

        <JapanPanel events={japanEvents} source={jmaActive ? "jma" : "usgs"} jmaFeed={jma.feed}
          onFocus={() => { setGeo("japan"); setFlyTo({ center: [138, 37], zoom: 3.8, nonce: Date.now() }); }} />

        <Charts events={filtered} range={range} loading={loading} />

        <AlertCenter rules={rules} setRules={setRules} alerts={alerts} clearAlerts={clearAlerts} />
      </main>

      <Footer feed={activeFeed} sourceLabel={SOURCE_LABEL[activeSrc]} bmkgFeed={bmkg.feed} jmaFeed={jma.feed} />
      <DetailsPanel event={selected} theme={theme} onClose={() => setSelectedId(null)} />
    </div>
  );
}
