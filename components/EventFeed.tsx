"use client";
import { EventFilters, QuakeEvent } from "@/lib/types";
import { fmtDepth, fmtLocal, fmtMag, relTime } from "@/lib/format";
import { magColor } from "@/lib/scale";
import { FilterX } from "lucide-react";

interface Props {
  events: QuakeEvent[];
  filters: EventFilters;
  setFilters: (f: EventFilters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  newIds: Set<string>;
  loading: boolean;
  showStatusFilter: boolean; // USGS-only review-status filter; hidden for BMKG
  emptyHint?: string;
}

const STATUS_LABEL: Record<string, string> = { reviewed: "REV", automatic: "AUTO" };

export default function EventFeed({ events, filters, setFilters, selectedId, onSelect, newIds, loading, showStatusFilter, emptyHint }: Props) {
  return (
    <section className="panel flex h-[480px] min-h-0 flex-col lg:h-[calc(100vh-230px)]" aria-label="Earthquake event feed">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-xs font-semibold uppercase tracking-widest mut">Event Feed</h2>
        <span className="mono text-[11px] mut">{events.length} shown</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 border-b px-3 py-2 text-[11px]" style={{ borderColor: "var(--border)" }}>
        <label className="flex flex-col gap-0.5 mut">
          Min magnitude
          <select value={filters.minMag} onChange={(e) => setFilters({ ...filters, minMag: Number(e.target.value) })}
            className="kbd-focus rounded border px-1 py-0.5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
            {[0, 1, 2, 2.5, 3, 4, 4.5, 5, 6].map((m) => <option key={m} value={m}>{m === 0 ? "any" : `M${m}+`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 mut">
          Max depth
          <select value={filters.maxDepthKm ?? "any"} onChange={(e) => setFilters({ ...filters, maxDepthKm: e.target.value === "any" ? null : Number(e.target.value) })}
            className="kbd-focus rounded border px-1 py-0.5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
            <option value="any">any</option>
            {[10, 30, 70, 150, 300].map((d) => <option key={d} value={d}>≤ {d} km</option>)}
          </select>
        </label>
        {showStatusFilter && (
        <label className="col-span-2 flex flex-col gap-0.5 mut">
          Review status (USGS)
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as EventFilters["status"] })}
            className="kbd-focus rounded border px-1 py-0.5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
            <option value="all">all</option>
            <option value="reviewed">reviewed only</option>
            <option value="automatic">automatic only</option>
          </select>
        </label>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="list">
        {loading && events.length === 0 && (
          <div className="space-y-2 p-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        )}
        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <FilterX size={22} className="mut" />
            <p className="text-sm mut">No earthquakes match the current filters.</p>
            <p className="text-[11px] mut">{emptyHint ?? "Try lowering the minimum magnitude or widening the depth/status filters."}</p>
          </div>
        )}
        {events.map((e) => {
          const selected = e.id === selectedId;
          const isNew = newIds.has(e.id);
          return (
            <button key={e.id} role="listitem" onClick={() => onSelect(e.id)} aria-current={selected}
              className={`kbd-focus flex w-full items-center gap-2.5 border-b px-3 py-2 text-left transition-colors hover:bg-cyan-500/5 ${selected ? "bg-cyan-500/10" : ""} ${isNew ? "flash-new" : ""}`}
              style={{ borderColor: "var(--border)" }}>
              <span className="mono grid h-9 w-11 shrink-0 place-items-center rounded text-sm font-bold"
                style={{ background: magColor(e.mag) + "22", color: magColor(e.mag), border: `1px solid ${magColor(e.mag)}55` }}>
                {fmtMag(e.mag)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{e.place}</span>
                <span className="block text-[11px] mut">{fmtDepth(e.depthKm)} · {fmtLocal(e.time)}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-[11px] text-cyan-300/90">{relTime(e.time)}</span>
                {e.source === "bmkg" && (
                  <span className="rounded bg-amber-500/15 px-1 text-[9px] font-semibold text-amber-400">BMKG</span>
                )}
                {e.status && STATUS_LABEL[e.status] && (
                  <span className={`rounded px-1 text-[9px] font-semibold ${e.status === "reviewed" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                    {STATUS_LABEL[e.status]}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
