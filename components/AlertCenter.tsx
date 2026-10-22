"use client";
import { useState } from "react";
import { AlertItem, AlertRule } from "@/lib/types";
import { fmtLocal, fmtMag, relTime } from "@/lib/format";
import { magColor } from "@/lib/scale";
import { Bell, BellOff, Trash2, Volume2, VolumeX } from "lucide-react";

interface Props {
  rules: AlertRule[];
  setRules: (r: AlertRule[]) => void;
  alerts: AlertItem[];
  clearAlerts: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (on: boolean) => void;
}

export default function AlertCenter({ rules, setRules, alerts, clearAlerts, soundEnabled, setSoundEnabled }: Props) {
  const [customMag, setCustomMag] = useState("4.5");
  const [indoOnly, setIndoOnly] = useState(false);

  const toggle = (id: string) => setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  const addRule = () => {
    const m = parseFloat(customMag);
    if (isNaN(m) || m < 0 || m > 10) return;
    setRules([...rules, { id: `c${Date.now()}`, label: `Magnitude ${m.toFixed(1)}+${indoOnly ? " (Indonesia)" : ""}`, minMag: m, indonesiaOnly: indoOnly, enabled: true }]);
  };
  const removeRule = (id: string) => setRules(rules.filter((r) => r.id !== id));

  return (
    <section className="panel p-3" aria-label="Alert center">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest mut">Alert center</h3>
        <span className="flex items-center gap-2">
          <span className="text-[10px] mut">in-app only — no push notifications are sent</span>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-pressed={soundEnabled}
            aria-label="Toggle alert sound"
            title={soundEnabled ? "Alert sound on" : "Alert sound off"}
            className={`kbd-focus rounded p-1 ${soundEnabled ? "text-amber-300" : "mut"}`}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
        </span>
      </div>
      <div className="mb-3 space-y-1.5">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-[12px]">
            <button onClick={() => toggle(r.id)} aria-pressed={r.enabled} aria-label={`Toggle rule ${r.label}`}
              className={`kbd-focus rounded p-1 ${r.enabled ? "text-amber-300" : "mut"}`}>
              {r.enabled ? <Bell size={13} /> : <BellOff size={13} />}
            </button>
            <span className={r.enabled ? "" : "mut line-through"}>{r.label}</span>
            {r.id.startsWith("c") && (
              <button onClick={() => removeRule(r.id)} aria-label={`Remove rule ${r.label}`} className="kbd-focus ml-auto mut hover:text-red-400">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 text-[11px]">
          <input value={customMag} onChange={(e) => setCustomMag(e.target.value)} inputMode="decimal" aria-label="Custom magnitude threshold"
            className="kbd-focus w-16 rounded border bg-transparent px-1.5 py-1 mono" style={{ borderColor: "var(--border)" }} placeholder="M ≥" />
          <label className="flex items-center gap-1 mut">
            <input type="checkbox" checked={indoOnly} onChange={(e) => setIndoOnly(e.target.checked)} className="kbd-focus" />
            Indonesia only
          </label>
          <button onClick={addRule} className="kbd-focus rounded bg-cyan-500/15 px-2 py-1 text-cyan-300 hover:bg-cyan-500/25">Add rule</button>
        </div>
      </div>
      <div className="max-h-56 space-y-1.5 overflow-y-auto" role="log" aria-live="polite" aria-label="Triggered alerts">
        {alerts.length === 0 && <p className="text-[11px] mut">No alerts triggered yet in this session. Rules are checked against every feed refresh; each event triggers a rule at most once.</p>}
        {alerts.map((a) => (
          <div key={a.key} className="rounded border px-2 py-1.5 text-[12px]" style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}>
            <div className="flex items-center gap-2">
              <span className="mono font-bold" style={{ color: magColor(a.mag) }}>{fmtMag(a.mag)}</span>
              <span className="truncate">{a.place}</span>
              <span className="ml-auto shrink-0 text-[10px] text-amber-300">{a.ruleLabel}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] mut">
              <span>{relTime(a.time)} · {fmtLocal(a.time)} · source: {a.source.toUpperCase()}</span>
              {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="kbd-focus text-cyan-300 hover:underline">details</a>}
            </div>
          </div>
        ))}
      </div>
      {alerts.length > 0 && (
        <button onClick={clearAlerts} className="kbd-focus mt-2 rounded border px-2 py-1 text-[11px] mut hover:text-red-400" style={{ borderColor: "var(--border)" }}>
          Clear {alerts.length} alert{alerts.length === 1 ? "" : "s"}
        </button>
      )}
    </section>
  );
}
