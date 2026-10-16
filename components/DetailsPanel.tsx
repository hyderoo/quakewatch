"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { QuakeEvent, ThemeMode } from "@/lib/types";
import { fmtDepth, fmtLocal, fmtMag, fmtUtc } from "@/lib/format";
import { magColor, pagerBadge } from "@/lib/scale";
import { BASEMAP_STYLES } from "./EarthquakeMap";
import { Check, Copy, ExternalLink, Waves, X } from "lucide-react";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-1.5 text-[12px]" style={{ borderColor: "var(--border)" }}>
      <span className="mut shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function MiniMap({ event, theme }: { event: QuakeEvent; theme: ThemeMode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: BASEMAP_STYLES[theme],
      center: [event.lon, event.lat],
      zoom: 5,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      new maplibregl.Marker({ color: magColor(event.mag) }).setLngLat([event.lon, event.lat]).addTo(map);
    });
    return () => { map.remove(); mapRef.current = null; };
  }, [event.lon, event.lat, event.mag, theme]);
  return <div ref={ref} className="h-32 w-full overflow-hidden rounded border" style={{ borderColor: "var(--border)" }} aria-label="Event location preview" />;
}

export default function DetailsPanel({ event, theme, onClose }: { event: QuakeEvent | null; theme: ThemeMode; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!event) return null;
  const pager = pagerBadge(event.alert);
  const coords = `${event.lat.toFixed(4)}, ${event.lon.toFixed(4)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(coords); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard denied */ }
  };
  return (
    <aside className="panel fixed bottom-2 right-2 top-16 z-40 flex w-[340px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden" aria-label="Earthquake details">
      <div className="flex items-start justify-between gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <div>
          <div className="mono text-xl font-bold" style={{ color: magColor(event.mag) }}>{fmtMag(event.mag)}</div>
          <div className="text-[12px]">{event.place}</div>
        </div>
        <button onClick={onClose} aria-label="Close details" className="kbd-focus rounded p-1 mut hover:text-cyan-300"><X size={16} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <MiniMap event={event} theme={theme} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {event.status && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${event.status === "reviewed" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-300"}`}>
              {event.status === "reviewed" ? "REVIEWED" : `STATUS: ${event.status.toUpperCase()}`}
            </span>
          )}
          {event.magType && <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300">{event.magType}</span>}
          {event.type && event.type !== "earthquake" && <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] text-purple-300">{event.type}</span>}
          {pager && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: pager.color + "22", color: pager.color }}>{pager.label}</span>}
          {event.tsunami === 1 && (
            <span className="flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
              <Waves size={10} /> TSUNAMI FLAG SET BY USGS
            </span>
          )}
        </div>
        <div className="mt-2">
          <Row label="Origin time (UTC)">{fmtUtc(event.time)}</Row>
          <Row label="Origin time (local)">{fmtLocal(event.time)}</Row>
          <Row label="Depth">{fmtDepth(event.depthKm)}</Row>
          <Row label="Coordinates">
            <span className="mono">{coords}</span>
            <button onClick={copy} aria-label="Copy coordinates" className="kbd-focus ml-1.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] hover:text-cyan-300" style={{ borderColor: "var(--border)" }}>
              {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />} {copied ? "copied" : "copy"}
            </button>
          </Row>
          <Row label="Event ID"><span className="mono text-[11px]">{event.id}</span></Row>
          <Row label="Network">{event.net ?? "—"}</Row>
          <Row label="Significance">{event.sig !== null ? `${event.sig} / 1000` : "—"}</Row>
          <Row label="Felt reports">{event.felt !== null ? `${event.felt} (max CDI ${event.cdi ?? "—"})` : "none reported"}</Row>
          <Row label="ShakeMap (MMI)">{event.hasShakemap ? `available · MMI ${event.mmi ?? "—"}` : "not available for this event"}</Row>
          <Row label="Last revised">{event.updated ? fmtUtc(event.updated) : "—"}</Row>
        </div>
        <p className="mt-2 text-[11px] mut">
          {event.status === "reviewed"
            ? "Reviewed solution: parameters checked by a seismic analyst."
            : "Preliminary: automatic solution; magnitude, depth, and location may be revised."}
          {" "}Magnitude alone does not imply damage or casualties.
        </p>
      </div>
      <div className="border-t px-3 py-2" style={{ borderColor: "var(--border)" }}>
        {event.url ? (
          <a href={event.url} target="_blank" rel="noreferrer" className="kbd-focus flex items-center justify-center gap-1.5 rounded bg-cyan-500/15 px-3 py-2 text-[12px] font-semibold text-cyan-300 hover:bg-cyan-500/25">
            Open on USGS <ExternalLink size={12} />
          </a>
        ) : (
          <span className="block text-center text-[11px] mut">No USGS event page link in feed</span>
        )}
      </div>
    </aside>
  );
}
