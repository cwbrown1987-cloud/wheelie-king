// Wheelie King shop 3D previews (v15): ONE shared WebGL renderer draws every part thumbnail (cached data URLs)
// and the big drag-to-rotate preview in the part sheet. Same realistic models as on the bike (partmodels.js).
import * as T from "./vendor/three.module.js";
import * as PM from "./partmodels.js";
import {TRAX_ID,traxPreview} from './trax-bike.js';
PM.useThree(T);
const find = (id) => globalThis.__WK_CAT__?.().items.find((i) => i.id === id);
const MODEL_SLOTS = new Set(["motor", "battery", "chain", "sprocket_f", "sprocket_r", "suspension", "shock", "bars"]);
export const modelFor = (p) => {
  if (!p) return null;
  if (p.id === TRAX_ID) return traxPreview(T);
  if (p.slot === "kit") { const m = (p.kit || []).map(find).find((q) => q?.slot === "motor"); const b = (p.kit || []).map(find).find((q) => q?.slot === "battery"); return modelFor(m || b); }
  if (!MODEL_SLOTS.has(p.slot)) return null;
  if (p.slot === "motor") return p.kind === "mid" ? (p.nopedal || (!p.real && (p.w || 0) >= 2500) || p.id === "x1" ? PM.motoMid(p) : PM.midDrive(p)) : PM.hubMotor(p);
  if (p.slot === "battery") return PM.battery(p);
  if (p.slot === "sprocket_f" || p.slot === "sprocket_r") return PM.sprocket(p.teeth, p.std, p.color || (p.std === "bicycle" ? "#2a2a2a" : "#3a3a3a"), "sprocket");
  if (p.slot === "chain") { const G = new T.Group(); const rf = PM.sprocketR(18), rr = PM.sprocketR(12), cx = 0.09, pts = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + (i / 12) * Math.PI; pts.push([-cx + Math.cos(a) * rr, Math.sin(a) * rr]); }
    for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (i / 12) * Math.PI; pts.push([cx + Math.cos(a) * rf, Math.sin(a) * rf]); }
    G.add(PM.chainAlong(pts, p.std || "bicycle", p.color || "#4a4a4a")); G.name = "chainLoop"; return G; }
  if (p.slot === "suspension") return PM.fork(p, [0, 0.5], [0, 0.35], [0.12, -0.18], [0, 0.48], {color:p.color});
  if (p.slot === "shock") return PM.shock(p, [0, 0.12], [0, -0.12]);
  if (p.slot === "bars") return PM.bars(globalThis.__WK_BARSPEC__?.(p, find(globalThis.__WK_BUILD__?.grips)) || {}, [0, 0]);
  return null;
};
let R = null, scene, cam, holder;
function ensure() {
  if (R) return R;
  R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.6;
  scene = new T.Scene(); cam = new T.PerspectiveCamera(30, 4 / 3, 0.01, 50);
  scene.add(new T.HemisphereLight("#e8f4ff", "#505048", 3)); const f2 = new T.DirectionalLight("#cfe0ff", 1.5); f2.position.set(-1, 0.5, 4); scene.add(f2); const k = new T.DirectionalLight("#ffffff", 3.5); k.position.set(2, 3, 4); scene.add(k);
  const rim = new T.DirectionalLight("#39ff7a", 0.8); rim.position.set(-3, 1, -2); scene.add(rim);
  holder = new T.Group(); scene.add(holder); return R;
}
function frame(obj) { const box = new T.Box3().setFromObject(obj), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3()); obj.position.sub(c);
  const r = Math.max(sz.x, sz.y, sz.z) * 0.5 || 0.2; cam.position.set(r * 1.5, r * 0.9, r * 2.6); cam.near = r / 50; cam.far = r * 30; cam.updateProjectionMatrix(); cam.lookAt(0, 0, 0); }
