// Real town (v2.1-15): Korumburra, Victoria, built from open data and placed east of the playground.
//  - ground: real elevation (AWS Terrain Tiles), 4 m grid, relative to the lowest point, faded to the
//    playground floor at the edges;
//  - buildings and roads: OpenStreetMap (ODbL), footprints extruded to their height (tag, levels or type);
//  - physics: buildings are part of the ground height (a 2 m roof grid), so walls stop you and you can
//    land on roofs; roads and paths are ridden on the real slopes.
// Data is baked offline into assets/towns/korumburra (see LICENSES.md). Heights are 0 until it loads.
// v2.1-16: trimmed to the middle of town: Mine Rd, Commercial St, Bridge St, Station St, down to Coal Creek.
export const TOWN = { id: 'korumburra', dir: './assets/towns/korumburra/', x: 1500, z: 0, halfX: 520, halfZ: 720, ring: 100 };
const ss = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
let data = null, terr = null, roofs = null, loading = null;

export function townLoaded() { return !!data; }
export function townData() { return data; }
// Node tests pass a reader; the browser fetches.
export function loadTown(read) {
  if (loading) return loading;
  const get = read || (async (f, bin) => { const r = await fetch(TOWN.dir + f); if (!r.ok) throw Error(f + ' ' + r.status); return bin ? r.arrayBuffer() : r.json(); });
  loading = (async () => {
    const meta = await get('town.json', false);
    const [t, r] = await Promise.all([get(meta.terrain.file, true), get(meta.buildingGrid.file, true)]);
    terr = new Uint16Array(t); roofs = new Uint16Array(r); data = meta; return data;
  })().catch(e => { loading = null; throw e; });
  return loading;
}
function grid(arr, g, lx, lz) {
  const fi = (lx + g.halfX) / g.step, fj = (lz + g.halfZ) / g.step;
  if (fi < 0 || fj < 0 || fi >= g.nx - 1 || fj >= g.nz - 1) return 0;
  const i = fi | 0, j = fj | 0, fx = fi - i, fy = fj - j, n = g.nx;
  const a = arr[j * n + i], b = arr[j * n + i + 1], c = arr[(j + 1) * n + i], d = arr[(j + 1) * n + i + 1];
  return (a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy) * g.unit;
}
function edge(lx, lz) { const R = TOWN.ring; return Math.min(1 - ss((Math.abs(lx) - TOWN.halfX + R) / R), 1 - ss((Math.abs(lz) - TOWN.halfZ + R) / R)); }
const outside = (lx, lz) => Math.abs(lx) >= TOWN.halfX || Math.abs(lz) >= TOWN.halfZ;
// ground only (no buildings), in world coordinates
export function townGround(x, z) {
  if (!data) return 0; const lx = x - TOWN.x, lz = z - TOWN.z;
  if (outside(lx, lz)) return 0;
  return grid(terr, data.terrain, lx, lz) * edge(lx, lz);
}
export function townHeight(x, z) {
  if (!data) return 0; const lx = x - TOWN.x, lz = z - TOWN.z;
  if (outside(lx, lz)) return 0;
  const e = edge(lx, lz), g = grid(terr, data.terrain, lx, lz) * e;
  const bg = data.buildingGrid; if (Math.abs(lx) >= bg.halfX || Math.abs(lz) >= bg.halfZ) return g;
  // roof grid: blend only between building cells so a wall stays a wall
  const fi = (lx + bg.halfX) / bg.step, fj = (lz + bg.halfZ) / bg.step, i = fi | 0, j = fj | 0, n = bg.nx;
  const k = [roofs[j * n + i], roofs[j * n + i + 1], roofs[(j + 1) * n + i], roofs[(j + 1) * n + i + 1]];
  if (!(k[0] | k[1] | k[2] | k[3])) return g;
  const fx = fi - i, fy = fj - j, w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  let roof = 0, ws = 0; for (let q = 0; q < 4; q++) if (k[q]) { roof += k[q] * w[q]; ws += w[q]; }
  if (ws < 0.5) return g; // mostly outside the footprint
  return Math.max(g, roof / ws * bg.unit * e);
}
// Where the teleport puts you: on Commercial St (the main street) near the middle, heading along it.
let arrival = null;
export function townArrival() {
  if (!data) return { x: TOWN.x, z: TOWN.z, yaw: 0 };
  if (arrival) return arrival;
  let best = null;
  const cs = data.roads.filter(r => /^Commercial Street$/.test(r.n)), pts = cs.flatMap(r => r.p), mid = pts.length ? pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]) : [0, 0];
  for (const r of (cs.length ? cs : data.roads)) { if (!cs.length && !/primary|secondary|tertiary|trunk/.test(r.t)) continue;
    for (let i = 0; i < r.p.length - 1; i++) { const [x, z] = r.p[i], d = Math.hypot(x - mid[0], z - mid[1]); if (!best || d < best.d) { const [x2, z2] = r.p[i + 1]; best = { d, x, z, yaw: Math.atan2(z2 - z, x2 - x) }; } } }
  return (arrival = best ? { x: TOWN.x + best.x, z: TOWN.z + best.z, yaw: best.yaw } : { x: TOWN.x, z: TOWN.z, yaw: 0 });
}

