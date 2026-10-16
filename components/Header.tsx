"use client";
import { Activity, Globe2, MapPin, Moon, RefreshCw, Search, Sun } from "lucide-react";
import { FeedState, GeoFilter, ThemeMode, TIME_RANGES, TimeRangeKey } from "@/lib/types";
import { REFRESH_OPTIONS } from "@/lib/useEarthquakes";
import { fmtClock, relTime } from "@/lib/format";

interface Props {
  feed: FeedState; // status of the currently active source
  sourceLabel: string; // display name of the active source
  otherFeed: { label: string; feed: FeedState } | null; // secondary source shown in Indonesia/Japan mode
  range: TimeRangeKey;
  setRange: (r: TimeRangeKey) => void;
  geo: GeoFilter;
  setGeo: (g: GeoFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  refreshMs: number;
  setRefreshMs: (ms: number) => void;
  onRefreshNow: () => void;
}

const STATUS_UI: Record<FeedState["status"], { label: string; dot: string; text: string }> = {
  connecting: { label: "CONNECTING", dot: "bg-slate-400", text: "text-slate-400" },
  live: { label: "LIVE", dot: "bg-emerald-400 live-dot", text: "text-emerald-400" },
  stale: { label: "STALE", dot: "bg-amber-400", text: "text-amber-400" },
  offline: { label: "OFFLINE", dot: "bg-red-500", text: "text-red-400" },
};

export default function Header(p: Props) {
  const s = STATUS_UI[p.feed.status];
  return (
    <header className="panel sticky top-2 z-30 mx-2 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="#0a0f1e" />
          <polyline points="6,36 18,36 24,20 32,48 38,28 44,40 50,36 58,36" fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide">QuakeWatch</div>
          <div className="text-[10px] uppercase tracking-widest mut">Global Seismic Intelligence</div>
        </div>
      </div>

      <div className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold ${s.text}`} style={{ borderColor: "var(--border)" }} role="status" aria-live="polite">
        <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} />
        {s.label}
        <span className="mut font-normal">
          {p.feed.lastSuccess ? `· updated ${fmtClock(p.feed.lastSuccess)}` : "· no data yet"}
        </span>
      </div>
      {p.feed.status === "stale" && p.feed.lastSuccess && (
        <div className="text-[11px] text-amber-400/90">showing last good data ({relTime(p.feed.lastSuccess)})</div>
      )}
      {p.feed.status === "offline" && <div className="text-[11px] text-red-400/90">{p.sourceLabel} feed unreachable — no data</div>}

      <div className="hidden items-center gap-1 rounded border px-2 py-1 text-[11px] mut md:flex" style={{ borderColor: "var(--border)" }}>
        <Activity size={12} className="text-cyan-400" /> {p.sourceLabel}
        {p.otherFeed && (
          <span className="ml-1 flex items-center gap-1 border-l pl-2" style={{ borderColor: "var(--border)" }}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_UI[p.otherFeed.feed.status].dot}`} />
            {p.otherFeed.label} {p.otherFeed.feed.status.toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Geographic filter">
        {(["world", "indonesia", "japan"] as GeoFilter[]).map((g) => (
          <button key={g} onClick={() => p.setGeo(g)} aria-pressed={p.geo === g}
            className={`kbd-focus flex items-center gap-1 rounded px-2 py-1 text-[11px] ${p.geo === g ? "bg-cyan-500/20 text-cyan-300" : "mut hover:text-cyan-200"}`}>
            {g === "world" ? <Globe2 size={12} /> : <MapPin size={12} />}
            {g === "world" ? "Worldwide" : g === "indonesia" ? "Indonesia" : "Japan"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-0.5" role="group" aria-label="Time range">
        {TIME_RANGES.map((r) => (
          <button key={r.key} onClick={() => p.setRange(r.key)} aria-pressed={p.range === r.key}
            className={`kbd-focus rounded px-2 py-1 text-[11px] mono ${p.range === r.key ? "bg-cyan-500/20 text-cyan-300" : "mut hover:text-cyan-200"}`}>
            {r.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1 rounded border px-2 py-1" style={{ borderColor: "var(--border)" }}>
        <Search size={12} className="mut" />
        <input value={p.search} onChange={(e) => p.setSearch(e.target.value)} placeholder="Place or lat, lon"
          aria-label="Search by place name or coordinates"
          className="kbd-focus w-32 bg-transparent text-[11px] outline-none placeholder:text-[var(--muted)]" />
      </label>

      <label className="flex items-center gap-1 text-[11px] mut">
        <RefreshCw size={11} />
        <select value={p.refreshMs} onChange={(e) => p.setRefreshMs(Number(e.target.value))} aria-label="Refresh interval"
          className="kbd-focus rounded border bg-transparent px-1 py-0.5 text-[11px]" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          {REFRESH_OPTIONS.map((o) => <option key={o.ms} value={o.ms}>{o.label}</option>)}
        </select>
        <button onClick={p.onRefreshNow} className="kbd-focus rounded border px-1.5 py-0.5 hover:text-cyan-300" style={{ borderColor: "var(--border)" }} aria-label="Refresh now">↻</button>
      </label>

      <button onClick={p.toggleTheme} aria-label="Toggle theme" aria-pressed={p.theme === "light"}
        className="kbd-focus ml-auto rounded border p-1.5 hover:text-cyan-300" style={{ borderColor: "var(--border)" }}>
        {p.theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
      </button>
    </header>
  );
}
