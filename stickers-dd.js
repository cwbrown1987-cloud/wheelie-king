// Wheelie King stickers v9: drag a flat sticker onto the bike; it wraps live (DecalGeometry), then fine-tune.
import * as T from "three";
import { DecalGeometry } from "./vendor/DecalGeometry.js";
const KEY = "wk-decals", SKIP = new Set(["wk:sticker", "wk:stand"]);
const adultOk = () => { const p = localStorage.getItem("wk-adult-until"); return p === "forever" || (!!p && Number(p) > Date.now()); };
const cat = () => { const c = globalThis.__WK_CAT__?.(); if (!c) return { items: [], base: "./stickers/" }; return { items: c.items.filter((i) => i.slot === "sticker" && i.img), base: c.base }; };
const V = () => globalThis.__WK_VIEW__;
let saved = []; try { saved = JSON.parse(localStorage.getItem(KEY) || "[]").filter((d) => d.p); } catch {}
const save = () => localStorage.setItem(KEY, JSON.stringify(saved.map(({ mesh, ...d }) => d)));
const texCache = {}, loader = new T.TextureLoader();
const tex = (url) => texCache[url] || (texCache[url] = loader.load(url, (t) => { t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; }));
const bikeRoot = (v) => { let g = null; v.scene.traverse((o) => { if (!g && o.name === "wk:frame") g = o.parent; }); return g; };
const targets = (root) => { const out = []; root.traverse((o) => { if (o.isMesh && !o.userData.wkDecal && o.visible) { let p = o, ok = true; while (p && p !== root) { if (SKIP.has(p.name) || !p.visible) ok = false; p = p.parent; } ok && out.push(o); } }); return out; };
const ray = new T.Raycaster(), ndc = new T.Vector2();
function screenRay(v, x, y) { const r = v.renderer.domElement.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, v.camera); return true; }
const pickList = (v, x, y, list) => (screenRay(v, x, y) ? ray.intersectObjects(list, false)[0] || null : null);
// tube frame at a hit: world normal, world axis (along tube), radius
const tubePaths = new WeakMap();
export function surf(hit) { const m = hit.object, g = m.geometry, mw = m.matrixWorld, nm = new T.Matrix3().getNormalMatrix(mw);
  const n = hit.face.normal.clone().applyMatrix3(nm).normalize(); const sc = new T.Vector3().setFromMatrixScale(mw); let axis, r;
  if (g.type === "CylinderGeometry") { axis = new T.Vector3(0, 1, 0).transformDirection(mw); r = Math.max(g.parameters.radiusTop, g.parameters.radiusBottom) * sc.x; }
  else if (g.type === "TubeGeometry" && hit.uv) { axis = g.parameters.path.getTangentAt(Math.min(1, Math.max(0, hit.uv.x))).transformDirection(mw); r = g.parameters.radius * sc.x; }
  else if (g.userData.wkTube && hit.uv) { let path = tubePaths.get(g); if (!path) { path = new T.CatmullRomCurve3(g.userData.wkTube.points.map(p => new T.Vector3(...p))); tubePaths.set(g, path); }
    axis = path.getTangentAt(Math.min(1, Math.max(0, hit.uv.x))).transformDirection(mw); r = g.userData.wkTube.radius * sc.x; }
  else { g.boundingBox || g.computeBoundingBox(); const s = g.boundingBox.getSize(new T.Vector3()).multiply(sc), dims = [["x", s.x], ["y", s.y], ["z", s.z]].sort((a, b) => b[1] - a[1]);
    axis = new T.Vector3()[`set${dims[0][0].toUpperCase()}`](1).transformDirection(mw); r = Math.min(0.06, Math.max(0.012, dims[1][1] / 2)); }
  axis.addScaledVector(n, -axis.dot(n)); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0).addScaledVector(n, -n.x); axis.normalize();
  if (axis.x < 0) axis.negate(); // keep text reading left-to-right in the default view
  return { n, axis, r }; }
function buildDecal(d, hit, preview) { const { n, axis, r } = surf(hit), t = tex(d.img), asp = t.image ? t.image.width / t.image.height : 1;
  const x = axis.clone().applyAxisAngle(n, d.rot || 0), y = new T.Vector3().crossVectors(n, x).normalize();
  const rot = new T.Euler().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, n));
  const h = 2.1 * r * (d.size || 1), w = h * asp, depth = 2 * r;
  const g = new DecalGeometry(hit.object, hit.point, rot, new T.Vector3(w, h, depth));
  hit.object.updateMatrixWorld(); g.applyMatrix4(hit.object.matrixWorld.clone().invert());
  const m = new T.Mesh(g, new T.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.45 }));
  m.userData.wkDecal = d; m.renderOrder = 2; if (preview) m.material.opacity = 0.9; hit.object.add(m); d.r = r; return m; }
