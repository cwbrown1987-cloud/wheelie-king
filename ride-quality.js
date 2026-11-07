// Automatic graphics quality for the ride.
// Each device starts on a sensible tier, then the ride measures real frame times:
// too slow -> drop resolution/shadows right away and remember a lower tier;
// two smooth rides in a row -> try one tier higher next time.
// Setting localStorage 'wk-race-low-detail' = '1' still forces the lowest tier.
export const TIERS = {
  low:    { aa: false, shadows: false, maxPR: 1,    envLow: true,  trimTiny: true },
  medium: { aa: false, shadows: false, maxPR: 1.25, envLow: true,  trimTiny: true },
  high:   { aa: true,  shadows: true,  maxPR: 1.5,  envLow: false, trimTiny: false },
};
export const ORDER = ['low', 'medium', 'high'];
export const QUALITY = { warmup: 1.5, window: 3, slow: 1 / 40, smooth: 1 / 55, goodRunsToUpgrade: 2, minPR: 0.75, prStep: 0.8, maxDowngrades: 3 };
const KEY = 'wk-quality', GOOD = 'wk-quality-good';
const get = (s, k) => { try { return s?.getItem(k) ?? null } catch { return null } };
const set = (s, k, v) => { try { v == null ? s?.removeItem(k) : s?.setItem(k, String(v)) } catch {} };

export function pickTier(storage = globalThis.localStorage, coarse = globalThis.matchMedia?.('(pointer:coarse)').matches) {
  if (get(storage, 'wk-race-low-detail') === '1') return { name: 'low', manual: true };
  const stored = get(storage, KEY);
  return { name: ORDER.includes(stored) ? stored : coarse ? 'low' : 'high', manual: false };
}

// Feed it every frame's real (unpaused) delta; it returns an action when something should change.
export function createQualityMonitor({ name, manual = false, storage = globalThis.localStorage, config = {} }) {
  const C = { ...QUALITY, ...config }; let t = 0, windowTime = 0, samples = [], judged = false, downgrades = 0, tier = name;
  const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] };
  function sample(dt) {
    if (!(dt > 0) || dt > 0.25) return null; // ignore tab switches / hitches
    t += dt; if (t < C.warmup) return null;
    samples.push(dt); windowTime+=dt; if (windowTime < C.window) return null; windowTime=0;
    const p50 = pct(samples, .5), p90 = pct(samples, .9); samples = [];
    if (p50 > C.slow && downgrades < C.maxDowngrades) {
      downgrades++; judged = true;
      const lower = ORDER[Math.max(0, ORDER.indexOf(tier) - 1)];
      if (!manual) { tier = lower; set(storage, KEY, tier); }
      set(storage, GOOD, 0);
      return { type: 'down', p50, p90, tier };
    }
    if (!judged) {
      judged = true;
      if (!manual && p90 <= C.smooth && tier !== 'high') {
        const good = (+get(storage, GOOD) || 0) + 1;
        if (good >= C.goodRunsToUpgrade) { const up = ORDER[ORDER.indexOf(tier) + 1]; set(storage, KEY, up); set(storage, GOOD, 0); return { type: 'up-next-ride', p50, p90, tier: up }; }
        set(storage, GOOD, good); return { type: 'smooth', p50, p90, good };
      }
      if (!manual && p90 > C.smooth) set(storage, GOOD, 0);
      return { type: 'ok', p50, p90 };
    }
    return null;
  }
  return { sample, state: () => ({ tier, downgrades, judged }) };
}
