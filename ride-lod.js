// Ride-only geometry swaps: same look at ride-camera distance, far fewer triangles.
// The garage keeps its full-detail meshes; we only replace geometry on the ride scene's own copies.
export const RIDE_LOD = { gridStep: 2, rotorSegments: 20 };

// Halve a square vertex grid (helmet shell/visor are 65x65 vertex grids = 8192 triangles each).
export function decimateGrid(T, geo, step = RIDE_LOD.gridStep) {
  const n = Math.round(Math.sqrt(geo.attributes.position.count)), src = geo.index?.array;
  if (!src || n * n !== geo.attributes.position.count || (n - 1) % step) return null;
  const c = n - 1, lens = src[1] === 1; // winding: shell (a,c,b,b,c,d) or lens (a,b,c,b,d,c)
  const idx = [];
  for (let j = 0; j < c; j += step) for (let i = 0; i < c; i += step) {
    const a = j * n + i, b = a + step, cc = a + step * n, d = cc + step;
    if (lens) idx.push(a, b, cc, b, d, cc); else idx.push(a, cc, b, b, cc, d);
  }
  const out = new T.BufferGeometry();
  for (const [k, v] of Object.entries(geo.attributes)) out.setAttribute(k, v);
  out.setIndex(idx); out.computeBoundingSphere(); return out;
}

// A plain drilled-look-free brake disc: outer ring + centre hole, same size and thickness.
export function simpleRotor(T, geo) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox, r = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) / 2, depth = bb.max.z - bb.min.z;
  const s = new T.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false);
  const h = new T.Path(); h.absarc(0, 0, r - 0.026, 0, Math.PI * 2, true); s.holes.push(h);
  const out = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: RIDE_LOD.rotorSegments });
  out.translate((bb.max.x + bb.min.x) / 2, (bb.max.y + bb.min.y) / 2, bb.min.z); return out;
}

export function lightenForRide(T, root) {
  const made = [], stats = { swapped: 0, before: 0, after: 0 }, tri = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    let g = null;
    if (/helmet:(shell|visor)$/.test(o.name)) g = decimateGrid(T, o.geometry);
    else if (/brake:rotor$/.test(o.name) && o.geometry.type === 'ExtrudeGeometry') g = simpleRotor(T, o.geometry);
    if (!g) return;
    stats.before += tri(o.geometry); stats.after += tri(g); stats.swapped++;
    o.geometry = g; made.push(g); // the original stays owned by the garage scene
  });
  stats.dispose = () => made.forEach(g => g.dispose());
  return stats;
}
