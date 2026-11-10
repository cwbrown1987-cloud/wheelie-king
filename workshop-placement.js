// Player placement of kit props in the 3D workshop. Reuses the garage gizmo (edit /
// remove / lift / floor-rotate handles) and the garage's select -> Edit -> drag flow;
// collision comes from the room's static colliders, walls, ceiling, door/bike zones and
// the other placed props. Saves per room under its own key (garage saves untouched).
import * as T from './vendor/three.module.js';
import { garageGizmo } from './garage-gizmo.js';
import { dockButton } from './src/ui/object-dock.js';
import { obbFrom, validate, pushInside } from './src/rooms/room-collision.js';
import { PLACEABLES, placeable } from './src/props/kit/catalog.js';

const KEY = 'wk-room-layout-v1', ROOM = 'workshop', STEP = Math.PI / 12;
const OK = '#69ff98', BAD = '#ff5a6e';
const readStore = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && typeof v.rooms === 'object') return v; } catch {} return { version: 1, rooms: {} }; };
let inst = null, items = [], storage = [], selected = null, arrange = false, original = null, drag = null, down = null, ui = null, gizmoStop = null, thumbs = new Map();
const view = () => globalThis.__WK_VIEW__;
const world = () => globalThis.__WK_SHARED_WORLD__;
const active = () => { const v = view(); return !!(v?.renderer?.domElement?.isConnected && inst && world()?.getActive?.() === ROOM && !world()?.state?.().transitioning && !document.body.dataset.playerView && !document.querySelector('[data-ride]')); };
const P = () => inst.placement;
const defOf = id => placeable(id) || P()?.fixtures?.find(f => f.id === id) || null;
const uidOf = () => (globalThis.crypto?.randomUUID?.() || 'p' + Math.random().toString(36).slice(2));

function save() {
 const s = readStore();
 s.rooms[ROOM] = {
  items: items.filter(i => !i.pending).map(({ uid, item, x, y, z, yaw }) => ({ uid, item, x: +x.toFixed(4), y: +y.toFixed(4), z: +z.toFixed(4), yaw: +yaw.toFixed(4) })),
  storage: storage.map(({ uid, item }) => ({ uid, item })),
 };
 localStorage.setItem(KEY, JSON.stringify(s));
}

function obbOf(it, pos = it) { return obbFrom(it.local, [pos.x, pos.y, pos.z], pos.yaw); }
function check(it, pos = it) { return validate(obbOf(it, pos), { planes: P().planes, ceil: P().ceil, colliders: P().colliders, zones: P().zones, items: items.filter(i => !i.pending || i === it).map(i => ({ uid: i.uid, obb: obbOf(i) })), ignore: it.uid }); }

function makeItem(def, uid, pos) {
 const kit = P().kit, src = kit.build(def.type, def.params || {});
 for (const top of def.toppings || []) { const o = kit.build(top.type, top.params || {}); o.position.set(top.x, top.y, top.z); o.rotation.y = top.yaw || 0; src.add(o); }
 const lb = kit.solidBounds(src);
 const holder = new T.Group(); holder.name = 'workshop:placed:' + def.id; holder.userData.savedRide = uid; // gizmo/pick compatibility
 const baked = kit.bake(src); baked.traverse(o => { if (o.isMesh) o.userData.savedRide = uid; }); holder.add(baked);
 const size = lb.getSize(new T.Vector3()), centre = lb.getCenter(new T.Vector3());
 const mark = new T.Group(); mark.name = 'workshop:placement-preview'; mark.visible = false;
 const mat = new T.MeshBasicMaterial({ color: OK, transparent: true, opacity: .36, depthWrite: false, toneMapped: false });
 const foot = new T.Mesh(new T.PlaneGeometry(1, 1), mat); foot.rotation.x = -Math.PI / 2; foot.scale.set(size.x + .06, size.z + .06, 1); foot.position.set(centre.x, lb.min.y + .006, centre.z); foot.renderOrder = 3;
 const edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(size.x + .02, size.y + .02, size.z + .02)), new T.LineBasicMaterial({ color: OK, transparent: true, opacity: .95, toneMapped: false, depthTest: false }));
 edges.renderOrder = 4; edges.position.copy(centre); mark.add(foot, edges); holder.add(mark);
 const it = { uid, item: def.id, def, fixture: !!def.fixture, mount: def.mount || 'floor', holder, baked, mark, local: { min: lb.min.toArray(), max: lb.max.toArray() }, x: pos.x, y: pos.y ?? (def.mount === 'wall' ? def.y ?? 1.3 : 0), z: pos.z, yaw: pos.yaw ?? 0 };
 apply(it); P().group.add(holder); return it;
}
function apply(it) { it.holder.position.set(it.x, it.y, it.z); it.holder.rotation.y = it.yaw; }
function paint(it) { const v = check(it); it.valid = v; const c = v.ok ? OK : BAD; for (const m of it.mark.children) m.material.color.set(c); it.mark.visible = it.uid === selected && arrange; return v; }
function disposeItem(it) { it.holder.removeFromParent(); it.baked.userData.dispose?.(); it.mark.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }

