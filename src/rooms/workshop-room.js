// The 360° neon workshop: Chris's art on the walls (workshop-shell.js) + modelled kit props
// (workshop-props.js) baked into a handful of draw calls, plus the collision data the
// placement system uses. Drop-in replacement for garageRoom({workshop:true}) in world-rooms.js.
import { createKit } from '../props/kit/index.js';
import { workshopShell, workshopGeometry } from './workshop-shell.js';
import { roomLayout, roomSlots } from './workshop-props.js';
import { obbFrom, halfPlanes } from './room-collision.js';
import { RoomEnvironment } from '../../vendor/RoomEnvironment.js';

const ASSET = p => new URL('../../' + p, import.meta.url).href;

export function workshopKitRoom(T, scene, renderer, { asSecondary = false } = {}) {
 const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches, quality = coarse ? 'mobile' : 'desktop';
 const previous = { environment: scene.environment, background: scene.background, fog: scene.fog, envI: scene.environmentIntensity };
 const room = new T.Group(); room.name = 'workshop:room'; scene.add(room);
 // --- environment for the PBR props (same neon-strip RoomEnvironment trick as the original room)
 let envTarget = null;
 if (!asSecondary) {
  scene.background = new T.Color('#0b0714'); scene.fog = new T.Fog('#140a24', 9, 30);
  const pm = new T.PMREMGenerator(renderer), env = new RoomEnvironment(renderer);
  for (const [x, c] of [[-3, '#b04cff'], [-1, '#ff4fd2'], [1, '#52daff'], [3, '#ffb35a']]) { const s = new T.Mesh(new T.BoxGeometry(2, .05, .3), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(5) })); s.position.set(x, 3.6, 0); env.add(s); }
  envTarget = pm.fromScene(env, .04); scene.environment = envTarget.texture; scene.environmentIntensity = .6; env.dispose?.(); pm.dispose();
 }
 // --- walls + floor
 const TL = new T.TextureLoader(), tex = {}; const load = (k, p) => { tex[k] = TL.load(ASSET(p)); };
 load('art', 'assets/workshop/art-room.jpg');
 load('brick', 'assets/workshop/art-room-brick.jpg'); load('concrete', 'assets/workshop/concrete.jpg'); load('ceiling', 'assets/workshop/ceiling.jpg');
 const shell = workshopShell(T, tex, { quality }); room.add(shell.group);
 const R = shell.room;
 // walls and ceiling face inward only, so an orbit that leaves the room looks in like a cut-away
 shell.group.traverse(o => { if (o.isMesh && o !== shell.floor) o.material.side = T.FrontSide; });
 fixWinding(T, shell.group, R);
 // Depth precision (phone wall glitch): the shared camera's near plane is .005, so on phone GPUs with
 // 16/24-bit depth the walls are only resolved to centimetres. The projected walls then z-fight with the
 // wall-mounted props (screens, tool wall, fuse boxes, neon, vines) and show as blocky, smeared, duplicated
 // pieces that change with the view angle. Push the shell back in depth and scale the near plane with the
 // orbit distance (restored when the workshop isn't the one drawn).
 shell.group.traverse(o => { if (o.isMesh) Object.assign(o.material, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 }); });
 const nearHook = { base: null, cam: null }, prevSceneHook = scene.onBeforeRender;
 if (!asSecondary) scene.onBeforeRender = function (r, s, cam, rt) {
  prevSceneHook?.call(this, r, s, cam, rt);
  if (rt || !cam?.isPerspectiveCamera) return;
  const v = globalThis.__WK_VIEW__; if (!v || v.camera !== cam) return;
  if (nearHook.cam !== cam) { nearHook.cam = cam; nearHook.base = cam.near; }
  const t = v.controls?.target, want = room.visible && t ? Math.min(.1, Math.max(nearHook.base, cam.position.distanceTo(t) * .08)) : nearHook.base;
  if (Math.abs(cam.near - want) > want * .02) { cam.near = want; cam.updateProjectionMatrix(); }
 };
 const releaseNear = () => { if (!asSecondary && scene.onBeforeRender !== prevSceneHook) scene.onBeforeRender = prevSceneHook || (() => {}); if (nearHook.cam) { nearHook.cam.near = nearHook.base; nearHook.cam.updateProjectionMatrix(); } };
 const floor = shell.floor; let reflecting = false;
 if (!coarse) floor.onBeforeRender = (r, s, cam) => { if (reflecting || r.getRenderTarget() !== null || !room.visible) return; reflecting = true; try { shell.renderReflection(r, s, cam); } finally { reflecting = false; } };
 // --- lights for the modelled props (and the bike)
 const lights = shell.pbrLights(coarse ? 6 : 10);
 const fill = new T.PointLight('#ffd2a8', 2.2, 3.2, 1.6); fill.position.set(2.0, 1.25, -1.7); lights.push(fill); // tall chest's dark side
 for (const l of lights) room.add(l);
 // --- props
 const kit = createKit(T), layout = roomLayout(R), source = new T.Group(); source.name = 'workshop:props-src';
 const colliders = [];
 for (const e of layout) {
  const o = kit.build(e.type, e.params || {});
  const local = kit.solidBounds(o);
  o.position.set(...e.at); if (e.rot) o.rotation.set(...e.rot); else o.rotation.y = e.rotY || 0; source.add(o);
  if (e.solid === false) continue;
  if (e.rot) { source.updateMatrixWorld(true); const b = kit.solidBounds(o); colliders.push({ cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2, hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2, yaw: 0, y0: b.min.y, y1: b.max.y, name: e.type }); }
  else colliders.push(obbFrom({ min: local.min.toArray(), max: local.max.toArray() }, e.at, e.rotY || 0, e.door || e.type));
 }
 const baked = kit.bake(source); baked.name = 'workshop:props'; room.add(baked);
 source.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.userData.kitKey) o.geometry.dispose(); }); // vines/tubes made per build
 // --- placement data
 const { BACKZ, RIGHTX, LEFTX, FRONTZ, CEIL, corner, chamferEnd } = R;
 const outline = [[corner.x, BACKZ], [RIGHTX, BACKZ], [RIGHTX, FRONTZ], [LEFTX, FRONTZ], [LEFTX, chamferEnd.z]];
 const planes = halfPlanes(outline);
 const zone = (name, x0, x1, z0, z1, y1 = 2.6) => ({ name, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, yaw: 0, y0: 0, y1 });
 const zones = [zone('bike-stand', -.98, .94, -.42, .42, 1.6), zone('door:garage', -1.75, 1.75, 5.55, FRONTZ, 3), zone('door:outside', LEFTX, LEFTX + 1.0, 3.45, 4.95, 2.4)];
 const placed = new T.Group(); placed.name = 'workshop:placed'; room.add(placed);
 const placement = { kit, planes, outline, ceil: CEIL, colliders, zones, slots: roomSlots(R), group: placed, room: R, chamferEnd, chamferDir: R.chamferDir };
 const allLights = []; room.traverse(o => { if (o.isLight) allLights.push(o); });
 const drawCalls = baked.children.length + shell.group.children.length;
 return {
  room, lights: allLights, placement, shell,
  state: () => ({ worldRoom: true, kit: true, theme: 'workshop', art: 'art-room', reflection: !coarse, quality, drawCalls, propDrawCalls: baked.children.length, props: layout.length, colliders: colliders.length, placed: placed.children.length }),
  setActive(on) { room.visible = !!on; for (const l of allLights) l.visible = !!on; },
  dispose() {
   releaseNear(); room.removeFromParent(); baked.userData.dispose?.(); shell.dispose(); kit.dispose();
   placed.traverse(o => { if (o.isMesh && o.name === 'kit:merged') o.geometry.dispose(); });
   if (envTarget && scene.environment === envTarget.texture) { scene.environment = previous.environment; scene.background = previous.background; scene.fog = previous.fog; scene.environmentIntensity = previous.envI ?? 1; }
   envTarget?.dispose();
  },
 };
}

// Make every wall/ceiling quad face the room interior (normals toward the room centre).
function fixWinding(T, group, R) {
 const centre = new T.Vector3((R.LEFTX + R.RIGHTX) / 2, R.CEIL / 2, (R.BACKZ + R.FRONTZ) / 2);
 group.traverse(o => {
  if (!o.isMesh || o.name === 'workshop:floor') return;
  const g = o.geometry, p = g.attributes.position, n = g.attributes.normal; if (!n) return;
  const v = new T.Vector3(p.getX(0), p.getY(0), p.getZ(0)), nn = new T.Vector3(n.getX(0), n.getY(0), n.getZ(0));
  if (nn.dot(centre.clone().sub(v)) < 0) { const idx = []; for (let i = 0; i < p.count; i += 3) idx.push(i, i + 2, i + 1); g.setIndex(idx); for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); n.needsUpdate = true; }
 });
}
export { workshopGeometry };
