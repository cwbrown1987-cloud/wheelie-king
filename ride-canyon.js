// Playground desert canyon bike track (v2.1-27). A winding sandy canyon with orange rock walls, dead trees,
// dry grass, pebble paths and a dirt bike track down the middle: rollers, tabletops, doubles, a step-up and
// berms on the tight bends. Models: Quaternius "Stylized Nature MegaKit" (Standard, CC0), in
// assets/quaternius/nature/. The ground is one height function (canyonHeight) that physics and visuals share.
export const CANYON = { x0: 300, len: 240, tw: 2.75 };
const ss = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function hash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v; }
// track centre line: z as a function of distance along x
export const canyonPathZ = u => 22 * Math.sin(u / 38) + 9 * Math.sin(u / 15 + 1);
const pathDZ = u => 22 / 38 * Math.cos(u / 38) + 9 / 15 * Math.cos(u / 15 + 1);
const pathDDZ = u => -22 / 1444 * Math.sin(u / 38) - 9 / 225 * Math.sin(u / 15 + 1);
const floorHalf = u => 13 + 3 * Math.sin(u / 23 + 2);
// features along the track. kick: concave ramp up to h (a lip), land: smooth down from h, flat: hold h.
const kick = (u, a, b, h) => h * (1 - Math.cos(Math.PI / 2 * (u - a) / (b - a)));
const land = (u, a, b, h) => h * (1 + Math.cos(Math.PI * (u - a) / (b - a))) / 2;
const rise = (u, a, b, h) => h * (1 - Math.cos(Math.PI * (u - a) / (b - a))) / 2;
export function canyonTrack(u) {
  if (u < 12 || u > 230) return 0;
  if (u < 34) return .45 * (1 - Math.cos(2 * Math.PI * (u - 12) / 5.5)) / 2;            // 4 rollers
  if (u >= 44 && u < 49) return rise(u, 44, 49, 1.5);                                       // tabletop
  if (u >= 49 && u < 55) return 1.5;
  if (u >= 55 && u < 61) return land(u, 55, 61, 1.5);
  if (u >= 72 && u < 76) return kick(u, 72, 76, 1.3);                                       // double (6 m gap)
  if (u >= 78.5 && u < 82) return rise(u, 78.5, 82, 1.3);                                 // back of the landing (case it, don't wall it)
  if (u >= 82 && u < 88) return land(u, 82, 88, 1.3);
  if (u >= 102 && u < 105.5) return kick(u, 102, 105.5, 1.0);                               // step-up
  if (u >= 105.5 && u < 106.8) return .4 + land(u, 105.5, 106.8, .6);                       // shallow gap, then up onto the deck
  if (u >= 106.8 && u < 110.5) return .4 + rise(u, 106.8, 110.5, 1.2);
  if (u >= 110.5 && u < 118) return 1.6;
  if (u >= 118 && u < 125) return land(u, 118, 125, 1.6);
  if (u >= 135 && u < 159) return .6 * (1 - Math.cos(2 * Math.PI * (u - 135) / 6)) / 2;     // rhythm rollers
  if (u >= 167 && u < 175) return kick(u, 167, 175, 3.0);                                   // the big one: 3 m kicker, 11 m table
  if (u >= 175 && u < 186) return 3.0;
  if (u >= 186 && u < 197) return land(u, 186, 197, 3.0);
  if (u >= 204 && u < 209) return kick(u, 204, 209, 2.1);                                   // big double (9 m lip to knuckle)
  if (u >= 211.5 && u < 218) return rise(u, 211.5, 218, 2.1);
  if (u >= 218 && u < 227) return land(u, 218, 227, 2.1);
  return 0;
}
const bankW = h => 1.5 + h * 2.5;
// bounds of the whole canyon block (floor + walls + outer slope back down to the plain)
const OUTER = 46, ZMAX = 31 + 16 + OUTER + 4;
export const inCanyon = (x, z) => x > CANYON.x0 - OUTER - 4 && x < CANYON.x0 + CANYON.len + OUTER + 4 && Math.abs(z) < ZMAX;
// returns {h, track (0..1 how much on the track), wall (0..1), dz (distance from centre line), u}
export function canyonInfo(x, z) {
  const u = x - CANYON.x0, uc = Math.max(0, Math.min(CANYON.len, u)), pz = canyonPathZ(uc), d1 = pathDZ(uc);
  const dzs = (z - pz) / Math.sqrt(1 + d1 * d1), dz = Math.abs(dzs);
  const F = floorHalf(uc), endD = Math.max(0, -u, u - CANYON.len) * 1.6;
  const wallE = Math.max(dz - F, endD - 2), e = wallE;
  // floor: soft dunes away from the track
  const offTrack = ss((dz - CANYON.tw - 1.5) / 4);
  let h = .32 * vnoise(x / 8.5, z / 8.5) * offTrack + .18 * vnoise(x / 3.1 + 50, z / 3.1) * offTrack;
  // the track: features plus berms on tight bends (raised on the outside)
  let track = 0;
  if (u > -2 && u < CANYON.len + 2) {
    const th = canyonTrack(uc), tw = CANYON.tw;
    track = 1 - ss((dz - tw + .3) / 1.2);
    if (th > 0) h = Math.max(h, dz <= tw ? th : th * Math.max(0, 1 - (dz - tw) / bankW(th)));
    const k = pathDDZ(uc) / Math.pow(1 + d1 * d1, 1.5), outside = dzs * k < 0;
    if (outside && Math.abs(k) > .018) { const bh = Math.min(1.3, (Math.abs(k) - .018) * 45); h += bh * ss((dz - .4) / (tw + 1.6)) * (1 - ss((dz - tw - 3) / 3)); }
  }
  // walls: steep sandstone sides with ledges, a plateau on top, then a long slope back down outside
  let wall = 0;
  if (wallE > 0) {
    const W = 11 + 5 * vnoise(x / 28, z / 28), t = ss(wallE / 7), ledge = .07 * Math.sin(t * Math.PI * 5);
    const out = 1 - ss((wallE - 16) / (OUTER - 16));
    const hw = W * Math.min(1, Math.max(0, t + ledge)) * out;
    wall = t * out; h = Math.max(h, hw + h * (1 - t));
  }
  return { h: Math.max(0, h), track, wall, dz, u, e };
}
export const canyonHeight = (x, z) => canyonInfo(x, z).h;