// ---- wall snapping for wall-mounted props: flush on the nearest wall, facing the room
function nearestWall(x, z) { let best = null; for (const pl of P().planes) { const d = pl.nx * x + pl.nz * z - pl.d; if (!best || d < best.d) best = { pl, d }; } return best.pl; }
function snapWall(it, x, z) { const pl = nearestWall(x, z), d = pl.nx * x + pl.nz * z - pl.d, off = .014; it.x = x - pl.nx * (d - off); it.z = z - pl.nz * (d - off); it.yaw = Math.atan2(pl.nx, pl.nz); }
// ---- floor: walls are solid while dragging (slide along them), named anchors pull gently
function settleFloor(it, x, z) {
 const o = obbFrom(it.local, [x, it.y, z], it.yaw), cx0 = o.cx, cz0 = o.cz; pushInside(o, P().planes, .012); x += o.cx - cx0; z += o.cz - cz0;
 for (const s of P().slots) if (s.kind === 'floor') { const dx = s.x - o.cx, dz = s.z - o.cz; if (Math.hypot(dx, dz) < .3) { x += dx; z += dz; break; } }
 it.x = x; it.z = z;
}
function moveTo(it, x, z) { if (it.mount === 'wall') snapWall(it, x, z); else settleFloor(it, x, z); apply(it); return paint(it); }

// ---- public-ish actions
function select(uid, edit = false) {
 if (selected && selected !== uid) finishEdit(false);
 selected = uid; arrange = edit && !!uid; const it = items.find(i => i.uid === uid);
 original = it ? { x: it.x, y: it.y, z: it.z, yaw: it.yaw } : null; refresh();
}
function finishEdit(commit) {
 const it = items.find(i => i.uid === selected); if (!it) { arrange = false; return; }
 if (it.pending) { if (commit && check(it).ok) { it.pending = false; storage = storage.filter(s => s.uid !== it.uid); save(); } else if (!commit) { remove(it.uid, false); } }
 else if (commit && check(it).ok) save();
 else if (original) { Object.assign(it, original); apply(it); }
 arrange = false; if (it) paint(it); refresh();
}
function remove(uid, persist = true) { const it = items.find(i => i.uid === uid); if (!it) return false; disposeItem(it); items = items.filter(i => i !== it); if (selected === uid) { selected = null; arrange = false; } if (persist && !it.pending) { if (!storage.some(s => s.uid === it.uid)) storage.push({ uid: it.uid, item: it.item }); save(); } refresh(); return true; }
function footXZ(it, yaw = it.yaw, x = it.x, z = it.z) { const lx = (it.local.min[0] + it.local.max[0]) / 2, lz = (it.local.min[2] + it.local.max[2]) / 2, c = Math.cos(yaw), s = Math.sin(yaw); return { x: x + lx * c + lz * s, z: z - lx * s + lz * c }; }
function rotate(it, delta) { if (!it || it.mount === 'wall') return { ok: false, reason: 'wall-mounted' }; const mid = footXZ(it); it.yaw += delta; const next = footXZ(it); it.x += mid.x - next.x; it.z += mid.z - next.z; settleFloor(it, it.x, it.z); apply(it); return paint(it); }
function spawnSpot(it) {
 const v = view(), ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(0, -.15), v.camera); const p = ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), new T.Vector3()) || new T.Vector3(0, 0, 1.5);
 for (let r = 0; r <= 4; r += .25) for (let a = 0; a < (r ? 12 : 1); a++) { const x = p.x + Math.cos(a / 12 * 6.283) * r, z = p.z + Math.sin(a / 12 * 6.283) * r; if (moveTo(it, x, z).ok) return true; }
 return false;
}
function begin(id) {
 const def = placeable(id); if (!def || !inst) return null;
 if (selected) finishEdit(false);
 const it = makeItem(def, uidOf(), { x: 0, z: 1.6 }); it.pending = true; items.push(it);
 if (place) dropAt(it); else spawnSpot(it); selected = it.uid; arrange = true; original = null; paint(it); refresh(); return it.uid;
}
function beginStored(entry) {
 const def = defOf(entry?.item); if (!def || !inst || items.some(i => i.uid === entry.uid)) return null;
 if (selected) finishEdit(false);
 const it = makeItem(def, entry.uid, { x: 0, z: 1.6 }); it.pending = true; items.push(it);
 if (place) dropAt(it); else spawnSpot(it); selected = it.uid; arrange = true; original = null; paint(it); refresh(); return it.uid;
}

