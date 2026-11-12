// Playground concrete bowl (v2.1-31): a rounded-rectangle pool with a flat bottom, circular transitions that run
// up to near-vertical at the coping, a deck all round, and a grassy bank down to the playground so you can ride
// up onto the deck and drop in. Carve the walls, boost out of the corners, turn in the air and land back in.
export const BOWL = { x: 165, z: 150, ax: 7, az: 4, rc: 3.2, R: 3.8, lipDeg: 82, deck: 3, bank: 6 };
const LIP = BOWL.lipDeg * Math.PI / 180, DLIP = BOWL.R * Math.sin(LIP);
export const BOWL_TOP = BOWL.R * (1 - Math.cos(LIP));
// distance from the flat bottom (a rounded rectangle) outward; 0 inside it
export function bowlDist(x, z) {
  const B = BOWL, qx = Math.abs(x - B.x) - (B.ax - B.rc), qz = Math.abs(z - B.z) - (B.az - B.rc);
  const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
  return Math.max(0, Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - B.rc);
}
const EXT = DLIP + BOWL.deck + BOWL.bank + 1;
export const inBowl = (x, z) => Math.abs(x - BOWL.x) < BOWL.ax + EXT && Math.abs(z - BOWL.z) < BOWL.az + EXT;
export function bowlHeight(x, z) {
  const d = bowlDist(x, z), R = BOWL.R;
  if (d <= 0) return 0;
  if (d < DLIP) return R - Math.sqrt(R * R - d * d);                         // transition
  const e = d - DLIP;
  if (e < BOWL.deck) return BOWL_TOP;                                         // deck
  const t = Math.min(1, (e - BOWL.deck) / BOWL.bank);                         // bank down to the grass
  return BOWL_TOP * (1 - t * t * (3 - 2 * t));
}
// where you arrive from the ring: on the deck, facing in, ready to drop in
export const BOWL_ENTRY = { x: BOWL.x, z: BOWL.z + BOWL.az + DLIP + 1.3, yaw: -Math.PI / 2, vx: 1.5 };

export function makeBowlVisuals(T, root, { lowDetail = false } = {}) {
  const group = new T.Group(); group.name = 'environment:bowl'; root.add(group); const res = [];
  const C = lowDetail ? .5 : .25, half = { x: BOWL.ax + EXT, z: BOWL.az + EXT }, nx = Math.round(2 * half.x / C), nz = Math.round(2 * half.z / C);
  const pos = [], col = [], uv = [], idx = [], c = new T.Color(), conc = new T.Color('#b9b6b0'), concDark = new T.Color('#8f8c87'), deck = new T.Color('#cfc9bd'), grass = new T.Color('#6f8f45'), blue = new T.Color('#5d93b8');
  const hash = (i, j) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return s - Math.floor(s); };
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = BOWL.x - half.x + i * C, z = BOWL.z - half.z + j * C, d = bowlDist(x, z), h = bowlHeight(x, z); pos.push(x, h, z); uv.push(x / 2, -z / 2);
    if (d < DLIP) { c.copy(conc).lerp(concDark, Math.min(1, d / DLIP) * .35 + hash(i >> 2, j >> 2) * .08); if (d <= .02) c.lerp(blue, .25); }
    else if (d - DLIP < BOWL.deck) c.copy(deck).multiplyScalar(.94 + hash(i >> 3, j >> 3) * .08);
    else c.copy(grass).multiplyScalar(.85 + hash(i >> 2, j >> 2) * .2);
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 1, dd = cc + 1; idx.push(a, cc, b, b, cc, dd); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); res.push(g);
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .82, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); res.push(mat);
  if (!lowDetail) { const nm = new T.TextureLoader().load('./assets/ambientcg/Gravel041/Gravel041_NormalGL.jpg'); nm.wrapS = nm.wrapT = T.RepeatWrapping; mat.normalMap = nm; mat.normalScale.set(.18, .18); res.push(nm); }
  const m = new T.Mesh(g, mat); m.receiveShadow = true; m.castShadow = !lowDetail; m.name = 'environment:bowl-concrete'; group.add(m);
  // steel coping round the lip
  const pts = []; const N = 160, B = BOWL;
  for (let k = 0; k <= N; k++) { // walk the rounded rectangle at the lip distance
    const t = k / N * 4, side = Math.floor(t) % 4, f = t - Math.floor(t), r = B.rc + DLIP, hx = B.ax - B.rc, hz = B.az - B.rc;
    const corners = [[hx, hz, 0], [-hx, hz, Math.PI / 2], [-hx, -hz, Math.PI], [hx, -hz, 1.5 * Math.PI]], [cx, cz, a0] = corners[side], a = a0 + f * Math.PI / 2;
    pts.push(new T.Vector3(B.x + cx + Math.cos(a) * r, BOWL_TOP + .02, B.z + cz + Math.sin(a) * r));
  }
  const curve = new T.CatmullRomCurve3(pts, true), tube = new T.TubeGeometry(curve, 320, .06, 8, true), steel = new T.MeshStandardMaterial({ color: 0xd8dde3, roughness: .3, metalness: .9 }); res.push(tube, steel);
  const cop = new T.Mesh(tube, steel); cop.castShadow = !lowDetail; cop.name = 'environment:bowl-coping'; group.add(cop);
  return { group, dispose() { res.forEach(r => r.dispose?.()); group.removeFromParent(); } };
}
