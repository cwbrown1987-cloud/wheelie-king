// Neon Canal (v2.1-35): a 1.7 km locked-track level through a graffiti canal district at sunset.
// One centre line (straights and arcs, so it turns) and one height profile along it. The physics is the normal
// free-roam bike, held on the line every step (auto-steered in both views); ter.height(x,z) reads the profile at
// the nearest point of the line. Ramps, kickers, a loop, gaps over the canal, a mega ramp, containers, a rooftop
// drop, rhythm sections and the finish are all features of that profile.
const STEP = .5;
// [length m, turn deg] — positive turns go toward +z (rider's right)
const SEGMENTS = [[175, 0], [65, 75], [160, 0], [80, -100], [130, 0], [45, 50], [45, -50], [200, 0], [100, 120], [60, 0], [60, -60], [210, 0], [90, 90], [300, 0]];
export const NEON = { finish: 1650, len: 0, width: 5.2, loopS: 140, water: -3.2 };
const pts = []; // {x,z,yaw,k,s}
{ let x = 0, z = 0, yaw = 0, s = 0; pts.push({ x, z, yaw, k: 0, s });
  for (const [L, deg] of SEGMENTS) { const n = Math.round(L / STEP), k = deg * Math.PI / 180 / L;
    for (let i = 0; i < n; i++) { const y0 = yaw; yaw += k * STEP; const ym = (y0 + yaw) / 2; x += Math.cos(ym) * STEP; z += Math.sin(ym) * STEP; s += STEP; pts.push({ x, z, yaw, k, s }); } }
  NEON.len = s; }
