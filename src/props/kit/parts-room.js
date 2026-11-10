// Room-fabric parts: doors, pipes, beams, fuse box, hanging vines. Same conventions
// as parts.js (origin bottom-centre, front +Z, skin slots per material).
import { partHelpers } from './parts.js';

export function registerRoomParts(kit) {
 const { T, geo: G, register } = kit;
 const { group, add, place } = partHelpers(kit);

 register('door', (p = {}) => { // steel side door with frame, wired window and push bar; origin = wall plane
  const w = p.width ?? 1, h = p.height ?? 2.15, S = kit.skin({ frame: 'darkSteel', leaf: { preset: 'steel', color: '#4a5568', metalness: .5, roughness: .45 }, glass: { preset: 'glass', emissive: '#06121a', emissiveIntensity: 1 }, bar: 'brushed' }, p.skin);
  const g = group('door', p, [w + .2, h + .15, .14]);
  for (const s of [-1, 1]) add(g, G.rbox(.08, h + .1, .1, .01), S('frame'), [s * (w / 2 + .04), (h + .1) / 2, .05]);
  add(g, G.rbox(w + .16, .08, .1, .01), S('frame'), [0, h + .06, .05]);
  add(g, G.rbox(w, h, .05, .008), S('leaf'), [0, h / 2, .03]);
  add(g, G.rbox(w * .5, h * .23, .012, .004), S('glass'), [0, h * .76, .057]);
  add(g, G.rbox(w * .54, .025, .02, .004), S('frame'), [0, h * .76 + h * .125, .06]); add(g, G.rbox(w * .54, .025, .02, .004), S('frame'), [0, h * .76 - h * .125, .06]);
  place(g, kit.build('handle', { style: 'tube', length: w * .8, standoff: .06, radius: .014, skin: { metal: p.skin?.bar || 'brushed' } }), [0, h * .47, .055]);
  add(g, G.rbox(w * .9, .12, .006, .002), S('bar'), [0, .07, .057]);
  return g;
 }, { category: 'room', description: 'Steel side door with frame, window and push bar', slots: ['frame', 'leaf', 'glass', 'bar'] });

 register('rollerDoor', (p = {}) => { // roll-up garage door with slats, guides and drum housing; origin = wall plane
  const w = p.width ?? 3.2, h = p.height ?? 2.85, S = kit.skin({ slat: { preset: 'steel', color: '#5a6170', metalness: .6, roughness: .38 }, guide: 'darkSteel', housing: 'darkSteel', handle: 'brushed' }, p.skin);
  const g = group('rollerDoor', p, [w + .3, h + .35, .4]), n = Math.max(8, Math.round(h / .14)), sh = h / n;
  for (let i = 0; i < n; i++) add(g, G.rbox(w, sh * .92, .04, .012, 2), S('slat'), [0, sh * (i + .5), .1]);
  for (const s of [-1, 1]) add(g, G.rbox(.12, h + .1, .14, .012), S('guide'), [s * (w / 2 + .06), (h + .1) / 2, .07]);
  add(g, G.rbox(w + .3, .32, .36, .03), S('housing'), [0, h + .16, .18]);
  add(g, G.rbox(.3, .04, .04, .01), S('handle'), [0, .5, .135]);
  add(g, G.rbox(w, .05, .05, .01), S('guide'), [0, .025, .1]);
  return g;
 }, { category: 'room', description: 'Roller door to the garage (slat count follows height)', slots: ['slat', 'guide', 'housing', 'handle'] });

 register('pipe', (p = {}) => { // straight pipe along +X with couplers; rotate for vertical runs
  const len = p.length ?? 2, r = p.radius ?? .025, S = kit.skin({ pipe: { preset: 'steel', color: '#5d6270', metalness: .7, roughness: .35 }, clamp: 'darkSteel' }, p.skin);
  const g = group('pipe', p, [len, r * 2, r * 2]);
  add(g, G.cylX(r, len, 14), S('pipe'), [0, r, 0]);
  const clamps = Math.max(2, Math.round(len / .9));
  for (let i = 0; i <= clamps; i++) add(g, G.cylX(r * 1.35, .03, 14), S('clamp'), [-len / 2 + i * len / clamps, r, 0]);
  return g;
 }, { category: 'room', description: 'Pipe / conduit run with clamps (length, radius)', slots: ['pipe', 'clamp'] });

 register('beam', (p = {}) => { // steel I-beam along +X; origin = beam underside
  const len = p.length ?? 11, d = p.depth ?? .2, S = kit.skin({ steel: { preset: 'darkSteel', color: '#2c303c' }, bolt: 'brushed' }, p.skin);
  const g = group('beam', p, [len, d, .16]);
  add(g, G.box(len, .018, .16), S('steel'), [0, .009, 0]); add(g, G.box(len, .018, .16), S('steel'), [0, d - .009, 0]); add(g, G.box(len, d, .016), S('steel'), [0, d / 2, 0]);
  for (let x = -len / 2 + .5; x < len / 2; x += 1.5) add(g, G.box(.06, d * .8, .05), S('bolt'), [x, d / 2, 0]);
  return g;
 }, { category: 'room', description: 'Ceiling I-beam (length)', slots: ['steel', 'bolt'] });

 register('fuseBox', (p = {}) => {
  const w = p.width ?? .36, h = p.height ?? .45, S = kit.skin({ box: { preset: 'steel', color: '#6a6f7a', metalness: .5, roughness: .45 }, panel: 'darkSteel', warn: { preset: 'plastic', color: '#e0b324' } }, p.skin);
  const g = group('fuseBox', p, [w, h, .14]);
  add(g, G.rbox(w, h, .12, .012), S('box'), [0, h / 2, .06]);
  add(g, G.rbox(w * .82, h * .8, .01, .004), S('panel'), [0, h / 2, .123]);
  add(g, G.rbox(w * .24, w * .24, .004, .001), S('warn'), [w * .2, h * .78, .13]);
  add(g, G.cyl(.012, .012, .1, 10), S('panel'), [0, -.05, .06]);
  return g;
 }, { category: 'room', description: 'Wall fuse box with conduit stub', slots: ['box', 'panel', 'warn'] });

 register('vine', (p = {}) => { // hanging ivy: tube stems + many small leaves; origin = top fixing point
  const len = p.length ?? 1.3, strands = p.strands ?? 5, spread = p.spread ?? .7, S = kit.skin({ stem: { preset: 'wood', color: '#3b5a26', roughness: .8 }, leaf: { preset: 'plastic', color: '#5f8f34', roughness: .6 }, leaf2: { preset: 'plastic', color: '#3f6b25', roughness: .65 }, pot: { preset: 'darkSteel', color: '#2a2622' } }, p.skin);
  const g = group('vine', p, [spread, len, .2]);
  let seed = p.seed ?? 5; const rnd = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  const leafGeo = G.sphere(1, 7, 5);
  add(g, G.rbox(spread * .5, .14, .16, .02), S('pot'), [0, -.07, .09]);
  for (let s = 0; s < strands; s++) {
   const x0 = (s / (strands - 1 || 1) - .5) * spread * .45, l = len * (.55 + rnd() * .45), sway = (rnd() - .5) * spread * .6;
   const pts = [new T.Vector3(x0, -.08, .1), new T.Vector3(x0 + sway * .3, -l * .35, .13 + rnd() * .05), new T.Vector3(x0 + sway * .7, -l * .7, .1 + rnd() * .06), new T.Vector3(x0 + sway, -l, .08)];
   const curve = new T.CatmullRomCurve3(pts);
   add(g, new T.TubeGeometry(curve, 10, .006, 4, false), S('stem'));
   const leaves = Math.round(l / .045);
   for (let i = 0; i < leaves; i++) {
    const q = curve.getPoint(i / leaves), m = add(g, leafGeo, rnd() > .5 ? S('leaf') : S('leaf2'), [q.x + (rnd() - .5) * .07, q.y, q.z + (rnd() - .2) * .05]);
    const sz = .028 + rnd() * .02; m.scale.set(sz, sz * 1.15, sz * .3); m.rotation.set(rnd() * .8, (rnd() - .5) * 1.4, (rnd() - .5) * 1.6);
   }
  }
  return g;
 }, { category: 'room', description: 'Hanging ivy (length, strands, spread, seed)', slots: ['stem', 'leaf', 'leaf2', 'pot'] });
}
