"use client";
import { FeedState } from "@/lib/types";
import { fmtClock } from "@/lib/format";
import { ExternalLink } from "lucide-react";

export default function Footer({ feed }: { feed: FeedState }) {
  return (
    <footer className="panel mx-2 mb-2 mt-2 px-3 py-3 text-[11px] mut" aria-label="Data sources and attribution">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Earthquake data:{" "}
          <a className="kbd-focus text-cyan-300 hover:underline" href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php" target="_blank" rel="noreferrer">
            USGS Earthquake Hazards Program GeoJSON feeds <ExternalLink size={10} className="inline" />
          </a>{" "}
          (no API key; feed cache ~1 min)
        </span>
        <span>
          Basemaps:{" "}
          <a className="kbd-focus text-cyan-300 hover:underline" href="https://carto.com/basemaps" target="_blank" rel="noreferrer">CARTO</a>
          {" / "}
          <a className="kbd-focus text-cyan-300 hover:underline" href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">Esri World Imagery</a>
        </span>
        <span>
          Plate boundaries:{" "}
          <a className="kbd-focus text-cyan-300 hover:underline" href="https://github.com/fraxen/tectonicplates" target="_blank" rel="noreferrer">Bird (2003) PB2002</a>
        </span>
        <span>
          Indonesian context:{" "}
          <a className="kbd-focus text-cyan-300 hover:underline" href="https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg" target="_blank" rel="noreferrer">
            BMKG recent earthquakes <ExternalLink size={10} className="inline" />
          </a>{" "}
          (separate agency; USGS events are not BMKG-verified)
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          Feed status: <strong className={feed.status === "live" ? "text-emerald-400" : feed.status === "stale" ? "text-amber-400" : "text-red-400"}>{feed.status.toUpperCase()}</strong>
          {feed.lastSuccess && ` · last success ${fmtClock(feed.lastSuccess)}`}
          {feed.error && ` · last error: ${feed.error}`}
        </span>
        <span>QuakeWatch is an independent portfolio project, not an official warning system. For warnings follow USGS, BMKG, and local authorities.</span>
      </div>
    </footer>
  );
}