// ---- visuals ----
function windowTexture(T) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#dcd6cc'; for (let y = 0; y < 256; y += 8) g.fillRect(0, y, 256, 1); // render lines
  g.fillStyle = '#3d4a58'; g.fillRect(40, 70, 70, 90); g.fillRect(150, 70, 70, 90);           // two windows per bay
  g.fillStyle = '#9fb3c6'; g.fillRect(44, 74, 30, 40); g.fillRect(154, 74, 30, 40);           // sky reflection
  g.fillStyle = '#efe9df'; g.fillRect(36, 160, 78, 8); g.fillRect(146, 160, 78, 8);           // sills
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
}
const WALLS = ['#d8c7a8', '#c9b49a', '#e3dccf', '#b8a48c', '#cfc2b0', '#a8846a', '#e8e1d2', '#b9b2a4', '#c4a27f', '#9c7a62'];
const ROOFS = ['#5a5f66', '#6b4a3c', '#7a7f86', '#4c5257', '#8a5a44', '#9aa0a6'];

export function makeTownVisuals(T, root, splatMaterial, { lowDetail = false } = {}) {
  const group = new T.Group(); group.name = 'environment:town:' + TOWN.id; root.add(group);
  const res = []; let disposed = false;
  loadTown().then(() => {
    if (disposed) return;
    const D = data;
    // ground mesh from the 4 m elevation grid (+ fade skirt), splat painted: grass, worn verges
    const S = lowDetail ? 8 : 4, nx = Math.round(2 * TOWN.halfX / S) + 1, nz = Math.round(2 * TOWN.halfZ / S) + 1, pos = new Float32Array(nx * nz * 3), spl = new Float32Array(nx * nz * 4), idx = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = TOWN.x - TOWN.halfX + i * S, z = TOWN.z - TOWN.halfZ + j * S, o = j * nx + i; pos.set([x, townGround(x, z) - 0.03, z], o * 3); spl.set([0.9, 0.06, 0, 0.02], o * 4); }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
    const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.BufferAttribute(pos, 3)); gg.setAttribute('splat', new T.BufferAttribute(spl, 4)); gg.setIndex(idx); gg.computeVertexNormals(); res.push(gg);
    const ground = new T.Mesh(gg, splatMaterial); ground.receiveShadow = true; ground.name = 'town:ground'; group.add(ground);
    // roads: ribbons draped on the ground every ~3 m
    const rp = [], rc = [], ri = [];
    const roadCol = t => /footway|path|steps|cycleway|pedestrian/.test(t) ? [0.62, 0.6, 0.56] : /track/.test(t) ? [0.5, 0.42, 0.32] : [0.07, 0.075, 0.08];
    for (const r of D.roads) {
      const col = roadCol(r.t), hw = r.w / 2, lift = /footway|path|steps|cycleway/.test(r.t) ? 0.05 : 0.04;
      const pts = []; for (let i = 0; i < r.p.length - 1; i++) { const [x0, z0] = r.p[i], [x1, z1] = r.p[i + 1], L = Math.hypot(x1 - x0, z1 - z0), m = Math.max(1, Math.ceil(L / 3)); for (let k = 0; k < m; k++) pts.push([x0 + (x1 - x0) * k / m, z0 + (z1 - z0) * k / m]); }
      pts.push(r.p[r.p.length - 1]);
      const base = rp.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const [px, pz] = pts[i], [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
        let dx = bx - ax, dz = bz - az; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        for (const sd of [-1, 1]) { const x = TOWN.x + px - dz * hw * sd, z = TOWN.z + pz + dx * hw * sd; rp.push(x, townGround(x, z) + lift, z); rc.push(...col); }
        if (i) { const a = base + (i - 1) * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
    }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rp, 3)); rg.setAttribute('color', new T.Float32BufferAttribute(rc, 3)); rg.setIndex(ri); rg.computeVertexNormals(); res.push(rg);
    const rm = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: T.DoubleSide }); res.push(rm);
    const roads = new T.Mesh(rg, rm); roads.receiveShadow = true; roads.name = 'town:roads'; group.add(roads);
    // buildings: walls (window texture, tinted) + flat roofs, one geometry each
    const wp = [], wu = [], wc = [], wi = [], fp = [], fc = [], fi = [];
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const b of D.buildings) {
      let p = b.p; if (p.length < 3) continue;
      let area = 0; for (let i = 0; i < p.length; i++) { const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % p.length]; area += x0 * z1 - x1 * z0; }
      if (area < 0) p = [...p].reverse();
      const y0 = b.y - 1.5, y1 = b.y + b.h, wcol = new T.Color(WALLS[(rnd() * WALLS.length) | 0]), rcol = new T.Color(ROOFS[(rnd() * ROOFS.length) | 0]);
      let u = 0;
      for (let i = 0; i < p.length; i++) {
        const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % p.length], L = Math.hypot(x1 - x0, z1 - z0), v0 = wp.length / 3;
        const X0 = TOWN.x + x0, Z0 = TOWN.z + z0, X1 = TOWN.x + x1, Z1 = TOWN.z + z1;
        wp.push(X0, y0, Z0, X1, y0, Z1, X1, y1, Z1, X0, y1, Z0);
        const ub = u / 3.2, ue = (u + L) / 3.2, vb = (y0 - b.y) / 3.2, ve = (y1 - b.y) / 3.2; u += L;
        wu.push(ub, vb, ue, vb, ue, ve, ub, ve);
        for (let k = 0; k < 4; k++) wc.push(wcol.r, wcol.g, wcol.b);
        wi.push(v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2);
      }
      const contour = p.map(([x, z]) => new T.Vector2(x, z)), tris = T.ShapeUtils.triangulateShape(contour, []), r0 = fp.length / 3;
      for (const [x, z] of p) { fp.push(TOWN.x + x, y1, TOWN.z + z); fc.push(rcol.r, rcol.g, rcol.b); }
      for (const [a, b2, c] of tris) fi.push(r0 + a, r0 + c, r0 + b2);
    }
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wp, 3)); wg.setAttribute('uv', new T.Float32BufferAttribute(wu, 2)); wg.setAttribute('color', new T.Float32BufferAttribute(wc, 3)); wg.setIndex(wi); wg.computeVertexNormals(); res.push(wg);
    const tex = windowTexture(T); if (tex) res.push(tex);
    const wm = new T.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.85, metalness: 0, side: T.DoubleSide }); res.push(wm);
    const walls = new T.Mesh(wg, wm); walls.castShadow = !lowDetail; walls.receiveShadow = true; walls.name = 'town:walls'; group.add(walls);
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(fp, 3)); fg.setAttribute('color', new T.Float32BufferAttribute(fc, 3)); fg.setIndex(fi); fg.computeVertexNormals(); res.push(fg);
    const fm = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1, side: T.DoubleSide }); res.push(fm);
    const roofsM = new T.Mesh(fg, fm); roofsM.castShadow = !lowDetail; roofsM.name = 'town:roofs'; group.add(roofsM);
    // welcome sign with the map credit at the arrival point
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#1d5a35'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(8, 8, 496, 240);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 64px sans-serif'; g.fillText('KORUMBURRA', 256, 110);
      g.font = '24px sans-serif'; g.fillText('Map data © OpenStreetMap contributors', 256, 175); g.fillText('Elevation: AWS Terrain Tiles', 256, 208);
      const st = new T.CanvasTexture(c); st.colorSpace = T.SRGBColorSpace; res.push(st);
      const sm = new T.MeshStandardMaterial({ map: st, roughness: 0.6, side: T.DoubleSide }); res.push(sm);
      const a = townArrival(), sign = new T.Mesh(new T.PlaneGeometry(4, 2), sm); res.push(sign.geometry);
      const sx = a.x + Math.cos(a.yaw) * 10 - Math.sin(a.yaw) * 7, sz = a.z + Math.sin(a.yaw) * 10 + Math.cos(a.yaw) * 7;
      sign.position.set(sx, townGround(sx, sz) + 2.2, sz); sign.rotation.y = -a.yaw - Math.PI / 2; group.add(sign);
    }
  }).catch(e => console.warn('[wk] town failed to load', e));
  return { group, dispose() { disposed = true; res.forEach(r => r.dispose?.()); group.removeFromParent(); } };
}
