"use client";
import { QuakeEvent } from "@/lib/types";
import { computeKpis } from "@/lib/analytics";
import { fmtMag, relTime } from "@/lib/format";
import { magColor } from "@/lib/scale";
import { ExternalLink, MapPin } from "lucide-react";

export default function IndonesiaPanel({ events, onFocus }: { events: QuakeEvent[]; onFocus: () => void }) {
  const k = computeKpis(events);
  return (
    <section className="panel p-3" aria-label="Indonesia seismic summary">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest mut">
          <MapPin size={12} className="text-cyan-400" /> Indonesia focus
        </h3>
        <button onClick={onFocus} className="kbd-focus rounded bg-cyan-500/15 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-500/25">
          Center map on Indonesia
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div><div className="text-[10px] uppercase mut">Events</div><div className="mono text-lg font-bold">{k.total}</div></div>
        <div><div className="text-[10px] uppercase mut">M4.5+</div><div className="mono text-lg font-bold">{k.m45}</div></div>
        <div>
          <div className="text-[10px] uppercase mut">Strongest</div>
          <div className="mono text-lg font-bold" style={{ color: k.strongest ? magColor(k.strongest.mag) : undefined }}>{k.strongest ? fmtMag(k.strongest.mag) : "—"}</div>
          <div className="truncate text-[10px] mut">{k.strongest?.place ?? ""}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase mut">Latest</div>
          <div className="mono text-lg font-bold">{k.latest ? relTime(k.latest.time) : "—"}</div>
          <div className="truncate text-[10px] mut">{k.latest?.place ?? ""}</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] mut">
        USGS feed events inside the Indonesia bounding box (94.5°E-141.5°E, 11.5°S-6.5°N) for the selected period.
        USGS events are not independently verified by BMKG. For official Indonesian earthquake information see{" "}
        <a href="https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg" target="_blank" rel="noreferrer" className="kbd-focus text-cyan-300 hover:underline">
          BMKG Gempabumi Terkini <ExternalLink size={10} className="inline" />
        </a>.
      </p>
    </section>
  );
}
