// Skinnable PBR materials for the prop kit. Every part names material "slots"
// (body, trim, handle, wheel...) and takes a `skin` object that overrides them:
//   skin: { body: '#1f5fd1' }                 -> slot's default preset, new colour
//   skin: { body: 'chrome' }                  -> different preset
//   skin: { body: { preset:'paint', color:'#222', roughness:.5 } }
//   skin: { body: someThreeMaterial }         -> used as-is
// Materials are cached by spec so reskinned copies still share GPU programs.
export const PRESETS = {
 paint:   { physical: true, color: '#a3243b', metalness: .25, roughness: .3, clearcoat: 1, clearcoatRoughness: .08 },
 powder:  { color: '#d9a51f', metalness: .3, roughness: .5 },
 steel:   { color: '#2b3039', metalness: .7, roughness: .42 },
 darkSteel:{ color: '#15181e', metalness: .55, roughness: .55 },
 chrome:  { color: '#e4e8ee', metalness: 1, roughness: .14 },
 brushed: { color: '#a3abb5', metalness: .9, roughness: .3 },
 rubber:  { color: '#111317', metalness: 0, roughness: .88 },
 plastic: { color: '#2a63c9', metalness: 0, roughness: .42 },
 wood:    { color: '#6e5641', metalness: 0, roughness: .72 },
 cardboard:{ color: '#9c7a52', metalness: 0, roughness: .9 },
 glass:   { color: '#0b1820', metalness: .1, roughness: .06 },
 emissive:{ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.2, roughness: .4, metalness: 0 },
};

export function createMaterials(T) {
 const cache = new Map(), owned = new Set();
 function make(spec) {
  const { physical, preset, ...p } = spec;
  const M = physical ? T.MeshPhysicalMaterial : T.MeshStandardMaterial;
  const m = new M();
  for (const [k, v] of Object.entries(p)) {
   if (v == null) continue;
   if ((k === 'color' || k === 'emissive') && !(v && v.isColor)) m[k].set(v);
   else m[k] = v;
  }
  m.envMapIntensity = p.envMapIntensity ?? .6;
  m.name = 'kit:' + (preset || 'custom');
  owned.add(m);
  return m;
 }
 /** Resolve a skin entry against a slot's default preset. */
 function mat(slotDefault, override) {
  if (override && override.isMaterial) return override;
  let spec = { preset: slotDefault };
  if (typeof slotDefault === 'object') spec = { ...slotDefault };
  if (typeof override === 'string') {
   if (override.startsWith('#')) spec.color = override;
   else spec = { preset: override };
  } else if (override && typeof override === 'object') spec = { ...spec, ...override };
  const base = PRESETS[spec.preset] || {};
  const full = { ...base, ...spec };
  if (full.emissive === true) full.emissive = full.color;
  const key = JSON.stringify(full);
  if (!cache.has(key)) cache.set(key, make(full));
  return cache.get(key);
 }
 /** skin(defaults, params.skin) -> function(slot) -> material */
 function skin(defaults, over = {}) {
  return slot => mat(defaults[slot] ?? 'steel', over[slot]);
 }
 return { mat, skin, dispose() { for (const m of owned) { m.map?.dispose(); m.emissiveMap?.dispose(); m.dispose(); } cache.clear(); owned.clear(); } };
}
