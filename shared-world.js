/**
 * Shared Three.js world: one scene, many rooms, camera transitions, door hotspots.
 */
import * as T from './vendor/three.module.js';
import { ROOMS, getRoom, doorLink } from './world-rooms.js';

const EASE = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // easeInOutCubic
const TRANSITION_MS = 1500;

let view = null;
let instances = Object.create(null); // id -> room instance
let activeId = 'workshop';
let transitioning = false;
let lazyStarted = false;
let doorUi = null;
let lastUnlimited = null;

function unlimited() {
 return !!globalThis.__WK_UNLIMITED_ZOOM__?.enabled;
}

function applyCameraLock(roomId) {
 const v = view;
 if (!v?.controls) return;
 const def = getRoom(roomId);
 if (!def) return;
 if (unlimited()) {
  v.controls.minDistance = 0.001;
  v.controls.maxDistance = 1e6;
  v.controls.maxPolarAngle = Math.PI;
  v.controls.minPolarAngle = 0;
 } else {
  v.controls.minDistance = def.camera.minDistance;
  v.controls.maxDistance = def.camera.maxDistance;
  v.controls.maxPolarAngle = def.camera.maxPolarAngle;
  v.controls.minPolarAngle = 0;
 }
}

function worldAnchor(roomId) {
 const def = getRoom(roomId);
 if (!def) return new T.Vector3();
 const [ox, oy, oz] = def.offset;
 const [ax, ay, az] = def.camera.anchor;
 return new T.Vector3(ox + ax, oy + ay, oz + az);
}

function setRoomActive(id, on) {
 const inst = instances[id];
 if (!inst) return;
 if (typeof inst.setActive === 'function') inst.setActive(on);
 else {
  inst.room.visible = !!on;
  inst.room.traverse(o => { if (o.isLight) o.visible = !!on; });
 }
}

function ensureRoom(id) {
 if (instances[id]) return instances[id];
 const def = getRoom(id);
 if (!def || def.stub) return null;
 if (!view) return null;
 const inst = def.load(T, view.scene, view.renderer, { offset: def.offset });
 if (!inst) return null;
 if (def.id === 'workshop' && def.offset.some(Boolean)) inst.room.position.set(...def.offset);
 instances[id] = inst;
 setRoomActive(id, id === activeId);
 return inst;
}

function ensureDoorUi() {
 if (doorUi) return doorUi;
 doorUi = document.createElement('button');
 doorUi.type = 'button';
 doorUi.dataset.wkDoorHotspot = '';
 doorUi.setAttribute('aria-label', 'Go through door');
 doorUi.hidden = true;
 doorUi.style.cssText = 'position:fixed;z-index:40;min-width:120px;min-height:40px;padding:8px 14px;border-radius:10px;border:1px solid #8eb8d888;background:#102037cc;color:#e8f6ff;font:700 13px system-ui;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);cursor:pointer;pointer-events:auto';
 doorUi.onclick = () => {
  const door = doorUi._door;
  if (!door) return;
  if (door.stub) {
   doorUi.textContent = 'Coming soon';
   setTimeout(() => { if (doorUi._door === door) doorUi.textContent = labelFor(door); }, 1200);
   return;
  }
  goThroughDoor(door.id);
 };
 document.body.append(doorUi);
 return doorUi;
}

function labelFor(door) {
 if (door.stub) return 'Exit (coming soon)';
 const t = getRoom(door.target);
 return t ? `Enter ${t.label}` : 'Go through door';
}

function updateDoorHotspot() {
 const v = view;
 if (!v || transitioning || document.body.dataset.playerView) {
  if (doorUi) doorUi.hidden = true;
  return;
 }
 const def = getRoom(activeId);
 if (!def?.doors?.length) { if (doorUi) doorUi.hidden = true; return; }
 const cam = v.camera;
 let best = null, bestDist = 4.5;
 for (const door of def.doors) {
  const [ox, oy, oz] = def.offset;
  const [dx, dy, dz] = door.position;
  const world = new T.Vector3(ox + dx, oy + dy, oz + dz);
  const dist = cam.position.distanceTo(world);
  if (dist < bestDist) { best = door; bestDist = dist; }
 }
 const ui = ensureDoorUi();
 if (!best) { ui.hidden = true; return; }
 const [ox, oy, oz] = def.offset;
 const world = new T.Vector3(ox + best.position[0], oy + best.position[1], oz + best.position[2]);
 world.project(cam);
 if (world.z > 1 || Math.abs(world.x) > 1.1 || Math.abs(world.y) > 1.1) { ui.hidden = true; return; }
 const rect = v.renderer.domElement.getBoundingClientRect();
 const x = (world.x * 0.5 + 0.5) * rect.width + rect.left;
 const y = (-world.y * 0.5 + 0.5) * rect.height + rect.top;
 ui.style.left = Math.round(x - 60) + 'px';
 ui.style.top = Math.round(y - 20) + 'px';
 ui._door = best;
 ui.textContent = labelFor(best);
 ui.hidden = false;
}

