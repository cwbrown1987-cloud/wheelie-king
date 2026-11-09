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
import { bakeStatic } from './bake.js';

export function createKit(T) {
 const registry = new Map(), materials = createMaterials(T), geo = createGeometry(T), tex = createTextures(T), textures = new Set();
 const kit = {
  T, geo, tex, textures, mat: materials.mat, skin: materials.skin,
  register(type, factory, meta = {}) { registry.set(type, { factory, meta: { type, ...meta } }); return kit; },
  has: type => registry.has(type),
  list: (category) => [...registry.values()].map(r => r.meta).filter(m => !category || m.category === category),
  build(type, params = {}) {
   const r = registry.get(type); if (!r) throw Error('Unknown kit part: ' + type);
   const g = r.factory(params); g.userData.kit ||= { type, params }; return g;
  },
  /** Data-driven composition: { parts:[{ type, params, at:[x,y,z], rotY }] } */
  compose(spec, name = 'kit:composed') {
   const g = new T.Group(); g.name = name; g.userData.kit = { type: 'composed', params: spec };
   for (const c of spec.parts || []) { const o = kit.build(c.type, c.params || {}); o.position.set(...(c.at || [0, 0, 0])); o.rotation.y = c.rotY || 0; if (c.scale) o.scale.setScalar(c.scale); g.add(o); }
   return g;
  },
  bake: (root, opts) => bakeStatic(T, root, opts),
  /** Axis-aligned footprint/size of a built prop (for placement colliders). */
  bounds(obj) { obj.updateMatrixWorld(true); return new T.Box3().setFromObject(obj); },
  dispose() { materials.dispose(); geo.dispose(); tex.dispose(); for (const t of textures) t.dispose(); textures.clear(); },
 };
 registerParts(kit); registerAssemblies(kit);
 return kit;
}
