// Bike repair workstand, built from reusable kit parts (origin bottom-centre, front faces +Z, metres).
//   kit.build('workstand', { clampHeight:1.05, reach:.42, skin:{ collar:'#1f5fd1' } })
// The clamp sits at (0, clampHeight, reach): the stand stands behind the bike and reaches forward to the seat post.
import { partHelpers } from './parts.js';

export function registerStandParts(kit) {
 const { T, geo: G, register } = kit;
 const { group, add, place } = partHelpers(kit);
 const tube = (parent, r, a, b, mat, seg = 16) => { const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), m = add(parent, G.cyl(r, r, d.length(), seg), mat); m.position.copy(A).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m; };

 register('standTripod', (p = {}) => {
  const span = p.span ?? .46, hubY = p.hubY ?? .3, S = kit.skin({ leg: 'steel', hub: 'darkSteel', foot: 'rubber' }, p.skin);
  const g = group('standTripod', p, [span * 2, hubY, span * 2]);
  add(g, G.cyl(.04, .045, .09, 20), S('hub'), [0, hubY, 0]);
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3, fx = Math.cos(a) * span, fz = -Math.sin(a) * span * .78;
   tube(g, .016, [0, hubY - .02, 0], [fx, .03, fz], S('leg')); add(g, G.cyl(.028, .034, .03, 16), S('foot'), [fx, .015, fz]); }
  return g;
 }, { category: 'part', description: 'Three-leg stand base with rubber feet' });

 register('standMast', (p = {}) => {
  const h = p.height ?? 1, split = p.split ?? .55, S = kit.skin({ tube: 'steel', upper: 'chrome' }, p.skin);
  const g = group('standMast', p, [.06, h, .06]);
  add(g, G.cyl(.026, .026, h * split, 20), S('tube'), [0, h * split / 2, 0]);
  add(g, G.cyl(.019, .019, h * (1 - split), 20), S('upper'), [0, h * split + h * (1 - split) / 2, 0]);
  return g;
 }, { category: 'part', description: 'Telescopic mast: steel lower tube, chrome upper tube' });

 register('standCollar', (p = {}) => {
  const S = kit.skin({ collar: { preset: 'paint', color: '#d8262f' }, lever: { preset: 'paint', color: '#d8262f' } }, p.skin);
  const g = group('standCollar', p, [.08, .06, .12]);
  add(g, G.cyl(.036, .036, .06, 24), S('collar'), [0, .03, 0]);
  tube(g, .007, [0, .03, .03], [.07, -.03, .07], S('lever'), 10);
  return g;
 }, { category: 'part', description: 'Quick-release height collar with lever' });

 register('standTray', (p = {}) => {
  const r = p.radius ?? .16, S = kit.skin({ tray: 'darkSteel', rim: { preset: 'paint', color: '#d8262f' } }, p.skin);
  const g = group('standTray', p, [r * 2, .04, r * 2]);
  add(g, G.cyl(r, r * .88, .03, 36), S('tray'), [0, .015, 0]);
  add(g, G.torus(r, .008, 48, 8), S('rim'), [0, .034, 0], [Math.PI / 2, 0, 0]);
  return g;
 }, { category: 'part', description: 'Round parts tray that clamps to the mast' });

 register('standHead', (p = {}) => {
  const S = kit.skin({ head: { preset: 'paint', color: '#d8262f' } }, p.skin);
  const g = group('standHead', p, [.08, .08, .08]);
  add(g, G.sphere(.04, 24, 16), S('head'), [0, 0, 0]);
  return g;
 }, { category: 'part', description: 'Swivel head on top of the mast' });

 register('seatClamp', (p = {}) => {
  const S = kit.skin({ jaw: { preset: 'paint', color: '#d8262f' }, pad: 'rubber', screw: 'chrome', knob: 'rubber' }, p.skin);
  const g = group('seatClamp', p, [.12, .1, .2]);
  for (const s of [-1, 1]) { add(g, G.rbox(.024, .085, .05, .006), S('jaw'), [s * .036, 0, 0]); add(g, G.rbox(.006, .07, .04, .002), S('pad'), [s * .022, 0, 0]); }
  tube(g, .008, [0, -.055, -.01], [0, -.055, -.1], S('screw'), 10);
  add(g, G.cyl(.03, .03, .025, 20), S('knob'), [0, -.055, -.11], [Math.PI / 2, 0, 0]);
  return g;
 }, { category: 'part', description: 'Seat-post clamp: padded jaws, screw and knob (jaws either side of the post, screw toward the mast)' });

 register('workstand', (p = {}) => {
  const clampY = p.clampHeight ?? 1.05, reach = p.reach ?? .42, sk = p.skin || {}, top = clampY + .04;
  const g = group('workstand', p, [.92, top + .05, .72 + reach]);
  place(g, kit.build('standTripod', { skin: { leg: sk.leg, hub: sk.hub, foot: sk.foot } }));
  place(g, kit.build('standMast', { height: top - .26, skin: { tube: sk.mast, upper: sk.upper } }), [0, .26, 0]);
  place(g, kit.build('standCollar', { skin: { collar: sk.collar, lever: sk.lever } }), [0, .26 + (top - .26) * .55 - .03, 0]);
  place(g, kit.build('standTray', { skin: { tray: sk.tray, rim: sk.rim } }), [0, .6, -.03]);
  place(g, kit.build('standHead', { skin: { head: sk.head } }), [0, top, 0]);
  tube(g, .018, [0, top, 0], [0, clampY, reach - .06], kit.mat(sk.arm ?? 'steel'));
  const c = place(g, kit.build('seatClamp', { skin: { jaw: sk.jaw, pad: sk.pad, screw: sk.screw, knob: sk.knob } }), [0, clampY, reach]);
  return g;
 }, { category: 'assembly', description: 'Bike repair workstand: tripod base, steel mast, quick-release collar, tool tray, swivel head, seat-post clamp' });
}