function animateCamera(fromPos, fromTarget, toPos, toTarget, ms = TRANSITION_MS) {
 return new Promise(resolve => {
  const v = view;
  if (!v) return resolve();
  const start = performance.now();
  const damping = v.controls.enableDamping;
  v.controls.enableDamping = false;
  v.controls.enabled = false;
  let done = false;
  function finish() {
   if (done) return;
   done = true;
   v.camera.position.copy(toPos);
   v.controls.target.copy(toTarget);
   v.controls.update();
   v.controls.enableDamping = damping;
   v.controls.enabled = true;
   resolve();
  }
  function frame(now) {
   if (done) return;
   const t = EASE(Math.min(1, (now - start) / ms));
   v.camera.position.lerpVectors(fromPos, toPos, t);
   v.controls.target.lerpVectors(fromTarget, toTarget, t);
   v.controls.update();
   if (t < 1) requestAnimationFrame(frame);
   else finish();
  }
  requestAnimationFrame(frame);
  // Safety: never hang if rAF is starved (headless / background)
  setTimeout(finish, ms + 800);
 });
}

/** Zoom out → pan → zoom in between rooms (~1.5s). */
export async function transitionTo(roomId, { throughDoor = false } = {}) {
 if (!view || transitioning) return false;
 const def = getRoom(roomId);
 if (!def) return false;
 if (def.stub) return false;
 if (roomId === activeId && instances[roomId]) return true;
 transitioning = true;
 try {
  ensureRoom(roomId);
  // Warm both rooms visible during pan for overview feel
  for (const id of Object.keys(instances)) setRoomActive(id, true);
  const from = worldAnchor(activeId);
  const to = worldAnchor(roomId);
  const cam = view.camera.position.clone();
  const target = view.controls.target.clone();
  // Mid overview: high and back enough to see both rooms
  const midTarget = from.clone().lerp(to, 0.5);
  midTarget.y = Math.max(midTarget.y, 2.2);
  const midCam = midTarget.clone().add(new T.Vector3(
   throughDoor ? (to.x - from.x) * 0.15 : 6,
   8,
   throughDoor ? (to.z - from.z) * 0.35 + 4 : 10
  ));
  const endCam = to.clone().add(new T.Vector3(0.5, 1.4, roomId === 'garage' ? 5.5 : 3.2));
  const endTarget = to.clone();

  await animateCamera(cam, target, midCam, midTarget, TRANSITION_MS * 0.45);
  await animateCamera(midCam, midTarget, endCam, endTarget, TRANSITION_MS * 0.55);

  activeId = roomId;
  for (const id of Object.keys(instances)) setRoomActive(id, id === activeId || unlimited());
  applyCameraLock(roomId);
  view.worldRoom = instances[roomId];
  view.sharedRoomId = roomId;
  return true;
 } finally {
  transitioning = false;
 }
}

export async function goThroughDoor(doorId) {
 const door = Object.values(ROOMS).flatMap(r => r.doors || []).find(d => d.id === doorId);
 if (!door || door.stub) return false;
 return transitionTo(door.target, { throughDoor: true });
}

export function attach(v) {
 if (!v?.scene || !v?.renderer) return null;
 if (view && view !== v) {
  for (const inst of Object.values(instances)) inst.dispose?.();
  instances = Object.create(null);
  lazyStarted = false;
 }
 view = v;
 activeId = 'workshop';
 const workshop = ensureRoom('workshop');
 v.worldRoom = workshop;
 v.sharedRoomId = 'workshop';
 applyCameraLock('workshop');
 if(v.camera&&v.camera.far<120){v.camera.far=120;v.camera.updateProjectionMatrix();}
 // Hide stock stage floor/ring
 if (v.stage) {
  if (v.stage.floor) v.stage.floor.visible = false;
  if (v.stage.ring) v.stage.ring.visible = false;
  if (v.stage.shadow) {
   v.stage.shadow.position.y = 0.003;
   v.stage.shadow.renderOrder = 2;
   v.stage.shadow.material.depthWrite = false;
  }
  const [key, rim, fill] = v.stage.lights || [];
  if (key) key.color.set('#fff0f5');
  if (rim) { rim.color.set('#829bff'); rim.intensity = 1.9; }
  if (fill) { fill.color.set('#bc6dff'); fill.intensity = 0.7; }
  const ks = key?.shadow;
  if (ks) { ks.normalBias = 0.012; ks.bias = -2e-4; }
 }
 startLazyLoads();
 return workshop;
}

function startLazyLoads() {
 if (lazyStarted) return;
 lazyStarted = true;
 // Garage loads in background after first frames
 const kick = () => {
  try{const inst=ensureRoom('garage');if(inst&&activeId!=='garage')setRoomActive('garage',unlimited());}catch(e){}
 };
 if (typeof requestIdleCallback === 'function') requestIdleCallback(kick, { timeout: 2500 });
 else setTimeout(kick, 1200);
}

export function tick() {
 if (!view) return;
 const u = unlimited();
 if (u !== lastUnlimited) {
  lastUnlimited = u;
  applyCameraLock(activeId);
  // Overview: show all rooms when unlimited zoom is on
  for (const id of Object.keys(instances)) setRoomActive(id, u || id === activeId);
 }
 updateDoorHotspot();
}

export function state() {
 return {
  active: activeId,
  transitioning,
  rooms: Object.keys(instances),
  registry: Object.keys(ROOMS),
  doors: Object.values(ROOMS).flatMap(r => r.doors || []),
  unlimited: unlimited(),
 };
}

export function getActive() { return activeId; }
export function getInstance(id) { return instances[id] || null; }

export const api = {
 attach, transitionTo, goThroughDoor, tick, state, getActive, getInstance,
 open: async (id) => {
  if (id === 'shop' || id === 'character') return false; // lounge UI handles these
  return transitionTo(id);
 },
};

globalThis.__WK_SHARED_WORLD__ = api;
addEventListener('wk-unlimited-zoom', () => { lastUnlimited = null; tick(); });