// ---- place mode: camera eases out to a wide room overview, bike + workstand hide, new items drop into the
// middle of the room (nearest free spot if blocked). Only while placing; normal camera/zoom are restored on exit.
const WIDE = { pos: new T.Vector3(3.9, 3.3, 5.6), tgt: new T.Vector3(-.6, .15, -1.2), fov: 52 }, CENTRE = { x: -.3, z: -.2 }, EASE_MS = 700, DROP_H = .75, DROP_MS = 420;
let place = null;
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// the bike build (it carries the workstand) and its floor shadow/turntable meshes at the scene root
const bikeBits = v => v.scene.children.filter(c => c.userData?.wkWorkstand || c.getObjectByName?.('wk:stand') || (c.isMesh && c.position.y < .1 && Math.hypot(c.position.x, c.position.z) < 1.5));
function hideBike(v) { for (const o of bikeBits(v)) if (!place.hidden.has(o)) { place.hidden.set(o, o.visible); o.visible = false; } }
function showBike() { for (const [o, vis] of place.hidden) o.visible = vis; place.hidden.clear(); }
function tweenTo(v, to, done) { place.tw = { from: { pos: v.camera.position.clone(), tgt: v.controls.target.clone(), fov: v.camera.fov }, to, t0: performance.now(), done }; v.controls.enabled = false; }
function stepTween(v) {
 const tw = place?.tw; if (!tw) return; const k = Math.min(1, (performance.now() - tw.t0) / EASE_MS), e = ease(k);
 v.camera.position.lerpVectors(tw.from.pos, tw.to.pos, e); v.controls.target.lerpVectors(tw.from.tgt, tw.to.tgt, e);
 v.camera.fov = tw.from.fov + (tw.to.fov - tw.from.fov) * e; v.camera.updateProjectionMatrix(); v.controls.update();
 if (k >= 1) { place.tw = null; v.controls.enabled = true; tw.done?.(); }
}
function enterPlace() {
 const v = view(); if (place || !v?.controls || !active()) return false;
 place = { pos: v.camera.position.clone(), tgt: v.controls.target.clone(), fov: v.camera.fov, max: v.controls.maxDistance, auto: v.controls.autoRotate, damp: v.controls.enableDamping, hidden: new Map(), tw: null, leaving: false, allowSpin: false };
 v.controls.autoRotate = false; v.controls.enableDamping = false; v.controls.maxDistance = Math.max(place.max, 14); hideBike(v);
 tweenTo(v, WIDE); refresh(); return true;
}
function restoreView(v) { v.camera.position.copy(place.pos); v.controls.target.copy(place.tgt); v.camera.fov = place.fov; v.camera.updateProjectionMatrix(); v.controls.maxDistance = place.max; v.controls.autoRotate = place.auto; v.controls.enableDamping = place.damp; v.controls.enabled = true; v.controls.update(); }
function exitPlace() {
 const v = view(); if (!place || place.leaving) return false;
 const it = items.find(i => i.uid === selected); if (it && arrange) finishEdit(!it.pending || check(it).ok);
 if (ui) ui.panel.hidden = true; selected = null; original = null;
 place.leaving = true; if (!v?.controls) { place = null; return true; }
 tweenTo(v, { pos: place.pos, tgt: place.tgt, fov: place.fov }, () => { restoreView(v); showBike(); place = null; refresh(); });
 refresh(); return true;
}
function dropAt(it) {
 for (let r = 0; r <= 4; r += .15) { const n = r ? Math.max(8, Math.round(r * 14)) : 1;
  for (let a = 0; a < n; a++) { const x = CENTRE.x + Math.cos(a / n * 6.283) * r, z = CENTRE.z + Math.sin(a / n * 6.283) * r;
   if (z > .42) continue; // never between the bike and the normal camera: new items go beside / behind the bike
   if (moveTo(it, x, z).ok) { if (it.mount !== 'wall') it.drop = performance.now(); return true; } } }
 return spawnSpot(it);
}
function stepDrops() {
 const now = performance.now();
 for (const it of items) if (it.drop) { const k = Math.min(1, (now - it.drop) / DROP_MS); it.holder.position.y = it.y + DROP_H * (1 - k) * (1 - k); if (k >= 1) { delete it.drop; apply(it); } }
}

