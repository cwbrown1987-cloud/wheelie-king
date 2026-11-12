// Bakes the reusable base garments (assets/clothing/base/*.glb) from the Playground rider's body mesh
// (Quaternius UBC, CC0). Used by tools/clothes-lab/bake.html only; the game loads the baked GLBs.
// Method: copy the body region the garment covers (T-pose, metres, +Z forward, +X = rider's left), push it
// out along the welded surface normal, Laplacian-smooth it so it reads as cloth not muscle, relax each
// opening into a clean line and add a sewn rim. Bone weights are copied from the body, so every garment is
// skinned to the same 65-bone skeleton and follows every IK pose. UVs are planar: front on the top half of
// the texture, back on the bottom half (trainers: outer side top, inner side bottom). See README.md there.
// ---------------------------------------------------------------- body analysis (once per body mesh)
const GET = ['getX', 'getY', 'getZ', 'getW'];
const wrap = a => ({ getComponent: (i, k) => a[GET[k]](i) });
export function analyse(T, body) {
  const g = body.geometry, P = g.attributes.position, N = g.attributes.normal, n = P.count;
  const idx = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
  const key = new Map(), toU = new Int32Array(n), rep = [], pos = [], nor = [];
  for (let i = 0; i < n; i++) {
    const k = Math.round(P.getX(i) * 2e4) + ',' + Math.round(P.getY(i) * 2e4) + ',' + Math.round(P.getZ(i) * 2e4);
    let u = key.get(k);
    if (u == null) { u = rep.length; key.set(k, u); rep.push(i); pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(0, 0, 0); }
    toU[i] = u;
  }
  const U = rep.length, tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = toU[idx[t]], b = toU[idx[t + 1]], c = toU[idx[t + 2]];
    if (a === b || b === c || a === c) continue; tris.push([a, b, c, t]);
    // area-weighted face normal into the welded vertex normal (seam-free)
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az, vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { nor[v * 3] += fx; nor[v * 3 + 1] += fy; nor[v * 3 + 2] += fz; }
  }
  for (let u = 0; u < U; u++) { const l = Math.hypot(nor[u * 3], nor[u * 3 + 1], nor[u * 3 + 2]) || 1; nor[u * 3] /= l; nor[u * 3 + 1] /= l; nor[u * 3 + 2] /= l; }
  // fall back to the authored normal where the welded one degenerated
  for (let u = 0; u < U; u++) if (!Number.isFinite(nor[u * 3])) { nor[u * 3] = N.getX(rep[u]); nor[u * 3 + 1] = N.getY(rep[u]); nor[u * 3 + 2] = N.getZ(rep[u]); }
  const names = body.skeleton.bones.map(b => b.name), SI = wrap(g.attributes.skinIndex), SW = wrap(g.attributes.skinWeight);
  const weight = (u, re) => { const i = rep[u]; let s = 0; for (let k = 0; k < 4; k++) if (re.test(names[SI.getComponent(i, k)] || '')) s += SW.getComponent(i, k); return s; };
  return { U, pos, nor, rep, toU, tris, idx: Uint32Array.from(idx), weight, SI, SW, names };
}

