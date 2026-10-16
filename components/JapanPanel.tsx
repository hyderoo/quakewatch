"use client";
import { FeedState, JapanSource, QuakeEvent } from "@/lib/types";
import { computeKpis } from "@/lib/analytics";
import { fmtMag, relTime } from "@/lib/format";
import { magColor } from "@/lib/scale";
import { ExternalLink, MapPin } from "lucide-react";

interface Props {
  events: QuakeEvent[];
  source: JapanSource;
  jmaFeed: FeedState;
  onFocus: () => void;
}

export default function JapanPanel({ events, source, jmaFeed, onFocus }: Props) {
  const k = computeKpis(events);
  return (
    <section className="panel p-3" aria-label="Japan seismic summary">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest mut">
          <MapPin size={12} className="text-rose-300" /> Japan focus
          <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-300 normal-case tracking-normal">
            {source === "jma" ? "Source: JMA" : "Source: USGS"}
          </span>
        </h3>
        <button onClick={onFocus} className="kbd-focus rounded bg-cyan-500/15 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-500/25">
          Center map on Japan
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
      {source === "jma" ? (
        <p className="mt-2 text-[11px] mut">
          Source:{" "}
          <a href="https://www.jma.go.jp/" target="_blank" rel="noreferrer" className="kbd-focus text-cyan-300 hover:underline">
            Japan Meteorological Agency website <ExternalLink size={10} className="inline" />
          </a>
          {" "}({jmaFeed.status.toUpperCase()}
          {jmaFeed.lastSuccess ? ` · updated ${new Date(jmaFeed.lastSuccess).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}` : ""}).
          Data edited and processed by QuakeWatch; this is not a JMA product. The list comes from an unofficial, undocumented JMA
          endpoint that covers about the last 30 days, and reports without a hypocenter or magnitude are left out, so counts are
          <em> not a complete catalog</em>. Magnitude is JMA&apos;s Mj, which can differ from USGS Mw. JMA and USGS events are never merged.
        </p>
      ) : (
        <p className="mt-2 text-[11px] mut">
          USGS feed events inside the Japan bounding box (122°E-150°E, 20°N-47°N) for the selected period. For official Japanese
          earthquake information see{" "}
          <a href="https://www.jma.go.jp/bosai/map.html#contents=earthquake_map" target="_blank" rel="noreferrer" className="kbd-focus text-cyan-300 hover:underline">
            JMA earthquake information <ExternalLink size={10} className="inline" />
          </a>.
        </p>
      )}
    </section>
  );
}
