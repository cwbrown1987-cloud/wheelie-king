// Turn an assembled prop (or a whole room of them) into few draw calls while the
// source parts stay reusable: meshes sharing geometry+material and repeated >= minInstances
// become one InstancedMesh; everything else is merged into one mesh per material.
export function bakeStatic(T, root, { minInstances = 48, keepNames = false } = {}) {
 root.updateMatrixWorld(true);
 const inv = new T.Matrix4().copy(root.matrixWorld).invert();
 const byPair = new Map(), out = new T.Group(); out.name = (root.name || 'kit') + ':baked';
 root.traverse(o => {
  if (!o.isMesh || o.isInstancedMesh || !o.visible) return;
  const k = o.geometry.uuid + '|' + o.material.uuid;
  if (!byPair.has(k)) byPair.set(k, []);
  byPair.get(k).push(o);
 });
 const merge = new Map(); let instanced = 0;
 for (const list of byPair.values()) {
  const { geometry, material } = list[0];
  if (list.length >= minInstances) {
   const im = new T.InstancedMesh(geometry, material, list.length); const m = new T.Matrix4();
   list.forEach((o, i) => { m.multiplyMatrices(inv, o.matrixWorld); im.setMatrixAt(i, m); });
   im.castShadow = im.receiveShadow = true; im.renderOrder = list[0].renderOrder; im.name = 'kit:instanced'; out.add(im); instanced++;
  } else for (const o of list) { if (!merge.has(material)) merge.set(material, []); merge.get(material).push(o); }
 }
 for (const [material, list] of merge) {
  const parts = list.map(o => { let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); if (!g.attributes.uv) g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; });
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let off = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3); uv.set(g.attributes.uv.array, off * 2); off += g.attributes.position.count; g.dispose(); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.computeBoundingSphere(); geo.computeBoundingBox();
  const mesh = new T.Mesh(geo, material); mesh.castShadow = mesh.receiveShadow = !material.transparent; mesh.renderOrder = list[0].renderOrder; mesh.name = keepNames ? list.map(o => o.name).join(',') : 'kit:merged'; out.add(mesh);
 }
 out.userData.drawCalls = out.children.length; out.userData.instanced = instanced;
 out.userData.dispose = () => out.traverse(o => { if (o.isMesh && o.name === 'kit:merged') o.geometry.dispose(); });
 return out;
}