function dispose(o) { o.traverse((m) => { m.geometry?.dispose(); m.material && [].concat(m.material).forEach((x) => x.dispose()); }); }
const cache = new Map();
export function thumb(p, size = 96) {
  const key = p.id + "@" + (size > 120 ? 2 : 1); if (cache.has(key)) return cache.get(key);
  let url = null; try { const obj = modelFor(p); if (!obj) { cache.set(key, null); return null; }
    ensure(); const w = size > 120 ? 240 : 128, h = Math.round(w * 0.75), prev = R.getSize(new T.Vector2()); R.setSize(w, h, false); cam.aspect = w / h;
    holder.clear(); const pivot = new T.Group(); pivot.add(obj); holder.add(pivot); frame(obj); pivot.rotation.set(0.15, -0.35, 0); R.render(scene, cam); url = R.domElement.toDataURL("image/png");
    holder.clear(); dispose(obj); if (live) { R.setSize(prev.x, prev.y, false); cam.aspect = prev.x / prev.y; }
  } catch (e) { console.warn("thumb", p.id, e); url = null; }
  cache.set(key, url); return url;
}
let live = null;
export function mount(el, p) { // big rotatable preview; returns cleanup
  if (!el) return () => {}; ensure(); live?.stop(); const obj = modelFor(p); if (!obj) return () => {};
  const pivot = new T.Group(); pivot.add(obj); holder.clear(); holder.add(pivot); frame(obj); pivot.rotation.set(0.15, -0.35, 0);
  const cv = R.domElement; cv.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab"; cv.dataset.wkPreview = p.id; el.appendChild(cv);
  let raf = 0, drag = null, idle = 0, zoom = 1; const base = cam.position.clone();
  const size = () => { const w = el.clientWidth || 300, h = el.clientHeight || 220; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const pts = new Map();
  const down = (e) => { cv.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = [e.clientX, e.clientY, pivot.rotation.y, pivot.rotation.x]; idle = 0; e.preventDefault(); };
  const move = (e) => { if (!pts.has(e.pointerId)) return; const old = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d1 = Math.hypot(a[0] - b[0], a[1] - b[1]), o2 = [...pts.entries()].find(([k]) => k !== e.pointerId)[1], d0 = Math.hypot(old[0] - o2[0], old[1] - o2[1]); zoom = Math.max(0.5, Math.min(2.2, zoom * (d0 / (d1 || 1)))); return; }
    if (!drag) return; pivot.rotation.y = drag[2] + (e.clientX - drag[0]) * 0.012; pivot.rotation.x = Math.max(-1.2, Math.min(1.2, drag[3] + (e.clientY - drag[1]) * 0.008)); e.preventDefault(); };
  const up = (e) => { pts.delete(e.pointerId); if (!pts.size) drag = null; };
  const wheel = (e) => { zoom = Math.max(0.5, Math.min(2.2, zoom * (e.deltaY > 0 ? 1.1 : 0.9))); e.preventDefault(); };
  cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("wheel", wheel, { passive: false });
  const loop = () => { raf = requestAnimationFrame(loop); size(); if (!drag && ++idle > 90) pivot.rotation.y += 0.006; cam.position.copy(base).multiplyScalar(zoom); cam.lookAt(0, 0, 0); R.render(scene, cam); };
  loop();
  const stop = () => { cancelAnimationFrame(raf); cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up); cv.removeEventListener("wheel", wheel);
    cv.remove(); holder.clear(); dispose(obj); live = null; };
  live = { stop, obj }; return stop;
}
globalThis.__WK_THUMB__ = (p, size) => (modelFor ? thumb(p, size) : null);
globalThis.__WK_PREVIEW__ = { has: (p) => !!p && (p.id === TRAX_ID || MODEL_SLOTS.has(p.slot) || (p.slot === "kit" && (p.kit || []).some((id) => ["motor", "battery"].includes(find(id)?.slot)))), mount, modelFor };