function drop(d) { if (d.mesh) { d.mesh.parent?.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); d.mesh = null; } }
// re-find the surface from bike-local p/n
function rehit(d, root) { root.updateMatrixWorld(true); const pW = new T.Vector3(...d.p).applyMatrix4(root.matrixWorld), nW = new T.Vector3(...d.n).transformDirection(root.matrixWorld);
  ray.set(pW.clone().addScaledVector(nW, 0.05), nW.clone().negate()); ray.far = 0.1; const h = ray.intersectObjects(targets(root), false)[0]; ray.far = Infinity; return h || null; }
function render(d, hit) { drop(d); if (!hit) return; d.mesh = buildDecal(d, hit); glow(d); }
function store(d, hit, root) { const inv = root.matrixWorld.clone().invert(), { n } = surf(hit); d.p = hit.point.clone().applyMatrix4(inv).toArray(); d.n = n.clone().transformDirection(inv).toArray(); }
let sel = null; const glow = (d) => d.mesh && d.mesh.material.emissive.set(d === sel ? 0x1f5f2f : 0x000000);
let lastRoot = null;
setInterval(() => { const v = V(); if (!v || drag) return; const root = bikeRoot(v); if (!root) return; const a = adultOk(), map = new Map(cat().items.map((i) => [i.id, i]));
  for (const d of saved) { if (map.get(d.id)?.rating === "adult18" && !a) { drop(d); continue; } let p = d.mesh; while (p && p !== v.scene) p = p.parent;
    if (!p || root !== lastRoot) render(d, rehit(d, root)); }
  lastRoot = root; }, 400);
// ---------- UI ----------
const css = document.createElement("style"); css.textContent = `.wkp{position:fixed;left:0;right:0;bottom:0;z-index:9998;background:#0d1110ee;color:#eee;font:13px system-ui;padding:8px 8px calc(40px + env(safe-area-inset-bottom));display:none;border-top:2px solid #39f}
#wkst-tray .row{display:flex;gap:8px;overflow-x:auto}#wkst-tray img{width:64px;height:64px;object-fit:contain;background:#222;border-radius:8px;flex:none}
.wkp button{background:#2a3430;color:#fff;border:0;border-radius:8px;padding:7px 11px;font:600 14px system-ui}.wkp .ctl{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#wkst-big{position:fixed;inset:0;z-index:10001;display:none;align-items:center;justify-content:center;flex-direction:column;background:#0008;color:#fff;font:600 15px system-ui;touch-action:none}
#wkst-big img{width:min(55vw,55vh);touch-action:none;filter:drop-shadow(0 6px 14px #000)}#wkst-big .x{margin-top:10px;background:#2a3430;color:#fff;border:0;border-radius:8px;padding:6px 12px}
#wkst-ghost{position:fixed;width:90px;pointer-events:none;z-index:10002;opacity:.85;transform:translate(-50%,-50%);display:none}`;
document.head.append(css);
const el = (h) => { const t = document.createElement("template"); t.innerHTML = h.trim(); return document.body.appendChild(t.content.firstChild); };
const tray = el(`<div class="wkp" id="wkst-tray"><div style="margin-bottom:6px">All stickers: tap one, then drag it onto the bike.</div><div class="row"></div><div class="ctl" style="margin-top:6px"><button data-a="close">Close</button></div></div>`);
const big = el(`<div id="wkst-big"><div>Drag the sticker onto the bike</div><img draggable="false"><button class="x">✕ Cancel</button></div>`);
const ghost = el(`<img id="wkst-ghost">`);
const panel = el(`<div class="wkp" id="wkst-panel"><div class="ctl">Size <input type="range" id="wkst-s" min="0.4" max="3" step="0.05"> Rotate <input type="range" id="wkst-r" min="-180" max="180" step="1">
<button data-n="-1,0">◀</button><button data-n="1,0">▶</button><button data-n="0,1">⤴ around</button><button data-n="0,-1">⤵ around</button><button data-a="remove">Remove</button><button data-a="done">✓ Done</button></div>
<div style="opacity:.7;margin-top:4px">Drag the glowing sticker to move it · drag elsewhere to spin/zoom the bike · tap another sticker to select it</div></div>`);
const S = panel.querySelector("#wkst-s"), R = panel.querySelector("#wkst-r");
let pick = null, drag = null, raf = 0, last = null;
const show = (p) => { tray.style.display = p === tray ? "block" : "none"; panel.style.display = p === panel ? "block" : "none"; };
function fill() { const { items, base } = cat(), a = adultOk(), row = tray.querySelector(".row"); row.innerHTML = "";
  for (const it of items) { if (it.rating === "adult18" && !a) continue; const im = new Image(); im.src = base + it.img; im.title = it.name; im.draggable = false;
    im.onclick = () => startPick(it); row.append(im); } }
