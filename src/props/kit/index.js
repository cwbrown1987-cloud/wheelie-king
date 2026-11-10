// Wheelie King prop kit: reusable, reskinnable modelled parts + a tiny registry.
//   const kit = createKit(THREE);
//   const chest = kit.build('toolChest', { width:.9, skin:{ body:'#1f5fd1', handle:'brushed' } });
//   const cart  = kit.build('trolley', { casterSkin:{ wheel:'#222' } });         // same caster part
//   kit.register('myProp', p => kit.compose({ parts:[{ type:'carton', at:[0,0,0] }] }));
//   const baked = kit.bake(roomGroup);   // instanced/merged for phones
// No photo art is ever used as a prop texture; all detail is geometry + PBR + small procedural maps.
import { createMaterials } from './materials.js';
import { createGeometry } from './geometry.js';
import { createTextures } from './textures.js';
import { registerParts } from './parts.js';
import { registerAssemblies } from './assemblies.js';
import { registerRoomParts } from './parts-room.js';
import { registerStandParts } from './parts-stand.js';
import { SLOTS } from './slots.js';
import { bakeStatic } from './bake.js';

export function createKit(T) {
 const registry = new Map(), skins = new Map(), materials = createMaterials(T), geo = createGeometry(T), tex = createTextures(T), textures = new Set();
 const kit = {
  T, geo, tex, textures, mat: materials.mat, skin: materials.skin,
  register(type, factory, meta = {}) { registry.set(type, { factory, meta: { type, slots: SLOTS[type] || [], ...meta } }); return kit; },
  /** Material slot names a part understands (keys of params.skin). */
  slots: type => registry.get(type)?.meta.slots || [],
  /** Named skins: kit.registerSkin('blue-chest', { body:'#1f5fd1' }); build(type, { skin:'blue-chest' }). */
  registerSkin(name, skin) { skins.set(name, skin); return kit; },
  has: type => registry.has(type),
  list: (category) => [...registry.values()].map(r => r.meta).filter(m => !category || m.category === category),
  build(type, params = {}) {
   const r = registry.get(type); if (!r) throw Error('Unknown kit part: ' + type);
   if (typeof params.skin === 'string') params = { ...params, skin: skins.get(params.skin) || {} };
   const g = r.factory(params); g.userData.kit ||= { type, params }; return g;
  },
  /** Data-driven composition: { parts:[{ type, params, at:[x,y,z], rotY }] } */
  compose(spec, name = 'kit:composed') {
   const g = new T.Group(); g.name = name; g.userData.kit = { type: 'composed', params: spec };
   for (const c of spec.parts || []) { const o = kit.build(c.type, c.params || {}); o.position.set(...(c.at || [0, 0, 0])); if (c.rot) o.rotation.set(...c.rot); else o.rotation.y = c.rotY || 0; if (c.scale) o.scale.setScalar(c.scale); g.add(o); }
   return g;
  },
  bake: (root, opts) => bakeStatic(T, root, opts),
  /** Axis-aligned footprint/size of a built prop (for placement colliders). */
  bounds(obj) { obj.updateMatrixWorld(true); return new T.Box3().setFromObject(obj); },
  /** Bounds of the solid parts only (ignores soft contact shadows), in the object's parent space. */
  solidBounds(obj) {
   obj.updateMatrixWorld(true); const box = new T.Box3(), inv = new T.Matrix4().copy(obj.parent ? obj.parent.matrixWorld : new T.Matrix4()).invert(), b = new T.Box3();
   const walk = o => { if (o.userData?.kit?.type === 'contactShadow') return; if (o.isMesh) { o.geometry.computeBoundingBox(); b.copy(o.geometry.boundingBox).applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); box.union(b); } for (const c of o.children) walk(c); };
   walk(obj); return box;
  },
  dispose() { materials.dispose(); geo.dispose(); tex.dispose(); for (const t of textures) t.dispose(); textures.clear(); },
 };
 registerParts(kit); registerAssemblies(kit); registerRoomParts(kit); registerStandParts(kit);
 return kit;
}
