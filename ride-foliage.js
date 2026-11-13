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
  // v2.1-49: Poly Haven photo-scanned models (CC0), decimated + webp textures (tools: gltf-transform). Sets hold several
  // variants as separate meshes: each placement picks one ("split").
  phShrub2: 'ph:shrub_02', phShrub3: 'ph:shrub_03', phShrub4: 'ph:shrub_04', phFern: 'ph:fern_02', phWeed: 'ph:weed_plant_02', phNettle: 'ph:nettle_plant',
  phDand: 'ph:dandelion_01', phGrass: 'ph:grass_medium_02', phRockA: 'ph:rock_moss_set_01', phRockB: 'ph:rock_moss_set_02', phRock7: 'ph:rock_07', phRock9: 'ph:rock_09',
  phStone: 'ph:stone_01', phStump1: 'ph:tree_stump_01', phStump2: 'ph:tree_stump_02', phLog: 'ph:dead_tree_trunk_02',
};
const modelUrl = m => FOLIAGE_MODELS[m].startsWith('ph:') ? './assets/polyhaven/models/' + FOLIAGE_MODELS[m].slice(3) + '.glb' : DIR + FOLIAGE_MODELS[m] + '.gltf';
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
  // (same on every quality: some are solid) rocks (mossy sets, single rocks, stones) in drifts; stumps and fallen logs round the tree clumps
  const rocks = ['phRockA', 'phRockB', 'phRock7', 'phRock9', 'phStone', 'phRockA'];
  pick(220, 'solid', (x, z) => .08 + thicket(x, z) * .5 + Math.max(0, .45 - meadow(x, z)), (x, z) => { const m = rocks[Math.floor(rnd() * rocks.length)], sc = m === 'phRock7' || m === 'phRock9' ? .25 + rnd() * .35 : m === 'phStone' ? .5 + rnd() * .7 : .6 + rnd() * 1.1; out.push({ m, v: rnd(), x, z, s: sc, rot: rnd() * 6.283, tilt: (rnd() - .5) * .3 }); if (sc > 1.15 && (m === 'phRockA' || m === 'phRockB')) posts.push({ x, z, r: .4 * sc, kind: 'rock', h: (height?.(x, z) || 0) + .5 * sc }); });
  pick(50, 'solid', (x, z) => thicket(x, z), (x, z) => { const m = ['phStump1', 'phStump2', 'phLog'][Math.floor(rnd() * 3)], sc = .8 + rnd() * .5; out.push({ m, x, z, s: sc, rot: rnd() * 6.283 }); posts.push({ x, z, r: m === 'phLog' ? .35 : .4 * sc, kind: 'tree', h: (height?.(x, z) || 0) + .8 }); });
  // bushes and ferns round the clumps and in the meadows (ride through)
  const shrubs = ['phShrub2', 'phShrub3', 'phShrub4', 'phShrub3', 'phWeed', 'phNettle'];
  pick(lowDetail ? 160 : 420, 'solid', (x, z) => .15 + thicket(x, z) * .8 + meadow(x, z) * .3, (x, z) => out.push({ m: shrubs[Math.floor(rnd() * shrubs.length)], v: rnd(), x, z, s: .8 + rnd() * .7, rot: rnd() * 6.283 }));
  pick(lowDetail ? 50 : 170, 'solid', (x, z) => thicket(x, z) + .05, (x, z) => out.push({ m: 'phFern', v: rnd(), x, z, s: .8 + rnd() * .6, rot: rnd() * 6.283 }));
  // grass tufts in drifts, clover and flower patches, mushrooms under the trees
  const drift = (n, m, sMin, sMax, dens, spread = 2.2) => { let c = 0, guard = 0; while (c < n && guard++ < n * 6) { const cx = x0 + rnd() * W, cz = z0 + rnd() * H; if (rnd() > dens(cx, cz)) continue;
    const k = 4 + Math.floor(rnd() * 8); for (let i = 0; i < k && c < n; i++) { const x = cx + (rnd() - .5) * spread * 2, z = cz + (rnd() - .5) * spread * 2; if (!keep(x, z, 'grass')) continue; out.push({ m, x, z, s: sMin + rnd() * (sMax - sMin), rot: rnd() * 6.283 }); c++; } } };
  /* v2.1-53: the old Quaternius grass tufts and clover are gone: the GPU grass field (ride-grass.js) covers that */
  drift(lowDetail ? 90 : 240, rnd() < .5 ? 'flower3' : 'flower4', .2, .32, (x, z) => Math.max(0, meadow(x, z) - .35) * 1.6, 1.6);
  drift(lowDetail ? 60 : 160, 'flower4', .2, .3, (x, z) => Math.max(0, .55 - meadow(x, z)), 1.6);
  drift(lowDetail ? 40 : 140, 'mush', .5, .9, (x, z) => thicket(x, z), 1.2);
  if (!lowDetail) { drift(700, 'phGrass', .7, 1.2, meadow, 2.6); drift(260, 'phDand', .8, 1.3, (x, z) => Math.max(0, meadow(x, z) - .3) * 1.4, 1.8); } // real grass clumps + dandelions where it's lush
  for (const o of out) if (o.v == null) o.v = rnd();
  return { items: out, posts };
}

