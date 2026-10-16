"use client";
import { Kpis } from "@/lib/analytics";
import { TimeRangeKey, TIME_RANGES } from "@/lib/types";
import { fmtMag, relTime } from "@/lib/format";
import { magColor } from "@/lib/scale";

export default function KpiBar({ kpis, range, loading }: { kpis: Kpis; range: TimeRangeKey; loading: boolean }) {
  const rangeLabel = TIME_RANGES.find((r) => r.key === range)!.label;
  const cards = [
    { label: "Earthquakes", value: String(kpis.total), sub: `in selected feed · ${rangeLabel}` },
    { label: "Magnitude 4.5+", value: String(kpis.m45), sub: `of ${kpis.total} events` },
    { label: "Magnitude 6.0+", value: String(kpis.m60), sub: `of ${kpis.total} events` },
    {
      label: "Strongest",
      value: kpis.strongest ? fmtMag(kpis.strongest.mag) : "—",
      sub: kpis.strongest?.place ?? "no events",
      color: kpis.strongest ? magColor(kpis.strongest.mag) : undefined,
    },
    {
      label: "Latest",
      value: kpis.latest ? fmtMag(kpis.latest.mag) : "—",
      sub: kpis.latest ? `${relTime(kpis.latest.time)} · ${kpis.latest.place}` : "no events",
      color: kpis.latest ? magColor(kpis.latest.mag) : undefined,
    },
  ];
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-5" aria-label="Key metrics">
      {cards.map((c) => (
        <div key={c.label} className="panel px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest mut">{c.label}</div>
          {loading ? (
            <div className="skeleton mt-1 h-7 w-16 rounded" />
          ) : (
            <div className="mono text-2xl font-bold" style={c.color ? { color: c.color } : undefined}>{c.value}</div>
          )}
          <div className="truncate text-[11px] mut" title={c.sub}>{c.sub}</div>
        </div>
      ))}
    </section>
  );
}
