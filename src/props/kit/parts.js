// Reusable kit parts. Convention for every part:
//  - returns a THREE.Group, origin at bottom-centre, front faces +Z, units = metres
//  - params are plain JSON (sizes, counts, `skin` overrides per material slot)
//  - group.userData.kit = { type, params, size:[w,h,d] } so props can be inspected / rebuilt
export function partHelpers(kit) {
 const { T } = kit;
 function group(type, params, size) { const g = new T.Group(); g.name = 'kit:' + type; g.userData.kit = { type, params, size }; return g; }
 function add(parent, geo, mat, p = [0, 0, 0], r = null, name = '') {
  const m = new T.Mesh(geo, mat); m.position.set(...p); if (r) m.rotation.set(...r); m.name = name; m.castShadow = m.receiveShadow = true; parent.add(m); return m;
 }
 function place(parent, child, p = [0, 0, 0], ry = 0) { child.position.set(...p); child.rotation.y = ry; parent.add(child); return child; }
 return { group, add, place };
}

export function registerParts(kit) {
 const { T, geo: G, register } = kit;
 const { group, add, place } = partHelpers(kit);

 // ---------------- caster wheel (swivel plate + fork + tyre + hub) ----------------
 register('caster', (p = {}) => {
  const r = p.radius ?? .045, wd = p.width ?? .034, S = kit.skin({ wheel: 'rubber', hub: 'brushed', fork: 'chrome', plate: 'chrome' }, p.skin);
  const axleY = r, plateY = 2 * r + .028, g = group('caster', p, [wd + .03, plateY + .008, .07]);
  add(g, G.rbox(.07, .007, .07, .002), S('plate'), [0, plateY + .0035, 0]);
  add(g, G.cyl(.024, .026, .012, 18), S('fork'), [0, plateY - .006, 0]);
  for (const s of [-1, 1]) add(g, G.rbox(.005, plateY - axleY + .012, .03, .002), S('fork'), [s * (wd / 2 + .006), (plateY + axleY) / 2 - .004, -.012]);
  add(g, G.rbox(wd + .018, .006, .03, .002), S('fork'), [0, plateY - .014, -.012]);
  const tyre = add(g, G.torus(r - .011, .011, 28, 10), S('wheel'), [0, axleY, -.012], [0, Math.PI / 2, 0]);
  tyre.scale.set(1, 1, (wd / .022));
  add(g, G.cylX(r - .01, wd * .8, 24), S('wheel'), [0, axleY, -.012]);
  add(g, G.cylX(r * .52, wd + .004, 18), S('hub'), [0, axleY, -.012]);
  add(g, G.cylX(.006, wd + .02, 10), S('fork'), [0, axleY, -.012]);
  if (p.brake) add(g, G.rbox(.012, .02, .03, .003), kit.mat('paint', p.skin?.brake || '#c0262f'), [wd / 2 + .02, plateY - .03, .01]);
  g.userData.mountHeight = plateY + .007;
  return g;
 }, { category: 'part', description: 'Swivel caster: rubber tyre, brushed hub, chrome fork' });

 // ---------------- handles ----------------
 register('handle', (p = {}) => {
  const len = p.length ?? .4, style = p.style ?? 'bar', S = kit.skin({ metal: 'chrome', grip: 'rubber' }, p.skin);
  const g = group('handle', p, [len, .03, .03]);
  if (style === 'bar') { // full-width drawer pull: flat aluminium bar on a recessed channel
   add(g, G.rbox(len, .02, .014, .005, 3), S('metal'), [0, 0, .016]);
   add(g, G.rbox(len * .99, .008, .008, .002), kit.mat('rubber'), [0, -.008, .008]);
   for (const s of [-1, 1]) add(g, G.rbox(.014, .012, .012, .003), S('metal'), [s * (len / 2 - .02), 0, .006]);
  } else if (style === 'tube') { // side / push handle
   const r = p.radius ?? .011, out = p.standoff ?? .05;
   add(g, G.cylX(r, len, 16), S('metal'), [0, 0, out]);
   for (const s of [-1, 1]) { add(g, G.cyl(r, r, out, 12), S('metal'), [s * len / 2, 0, out / 2], [Math.PI / 2, 0, 0]); add(g, G.sphere(r * 1.02, 12, 8), S('metal'), [s * len / 2, 0, out]); }
   if (p.grip) add(g, G.cylX(r * 1.45, len * .55, 16), S('grip'), [0, 0, out]);
  } else { // cup pull
   add(g, G.rbox(len, .02, .014, .006), S('metal'), [0, 0, .007]);
  }
  return g;
 }, { category: 'part', description: 'Drawer bar pull, tube handle (side/push) or cup pull' });

 // ---------------- drawer front (+ handle) ----------------
 register('drawer', (p = {}) => {
  const w = p.width ?? .6, h = p.height ?? .1, t = p.thickness ?? .018, S = kit.skin({ front: 'paint', inset: 'darkSteel' }, p.skin);
  const g = group('drawer', p, [w, h, t]);
  add(g, G.rbox(w, h, t, Math.min(.008, h / 5), 3), S('front'), [0, h / 2, t / 2]);
  if (h > .07) add(g, G.rbox(w - .03, .004, .002, .001), kit.mat('paint', { color: '#000000', roughness: .6, clearcoat: 0, metalness: 0, transparent: true, opacity: .25 }), [0, h - .008, t + .0005]);
  const hp = { length: w * (p.handleRatio ?? .82), style: p.handleStyle ?? 'bar', skin: p.handleSkin };
  place(g, kit.build('handle', hp), [0, h - Math.min(.03, h * .32), t - .004]);
  if (p.label) { const tex = kit.tex.label(p.label); const lm = kit.mat('plastic', { color: '#ffffff', map: tex, roughness: .6 }); add(g, G.plane(.07, .022), lm, [-w / 2 + .06, h * .42, t + .001]); }
  return g;
 }, { category: 'part', description: 'Drawer front with bar handle; reskin front + handle' });

 // ---------------- chest / cabinet body ----------------
 register('chestBody', (p = {}) => {
  const w = p.width ?? .9, h = p.height ?? .8, d = p.depth ?? .55, S = kit.skin({ body: 'paint', top: 'rubber', recess: 'darkSteel', trim: 'chrome', bumper: 'rubber', kick: 'darkSteel' }, p.skin);
  const g = group('chestBody', p, [w, h, d]), wall = .022;
  add(g, G.rbox(wall, h, d, .008), S('body'), [-w / 2 + wall / 2, h / 2, -d / 2]);
  add(g, G.rbox(wall, h, d, .008), S('body'), [w / 2 - wall / 2, h / 2, -d / 2]);
  add(g, G.rbox(w, wall, d, .008), S('body'), [0, h - wall / 2, -d / 2]);
  add(g, G.rbox(w, wall * 1.6, d, .006), S('body'), [0, wall * .8, -d / 2]);
  add(g, G.box(w - wall, h - wall, .01), S('body'), [0, h / 2, -d + .005]);
  add(g, G.box(w - 2 * wall, h - 2.6 * wall, d * .9), S('recess'), [0, h / 2 + .2 * wall, -d / 2 - .02]);
  if (p.mat !== false) add(g, G.rbox(w - .02, .006, d - .02, .002), S('top'), [0, h + .003, -d / 2]);
  if (p.sideHandles !== false && w > .45) for (const s of [-1, 1]) { const hd = place(g, kit.build('handle', { style: 'tube', length: Math.min(.32, d * .6), standoff: .035, radius: .009, skin: { metal: p.skin?.trim || 'chrome' } }), [s * w / 2, h - .09, -d / 2], s * Math.PI / 2); }
  if (p.trimStrip !== false) add(g, G.rbox(w + .004, .012, .008, .003), S('trim'), [0, h - .006, .003]);
  if (p.bumpers !== false) for (const s of [-1, 1]) { add(g, G.rbox(.026, h - .01, .03, .008), S('bumper'), [s * (w / 2 - .006), h / 2, -.004]); for (const y of [.05, h - .05]) add(g, G.rbox(.03, .03, .034, .006), S('trim'), [s * (w / 2 - .006), y, -.004]); }
  for (const s of [-1, 1]) add(g, G.rbox(.006, h * .78, d * .78, .004), S('body'), [s * (w / 2 + .002), h * .5, -d / 2 - .01]);
  add(g, G.rbox(w - .01, .035, .012, .004), S('kick'), [0, .018, -.002]);
  g.userData.front = { inset: wall, top: h - wall, bottom: wall * 1.6 };
  return g;
 }, { category: 'part', description: 'Open-front cabinet shell (sides, top mat, recess) for drawers' });

 // ---------------- shelf unit (frame + boards, no items) ----------------
 register('shelfUnit', (p = {}) => {
  const w = p.width ?? 1.2, h = p.height ?? 2, d = p.depth ?? .45, levels = p.levels ?? [.1, .55, 1.0, 1.45, 1.9];
  const style = p.style ?? 'rack', S = kit.skin({ frame: style === 'rack' ? 'powder' : 'darkSteel', beam: style === 'rack' ? { preset: 'powder', color: '#d26a1c' } : 'darkSteel', board: 'steel', foot: 'darkSteel' }, p.skin);
  const g = group('shelfUnit', p, [w, h, d]), up = style === 'rack' ? .05 : .03;
  let frameMat = S('frame');
  if (style === 'rack' && kit.tex.upright) { const c = '#' + frameMat.color.getHexString(); frameMat = kit.mat('powder', { color: c, map: kit.tex.upright('#ffffff') }); }
  for (const x of [-w / 2 + up / 2, w / 2 - up / 2]) for (const z of [-up / 2 - .005, -d + up / 2 + .005]) {
   const m = add(g, G.rbox(up, h, up, .004), frameMat, [x, h / 2, z]);
   add(g, G.rbox(up + .02, .01, up + .02, .002), S('foot'), [x, .005, z]);
  }
  if (style === 'rack') for (const x of [-w / 2 + up / 2, w / 2 - up / 2]) for (let y = .35; y < h - .2; y += .5) { const br = add(g, G.box(.012, .012, (d - up) * 1.25), S('frame'), [x, y, -d / 2]); br.rotation.x = .65; }
  for (const y of levels) {
   add(g, G.rbox(w - up * 1.2, .028, d - up * .8, .003), S('board'), [0, y, -d / 2]);
   for (const z of [-.004, -d + .004]) add(g, G.rbox(w - up * .2, .05, .014, .003), S('beam'), [0, y - .012, z]);
  }
  g.userData.levels = levels.map(y => y + .014);
  g.userData.inner = { width: w - up * 2, depth: d - up };
  return g;
 }, { category: 'part', description: 'Racking: perforated uprights, beams, boards (style rack|steel)' });

 // ---------------- shelf items ----------------
 register('bin', (p = {}) => { // stackable louvre bin with scoop front + label
  const w = p.width ?? .2, h = p.height ?? .13, d = p.depth ?? .3, S = kit.skin({ body: { preset: 'plastic', color: '#2a63c9' } }, p.skin);
  const g = group('bin', p, [w, h, d]);
  const sideProfile = [[0, 0], [-d, 0], [-d, h], [-d * .35, h], [0, h * .55]];
  const key = `bin:${w}:${h}:${d}`;
  for (const s of [-1, 1]) add(g, G.extrude(key + ':side', sideProfile, .008, .0015), S('body'), [s * (w / 2 - .004), 0, 0], [0, Math.PI / 2, 0]).rotation.set(0, -Math.PI / 2, 0);
  add(g, G.rbox(w, .008, d, .002), S('body'), [0, .004, -d / 2]);
  add(g, G.rbox(w, h, .008, .002), S('body'), [0, h / 2, -d + .004]);
  const lip = add(g, G.rbox(w, h * .55, .01, .003), S('body'), [0, h * .275, -.005]);
  add(g, G.rbox(w - .02, .012, .02, .003), S('body'), [0, h * .55, -.01]);
  if (p.fill !== false) add(g, G.box(w - .03, h * .4, d * .5), kit.mat('darkSteel', p.skin?.fill), [0, h * .3, -d * .62]);
  if (p.label !== false && kit.tex.label) add(g, G.plane(w * .5, h * .16), kit.mat('plastic', { color: '#ffffff', map: kit.tex.label(p.label || ''), roughness: .6 }), [0, h * .32, .0012]);
  return g;
 }, { category: 'item', description: 'Open-front storage bin (any colour/size)' });

 register('carton', (p = {}) => {
  const w = p.width ?? .3, h = p.height ?? .2, d = p.depth ?? .3, S = kit.skin({ body: { preset: 'cardboard', map: kit.tex.carton?.() || null } }, p.skin);
  const g = group('carton', p, [w, h, d]); add(g, G.rbox(w, h, d, .004, 1), S('body'), [0, h / 2, -d / 2]); return g;
 }, { category: 'item', description: 'Cardboard box with tape' });

 register('can', (p = {}) => { // paint/oil tin with rim + label band
  const r = p.radius ?? .05, h = p.height ?? .12, S = kit.skin({ body: 'brushed', label: { preset: 'plastic', color: '#e03a3a' } }, p.skin);
  const g = group('can', p, [r * 2, h, r * 2]);
  add(g, G.cyl(r, r, h, 24), S('body'), [0, h / 2, -r]);
  add(g, G.cyl(r * 1.006, r * 1.006, h * .55, 24, true), S('label'), [0, h * .48, -r]);
  add(g, G.torus(r * .97, .0035, 24, 6), S('body'), [0, h, -r], [Math.PI / 2, 0, 0]);
  return g;
 }, { category: 'item', description: 'Tin can / oil can (radius, height, label colour)' });

 register('sprayCan', (p = {}) => {
  const r = p.radius ?? .032, h = p.height ?? .2, S = kit.skin({ body: { preset: 'paint', color: '#e0b324' }, cap: 'plastic', top: 'chrome' }, p.skin);
  const g = group('sprayCan', p, [r * 2, h, r * 2]);
  add(g, G.cyl(r, r, h * .78, 20), S('body'), [0, h * .39, -r]);
  add(g, G.cyl(r * .55, r, h * .08, 20), S('top'), [0, h * .82, -r]);
  add(g, G.cyl(r * .9, r * .9, h * .14, 16), S('cap'), [0, h * .93, -r]);
  return g;
 }, { category: 'item', description: 'Aerosol can' });

 register('bottle', (p = {}) => {
  const r = p.radius ?? .04, h = p.height ?? .22, S = kit.skin({ body: { preset: 'plastic', color: '#3e8de0' }, cap: { preset: 'plastic', color: '#111' } }, p.skin);
  const g = group('bottle', p, [r * 2, h, r * 2]);
  add(g, G.lathe(`bottle:${r}:${h}`, [[0, 0], [r, 0], [r, h * .62], [r * .45, h * .82], [r * .32, h * .86], [0, h * .86]], 18), S('body'), [0, 0, -r]);
  add(g, G.cyl(r * .36, r * .36, h * .14, 12), S('cap'), [0, h * .93, -r]);
  return g;
 }, { category: 'item', description: 'Oil / chemical bottle' });

 register('hardCase', (p = {}) => { // tool case / small toolbox with latches + handle
  const w = p.width ?? .36, h = p.height ?? .14, d = p.depth ?? .26, S = kit.skin({ body: { preset: 'plastic', color: '#e0b324' }, trim: { preset: 'plastic', color: '#15181e' }, latch: 'brushed' }, p.skin);
  const g = group('hardCase', p, [w, h, d]);
  add(g, G.rbox(w, h * .62, d, .016), S('body'), [0, h * .31, -d / 2]);
  add(g, G.rbox(w * 1.01, h * .1, d * 1.01, .01), S('trim'), [0, h * .62, -d / 2]);
  add(g, G.rbox(w, h * .3, d, .02), S('body'), [0, h * .8, -d / 2]);
  for (const s of [-1, 1]) add(g, G.rbox(.03, .04, .012, .003), S('latch'), [s * w * .3, h * .62, .004]);
  const hd = place(g, kit.build('handle', { style: 'tube', length: w * .42, standoff: .03, radius: .009, grip: true, skin: { metal: p.skin?.trim || { preset: 'plastic', color: '#15181e' }, grip: p.skin?.trim } }), [0, h * .95, -d / 2]);
  hd.rotation.x = -Math.PI / 2;
  return g;
 }, { category: 'item', description: 'Hard tool case with latches and handle' });

 // ---------------- wall: pegboard + hang tools ----------------
 register('pegboard', (p = {}) => {
  const w = p.width ?? 1.6, h = p.height ?? .8, S = kit.skin({ board: { preset: 'darkSteel', color: '#2a2e37', roughness: .7, metalness: .3 }, frame: 'steel' }, p.skin);
  const g = group('pegboard', p, [w, h, .03]);
  let bm = S('board'); const pt = kit.tex.pegboard?.('#ffffff'); if (pt) { const t = pt.clone(); t.needsUpdate = true; t.repeat.set(w / .2, h / .2); t.wrapS = t.wrapT = T.RepeatWrapping; kit.textures.add(t); bm = kit.mat('darkSteel', { color: '#' + bm.color.getHexString(), map: t, roughness: .7, metalness: .3 }); }
  add(g, G.box(w, h, .012), bm, [0, h / 2, .006]);
  for (const [x, y, ww, hh] of [[0, 0, w + .03, .025], [0, h, w + .03, .025], [-w / 2, h / 2, .025, h], [w / 2, h / 2, .025, h]]) add(g, G.rbox(ww, hh, .025, .004), S('frame'), [x, y, .0125]);
  return g;
 }, { category: 'part', description: 'Pegboard panel with framed edge (holes are a tiling texture)' });

 register('wrench', (p = {}) => { // combination spanner, hangs from its ring; origin = hang point
  const L = p.length ?? .22, S = kit.skin({ metal: 'chrome' }, p.skin), t = .006, sw = L * .075;
  const g = group('wrench', p, [sw * 3, L, t]);
  const shapeKey = `wrench:${L}`;
  const geo = G.shape(shapeKey, s => {
   const R = sw * 1.25, top = -R * .9, bot = -L + R * 1.05;
   s.absarc(0, top, R, Math.PI * .5 + .6, Math.PI * 2.5 - .6, false);
   s.lineTo(sw / 2, top - R * .8); s.lineTo(sw / 2, bot + R * .8);
   s.absarc(0, bot, R * 1.08, Math.PI * .5 - .55, Math.PI * .5 + .55 - Math.PI * 2, true);
   s.lineTo(-sw / 2, bot + R * .8); s.lineTo(-sw / 2, top - R * .8); s.closePath();
   const hole = new T.Path(); hole.absarc(0, top, R * .55, 0, Math.PI * 2, true); s.holes.push(hole);
   const jaw = new T.Path(); jaw.moveTo(-R * .42, bot - R * 1.2); jaw.lineTo(R * .42, bot - R * 1.2); jaw.lineTo(R * .42, bot); jaw.absarc(0, bot, R * .42, 0, Math.PI, false); jaw.closePath();
   return s;
  }, t, .0012);
  add(g, geo, S('metal'), [0, 0, t / 2 + .004]);
  return g;
 }, { category: 'tool', description: 'Combination wrench (length), hangs on a peg' });

 register('screwdriver', (p = {}) => {
  const L = p.length ?? .2, S = kit.skin({ grip: { preset: 'plastic', color: p.color || '#e0b324' }, band: { preset: 'plastic', color: '#15181e' }, shaft: 'chrome' }, p.skin);
  const g = group('screwdriver', p, [.03, L, .03]), gl = L * .45, z = .02;
  add(g, G.cyl(.013, .015, gl, 14), S('grip'), [0, -gl / 2, z]);
  add(g, G.cyl(.0135, .0135, gl * .18, 14), S('band'), [0, -gl * .35, z]);
  add(g, G.cyl(.0035, .0035, L - gl, 8), S('shaft'), [0, -gl - (L - gl) / 2, z]);
  return g;
 }, { category: 'tool', description: 'Screwdriver (grip colour), hangs handle-up' });

 register('hammer', (p = {}) => {
  const L = p.length ?? .3, S = kit.skin({ head: 'darkSteel', grip: { preset: 'rubber', color: '#1b1d22' }, shaft: { preset: 'plastic', color: '#e0b324' } }, p.skin);
  const g = group('hammer', p, [.12, L, .03]), z = .022;
  add(g, G.rbox(.11, .03, .028, .006), S('head'), [0, -.015, z]);
  add(g, G.cyl(.011, .011, L * .6, 12), S('shaft'), [0, -.03 - L * .3, z]);
  add(g, G.cyl(.015, .014, L * .35, 12), S('grip'), [0, -L * .78, z]);
  return g;
 }, { category: 'tool', description: 'Claw hammer' });

 register('pliers', (p = {}) => {
  const L = p.length ?? .18, S = kit.skin({ metal: 'brushed', grip: { preset: 'rubber', color: p.color || '#c0262f' } }, p.skin);
  const g = group('pliers', p, [.06, L, .02]), z = .014;
  for (const s of [-1, 1]) {
   const jaw = add(g, G.rbox(.012, L * .32, .008, .003), S('metal'), [s * .006, -L * .16, z]); jaw.rotation.z = s * .06;
   const arm = add(g, G.rbox(.014, L * .6, .01, .005), S('grip'), [s * .018, -L * .62, z]); arm.rotation.z = -s * .12;
  }
  add(g, G.cyl(.01, .01, .012, 12), S('metal'), [0, -L * .33, z], [Math.PI / 2, 0, 0]);
  return g;
 }, { category: 'tool', description: 'Pliers (grip colour)' });

 register('socketRail', (p = {}) => {
  const n = p.count ?? 9, len = p.length ?? .4, S = kit.skin({ rail: { preset: 'plastic', color: '#c0262f' }, socket: 'chrome' }, p.skin);
  const g = group('socketRail', p, [len, .06, .04]);
  add(g, G.rbox(len, .02, .014, .004), S('rail'), [0, .01, .007]);
  for (let i = 0; i < n; i++) { const r = .009 + i * .0016, h = .03 + i * .0015; add(g, G.cyl(r, r, h, 14), S('socket'), [-len / 2 + .025 + i * (len - .05) / (n - 1), .02 + h / 2, .02]); }
  return g;
 }, { category: 'tool', description: 'Socket set on a rail (count)' });

 // ---------------- bench + vice ----------------
 register('benchTop', (p = {}) => {
  const w = p.width ?? 2, d = p.depth ?? .7, t = p.thickness ?? .05, S = kit.skin({ top: 'wood', edge: 'steel' }, p.skin);
  const g = group('benchTop', p, [w, t, d]);
  add(g, G.rbox(w, t, d, .005), S('top'), [0, t / 2, -d / 2]);
  add(g, G.rbox(w + .01, t * .6, .02, .003), S('edge'), [0, t * .45, .005]);
  return g;
 }, { category: 'part', description: 'Butcher-block bench top with steel nosing' });

 register('vice', (p = {}) => {
  const s = p.size ?? 1, S = kit.skin({ body: { preset: 'paint', color: '#2c5ea8' }, jaw: 'darkSteel', screw: 'chrome' }, p.skin);
  const g = group('vice', p, [.16 * s, .16 * s, .28 * s]);
  add(g, G.cyl(.07 * s, .075 * s, .02 * s, 24), S('body'), [0, .01 * s, -.12 * s]);
  add(g, G.rbox(.13 * s, .07 * s, .12 * s, .012 * s), S('body'), [0, .055 * s, -.15 * s]);
  add(g, G.rbox(.13 * s, .075 * s, .05 * s, .01 * s), S('body'), [0, .06 * s, -.04 * s]);
  for (const z of [-.088, -.067]) add(g, G.rbox(.14 * s, .03 * s, .012 * s, .002), S('jaw'), [0, .105 * s, z * s]);
  add(g, G.cyl(.008 * s, .008 * s, .12 * s, 10), S('screw'), [0, .05 * s, .02 * s], [Math.PI / 2, 0, 0]);
  add(g, G.cylX(.005 * s, .16 * s, 8), S('screw'), [0, .05 * s, .08 * s]);
  for (const x of [-1, 1]) add(g, G.sphere(.01 * s, 10, 8), S('screw'), [x * .08 * s, .05 * s, .08 * s]);
  return g;
 }, { category: 'part', description: 'Bench vice (size scale, body colour)' });

 // ---------------- lights, screen, contact shadow ----------------
 register('shopLight', (p = {}) => {
  const len = p.length ?? 1.2, S = kit.skin({ housing: 'darkSteel', diffuser: { preset: 'emissive', color: p.color || '#ffd9a0', emissive: p.color || '#ffd9a0', emissiveIntensity: p.intensity ?? 2.4 }, chain: 'brushed' }, p.skin);
  const g = group('shopLight', p, [len, .06, .14]);
  add(g, G.rbox(len, .045, .14, .01), S('housing'), [0, .04, 0]);
  add(g, G.rbox(len - .04, .012, .1, .004), S('diffuser'), [0, .014, 0]);
  if (p.drop) for (const s of [-1, 1]) add(g, G.cyl(.003, .003, p.drop, 6), S('chain'), [s * len * .4, .06 + p.drop / 2, 0]);
  return g;
 }, { category: 'light', description: 'Hanging shop light with glowing diffuser (colour, length, drop)' });

 register('neonTube', (p = {}) => {
  const len = p.length ?? 1.6, c = p.color || '#b04cff', S = kit.skin({ tube: { preset: 'emissive', color: c, emissive: c, emissiveIntensity: p.intensity ?? 3.5 }, clip: 'darkSteel' }, p.skin);
  const g = group('neonTube', p, [len, .03, .03]);
  add(g, G.cylX(.012, len, 12), S('tube'), [0, 0, .02]);
  for (const s of [-1, 1]) add(g, G.rbox(.02, .03, .02, .004), S('clip'), [s * len * .42, 0, .01]);
  return g;
 }, { category: 'light', description: 'Neon/LED tube with wall clips' });

 register('screen', (p = {}) => {
  const w = p.width ?? 1.1, h = p.height ?? .7, S = kit.skin({ bezel: 'darkSteel', glass: { preset: 'emissive', color: '#ffffff', emissive: '#ffffff', emissiveIntensity: p.intensity ?? 1.15, map: kit.tex.blueprint?.() || null, emissiveMap: kit.tex.blueprint?.() || null } }, p.skin);
  const g = group('screen', p, [w, h, .05]);
  add(g, G.rbox(w, h, .04, .012), S('bezel'), [0, h / 2, .02]);
  add(g, G.plane(w - .05, h - .05), S('glass'), [0, h / 2, .046]); // 6 mm proud of the bezel: no z-fight on low-precision phone depth
  return g;
 }, { category: 'part', description: 'Wall display (procedural blueprint content)' });

 register('contactShadow', (p = {}) => {
  const w = p.width ?? 1, d = p.depth ?? 1, g = group('contactShadow', p, [w, 0, d]);
  const alpha = kit.tex.contact?.();
  const m = kit.mat('rubber', { color: '#000000', transparent: true, opacity: p.opacity ?? .75, alphaMap: alpha, depthWrite: false, roughness: 1, metalness: 0 });
  const mesh = add(g, G.plane(1, 1), m, [0, .002, -d / 2], [-Math.PI / 2, 0, 0]); mesh.scale.set(w * 1.25, d * 1.3, 1); mesh.castShadow = false; mesh.renderOrder = 2;
  return g;
 }, { category: 'part', description: 'Soft floor contact shadow under a prop footprint' });
}