export const NEON_PATH = pts;
// --- height profile -------------------------------------------------------------------------------------------
const cosr = (u, a, b, h0, h1) => { const t = Math.max(0, Math.min(1, (u - a) / (b - a))); return h0 + (h1 - h0) * (1 - Math.cos(Math.PI * t)) / 2; };
const kick = (u, a, b, h) => { const t = Math.max(0, Math.min(1, (u - a) / (b - a))); return h * (1 - Math.cos(Math.PI / 2 * t)); }; // concave: steep lip
// gaps: [start, end] where the ground falls away into the canal (fall in = splash)
export const NEON_GAPS = [[355, 366], [830, 852], [1306, 1315], [1505, 1522]];
// where RECOVER puts you back for each gap (before its run-up)
const GAP_SAFE = [330, 770, 1290, 1470];
export function neonProfile(u) {
  for (const [a, b] of NEON_GAPS) if (u > a && u < b) return NEON.water;
  if (u < 30) return 0;
  if (u < 60) return .6 * (1 - Math.cos(2 * Math.PI * (u - 30) / 10)) / 2;              // rollers
  if (u >= 70 && u < 82) return kick(u, 70, 82, 1.4);                                     // barrel kicker
  if (u >= 82 && u < 95) return cosr(u, 82, 95, 1.4, 0);
  if (u >= 240 && u < 262) return cosr(u, 240, 262, 0, 4);                                // up onto the canal bridge
  if (u >= 262 && u < 300) return 4;
  if (u >= 300 && u < 320) return cosr(u, 300, 320, 4, 0);
  if (u >= 346 && u < 355) return kick(u, 346, 355, 2.4);                                 // canal gap 1
  if (u >= 366 && u < 395) return cosr(u, 366, 395, 2.2, 0);
  if (u >= 480 && u < 495) return cosr(u, 480, 495, 0, 3);                                // terrace + steps down
  if (u >= 495 && u < 505) return 3;
  if (u >= 505 && u < 525) return 3 - .6 * Math.ceil((u - 505) / 4 - 1e-6);
  if (u >= 560 && u < 568) return kick(u, 560, 568, 1.3);                                 // up onto the containers
  if (u >= 568 && u < 572) return cosr(u, 568, 572, 1.3, 2.6);
  if (u >= 572 && u < 596) return 2.6;
  if (u >= 598 && u < 612) return cosr(u, 598, 612, 1.6, 0);                              // drop off them
  if (u >= 700 && u < 760) return .9 * (1 - Math.cos(2 * Math.PI * (u - 700) / 12)) / 2; // rhythm rollers
  if (u >= 806 && u < 830) return kick(u, 806, 830, 5);                                   // MEGA RAMP over the street
  if (u >= 852 && u < 900) return cosr(u, 852, 900, 4.6, 0);
  if (u >= 1010 && u < 1016) return cosr(u, 1010, 1016, 0, 1.8);                          // tabletops x2
  if (u >= 1016 && u < 1024) return 1.8;
  if (u >= 1024 && u < 1030) return cosr(u, 1024, 1030, 1.8, 0);
  if (u >= 1040 && u < 1046) return cosr(u, 1040, 1046, 0, 1.8);
  if (u >= 1046 && u < 1054) return 1.8;
  if (u >= 1054 && u < 1060) return cosr(u, 1054, 1060, 1.8, 0);
  if (u >= 1120 && u < 1150) return cosr(u, 1120, 1150, 0, 5);                            // rooftop
  if (u >= 1150 && u < 1190) return 5;
  if (u >= 1193 && u < 1218) return cosr(u, 1193, 1218, 3.4, 0);                          // drop off the roof onto a landing
  if (u >= 1296 && u < 1306) return kick(u, 1296, 1306, 1.7);                             // double over the drain
  if (u >= 1315 && u < 1332) return cosr(u, 1315, 1332, 1.6, 0);
  if (u >= 1420 && u < 1480) return .5 * (1 - Math.cos(2 * Math.PI * (u - 1420) / 5)) / 2;// whoops
  if (u >= 1490 && u < 1505) return kick(u, 1490, 1505, 3);                               // final kicker through the neon ring
  if (u >= 1522 && u < 1555) return cosr(u, 1522, 1555, 2.8, 0);
  return 0;
}
// --- nearest point on the line -----------------------------------------------------------------------------
const CELL = 12, grid = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
pts.forEach((p, i) => { const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
export function neonProject(x, z, hint = -1) {
  let best = -1, bd = Infinity;
  if (hint >= 0) { const a = Math.max(0, hint - 40), b = Math.min(pts.length - 1, hint + 40); for (let i = a; i <= b; i++) { const p = pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } }
  if (best < 0 || bd > 9) { const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let r = 1; r <= 3 && (best < 0 || bd > (CELL * (r - 1)) ** 2); r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) { const l = grid.get(key(ci + di, cj + dj)); if (l) for (const i of l) { const p = pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } } }
  if (best < 0) best = 0;
  // refine onto the segment either side
  const p = pts[best], c = Math.cos(p.yaw), n = Math.sin(p.yaw), along = (x - p.x) * c + (z - p.z) * n, lat = -(x - p.x) * n + (z - p.z) * c;
  const s = Math.max(0, Math.min(NEON.len, p.s + along));
  return { i: best, s, lat, x: p.x + c * along, z: p.z + n * along, yaw: p.yaw, k: p.k, dist: Math.sqrt(bd) };
}
export function neonAt(s) { const f = Math.max(0, Math.min(pts.length - 1.001, s / STEP)), i = Math.floor(f), t = f - i, a = pts[i], b = pts[i + 1];
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: a.yaw + (b.yaw - a.yaw) * t, k: a.k, i }; }
export const neonHeight = (x, z) => neonProfile(neonProject(x, z).s);
export function neonSafeS(s) { for (let g = 0; g < NEON_GAPS.length; g++) { const [a, b] = NEON_GAPS[g]; if (s > GAP_SAFE[g] && s < b + 2) return GAP_SAFE[g]; } return s; }
export const neonInGap = s => NEON_GAPS.some(([a, b]) => s > a && s < b);
export const NEON_CHECKPOINTS = [0, 320, 610, 905, 1220, 1420];
// the loop (ride-loop): on the first straight, heading +x along z=0
export const NEON_LOOPS = [{ id: 'neon-loop', x: NEON.loopS, y: 0, z: 0, w: 4.2, radius: 4.5, exitOffset: 3.5, zShift: 0, minSpeed: 5 }];
// --- coins --------------------------------------------------------------------------------------------------
// trails along the ground and arcs over the jumps; ride through one to collect it
function buildCoins() {
  const c = [], line = (a, b, step = 3, up = 1) => { for (let s = a; s <= b; s += step) c.push({ s, y: neonProfile(s) + up }); };
  const arc = (a, b, peak) => { const ya = neonProfile(a - .5) + 1, yb = neonProfile(b + .5) + 1; for (let s = a; s <= b; s += 2.2) { const t = (s - a) / (b - a); c.push({ s, y: ya + (yb - ya) * t + peak * 4 * t * (1 - t) }); } };
  line(12, 28); line(32, 58, 2.5, 1.4); arc(82, 96, 2.2); line(110, 132); line(180, 236, 3.5); line(264, 298, 3.5, 1);
  arc(356, 368, 3.0); line(410, 470, 3.5); line(497, 503, 2.5); arc(573, 595, 1.6); line(620, 690, 4); line(702, 758, 3, 1.3);
  arc(832, 856, 6.0); line(915, 990, 4); arc(1017, 1023, 1.2); arc(1047, 1053, 1.2); line(1152, 1188, 3); arc(1193, 1214, 1.8);
  line(1230, 1290, 4); arc(1307, 1317, 2.2); line(1340, 1410, 4); arc(1506, 1526, 3.8); line(1570, 1640, 3.5);
  return c.map((o, i) => { const p = neonAt(o.s); return { id: i, s: o.s, x: p.x, z: p.z, y: o.y }; });
}
export const NEON_COINS = buildCoins();
// side dressing anchors the visuals use (left wall, right canal fence), and features to decorate
export const NEON_FEATURES = {
  bridge: [262, 300], containers: [572, 596], rooftop: [1150, 1190], mega: [798, 830], megaLand: [860, 905],
  terrace: [495, 525], chevrons: [70, 240, 343, 480, 560, 798, 1120, 1296, 1490], cones: [62, 100, 330, 520, 640, 790, 1000, 1290, 1480, 1600],
  overpasses: [930, 975, 1260], ring: 1518, start: 8,
};
// --- terrain object for the physics (same shape as the Playground's) ---------------------------------------
export function makeNeonTerrain() {
  const height = (x, z = 0) => neonHeight(x, z), E = .12;
  const slopeAt = (x, z = 0, yaw = 0) => { const c = Math.cos(yaw), n = Math.sin(yaw); return Math.atan2(height(x + c * E, z + n * E) - height(x - c * E, z - n * E), 2 * E); };
  return { pts: [[-50, 0], [NEON.len + 50, 0]], h: x => height(x, 0), slope: x => slopeAt(x, 0, 0), height, terrainHeight: height, slopeAt,
    puddles: [], checkpoints: NEON_CHECKPOINTS, kickers: [], finish: NEON.finish, inPuddle: () => false, freeRoam: true, freeRide: true, playground: true, neon: true,
    boxes: [], loops: NEON_LOOPS, posts: [], bounds: { xmin: -200, xmax: 1300, zmin: -300, zmax: 1000 }, gates: null };
}
// Hold the bike on the line: snap onto it, point it along it (it turns for you), lean into the bends for looks.
// Boost pads (the purple chevrons): roll over one on the ground and it pushes you up to its speed, so even a
// pedal bike can make the loop and the gaps. [from s, to s, speed m/s]
export const NEON_BOOSTS = [[10, 26, 13], [98, 120, 16.5], [318, 354, 17], [468, 479, 13], [543, 567, 14.5], [770, 829, 22], [1093, 1149, 15], [1272, 1305, 15], [1458, 1504, 17.5]];
export function neonLock(s, dt = 0) {
  if (s.loopRide) return;
  if (dt > 0 && (s.ground?.[0] || s.ground?.[1]) && !s.crashed) for (const [a, b, v] of NEON_BOOSTS) if ((s.trackS || 0) > a && (s.trackS || 0) < b && s.vx < v) { s.vx = Math.min(v, s.vx + 14 * dt); s.boosting = .4; }
  const pr = neonProject(s.x, s.z || 0, s.trackI ?? -1);
  s.trackI = pr.i; s.trackS = pr.s; s.x = pr.x; s.z = pr.z;
  const fwd = pr.yaw; s.yaw = fwd; s.moveYaw = fwd; s.sliding = false; s.slideDir = 0; s.airTwist = false; s.latV = 0; s.vertAir = false;
  const v = s.vx || 0, bank = Math.max(-.55, Math.min(.55, Math.atan(v * v * pr.k / 9.8)));
  s.lean = (s.lean || 0) + (bank - (s.lean || 0)) * .05; s.steer = 0;
}