// rings: one by the others near the side track brings you to the start; one at the finish takes you back
export const CANYON_START = { x: CANYON.x0 + 4, z: canyonPathZ(4), yaw: Math.atan(pathDZ(4)), vx: 2 };
export const CANYON_FINISH_RING = { x: CANYON.x0 + 236, z: canyonPathZ(236) };

// Props: deterministic, so posts (collision) and visuals agree.
export const CANYON_MODELS = {
  dead1: 'DeadTree_1', dead2: 'DeadTree_2', dead3: 'DeadTree_3', dead4: 'DeadTree_4', dead5: 'DeadTree_5',
  rock1: 'Rock_Medium_1', rock2: 'Rock_Medium_2', rock3: 'Rock_Medium_3',
  grassT: 'Grass_Wispy_Tall', grassS: 'Grass_Wispy_Short', agave: 'Plant_7', agaveB: 'Plant_7_Big', plant: 'Plant_1',
  peb1: 'Pebble_Round_1', peb2: 'Pebble_Round_2', peb3: 'Pebble_Round_3', peb4: 'Pebble_Square_3',
  pathW: 'RockPath_Round_Wide', pathT: 'RockPath_Round_Thin',
};
function buildCanyonProps() {
  const out = []; let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const C = CANYON, at = (u, off) => { const pz = canyonPathZ(u), d = pathDZ(u), n = Math.sqrt(1 + d * d); return { x: C.x0 + u - off * d / n, z: pz + off / n }; };
  const put = (m, p, s, extra = {}) => out.push({ m, x: p.x, z: p.z, s, rot: rnd() * 6.283, ...extra });
  // cliff boulders lining both walls, their near face about at the foot of the wall
  for (const side of [-1, 1]) for (let u = -14; u < C.len + 14; u += 5 + rnd() * 5) {
    const s = 2.4 + rnd() * 3.2, F = floorHalf(Math.max(0, Math.min(C.len, u))), off = side * (F + 1.5 * s - 1.2 + rnd() * 2);
    put('rock' + (1 + Math.floor(rnd() * 3)), at(u, off), s, { post: 1.35 * s, sink: .25 * s, cliff: true });
    if (rnd() < .55) put('rock' + (1 + Math.floor(rnd() * 3)), at(u + 2, side * (F + 2.6 * s + 3 + rnd() * 6)), s * (1.1 + rnd() * .6), { sink: .35 * s, cliff: true });
  }
  // the ends: a wall of boulders
  for (const u of [-10, C.len + 10]) for (let o = -16; o <= 16; o += 6) put('rock' + (1 + Math.floor(rnd() * 3)), at(u + (rnd() - .5) * 3, o), 3 + rnd() * 2, { sink: .8, cliff: true });
  const floorSpot = (minOff, maxOff) => { const u = 3 + rnd() * (C.len - 6), F = floorHalf(u), side = rnd() < .5 ? -1 : 1; const off = side * (minOff + rnd() * Math.max(0, Math.min(maxOff, F - 1.5) - minOff)); return at(u, off); };
  // dead trees and the odd boulder on the canyon floor, clear of the track
  for (let i = 0; i < 26; i++) put('dead' + (1 + Math.floor(rnd() * 5)), floorSpot(C.tw + 4, 12), .3 + rnd() * .14, { post: .32 });
  for (let i = 0; i < 12; i++) { const s = .45 + rnd() * .6; put('rock' + (1 + Math.floor(rnd() * 3)), floorSpot(C.tw + 4.5, 11), s, { post: 1.4 * s, sink: .15 * s }); }
  // dry grass in clumps, agaves, small plants
  for (let c = 0; c < 46; c++) { const p = floorSpot(C.tw + 1.2, 13); const n = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) put(rnd() < .55 ? 'grassS' : 'grassT', { x: p.x + (rnd() - .5) * 3.5, z: p.z + (rnd() - .5) * 3.5 }, .55 + rnd() * .5); }
  for (let i = 0; i < 22; i++) put(rnd() < .5 ? 'agave' : 'agaveB', floorSpot(C.tw + 1.5, 12), 1 + rnd() * .8);
  for (let i = 0; i < 14; i++) put('plant', floorSpot(C.tw + 2, 12), .8 + rnd() * .5);
  // pebbles scattered along the track edges
  for (let i = 0; i < 160; i++) put('peb' + (1 + Math.floor(rnd() * 4)), floorSpot(C.tw + .4, 7), .8 + rnd() * 1.4);
  // a pebble footpath winding along one side of the floor
  for (let u = 6; u < C.len - 6; u += 1.7) { const off = 7.5 + 2.2 * Math.sin(u / 13); put(Math.floor(u / 1.7) % 2 ? 'pathW' : 'pathT', at(u, off), .75 + rnd() * .2, { rot: Math.atan(pathDZ(u)) + (rnd() - .5) * .6 }); }
  return out.filter(p => !(p.post && !p.cliff && Math.abs(p.z - canyonPathZ(p.x - C.x0)) < C.tw + 3));
}
export const CANYON_PROPS = buildCanyonProps();
export const CANYON_POSTS = CANYON_PROPS.filter(p => p.post).map(p => ({ x: p.x, z: p.z, r: p.post, kind: p.m.startsWith('dead') ? 'tree' : 'boulder', h: canyonHeight(p.x, p.z) + (p.m.startsWith('dead') ? 5 : 2 * p.s) }));

