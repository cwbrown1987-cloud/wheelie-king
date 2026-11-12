// Ride pay (v2.1-37). Coins are the main way to earn: every coin is worth $5, finishing a level pays a bonus
// (more the first time), tricks/score still add a little (score / 10, as before). Pricing in the shops stays as it
// is: a clean Neon Canal run with most coins pays roughly $1.5-2k, so rider gear (≈$120-750 a piece) comes after a
// run or two, a good bike part (≈$300-3,000) every few runs, and the whole parts catalogue (≈$255k) is a
// long-term goal of well over a hundred good runs. Fair, but not everything in a few plays.
export const PAY = { coin: 5, finish: { neon: 250 }, firstFinish: { neon: 500 }, scoreDiv: 10 };
export function rideEarnings({ score = 0, coins = 0, finished = false, level = 'arena', firstFinish = false } = {}) {
  const fromScore = Math.round(Math.max(0, score) / PAY.scoreDiv), fromCoins = Math.max(0, coins | 0) * PAY.coin;
  const bonus = finished ? (PAY.finish[level] || 0) + (firstFinish ? PAY.firstFinish[level] || 0 : 0) : 0;
  return { money: fromScore + fromCoins + bonus, fromScore, fromCoins, bonus };
}
const BEST_KEY = level => 'wk-best-' + level;
export function readBest(level) { try { return JSON.parse(localStorage.getItem(BEST_KEY(level)) || 'null'); } catch { return null; } }
export function saveBest(level, run) {
  const old = readBest(level) || {}, next = { ...old, finishes: (old.finishes || 0) + (run.finished ? 1 : 0) };
  if (run.finished && (!(old.time > 0) || run.time < old.time)) next.time = run.time;
  if ((run.coins || 0) > (old.coins || 0)) next.coins = run.coins;
  try { localStorage.setItem(BEST_KEY(level), JSON.stringify(next)); } catch {}
  return { best: next, newTime: run.finished && next.time === run.time && run.time !== old.time, firstFinish: run.finished && !(old.finishes > 0) };
}
export const fmtTime = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