// ---- rig adapter so the garage gizmo can drive workshop items unchanged
const rig = {
 get objects() { return active() ? items.map(i => ({ key: i.uid, holder: i.holder })) : []; },
 state: () => ({ selected, arrange }),
 get controls() { return view()?.controls; }, get camera() { return view()?.camera; },
 move(dx, dz, dy = 0) { const it = items.find(i => i.uid === selected); if (!it || !arrange) return; if (dy) { const h = (it.local.max[1] - it.local.min[1]) || .2; const lo = it.mount === 'wall' ? .1 : 0; it.y = Math.max(lo, Math.min(P().ceil - h - .05, it.y + dy)); apply(it); paint(it); } if (dx || dz) moveTo(it, it.x + dx, it.z + dz); refresh(false); },
 rotate(d) { const it = items.find(i => i.uid === selected); if (it && arrange) { rotate(it, d); refresh(false); } },
};

// ---- pointer: drag the selected item on the floor while editing; tap to select
const floorHit = e => { const v = view(), r = v.renderer.domElement.getBoundingClientRect(), ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), v.camera); return { ray, p: ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), new T.Vector3()) }; };
const pickItem = ray => { const hits = ray.intersectObjects(items.map(i => i.holder), true).filter(h => h.object.userData.savedRide && h.object.parent?.name !== 'workshop:placement-preview'); return hits[0]?.object.userData.savedRide || null; };
addEventListener('pointerdown', e => {
 const v = view(); if (!active() || e.target !== v.renderer.domElement) return;
 const { ray, p } = floorHit(e), key = pickItem(ray); down = { x: e.clientX, y: e.clientY, key };
 if (arrange && key === selected && p) { const it = items.find(i => i.uid === key); drag = { start: p.clone(), x: it.x, z: it.z, id: e.pointerId }; v.controls.enabled = false; e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
addEventListener('pointermove', e => {
 if (!drag || e.pointerId !== drag.id) return; const it = items.find(i => i.uid === selected); const { p } = floorHit(e); if (!it || !p) return;
 moveTo(it, drag.x + p.x - drag.start.x, drag.z + p.z - drag.start.z); refresh(false); e.stopImmediatePropagation();
}, true);
addEventListener('pointerup', e => {
 const v = view(); if (drag) { drag = null; v.controls.enabled = true; e.stopImmediatePropagation(); return; }
 if (!down || !active() || e.target !== v.renderer.domElement) { down = null; return; }
 const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6;
 if (tap && down.key && down.key !== selected) { select(down.key, false); e.stopImmediatePropagation(); }
 else if (tap && !down.key && selected && !arrange) select(null);
 down = null;
}, true);

// ---- UI: place button, centred glass catalogue panel, edit toolbar (game style)
const css = document.createElement('style'); css.textContent = `
#wk-room-dock{position:absolute;right:12px;bottom:12px;z-index:6;display:flex;gap:4px;padding:6px;border-radius:18px;background:linear-gradient(180deg,#101a2ccc,#060b14e6);border:1px solid #6fd3ff55;box-shadow:0 0 0 1px #000,0 10px 30px #000a,0 0 24px #2fa8ff33}#wk-room-dock[hidden]{display:none}
html body #wk-room-dock button{position:static;min-width:72px;height:56px;padding:4px 10px;border-radius:12px;border:0!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:transparent!important;color:#9fe0ff!important;box-shadow:none!important;font:800 9px/1 system-ui;letter-spacing:.12em;cursor:pointer;backdrop-filter:none}
html body #wk-room-dock button:hover{background:#1a2b44!important}
html body #wk-room-dock button.primary{background:linear-gradient(180deg,#3cf08a,#13b45c)!important;color:#03200e!important;box-shadow:0 0 16px #35e07a99!important;min-width:92px}
#wk-room-dock svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px currentColor)}#wk-room-dock .primary svg{filter:none}
#wk-room-dock .wkl{display:block;font:800 9px/1 system-ui;letter-spacing:.12em}
@media (max-height:500px),(max-width:600px){#wk-room-dock{bottom:8px;right:8px;padding:4px}html body #wk-room-dock button{min-width:60px;height:48px}html body #wk-room-dock button.primary{min-width:76px}}
/* sidebar icons */
[aria-label="Simple / Advanced"]::before{content:'';display:inline-block;width:18px;height:18px;margin-right:8px;vertical-align:-4px;background:currentColor;-webkit-mask:var(--wk-ic) center/contain no-repeat;mask:var(--wk-ic) center/contain no-repeat;filter:drop-shadow(0 0 3px currentColor)}
[aria-label="Simple / Advanced"]{--wk-ic:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7h10M4 17h6M18 4v6M14 14v6'/%3E%3Ccircle cx='18' cy='7' r='2'/%3E%3Ccircle cx='14' cy='17' r='2'/%3E%3C/svg%3E")}
/* bike controls (ROTATION / TEST MOTION / Suspension / RESET VIEW) sit left of the dock until they move into bike inspect */
body.wk-room-dock-on [data-wk-bench],body.wk-room-dock-on [data-wk-rotate],body.wk-room-dock-on [data-wk-reset]{translate:calc(-1 * var(--wk-dock-w,190px)) 0}
[data-wk-place-old]{position:absolute;right:12px;top:182px;z-index:5;min-height:34px;padding:6px 12px;border-radius:9px;border:1px solid #7affc699;background:#122037b9;color:#e9fff4;font:800 12px system-ui;letter-spacing:.06em;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);box-shadow:0 0 14px #30e9bd33;cursor:pointer}
[data-wk-place]:hover{background:#18304ad0}[data-wk-place][hidden]{display:none}
#wk-place-panel{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:#03060c66}
#wk-place-panel[hidden]{display:none}
#wk-place-panel .sheet{width:min(720px,92vw);max-height:min(82dvh,620px);overflow:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;box-sizing:border-box;padding:16px 16px 18px;border-radius:16px;border:1px solid #a3d9ef70;background:linear-gradient(135deg,#182d43c4,#080f1ccc);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);box-shadow:0 18px 50px #000a,inset 0 1px #d6f6ff22;color:#eff8ff;font:13px system-ui}
#wk-place-panel header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}#wk-place-panel h2{margin:0;font:800 18px system-ui;letter-spacing:.08em;color:#9cffd9}
#wk-place-panel header button{width:38px;height:38px;border-radius:50%;border:1px solid #8eb8d888;background:#102037cc;color:#e8f6ff;font-size:18px;cursor:pointer}
#wk-place-panel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
#wk-place-panel .card{display:flex;flex-direction:column;gap:4px;padding:8px;border-radius:12px;border:1px solid #7392ae66;background:#102033a6;color:#eff8ff;text-align:left;cursor:pointer;min-height:44px}
#wk-place-panel .card:hover{border-color:#7affc6;box-shadow:0 0 12px #30e9bd44}#wk-place-panel .card img{width:100%;height:96px;object-fit:contain;border-radius:8px;background:radial-gradient(#2a2340,#0c0b14)}
#wk-place-panel .card strong{font-size:13px}#wk-place-panel .card small{color:#9fc3d8}
#wk-place-panel .sec{margin:16px 0 8px;font:800 11px system-ui;letter-spacing:.14em;color:#8be0b8;text-transform:uppercase}#wk-place-panel .sec:first-of-type{margin-top:4px}#wk-place-panel .card.stored{border-color:#35e07a99}
#wk-place-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:45;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:7px;max-width:94vw;padding:8px;border-radius:14px;border:1px solid #a3d9ef70;background:linear-gradient(135deg,#182d43c4,#080f1ccc);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 10px 30px #0009;color:#eff8ff;font:12px system-ui}
#wk-place-mode{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:62;display:flex;align-items:center;gap:10px;padding:6px 6px 6px 14px;border-radius:999px;border:1px solid #35e07a8c;background:#0a1016b8;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 6px 20px #0008;color:#e8fff1;font:800 13px/1 system-ui;letter-spacing:.1em}
#wk-place-mode[hidden]{display:none}#wk-place-mode .dot{width:8px;height:8px;border-radius:50%;background:#35e07a;box-shadow:0 0 8px #35e07a}
#wk-place-mode button{min-height:32px;padding:6px 14px;border-radius:999px;border:0;background:#35e07a;color:#07120b;font:900 12px system-ui;letter-spacing:.06em;cursor:pointer}
#wk-place-bar[hidden]{display:none}#wk-place-bar button{min-width:44px;min-height:40px;padding:6px 12px;border-radius:10px;border:1px solid #8eb8d888;background:#102037cc;color:#e8f6ff;font:800 13px system-ui;cursor:pointer}
#wk-place-bar button.primary{border-color:#7affc6;color:#b9ffd9}#wk-place-bar button:disabled{opacity:.45;cursor:default}
#wk-place-bar .status{min-width:120px;text-align:center;font-weight:800}#wk-place-bar .status.ok{color:${OK}}#wk-place-bar .status.bad{color:${BAD}}`;
document.head.append(css);
function ensureUi() {
 const v = view(), host = v?.renderer?.domElement?.parentElement; if (!host) return null;
 if (ui && ui.host === host) return ui;
 ui?.button.remove(); ui?.dock?.remove(); gizmoStop?.();
 const button = document.createElement('button'); button.type = 'button'; button.dataset.wkPlace = ''; dockButton(button, 'edit', 'EDIT ROOM'); button.setAttribute('aria-label', 'Edit room: place props in the workshop'); button.onclick = () => { enterPlace(); openPanel(); };
 // bottom-right room dock (Chris's approved workshop HUD): EDIT ROOM + TEST RIDE
 document.getElementById('wk-room-dock')?.remove(); const dock = document.createElement('div'); dock.id = 'wk-room-dock'; dock.setAttribute('role', 'toolbar'); dock.setAttribute('aria-label', 'Workshop');
 const ride = document.createElement('button'); ride.type = 'button'; ride.className = 'primary'; ride.dataset.wkTestRide = ''; dockButton(ride, 'play', 'TEST RIDE'); ride.setAttribute('aria-label', 'Test ride this bike');
 ride.onclick = () => { const t = [...document.querySelectorAll('button')].find(b => b !== ride && /^TEST RIDE/.test((b.textContent || '').trim())); if (t) t.click(); else document.querySelector('[data-destination=race]')?.click(); };
 dock.append(button, ride); host.append(dock);
 let panel = document.getElementById('wk-place-panel'); if (!panel) { panel = document.createElement('div'); panel.id = 'wk-place-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Place in workshop'); panel.onclick = e => { if (e.target === panel) { panel.hidden = true; if (!arrange) exitPlace(); } }; document.body.append(panel); }
 let pill = document.getElementById('wk-place-mode'); if (!pill) { pill = document.createElement('div'); pill.id = 'wk-place-mode'; pill.hidden = true; pill.setAttribute('role', 'status'); pill.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="lbl">PLACE MODE</span><button type="button" data-wk-place-exit aria-label="Exit place mode">✓ Done</button>'; pill.querySelector('button').onclick = () => exitPlace(); document.body.append(pill); }
 let bar = document.getElementById('wk-place-bar'); if (!bar) { bar = document.createElement('div'); bar.id = 'wk-place-bar'; bar.hidden = true; document.body.append(bar); }
 gizmoStop = garageGizmo(host, () => (active() ? rig : null), () => { if (selected) remove(selected); }, value => { if (value) { arrange = true; const it = items.find(i => i.uid === selected); original = it ? { x: it.x, y: it.y, z: it.z, yaw: it.yaw } : null; refresh(); } else finishEdit(true); });
 ui = { host, button, panel, bar, pill, dock }; return ui;
}
function cardFor(def, stored, onClick) {
 const c = document.createElement('button'); c.type = 'button'; c.className = stored ? 'card stored' : 'card'; c.dataset.placeItem = def.id; if (stored) c.dataset.stored = '';
 const img = document.createElement('img'); img.alt = ''; img.src = thumb(def); const s = document.createElement('strong'); s.textContent = def.name;
 const sm = document.createElement('small'); sm.textContent = stored ? 'In storage' : (def.mount === 'wall' ? 'Wall mounted' : 'Floor');
 c.append(img, s, sm); c.onclick = onClick; return c;
}
function openPanel() {
 const u = ensureUi(); if (!u || !inst) return;
 const sheet = document.createElement('div'); sheet.className = 'sheet';
 const head = document.createElement('header'); const h = document.createElement('h2'); h.textContent = 'PLACE IN WORKSHOP'; const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close'); x.onclick = () => { u.panel.hidden = true; if (!arrange) exitPlace(); }; head.append(h, x); sheet.append(head);
 const shown = storage.filter(s => defOf(s.item) && !items.some(i => i.uid === s.uid && i.pending));
 if (shown.length) {
  const sec = document.createElement('div'); sec.className = 'sec'; sec.textContent = 'Storage'; sheet.append(sec);
  const g = document.createElement('div'); g.className = 'grid';
  for (const s of shown) g.append(cardFor(defOf(s.item), true, () => { u.panel.hidden = true; beginStored(s); }));
  sheet.append(g);
 }
 if (shown.length) { const sec = document.createElement('div'); sec.className = 'sec'; sec.textContent = 'Place'; sheet.append(sec); }
 const grid = document.createElement('div'); grid.className = 'grid';
 for (const def of PLACEABLES) grid.append(cardFor(def, false, () => { u.panel.hidden = true; begin(def.id); }));
 sheet.append(grid); u.panel.replaceChildren(sheet); u.panel.hidden = false;
}
let thumbRenderer = null;
function thumb(def) {
 if (thumbs.has(def.id)) return thumbs.get(def.id);
 try {
  thumbRenderer ||= new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); const r = thumbRenderer; r.setSize(200, 130, false); r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping;
  const s = new T.Scene(), o = P().kit.build(def.type, def.params || {}); s.add(o, new T.HemisphereLight('#d9d2ff', '#201a2a', 1.4)); const k = new T.DirectionalLight('#ffe7cf', 2.5); k.position.set(2, 3, 3); s.add(k); const pl = new T.PointLight('#b04cff', 6, 6); pl.position.set(-2, 1.5, 1); s.add(pl);
  const b = new T.Box3().setFromObject(o), sp = b.getBoundingSphere(new T.Sphere()), cam = new T.PerspectiveCamera(30, 200 / 130, .02, 50), dir = new T.Vector3(.55, .4, 1).normalize();
  cam.position.copy(sp.center).addScaledVector(dir, sp.radius / Math.sin(15 * Math.PI / 180)); cam.lookAt(sp.center); r.render(s, cam); const url = r.domElement.toDataURL('image/png'); thumbs.set(def.id, url); return url;
 } catch { return ''; }
}
function refresh(full = true) {
 const u = ensureUi(); if (!u) return;
 u.button.hidden = !active() || arrange || !!place?.leaving;
 if (u.dock) { u.dock.hidden = u.button.hidden; document.body.classList.toggle('wk-room-dock-on', !u.dock.hidden); if (!u.dock.hidden) document.body.style.setProperty('--wk-dock-w', (u.dock.offsetWidth + 10) + 'px'); }
 u.pill.hidden = !place || place.leaving || !active();
 const it = items.find(i => i.uid === selected); for (const i of items) i.mark.visible = i === it && arrange;
 if (!it || !arrange || !active()) { u.bar.hidden = true; return; }
 const v = it.valid || paint(it);
 if (full || !u.bar.firstChild) {
  u.bar.replaceChildren();
  const b = (label, aria, fn, cls = '') => { const n = document.createElement('button'); n.type = 'button'; dockButton(n, label[0], label[1]); n.setAttribute('aria-label', aria); n.className = cls; n.onclick = fn; u.bar.append(n); return n; };
  if (it.mount !== 'wall') { b(['rl', 'TURN'], 'Rotate left', () => { rotate(it, STEP); refresh(false); }); b(['rr', 'TURN'], 'Rotate right', () => { rotate(it, -STEP); refresh(false); }); }
  else { b(['up', 'UP'], 'Raise', () => rig.move(0, 0, .1)); b(['down', 'DOWN'], 'Lower', () => rig.move(0, 0, -.1)); }
  const st = document.createElement('span'); st.className = 'status'; u.bar.append(st);
  b(['check', it.pending ? 'PLACE' : 'DONE'], it.pending ? 'Place here' : 'Finish moving', () => finishEdit(true), 'primary').dataset.wkPlaceConfirm = '';
  b(['x', 'CANCEL'], it.pending ? 'Cancel placing' : 'Undo move', () => finishEdit(false));
 }
 const st = u.bar.querySelector('.status'), ok = it.valid?.ok; st.className = 'status ' + (ok ? 'ok' : 'bad');
 st.textContent = ok ? 'Fits here' : ({ wall: 'Hits a wall', ceiling: 'Hits the ceiling', prop: 'Hits the ' + (String(it.valid?.hit || 'prop').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()), item: 'Hits another item', zone: (it.valid?.hit || '').startsWith('door') ? 'Blocks a door' : 'In the bike area', floor: 'Below the floor' })[it.valid?.reason] || 'Blocked';
 u.bar.querySelector('[data-wk-place-confirm]').disabled = !ok; u.bar.hidden = false;
}

// ---- lifecycle: (re)build items whenever the workshop room instance changes
function load() {
 for (const it of items) disposeItem(it); items = []; selected = null; arrange = false;
 const rec = readStore().rooms[ROOM] || {};
 storage = (rec.storage || []).filter(s => defOf(s.item)).map(s => ({ uid: s.uid, item: s.item }));
 const seen = new Set();
 for (const s of rec.items || []) {
  const def = defOf(s.item); if (!def) continue;
  const it = makeItem(def, s.uid, s); paint(it); items.push(it); seen.add(it.uid);
 }
 for (const f of P()?.fixtures || []) {
  if (seen.has(f.id) || storage.some(s => s.uid === f.id)) continue;
  const it = makeItem(f, f.id, f.defaultPos); paint(it); items.push(it);
 }
}
let tagAt = 0;
function tagHud() { const now = performance.now(); if (now - tagAt < 500) return; tagAt = now; for (const b of document.querySelectorAll('button:not([data-wk-reset])')) if ((b.textContent || '').includes('RESET VIEW')) b.dataset.wkReset = ''; for (const b of document.querySelectorAll('button:not([data-primary])')) if ((b.textContent || '').trim() === '+' && b.getBoundingClientRect().top < 60) b.dataset.primary = ''; }
function tick() {
 tagHud();
 const next = world()?.getInstance?.(ROOM) || null;
 if (next !== inst) { inst = next?.placement ? next : null; if (inst) load(); }
 if (place && !active()) { const v = view(); if (v?.controls) restoreView(v); showBike(); place = null; }
 if (inst) { const v = view(); if (place && v) { stepTween(v); if (place && !place.leaving) hideBike(v); } stepDrops(); if (v?.controls && ((place && !place.leaving && !place.allowSpin) || (selected && arrange && !place))) v.controls.autoRotate = false; refresh(false); }
 requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
addEventListener('click', e => { if (!place || place.leaving || !e.target.closest('[data-wk-rotate]')) return; queueMicrotask(() => { if (place && !place.leaving) place.allowSpin = !!view()?.controls?.autoRotate; }); });

globalThis.__WK_WORKSHOP_PLACE__ = {
 catalog: () => PLACEABLES.map(p => p.id),
 ready: () => !!inst,
 /** Validate a hypothetical placement without creating anything. */
 check(id, pos) { const def = defOf(id); if (!def || !inst) return { ok: false, reason: 'unknown' }; const it = makeItem(def, 'probe', pos); const v = check(it, { x: pos.x, y: pos.y ?? it.y, z: pos.z, yaw: pos.yaw ?? 0 }); disposeItem(it); return v; },
 add(id, pos) { const def = defOf(id); if (!def || !inst) return null; const it = makeItem(def, id.startsWith('fixture:') ? id : uidOf(), pos); const v = paint(it); if (!v.ok) { disposeItem(it); return null; } items.push(it); storage = storage.filter(s => s.uid !== it.uid); save(); return it.uid; },
 move(uid, pos) { const it = items.find(i => i.uid === uid); if (!it) return { ok: false }; const prev = { x: it.x, y: it.y, z: it.z, yaw: it.yaw }; Object.assign(it, { x: pos.x ?? it.x, y: pos.y ?? it.y, z: pos.z ?? it.z }); apply(it); const v = paint(it); if (!v.ok) { Object.assign(it, prev); apply(it); paint(it); } else save(); return v; },
 rotate(uid, delta) { const it = items.find(i => i.uid === uid); if (!it) return { ok: false }; const prev = { yaw: it.yaw, x: it.x, z: it.z }; const v = rotate(it, delta); if (!v.ok) { Object.assign(it, prev); apply(it); paint(it); } else save(); return v; },
 remove: uid => remove(uid),
 list: () => items.filter(i => !i.pending).map(({ uid, item, x, y, z, yaw, mount, fixture }) => ({ uid, item, x, y, z, yaw, mount, fixture: !!fixture })),
 storage: () => storage.map(({ uid, item }) => ({ uid, item })),
 fixtures: () => (P()?.fixtures || []).map(f => ({ id: f.id, name: f.name, type: f.type, defaultPos: { ...f.defaultPos } })),
 begin, beginStored, confirm: () => finishEdit(true), cancel: () => finishEdit(false), select: (uid, edit) => select(uid, edit), open: openPanel,
 dragTo(x, z) { const it = items.find(i => i.uid === selected); if (!it) return null; const v = moveTo(it, x, z); refresh(false); return v; },
 bboxCentre(uid) { const it = items.find(i => i.uid === uid); if (!it) return null; const f = footXZ(it); return [f.x, it.y + (it.local.min[1] + it.local.max[1]) / 2, f.z]; },
 placeMode: { enter: () => enterPlace(), exit: () => exitPlace(), state: () => ({ on: !!place, leaving: !!place?.leaving, tweening: !!place?.tw, hidden: place ? place.hidden.size : 0, allowSpin: !!place?.allowSpin, autoRotate: !!view()?.controls?.autoRotate }) },
 state: () => ({ ready: !!inst, placeMode: !!place, items: items.length, selected, arrange, pending: items.some(i => i.pending), valid: items.find(i => i.uid === selected)?.valid || null, key: KEY }),
 reload: load,
};
