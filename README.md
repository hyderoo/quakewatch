# QuakeWatch

**Global Seismic Intelligence** — a real-time earthquake monitoring dashboard built on the official [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) GeoJSON feeds. Worldwide coverage with a first-class Indonesia view.

## Live demo

_Live demo link will be added after the Vercel deployment. Until then, a preview runs on GitHub Pages: https://hyderoo.github.io/quakewatch/_

## What it does

- **Live map** (MapLibre GL JS): real USGS epicenters, marker size = magnitude, color = magnitude class, ring = depth class, clustering for dense regions, quick views (World, Indonesia, SE Asia, Japan, Ring of Fire), three basemaps (dark, light, satellite), optional tectonic plate boundaries, and a legend documenting the visual scale.
- **Event feed**: newest-first list with magnitude badges, depth, relative + absolute time, reviewed/automatic status, new-event highlighting, and filters (min magnitude, max depth, review status, place search).
- **Details panel**: origin time (UTC + local), depth, coordinates with copy button, event ID, review status, significance, felt reports, PAGER alert level, ShakeMap availability, tsunami flag, mini map, and a link to the official USGS event page.
- **KPIs + analytics**: event counts, M4.5+, M6.0+, strongest, latest — plus activity timeline, magnitude histogram, depth distribution, regional ranking, and strongest-events list. All computed from the currently filtered dataset.
- **Alert center**: configurable in-app rules (default M5.0+ and M6.0+; custom thresholds, Indonesia-only option). Each event triggers a rule at most once.
- **Indonesia focus**: bounding-box summary panel and one-click map centering, with links to BMKG for official Indonesian context.

## Data honesty

- **All earthquake data is real** — fetched live from USGS, no mock events, ever. If the feed fails, the dashboard keeps the last valid dataset and marks it **STALE**; if it has no data at all it shows **OFFLINE**. The LIVE indicator reflects actual connectivity.
- Magnitudes/locations are USGS values; **automatic** solutions are preliminary and may be revised. Magnitude alone does not imply damage.
- USGS events are **not independently verified by BMKG**. No BMKG feed is integrated; BMKG is linked as an external official source.
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

Suggested automation starting points: Playwright smoke test (page loads, feed populates, filter narrows counts), contract test on `lib/usgs.ts` normalization against a recorded USGS GeoJSON fixture (nullable `mag`/`place`/`time`, dedupe by `id`), and a unit pass over `lib/analytics.ts` binning. The running app exposes the MapLibre instance as `window.__qwMap` so E2E tests can project event coordinates to screen pixels and click real markers (used to verify test #4 during development).

## Credits & license

Built with AI assistance (Instinct) under human direction and review — architecture, data-honesty rules, and acceptance criteria were specified and verified by a human. Earthquake data: USGS. Basemaps: CARTO / Esri. Icons: Lucide. MIT — see [LICENSE](LICENSE).
