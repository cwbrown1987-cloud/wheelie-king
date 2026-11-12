// Playground skate park (v2.1-25): Kenney "Mini Skate" (CC0) pieces laid out as a park north-east of the
// track: quarter pipes round the edges, a funbox, a ledge with steps, a spine, rails, a kicker, benches.
// The collision is baked from the pieces' own triangles (tools/bake-skatepark.mjs) into a 10 cm height grid,
// so the bike rides the real shapes: transitions, decks, steps, box sides, rails.
// v2.1-29: baked at bike scale (1.5x the kit), quarter pipes with decks behind them; covers +-34 x +-28 m
export const PARK = { dir: './assets/kenney/mini-skate/', x: 165, z: 85, hx: 34, hz: 28 };
let meta = null, grid = null, loading = null;
export const parkLoaded = () => !!meta;
export function loadPark(read) {
  if (loading) return loading;
  const get = read || (async (f, bin) => { const r = await fetch(PARK.dir + f); if (!r.ok) throw Error(f + ' ' + r.status); return bin ? r.arrayBuffer() : r.json(); });
  loading = (async () => { const m = await get('park.json', false); grid = new Uint16Array(await get(m.grid.file, true)); meta = m; return m; })().catch(e => { loading = null; throw e; });
  return loading;
}
export function parkHeight(x, z) {
  if (!meta) return 0; const g = meta.grid, lx = x - PARK.x, lz = z - PARK.z;
  const fi = (lx + g.halfX) / g.step - .5, fj = (lz + g.halfZ) / g.step - .5;
  if (fi < 0 || fj < 0 || fi >= g.nx - 1 || fj >= g.nz - 1) return 0;
  const i = fi | 0, j = fj | 0, fx = fi - i, fy = fj - j, n = g.nx;
  return (grid[j * n + i] * (1 - fx) * (1 - fy) + grid[j * n + i + 1] * fx * (1 - fy) + grid[(j + 1) * n + i] * (1 - fx) * fy + grid[(j + 1) * n + i + 1] * fx * fy) * g.unit;
}
// The ring by the track start drops you at the park's open south side, facing in.
export const PARK_ENTRY = { x: PARK.x, z: PARK.z + 31, yaw: -Math.PI / 2, vx: 2 };

export function makeSkateParkVisuals(T, root, GLTFLoader, { lowDetail = false } = {}) {
  const group = new T.Group(); group.name = 'environment:skatepark'; root.add(group);
  const res = []; let disposed = false;
  loadPark().then(m => {
    if (disposed) return;
    const byFile = new Map(); for (const p of m.pieces) { if (!byFile.has(p.f)) byFile.set(p.f, []); byFile.get(p.f).push(p); }
    // deck slabs behind the quarter pipes (concrete top, painted sides), matching the baked collision
    if (m.decks) { const top = new T.MeshStandardMaterial({ color: 0x9c9aa6, roughness: .9 }), side = new T.MeshStandardMaterial({ color: 0xd98b5f, roughness: .8 }); res.push(top, side);
      for (const d of m.decks) { const g = new T.BoxGeometry(d.x1 - d.x0, d.h, d.z1 - d.z0); res.push(g); const b = new T.Mesh(g, [side, side, top, side, side, side]); b.position.set(PARK.x + (d.x0 + d.x1) / 2, d.h / 2 - .01, PARK.z + (d.z0 + d.z1) / 2); b.castShadow = !lowDetail; b.receiveShadow = true; b.name = 'skatepark:deck'; group.add(b); } }
    const loader = new GLTFLoader(), M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), Sv = new T.Vector3(), up = new T.Vector3(0, 1, 0), local = new T.Matrix4();
    for (const [f, list] of byFile) loader.loadAsync(PARK.dir + f + '.glb').then(g => {
      if (disposed) return;
      g.scene.updateMatrixWorld(true);
      // one instanced mesh per mesh in the piece: a hundred floor tiles cost one draw call
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        const inst = new T.InstancedMesh(o.geometry, o.material, list.length); res.push(o.geometry); [].concat(o.material).forEach(mm => { res.push(mm); mm.map && res.push(mm.map); });
        local.copy(o.matrixWorld);
        list.forEach((p, k) => { Q.setFromAxisAngle(up, p.r * Math.PI / 2); V.set(PARK.x + p.x, 0, PARK.z + p.z); Sv.setScalar(p.s); M.compose(V, Q, Sv).multiply(local); inst.setMatrixAt(k, M); });
        inst.instanceMatrix.needsUpdate = true; inst.castShadow = f !== 'floor-concrete' && !lowDetail; inst.receiveShadow = true; inst.name = 'skatepark:' + f;
        if (f === 'floor-concrete') inst.position.y = 0.01;
        group.add(inst);
      });
    }).catch(e => console.warn('[wk] skate piece failed', f, e));
  }).catch(e => console.warn('[wk] skate park failed to load', e));
  return { group, dispose() { disposed = true; res.forEach(r => r.dispose?.()); group.removeFromParent(); } };
}
