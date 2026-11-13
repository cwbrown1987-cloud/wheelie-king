// Rider outfit on the UBC body (v2.1-56): the equipped gear (gear-state) dresses the rider and the on-foot walker.
// Clothes are painted onto the skinned body: each vertex is sorted by the bone that moves it most (spine and upper
// arms = top, forearms = sleeves, hands = gloves, thighs/hips = pants, shins = knee panels, feet = boots), and a
// shader paints fabric there in the item's colours, keeping a little of the body's shading so it reads as fitted
// riding kit. The helmet is the shop model (gear-models.js) on the head bone; the hair hides under it.
import { gearModel } from './gear-models.js';
import { outfit as equippedOutfit } from './gear-state.js';
const REGION = { skin: 0, top: 1, sleeve: 2, pants: 3, glove: 4, boot: 5, knee: 6, collar: 7 };
function regionFor(name) {
  const n = name.toLowerCase();
  if (/^head|neck/.test(n)) return n.startsWith('neck') ? REGION.collar : REGION.skin;
  if (/hand|index|middle|ring|pinky|thumb/.test(n)) return REGION.glove;
  if (/lowerarm/.test(n)) return REGION.sleeve;
  if (/upperarm|clavicle|spine/.test(n)) return REGION.top;
  if (/calf/.test(n)) return REGION.knee;
  if (/thigh|pelvis/.test(n)) return REGION.pants;
  if (/foot|ball|toe/.test(n)) return REGION.boot;
  return REGION.skin;
}
const col = (T, c, k = 1) => new T.Color(c).multiplyScalar(k);
export function dressUbc(T, model, look = null) {
  look = look || safeOutfit();
  const top = look.top, pants = look.pants, gloves = look.gloves, shoes = look.shoes, tee = top?.style === 'tee', shorts = pants?.style === 'shorts';
  // one kit that goes together: sleeves match the jersey, knee panels a shade lighter than the pants, dark boots and gloves
  const tp = top?.primary || '#1676d8', pp = pants?.primary || '#202632';
  const P = [col(T, '#ffffff'), col(T, tp), col(T, tp, .9), col(T, pp), col(T, gloves?.primary || '#1b2028'), col(T, '#15181d'), new T.Color(pp).lerp(new T.Color('#8a93a3'), .22), col(T, tp)];
  const skinOn = [1, 0, tee ? 1 : 0, 0, gloves ? 0 : 1, shoes ? 0 : 1, shorts ? 1 : 0, 1];
  const accent = col(T, shoes?.accent || '#71ff9a');
  model.traverse(o => {
    if (!o.isSkinnedMesh || !o.geometry.attributes.skinIndex) return;
    if (/hair|eye/i.test(o.material?.name || '')) return;
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = o.skeleton.bones, reg = new Float32Array(si.count);
    for (let i = 0; i < si.count; i++) { let best = 0, bw = -1; const ws = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], is = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)]; for (let k = 0; k < 4; k++) if (ws[k] > bw) { bw = ws[k]; best = is[k]; } reg[i] = regionFor(bones[best]?.name || ''); }
    g.setAttribute('wkRegion', new T.BufferAttribute(reg, 1));
    const m = o.material.clone(); m.name = (o.material.name || 'body') + ':dressed'; o.material = m;
    const U = { wkPal: { value: P }, wkSkin: { value: skinOn }, wkAccent: { value: accent } };
    m.customProgramCacheKey = () => 'wk-dress';
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float wkRegion;varying float vWkR;varying vec3 vWkP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWkR=wkRegion;vWkP=position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 wkPal[8];uniform float wkSkin[8];uniform vec3 wkAccent;varying float vWkR;varying vec3 vWkP;float wkCloth;')
        .replace('#include <map_fragment>', `#include <map_fragment>
{ int r=int(floor(vWkR+.5));float sk=0.;vec3 c=vec3(1.);
  for(int i=0;i<8;i++){if(i==r){c=wkPal[i];sk=wkSkin[i];}}
  wkCloth=1.-sk;
  if(wkCloth>.5){ float shade=dot(diffuseColor.rgb,vec3(.299,.587,.114));shade=clamp(shade*1.6,.45,1.15);
    vec3 cloth=c*mix(1.,shade,.55);
    if(r==5){ cloth=mix(cloth,wkAccent,step(.5,fract(vWkP.y*14.))*.6); }
    diffuseColor.rgb=cloth; } }`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.82,wkCloth);');
    };
  });
  return look;
}
function safeOutfit() { try { return equippedOutfit(); } catch { return {}; } }
// helmet on the head bone; returns the helmet group (null if none equipped)
export function fitHelmet(T, model, look = null) {
  look = look || safeOutfit(); const head = model.getObjectByName('Head'); if (!head || !look.helmet) return null;
  model.updateMatrixWorld(true);
  const helmet = gearModel(T, look.helmet); helmet.name = 'rider:helmet';
  // world placement in the bind pose: facing the model's forward (+Z in model space; helmets face +X)
  const mq = model.getWorldQuaternion(new T.Quaternion()), want = mq.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -Math.PI / 2));
  const hq = head.getWorldQuaternion(new T.Quaternion()), hs = head.getWorldScale(new T.Vector3()), ms = model.getWorldScale(new T.Vector3());
  // the head's centre sits a little above and in front of the head bone
  let height = 1.75; try { const b = new T.Box3().setFromObject(model); height = Math.max(.5, b.max.y - b.min.y); } catch {}
  const k = height / 1.75, centre = head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, .085 * k, .025 * k).applyQuaternion(mq));
  helmet.quaternion.copy(hq.clone().invert().multiply(want));
  helmet.position.copy(head.worldToLocal(centre));
  helmet.scale.setScalar(1.06 * k / hs.x);
  head.add(helmet);
  model.traverse(o => { if (o.isMesh && /hair/i.test(o.material?.name || '')) o.visible = false; });
  void ms; return helmet;
}