// ---------------------------------------------------------------- garment builder
function buildGarment(T, A, sel0, o) {
  // close pinholes: a vertex whose neighbours are mostly in the garment joins it
  if (!A.adj) { A.adj = Array.from({ length: A.U }, () => new Set()); for (const t of A.tris) for (let k = 0; k < 3; k++) { A.adj[t[k]].add(t[(k + 1) % 3]); A.adj[t[(k + 1) % 3]].add(t[k]); } }
  const base = new Uint8Array(A.U); for (let u = 0; u < A.U; u++) base[u] = sel0(u) ? 1 : 0;
  const selArr = base.slice(); for (let u = 0; u < A.U; u++) if (!base[u] && A.adj[u].size) { let c = 0; for (const w of A.adj[u]) c += base[w]; if (c / A.adj[u].size >= 0.6) selArr[u] = 1; }
  const sel = u => selArr[u] === 1;
  const need = o.selCount ?? 2, tris = A.tris.filter(t => (sel(t[0]) ? 1 : 0) + (sel(t[1]) ? 1 : 0) + (sel(t[2]) ? 1 : 0) >= need); // 2 of 3: no slivers missing along long body triangles
  const loc = new Map(), verts = [];
  for (const t of tris) for (let k = 0; k < 3; k++) if (!loc.has(t[k])) loc.set(t[k], verts.push(t[k]) - 1);
  const n = verts.length, F = tris.map(t => [loc.get(t[0]), loc.get(t[1]), loc.get(t[2])]);
  const edges = new Map(), adj = Array.from({ length: n }, () => new Set());
  for (const f of F) for (let k = 0; k < 3; k++) {
    const a = f[k], b = f[(k + 1) % 3], key = a < b ? a * 1e6 + b : b * 1e6 + a, e = edges.get(key);
    if (e) e.c++; else edges.set(key, { a, b, c: 1 }); adj[a].add(b); adj[b].add(a);
  }
  const boundary = new Uint8Array(n), bEdges = [];
  for (const e of edges.values()) if (e.c === 1) { boundary[e.a] = boundary[e.b] = 1; bEdges.push(e); }
  // orient boundary edges as they appear in their face (for the rim winding)
  const faceDir = new Map(); for (const f of F) for (let k = 0; k < 3; k++) faceDir.set(f[k] * 1e6 + f[(k + 1) % 3], 1);
  const p0 = i => [A.pos[verts[i] * 3], A.pos[verts[i] * 3 + 1], A.pos[verts[i] * 3 + 2]];
  const n0 = i => [A.nor[verts[i] * 3], A.nor[verts[i] * 3 + 1], A.nor[verts[i] * 3 + 2]];
  // distance along the surface to the nearest opening (Dijkstra; garments are a few thousand verts)
  const bd = new Float32Array(n).fill(1e9), heap = [];
  const push = (d, i) => { heap.push([d, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const bsrc = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (boundary[i]) { bd[i] = 0; bsrc[i] = i; push(0, i); }
  while (heap.length) { const [d, i] = pop(); if (d > bd[i]) continue; const a = p0(i); for (const j of adj[i]) { const b = p0(j), nd = d + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (nd < bd[j]) { bd[j] = nd; bsrc[j] = bsrc[i]; push(nd, j); } } }
  const info = i => { const p = p0(i), s = bsrc[i] >= 0 ? p0(bsrc[i]) : p; return { p, n: n0(i), bd: bd[i], open: o.opening ? o.opening(s) : 'edge', u: verts[i] }; };
  const infos = Array.from({ length: n }, (_, i) => info(i));
  // offset + cloth smoothing (Laplacian), never closer to the skin than minThick
  const P = new Float32Array(n * 3), minT = new Float32Array(n);
  for (let i = 0; i < n; i++) { const I = infos[i], t = o.thick(I); minT[i] = o.minThick ? o.minThick(I, t) : t * 0.6; for (let k = 0; k < 3; k++) P[i * 3 + k] = I.p[k] + I.n[k] * t; }
  const Q = new Float32Array(n * 3);
  for (let it = 0; it < (o.smooth ?? 4); it++) {
    for (let i = 0; i < n; i++) { let x = 0, y = 0, z = 0, c = 0; for (const j of adj[i]) { x += P[j * 3]; y += P[j * 3 + 1]; z += P[j * 3 + 2]; c++; } const lam = boundary[i] ? 0.15 : 0.55; if (!c) { Q.set(P.subarray(i * 3, i * 3 + 3), i * 3); continue; } Q[i * 3] = P[i * 3] + (x / c - P[i * 3]) * lam; Q[i * 3 + 1] = P[i * 3 + 1] + (y / c - P[i * 3 + 1]) * lam; Q[i * 3 + 2] = P[i * 3 + 2] + (z / c - P[i * 3 + 2]) * lam; }
    for (let i = 0; i < n; i++) { const I = infos[i]; let d = 0; for (let k = 0; k < 3; k++) d += (Q[i * 3 + k] - I.p[k]) * I.n[k]; const add = d < minT[i] ? minT[i] - d : 0; for (let k = 0; k < 3; k++) P[i * 3 + k] = Q[i * 3 + k] + I.n[k] * add; }
  }
  // relax each opening along its own loop so hems and cuffs are clean lines, not triangle staircases
  const bAdj = new Map(); for (const e of bEdges) { (bAdj.get(e.a) || bAdj.set(e.a, []).get(e.a)).push(e.b); (bAdj.get(e.b) || bAdj.set(e.b, []).get(e.b)).push(e.a); }
  for (let it = 0; it < (o.loopSmooth ?? 10); it++) for (const [i, nb] of bAdj) { if (nb.length !== 2) continue; for (let k = 0; k < 3; k++) Q[i * 3 + k] = (P[nb[0] * 3 + k] + P[nb[1] * 3 + k]) * 0.25 + P[i * 3 + k] * 0.5; for (let k = 0; k < 3; k++) P[i * 3 + k] = Q[i * 3 + k]; }
  if (o.shape) for (let i = 0; i < n; i++) { const r = o.shape(infos[i], [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); if (r) P.set(r, i * 3); }
  for (let i = 0; i < n; i++) infos[i].q = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  // outer-surface normals before the rim is added
  const tmp = new T.BufferGeometry(); tmp.setAttribute('position', new T.BufferAttribute(P, 3)); tmp.setIndex(F.flat()); tmp.computeVertexNormals();
  const NN = tmp.attributes.normal.array; tmp.dispose();
  // rim: a second ring just inside each opening, joined with quads, so openings look like sewn fabric
  const V = []; // [srcLocal, inner?]
  for (let i = 0; i < n; i++) V.push([i, 0]);
  const inner = new Map(), allF = F.map(f => [...f]);
  if (o.rim !== false) {
    for (let i = 0; i < n; i++) if (boundary[i]) { inner.set(i, V.length); V.push([i, 1]); }
    for (const e of bEdges) { let a = e.a, b = e.b; if (!faceDir.has(a * 1e6 + b)) [a, b] = [b, a]; const a2 = inner.get(a), b2 = inner.get(b); allF.push([b, a, a2], [b, a2, b2]); }
  }
  const rimIn = o.rimIn ?? 0.003;
  // inner ring follows the relaxed outer loop, pulled back to just off the skin (clean, even rim)
  const posOf = v => { const [i, inn] = V[v], q = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; if (!inn) return q; const I = infos[i]; let d = 0; for (let k = 0; k < 3; k++) d += (q[k] - I.p[k]) * I.n[k]; const back = Math.max(0, d - rimIn); return [q[0] - I.n[0] * back, q[1] - I.n[1] * back, q[2] - I.n[2] * back]; };
  // split seam: each face takes the front (+z) or back half of the texture
  const out = new Map(), aPos = [], aNor = [], aSI = [], aSW = [], aUV = [], aCol = [], aFlap = [], index = [];
  const box = o.uvBox;
  for (const f of allF) {
    const back = o.half ? o.half(f.map(v => infos[V[v][0]])) : (f.reduce((a, v) => a + infos[V[v][0]].n[2], 0) < 0 ? 1 : 0);
    for (const v of f) {
      const k = v * 2 + back; let id = out.get(k);
      if (id == null) {
        id = aPos.length / 3; out.set(k, id);
        const [i, inn] = V[v], I = infos[i], p = posOf(v), src = A.rep[verts[i]];
        aPos.push(...p); aNor.push(NN[i * 3], NN[i * 3 + 1], NN[i * 3 + 2]);
        for (let c = 0; c < 4; c++) { aSI.push(A.SI.getComponent(src, c)); aSW.push(A.SW.getComponent(src, c)); }
        if (o.uv) aUV.push(...o.uv(I, back)); else if (box) { const u = back ? (box[2] - I.q[0]) / (box[2] - box[0]) : (I.q[0] - box[0]) / (box[2] - box[0]), h = (I.q[1] - box[1]) / (box[3] - box[1]); aUV.push(u, back ? 0.5 * h : 0.5 + 0.5 * h); } else aUV.push(0, 0);
        const col = o.color ? o.color(I, !!inn) : [1, 1, 1]; aCol.push(...col);
        aFlap.push(o.flap ? o.flap(I) : 0);
      }
      index.push(id);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(aPos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(aNor, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(aUV, 2));
  geo.setAttribute('color', new T.Float32BufferAttribute(aCol, 3));
  geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(aSI, 4));
  geo.setAttribute('skinWeight', new T.Float32BufferAttribute(aSW, 4));
  geo.setAttribute('flap', new T.Float32BufferAttribute(aFlap, 1));
  geo.setIndex(index); geo.computeBoundingSphere();
  // body vertices this garment fully covers (interior only: one ring in from every opening)
  const covered = []; for (let i = 0; i < n; i++) if (!boundary[i] && infos[i].bd > (o.coverMargin ?? 0.012)) covered.push(A.rep[verts[i]]);
  return { geo, covered, verts: n, tris: index.length / 3 };
}

// Extra pieces that are not body copies (rolled hood, drawstrings): skin each vertex like its nearest body vertex.
function skinLikeBody(T, A, positions, sel) {
  const cand = []; for (let u = 0; u < A.U; u++) if (sel(u)) cand.push(u);
  const n = positions.length / 3, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), near = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let best = -1, bd = 1e9; const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    for (const u of cand) { const d = (A.pos[u * 3] - x) ** 2 + (A.pos[u * 3 + 1] - y) ** 2 + (A.pos[u * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = u; } }
    near[i] = best; const r = A.rep[best]; for (let c = 0; c < 4; c++) { SI[i * 4 + c] = A.SI.getComponent(r, c); SW[i * 4 + c] = A.SW.getComponent(r, c); }
  }
  return { SI, SW, near };
}
// push points that ended up inside the body back out along the nearest body normal
function keepOutside(A, positions, near, gap) {
  for (let i = 0; i < positions.length / 3; i++) {
    const u = near[i]; let d = 0; for (let k = 0; k < 3; k++) d += (positions[i * 3 + k] - A.pos[u * 3 + k]) * A.nor[u * 3 + k];
    if (d < gap) for (let k = 0; k < 3; k++) positions[i * 3 + k] += A.nor[u * 3 + k] * (gap - d);
  }
}

// Hood lying down on the upper back: a fat tube swept round the back of the neck, sagging into a pouch.
function hoodDownGeometry(T, A) {
  const seg = 28, ring = 14, pos = [], flap = [], idx = [], col = [];
  for (let s = 0; s <= seg; s++) {
    const t = s / seg * 2 - 1, a = t * Math.PI * 0.47, back = Math.cos(t * Math.PI / 2) ** 2;
    const cx = Math.sin(a) * 0.105, cz = -0.02 - Math.cos(a) * 0.115, cy = 1.43 - 0.035 * back + 0.03 * Math.abs(t) ** 2;
    const end = 1 - Math.abs(t) ** 6, rw = (0.01 + 0.05 * back) * end + 0.005, rh = (0.014 + 0.1 * back) * end + 0.005; // cross-section: taller (pouch) at the back
    const tx = Math.cos(a), tz = Math.sin(a); // tangent across the neck
    for (let r = 0; r <= ring; r++) {
      const b = r / ring * Math.PI * 2, ox = Math.cos(b) * rw, oy = Math.sin(b) * rh - rh * 0.55 * back;
      // ox points away from the neck (outward), oy up/down
      const nx = Math.sin(a), nz = -Math.cos(a);
      pos.push(cx + nx * ox, cy + oy, cz + nz * ox);
      flap.push(Math.min(1, 0.25 + back * 0.6 + Math.max(0, -Math.sin(b)) * 0.3));
      { const c = 0.62 + 0.38 * Math.max(0, Math.cos(b)) ** 0.6; col.push(c, c, c); } // inner face of the hood darker, so it reads as a folded hood
      void tx; void tz;
    }
  }
  for (let s = 0; s < seg; s++) for (let r = 0; r < ring; r++) { const a = s * (ring + 1) + r, b = a + ring + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const sel = u => A.pos[u * 3 + 1] > 1.28 && A.pos[u * 3 + 1] < 1.62 && Math.abs(A.pos[u * 3]) < 0.25;
  const P = Float32Array.from(pos), sk = skinLikeBody(T, A, P, sel);
  keepOutside(A, P, sk.near, 0.022);
  const g = finishPiece(T, P, idx, sk, flap); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return g;
}
function stringGeometry(T, A, hoodUp) {
  const pos = [], idx = [], flap = [], seg = 10, ring = 6;
  for (const side of [-1, 1]) {
    const base = pos.length / 3, x0 = side * 0.034, y0 = hoodUp ? 1.47 : 1.455, z0 = 0.105, len = 0.2;
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, x = x0 + side * 0.012 * t, y = y0 - len * t, z = z0 + 0.03 * Math.sin(t * Math.PI * 0.6) + (hoodUp ? 0 : 0.0), r = t > 0.86 ? 0.0055 : 0.0038;
      for (let k = 0; k <= ring; k++) { const b = k / ring * Math.PI * 2; pos.push(x + Math.cos(b) * r, y, z + Math.sin(b) * r); flap.push(t * 0.9); }
    }
    for (let s = 0; s < seg; s++) for (let k = 0; k < ring; k++) { const a = base + s * (ring + 1) + k, b = a + ring + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  }
  const sel = u => A.pos[u * 3 + 1] > 1.3 && A.pos[u * 3 + 1] < 1.5 && A.pos[u * 3 + 2] > 0.04 && Math.abs(A.pos[u * 3]) < 0.12;
  const P = Float32Array.from(pos), sk = skinLikeBody(T, A, P, sel);
  keepOutside(A, P, sk.near, 0.03);
  return finishPiece(T, P, idx, sk, flap);
}
function finishPiece(T, P, idx, sk, flap) {
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setIndex(idx);
  geo.setAttribute('skinIndex', new T.BufferAttribute(sk.SI, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(sk.SW, 4));
  geo.setAttribute('flap', new T.Float32BufferAttribute(flap, 1));
  geo.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2));
  geo.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(P.length).fill(1), 3));
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}


// ---------------------------------------------------------------- base garment specs
export const HEM_Y = 0.875, CUFF_X = 0.668;
export const BASES = {
  hoodie: { uvBox: [-0.72, 0.84, 0.72, 1.62], hemY: HEM_Y, cuffX: CUFF_X, anchors: { chest: [0.004, 1.335], back: [0, 1.215], pocket: [0, 1.0] }, fit: 'Slim-relaxed pullover hoodie: 1.2 cm off the torso, 1.9 cm sleeves, small drape at the ribbed hem at hip height, long sleeves to the wrist, ribbed cuffs.' },
  hood_up: { uvBox: null, fit: 'Hood worn up: shell 4-5.5 cm off the skull, open face. Solid colour (look.hood or look.base).' },
  jumper: { uvBox: [-0.72, 0.84, 0.72, 1.62], hemY: HEM_Y, cuffX: CUFF_X, anchors: { chest: [0, 1.33], back: [0, 1.36] }, fit: 'Slim crewneck jumper: 1.1 cm off the torso, 1.5 cm sleeves, ribbed hem, cuffs and crew collar.' },
  tshirt: { uvBox: [-0.46, 0.86, 0.46, 1.62], hemY: 0.9, cuffX: 0.4, anchors: { chest: [0, 1.33], back: [0, 1.36] }, fit: 'Slim regular tee: 0.9 cm off the torso, hem at the top of the hips, short sleeves to mid upper arm, crew neck.' },
  joggers: { uvBox: [-0.3, 0.09, 0.3, 1.08], ankleY: 0.098, waistY: 1.02, anchors: { thigh: [0.13, 0.64] }, fit: 'Joggers: close at hips/thighs (1.1 cm), looser below the knee (2.5 cm), gathered onto a 1.2 cm ribbed ankle cuff over the trainer collar; waist under the top.' },
  shorts: { uvBox: [-0.3, 0.45, 0.3, 1.08], hemY: 0.52, waistY: 1.02, anchors: { thigh: [0.14, 0.66] }, fit: 'Shorts: 1.3 cm at the hips, slight flare at the open hem just above the knee.' },
  trainers: { uvBox: [-0.15, -0.025, 0.215, 0.145], fit: 'Chunky low-top trainers: 2.4 cm cupsole, wide rounded toe box. UV: u = heel->toe (z), v = height; outer side top half, inner side bottom half; both feet share the texture.' },
};

function shoeSurface(I) {
  // rounded "last" around each foot: superellipsoid, narrower and lower at the toe, flat sole
  const cx = Math.sign(I.p[0]) * 0.114, c = [cx, 0.06, 0.03], d = [I.p[0] - c[0], I.p[1] - c[1], I.p[2] - c[2]];
  const l = Math.hypot(...d) || 1; for (let k = 0; k < 3; k++) d[k] /= l;
  const f = t => { const z = d[2] * t, zn = Math.max(0, z / 0.165), a = 0.058 * (1 - 0.14 * zn * zn), b = 0.078 - 0.03 * zn, y = d[1] * t; const yy = y < 0 ? y / 0.084 : y / b; return Math.pow(Math.abs(d[0] * t / a), 3) + Math.pow(Math.abs(yy), 3.4) + Math.pow(Math.abs(z / (z > 0 ? 0.168 : 0.142)), 2.4) - 1; };
  let lo = 0, hi = 0.3; for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  const t = Math.max(lo, l + 0.005), p = [c[0] + d[0] * t, Math.max(-0.024, c[1] + d[1] * t), c[2] + d[2] * t];
  return p;
}

// Returns { [baseName]: { meshes: [{ role, geo }], covers: number[] (body vertex indices hidden under it), spec } }
export function bakeBases(T, body) {
  const A = analyse(T, body);
  const X = u => A.pos[u * 3], Y = u => A.pos[u * 3 + 1], Z = u => A.pos[u * 3 + 2];
  const neckHole = (u, R, front, back) => { const x = X(u), y = Y(u), z = Z(u); if (y > 1.565) return true; const t = Math.max(0, Math.min(1, (z + 0.03) / 0.11)); return Math.hypot(x / R, (z + 0.01) / (R * 1.05)) < 1 && y > back + (front - 0.02 - back) * t * t * (3 - 2 * t); };
  const top = (hem, sleeveX, R, front, back) => u => { const x = Math.abs(X(u)), y = Y(u); if (x < 0.25) return y > hem && !neckHole(u, R, front, back); return x < sleeveX && y > 1.25; };
  const opening = (spec) => p => (Math.abs(p[0]) > spec.cuffX - 0.06 ? 'cuff' : p[1] < spec.hemY + 0.06 ? 'hem' : 'neck');
  const rib = (I, inn) => { const r = I.open === 'neck' ? 0.03 : 0.06; return inn ? [0.72, 0.72, 0.72] : I.bd < r && I.open !== 'sleeve' ? [0.93, 0.93, 0.93] : [1, 1, 1]; };
  const drape = amount => (I, p) => { if (Math.abs(I.p[0]) > 0.24 || I.p[1] > 1.3) return null; const dx = p[0], dz = p[2] + 0.01, l = Math.hypot(dx, dz) || 1;
    const k = Math.max(0, Math.min(1, (1.3 - I.p[1]) / 0.16)) * Math.min(1, I.bd / 0.06) * amount; return [p[0] + dx / l * k, p[1], p[2] + dz / l * k]; };
  const taper = (t, I, ribs) => { const r = I.open === 'neck' ? 0.03 : 0.07, tight = I.open === 'neck' ? 0.009 : 0.009; if (!ribs.includes(I.open)) return t; return I.bd < r ? tight + (t - tight) * (I.bd / r) ** 1.5 : t; };
  const out = {};
  const piece = (role, geo) => ({ role, geo });
  { const S = BASES.hoodie, g = buildGarment(T, A, top(S.hemY, S.cuffX, 0.09, 1.47, 1.505), { uvBox: S.uvBox, opening: opening(S), smooth: 6,
      thick: I => taper(Math.abs(I.p[0]) > 0.24 ? 0.019 : 0.012, I, ['hem', 'cuff', 'neck']),
      minThick: (I, t) => Math.min(t, I.open === 'neck' ? 0.008 : 0.008), shape: drape(0.008), color: rib,
      flap: I => I.open === 'hem' ? Math.max(0, 1 - I.bd / 0.14) * (I.p[2] < 0 ? 1 : 0.55) : 0 });
    out.hoodie = { meshes: [piece('body', g.geo), piece('hood', hoodDownGeometry(T, A)), piece('strings', stringGeometry(T, A, false))], covers: g.covered, spec: S }; }
  { const g = buildGarment(T, A, u => { const y = Y(u), z = Z(u), x = Math.abs(X(u)); if (y < 1.45 || x > 0.16) return false; if (y < 1.6) return z < (y - 1.45) * 0.15 || x > 0.07; return z < 0.045 + Math.max(0, y - 1.72) * 0.6 || x > 0.085 || y > 1.78; },
      { opening: () => 'face', smooth: 10, rimIn: 0.01, thick: I => { const t = 0.04 + 0.015 * Math.max(0, I.p[1] - 1.6) / 0.2; return I.bd < 0.03 ? 0.022 + (t - 0.022) * I.bd / 0.03 : t; }, minThick: () => 0.02,
        color: (I, inn) => inn ? [0.5, 0.5, 0.5] : [1, 1, 1], flap: I => Math.max(0, Math.min(1, (-I.p[2] - 0.02) / 0.1)) * 0.35, coverMargin: 99 });
    out.hood_up = { meshes: [piece('hood', g.geo)], covers: [], spec: BASES.hood_up }; }
  { const S = BASES.jumper, g = buildGarment(T, A, top(S.hemY, S.cuffX, 0.082, 1.48, 1.51), { uvBox: S.uvBox, opening: opening(S), smooth: 6,
      thick: I => taper(Math.abs(I.p[0]) > 0.24 ? 0.015 : 0.011, I, ['hem', 'cuff', 'neck']),
      minThick: (I, t) => Math.min(t, I.open === 'neck' ? 0.008 : 0.008), shape: drape(0.006), color: rib,
      flap: I => I.open === 'hem' ? Math.max(0, 1 - I.bd / 0.12) * 0.6 : 0 });
    out.jumper = { meshes: [piece('body', g.geo)], covers: g.covered, spec: S }; }
  { const S = BASES.tshirt, g = buildGarment(T, A, top(S.hemY, S.cuffX, 0.086, 1.478, 1.51), { uvBox: S.uvBox, opening: p => (Math.abs(p[0]) > 0.3 ? 'sleeve' : p[1] < S.hemY + 0.06 ? 'hem' : 'neck'), smooth: 5,
      thick: I => taper(Math.abs(I.p[0]) > 0.24 ? 0.014 : 0.009, I, ['neck']),
      minThick: (I, t) => Math.min(t, 0.007), shape: drape(0.006), color: rib,
      flap: I => (I.open === 'hem' || I.open === 'sleeve') ? Math.max(0, 1 - I.bd / 0.1) * 0.7 : 0 });
    out.tshirt = { meshes: [piece('body', g.geo)], covers: g.covered, spec: S }; }
  { const S = BASES.joggers, g = buildGarment(T, A, u => Y(u) > S.ankleY && Y(u) < S.waistY && Math.abs(X(u)) < 0.3, { uvBox: S.uvBox, coverMargin: 0.004, smooth: 9, opening: p => (p[1] < 0.5 ? 'ankle' : 'waist'),
      thick: I => { if (I.open === 'waist') return I.bd < 0.04 ? 0.009 + 0.002 * I.bd / 0.04 : 0.011;
        const y = I.p[1], below = Math.max(0, Math.min(1, (0.56 - y) / 0.2)), t = 0.011 + 0.014 * below; // close above the knee, looser shin
        if (I.bd < 0.035) return 0.012; // ribbed ankle cuff
        if (I.bd < 0.075) return 0.012 + (t + 0.006 - 0.012) * (I.bd - 0.035) / 0.04; // fabric gathering onto the cuff
        return I.bd < 0.12 ? t + 0.006 * (0.12 - I.bd) / 0.045 : t; },
      minThick: (I, t) => Math.min(t, 0.008), color: rib, flap: I => I.open === 'ankle' ? Math.max(0, 1 - I.bd / 0.15) * 0.12 : 0 });
    out.joggers = { meshes: [piece('body', g.geo)], covers: g.covered, spec: S }; }
  { const S = BASES.shorts, g = buildGarment(T, A, u => Y(u) > S.hemY && Y(u) < S.waistY && Math.abs(X(u)) < 0.3, { uvBox: S.uvBox, smooth: 9, opening: p => (p[1] < 0.75 ? 'leg' : 'waist'),
      thick: I => I.open === 'waist' && I.bd < 0.04 ? 0.009 + 0.004 * I.bd / 0.04 : I.open === 'leg' ? 0.013 + 0.008 * Math.max(0, 1 - I.bd / 0.12) : 0.013, minThick: (I, t) => Math.min(t, 0.01), color: rib,
      flap: I => I.open === 'leg' ? Math.max(0, 1 - I.bd / 0.1) * 0.5 : 0 });
    out.shorts = { meshes: [piece('body', g.geo)], covers: g.covered, spec: S }; }
  { const S = BASES.trainers, B = S.uvBox, g = buildGarment(T, A, u => Y(u) < 0.15 && Math.abs(X(u)) < 0.3, { smooth: 3, coverMargin: 0.004, rimIn: 0.006, opening: () => 'collar', loopSmooth: 14,
      thick: I => (I.bd < 0.015 ? 0.008 : 0.012), minThick: (I, t) => Math.min(t, 0.005),
      shape: (I, p) => { if (I.p[1] > 0.1) return null; const s = shoeSurface(I), k = I.p[1] < 0.075 ? 1 : 1 - (I.p[1] - 0.075) / 0.025; return [p[0] + (s[0] - p[0]) * k, p[1] + (s[1] - p[1]) * k, p[2] + (s[2] - p[2]) * k]; },
      half: fi => (fi.reduce((a, I) => a + (I.p[0] - Math.sign(I.p[0]) * 0.114) * Math.sign(I.p[0]), 0) < 0 ? 1 : 0),
      uv: (I, inner) => { const u = (I.q[2] - B[0]) / (B[2] - B[0]), h = Math.max(0, Math.min(1, (I.q[1] - B[1]) / (B[3] - B[1]))); return [u, inner ? 0.5 * h : 0.5 + 0.5 * h]; },
      color: (I, inn) => inn ? [0.3, 0.3, 0.3] : [1, 1, 1] });
    out.trainers = { meshes: [piece('body', g.geo)], covers: g.covered, spec: S }; }
  return out;
}
