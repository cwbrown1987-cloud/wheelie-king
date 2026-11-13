// The Valley visuals (v2.1-60): built to match Chris's reference screenshot. A packed-dirt trail on a grassy bank,
// timber fence and WHEELIE LIFE signs on the left, mossy cliffs with waterfalls, a river on the right, pine forest,
// forested hills and snowy peaks catching the low sun, timber kickers with painted ^^ chevrons, star coins.
// Ground uses the Playground's splat material (ambientCG layers + height blend), plants and rocks the shared
// foliage system (Quaternius + Poly Haven), grass the GPU grass field.
import { GLTFLoader as GLTF } from './vendor/GLTFLoader.js';
import { NEON as V, NEON_PATH, NEON_GAPS, NEON_COINS, NEON_FEATURES as F, VALLEY_WOOD, NEON_BOOSTS, neonProfile, neonAt, neonProject, neonInGap } from './ride-valley.js';
import { makeSplatMaterial } from './ride-ground.js';
import { makeFoliageVisuals, makeBlobShadows, styleGrade } from './ride-foliage.js';
import { makeGrassField } from './ride-grass.js';
const TAU = Math.PI * 2;
function rng(seed) { let r = seed; return () => (r = (r * 16807) % 2147483647) / 2147483647; }
function hash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v; }
const fbm = (x, z, o = 4) => { let a = 0, f = 1, w = .5, t = 0; for (let i = 0; i < o; i++) { a += vnoise(x * f, z * f) * w; t += w; f *= 2.03; w *= .5; } return a / t; };
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function canvasTex(T, w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
// ---- the land: one height function for terrain, plants and props ------------------------------------------
const HALF = V.width / 2, WATER = -1.45;
const woodAt = s => VALLEY_WOOD.find(([a, b]) => s >= a - .5 && s <= b + .5);
// ground under the trail: the profile, but bridged straight across timber ramps and creek gaps
export function groundBase(s) {
  const w = woodAt(s) || NEON_GAPS.find(([a, b]) => s >= a && s <= b);
  if (!w) return neonProfile(s);
  // a run of wood/gap that touches other wood/gap: bridge the whole run
  let a = w[0], b = w[1]; for (let k = 0; k < 4; k++) for (const r of [...VALLEY_WOOD, ...NEON_GAPS]) { if (r[1] >= a - 1 && r[0] <= a) a = Math.min(a, r[0]); if (r[0] <= b + 1 && r[1] >= b) b = Math.max(b, r[1]); }
  const ha = neonProfile(a - 1), hb = neonProfile(b + 1), t = (s - a) / (b - a); return ha + (hb - ha) * t;
}
const creeks = NEON_GAPS.map(([a, b]) => ({ s: (a + b) / 2, half: (b - a) / 2 + 1.5 }));
function cliffAmt(s) { let m = 0; for (const [a, b] of F.cliffs) m = Math.max(m, ss(a - 25, a, s) * (1 - ss(b, b + 25, s))); return m; }
export function terrainAt(x, z) {
  const pr = neonProject(x, z), lat = pr.lat, s = pr.s, ext = s <= 0 ? Math.max(0, -((x - NEON_PATH[0].x) * Math.cos(NEON_PATH[0].yaw) + (z - NEON_PATH[0].z) * Math.sin(NEON_PATH[0].yaw))) : 0;
  const base = groundBase(Math.max(0, Math.min(V.len, s))) - .06, n = fbm(x * .02, z * .02), n2 = fbm(x * .07 + 9, z * .07);
  let h;
  if (lat <= 0) { // left: grassy verge, then the hillside, cliffs where the features are
    const d = -lat - HALF - .4; if (d <= 0) h = base;
    else { const c = cliffAmt(s); h = base + d * .035 + n2 * Math.min(1, d / 8) * .7 + Math.max(0, d - 28) * (.1 + .14 * n) + Math.max(0, d - 70) * (.35 + .4 * n); void c; } /* meadow behind the fence, rising slowly into forest (cliffs are separate rock meshes) */
  } else { // right: bank down to the river, far bank rising into forest
    const d = lat - HALF - .4; if (d <= 0) h = base;
    else if (d < 1.6) h = base - 1.5 * ss(0, 1.6, d) + n2 * .2;
    else if (d < 5) h = base - 1.5 + (WATER - .7 - base + 1.5) * ss(1.6, 5, d) + n2 * .3;
    else if (d < 20) h = WATER - .7 - n2 * .4;
    else h = WATER - .7 + (d - 20) * (.06 + .06 * n) + Math.max(0, d - 60) * (.2 + .3 * n) + n2 * 1.2;
  }
  // creeks cut across under the gaps from the hillside to the river
  for (const c of creeks) { const ds = Math.abs(s - c.s); if (ds < c.half + 4) { const k = 1 - ss(c.half, c.half + 4, ds); h = h * (1 - k) + (WATER - .8 + Math.max(0, -lat - 30) * .3) * k; } }
  if (ext > 0) h += 0; return h;
}
export function makeValleyWorld(T, root, { lowDetail = false, quality = 'high', GLTFLoader = GLTF } = {}) {
  const group = new T.Group(); group.name = 'environment:valley'; root.add(group); const res = [], keep = o => (res.push(o), o);
  const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), Vv = new T.Vector3(), S = new T.Vector3(1, 1, 1);
  const P = NEON_PATH, N = P.length, W = V.width;
  const frame = s => { const p = neonAt(s), c = Math.cos(p.yaw), n = Math.sin(p.yaw); return { x: p.x, z: p.z, yaw: p.yaw, nx: -n, nz: c, h: neonProfile(Math.max(0, s)), s }; }; // (nx,nz) points to the rider's right (river)
  const off = (f, lat, y) => [f.x + f.nx * lat, y, f.z + f.nz * lat];
  const quadStrip = (B, a0, a1, b0, b1) => { const k = B.pos.length / 3; B.pos.push(...a0, ...a1, ...b0, ...b1); B.idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); };
  // ---- baked height grid (fast lookups for grass, plants, props) ----
  let xmin = 1e9, xmax = -1e9, zmin = 1e9, zmax = -1e9; for (const p of P) { xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z); }
  const MARGIN = 150, GX0 = xmin - MARGIN, GZ0 = zmin - MARGIN, GS = lowDetail ? 4 : 3, GW = Math.ceil((xmax - xmin + 2 * MARGIN) / GS) + 1, GH = Math.ceil((zmax - zmin + 2 * MARGIN) / GS) + 1;
  const HG = new Float32Array(GW * GH), LAT = new Float32Array(GW * GH), SS = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = GX0 + i * GS, z = GZ0 + j * GS, k = j * GW + i; HG[k] = terrainAt(x, z); const pr = neonProject(x, z); LAT[k] = pr.lat; SS[k] = pr.s; }
  const sample = (A, x, z) => { const fx = Math.max(0, Math.min(GW - 1.001, (x - GX0) / GS)), fz = Math.max(0, Math.min(GH - 1.001, (z - GZ0) / GS)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * GW + i;
    return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + GW] * (1 - u) + A[k + GW + 1] * u) * v; };
  const hAt = (x, z) => { const pr = Math.abs(sample(LAT, x, z)); return pr < HALF + .5 ? groundBase(Math.max(0, Math.min(V.len, sample(SS, x, z)))) - .06 : sample(HG, x, z); };
  // ---- terrain mesh with splat weights (grass, dirt, rock, mud) ----
  const splat = makeSplatMaterial(T, { lowDetail, quality }), smat = splat.material; res.push(splat);
  { const pos = new Float32Array(GW * GH * 3), spl = new Float32Array(GW * GH * 4), idx = [];
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const k = j * GW + i, x = GX0 + i * GS, z = GZ0 + j * GS, h = HG[k]; pos.set([x, h, z], k * 3);
      const gx = (HG[j * GW + Math.min(GW - 1, i + 1)] - HG[j * GW + Math.max(0, i - 1)]) / (2 * GS), gz = (HG[Math.min(GH - 1, j + 1) * GW + i] - HG[Math.max(0, j - 1) * GW + i]) / (2 * GS), sl = Math.hypot(gx, gz), lat = LAT[k];
      let rock = ss(.55, .95, sl), dirt = (1 - ss(HALF + .3, HALF + 2.2, Math.abs(lat))) + (lat > 0 ? ss(HALF + 1, HALF + 3, lat) * (1 - ss(HALF + 5, HALF + 9, lat)) * .7 : 0), mud = h < WATER + .5 ? ss(WATER + .5, WATER - .2, h) : 0;
      dirt = Math.min(1, dirt) * (1 - rock); mud *= (1 - rock); const grass = Math.max(0, 1 - rock - dirt - mud); spl.set([grass, dirt, rock, mud], k * 4); }
    for (let j = 0; j < GH - 1; j++) for (let i = 0; i < GW - 1; i++) { const a = j * GW + i, b = a + 1, c = a + GW, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('splat', new T.BufferAttribute(spl, 4)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, smat); m.receiveShadow = true; m.name = 'valley:terrain'; group.add(m); }
  // ---- the trail: a fine dirt ribbon on the profile (skips timber and gaps) ----
  { const pos = [], spl = [], idx = []; const step = .5, cols = 8;
    for (let s = -40; s <= V.len + 30; s += step) { const f = frame(s), onWood = woodAt(s) || neonInGap(s); const row = pos.length / 3;
      for (let c = 0; c <= cols; c++) { const t = c / cols, lat = (t - .5) * (W + 1.6), edge = Math.abs(t - .5) * 2, y = (onWood ? groundBase(s) - .06 : f.h) + .025 - Math.pow(edge, 4) * .05;
        pos.push(...off(f, lat, y)); const rut = Math.exp(-Math.pow((Math.abs(lat) - .55) / .22, 2)) * .5; spl.push(ss(.75, 1, edge) * .9, 1 - ss(.75, 1, edge) * .9 - rut * 0, 0, rut); }
      if (s > -40) for (let c = 0; c < cols; c++) { const a = row - cols - 1 + c, b = row + c; idx.push(a, b, a + 1, a + 1, b, b + 1); } }
    const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('splat', new T.Float32BufferAttribute(spl, 4)); g.setIndex(idx); g.computeVertexNormals();
    const tsplat = makeSplatMaterial(T, { lowDetail, quality }); res.push(tsplat); tsplat.material.color.set('#cf7a48'); const m = new T.Mesh(g, tsplat.material); m.receiveShadow = true; m.name = 'valley:trail'; group.add(m); }
  // ---- timber: wood texture, kickers on trestles with painted chevrons ----
  const woodTex = keep(canvasTex(T, 256, 512, (g, w, h) => { const r = rng(5); g.fillStyle = '#b89a72'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${60 + r() * 50},${35 + r() * 30},${15 + r() * 20},${.15 + r() * .3})`; g.lineWidth = 1 + r() * 3; g.beginPath(); const x = r() * w; g.moveTo(x, 0); for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * .02 + i) * 6 + (r() - .5) * 3, y); g.stroke(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(50,28,12,.55)'; g.beginPath(); g.ellipse(r() * w, r() * h, 5 + r() * 6, 9 + r() * 10, 0, 0, TAU); g.fill(); } }, { repeat: true }));
  const woodMat = keep(new T.MeshStandardMaterial({ map: woodTex, color: '#e8d6bc', roughness: .78, metalness: 0 })), darkWood = keep(new T.MeshStandardMaterial({ map: woodTex, color: '#a07a56', roughness: .85 }));
  const boxGeo = keep(new T.BoxGeometry(1, 1, 1));
  const planks = [], beams = [];
  for (const [a, b] of VALLEY_WOOD) {
    for (let s = a; s <= b; s += .3) { const f = frame(s), h0 = neonProfile(s - .15), h1 = neonProfile(s + .15), pitch = Math.atan2(h1 - h0, .3); planks.push({ x: f.x, y: neonProfile(s) - .03, z: f.z, yaw: f.yaw, pitch, sx: .27, sy: .06, sz: W + .2, tint: .85 + ((s * 7.3) % 1) * .25 }); }
    for (const side of [-1, 1]) for (let s = a; s < b; s += .8) { const f0 = frame(s), f1 = frame(Math.min(b, s + .8)), y0 = neonProfile(s) - .12, y1 = neonProfile(Math.min(b, s + .8)) - .12, dx = f1.x - f0.x, dz = f1.z - f0.z, len = Math.hypot(dx, dz, y1 - y0);
      const [px, , pz] = off({ x: (f0.x + f1.x) / 2, z: (f0.z + f1.z) / 2, nx: f0.nx, nz: f0.nz }, side * (W / 2 + .05), 0); beams.push({ x: px, y: (y0 + y1) / 2, z: pz, yaw: f0.yaw, pitch: Math.atan2(y1 - y0, Math.hypot(dx, dz)), sx: len + .02, sy: .22, sz: .12 }); }
    for (let s = a + .4; s < b; s += 1.6) { const f = frame(s), top = neonProfile(s) - .15, g0 = groundBase(s) - .3; if (top - g0 < .2) continue;
      for (const side of [-1, 1]) { const [px, , pz] = off(f, side * (W / 2 - .1), 0); beams.push({ x: px, y: (top + g0) / 2, z: pz, yaw: f.yaw, pitch: 0, sx: .16, sy: top - g0, sz: .16 }); }
      const [cx, , cz] = off(f, 0, 0); beams.push({ x: cx, y: top - .08, z: cz, yaw: f.yaw + Math.PI / 2, pitch: 0, sx: W, sy: .14, sz: .14 });
      if (top - g0 > 1) { const f2 = frame(s + 1.6), t2 = neonProfile(s + 1.6) - .15; for (const side of [-1, 1]) { const [px, , pz] = off(f, side * (W / 2 - .05), 0), [qx, , qz] = off(f2, side * (W / 2 - .05), 0), dy = (t2 - g0) * .8, dl = Math.hypot(qx - px, qz - pz);
        beams.push({ x: (px + qx) / 2, y: g0 + (top - g0) * .2 + dy / 2, z: (pz + qz) / 2, yaw: f.yaw, pitch: Math.atan2(dy, dl), sx: Math.hypot(dl, dy), sy: .1, sz: .1 }); } } }
  }
  const placeBoxes = (list, mat, name) => { if (!list.length) return null; const inst = new T.InstancedMesh(boxGeo, mat, list.length), col = new T.Color();
    list.forEach((b, k) => { E.set(0, -b.yaw, b.pitch, 'YXZ'); Q.setFromEuler(E); M.compose(Vv.set(b.x, b.y, b.z), Q, S.set(b.sx, b.sy, b.sz)); inst.setMatrixAt(k, M); if (b.tint) inst.setColorAt(k, col.setScalar(b.tint)); });
    S.set(1, 1, 1); inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; inst.computeBoundingSphere(); inst.castShadow = !lowDetail; inst.receiveShadow = true; inst.name = name; group.add(inst); return inst; };
  placeBoxes(planks, woodMat, 'valley:ramp-deck'); placeBoxes(beams, darkWood, 'valley:ramp-frame');
  // white ^^ painted on each kicker face
  { const chevTex = keep(canvasTex(T, 256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.lineWidth = 30; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.92)'; for (const y of [85, 170]) { g.beginPath(); g.moveTo(45, y + 45); g.lineTo(128, y - 30); g.lineTo(211, y + 45); g.stroke(); } }));
    const cm = keep(new T.MeshStandardMaterial({ map: chevTex, transparent: true, depthWrite: false, roughness: .7, polygonOffset: true, polygonOffsetFactor: -3 })), cg = keep(new T.PlaneGeometry(2.2, 2.2)), list = [];
    for (const [a, b] of VALLEY_WOOD) { const h0 = neonProfile(a + 1), h1 = neonProfile(b - 1); if (h1 - h0 < .6) continue; const s = a + (b - a) * .55; list.push(s); }
    const inst = new T.InstancedMesh(cg, cm, list.length); list.forEach((s, k) => { const f = frame(s), h0 = neonProfile(s - .5), h1 = neonProfile(s + .5), pitch = Math.atan2(h1 - h0, 1);
      const q1 = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -f.yaw - Math.PI / 2), q2 = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2 + pitch); Q.copy(q1).multiply(q2); M.compose(Vv.set(f.x, neonProfile(s) + .03, f.z), Q, S); inst.setMatrixAt(k, M); });
    inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.renderOrder = 2; inst.name = 'valley:chevrons'; group.add(inst); }
  // ---- fence on the left, post and two rails, following the ground ----
  { const posts = [], rails = [], r = rng(31), FL = -(HALF + 1.05);
    let prev = null; for (let s = -38; s < V.len + 25; s += 2.4) { if (woodAt(s) || NEON_GAPS.some(([a, b]) => s > a - 3 && s < b + 3)) { prev = null; continue; }
      const f = frame(s), [x, , z] = off(f, FL, 0), y = hAt(x, z); const tilt = (r() - .5) * .06; posts.push({ x, y: y + .55, z, yaw: f.yaw, pitch: tilt, sx: .13, sy: 1.15, sz: .13, tint: .8 + r() * .3 });
      if (prev) for (const ry of [.45, .92]) { const dx = x - prev.x, dz = z - prev.z, dy = y - prev.y, len = Math.hypot(dx, dz); rails.push({ x: (x + prev.x) / 2, y: (y + prev.y) / 2 + ry, z: (z + prev.z) / 2, yaw: -Math.atan2(dz, dx), pitch: Math.atan2(dy, len), sx: len + .1, sy: .1, sz: .06, tint: .8 + r() * .3 }); }
      prev = { x, y, z }; }
    for (const b of rails) b.yaw = -b.yaw; // placeBoxes negates yaw
    placeBoxes(posts, darkWood, 'valley:fence-posts'); placeBoxes(rails, woodMat, 'valley:fence-rails'); }
  // ---- WHEELIE LIFE signs and crown banners ----
  const signTex = keep(canvasTex(T, 1024, 512, (g, w, h) => { const r = rng(8);
    for (let i = 0; i < 4; i++) { const y = 60 + i * 105; const gr = g.createLinearGradient(0, y, 0, y + 100); gr.addColorStop(0, '#8a5a32'); gr.addColorStop(1, '#6a4224'); g.fillStyle = gr; g.fillRect(30 + r() * 10, y, w - 60 - r() * 10, 98);
      for (let k = 0; k < 30; k++) { g.strokeStyle = `rgba(40,20,8,${.15 + r() * .25})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const yy = y + r() * 98; g.moveTo(30, yy); g.bezierCurveTo(300, yy + (r() - .5) * 8, 700, yy + (r() - .5) * 8, w - 30, yy); g.stroke(); }
      g.fillStyle = '#3a2410'; for (const xx of [70, w - 70]) { g.beginPath(); g.arc(xx, y + 50, 7, 0, TAU); g.fill(); } }
    const word = (txt, y, size, fill) => { g.font = `900 ${size}px Impact, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(w / 2, y); g.rotate(-.03);
      g.lineJoin = 'round'; g.lineWidth = size * .2; g.strokeStyle = '#2a1608'; g.strokeText(txt, 4, 6); g.lineWidth = size * .12; g.strokeStyle = '#3d2410'; g.strokeText(txt, 0, 0); const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, fill[0]); gr.addColorStop(1, fill[1]); g.fillStyle = gr; g.fillText(txt, 0, 0);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-size * 1.6, -size * .32, size * 3.2, size * .06); g.restore(); };
    word('WHEELIE', 175, 190, ['#fff1e6', '#f2b8c6']); word('LIFE', 365, 200, ['#ffd25a', '#ff8a1e']); }));
  const crownTex = keep(canvasTex(T, 256, 192, (g, w, h) => { const cx = w / 2, cy = 110, s = 90; g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#3a2208';
    const path = () => { g.beginPath(); g.moveTo(cx - s, cy + s * .5); g.lineTo(cx - s * 1.05, cy - s * .5); g.lineTo(cx - s * .5, cy); g.lineTo(cx, cy - s * .8); g.lineTo(cx + s * .5, cy); g.lineTo(cx + s * 1.05, cy - s * .5); g.lineTo(cx + s, cy + s * .5); g.closePath(); };
    path(); g.stroke(); const gr = g.createLinearGradient(0, cy - s, 0, cy + s * .6); gr.addColorStop(0, '#ffe58a'); gr.addColorStop(1, '#d8941e'); g.fillStyle = gr; path(); g.fill(); g.fillStyle = '#fff6c0'; for (const dx of [-1.05, 0, 1.05]) { g.beginPath(); g.arc(cx + dx * s, cy - (dx ? s * .55 : s * .85), 11, 0, TAU); g.fill(); } }));
  const signMat = keep(new T.MeshStandardMaterial({ map: signTex, transparent: true, alphaTest: .5, roughness: .8, side: T.DoubleSide })), crownMat = keep(new T.MeshStandardMaterial({ map: crownTex, transparent: true, alphaTest: .4, roughness: .45, metalness: .5, emissive: '#3a2400', side: T.DoubleSide }));
  const signs = new T.Group(); group.add(signs);
  for (const s of F.signs) { const f = frame(s), [x, , z] = off(f, -(HALF + 2.4), 0), y = hAt(x, z), gS = new T.Group(); gS.position.set(x, y, z); gS.rotation.y = -f.yaw - .25; signs.add(gS);
    const board = new T.Mesh(keep(new T.PlaneGeometry(3.2, 1.6)), signMat); board.position.set(0, 1.55, .08); board.rotation.y = 0; board.castShadow = true; gS.add(board);
    const cr = new T.Mesh(keep(new T.PlaneGeometry(.9, .68)), crownMat); cr.position.set(0, 2.62, .1); gS.add(cr);
    for (const px of [-1.2, 1.2]) { const p = new T.Mesh(boxGeo, darkWood); p.scale.set(.16, 2.5, .16); p.position.set(px, 1.25, 0); p.castShadow = true; gS.add(p); } }
  const bannerTex = keep(canvasTex(T, 256, 1024, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#3a1e5a'); gr.addColorStop(1, '#5a2e86'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w * 1.1, 40, w, 260); g.lineTo(w * .92, h); g.lineTo(0, h); g.closePath(); g.fill(); g.drawImage(crownTex.image, 40, 70, 180, 135);
    g.save(); g.translate(w / 2, 560); g.rotate(-Math.PI / 2 + .05); g.font = '900 92px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = '#1a0a28'; g.strokeText('WHEELIE LIFE', 0, 0); g.fillStyle = '#ffd25a'; g.fillText('WHEELIE LIFE', 0, 0); g.restore(); }));
  const bannerMat = keep(new T.MeshStandardMaterial({ map: bannerTex, transparent: true, alphaTest: .4, roughness: .9, side: T.DoubleSide }));
  const bannerGeo = keep(new T.PlaneGeometry(.75, 3, 4, 12)); { const pa = bannerGeo.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) + .4) * 3) * .08); bannerGeo.computeVertexNormals(); }
  const banners = []; for (const s of F.banners) { const f = frame(s), [x, , z] = off(f, -(HALF + 1.9), 0), y = hAt(x, z), gB = new T.Group(); gB.position.set(x, y, z); gB.rotation.y = -f.yaw - .5; signs.add(gB);
    const pole = new T.Mesh(keep(new T.CylinderGeometry(.03, .04, 3.9, 6)), darkWood); pole.position.set(-.38, 1.95, 0); gB.add(pole); const fl = new T.Mesh(bannerGeo, bannerMat); fl.position.set(0, 2.3, 0); fl.castShadow = true; gB.add(fl); banners.push(fl); }
  // ---- rock: triplanar Rock051 with moss on top, for cliffs and boulders ----
  const tl = new T.TextureLoader(), tx = (f, srgb) => { const t = keep(tl.load(f)); t.wrapS = t.wrapT = T.RepeatWrapping; if (srgb) t.colorSpace = T.SRGBColorSpace; return t; };
  const rockMat = keep(new T.MeshStandardMaterial({ color: '#8c8a84', roughness: .92, metalness: 0 }));
  { const rc = tx(quality === 'high' ? './assets/ambientcg/Rock051/Rock051_2K_Color.jpg' : './assets/ambientcg/Rock051/Rock051_Color.jpg', true), gc = tx('./assets/ambientcg/Grass004/Grass004_Color.jpg', true);
    rockMat.customProgramCacheKey = () => 'wk-valley-rock'; rockMat.onBeforeCompile = sh => { sh.uniforms.rTex = { value: rc }; sh.uniforms.gTex = { value: gc };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRP;varying vec3 vRN;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 rwp=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nrwp=instanceMatrix*rwp;\n#endif\nvRP=(modelMatrix*rwp).xyz;vRN=normalize(mat3(modelMatrix)*objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D rTex;uniform sampler2D gTex;varying vec3 vRP;varying vec3 vRN;').replace('#include <map_fragment>', `#include <map_fragment>
{ vec3 n=abs(normalize(vRN));n/=n.x+n.y+n.z;float sc=.11;vec3 c=texture2D(rTex,vRP.zy*sc).rgb*n.x+texture2D(rTex,vRP.xz*sc).rgb*n.y+texture2D(rTex,vRP.xy*sc).rgb*n.z;
  float moss=smoothstep(.55,.85,normalize(vRN).y+ (texture2D(rTex,vRP.xz*.05).r-.5)*.6);vec3 mc=texture2D(gTex,vRP.xz*.25).rgb*vec3(.75,.95,.6);
  diffuseColor.rgb*=mix(c*1.15,mc,moss); }`); }; }
  // a lumpy rock mass: subdivided box displaced by noise
  const lump = (w, h, d, seed, seg = 10) => { const g = new T.BoxGeometry(w, h, d, seg, seg, seg), pa = g.attributes.position, vv = new T.Vector3();
    for (let i = 0; i < pa.count; i++) { vv.fromBufferAttribute(pa, i); const n = fbm(vv.x * .18 + seed, vv.z * .18 + vv.y * .13 - seed, 4), l = vv.length(); vv.multiplyScalar(1 + (n - .5) * .55); vv.y += (vv.y > 0 ? (n - .5) * h * .25 : 0); pa.setXYZ(i, vv.x, vv.y, vv.z); }
    g.computeVertexNormals(); return keep(g); };
  const cliffs = new T.Group(); group.add(cliffs);
  const waterfalls = [];
  // v2.1-62 cliffs: Poly Haven photo-scanned rock faces and a mountainside (CC0), scaled up into granite walls
  const rockPlace = { mountainside: [], rock_face_01: [], rock_face_02: [] };
  { const r = rng(77), dir = (f, right) => -f.yaw + (right ? Math.PI : 0) + (r() - .5) * .5;
    for (const [a, b] of F.cliffs) for (let s = a; s < b; s += 16 + r() * 10) { const f = frame(s), lat = -(HALF + 20 + r() * 22), [x, , z] = off(f, lat, 0), kind = r() < .5 ? 'mountainside' : r() < .5 ? 'rock_face_01' : 'rock_face_02';
      rockPlace[kind].push({ x, y: hAt(x, z) - 1.5, z, rot: dir(f, false), sc: kind === 'mountainside' ? 1.6 + r() * 1.4 : 3.2 + r() * 2.5 }); }
    for (let s = 60; s < V.len; s += 55 + r() * 50) { const f = frame(s), lat = HALF + 36 + r() * 16, [x, , z] = off(f, lat, 0), kind = r() < .4 ? 'mountainside' : 'rock_face_01';
      rockPlace[kind].push({ x, y: hAt(x, z) - 1.5, z, rot: dir(f, true), sc: kind === 'mountainside' ? 1.4 + r() * 1.2 : 3 + r() * 2 }); }
    // big boulders scattered in the meadows and along the bank
    for (let s = 20; s < V.len; s += 30 + r() * 40) { const f = frame(s), right = r() < .5, lat = right ? HALF + 6 + r() * 10 : -(HALF + 8 + r() * 20), [x, , z] = off(f, lat, 0); rockPlace.rock_face_02.push({ x, y: hAt(x, z) - .4, z, rot: r() * TAU, sc: 1 + r() * 1.2 }); }
  }
  // ---- waterfalls: an animated sheet down a rock face into a foaming pool, with drifting mist ----
  const wfMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float t;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 p=vec2(vUv.x*9.,vUv.y*3.+t*2.6);float s=n(p)*.6+n(p*2.3+3.)*.4;float streak=smoothstep(.35,.9,s);
float edge=smoothstep(0.,.18,vUv.x)*smoothstep(1.,.82,vUv.x);vec3 c=mix(vec3(.55,.72,.82),vec3(1.,.98,.95),streak);float a=(.55+.45*streak)*edge*smoothstep(0.,.06,vUv.y)*smoothstep(1.,.97,vUv.y);
gl_FragColor=vec4(c*1.15,a);}` }));
  const mistTex = keep(canvasTex(T, 64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
  const mistMat = keep(new T.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: .5, color: '#fff2e8' })), mists = [];
  const poolMat = keep(new T.MeshStandardMaterial({ color: '#2a4a52', roughness: .08, metalness: .3, envMapIntensity: 1.2 }));
  for (const [k, s] of F.waterfalls.entries()) { const left = k % 2 === 0, f = frame(s), lat = left ? -(HALF + 15) : HALF + 22, [x, , z] = off(f, lat, 0), gy = hAt(x, z), hgt = 12 + (k % 3) * 4, wid = 3.2 + (k % 2) * 1.4;
    // a rock face behind, a lip on top, the sheet in front, a pool at the bottom
    { const sc = (hgt + 1.5) / 10.3, [fx, , fz] = off(f, lat + (left ? -1 : 1) * (1.57 * sc + .2), 0); rockPlace.mountainside.push({ x: fx, y: gy - .6, z: fz, rot: -f.yaw + (left ? 0 : Math.PI), sc }); }
    const sheet = new T.Mesh(keep(new T.PlaneGeometry(wid, hgt, 1, 8)), wfMat); { const pa = sheet.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const t = (pa.getY(i) + hgt / 2) / hgt; pa.setZ(i, Math.pow(1 - t, 2) * -1.4 + .2); } }
    sheet.position.set(...off(f, lat - (left ? .2 : -.2), gy + hgt / 2 + .3)); sheet.rotation.y = -f.yaw + (left ? 0 : Math.PI); sheet.renderOrder = 3; cliffs.add(sheet); waterfalls.push(sheet);
    const pool = new T.Mesh(keep(new T.CircleGeometry(wid * 1.6, 24)), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(...off(f, lat + (left ? 1.5 : -1.5), gy + .12)); cliffs.add(pool);
    for (let i = 0; i < (lowDetail ? 4 : 9); i++) { const sp = new T.Sprite(mistMat); const [mx, , mz] = off(f, lat + (left ? 1.5 : -1.5) + (Math.random() - .5) * 2, 0); sp.position.set(mx + (Math.random() - .5) * 2, gy + .5 + Math.random() * 2, mz + (Math.random() - .5) * 2); sp.scale.setScalar(2 + Math.random() * 2.5); sp.userData = { y0: gy + .4, ph: Math.random() * TAU }; cliffs.add(sp); mists.push(sp); } }
  if (GLTFLoader) for (const [file, list] of Object.entries(rockPlace)) if (list.length) new GLTFLoader().loadAsync('./assets/polyhaven/cliffs/' + file + '.glb').then(g => {
    g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (!o.isMesh) return; [].concat(o.material).forEach(mm => { styleGrade(mm, { sat: .85, lift: 1.08 }); keep(mm); }); keep(o.geometry);
      const inst = new T.InstancedMesh(o.geometry, o.material, list.length); list.forEach((b, k) => { Q.setFromAxisAngle(new T.Vector3(0, 1, 0), b.rot); M.compose(Vv.set(b.x, b.y, b.z), Q, S.set(b.sc, b.sc, b.sc)).multiply(o.matrixWorld); inst.setMatrixAt(k, M); }); S.set(1, 1, 1);
      inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.castShadow = !lowDetail; inst.receiveShadow = true; inst.name = 'valley:cliff-' + file; cliffs.add(inst); }); }).catch(e => console.warn('[wk] cliff model failed', file, e));
  // ---- river: reflective moving water across the whole valley floor ----
  const water = keep(new T.MeshStandardMaterial({ color: '#2a4f56', roughness: .07, metalness: .1, envMapIntensity: .35 }));
  const wU = { wt: { value: 0 } }; water.customProgramCacheKey = () => 'wk-valley-water'; water.onBeforeCompile = sh => { sh.uniforms.wt = wU.wt;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP2;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP2=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float wt;varying vec3 vWP2;float wh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wh(i),wh(i+vec2(1,0)),f.x),mix(wh(i+vec2(0,1)),wh(i+vec2(1,1)),f.x),f.y);}`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 p=vWP2.xz*.35;float e=.15;float a=wn(p+vec2(wt*.5,wt*.2))+wn(p*2.7-vec2(wt*.3,wt*.6))*.5;float bx=wn(p+vec2(e,0.)+vec2(wt*.5,wt*.2))+wn((p+vec2(e,0.))*2.7-vec2(wt*.3,wt*.6))*.5;float bz=wn(p+vec2(0.,e)+vec2(wt*.5,wt*.2))+wn((p+vec2(0.,e))*2.7-vec2(wt*.3,wt*.6))*.5;
  vec3 wn3=normalize(vec3((a-bx)*1.6,1.,(a-bz)*1.6));normal=normalize((viewMatrix*vec4(wn3,0.)).xyz); }`); };
  { const wm = new T.Mesh(keep(new T.PlaneGeometry(xmax - xmin + 2 * MARGIN, zmax - zmin + 2 * MARGIN)), water); wm.rotation.x = -Math.PI / 2; wm.position.set((xmin + xmax) / 2, WATER, (zmin + zmax) / 2); wm.name = 'valley:river'; group.add(wm); }
  // ---- far land: forested hills, then a ring of snowy peaks ----
  { const cx = (xmin + xmax) / 2, cz = (zmin + zmax) / 2, R0 = Math.max(xmax - xmin, zmax - zmin) / 2 + MARGIN - 20;
    const ring = (r0, r1, hMax, seed, snow, col1, col2, segA = 256, segR = 18) => { const pos = [], colA = [], idx = [], ca = new T.Color(col1), cb = new T.Color(col2), sn = new T.Color('#f4e6ee'), tmp = new T.Color();
      for (let j = 0; j <= segR; j++) for (let i = 0; i <= segA; i++) { const a = i / segA * TAU, t = j / segR, r = r0 + (r1 - r0) * t, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        const ridge = 1 - Math.abs(fbm(Math.cos(a) * 3 + seed, Math.sin(a) * 3 + t * 2, 5) * 2 - 1), env = Math.sin(Math.PI * Math.min(1, t * 1.25)), big = Math.pow(fbm(a * 2.2 + seed * 3, t * 1.5, 3), 1.6) * 1.8;
        const h = (ridge * .6 + big) * hMax * env - (t < .08 ? (1 - t / .08) * 15 : 0); pos.push(x, h, z);
        tmp.copy(ca).lerp(cb, Math.min(1, h / hMax)); if (snow) tmp.lerp(sn, ss(hMax * .3, hMax * .48, h + (fbm(a * 9, t * 9, 2) - .5) * hMax * .2)); colA.push(tmp.r, tmp.g, tmp.b); }
      for (let j = 0; j < segR; j++) for (let i = 0; i < segA; i++) { const a = j * (segA + 1) + i, b = a + 1, c = a + segA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colA, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const hills = new T.Mesh(ring(R0 - 30, R0 + 420, 95, 3, false, '#2c3d24', '#46572e'), keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }))); hills.name = 'valley:hills'; group.add(hills);
    const peaks = new T.Mesh(ring(R0 + 700, R0 + 1900, 360, 11, true, '#43476a', '#6f6c96', 320, 22), keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, fog: false, emissive: '#2a2440', emissiveIntensity: .25 }))); peaks.name = 'valley:peaks'; group.add(peaks);
    // hero peaks: big snowy mountains by the sun (the picture's centrepiece), ridged, with alpenglow on the snow
    const peak = (dist, az, H, Rb, seed) => { const segA = 96, segR = 28, pos = [], col = [], idx = [], rock = new T.Color('#4c4a66'), rock2 = new T.Color('#6e6a88'), snow = new T.Color('#fbeaf0'), tmp = new T.Color(), px = cx + Math.cos(az) * dist, pz = cz + Math.sin(az) * dist;
      for (let j = 0; j <= segR; j++) for (let i = 0; i <= segA; i++) { const a = i / segA * TAU, t = j / segR, rr = t * Rb, ridge = 1 - Math.abs(fbm(Math.cos(a) * 2.2 + seed, Math.sin(a) * 2.2 + t * 3, 5) * 2 - 1);
        const prof = Math.pow(1 - t, 1.55), h = H * prof * (.72 + .5 * ridge * (1 - prof * .5)) + (fbm(a * 7 + seed, t * 9, 3) - .5) * H * .06 * t;
        pos.push(px + Math.cos(a) * rr * (1 + (ridge - .5) * .25), h - 30, pz + Math.sin(a) * rr * (1 + (ridge - .5) * .25));
        const sn = ss(.5, .62, h / H + (fbm(a * 11, t * 13, 2) - .5) * .18 + ridge * .06); tmp.copy(rock).lerp(rock2, ridge).lerp(snow, sn); col.push(tmp.r, tmp.g, tmp.b); }
      for (let j = 0; j < segR; j++) for (let i = 0; i < segA; i++) { const a = j * (segA + 1) + i, b = a + 1, c = a + segA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const peakMat = keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: 0, fog: false, emissive: '#3a2436', emissiveIntensity: .55 }));
    const sunAz = Math.atan2(.33, .93);
    for (const [d, daz, H, Rb, sd] of [[2300, -.22, 760, 1250, 1], [2700, .32, 560, 1100, 4], [2500, -.55, 480, 950, 7], [2900, .75, 620, 1200, 9], [2600, 2.6, 520, 1000, 12], [2800, -2.2, 600, 1150, 15]]) { const m = new T.Mesh(peak(d, sunAz + daz, H, Rb, sd), peakMat); m.name = 'valley:peak'; group.add(m); }
    // pine silhouettes over the hills (cheap cones)
    const coneGeo = keep(new T.ConeGeometry(1, 1, 7)); coneGeo.translate(0, .5, 0); const cones = [], r = rng(51);
    for (let k = 0; k < (lowDetail ? 1400 : 3200); k++) { const a = r() * TAU, rr = R0 - 20 + r() * 380, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; const t = (rr - (R0 - 30)) / 450;
      const ridge = 1 - Math.abs(fbm(Math.cos(a) * 3 + 3, Math.sin(a) * 3 + t * 2, 5) * 2 - 1), env = Math.sin(Math.PI * Math.min(1, t * 1.25)), big = Math.pow(fbm(a * 2.2 + 9, t * 1.5, 3), 1.6) * 1.8, h = (ridge * .6 + big) * 95 * env - (t < .08 ? (1 - t / .08) * 15 : 0);
      const s = 6 + r() * 9; cones.push([x, h - 1, z, s]); }
    const ci = new T.InstancedMesh(coneGeo, keep(new T.MeshStandardMaterial({ color: '#1e3020', roughness: 1 })), cones.length), col = new T.Color();
    cones.forEach(([x, y, z, s], k) => { M.compose(Vv.set(x, y, z), Q.identity(), S.set(s * .32, s, s * .32)); ci.setMatrixAt(k, M); ci.setColorAt(k, col.setRGB(.8 + r() * .4, .8 + r() * .4, .8 + r() * .3)); }); S.set(1, 1, 1);
    ci.instanceMatrix.needsUpdate = true; ci.instanceColor.needsUpdate = true; ci.computeBoundingSphere(); ci.name = 'valley:far-pines'; group.add(ci); }
  // ---- trees, shrubs, flowers and rocks (shared foliage system) ----
  const items = [], r = rng(2026), crownRocks = [];
  const put = (m, s, lat, scale, extra = {}) => { const f = frame(s), [x, , z] = off(f, lat, 0); items.push({ m, x, z, s: scale, rot: r() * TAU, v: r(), ...extra }); };
  const free = (s, lat) => !(cliffAmt(s) > .5 && lat < -(HALF + 6) && lat > -(HALF + 26)) && !creeks.some(c => Math.abs(s - c.s) < c.half + 3);
  for (let s = -60; s < V.len + 60; s += 1.2) {
    // forest: left hillside and far bank; a few big trees close in
    if (r() < .62) { const lat = -(HALF + 4.5 + Math.pow(r(), .9) * 75); if (free(s, lat)) put(r() < .8 ? (r() < .5 ? 'pine1' : 'pine5') : 'oak5', s, lat, .9 + r() * .7); }
    if (r() < .42) { const lat = HALF + 21 + Math.pow(r(), .8) * 70; if (free(s, lat)) put(r() < .85 ? (r() < .5 ? 'pine1' : 'pine5') : 'oak3', s, lat, .9 + r() * .7); }
    // shrubs, ferns, flowers along the fence and the bank
    if (r() < .35) { const lat = -(HALF + 1.6 + r() * 3); if (free(s, lat)) put(['phShrub3', 'phFern', 'phShrub2', 'phWeed'][Math.floor(r() * 4)], s, lat, .7 + r() * .5); }
    if (r() < .8) { const lat = (r() < .55 ? -1 : 1) * (HALF + .6 + r() * 1.8); put(r() < .6 ? 'flower3' : 'flower4', s, lat, .24 + r() * .16); }
    if (r() < .25) { const lat = HALF + .7 + r() * 1.2; put(['phRockA', 'phRockB', 'phRock7'][Math.floor(r() * 3)], s, lat, .5 + r() * .7, { tilt: (r() - .5) * .5 }); } /* rocks on the bank face */
    if (r() < .18) { const lat = HALF + 1.5 + r() * 3; put(['phFern', 'phShrub4', 'phNettle', 'phDand'][Math.floor(r() * 4)], s, lat, .7 + r() * .5); }
    if (r() < .12) { const lat = HALF + 2.5 + r() * 5; put(['phRockA', 'phRockB', 'phRock7', 'phStone'][Math.floor(r() * 4)], s, lat, .5 + r() * .9, { tilt: (r() - .5) * .3 }); }
  }
  for (const s of F.crownRocks) { const lat = HALF + 2.6; put('phRockA', s, lat, 2.2, { tilt: 0 }); const f = frame(s), [x, , z] = off(f, lat - .9, 0); crownRocks.push({ x, z, y: hAt(x, z) + .9, yaw: f.yaw }); }
  const foliage = GLTFLoader ? makeFoliageVisuals(T, group, GLTFLoader, items, hAt, { lowDetail, tint: { flower3: '#a06cff', flower4: '#e070ff', Bark_NormalTree: '#7a5a48', Leaves_Pine: '#8fb07a' } }) : { update() {}, dispose() {} };
  // gold crown painted on the big rocks by the trail
  { const cm = keep(new T.MeshStandardMaterial({ map: crownTex, transparent: true, alphaTest: .4, roughness: .6, metalness: .3, polygonOffset: true, polygonOffsetFactor: -2 }));
    for (const c of crownRocks) { const m = new T.Mesh(keep(new T.PlaneGeometry(1.4, 1.05)), cm); m.position.set(c.x, c.y, c.z); m.rotation.y = -c.yaw + Math.PI / 2 + .3; group.add(m); } }
  // GPU grass on the verges and slopes (not on the trail, water or rock)
  const grass = makeGrassField(T, group, { lowDetail, quality, height: hAt, mask: (x, z) => { const lat = sample(LAT, x, z), h = sample(HG, x, z); if (Math.abs(lat) < HALF + .4 || h < WATER + .15) return { density: 0, dry: 0 };
    const n = fbm(x * .05, z * .05, 3); return { density: Math.min(1, (.55 + n * .7) * (1 - ss(HALF + 3, HALF + 4.5, lat) * (lat > 0 ? 1 : 0))), dry: n * .25 }; } });
  // ---- start and finish: timber arches with banners ----
  const archText = (txt, col) => keep(canvasTex(T, 1024, 200, (g, w, h) => { g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2e1a0a'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
    g.font = '900 120px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 16; g.strokeStyle = '#2a1608'; g.strokeText(txt, w / 2, h / 2 + 6); g.fillStyle = col; g.fillText(txt, w / 2, h / 2 + 6); }));
  const arch = (s, txt, col) => { const f = frame(s), a = new T.Group(); a.position.set(f.x, f.h, f.z); a.rotation.y = -f.yaw + Math.PI / 2; group.add(a);
    for (const o of [-HALF - .6, HALF + .6]) { const leg = new T.Mesh(boxGeo, darkWood); leg.scale.set(.32, 5.2, .32); leg.position.set(o, 2.6, 0); leg.castShadow = true; a.add(leg); }
    const sign = new T.Mesh(keep(new T.PlaneGeometry(W + 1.6, 1.4)), keep(new T.MeshStandardMaterial({ map: archText(txt, col), roughness: .8, side: T.DoubleSide }))); sign.position.set(0, 5.4, 0); a.add(sign);
    const cr = new T.Mesh(keep(new T.PlaneGeometry(1.3, .98)), crownMat); cr.position.set(0, 6.6, .02); a.add(cr); };
  arch(F.start, 'THE VALLEY', '#ffd25a'); arch(V.finish, 'FINISH', '#fff1e6');
  // ---- coins: gold with a star ----
  const starTex = keep(canvasTex(T, 128, 128, (g, w, h) => { const gr = g.createRadialGradient(56, 50, 4, 64, 64, 64); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(.6, '#f4b524'); gr.addColorStop(1, '#b8740e'); g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#a8650a'; g.beginPath(); g.arc(64, 64, 50, 0, TAU); g.stroke(); g.fillStyle = '#c87a10'; g.beginPath(); for (let k = 0; k < 11; k++) { const a = k * TAU / 10 - Math.PI / 2, rr = k % 2 ? 15 : 34; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } g.fill(); g.fillStyle = '#ffe070'; g.beginPath(); for (let k = 0; k < 11; k++) { const a = k * TAU / 10 - Math.PI / 2, rr = k % 2 ? 12 : 28; g.lineTo(64 + Math.cos(a) * rr, 62 + Math.sin(a) * rr); } g.fill(); }));
  const coinFace = keep(new T.MeshStandardMaterial({ map: starTex, metalness: .7, roughness: .3, emissive: '#7a4a08', emissiveIntensity: .35 })), coinRim = keep(new T.MeshStandardMaterial({ color: '#e0a020', metalness: .85, roughness: .25, emissive: '#6a3a00', emissiveIntensity: .3 }));
  const coinGeo = keep(new T.CylinderGeometry(.45, .45, .1, 24)); coinGeo.rotateX(Math.PI / 2);
  const coins = new T.InstancedMesh(coinGeo, [coinRim, coinFace, coinFace], NEON_COINS.length); coins.name = 'valley:coins'; coins.frustumCulled = false; group.add(coins);
  const taken = new Uint8Array(NEON_COINS.length); let spin = 0;
  const placeCoins = () => { NEON_COINS.forEach((c, k) => { if (taken[k]) M.makeScale(0, 0, 0); else { E.set(0, spin + c.s * .2, 0, 'XYZ'); Q.setFromEuler(E); M.compose(Vv.set(c.x, c.y + Math.sin(spin * 2 + k) * .06, c.z), Q, S); } coins.setMatrixAt(k, M); }); coins.instanceMatrix.needsUpdate = true; };
  placeCoins();
  // ---- soft contact shadows under signs, arches and fence posts ----
  const blobs = makeBlobShadows(T, group, [...F.signs.map(s => { const f = frame(s), [x, , z] = off(f, -(HALF + 2.4), 0); return { x, z, r: 1.8, rz: .7 }; })], { height: hAt, strength: .45 });
  let t = 0; const sideOnly = [];
  return {
    group,
    update(dt) { t += dt; spin += dt * 2.6; placeCoins(); wfMat.uniforms.t.value = t; wU.wt.value = t; for (const sp of mists) { sp.position.y = sp.userData.y0 + 1 + Math.sin(t * .6 + sp.userData.ph) * .6; sp.material.opacity = .45; }
      banners.forEach((b, i) => { b.rotation.y = Math.sin(t * 1.3 + i * 1.7) * .12; }); },
    updateRider(x, z, y, dt) { grass.update(x, z, y, dt); foliage.update?.(x, z); },
    setView(chaseBlend) { const v = chaseBlend > .5; for (const m of sideOnly) m.visible = v; },
    takeCoin(k) { if (taken[k]) return false; taken[k] = 1; return true; },
    resetCoins() { taken.fill(0); },
    coinsTaken: () => taken.reduce((a, b) => a + b, 0),
    reflecting: () => false,
    heightAt: hAt,
    state: () => ({ valley: true, neon: true, len: V.len, coins: NEON_COINS.length, waterfalls: waterfalls.length, signs: F.signs.length, items: items.length }),
    dispose() { grass.dispose(); foliage.dispose(); blobs?.dispose(); res.forEach(o => o.dispose?.()); group.removeFromParent(); },
  };
}
