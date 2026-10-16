# QuakeWatch

**Global Seismic Intelligence** — a real-time earthquake monitoring dashboard built on the official [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) GeoJSON feeds, plus official [BMKG](https://data.bmkg.go.id/gempabumi/) open data for the Indonesia view. Worldwide coverage with a first-class Indonesia mode.

## Live demo

_Live demo link will be added after the Vercel deployment. Until then, a preview runs on GitHub Pages: https://hyderoo.github.io/quakewatch/_

## What it does

- **Live map** (MapLibre GL JS): real USGS epicenters, marker size = magnitude, color = magnitude class, ring = depth class, clustering for dense regions, quick views (World, Indonesia, SE Asia, Japan, Ring of Fire), three basemaps (dark, light, satellite), optional tectonic plate boundaries, and a legend documenting the visual scale.
- **Event feed**: newest-first list with magnitude badges, depth, relative + absolute time, reviewed/automatic status, new-event highlighting, and filters (min magnitude, max depth, review status, place search).
- **Details panel**: origin time (UTC + local), depth, coordinates with copy button, event ID, review status, significance, felt reports, PAGER alert level, ShakeMap availability, tsunami flag, mini map, and a link to the official USGS event page.
- **KPIs + analytics**: event counts, M4.5+, M6.0+, strongest, latest — plus activity timeline, magnitude histogram, depth distribution, regional ranking, and strongest-events list. All computed from the currently filtered dataset.
- **Alert center**: configurable in-app rules (default M5.0+ and M6.0+; custom thresholds, Indonesia-only option). Each event triggers a rule at most once.
- **Indonesia focus**: bounding-box summary panel, one-click map centering, and a dedicated **BMKG (official) / USGS source toggle**. The BMKG mode merges the Gempabumi Terkini (latest 15 M5.0+) and Gempabumi Dirasakan (latest 15 felt) bulletins, shows tsunami-potential and felt-area text, BMKG shakemap images, and carries its own independent LIVE/STALE/OFFLINE status.

## Data honesty

- **All earthquake data is real** — fetched live from USGS, no mock events, ever. If the feed fails, the dashboard keeps the last valid dataset and marks it **STALE**; if it has no data at all it shows **OFFLINE**. The LIVE indicator reflects actual connectivity.
- Magnitudes/locations are USGS values; **automatic** solutions are preliminary and may be revised. Magnitude alone does not imply damage.
- USGS and BMKG events are **never merged or deduplicated against each other**. The Indonesia view shows one source at a time, chosen explicitly with the source toggle (BMKG by default), and every panel labels which source it shows.
- BMKG publishes **fixed-size bulletins, not a complete catalog**: Gempabumi Terkini holds only the latest 15 events of M5.0+, Gempabumi Dirasakan only the latest 15 felt events, and autogempa is the single latest automatic event (used for its shakemap image). Older periods or smaller events may simply be absent — the UI says so instead of implying completeness. The time-range selector filters these bulletins by origin time on the client.
- BMKG bulletins carry no USGS-style review status, significance, or PAGER level; those fields are shown as unavailable rather than invented. BMKG tsunami information is the agency's free-text "Potensi" statement, shown verbatim.
- BMKG endpoints: `autogempa.json`, `gempaterkini.json`, `gempadirasakan.json` under `https://data.bmkg.go.id/DataMKG/TEWS/` — CORS-enabled, rate limit 60 req/min/IP, **attribution to BMKG is mandatory** and shown in the UI footer and Indonesia panel.
- Alerts are evaluated in the page. **No push notifications or background monitoring exist** and none are claimed.
- Regional rankings are counts from the selected feed and period — **not** measures of regional seismic risk.
- Tectonic plate boundaries: [Bird (2003) PB2002](https://github.com/fraxen/tectonicplates), bundled in `public/data/plates.json`.

## Tech stack

Next.js (static export) · TypeScript · React 19 · Tailwind CSS 4 · MapLibre GL JS · Recharts · lucide-react

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000  (predev regenerates app/globals.built.css)
npm run build      # type-check + static export into out/
npx serve out      # serve the production build locally
```

`npm run css:watch` regenerates styles while editing `app/globals.css` (the Turbopack Tailwind plugin is bypassed deliberately — styles are prebuilt so builds are reproducible anywhere).

Refresh interval defaults to 60 s (USGS feeds cache ~1 min) and is configurable in the header (30 s – 5 min).

## Deploy to Vercel

1. In Vercel: **Add New → Project → Import** this repo.
2. Framework is auto-detected (Next.js) — no settings to change. **Deploy**.

## How this could be tested (QA notes)

Manual acceptance checklist (each maps to a user-visible behavior):

| # | Test | Expected |
|---|------|----------|
| 1 | Load the page | LIVE indicator green only after a successful USGS fetch; events on map, feed, KPIs |
| 2 | Switch 1H/24H/7D/30D | Feed URL changes to the matching USGS feed; KPIs/charts/feed recompute |
| 3 | Set min magnitude M4.5+ | Map, feed, KPIs, and all charts show only M≥4.5; counts agree everywhere |
| 4 | Click a map marker | Details panel opens with that event's data; feed row highlights |
| 5 | Click a feed row | Map flies to the event; details panel opens |
| 6 | Block `earthquake.usgs.gov` (DevTools → Network → block) and refresh | Status flips to STALE with last-good data kept, or OFFLINE on first load; no fabricated events |
| 7 | Search `Palu` | Feed/map filter to matching places. Search `-0.9, 119.9` | Map flies there; nearest event selected |
| 8 | Wait for a refresh with a new event | New row flashes briefly; alert rules fire once per event (no duplicates on later refreshes) |
| 9 | Resize to phone width | Layout stacks, map/feed usable, no overlap |
| 10 | Toggle theme | Full UI switches; basemap follows unless explicitly chosen |
| 11 | Indonesia view → BMKG source (default) | BMKG status pill in header and source bar; amber BMKG badges on feed rows; details panel shows tsunami potential, felt area, bulletin list, BMKG shakemap; footer shows BMKG attribution and status |
| 12 | Indonesia view → switch to USGS | Map/feed/KPIs switch to USGS events; review-status filter reappears; BMKG status remains visible as secondary |
| 13 | Block `data.bmkg.go.id` in Indonesia/BMKG mode | BMKG status flips to STALE (last-good data kept) or OFFLINE on first load; USGS status unaffected; no fabricated events |

Suggested automation starting points: Playwright smoke test (page loads, feed populates, filter narrows counts), contract tests on `lib/usgs.ts` and `lib/bmkg.ts` normalization against recorded fixtures (USGS: nullable `mag`/`place`/`time`, dedupe by `id`; BMKG: stringly-typed numbers, single-object autogempa vs array lists, merge by origin time + coordinates), and a unit pass over `lib/analytics.ts` binning. The running app exposes the MapLibre instance as `window.__qwMap` so E2E tests can project event coordinates to screen pixels and click real markers (used to verify test #4 during development).

## Credits & license

Built with AI assistance (Instinct) under human direction and review — architecture, data-honesty rules, and acceptance criteria were specified and verified by a human. Earthquake data: USGS and BMKG (data.bmkg.go.id). Basemaps: CARTO / Esri. Icons: Lucide. MIT — see [LICENSE](LICENSE).
