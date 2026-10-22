// Short two-tone beep when an alert rule fires. Best-effort: browsers may
// block audio before the first user gesture, and any failure stays silent
// because a missed beep must never break alerting itself.
export function playAlertSound(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime + 0.02;
    [880, 587.33].forEach((freq, i) => {
      const start = t0 + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    void ctx.resume().catch(() => {});
    window.setTimeout(() => void ctx.close().catch(() => {}), 900);
  } catch {
    // audio is a nicety; alerting must never throw because of it
  }
}
