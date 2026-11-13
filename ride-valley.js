// The Valley (v2.1-60): a locked race track through a pine valley at sunset: a dirt trail on a bank above a river,
// a timber fence and the WHEELIE LIFE signs on the left, cliffs with waterfalls, snowy peaks ahead, wooden kickers.
// Same engine and API as Neon Canal (ride-neon.js): one centre line + one height profile, the bike is held on it.
// Exports keep the Neon names so ride.js can swap tracks; VALLEY is the same object as NEON here.
const STEP = .5;
// [length m, turn deg] — positive turns go toward +z (rider's right, the river side)
const SEGMENTS = [[150, 0], [70, -35], [110, 0], [80, 45], [140, 0], [60, -30], [90, 0], [70, 40], [120, 0], [80, -50], [100, 0], [60, 30], [200, 0]];
export const NEON = { id: 'valley', finish: 1260, len: 0, width: 4.4, loopS: -1, water: -2.4 };
export const VALLEY = NEON;
const pts = [];
{ let x = 0, z = 0, yaw = 0, s = 0; pts.push({ x, z, yaw, k: 0, s });
  for (const [L, deg] of SEGMENTS) { const n = Math.round(L / STEP), k = deg * Math.PI / 180 / L;
    for (let i = 0; i < n; i++) { const y0 = yaw; yaw += k * STEP; const ym = (y0 + yaw) / 2; x += Math.cos(ym) * STEP; z += Math.sin(ym) * STEP; s += STEP; pts.push({ x, z, yaw, k, s }); } }
  NEON.len = s; }
