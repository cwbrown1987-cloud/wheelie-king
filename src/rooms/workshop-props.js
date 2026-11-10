// Modelled props for the 360° workshop, built from the reusable kit (src/props/kit).
// Free-standing props in the back run stand exactly where they are in Chris's art; flat
// wall details there (pegboard, blueprint screen, tubes, fuse box, pipes, vines) come from
// the art itself. The other walls carry on in the same neon style (approved art-room concept).
// Every entry: { type, params, at:[x,y,z], rotY | rot:[x,y,z], solid?:false }.
const PI = Math.PI;

export function roomLayout(R) {
 const { BACKZ, RIGHTX, LEFTX, FRONTZ, CEIL, chamferEnd, chamferDir } = R;
 const nx = -chamferDir.z, nz = chamferDir.x, chN = nx > 0 ? { x: nx, z: nz } : { x: -nx, z: -nz };
 const chYaw = Math.atan2(chN.x, chN.z);
 const W = {
  back: (x, y, off, extra = {}) => ({ at: [x, y, BACKZ + off], rotY: 0, ...extra }),
  left: (z, y, off, extra = {}) => ({ at: [LEFTX + off, y, z], rotY: PI / 2, ...extra }),
  right: (z, y, off, extra = {}) => ({ at: [RIGHTX - off, y, z], rotY: -PI / 2, ...extra }),
  front: (x, y, off, extra = {}) => ({ at: [x, y, FRONTZ - off], rotY: PI, ...extra }),
  ch: (s, y, off, extra = {}) => ({ at: [chamferEnd.x + chamferDir.x * s + chN.x * off, y, chamferEnd.z + chamferDir.z * s + chN.z * off], rotY: chYaw, ...extra }),
 };
 const vert = e => ({ ...e, rot: [0, e.rotY, PI / 2], rotY: undefined });
 const L = [];
 const put = (type, params, place, extra = {}) => L.push({ type, params, ...place, ...extra });

 // ---------- back wall run (positions from the art) ----------
 put('toolChest', { width: .89, height: .95, depth: .58, casterRadius: .034, drawers: [.06, .06, .06, .06, .09, .09, .13] }, { at: [1.075, 0, -3.14], rotY: 0 });
 put('toolChest', { width: .96, height: .95, depth: .58, casterRadius: .034, drawers: [.06, .06, .06, .09, .09, .13, .13], sideHandles: false }, { at: [2.02, 0, -3.14], rotY: 0 });
 put('toolChest', { width: .92, height: 1.38, depth: .64, casterRadius: .036, drawers: [.05, .05, .05, .05, .07, .07, .07, .1, .1, .14] }, { at: [3.0, 0, -2.66], rotY: 0 });
 put('hardCase', { width: .34, height: .14, depth: .26 }, { at: [1.66, 1.07, -3.26] });
 put('hardCase', { width: .3, height: .12, depth: .24, skin: { body: '#2a63c9' } }, { at: [2.02, 1.07, -3.3] });
 put('sprayCan', { height: .2, skin: { body: '#c0262f' } }, { at: [2.22, 1.07, -3.3] });
 put('sprayCan', { height: .19, skin: { body: '#e0b324' } }, { at: [2.3, 1.07, -3.34] });
 put('can', { radius: .05, height: .14, skin: { label: '#8a96a6' } }, { at: [2.44, 1.07, -3.3] });
 put('can', { radius: .06, height: .12, skin: { label: '#15181e' } }, { at: [1.2, 1.07, -3.3] });
 put('hardCase', { width: .3, height: .12, depth: .24, skin: { body: '#a42470' } }, { at: [2.85, 1.5, -2.8] });
 
 
 
 
 put('shelving', { width: 1.26, height: 2.3, depth: .42, style: 'steel', levels: [.12, .66, 1.14, 1.64, 2.24], seed: 3 }, { at: [-1.54, 0, -4.07], rotY: 0 });
 put('shelving', { width: 1.26, height: 2.3, depth: .45, levels: [.12, .6, 1.08, 1.56, 2.04], seed: 11 }, { at: [-4.14, 0, -2.48], rotY: 1.094 });
 put('shelving', { width: .92, height: 2.3, depth: .45, levels: [.12, .6, 1.08, 1.56, 2.04], seed: 23 }, { at: [-3.63, 0, -3.52], rotY: 1.094 });
 
 
 

 // ---------- angled wall continuation (outside the art frame) ----------
 put('shelving', { width: 1.6, height: 2.0, depth: .46, levels: [.1, .5, .9, 1.3, 1.7], seed: 31 }, W.ch(1.1, 0, .48));
 put('vine', { length: 1.4, strands: 6, spread: .9, seed: 9 }, W.ch(.7, CEIL - .06, .02));

 // ---------- left wall: bench + drawers + vice + pegboard, outside door ----------
 put('workbench', { width: 2.65, depth: .72 }, W.left(2.175, 0, .74));
 put('toolWall', { width: 1.35, height: .7 }, W.left(2.725, 1.25, .005));
 put('shopLight', { length: 1.2, drop: CEIL - 2.47 - .06 }, W.left(2.3, 2.38, .42));
 put('hardCase', { width: .3, height: .13, depth: .24 }, W.left(1.55, .92, .44));
 put('bottle', { height: .22 }, W.left(1.25, .92, .3));
 put('door', { width: 1.0, height: 2.15 }, W.left(4.2, 0, .005), { door: 'workshop-to-outside' });
 put('neonTube', { length: .45, color: '#3dff8a' }, W.left(4.2, 2.42, .005));
 put('neonTube', { length: 1.6, color: '#b04cff' }, vert(W.left(5.6, 1.8, .005)));
 put('fuseBox', {}, W.left(5.15, 1.35, .005));
 put('pipe', { length: CEIL - .1, radius: .025 }, vert(W.left(5.15, CEIL / 2 + .05, .07)));
 put('pipe', { length: FRONTZ - chamferEnd.z, radius: .03 }, { at: [LEFTX + .07, CEIL - .28, (FRONTZ + chamferEnd.z) / 2], rotY: PI / 2 });
 put('vine', { length: 1.3, strands: 5, spread: .8, seed: 13 }, W.left(5.9, CEIL - .03, .02));
 put('vine', { length: 1.2, strands: 5, spread: .8, seed: 17 }, W.left(1.2, CEIL - .03, .02));

 // ---------- right wall: chest run + second blueprint screen ----------
 const rz = z => z; // right wall runs along +z
 put('toolChest', { width: 1.25, height: .82, depth: .62, drawers: [.08, .08, .1, .12, .16] }, W.right(rz(-.3 + .625), 0, .64));
 put('toolChest', { width: 1.3, height: .82, depth: .62, drawers: [.06, .06, .08, .1, .12, .16] }, W.right(rz(.97 + .65), 0, .64));
 put('toolChest', { width: 1.15, height: 1.4, depth: .7, drawers: [.05, .05, .05, .07, .07, .09, .1, .14] }, W.right(rz(2.3 + .575), 0, .72));
 put('hardCase', { width: .35, height: .16, depth: .26 }, W.right(.1, .96, .3));
 put('bin', { width: .3, height: .14, depth: .3, skin: { body: '#2a63c9' } }, W.right(.6, .96, .36));
 put('bottle', { height: .24, skin: { body: '#8a96a6' } }, W.right(1.55, .96, .3));
 put('screen', { width: 1.7, height: .9 }, W.right(1.05, 1.35, .005));
 put('shopLight', { length: 1.5, drop: CEIL - 2.54 - .06 }, W.right(1.1, 2.45, .42));
 put('fuseBox', {}, W.right(-2.02, 1.5, .005));
 put('pipe', { length: CEIL - .1, radius: .025 }, vert(W.right(-2.6, CEIL / 2 + .05, .07)));
 put('pipe', { length: CEIL - .1, radius: .02 }, vert(W.right(-2.5, CEIL / 2 + .05, .12)));
 put('pipe', { length: FRONTZ - BACKZ, radius: .03 }, { at: [RIGHTX - .07, CEIL - .28, (FRONTZ + BACKZ) / 2], rotY: PI / 2 });
 put('neonTube', { length: 1.6, color: '#4fd8ff' }, vert(W.right(-1.25, 1.8, .005)));
 put('vine', { length: 1.2, strands: 5, spread: .7, seed: 19 }, W.right(-3.8, CEIL - .03, .02));
 put('vine', { length: 1.3, strands: 5, spread: .8, seed: 29 }, W.right(5.6, CEIL - .03, .02));

 // ---------- front wall (behind the default camera): roller door to the garage ----------
 put('rollerDoor', { width: 3.2, height: 2.85 }, W.front(0, 0, .005), { door: 'workshop-to-garage' });
 put('neonTube', { length: 2.4, color: '#ffb35a' }, W.front(0, 3.3, .005));
 put('shelving', { width: 1.55, height: 2.0, depth: .46, levels: [.1, .5, .9, 1.3, 1.7], seed: 41 }, W.front(-3.18, 0, .48));
 put('shelving', { width: 1.55, height: 2.0, depth: .46, levels: [.1, .5, .9, 1.3, 1.7], seed: 43, style: 'steel' }, W.front(-4.78, 0, .48));
 put('toolChest', { width: 1.1, height: 1.35, depth: .68, drawers: [.05, .05, .05, .07, .07, .1, .1, .14] }, W.front(3.55, 0, .7));
 put('neonTube', { length: 2.0, color: '#b04cff' }, W.front(-4.6, 3.3, .3));
 put('neonTube', { length: 1.8, color: '#4fd8ff' }, W.front(3.6, 3.3, .3));
 put('vine', { length: 1.3, strands: 5, spread: .8, seed: 37 }, W.front(-5.4, CEIL - .03, .02));
 put('vine', { length: 1.0, strands: 4, spread: .6, seed: 47 }, W.front(2.2, CEIL - .03, .02));
 put('pipe', { length: CEIL - .1, radius: .025 }, vert(W.front(5.0, CEIL / 2 + .05, .07)));

 // ---------- his wall-top neon carried round every wall ----------
 for (const [z, c] of [[.6, '#b04cff'], [2.6, '#b04cff'], [4.9, '#ff4fd2']]) put('neonTube', { length: 1.7, color: c, intensity: 4 }, W.left(z, CEIL - .42, .03));
 for (const [z, c] of [[-.4, '#4fd8ff'], [1.6, '#b04cff'], [3.4, '#ff4fd2']]) put('neonTube', { length: 1.7, color: c, intensity: 4 }, W.right(z, CEIL - .42, .03));
 for (const [x, c] of [[-2.6, '#b04cff'], [3.0, '#4fd8ff']]) put('neonTube', { length: 1.9, color: c, intensity: 4 }, W.front(x, CEIL - .42, .03));
 // ---------- ceiling: beams, hanging neon, conduit ----------
 for (const z of [1.4, 3.6, 5.8]) put('beam', { length: RIGHTX - LEFTX }, { at: [(RIGHTX + LEFTX) / 2, CEIL - .2, z], rotY: 0 });
 for (const [x, z, c, len] of [[3.6, 1.2, '#ff4fd2', 2.0], [-2.4, 3.0, '#4fd8ff', 2.2], [2.2, 3.4, '#b04cff', 2.2]]) {
  put('neonTube', { length: len, color: c, intensity: 4 }, { at: [x, 3.33, z], rot: [-PI / 2, 0, 0] });
  for (const dx of [-len / 2 + .2, len / 2 - .2]) put('pipe', { length: CEIL - .2 - 3.35, radius: .004, skin: { clamp: { preset: 'darkSteel', color: '#111' } } }, { at: [x + dx, 3.35 + (CEIL - .2 - 3.35) / 2, z], rot: [0, 0, PI / 2] });
 }
 put('pipe', { length: FRONTZ - BACKZ - 1, radius: .035 }, { at: [-5.0, CEIL - .12, (FRONTZ + BACKZ + 1) / 2], rotY: PI / 2 });
 put('pipe', { length: FRONTZ - BACKZ - 1.3, radius: .035 }, { at: [4.4, CEIL - .12, (FRONTZ + BACKZ + 1.3) / 2], rotY: PI / 2 });
 return L;
}