function startPick(it) { const { base } = cat(); pick = { id: it.id, img: base + it.img, size: 1, rot: 0 }; tex(pick.img); big.querySelector("img").src = ghost.src = pick.img; big.style.display = "flex"; show(null); }
globalThis.__WK_STK_PICK__ = (id) => { const it = cat().items.find((i) => i.id === id); if (!it || (it.rating === "adult18" && !adultOk())) return; select(null); startPick(it); };
globalThis.__WK_STK_ALL__ = () => { select(null); fill(); show(tray); };
tray.querySelector("[data-a=close]").onclick = () => show(null);
big.querySelector(".x").onclick = () => { big.style.display = "none"; pick = null; };
function select(d) { const old = sel; sel = d; old && glow(old); if (d) { glow(d); S.value = d.size; R.value = Math.round(((d.rot || 0) * 180) / Math.PI); show(panel); } else if (panel.style.display === "block") show(null); }
const rerender = (d) => { const v = V(), root = v && bikeRoot(v); if (!root) return; render(d, rehit(d, root)); save(); };
S.oninput = () => sel && ((sel.size = +S.value), rerender(sel)); R.oninput = () => sel && ((sel.rot = (+R.value * Math.PI) / 180), rerender(sel));
panel.querySelector("[data-a=done]").onclick = () => select(null);
panel.querySelector("[data-a=remove]").onclick = () => { if (!sel) return; drop(sel); saved = saved.filter((x) => x !== sel); save(); select(null); };
panel.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => { const d = sel, v = V(), root = v && bikeRoot(v); if (!d || !root) return; const h = rehit(d, root); if (!h) return;
  const [al, ar] = b.dataset.n.split(",").map(Number), { n, axis, r } = surf(h); let p = h.point.clone(), nn = n.clone();
  if (al) p.addScaledVector(axis, al * Math.max(0.012, r)); if (ar) { const c = p.clone().addScaledVector(n, -r); nn.applyAxisAngle(axis, ar * Math.PI / 10); p = c.addScaledVector(nn, r); }
  ray.set(p.clone().addScaledVector(nn, 0.05), nn.clone().negate()); ray.far = 0.1; const h2 = ray.intersectObjects(targets(root), false)[0]; ray.far = Infinity;
  if (h2) { store(d, h2, root); render(d, h2); save(); } }));
// live drag: d is the sticker being moved; each frame raycast under the finger and rebuild the wrapped decal
function frame() { raf = 0; const v = V(); if (!drag || !last || !v) return; const root = bikeRoot(v); if (!root) return;
  const h = pickList(v, last[0], last[1], targets(root)); ghost.style.display = h ? "none" : "block"; ghost.style.left = last[0] + "px"; ghost.style.top = last[1] + "px";
  if (h) { drag.hit = h; drag.root = root; render(drag.d, h); } }
function startDrag(d, e, isNew) { const v = V(); drag = { d, isNew, hit: null, id: e.pointerId }; v.controls.enabled = false; last = [e.clientX, e.clientY];
  try { (e.target.setPointerCapture ? e.target : v.renderer.domElement).setPointerCapture(e.pointerId); } catch {} frame(); }
big.querySelector("img").addEventListener("pointerdown", (e) => { e.preventDefault(); if (!pick || !V()) return; big.style.display = "none"; ghost.style.display = "block";
  startDrag({ ...pick }, e, true); });
addEventListener("pointerdown", (e) => { const v = V(); if (!v || drag || e.target !== v.renderer.domElement || !saved.length) return; if (e.pointerType === "touch" && !e.isPrimary) return;
  const meshes = saved.filter((d) => d.mesh).map((d) => d.mesh), h = pickList(v, e.clientX, e.clientY, meshes); if (!h) return;
  const d = h.object.userData.wkDecal; e.stopImmediatePropagation(); e.preventDefault(); select(d); startDrag(d, e, false); }, true);
addEventListener("pointermove", (e) => { if (!drag || e.pointerId !== drag.id) return; e.preventDefault(); e.stopImmediatePropagation(); last = [e.clientX, e.clientY]; raf ||= requestAnimationFrame(frame); }, { capture: true, passive: false });
addEventListener("touchmove", (e) => { if (drag) e.preventDefault(); }, { passive: false, capture: true });
const end = (e) => { if (!drag || e.pointerId !== drag.id) return; e.stopImmediatePropagation(); cancelAnimationFrame(raf); raf = 0; frame();
  const { d, isNew, hit, root } = drag, v = V(); ghost.style.display = "none"; drag = null; v && (v.controls.enabled = true);
  if (hit) { store(d, hit, root); if (isNew) saved.push(d); render(d, hit); select(d); save(); } else if (isNew) drop(d); else rerender(d); };
addEventListener("pointerup", end, true); addEventListener("pointercancel", end, true);
globalThis.__WK_STK__ = { saved: () => saved, sel: () => sel };
// iPad Safari: stop page-level pinch/zoom gestures so two-finger pinch/pan reach OrbitControls.
for (const t of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