export const NEON_PATH = pts;
const cosr = (u, a, b, h0, h1) => { const t = Math.max(0, Math.min(1, (u - a) / (b - a))); return h0 + (h1 - h0) * (1 - Math.cos(Math.PI * t)) / 2; };
const kick = (u, a, b, h) => { const t = Math.max(0, Math.min(1, (u - a) / (b - a))); return h * (1 - Math.cos(Math.PI / 2 * t)); };
// creek gaps: fall short and you're in the water
export const NEON_GAPS = [[618, 630], [1006, 1018]];
const GAP_SAFE = [585, 965];
// wooden ramps (drawn as timber decks on trestles) [from, to]
export const VALLEY_WOOD = [[104, 116], [304, 316], [604, 618], [630, 652], [818, 830], [994, 1006], [1018, 1046], [1174, 1186]];
export function neonProfile(u) {
  for (const [a, b] of NEON_GAPS) if (u > a && u < b) return NEON.water;
  const roll = (a, b, h, n) => h * (1 - Math.cos(2 * Math.PI * n * (u - a) / (b - a))) / 2;
  if (u < 40) return 0;
  if (u < 80) return roll(40, 80, .35, 3);                                   // trail rollers by the start
  if (u >= 104 && u < 116) return kick(u, 104, 116, 2.0);                       // first wooden kicker (the picture)
  if (u >= 170 && u < 240) return roll(170, 240, .6, 4);                      // root rollers
  if (u >= 280 && u < 300) return cosr(u, 280, 300, 0, .8);
  if (u >= 300 && u < 316) return .8 + kick(u, 300, 316, 2.2);                // step-up kicker on the bank
  if (u >= 316 && u < 345) return cosr(u, 316, 345, .8, 0);                   // roll back down to the trail
  if (u >= 380 && u < 470) return roll(380, 470, .5, 5);
  if (u >= 500 && u < 560) return cosr(u, 500, 560, 0, 1.6);                  // climb to the creek
  if (u >= 560 && u < 600) return 1.6;
  if (u >= 600 && u < 618) return 1.6 + kick(u, 600, 618, 2.6);               // creek gap 1 (wooden)
  if (u >= 630 && u < 652) return cosr(u, 630, 652, 3.4, 1.2);                // wooden landing
  if (u >= 652 && u < 700) return cosr(u, 652, 700, 1.2, 0);
  if (u >= 730 && u < 790) return roll(730, 790, .7, 4);
  if (u >= 818 && u < 830) return kick(u, 818, 830, 2.4);                     // big wooden kicker
  if (u >= 860 && u < 940) return roll(860, 940, .45, 6);                     // whoops
  if (u >= 950 && u < 990) return cosr(u, 950, 990, 0, 1.4);
  if (u >= 990 && u < 1006) return 1.4 + kick(u, 990, 1006, 2.8);             // creek gap 2 (wooden, big)
  if (u >= 1018 && u < 1046) return cosr(u, 1018, 1046, 3.6, 1.0);
  if (u >= 1046 && u < 1080) return cosr(u, 1046, 1080, 1.0, 0);
  if (u >= 1100 && u < 1150) return roll(1100, 1150, .5, 3);
  if (u >= 1174 && u < 1186) return kick(u, 1174, 1186, 2.0);                 // last kicker before the finish
  return 0;
}
const CELL = 12, grid = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
pts.forEach((p, i) => { const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
export function neonProject(x, z, hint = -1) {
  let best = -1, bd = Infinity;
  if (hint >= 0) { const a = Math.max(0, hint - 40), b = Math.min(pts.length - 1, hint + 40); for (let i = a; i <= b; i++) { const p = pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } }
  if (best < 0 || bd > 9) { const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let r = 1; r <= 3 && (best < 0 || bd > (CELL * (r - 1)) ** 2); r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) { const l = grid.get(key(ci + di, cj + dj)); if (l) for (const i of l) { const p = pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } } }
  if (best < 0) { // far from the line: brute force
    for (let i = 0; i < pts.length; i += 4) { const p = pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } }
  const p = pts[best], c = Math.cos(p.yaw), n = Math.sin(p.yaw), along = (x - p.x) * c + (z - p.z) * n, lat = -(x - p.x) * n + (z - p.z) * c;
  const s = Math.max(0, Math.min(NEON.len, p.s + along));
  return { i: best, s, lat, x: p.x + c * along, z: p.z + n * along, yaw: p.yaw, k: p.k, dist: Math.sqrt(bd) };
}
export function neonAt(s) { if (s < 0) { const p = pts[0]; return { x: p.x + Math.cos(p.yaw) * s, z: p.z + Math.sin(p.yaw) * s, yaw: p.yaw, k: 0, i: 0 }; }
  const f = Math.max(0, Math.min(pts.length - 1.001, s / STEP)), i = Math.floor(f), t = f - i, a = pts[i], b = pts[i + 1];
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: a.yaw + (b.yaw - a.yaw) * t, k: a.k, i }; }
export const neonHeight = (x, z) => neonProfile(neonProject(x, z).s);
export function neonSafeS(s) { for (let g = 0; g < NEON_GAPS.length; g++) { const [a, b] = NEON_GAPS[g]; if (s > GAP_SAFE[g] && s < b + 2) return GAP_SAFE[g]; } return s; }
export const neonInGap = s => NEON_GAPS.some(([a, b]) => s > a && s < b);
export const NEON_CHECKPOINTS = [0, 290, 560, 850, 1090];
export const NEON_LOOPS = [];
function buildCoins() {
  const c = [], line = (a, b, step = 3, up = 1) => { for (let s = a; s <= b; s += step) c.push({ s, y: neonProfile(s) + up }); };
  const arc = (a, b, peak) => { const ya = neonProfile(a - .5) + 1.1, yb = neonProfile(b + .5) + 1.1; for (let s = a; s <= b; s += 2.4) { const t = (s - a) / (b - a); c.push({ s, y: ya + (yb - ya) * t + peak * 4 * t * (1 - t) }); } };
  line(14, 36); line(42, 78, 2.6, 1.3); arc(117, 136, 3.2); line(170, 238, 3.5, 1.4); arc(317, 338, 2.8); line(385, 465, 4);
  line(560, 598, 3, 1); arc(619, 632, 2.6); line(700, 790, 4); arc(831, 856, 4.2); line(862, 938, 3.5, 1.2); arc(1007, 1020, 3.2);
  line(1060, 1150, 4); arc(1187, 1206, 3.0); line(1215, 1255, 3);
  return c.map((o, i) => { const p = neonAt(o.s); return { id: i, s: o.s, x: p.x, z: p.z, y: o.y }; });
}
export const NEON_COINS = buildCoins();
export const NEON_FEATURES = { start: 6, signs: [20, 360, 700, 1080], banners: [32, 520, 880, 1230], waterfalls: [70, 470, 760, 1120], crownRocks: [128, 420, 690, 960, 1150], cliffs: [[40, 140], [420, 520], [700, 800], [1080, 1180]] };
export function makeNeonTerrain() {
  const height = (x, z = 0) => neonHeight(x, z), E = .12;
  const slopeAt = (x, z = 0, yaw = 0) => { const c = Math.cos(yaw), n = Math.sin(yaw); return Math.atan2(height(x + c * E, z + n * E) - height(x - c * E, z - n * E), 2 * E); };
  return { pts: [[-50, 0], [NEON.len + 50, 0]], h: x => height(x, 0), slope: x => slopeAt(x, 0, 0), height, terrainHeight: height, slopeAt,
    puddles: [], checkpoints: NEON_CHECKPOINTS, kickers: [], finish: NEON.finish, inPuddle: () => false, freeRoam: true, freeRide: true, playground: true, neon: true, valley: true,
    boxes: [], loops: NEON_LOOPS, posts: [], bounds: { xmin: -400, xmax: 1600, zmin: -1200, zmax: 1200 }, gates: null };
}
// boosts on the run-ups so a pedal bike clears the kickers and creek gaps (the wooden ^^ chevrons)
export const NEON_BOOSTS = [[80, 115, 14], [286, 315, 15], [570, 617, 17], [796, 829, 18], [960, 1005, 19], [1156, 1185, 15]];
export function neonLock(s, dt = 0) {
  if (s.loopRide) return;
  if (dt > 0 && (s.ground?.[0] || s.ground?.[1]) && !s.crashed) for (const [a, b, v] of NEON_BOOSTS) if ((s.trackS || 0) > a && (s.trackS || 0) < b && s.vx < v) { s.vx = Math.min(v, s.vx + 14 * dt); s.boosting = .4; }
  const pr = neonProject(s.x, s.z || 0, s.trackI ?? -1);
  s.trackI = pr.i; s.trackS = pr.s; s.x = pr.x; s.z = pr.z;
  const fwd = pr.yaw; s.yaw = fwd; s.moveYaw = fwd; s.sliding = false; s.slideDir = 0; s.airTwist = false; s.latV = 0; s.vertAir = false;
  const v = s.vx || 0, bank = Math.max(-.55, Math.min(.55, Math.atan(v * v * pr.k / 9.8)));
  s.lean = (s.lean || 0) + (bank - (s.lean || 0)) * .05; s.steer = 0;
}
