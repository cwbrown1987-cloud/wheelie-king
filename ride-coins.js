// Coins (v2.1-37): spinning gold coins you ride through. One instanced mesh for a whole list of {x,y,z}.
// In the Playground they come back a while after you take them (respawn), so free roam keeps paying a little.
export function makeCoins(T, root, list, { respawn = 0 } = {}) {
  const mat = new T.MeshStandardMaterial({ color: '#ffc93c', emissive: '#ff9a1a', emissiveIntensity: .55, metalness: .85, roughness: .25 });
  const geo = new T.CylinderGeometry(.42, .42, .09, 20); geo.rotateX(Math.PI / 2);
  const mesh = new T.InstancedMesh(geo, mat, list.length); mesh.name = 'wk:coins'; mesh.frustumCulled = false; root.add(mesh);
  const gone = new Float32Array(list.length), M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3(1, 1, 1);
  let spin = 0;
  const place = () => { for (let k = 0; k < list.length; k++) { const c = list[k]; if (gone[k] > 0) M.makeScale(0, 0, 0); else { E.set(0, spin + k * .37, 0); Q.setFromEuler(E); M.compose(V.set(c.x, c.y + Math.sin(spin * 2 + k) * .06, c.z), Q, S); } mesh.setMatrixAt(k, M); } mesh.instanceMatrix.needsUpdate = true; };
  place();
  return {
    mesh,
    update(dt) { spin += dt * 2.6; if (respawn) for (let k = 0; k < gone.length; k++) if (gone[k] > 0) gone[k] = Math.max(0, gone[k] - dt); place(); },
    // collect any coin within reach of the rider (x, y = rider's middle, z); returns how many were taken
    collect(x, y, z, r = 1.3) { let n = 0; for (let k = 0; k < list.length; k++) { if (gone[k] > 0) continue; const c = list[k], dx = c.x - x, dz = c.z - z; if (dx * dx + dz * dz < r * r && Math.abs(c.y - y) < 1.5) { gone[k] = respawn || 1e9; n++; } } return n; },
    reset() { gone.fill(0); },
    dispose() { geo.dispose(); mat.dispose(); mesh.removeFromParent(); },
  };
}