/** Named placement anchors (approved concept). Invisible unless placing. */
export function roomSlots(R) {
 const { BACKZ, RIGHTX, LEFTX, FRONTZ, CEIL } = R;
 return [
  { name: 'floor-left', kind: 'floor', x: -4.15, z: 2.0 },
  { name: 'floor-right', kind: 'floor', x: 4.05, z: 3.9 },
  { name: 'floor-front-left', kind: 'floor', x: -4.9, z: 5.25 },
  { name: 'floor-front-right', kind: 'floor', x: 2.45, z: 5.45 },
  { name: 'display-centre-back', kind: 'floor', x: -1.0, z: -3.1 },
  { name: 'wall-left-panel', kind: 'wall', wall: 'left', x: LEFTX, z: .95, y: 1.3 },
  { name: 'wall-right-rack', kind: 'wall', wall: 'right', x: RIGHTX, z: 4.25, y: 1.7 },
  { name: 'wall-front-sign', kind: 'wall', wall: 'front', x: RIGHTX - 1.2 - 1.6, z: FRONTZ, y: 2.95 },
  { name: 'wall-back-low', kind: 'wall', wall: 'back', x: -.06, z: BACKZ, y: .2 },
  { name: 'wall-chamfer-high', kind: 'wall', wall: 'chamfer', s: 1.1, y: 2.35 },
  { name: 'ceiling-hang', kind: 'ceiling', x: 0, z: 1.45, y: CEIL - .25 },
 ];
}
