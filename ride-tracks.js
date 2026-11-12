// Tyre tracks (v2.1-24): each wheel leaves a dark ribbon pressed into the ground where it rolls, stronger
// under load, braking, drive and slides, fading out over time. It's what makes the tyres read as gripping
// the dirt instead of floating over it. One small ring buffer of quads per wheel, updated in place.
export function makeTyreTracks(T, scene, height, { segments = 420, width = 0.075 } = {}) {
  const wheels = [0, 1].map(() => ({ last: null, head: 0, count: 0 }));
  const N = segments * 2, quads = N, pos = new Float32Array(quads * 4 * 3), col = new Float32Array(quads * 4 * 4), idx = new Uint32Array(quads * 6);
  for (let q = 0; q < quads; q++) { const v = q * 4; idx.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], q * 6); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('color', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
  geo.setIndex(new T.BufferAttribute(idx, 1));
  const mat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.name = 'wk:tyre-tracks'; mesh.renderOrder = 1; scene.add(mesh);
  const age = new Float32Array(quads), strength = new Float32Array(quads);
  const tint = [0.16, 0.11, 0.07];
  function writeQuad(q, a, b, s) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L * width, nz = dx / L * width;
    const ya = height(a.x, a.z) + 0.018, yb = height(b.x, b.z) + 0.018, o = q * 12;
    pos.set([a.x - nx, ya, a.z - nz, a.x + nx, ya, a.z + nz, b.x - nx, yb, b.z - nz, b.x + nx, yb, b.z + nz], o);
    strength[q] = s; age[q] = 0;
  }
  return {
    // i: wheel (0 rear, 1 front); p: contact point {x,z}; grounded; s: 0..1 how hard the tyre presses/slips
    mark(i, p, grounded, s) {
      const w = wheels[i];
      if (!grounded || s < 0.04) { w.last = null; return; }
      if (!w.last) { w.last = { x: p.x, z: p.z }; return; }
      const d = Math.hypot(p.x - w.last.x, p.z - w.last.z);
      if (d < 0.22) return;
      if (d > 3) { w.last = { x: p.x, z: p.z }; return; } // teleport or crash: don't draw a streak
      const q = i * segments + w.head; w.head = (w.head + 1) % segments;
      writeQuad(q, w.last, p, Math.min(1, s)); w.last = { x: p.x, z: p.z };
    },
    update(dt) {
      for (let q = 0; q < quads; q++) {
        if (strength[q] <= 0) { col.fill(0, q * 16, q * 16 + 16); continue; }
        age[q] += dt; const a = strength[q] * 0.55 * Math.max(0, 1 - age[q] / 25);
        if (a <= 0) { strength[q] = 0; col.fill(0, q * 16, q * 16 + 16); continue; }
        for (let k = 0; k < 4; k++) col.set([tint[0], tint[1], tint[2], a], q * 16 + k * 4);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
    clear() { strength.fill(0); wheels.forEach(w => { w.last = null; }); },
    dispose() { geo.dispose(); mat.dispose(); mesh.removeFromParent(); },
  };
}
