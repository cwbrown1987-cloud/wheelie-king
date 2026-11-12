// Playground foliage (v2.1-34): makes the open ground feel alive. Quaternius "Stylized Nature MegaKit" (CC0)
// leafy trees and pines in clumps (solid, like the other trees), bushes, ferns, flowers, clover, grass tufts and
// mushrooms scattered by noise so there are meadows, thickets and bare patches, kept off the tracks, ramps, roads
// and built areas. Grass and flowers are just looks (ride straight through); trees are posts you can hit.
// The downhill's trees use the same leafy models (Descenders-style forest instead of desert quiver trees).
const DIR = './assets/quaternius/nature/';
export const FOLIAGE_MODELS = {
  oak3: 'CommonTree_3', oak5: 'CommonTree_5', pine1: 'Pine_1', pine5: 'Pine_5',
  bush: 'Bush_Common', bushF: 'Bush_Common_Flowers', fern: 'Fern_1',
  grassS: 'Grass_Common_Short', grassT: 'Grass_Common_Tall', clover: 'Clover_1',
  flower3: 'Flower_3_Group', flower4: 'Flower_4_Group', mush: 'Mushroom_Common',
};
function hash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v; }
// keep = (x,z,kind) => true where that kind may go ('grass' only avoids hard surfaces; 'solid' avoids anywhere you ride)
export function buildFoliage({ keep, area, lowDetail = false, height }) {
  const out = [], posts = []; let seed = 77; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const { x0, x1, z0, z1 } = area, W = x1 - x0, H = z1 - z0;
  const pick = (n, kind, dens, place) => { let tries = 0; for (let k = 0; k < n && tries < n * 8; tries++) { const x = x0 + rnd() * W, z = z0 + rnd() * H; if (rnd() > dens(x, z) || !keep(x, z, kind)) continue; place(x, z); k++; } };
  const meadow = (x, z) => vnoise(x / 38, z / 38) * .75 + vnoise(x / 9 + 40, z / 9) * .25;      // lush where high
  const thicket = (x, z) => Math.max(0, (vnoise(x / 60 + 11, z / 60 - 7) - .52) * 3.2);          // tree clumps
  // trees in clumps (solid)
  const nTrees = 220; // same on every quality: trees are solid, physics must match
  pick(nTrees, 'solid', (x, z) => .03 + thicket(x, z), (x, z) => {
    const m = ['oak3', 'oak5', 'pine1', 'pine5'][Math.floor(rnd() * 4)], s = .75 + rnd() * .45;
    out.push({ m, x, z, s, rot: rnd() * 6.283 }); posts.push({ x, z, r: .3 * s + .05, kind: 'tree', h: (height?.(x, z) || 0) + 6 * s });
  });
  // bushes and ferns round the clumps and in the meadows (ride through)
  pick(lowDetail ? 160 : 420, 'solid', (x, z) => .15 + thicket(x, z) * .8 + meadow(x, z) * .3, (x, z) => out.push({ m: rnd() < .35 ? 'bushF' : 'bush', x, z, s: .7 + rnd() * .6, rot: rnd() * 6.283 }));
  pick(lowDetail ? 50 : 150, 'solid', (x, z) => thicket(x, z), (x, z) => out.push({ m: 'fern', x, z, s: .22 + rnd() * .12, rot: rnd() * 6.283 }));
  // grass tufts in drifts, clover and flower patches, mushrooms under the trees
  const drift = (n, m, sMin, sMax, dens, spread = 2.2) => { let c = 0, guard = 0; while (c < n && guard++ < n * 6) { const cx = x0 + rnd() * W, cz = z0 + rnd() * H; if (rnd() > dens(cx, cz)) continue;
    const k = 4 + Math.floor(rnd() * 8); for (let i = 0; i < k && c < n; i++) { const x = cx + (rnd() - .5) * spread * 2, z = cz + (rnd() - .5) * spread * 2; if (!keep(x, z, 'grass')) continue; out.push({ m, x, z, s: sMin + rnd() * (sMax - sMin), rot: rnd() * 6.283 }); c++; } } };
  drift(lowDetail ? 1300 : 3600, 'grassS', .45, .75, meadow);
  drift(lowDetail ? 250 : 800, 'grassT', .4, .62, (x, z) => meadow(x, z) * .8);
  drift(lowDetail ? 120 : 380, 'clover', .35, .55, (x, z) => meadow(x, z) * .6, 1.4);
  drift(lowDetail ? 140 : 420, rnd() < .5 ? 'flower3' : 'flower4', .2, .32, (x, z) => Math.max(0, meadow(x, z) - .35) * 1.6, 1.6);
  drift(lowDetail ? 140 : 420, 'flower4', .2, .3, (x, z) => Math.max(0, .55 - meadow(x, z)), 1.6);
  drift(lowDetail ? 40 : 140, 'mush', .5, .9, (x, z) => thicket(x, z), 1.2);
  return { items: out, posts };
}

export function makeFoliageVisuals(T, root, GLTFLoader, items, height, { lowDetail = false, cell = 260 } = {}) {
  const group = new T.Group(); group.name = 'environment:foliage'; root.add(group);
  const res = []; let disposed = false;
  // group by model, then by big cells so whole fields off-screen get culled
  const byModel = new Map();
  for (const p of items) { const key = p.m; if (!byModel.has(key)) byModel.set(key, new Map()); const cm = byModel.get(key), ck = Math.floor(p.x / cell) + ':' + Math.floor(p.z / cell); if (!cm.has(ck)) cm.set(ck, []); cm.get(ck).push(p); }
  const loader = new GLTFLoader(), M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  for (const [m, cells] of byModel) loader.loadAsync(DIR + FOLIAGE_MODELS[m] + '.gltf').then(g => {
    if (disposed) return; g.scene.updateMatrixWorld(true);
    g.scene.traverse(o => {
      if (!o.isMesh) return; res.push(o.geometry);
      // the kit's grass texture is near-white (it's tinted in Quaternius' own shader): tint it here, per tuft type
      const tint = { grassS: '#93c95a', grassT: '#7cb84c' }[m];
      [].concat(o.material).forEach(mm => { if (tint && mm.name === 'Grass') { mm.color.set(tint); }
        // its vertex colours are wind/AO masks for Quaternius' shader (black at the base): ignore them
        if (!m.startsWith('oak') && !m.startsWith('pine')) { mm.vertexColors = false; mm.needsUpdate = true; }
        res.push(mm); mm.map && res.push(mm.map); if (mm.alphaTest > 0 || mm.transparent) { mm.transparent = false; mm.alphaTest = Math.max(.45, mm.alphaTest || 0); mm.side = T.DoubleSide; } });
      for (const list of cells.values()) {
        const inst = new T.InstancedMesh(o.geometry, o.material, list.length);
        list.forEach((p, k) => { Q.setFromAxisAngle(up, p.rot); V.set(p.x, height(p.x, p.z) - .03, p.z); S.setScalar(p.s); M.compose(V, Q, S).multiply(o.matrixWorld); inst.setMatrixAt(k, M); });
        inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere();
        const big = m.startsWith('oak') || m.startsWith('pine');
        inst.castShadow = big && !lowDetail; inst.receiveShadow = !m.startsWith('grass'); inst.name = 'foliage:' + m; group.add(inst);
      }
    });
  }).catch(e => console.warn('[wk] foliage model failed', m, e));
  return { group, dispose() { disposed = true; res.forEach(r => r.dispose?.()); group.removeFromParent(); } };
}
