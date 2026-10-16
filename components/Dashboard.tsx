"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EventFilters, GeoFilter, ThemeMode, TimeRangeKey } from "@/lib/types";
import { useAlerts, useEarthquakes, applyFilters, DEFAULT_REFRESH_MS } from "@/lib/useEarthquakes";
import { computeKpis } from "@/lib/analytics";
import { haversineKm } from "@/lib/format";
import Header from "./Header";
import KpiBar from "./KpiBar";
import EarthquakeMap, { FlyToRequest, QUICK_VIEWS } from "./EarthquakeMap";
import EventFeed from "./EventFeed";
import DetailsPanel from "./DetailsPanel";
import Charts from "./Charts";
import AlertCenter from "./AlertCenter";
import IndonesiaPanel from "./IndonesiaPanel";
import Footer from "./Footer";

function parseCoords(s: string): [number, number] | null {
  const m = s.trim().match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lat, lon];
}

export default function Dashboard() {
  const [range, setRange] = useState<TimeRangeKey>("24h");
  const [geo, setGeo] = useState<GeoFilter>("world");
  const [filters, setFilters] = useState<EventFilters>({ minMag: 0, maxDepthKm: null, status: "all", search: "" });
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToRequest | null>(null);

  const { events, feed, newIds, reload } = useEarthquakes(range, refreshMs);
  const { rules, setRules, alerts, clearAlerts } = useAlerts(events);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const coordQuery = parseCoords(filters.search);
  const filtered = useMemo(() => {
    const f = coordQuery ? { ...filters, search: "" } : filters; // coordinate search pans the map instead of filtering rows
    return applyFilters(events, geo, f);
  }, [events, geo, filters, coordQuery]);

  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const indonesiaEvents = useMemo(() => events.filter((e) => e.isIndonesia), [events]);
  const selected = useMemo(() => events.find((e) => e.id === selectedId) ?? null, [events, selectedId]);

  const flyToEvent = (id: string) => {
    const e = events.find((x) => x.id === id);
    if (!e) return;
    setFlyTo({ center: [e.lon, e.lat], zoom: 6, nonce: Date.now() });
  };
  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    if (id) flyToEvent(id);
  };

  // Coordinate search: fly to the point and select the nearest event within 1000 km.
  const lastCoord = useRef<string>("");
  useEffect(() => {
    if (!coordQuery || events.length === 0) return;
    const key = coordQuery.join(",");
    if (key === lastCoord.current) return;
    lastCoord.current = key;
    const [lat, lon] = coordQuery;
    let best: { id: string; d: number; lon: number; lat: number } | null = null;
    for (const e of events) {
      const d = haversineKm(lat, lon, e.lat, e.lon);
      if (!best || d < best.d) best = { id: e.id, d, lon: e.lon, lat: e.lat };
    }
    if (best) {
      setFlyTo({ center: [best.lon, best.lat], zoom: 6, nonce: Date.now() });
      if (best.d <= 1000) setSelectedId(best.id);
    }
  }, [coordQuery, events]);

  const loading = feed.status === "connecting";

  return (
    <div className="flex min-h-screen flex-col gap-2">
      <Header feed={feed} range={range} setRange={setRange} geo={geo} setGeo={setGeo}
        search={filters.search} setSearch={(s) => setFilters({ ...filters, search: s })}
        theme={theme} toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        refreshMs={refreshMs} setRefreshMs={setRefreshMs} onRefreshNow={reload} />

      <main className="mx-2 flex flex-1 flex-col gap-2">
        <KpiBar kpis={kpis} range={range} loading={loading} />

        <div className="grid flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Map occupies ~65% of the main content width on desktop */}
          <div className="panel relative min-h-[420px] overflow-hidden lg:min-h-[520px]">
            <EarthquakeMap events={filtered} theme={theme} selectedId={selectedId} newIds={newIds}
              flyTo={flyTo} onSelect={handleSelect} loading={loading} />
            <div className="absolute bottom-8 left-2 z-10 hidden gap-1 md:flex" role="group" aria-label="Quick map views">
              {QUICK_VIEWS.map((v) => (
                <button key={v.key} onClick={() => setFlyTo({ center: v.center, zoom: v.zoom, nonce: Date.now() })}
                  className="kbd-focus panel px-2 py-1 text-[11px] mut hover:text-cyan-300">
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <EventFeed events={filtered} filters={filters} setFilters={setFilters}
            selectedId={selectedId} onSelect={handleSelect} newIds={newIds} loading={loading} />
        </div>

        <IndonesiaPanel events={indonesiaEvents}
          onFocus={() => { setGeo("indonesia"); setFlyTo({ center: [118, -2.5], zoom: 4, nonce: Date.now() }); }} />

        <Charts events={filtered} range={range} loading={loading} />

        <AlertCenter rules={rules} setRules={setRules} alerts={alerts} clearAlerts={clearAlerts} />
      </main>

      <Footer feed={feed} />
      <DetailsPanel event={selected} theme={theme} onClose={() => setSelectedId(null)} />
    </div>
  );
}