// v2.1-49 draw distances (m): small things only exist near the rider, in 50 m cells, so the photo-scanned grass,
// flowers and shrubs cost nothing far away. Trees and rocks stay out to the horizon.
const DRAW = { phGrass: 55, phDand: 65, grassS: 95, grassT: 95, clover: 70, flower3: 85, flower4: 85, mush: 60, phFern: 130, phShrub2: 150, phShrub3: 150, phShrub4: 150, phWeed: 120, phNettle: 120, phRockA: 260, phRockB: 260, phRock7: 200, phRock9: 200, phStone: 200, phStump1: 240, phStump2: 240, phLog: 240 };
// v2.1-50 style grade: photo-scanned models are pushed a little toward the stylised kit (richer colour, slightly
// lifted) so the realistic rocks and plants sit with the cartoon trees instead of looking pasted in
export function styleGrade(mm, { sat = 1.3, lift = 1.06, warm = 0 } = {}) {
  if (mm.userData.wkGraded) return; mm.userData.wkGraded = true; const prev = mm.onBeforeCompile;
  mm.onBeforeCompile = (sh, r) => { prev?.call(mm, sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
{ float l=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=max(mix(vec3(l),diffuseColor.rgb,${sat.toFixed(2)})*${lift.toFixed(2)}+vec3(${warm.toFixed(3)},${(warm * .4).toFixed(3)},0.),0.); }`); };
  const key = mm.customProgramCacheKey?.bind(mm); mm.customProgramCacheKey = () => (key ? key() : '') + 'wkg' + sat + lift + warm; mm.needsUpdate = true;
}
// soft contact shadows: a dark blurred disc under each solid thing (cheap stand-in for ambient occlusion)
export function makeBlobShadows(T, root, list, { height, name = 'contact-shadows', strength = .55 } = {}) {
  if (!list.length) return null;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.45, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new T.CanvasTexture(c), mat = new T.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: strength, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const geo = new T.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const inst = new T.InstancedMesh(geo, mat, list.length), M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), up = new T.Vector3(0, 1, 0), n = new T.Vector3();
  list.forEach((b, k) => { const y = b.y ?? height(b.x, b.z); if (height) { const e = .5; n.set(height(b.x - e, b.z) - height(b.x + e, b.z), 2 * e, height(b.x, b.z - e) - height(b.x, b.z + e)).normalize(); Q.setFromUnitVectors(up, n); } else Q.identity();
    M.compose(V.set(b.x, y + .03, b.z), Q, S.set(b.r * 2, 1, (b.rz || b.r) * 2)); inst.setMatrixAt(k, M); });
  inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.name = 'environment:' + name; inst.renderOrder = 1; root.add(inst);
  return { mesh: inst, dispose() { geo.dispose(); mat.dispose(); tex.dispose(); inst.removeFromParent(); } };
}
export function makeFoliageVisuals(T, root, GLTFLoader, items, height, { lowDetail = false, cell = 260, tint: tints = null } = {}) {
  const group = new T.Group(); group.name = 'environment:foliage'; root.add(group);
  const res = []; let disposed = false;
  // group by model, then by big cells so whole fields off-screen get culled
  const byModel = new Map();
  const cellOf = m => DRAW[m] && DRAW[m] < 200 ? 50 : cell, culled = [];
  for (const p of items) { const key = p.m; if (!byModel.has(key)) byModel.set(key, new Map()); const cm = byModel.get(key), cs = cellOf(key), ck = Math.floor(p.x / cs) + ':' + Math.floor(p.z / cs); if (!cm.has(ck)) cm.set(ck, []); cm.get(ck).push(p); }
  const loader = new GLTFLoader(), M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  for (const [m, cells] of byModel) loader.loadAsync(modelUrl(m)).then(g => {
    if (disposed) return; g.scene.updateMatrixWorld(true);
    const ph = FOLIAGE_MODELS[m].startsWith('ph:'), meshes = []; g.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    const split = ph && meshes.length > 1, base = new T.Matrix4(), box = new T.Box3();
    meshes.forEach((o, mi) => {
      res.push(o.geometry);
      const tint = { grassS: '#93c95a', grassT: '#7cb84c' }[m], petal = tints?.[m]; if (petal) [].concat(o.material).forEach(mm => { if (mm.name === 'Flowers') { mm.color = new T.Color(petal); mm.customProgramCacheKey = () => 'wk-petal'; mm.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\nvec4 wkPt=texture2D(map,vMapUv);diffuseColor*=vec4(vec3(min(1.2,dot(wkPt.rgb,vec3(.3,.59,.11))*2.)),wkPt.a);\n#endif'); }; mm.needsUpdate = true; } }); if (tints) [].concat(o.material).forEach(mm => { const c = tints[mm.name]; if (c) mm.color = new T.Color(c); });
      [].concat(o.material).forEach(mm => { if (tint && mm.name === 'Grass') { mm.color.set(tint); }
        if (!ph && !m.startsWith('oak') && !m.startsWith('pine')) { mm.vertexColors = false; mm.needsUpdate = true; }
        if (ph) styleGrade(mm, /phRock|phStone|phStump|phLog/.test(m) ? { sat: 1.2, lift: 1.08 } : { sat: 1.35, lift: 1.1 });
        res.push(mm); mm.map && res.push(mm.map); if (mm.alphaTest > 0 || mm.transparent) { mm.transparent = false; mm.alphaTest = Math.max(.45, mm.alphaTest || 0); mm.side = T.DoubleSide; } });
      // a set's variant: drop its layout offset and stand it on the ground
      base.copy(o.matrixWorld); if (split) { base.setPosition(0, 0, 0); box.copy(o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox)).applyMatrix4(base); base.premultiply(new T.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)); }
      for (const all of cells.values()) {
        const list = split ? all.filter(p => Math.floor(p.v * meshes.length) % meshes.length === mi) : all; if (!list.length) continue;
        const inst = new T.InstancedMesh(o.geometry, o.material, list.length);
        list.forEach((p, k) => { Q.setFromAxisAngle(up, p.rot); if (p.tilt) Q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), p.tilt)); V.set(p.x, height(p.x, p.z) - (ph ? .06 * p.s : .03), p.z); S.setScalar(p.s); M.compose(V, Q, S).multiply(base); inst.setMatrixAt(k, M); });
        inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere();
        const big = m.startsWith('oak') || m.startsWith('pine') || /phRock|phStone|phStump|phLog/.test(m);
        inst.castShadow = big && !lowDetail; inst.receiveShadow = !m.startsWith('grass'); inst.name = 'foliage:' + m; group.add(inst);
        if (DRAW[m]) { const bs = inst.boundingSphere; inst.userData.cull = { x: bs.center.x, z: bs.center.z, d: DRAW[m] * (lowDetail ? .7 : 1) + bs.radius }; culled.push(inst); inst.visible = false; lastX = 1e9; }
      }
    });
  }).catch(e => console.warn('[wk] foliage model failed', m, e));
  let lastX = 1e9, lastZ = 1e9;
  const update = (x, z) => { if (Math.abs(x - lastX) + Math.abs(z - lastZ) < 4) return; lastX = x; lastZ = z; for (const m of culled) { const c = m.userData.cull; m.visible = (c.x - x) ** 2 + (c.z - z) ** 2 < c.d * c.d; } };
  // contact shadows under trees, rocks, stumps and logs
  const blobs = [], radius = { oak3: 1.5, oak5: 1.6, pine1: 1.2, pine5: 1.3, phRockA: .9, phRockB: .9, phRock7: 1.1, phRock9: 1.1, phStone: .6, phStump1: .8, phStump2: .8, phLog: 1.2, phShrub2: .7, phShrub3: .6, phShrub4: .7 };
  for (const p of items) if (radius[p.m]) blobs.push({ x: p.x, z: p.z, r: radius[p.m] * p.s });
  const shadows = lowDetail ? null : makeBlobShadows(T, group, blobs, { height });
  return { group, update, dispose() { shadows?.dispose(); disposed = true; res.forEach(r => r.dispose?.()); group.removeFromParent(); } };
}
