// Store thumbnails and the drag-to-rotate detail preview for Clothing items: the real Playground rider
// (Quaternius UBC) wearing the item, rendered by one small shared renderer. Loaded lazily (async), so
// thumbnails fill in when ready; images already in the page are updated in place.
import * as T from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { dressUbc } from './rider-clothes.js';
import { CLOTHING_BASES, clothingById } from './clothing-catalogue.js';
import { gearStyle } from './gear-state.js';
let ctx = null, live = null, chain = Promise.resolve();
const thumbs = new Map();
function ensure() {
  if (ctx) return ctx;
  ctx = (async () => {
    const R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.setPixelRatio(1);
    const scene = new T.Scene(); scene.environment = new T.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new T.DirectionalLight('#ffffff', 1.5); sun.position.set(2, 4, 3); scene.add(sun, new T.HemisphereLight('#e4ecff', '#2d2b27', 0.45));
    const g = await new GLTFLoader().loadAsync(new URL('./assets/quaternius/ubc-superhero-male.glb', import.meta.url).href);
    const model = g.scene; model.updateMatrixWorld(true);
    // relaxed standing pose: arms down by the sides
    const q1 = new T.Quaternion(), q2 = new T.Quaternion();
    for (const [s, k] of [['l', 1], ['r', -1]]) { const b = model.getObjectByName('upperarm_' + s); b.parent.getWorldQuaternion(q1); b.getWorldQuaternion(q2); b.quaternion.copy(q1.invert().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -k * 1.2).multiply(q2))); model.updateMatrixWorld(true); }
    model.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    const pivot = new T.Group(); pivot.add(model); scene.add(pivot);
    const dresser = dressUbc(T, model), cam = new T.PerspectiveCamera(28, 4 / 3, 0.05, 30);
    return { R, scene, cam, pivot, dresser };
  })();
  return ctx;
}
const FRAME = { top: [1.2, 1.55], pants: [0.6, 2.1], shoes: [0.07, 0.75], all: [0.92, 4.4] };
function aim(c, slot, yaw, zoom = 1) {
  const [y, d] = FRAME[slot] || FRAME.all, dir = new T.Vector3(Math.sin(yaw), 0.12 + (slot === 'shoes' ? 0.35 : 0), Math.cos(yaw)).normalize();
  c.cam.position.set(0, y, slot === 'shoes' ? 0.03 : 0).addScaledVector(dir, d * zoom); c.cam.lookAt(0, y, slot === 'shoes' ? 0.03 : 0);
}
const outfitFor = item => { const c = clothingById(item.id); return c ? { [CLOTHING_BASES[c.base].slot]: { id: c.id } } : {}; };

export function clothesThumb(p, size = 180) {
  const key = p.id + '@' + (size > 120 ? 2 : 1); if (thumbs.has(key)) return thumbs.get(key);
  thumbs.set(key, null);
  chain = chain.then(async () => {
    while (live) await new Promise(r => setTimeout(r, 300));
    const c = await ensure(); await c.dresser.wear(outfitFor(p), {});
    const w = size > 120 ? 240 : 128, h = Math.round(w * 0.75); c.R.setSize(w, h, false); c.cam.aspect = w / h; c.cam.updateProjectionMatrix();
    c.pivot.rotation.y = 0; aim(c, CLOTHING_BASES[clothingById(p.id)?.base]?.slot, p.slot === 'shoes' ? 0.9 : 0.45); c.R.render(c.scene, c.cam);
    const url = c.R.domElement.toDataURL('image/png'); thumbs.set(key, url);
    if (typeof document !== 'undefined') for (const img of document.querySelectorAll('img')) if (img.alt === p.name && !img.src.startsWith('data:')) img.src = url;
  }).catch(e => console.warn('clothes thumb', p.id, e));
  return null;
}

export function mountClothesPreview(el, p) {
  if (!el) return () => {};
  let raf = 0, stopped = false, drag = null, idle = 0, zoom = 1, yaw = 0.45, full = true;
  const token = {}; live = token;
  const hint = document.createElement('div'); hint.textContent = 'Loading rider…'; hint.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:#cfe3ef;font:600 13px system-ui'; el.append(hint);
  ensure().then(async c => {
    if (stopped) return; await c.dresser.wear(outfitFor(p), gearStyle()); if (stopped) return; hint.remove();
    const cv = c.R.domElement; cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab'; cv.dataset.wkPreview = p.id; el.appendChild(cv);
    const slot = CLOTHING_BASES[clothingById(p.id)?.base]?.slot;
    const down = e => { drag = [e.clientX, yaw]; idle = 0; cv.setPointerCapture?.(e.pointerId); };
    const move = e => { if (!drag) return; yaw = drag[1] - (e.clientX - drag[0]) * 0.012; e.preventDefault(); };
    const up = () => { drag = null; };
    const wheel = e => { zoom = Math.max(0.5, Math.min(2.2, zoom * (e.deltaY > 0 ? 1.1 : 0.9))); e.preventDefault(); };
    const dbl = () => { full = !full; };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('wheel', wheel, { passive: false }); cv.addEventListener('dblclick', dbl);
    let last = performance.now();
    const loop = now => {
      if (stopped) return; raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!drag && ++idle > 90) yaw += dt * 0.5;
      const w = el.clientWidth || 300, h = el.clientHeight || 220; c.R.setSize(w, h, false); c.cam.aspect = w / h; c.cam.updateProjectionMatrix();
      c.dresser.update(dt, 0); aim(c, full ? 'all' : slot, yaw, zoom); c.R.render(c.scene, c.cam);
    };
    raf = requestAnimationFrame(loop);
    token.cleanup = () => { cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); cv.removeEventListener('wheel', wheel); cv.removeEventListener('dblclick', dbl); cv.remove(); };
  }).catch(e => { hint.textContent = 'Preview unavailable'; console.warn('clothes preview', e); });
  return () => { stopped = true; cancelAnimationFrame(raf); token.cleanup?.(); hint.remove(); if (live === token) live = null; };
}
