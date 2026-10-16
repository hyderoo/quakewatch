"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { QuakeEvent, TimeRangeKey } from "@/lib/types";
import { buildTimeline, depthHistogram, magnitudeHistogram, regionalActivity, strongestEvents } from "@/lib/analytics";
import { fmtMag } from "@/lib/format";
import { magColor } from "@/lib/scale";

const AXIS = { stroke: "var(--muted)", fontSize: 10 } as const;
const tooltipStyle = { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="panel flex min-h-0 flex-col p-3" aria-label={title}>
      <h3 className="text-[11px] font-semibold uppercase tracking-widest mut">{title}</h3>
      {note && <p className="mb-1 text-[10px] mut">{note}</p>}
      <div className="min-h-[160px] flex-1">{children}</div>
    </section>
  );
}

export default function Charts({ events, range, loading }: { events: QuakeEvent[]; range: TimeRangeKey; loading: boolean }) {
  if (loading && events.length === 0) {
    return <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-52 rounded-lg" />)}</div>;
  }
  const timeline = buildTimeline(events, range);
  const magHist = magnitudeHistogram(events);
  const depthHist = depthHistogram(events);
  const regions = regionalActivity(events);
  const top = strongestEvents(events);

  const empty = <div className="grid h-full place-items-center text-[11px] mut">No data in current selection</div>;

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      <Panel title="Activity timeline" note={range === "1h" ? "10-minute bins" : range === "24h" ? "hourly bins" : "daily bins"}>
        {events.length === 0 ? empty : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" tickLine={false} />
              <YAxis tick={AXIS} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--muted)" }} formatter={(v) => [`${v} events`, "count"]} />
              <Bar dataKey="count" fill="#22d3ee" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Magnitude distribution" note="0.5-wide magnitude bins">
        {magHist.length === 0 ? empty : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={magHist} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" tickLine={false} label={{ value: "magnitude", position: "insideBottomRight", offset: 0, style: AXIS }} />
              <YAxis tick={AXIS} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--muted)" }} formatter={(v) => [`${v} events`, "count"]} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {magHist.map((b) => <Cell key={b.label} fill={magColor(parseFloat(b.label))} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Depth distribution" note="kilometer intervals below surface">
        {depthHist.every((b) => b.count === 0) ? empty : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={depthHist} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" tickLine={false} />
              <YAxis tick={AXIS} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--muted)" }} formatter={(v) => [`${v} events`, "count"]} />
              <Bar dataKey="count" fill="#fbbf24" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Regional activity" note="Counts from the selected feed and period only — not a measure of regional seismic risk.">
        {regions.length === 0 ? empty : (
          <div className="space-y-1 overflow-y-auto">
            {regions.map((r) => (
              <div key={r.region} className="flex items-center gap-2 text-[12px]">
                <span className="w-36 truncate" title={r.region}>{r.region}</span>
                <div className="h-2 flex-1 rounded" style={{ background: "var(--panel-2)" }}>
                  <div className="h-2 rounded bg-cyan-500/70" style={{ width: `${(r.count / regions[0].count) * 100}%` }} />
                </div>
                <span className="mono w-8 text-right">{r.count}</span>
                <span className="mono w-12 text-right mut">{r.strongest !== null ? fmtMag(r.strongest) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Strongest events" note="Top 5 by magnitude in current selection">
        {top.length === 0 ? empty : (
          <ol className="space-y-1.5">
            {top.map((e, i) => (
              <li key={e.id} className="flex items-center gap-2 text-[12px]">
                <span className="mono w-4 mut">{i + 1}.</span>
                <span className="mono w-12 font-bold" style={{ color: magColor(e.mag) }}>{fmtMag(e.mag)}</span>
                <span className="truncate">{e.place}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
