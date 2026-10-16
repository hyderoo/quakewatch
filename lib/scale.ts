// The documented visual scale for earthquake markers.
// Size encodes magnitude (continuous). Color encodes the magnitude severity
// class. Stroke encodes depth class (shallow / intermediate / deep).

export interface MagStop { min: number; label: string; color: string }

export const MAG_STOPS: MagStop[] = [
  { min: 0, label: "< 2.5", color: "#67e8f9" },   // micro — cyan 300
  { min: 2.5, label: "2.5-4.4", color: "#22d3ee" }, // minor — cyan 400
  { min: 4.5, label: "4.5-5.9", color: "#fbbf24" }, // light/moderate — amber 400
  { min: 6.0, label: "6.0-6.9", color: "#fb923c" }, // strong — orange 400
  { min: 7.0, label: "7.0+", color: "#ef4444" },    // major+ — red 500
];

export interface DepthStop { max: number; label: string; stroke: string; width: number }

export const DEPTH_STOPS: DepthStop[] = [
  { max: 70, label: "Shallow <70 km", stroke: "rgba(255,255,255,0.85)", width: 1.5 },
  { max: 300, label: "Intermediate 70-300 km", stroke: "rgba(255,255,255,0.4)", width: 1 },
  { max: 800, label: "Deep >300 km", stroke: "rgba(255,255,255,0.12)", width: 0.75 },
];

export function magColor(mag: number | null): string {
  if (mag === null) return "#94a3b8";
  for (let i = MAG_STOPS.length - 1; i >= 0; i--) if (mag >= MAG_STOPS[i].min) return MAG_STOPS[i].color;
  return MAG_STOPS[0].color;
}

export function magRadius(mag: number | null): number {
  const m = mag === null ? 1 : Math.max(0, mag);
  return 3 + Math.min(15, m * 2.1);
}

export function depthStroke(km: number | null): { stroke: string; width: number } {
  if (km === null) return { stroke: "rgba(148,163,184,0.5)", width: 1 };
  for (const d of DEPTH_STOPS) if (km < d.max) return { stroke: d.stroke, width: d.width };
  return { stroke: DEPTH_STOPS[2].stroke, width: DEPTH_STOPS[2].width };
}

// Continuous helpers used by the MapLibre data-driven expressions.
// MapLibre expressions below must mirror these values.
export const MAG_EXPR_DOMAIN = [0, 2.5, 4.5, 6, 7];
export const MAG_EXPR_COLORS = MAG_STOPS.map((s) => s.color);

export function pagerBadge(alert: string | null): { label: string; color: string } | null {
  if (!alert) return null;
  const map: Record<string, string> = { green: "#22c55e", yellow: "#eab308", orange: "#f97316", red: "#ef4444" };
  const c = map[alert];
  return c ? { label: `PAGER ${alert.toUpperCase()}`, color: c } : null;
}
