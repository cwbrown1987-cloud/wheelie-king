// Turn an assembled prop (or a whole room of them) into few draw calls while the
// source parts stay reusable.
//  - untextured opaque PBR materials are merged into ONE material per (type, clearcoat,
//    side): colour, roughness, metalness and emissive travel as vertex attributes, so a
//    red chest, a chrome handle and a neon tube can share a draw call
//  - textured / transparent materials merge when their settings match (same map, colour,
//    opacity...), otherwise per material
//  - meshes sharing geometry+material repeated >= minInstances become an InstancedMesh
const r2 = v => Math.round((v ?? 0) * 100) / 100;
const PATCH_KEY = 'kit-vertex-pbr-1';
function patchVertexPbr(mat) {
 mat.onBeforeCompile = s => {
  s.vertexShader = s.vertexShader
   .replace('#include <common>', '#include <common>\nattribute vec2 pbr;\nattribute vec3 emis;\nvarying vec2 vPbr;\nvarying vec3 vEmis;')
   .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = pbr; vEmis = emis;');
  s.fragmentShader = s.fragmentShader
   .replace('#include <common>', '#include <common>\nvarying vec2 vPbr;\nvarying vec3 vEmis;')
   .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vPbr.x;')
   .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vPbr.y;')
   .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vEmis;');
 };
 mat.customProgramCacheKey = () => PATCH_KEY;
 return mat;
}
export function bakeStatic(T, root, { minInstances = 256, vertexColours = true, castShadow = false } = {}) {
 root.updateMatrixWorld(true);
 const inv = new T.Matrix4().copy(root.matrixWorld).invert();
 const byPair = new Map(), out = new T.Group(); out.name = (root.name || 'kit') + ':baked';
 root.traverse(o => {
  if (!o.isMesh || o.isInstancedMesh || !o.visible) return;
  const k = o.geometry.uuid + '|' + o.material.uuid;
  if (!byPair.has(k)) byPair.set(k, []);
  byPair.get(k).push(o);
 });
 const vcSig = m => {
  if (!vertexColours || m.map || m.alphaMap || m.emissiveMap || m.normalMap || m.roughnessMap || m.metalnessMap || m.transparent || !m.isMeshStandardMaterial) return null;
  return [m.type, r2(m.clearcoat), r2(m.clearcoatRoughness), r2(m.envMapIntensity), m.side, m.flatShading ? 1 : 0].join('|');
 };
 const matSig = m => [m.type, m.map?.uuid, m.alphaMap?.uuid, m.emissiveMap?.uuid, m.normalMap?.uuid, m.roughnessMap?.uuid, m.color?.getHexString(), m.emissive?.getHexString(), r2(m.emissiveIntensity), r2(m.roughness), r2(m.metalness), r2(m.clearcoat), r2(m.opacity), m.transparent, m.depthWrite, m.blending, m.side, m.toneMapped, r2(m.envMapIntensity)].join('|');
 const groups = new Map(); let instanced = 0;
 for (const list of byPair.values()) {
  const { geometry, material } = list[0];
  if (list.length >= minInstances) {
   const im = new T.InstancedMesh(geometry, material, list.length); const m = new T.Matrix4();
   list.forEach((o, i) => { m.multiplyMatrices(inv, o.matrixWorld); im.setMatrixAt(i, m); });
   im.castShadow = castShadow; im.receiveShadow = false; im.name = 'kit:instanced'; out.add(im); instanced++;
   continue;
  }
  const sig = vcSig(material), key = sig ? 'vc:' + sig : 'm:' + matSig(material) + '|' + list[0].renderOrder;
  if (!groups.has(key)) groups.set(key, { material, vc: !!sig, meshes: [] });
  groups.get(key).meshes.push(...list);
 }
 const owned = [];
 for (const { material, vc, meshes } of groups.values()) {
  let n = 0; const parts = meshes.map(o => {
   const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
   g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); n += g.attributes.position.count;
   return { g, m: o.material };
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const col = vc ? new Float32Array(n * 3) : null, pbr = vc ? new Float32Array(n * 2) : null, emis = vc ? new Float32Array(n * 3) : null; let off = 0;
  for (const { g, m } of parts) {
   const k = g.attributes.position.count;
   pos.set(g.attributes.position.array, off * 3);
   if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
   if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
   if (vc) {
    const c = m.color, e = m.emissive, ei = m.emissiveIntensity ?? 1;
    for (let i = 0; i < k; i++) {
     const j = off + i;
     col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
     pbr[j * 2] = m.roughness ?? 1; pbr[j * 2 + 1] = m.metalness ?? 0;
     emis[j * 3] = e.r * ei; emis[j * 3 + 1] = e.g * ei; emis[j * 3 + 2] = e.b * ei;
    }
   }
   off += k; g.dispose();
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  if (vc) { geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setAttribute('pbr', new T.BufferAttribute(pbr, 2)); geo.setAttribute('emis', new T.BufferAttribute(emis, 3)); }
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  let mat = material;
  if (vc) { mat = patchVertexPbr(material.clone()); mat.color.set('#ffffff'); mat.emissive.set('#000000'); mat.vertexColors = true; mat.name = 'kit:baked-vc'; owned.push(mat); }
  const mesh = new T.Mesh(geo, mat); mesh.castShadow = castShadow && !material.transparent; mesh.receiveShadow = false; mesh.renderOrder = meshes[0].renderOrder; mesh.name = 'kit:merged'; out.add(mesh);
 }
 out.userData.drawCalls = out.children.length; out.userData.instanced = instanced;
 out.userData.dispose = () => { out.traverse(o => { if (o.isMesh && o.name === 'kit:merged') o.geometry.dispose(); }); for (const m of owned) m.dispose(); };
 return out;
}
