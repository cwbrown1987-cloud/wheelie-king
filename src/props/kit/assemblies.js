// Props assembled from kit parts. Each one is also a registry entry, so new props
// can be composed in data (kit.compose) or as a small factory like these.
import { partHelpers } from './parts.js';

export function registerAssemblies(kit) {
 const { register, build, T } = kit;
 const { group, place, add } = partHelpers(kit);

 /** Rolling tool chest = chestBody + N drawers + 4 casters (+ contact shadow). */
 register('toolChest', (p = {}) => {
  const w = p.width ?? .9, h = p.height ?? .85, d = p.depth ?? .55;
  const skin = { body: '#a3243b', ...(p.skin || {}) };
  const casters = p.casters !== false, cp = { radius: p.casterRadius ?? .042, skin: p.casterSkin, brake: false };
  const lift = casters ? build('caster', cp).userData.mountHeight : 0;
  const g = group('toolChest', p, [w, h + lift, d]);
  const body = place(g, build('chestBody', { width: w, height: h, depth: d, skin: { body: skin.body, top: skin.top, recess: skin.recess, trim: skin.trim, bumper: skin.bumper, kick: skin.kick }, sideHandles: p.sideHandles, trimStrip: p.trimStrip, bumpers: p.bumpers }), [0, lift, 0]);
  const f = body.userData.front, gap = p.gap ?? .007, inner = w - 2 * f.inset - (p.bumpers === false ? .004 : .05);
  const rows = p.drawers ?? [.07, .07, .07, .1, .1, .16];
  const avail = f.top - f.bottom - gap * (rows.length + 1), sum = rows.reduce((a, b) => a + b, 0);
  let y = lift + f.bottom + gap;
  for (const r of rows) {
   const dh = r / sum * avail;
   place(g, build('drawer', { width: inner, height: dh, skin: { front: skin.drawer || skin.body }, handleSkin: { metal: skin.handle || 'chrome' }, handleStyle: p.handleStyle, label: p.labels?.[rows.indexOf(r)] }), [0, y, -.016]);
   y += dh + gap;
  }
  if (casters) { const ix = w / 2 - .06, iz = d - .07; for (const [x, z] of [[-ix, -.06], [ix, -.06], [-ix, -iz], [ix, -iz]]) place(g, build('caster', { ...cp, brake: z === -.06 && p.brakes !== false }), [x, 0, z]); }
  if (p.shadow !== false) place(g, build('contactShadow', { width: w, depth: d, opacity: .8 }), [0, 0, 0]);
  return g;
 }, { category: 'prop', description: 'Rolling tool chest (body + drawers + casters). Reskin body/drawer/handle/caster.' });

 /** Top box / hutch that sits on a chest. */
 register('topChest', (p = {}) => {
  const w = p.width ?? .9, h = p.height ?? .35, d = p.depth ?? .45;
  const g = build('toolChest', { ...p, width: w, height: h, depth: d, casters: false, drawers: p.drawers ?? [.08, .08, .08], sideHandles: true, shadow: false });
  g.userData.kit.type = 'topChest';
  return g;
 }, { category: 'prop', description: 'Top chest (no casters) for stacking on a tool chest' });

 /** Utility trolley = tube frame + trays + the same casters. */
 register('trolley', (p = {}) => {
  const w = p.width ?? .75, h = p.height ?? .85, d = p.depth ?? .45, trays = p.trays ?? 3;
  const S = kit.skin({ frame: 'chrome', tray: { preset: 'paint', color: '#1f5fd1' } }, p.skin);
  const cp = { radius: p.casterRadius ?? .042, skin: p.casterSkin };
  const lift = build('caster', cp).userData.mountHeight;
  const g = group('trolley', p, [w, h, d]);
  const G = kit.geo, post = .014;
  for (const x of [-w / 2 + .03, w / 2 - .03]) for (const z of [-.03, -d + .03]) add(g, G.cyl(post, post, h - lift, 14), S('frame'), [x, lift + (h - lift) / 2, z]);
  for (let i = 0; i < trays; i++) {
   const y = lift + .04 + i * (h - lift - .1) / Math.max(1, trays - 1);
   add(g, G.rbox(w, .012, d, .003), S('tray'), [0, y, -d / 2]);
   for (const [ww, dd, x, z] of [[w, .012, 0, -.006], [w, .012, 0, -d + .006], [.012, d, -w / 2 + .006, -d / 2], [.012, d, w / 2 - .006, -d / 2]]) add(g, G.rbox(ww, .045, dd, .003), S('tray'), [x, y + .022, z]);
  }
  place(g, build('handle', { style: 'tube', length: d * .8, standoff: .07, radius: .012, grip: true, skin: { metal: p.skin?.frame || 'chrome' } }), [w / 2, h - .04, -d / 2], Math.PI / 2);
  for (const [x, z] of [[-w / 2 + .05, -.05], [w / 2 - .05, -.05], [-w / 2 + .05, -d + .05], [w / 2 - .05, -d + .05]]) place(g, build('caster', cp), [x, 0, z]);
  if (p.shadow !== false) place(g, build('contactShadow', { width: w, depth: d, opacity: .6 }), [0, 0, 0]);
  return g;
 }, { category: 'prop', description: 'Tool trolley (trays) on the shared caster part' });

 /** Shelving stocked with kit items. items: 'auto' (seeded fill) or explicit per level. */
 register('shelving', (p = {}) => {
  const g = group('shelving', p, [p.width ?? 1.2, p.height ?? 2, p.depth ?? .45]);
  const unit = place(g, build('shelfUnit', p), [0, 0, 0]);
  const levels = unit.userData.levels, { width: iw, depth: idp } = unit.userData.inner;
  let seed = p.seed ?? 7; const rnd = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  const palette = p.palette ?? [['bin', { skin: { body: '#2a63c9' } }], ['bin', { skin: { body: '#2a63c9' } }], ['bin', { skin: { body: '#4b5160' } }], ['bin', { skin: { body: '#e0b324' } }], ['carton', {}], ['can', {}], ['can', { skin: { label: '#2a63c9' } }], ['bottle', {}], ['sprayCan', {}], ['hardCase', {}]];
  const binColours = p.binColours ?? ['#2a63c9', '#4b5160', '#2a63c9', '#e0b324', '#2a63c9', '#8a96a6'];
  levels.forEach((y, li) => {
   if (li === levels.length - 1 && (p.height ?? 2) - y < .25) return;
   const clear = (levels[li + 1] ?? (p.height ?? 2)) - y - .03;
   let kind = palette[Math.floor(rnd() * palette.length)];
   if (kind[0] === 'bin') kind = ['bin', { skin: { body: binColours[(li + Math.floor(rnd() * 3)) % binColours.length] } }];
   let x = -iw / 2 + .02;
   const row = rnd() < .65 ? kind : null; // most shelves hold a run of matching bins
   while (x < iw / 2 - .05) {
    const [type, extra] = row || palette[Math.floor(rnd() * palette.length)];
    const sz = sizeFor(type, clear, idp, rnd);
    if (!sz || x + sz.w > iw / 2 - .01) break;
    place(g, build(type, { ...sz.params, ...extra, skin: { ...(extra.skin || {}) } }), [x + sz.w / 2, y, -.03 - (idp - sz.d) * .2], 0);
    x += sz.w + .012 + rnd() * .02;
   }
  });
  return g;
 }, { category: 'prop', description: 'Shelving unit stocked with bins, cartons, cans and cases' });
 function sizeFor(type, clear, depth, rnd) {
  const h = Math.min(clear, 1);
  if (type === 'bin') { const hh = Math.min(h * .85, .16), w = .16 + rnd() * .06; return hh > .06 && { w, d: depth * .85, params: { width: w, height: hh, depth: depth * .85 } }; }
  if (type === 'carton') { const hh = Math.min(h * .8, .2 + rnd() * .1), w = .22 + rnd() * .12; return hh > .08 && { w, d: depth * .75, params: { width: w, height: hh, depth: depth * .75 } }; }
  if (type === 'can') { const hh = Math.min(h * .7, .1 + rnd() * .06), r = .045; return hh > .06 && { w: r * 2, d: r * 2, params: { radius: r, height: hh } }; }
  if (type === 'bottle') { const hh = Math.min(h * .8, .18 + rnd() * .08), r = .035; return hh > .1 && { w: r * 2, d: r * 2, params: { radius: r, height: hh } }; }
  if (type === 'sprayCan') { const hh = Math.min(h * .8, .19); return hh > .1 && { w: .064, d: .064, params: { height: hh } }; }
  if (type === 'hardCase') { const hh = Math.min(h * .8, .14), w = .34; return hh > .08 && { w, d: .26, params: { width: w, height: hh, depth: Math.min(.26, depth * .8) } }; }
  return null;
 }

 /** Workbench = benchTop over two drawer cabinets (+ optional vice, pegboard handled separately). */
 register('workbench', (p = {}) => {
  const w = p.width ?? 2.2, d = p.depth ?? .7, h = p.height ?? .92;
  const g = group('workbench', p, [w, h, d]);
  const cw = p.cabinetWidth ?? .75, ch = h - .05 - .02;
  for (const s of [-1, 1]) place(g, build('toolChest', { width: cw, height: ch - .1, depth: d - .06, casters: false, sideHandles: false, shadow: false, drawers: [.1, .1, .14, .2], skin: { body: p.skin?.cabinet || '#a3243b', top: 'darkSteel' } }), [s * (w / 2 - cw / 2 - .02), .1, -.02]);
  const S = kit.skin({ leg: 'darkSteel', shelf: 'steel' }, p.skin);
  for (const x of [-w / 2 + .03, w / 2 - .03]) for (const z of [-.04, -d + .04]) add(g, kit.geo.rbox(.05, h - .05, .05, .006), S('leg'), [x, (h - .05) / 2, z]);
  for (const s of [-1, 1]) add(g, kit.geo.rbox(cw + .02, .1, d - .04, .006), S('leg'), [s * (w / 2 - cw / 2 - .02), .05, -d / 2]);
  add(g, kit.geo.rbox(w - 2 * cw - .1, .02, d - .12, .004), S('shelf'), [0, .18, -d / 2]);
  place(g, build('benchTop', { width: w + .04, depth: d + .02, skin: { top: p.skin?.top } }), [0, h - .05, .01]);
  if (p.vice !== false) place(g, build('vice', { size: 1 }), [w / 2 - .25, h, -.02]);
  if (p.shadow !== false) place(g, build('contactShadow', { width: w, depth: d, opacity: .7 }), [0, 0, 0]);
  return g;
 }, { category: 'prop', description: 'Workbench: bench top over two drawer cabinets, with vice' });

 /** Tool wall = pegboard + a configurable set of hang tools. */
 register('toolWall', (p = {}) => {
  const w = p.width ?? 1.6, h = p.height ?? .8;
  const g = group('toolWall', p, [w, h, .06]);
  place(g, build('pegboard', { width: w, height: h, skin: p.skin }), [0, 0, 0]);
  const row = (y, items) => { const step = w * .9 / items.length; items.forEach(([t, pp], i) => place(g, build(t, pp), [-w * .45 + step * (i + .5), y, .012])); };
  const n = Math.max(4, Math.round(w / .1));
  const wr = Math.round(n * .55);
  row(h * .93, Array.from({ length: wr }, (_, i) => ['wrench', { length: .12 + i * .01 }]));
  if (h > .7) row(h * .66, [['hammer', {}], ['pliers', {}], ['pliers', { color: '#2a63c9' }], ['wrench', { length: .3 }], ['wrench', { length: .27 }], ['hammer', { skin: { shaft: '#c0262f' } }], ['pliers', { color: '#e0b324' }], ['screwdriver', { color: '#c0262f', length: .26 }], ['screwdriver', { color: '#2a63c9', length: .26 }]]);
  row(h * (h > .7 ? .36 : .45), [['screwdriver', { color: '#e0b324' }], ['screwdriver', { color: '#c0262f' }], ['screwdriver', { color: '#2a63c9' }], ['screwdriver', { color: '#e0b324' }], ['pliers', {}], ['pliers', { color: '#2a63c9' }], ['hammer', {}], ['screwdriver', { color: '#15181e' }]]);
  place(g, build('socketRail', { length: Math.min(.5, w * .3) }), [w * .28, h * .08, .012]);
  return g;
 }, { category: 'prop', description: 'Pegboard with wrenches, drivers, pliers, hammer and a socket rail' });
}