export function makeCanyonVisuals(T, root, GLTFLoader, { lowDetail = false } = {}) {
  const group = new T.Group(); group.name = 'environment:canyon'; root.add(group);
  const res = []; let disposed = false;
  // ground: vertex-coloured sand, dirt track and orange sandstone walls with banded ledges
  const sand = new T.Color('#e9c27f'), sand2 = new T.Color('#d9a965'), dirt = new T.Color('#a86d3c'), rock = new T.Color('#d4813f'), rock2 = new T.Color('#b5642f'), top = new T.Color('#dfb071'), c = new T.Color();
  const colour = (x, z, d) => {
    const n = vnoise(x / 6, z / 6), n2 = vnoise(x / 1.7 + 9, z / 1.7);
    c.copy(sand).lerp(sand2, n * .7 + n2 * .15);
    c.lerp(dirt, d.track * (.85 + .15 * n2));
    if (d.wall > 0) { const band = .5 + .5 * Math.sin(d.h * 2.1 + n * 2); const r = rock.clone().lerp(rock2, band * .6); c.lerp(r, ss(d.wall * 1.6)); if (d.wall > .9) c.lerp(top, ss((d.e - 9) / 5) * .7); }
    return c;
  };
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  if (!lowDetail) { const nm = new T.TextureLoader().load('./assets/ambientcg/Ground054/Ground054_1K-JPG_NormalGL.jpg'); nm.wrapS = nm.wrapT = T.RepeatWrapping; mat.normalMap = nm; mat.normalScale.set(.55, .55); res.push(nm); }
  res.push(mat);
  const grid = (nx, nz, at, sink) => {
    const pos = [], col = [], uv = [], idx = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const [x, z] = at(i, j), d = canyonInfo(x, z); pos.push(x, d.h - (sink ? sink(d) : 0), z); const k = colour(x, z, d); col.push(k.r, k.g, k.b); uv.push(x / 3, -z / 3); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 1, dd = cc + 1; idx.push(a, cc, b, b, cc, dd); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); res.push(g);
    const m = new T.Mesh(g, mat); m.receiveShadow = true; m.castShadow = !lowDetail; group.add(m); return m;
  };
  { // the whole block, coarse; sunk a little under the fine track ribbon so the ribbon always shows
    const C = lowDetail ? 2.5 : 1.5, xa = CANYON.x0 - OUTER - 4, xb = CANYON.x0 + CANYON.len + OUTER + 4, nx = Math.round((xb - xa) / C), nz = Math.round(2 * ZMAX / C);
    grid(nx, nz, (i, j) => [xa + i * C, -ZMAX + j * C], d => d.u > -1 && d.u < CANYON.len + 1 ? (d.dz < 10.5 ? .25 : d.dz < 12 ? .25 * (12 - d.dz) / 1.5 : 0) : 0).name = 'environment:canyon-ground';
  }
  { // fine ribbon along the track: exact jump faces and berms
    const du = lowDetail ? .8 : .5, W = 11, nu = Math.round((CANYON.len + 4) / du), nw = Math.round(2 * W / (lowDetail ? .8 : .5));
    grid(nu, nw, (i, j) => { const u = -2 + i * du, uc = Math.max(0, Math.min(CANYON.len, u)), d = pathDZ(uc), n = Math.sqrt(1 + d * d), off = -W + j * 2 * W / nw; return [CANYON.x0 + u - off * d / n, canyonPathZ(uc) + off / n]; }).name = 'environment:canyon-track';
  }
  // rings' home: a finish flag of stacked pebbles is enough; models load in the background
  const byModel = new Map(); for (const p of CANYON_PROPS) { if (!byModel.has(p.m)) byModel.set(p.m, []); byModel.get(p.m).push(p); }
  const loader = new GLTFLoader(), M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const skipLow = new Set(['peb1', 'peb2', 'peb3', 'peb4', 'grassS']);
  for (const [m, list] of byModel) {
    if (lowDetail && skipLow.has(m)) continue;
    loader.loadAsync('./assets/quaternius/nature/' + CANYON_MODELS[m] + '.gltf').then(g => {
      if (disposed) return; g.scene.updateMatrixWorld(true);
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        const inst = new T.InstancedMesh(o.geometry, o.material, list.length); res.push(o.geometry);
        [].concat(o.material).forEach(mm => { res.push(mm); mm.map && res.push(mm.map); if (mm.alphaTest > 0) mm.side = T.DoubleSide; if (mm.name === 'Grass') mm.color.set('#d8a94e'); if (!m.startsWith('dead') && !m.startsWith('rock')) mm.vertexColors = false; }); // dry golden grass
        list.forEach((p, k) => { Q.setFromAxisAngle(up, p.rot); V.set(p.x, canyonHeight(p.x, p.z) - (p.sink || 0), p.z); S.setScalar(p.s); M.compose(V, Q, S).multiply(o.matrixWorld); inst.setMatrixAt(k, M); });
        inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere();
        const small = m.startsWith('peb') || m.startsWith('path') || m.startsWith('grass');
        inst.castShadow = !lowDetail && !small; inst.receiveShadow = true; inst.name = 'canyon:' + m; group.add(inst);
      });
    }).catch(e => console.warn('[wk] canyon model failed', m, e));
  }
  return { group, dispose() { disposed = true; res.forEach(r => r.dispose?.()); group.removeFromParent(); } };
}
