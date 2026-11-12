// Neon Canal visuals (v2.1-35): wet asphalt ride line with glowing blue edges, concrete ramps and bridges,
// graffiti walls with lamps, a chain-link fence over the canal, palms, containers, cones and barrels, boost
// chevrons, the neon loop and ring, coins, start/finish arches and a city skyline against the sunset.
// Everything is generated here (canvas textures for graffiti, fence, windows, chevrons, signs), plus the
// ambientCG asphalt/concrete sets. Built to stay light: merged ribbons, instancing, emissive "glow" instead of lights.
import { NEON, NEON_PATH, NEON_GAPS, NEON_COINS, NEON_FEATURES, NEON_BOOSTS, NEON_LOOPS, neonProfile, neonAt, neonInGap } from './ride-neon.js';
const TAU = Math.PI * 2;
function rng(seed) { let r = seed; return () => (r = (r * 16807) % 2147483647) / 2147483647; }
function canvasTex(T, w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
// ---- graffiti panels -----------------------------------------------------------------------------------------
const WORDS = ['WHEELIE', 'KING', 'SEND IT', 'RIDE', 'NEON', 'BMX', 'SKRT', 'FLOW', 'CANAL', 'NO BRAKES', 'HYPE', 'WK', 'LOOP', 'BOOST'];
const PALETTES = [['#b34dff', '#5ff3ff', '#2a0f4a'], ['#ff4fa3', '#ffd23f', '#3b0a2a'], ['#3fe0c5', '#7a5cff', '#06232a'], ['#ffb02e', '#ff3d6e', '#2a1206'], ['#8b5cff', '#ff7bd5', '#140a2e'], ['#39b8ff', '#c6ff4f', '#071a30']];
function graffiti(T, seed) {
  const r = rng(seed * 97 + 13);
  return canvasTex(T, 1024, 512, (g, w, h) => {
    // concrete base: blotchy grey with stains
    g.fillStyle = '#6d6873'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${40 + r() * 60},${40 + r() * 55},${50 + r() * 60},${.05 + r() * .12})`; const s = 20 + r() * 120; g.fillRect(r() * w, r() * h, s, s * (.3 + r())); }
    for (let x = 0; x < w; x += 128) { g.fillStyle = 'rgba(20,18,26,.35)'; g.fillRect(x, 0, 3, h); } // panel joints
    const [a, b, dark] = PALETTES[Math.floor(r() * PALETTES.length)];
    // background throw-up blobs
    for (let i = 0; i < 4; i++) { g.fillStyle = [a, b, '#ffffff', dark][i % 4]; g.globalAlpha = .18 + r() * .2; g.beginPath(); g.ellipse(r() * w, h * (.3 + r() * .5), 80 + r() * 160, 40 + r() * 80, r(), 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    const word = WORDS[Math.floor(r() * WORDS.length)], size = Math.min(250, 1500 / Math.max(3, word.length));
    g.save(); g.translate(w / 2, h * .56); g.rotate((r() - .5) * .18); g.font = `900 ${size}px Impact, "Arial Black", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * .22; g.strokeStyle = dark; g.strokeText(word, 0, 0);
    g.lineWidth = size * .12; g.strokeStyle = '#ffffff'; g.strokeText(word, 0, 0);
    const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillText(word, 0, 0);
    // highlights + drips
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 18; i++) g.fillRect((r() - .5) * size * word.length * .55, -size * .3 + r() * size * .2, 6 + r() * 14, 4);
    g.fillStyle = b; for (let i = 0; i < 14; i++) { const x = (r() - .5) * size * word.length * .55, len = 20 + r() * 70; g.fillRect(x, size * .35, 6, len); g.beginPath(); g.arc(x + 3, size * .35 + len, 5, 0, TAU); g.fill(); }
    g.restore();
    // a crown or stars on some
    if (r() < .5) { const cx = w * (.12 + r() * .76), cy = h * .2, s = 70; g.fillStyle = '#ffc93c'; g.strokeStyle = dark; g.lineWidth = 8; g.beginPath(); g.moveTo(cx - s, cy + s * .5); g.lineTo(cx - s, cy - s * .3); g.lineTo(cx - s * .5, cy + s * .1); g.lineTo(cx, cy - s * .6); g.lineTo(cx + s * .5, cy + s * .1); g.lineTo(cx + s, cy - s * .3); g.lineTo(cx + s, cy + s * .5); g.closePath(); g.stroke(); g.fill(); }
    else for (let i = 0; i < 5; i++) { const cx = r() * w, cy = r() * h * .3 + 20; g.fillStyle = [a, b, '#fff'][i % 3]; g.beginPath(); for (let k = 0; k < 10; k++) { const ang = k * TAU / 10 - Math.PI / 2, rr = k % 2 ? 9 : 22; g.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); } g.fill(); }
    // grime at the bottom
    const gb = g.createLinearGradient(0, h * .75, 0, h); gb.addColorStop(0, 'rgba(10,8,14,0)'); gb.addColorStop(1, 'rgba(10,8,14,.55)'); g.fillStyle = gb; g.fillRect(0, h * .75, w, h * .25);
  });
}
export function makeNeonWorld(T, root, { lowDetail = false } = {}) {
  const group = new T.Group(); group.name = 'environment:neon'; root.add(group); const res = [];
  const keep = o => (res.push(o), o);
  const tl = new T.TextureLoader(), tex = (f, srgb, rep = 1) => { const t = keep(tl.load(f)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = T.SRGBColorSpace; t.repeat.set(rep, rep); return t; };
  const W = NEON.width, half = W / 2, P = NEON_PATH, N = P.length;
  // ---- materials ----
  const asphalt = keep(new T.MeshStandardMaterial({ map: tex('./assets/ambientcg/Asphalt026C/Asphalt026C_Color.jpg', true), normalMap: lowDetail ? null : tex('./assets/ambientcg/Asphalt026C/Asphalt026C_NormalGL.jpg', false), roughnessMap: tex('./assets/ambientcg/Asphalt026C/Asphalt026C_Roughness.jpg', false), color: '#2f2a3a', roughness: .4, metalness: .2, envMapIntensity: .7 }));
  asphalt.normalScale?.set(.6, .6);
  const concrete = keep(new T.MeshStandardMaterial({ map: tex('./assets/ambientcg/Concrete034/Concrete034_Color.jpg', true), normalMap: lowDetail ? null : tex('./assets/ambientcg/Concrete034/Concrete034_NormalGL.jpg', false), color: '#8a8094', roughness: .85, metalness: 0 }));
  const paving = keep(new T.MeshStandardMaterial({ map: tex('./assets/ambientcg/Concrete034/Concrete034_Color.jpg', true), color: '#2c2635', roughness: .45, metalness: .15, envMapIntensity: .6 }));
  const neonBlue = keep(new T.MeshBasicMaterial({ color: new T.Color('#47d4ff').multiplyScalar(2.2), toneMapped: false }));
  const neonPurple = keep(new T.MeshBasicMaterial({ color: new T.Color('#b55cff').multiplyScalar(2.2), toneMapped: false }));
  const glowTex = keep(canvasTex(T, 64, 64, (g, w, h) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }));
  const stripTex = keep(canvasTex(T, 8, 64, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.5, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }));
  const glowBlue = keep(new T.MeshBasicMaterial({ map: stripTex, color: '#3fc8ff', transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  // ---- ride line ribbon (skips the gaps) + side skirts + neon edges ----
  const frame = i => { const p = P[i], c = Math.cos(p.yaw), n = Math.sin(p.yaw); return { x: p.x, z: p.z, nx: n, nz: -c, c, n, h: neonProfile(p.s), s: p.s }; };
  const road = { pos: [], uv: [], idx: [] }, skirt = { pos: [], uv: [], idx: [] }, edge = { pos: [], idx: [] }, glow = { pos: [], uv: [], idx: [] };
  const quadStrip = (B, a0, a1, b0, b1, ua, ub, va = 0, vb = 1) => { const k = B.pos.length / 3; B.pos.push(...a0, ...a1, ...b0, ...b1); if (B.uv) B.uv.push(ua, va, ua, vb, ub, va, ub, vb); B.idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); };
  for (let i = 0; i < N - 1; i++) {
    const A = frame(i), B = frame(i + 1);
    if (neonInGap((A.s + B.s) / 2)) continue;
    const L = [A.x + A.nx * half, A.h, A.z + A.nz * half], R = [A.x - A.nx * half, A.h, A.z - A.nz * half], L2 = [B.x + B.nx * half, B.h, B.z + B.nz * half], R2 = [B.x - B.nx * half, B.h, B.z - B.nz * half];
    quadStrip(road, R, L, R2, L2, A.s / 4, B.s / 4, 0, W / 4);
    // skirts down to the ground (or the water) where the line is raised
    const base = s => (neonInGap(s + 1) || neonInGap(s - 1)) ? NEON.water : (s > NEON_FEATURES.bridge[0] - 2 && s < NEON_FEATURES.bridge[1] + 2 ? NEON.water : 0);
    if (A.h > .05 || B.h > .05) for (const side of [1, -1]) { const ox = side * half; const a0 = [A.x + A.nx * ox, base(A.s) - .1, A.z + A.nz * ox], a1 = [A.x + A.nx * ox, A.h, A.z + A.nz * ox], b0 = [B.x + B.nx * ox, base(B.s) - .1, B.z + B.nz * ox], b1 = [B.x + B.nx * ox, B.h, B.z + B.nz * ox]; side > 0 ? quadStrip(skirt, b0, b1, a0, a1, B.s / 3, A.s / 3, 0, A.h / 3) : quadStrip(skirt, a0, a1, b0, b1, A.s / 3, B.s / 3, 0, A.h / 3); }
    // neon edge lines (thin raised strips) + a soft glow on the wet asphalt beside them
    for (const side of [1, -1]) { const o1 = side * (half - .05), o2 = side * (half - .14), y = .025;
      quadStrip(edge, [A.x + A.nx * o2, A.h + y, A.z + A.nz * o2], [A.x + A.nx * o1, A.h + y, A.z + A.nz * o1], [B.x + B.nx * o2, B.h + y, B.z + B.nz * o2], [B.x + B.nx * o1, B.h + y, B.z + B.nz * o1]);
      const g1 = side * (half - .9), g2 = side * (half + .15); quadStrip(glow, [A.x + A.nx * g1, A.h + .02, A.z + A.nz * g1], [A.x + A.nx * g2, A.h + .02, A.z + A.nz * g2], [B.x + B.nx * g1, B.h + .02, B.z + B.nz * g1], [B.x + B.nx * g2, B.h + .02, B.z + B.nz * g2], 0, 1, side > 0 ? 0 : 1, side > 0 ? 1 : 0); }
  }
  // lip faces where the line ends at a gap
  for (const [a, b] of NEON_GAPS) for (const [s, dir] of [[a, 1], [b, -1]]) { const p = neonAt(s), c = Math.cos(p.yaw), n = Math.sin(p.yaw), h = neonProfile(s - dir * .3), nx = -n, nz = c;
    quadStrip(skirt, [p.x - nx * half, NEON.water, p.z - nz * half], [p.x - nx * half, h, p.z - nz * half], [p.x + nx * half, NEON.water, p.z + nz * half], [p.x + nx * half, h, p.z + nz * half], 0, W / 3, 0, (h - NEON.water) / 3); }
  const mk = (B, mat, name, uv = true) => { const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(B.pos, 3)); if (uv && B.uv) g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2)); g.setIndex(B.idx); g.computeVertexNormals(); const m = new T.Mesh(g, mat); m.name = 'neon:' + name; group.add(m); return m; };
  const roadMesh = mk(road, asphalt, 'road'); roadMesh.receiveShadow = true;
  const skirtMesh = mk(skirt, concrete, 'ramp-sides'); skirtMesh.receiveShadow = true; skirtMesh.castShadow = !lowDetail; skirtMesh.material.side = T.DoubleSide;
  mk(edge, neonBlue, 'edge-neon', false); const gm = mk(glow, glowBlue, 'edge-glow'); gm.renderOrder = 2;
  // ---- the ground beside the line: wet paving promenade (left), canal water (right) ----
  const pave = { pos: [], uv: [], idx: [] };
  for (let i = 0; i < N - 1; i += 2) { const A = frame(i), B = frame(Math.min(N - 1, i + 2)); if (neonInGap(A.s) || neonInGap(B.s)) continue;
    const inner = s => s > NEON_FEATURES.bridge[0] - 2 && s < NEON_FEATURES.bridge[1] + 2;
    if (inner(A.s)) continue;
    for (const [o1, o2] of [[half, 9.5], [-half, -6]]) quadStrip(pave, [A.x + A.nx * o1, 0, A.z + A.nz * o1], [A.x + A.nx * o2, 0, A.z + A.nz * o2], [B.x + B.nx * o1, 0, B.z + B.nz * o1], [B.x + B.nx * o2, 0, B.z + B.nz * o2], A.s / 3, B.s / 3, o1 / 3, o2 / 3); }
  const paveMesh = mk(pave, paving, 'paving'); paveMesh.receiveShadow = true; paveMesh.material.side = T.DoubleSide;
  // canal: one big reflective water plane under everything (seen past the fence, under the bridge and the gaps)
  const water = keep(new T.MeshStandardMaterial({ color: '#140f26', roughness: .12, metalness: .9, envMapIntensity: .55 }));
  const wmesh = new T.Mesh(keep(new T.PlaneGeometry(3000, 3000)), water); wmesh.rotation.x = -Math.PI / 2; wmesh.position.set(500, NEON.water + .4, 350); wmesh.name = 'neon:canal'; group.add(wmesh);
  // canal floor walls under the paving edge (so the promenade reads as a quay)
  const quay = { pos: [], uv: [], idx: [] };
  for (let i = 0; i < N - 1; i += 2) { const A = frame(i), B = frame(Math.min(N - 1, i + 2)); if (neonInGap(A.s) || neonInGap(B.s)) continue; for (const o of [-6, 9.5]) quadStrip(quay, [A.x + A.nx * o, NEON.water, A.z + A.nz * o], [A.x + A.nx * o, 0, A.z + A.nz * o], [B.x + B.nx * o, NEON.water, B.z + B.nz * o], [B.x + B.nx * o, 0, B.z + B.nz * o], A.s / 3, B.s / 3, 0, 1); }
  const quayMesh = mk(quay, concrete, 'quay'); quayMesh.material.side = T.DoubleSide;
  // ---- graffiti wall (left), lamps, wire on top ----
  const graf = []; for (let k = 0; k < (lowDetail ? 4 : 8); k++) graf.push(keep(new T.MeshStandardMaterial({ map: keep(graffiti(T, k + 1)), roughness: .9, metalness: 0 })));
  const wallH = 4.4, wallOff = 9.5, panel = 7;
  const wallGeo = keep(new T.PlaneGeometry(panel + .45, wallH)); // overlap so bends show no gaps const lampPos = [];
  for (let s = 0; s < NEON.len; s += panel) { if (neonInGap(s) || neonInGap(s + panel)) continue; const p = neonAt(s + panel / 2), c = Math.cos(p.yaw), n = Math.sin(p.yaw);
    const m = new T.Mesh(wallGeo, graf[Math.floor((s / panel) * 7.31) % graf.length]); m.position.set(p.x + n * wallOff, wallH / 2, p.z - c * wallOff); m.rotation.y = -p.yaw; m.receiveShadow = true; m.name = 'neon:wall'; group.add(m);
    if (Math.round(s / panel) % 3 === 0) lampPos.push({ x: p.x + n * (wallOff - .35), z: p.z - c * (wallOff - .35), yaw: p.yaw }); }
  // wall top coping
  // lamps: a little housing, a warm bulb, a light pool down the wall and on the ground (no real lights: cheap)
  const lampWarm = keep(new T.MeshBasicMaterial({ color: new T.Color('#ffcf8a').multiplyScalar(2), toneMapped: false }));
  const poolMat = keep(new T.MeshBasicMaterial({ map: glowTex, color: '#ffb46b', transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const bulbGeo = keep(new T.BoxGeometry(.5, .14, .3)), poolGeo = keep(new T.PlaneGeometry(4.5, 4.5)), housing = keep(new T.MeshStandardMaterial({ color: '#2a2630', roughness: .5, metalness: .6 }));
  const bulbs = new T.InstancedMesh(bulbGeo, lampWarm, lampPos.length), cases = new T.InstancedMesh(keep(new T.BoxGeometry(.6, .22, .4)), housing, lampPos.length), pools = new T.InstancedMesh(poolGeo, poolMat, lampPos.length * 2);
  const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3(1, 1, 1);
  lampPos.forEach((l, k) => { E.set(0, -l.yaw, 0); Q.setFromEuler(E); V.set(l.x, wallH - .45, l.z); M.compose(V, Q, S); cases.setMatrixAt(k, M); V.y -= .1; M.compose(V, Q, S); bulbs.setMatrixAt(k, M);
    E.set(0, -l.yaw, 0); Q.setFromEuler(E); V.set(l.x - Math.sin(l.yaw) * .02, wallH - 2.2, l.z + Math.cos(l.yaw) * .02); M.compose(V, Q, S.set(1, 1.3, 1)); pools.setMatrixAt(k * 2, M);
    E.set(-Math.PI / 2, 0, 0); Q.setFromEuler(E); V.set(l.x - Math.sin(l.yaw) * 1.6, .03, l.z + Math.cos(l.yaw) * 1.6); M.compose(V, Q, S.set(1, 1, 1)); pools.setMatrixAt(k * 2 + 1, M); });
  for (const m of [bulbs, cases, pools]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); group.add(m); } pools.renderOrder = 2; bulbs.name = 'neon:lamps';
  // ---- chain-link fence along the canal side ----
  const fenceTex = keep(canvasTex(T, 128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(190,190,205,.95)'; g.lineWidth = 3; for (let k = -128; k < 256; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 128, 128); g.stroke(); g.beginPath(); g.moveTo(k + 128, 0); g.lineTo(k, 128); g.stroke(); } }, { repeat: true }));
  const fenceMat = keep(new T.MeshStandardMaterial({ map: fenceTex, transparent: true, alphaTest: .35, side: T.DoubleSide, metalness: .7, roughness: .4 }));
  const fence = { pos: [], uv: [], idx: [] }, fenceOff = -5.6, fenceH = 2.2, postPos = [];
  for (let i = 0; i < N - 1; i += 4) { const A = frame(i), B = frame(Math.min(N - 1, i + 4)); if (neonInGap(A.s) || neonInGap(B.s) || (A.s > NEON_FEATURES.bridge[0] - 2 && A.s < NEON_FEATURES.bridge[1] + 2)) continue;
    quadStrip(fence, [A.x + A.nx * fenceOff, 0, A.z + A.nz * fenceOff], [A.x + A.nx * fenceOff, fenceH, A.z + A.nz * fenceOff], [B.x + B.nx * fenceOff, 0, B.z + B.nz * fenceOff], [B.x + B.nx * fenceOff, fenceH, B.z + B.nz * fenceOff], A.s / 1.2, B.s / 1.2, 0, fenceH / 1.2);
    if (i % 12 === 0) postPos.push([A.x + A.nx * fenceOff, A.z + A.nz * fenceOff]); }
  const fenceMesh = mk(fence, fenceMat, 'fence');
  const posts = new T.InstancedMesh(keep(new T.CylinderGeometry(.05, .05, fenceH + .1, 6)), housing, postPos.length); postPos.forEach(([x, z], k) => { M.makeTranslation(x, fenceH / 2, z); posts.setMatrixAt(k, M); }); posts.instanceMatrix.needsUpdate = true; posts.computeBoundingSphere(); group.add(posts);
  // ---- boost chevrons on the line (glowing ^^ arrows) + chevron signs on the wall ----
  const chevTex = keep(canvasTex(T, 256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.lineWidth = 34; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#ffffff'; for (const y of [80, 170]) { g.beginPath(); g.moveTo(40, y + 50); g.lineTo(128, y - 30); g.lineTo(216, y + 50); g.stroke(); } }));
  const chevMat = keep(new T.MeshBasicMaterial({ map: chevTex, color: new T.Color('#d07bff').multiplyScalar(1.8), transparent: true, depthWrite: false, toneMapped: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }));
  const chev = []; for (const [a, b] of NEON_BOOSTS) for (let s = a + 1; s < b; s += 3.2) chev.push(s);
  const chevI = new T.InstancedMesh(keep(new T.PlaneGeometry(2.2, 2.2)), chevMat, chev.length);
  chev.forEach((s, k) => { const p = neonAt(s), h0 = neonProfile(s - .6), h1 = neonProfile(s + .6), pitch = Math.atan2(h1 - h0, 1.2); E.set(-Math.PI / 2 + pitch * 0, 0, 0); const q1 = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -p.yaw - Math.PI / 2), q2 = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2 + pitch); Q.copy(q1).multiply(q2); V.set(p.x, neonProfile(s) + .04, p.z); M.compose(V, Q, S.set(1, 1, 1)); chevI.setMatrixAt(k, M); });
  chevI.instanceMatrix.needsUpdate = true; chevI.computeBoundingSphere(); chevI.renderOrder = 3; chevI.name = 'neon:boost-chevrons'; group.add(chevI);
  const signTex = keep(canvasTex(T, 512, 160, (g, w, h) => { g.fillStyle = 'rgba(20,6,40,.85)'; g.fillRect(0, 0, w, h); g.lineWidth = 26; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#ffffff'; for (const x of [90, 220, 350]) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x + 70, 80); g.lineTo(x, 130); g.stroke(); } }));
  const signMat = keep(new T.MeshBasicMaterial({ map: signTex, color: new T.Color('#c27bff').multiplyScalar(1.6), toneMapped: false }));
  const signGeo = keep(new T.PlaneGeometry(3.6, 1.1));
  for (const s of NEON_FEATURES.chevrons) { const p = neonAt(s), c = Math.cos(p.yaw), n = Math.sin(p.yaw), m = new T.Mesh(signGeo, signMat); m.position.set(p.x + n * (wallOff - .08), 2.4, p.z - c * (wallOff - .08)); m.rotation.y = -p.yaw; m.name = 'neon:chevron-sign'; group.add(m); }
  // ---- concrete supports under raised bits (bridge, mega ramp, rooftop, containers) ----
  const pillarGeo = keep(new T.BoxGeometry(.7, 1, .7)), pillars = [];
  for (let s = 6; s < NEON.len; s += 9) { const h = neonProfile(s); if (h > 2.2 && !neonInGap(s)) for (const o of [-half + .6, half - .6]) { const p = neonAt(s); pillars.push({ x: p.x + Math.sin(p.yaw) * o, z: p.z - Math.cos(p.yaw) * o, h: h - NEON.water }); } }
  const pil = new T.InstancedMesh(pillarGeo, concrete, pillars.length); pillars.forEach((q, k) => { M.compose(V.set(q.x, NEON.water + q.h / 2 - .2, q.z), Q.identity(), S.set(1, q.h, 1)); pil.setMatrixAt(k, M); }); pil.instanceMatrix.needsUpdate = true; pil.computeBoundingSphere(); pil.castShadow = !lowDetail; group.add(pil);
  // bridge railings
  const railMat = keep(new T.MeshStandardMaterial({ color: '#c9c3d6', metalness: .8, roughness: .35 }));
  { const [a, b] = NEON_FEATURES.bridge; for (const o of [half + .1, -half - .1]) { const pts = []; for (let s = a - 22; s <= b + 20; s += 1) { const p = neonAt(s); pts.push(new T.Vector3(p.x + Math.sin(p.yaw) * o, neonProfile(s) + 1.05, p.z - Math.cos(p.yaw) * o)); } const g = keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 120, .05, 6)); group.add(new T.Mesh(g, railMat)); } }
  // ---- containers (the section you ride across) and a building under the rooftop ----
  const contCols = ['#b8332f', '#2d6fb5', '#1f9c8f', '#d9892b', '#6c3fa8'];
  const ribTex = keep(canvasTex(T, 256, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, 0, 5, h); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x + 6, 0, 2, h); } g.fillStyle = 'rgba(30,20,10,.25)'; g.fillRect(0, h - 8, w, 8); }, { repeat: true }));
  const contGeo = keep(new T.BoxGeometry(12.2, 2.6, W + .4));
  const contAt = (s, col, y = 0, side = 0) => { const p = neonAt(s), m = new T.Mesh(contGeo, keep(new T.MeshStandardMaterial({ map: ribTex, color: col, roughness: .55, metalness: .45 }))); m.position.set(p.x + Math.sin(p.yaw) * side, y + 1.3, p.z - Math.cos(p.yaw) * side); m.rotation.y = -p.yaw; m.castShadow = !lowDetail; m.receiveShadow = true; m.name = 'neon:container'; group.add(m); };
  contAt(578.2, contCols[0]); contAt(590, contCols[1]);
  [[150, 3], [452, 2], [655, 4], [990, 0], [1240, 1], [1600, 3]].forEach(([s, c], k) => { contAt(s, contCols[c], 0, -7.8); if (k % 2) contAt(s + .5, contCols[(c + 2) % 5], 2.6, -7.8); });
  { const [a, b] = NEON_FEATURES.rooftop, p = neonAt((a + b) / 2), L = b - a + 8; const bld = new T.Mesh(keep(new T.BoxGeometry(L, 5, W + 6)), keep(new T.MeshStandardMaterial({ color: '#4d4258', roughness: .8 }))); bld.position.set(p.x, 2.5 - .02, p.z); bld.rotation.y = -p.yaw; bld.receiveShadow = true; group.add(bld);
    for (let k = 0; k < 4; k++) { const q = neonAt(a + 6 + k * 9), ac = new T.Mesh(keep(new T.BoxGeometry(1.4, 1, 1.2)), housing); ac.position.set(q.x + Math.sin(q.yaw) * (half + 1.6), 5.5, q.z - Math.cos(q.yaw) * (half + 1.6)); ac.rotation.y = -q.yaw; group.add(ac); } }
  // overpasses spanning the line
  for (const s of NEON_FEATURES.overpasses) { const p = neonAt(s), deck = new T.Mesh(keep(new T.BoxGeometry(6, 1.1, 30)), concrete); deck.position.set(p.x, 8.2, p.z); deck.rotation.y = -p.yaw; deck.castShadow = !lowDetail; group.add(deck);
    for (const o of [-8.5, 8.5]) { const leg = new T.Mesh(pillarGeo, concrete); leg.scale.set(1.6, 8, 1.6); leg.position.set(p.x + Math.sin(p.yaw) * o, 4, p.z - Math.cos(p.yaw) * o); group.add(leg); }
    const strip = new T.Mesh(keep(new T.BoxGeometry(.12, .12, 30)), neonPurple); strip.position.set(p.x - Math.cos(p.yaw) * 3.05, 7.7, p.z - Math.sin(p.yaw) * 3.05); strip.rotation.y = -p.yaw; group.add(strip); }
  // ---- cones and barrels ----
  const coneMat = keep(new T.MeshStandardMaterial({ color: '#ff6a1f', roughness: .5 })), barrelMat = keep(new T.MeshStandardMaterial({ color: '#a8461f', roughness: .6, metalness: .5 }));
  const coneGeo = keep(new T.ConeGeometry(.22, .7, 10)), barrelGeo = keep(new T.CylinderGeometry(.32, .32, .9, 12));
  const cones = [], barrels = []; const r = rng(5);
  for (const s of NEON_FEATURES.cones) for (let k = 0; k < 3; k++) { const p = neonAt(s + k * 1.2), o = (r() < .5 ? 1 : -1) * (half + .8 + r() * 1.4); cones.push([p.x + Math.sin(p.yaw) * o, p.z - Math.cos(p.yaw) * o]); }
  for (let s = 40; s < NEON.len; s += 55 + r() * 40) { const p = neonAt(s), o = half + 1.5 + r() * 2.5; barrels.push([p.x + Math.sin(p.yaw) * o, p.z - Math.cos(p.yaw) * o]); }
  { const p = neonAt(76); for (let k = -1; k <= 1; k++) barrels.push([p.x + Math.sin(p.yaw) * k * 1.2 + Math.cos(p.yaw) * 9, p.z - Math.cos(p.yaw) * k * 1.2 + Math.sin(p.yaw) * 9]); }
  const coneI = new T.InstancedMesh(coneGeo, coneMat, cones.length); cones.forEach(([x, z], k) => { M.makeTranslation(x, .35, z); coneI.setMatrixAt(k, M); });
  const barI = new T.InstancedMesh(barrelGeo, barrelMat, barrels.length); barrels.forEach(([x, z], k) => { M.makeTranslation(x, .45, z); barI.setMatrixAt(k, M); });
  for (const m of [coneI, barI]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.castShadow = !lowDetail; group.add(m); }
  // ---- palms (procedural): curved trunk + drooping fronds ----
  const frondTex = keep(canvasTex(T, 128, 512, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#2f5a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); for (let y = 10; y < h; y += 9) { const l = (w / 2 - 4) * Math.sin(Math.PI * y / h); g.strokeStyle = y % 18 ? '#3f7d33' : '#356b2c'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - l, y + 26); g.moveTo(w / 2, y); g.lineTo(w / 2 + l, y + 26); g.stroke(); } }));
  const frondMat = keep(new T.MeshStandardMaterial({ map: frondTex, alphaTest: .4, side: T.DoubleSide, roughness: .8 })), trunkMat = keep(new T.MeshStandardMaterial({ color: '#6b5440', roughness: .95 }));
  const frondGeo = keep(new T.PlaneGeometry(1.1, 4.2, 1, 6)); { const pa = frondGeo.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) + 2.1, t = y / 4.2; pa.setY(i, y * .9 - t * t * 1.6); pa.setZ(i, Math.abs(pa.getX(i)) * -.25); } frondGeo.translate(0, 0, 0); frondGeo.rotateX(Math.PI / 2); frondGeo.computeVertexNormals(); }
  const palms = []; const pr = rng(9);
  for (let s = 20; s < NEON.len; s += 22 + pr() * 30) { if (neonInGap(s)) continue; const p = neonAt(s), side = pr() < .55 ? -1 : 1, o = side > 0 ? wallOff + 2 + pr() * 6 : -(15 + pr() * 6); /* canal-side palms stand behind the side-view camera */ palms.push({ x: p.x + Math.sin(p.yaw) * o, z: p.z - Math.cos(p.yaw) * o, h: 7 + pr() * 6, lean: (pr() - .5) * .5, rot: pr() * TAU, y0: side > 0 ? 0 : 0 }); }
  const trunkGeoCache = new Map();
  const nPalms = lowDetail ? Math.ceil(palms.length / 2) : palms.length, frondI = new T.InstancedMesh(frondGeo, frondMat, nPalms * 8);
  palms.slice(0, nPalms).forEach((pm, k) => { const pts = []; for (let t = 0; t <= 1.001; t += .25) pts.push(new T.Vector3(Math.sin(pm.lean) * pm.h * t * t * .5, pm.h * t, 0));
    const g = keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 8, .16, 6)); const trunk = new T.Mesh(g, trunkMat); trunk.position.set(pm.x, pm.y0, pm.z); trunk.rotation.y = pm.rot; trunk.castShadow = !lowDetail; group.add(trunk);
    const top = pts[pts.length - 1].clone().applyAxisAngle(new T.Vector3(0, 1, 0), pm.rot).add(new T.Vector3(pm.x, pm.y0, pm.z));
    for (let f = 0; f < 8; f++) { E.set(0, f * TAU / 8 + pm.rot, 0, 'YXZ'); Q.setFromEuler(E); const tilt = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -.25 + (f % 2) * .15); Q.multiply(tilt); M.compose(top, Q, S.set(1, 1, 1)); frondI.setMatrixAt(k * 8 + f, M); } });
  frondI.instanceMatrix.needsUpdate = true; frondI.computeBoundingSphere(); frondI.castShadow = !lowDetail; group.add(frondI);
  // ---- skyline ----
  const winTex = keep(canvasTex(T, 128, 256, (g, w, h) => { g.fillStyle = '#1b1830'; g.fillRect(0, 0, w, h); const rr = rng(3); for (let y = 6; y < h; y += 12) for (let x = 6; x < w; x += 12) { const lit = rr(); g.fillStyle = lit > .72 ? (rr() < .7 ? '#ffd38a' : '#9fe7ff') : lit > .55 ? '#3a3560' : '#24203c'; g.fillRect(x, y, 7, 8); } }, { repeat: true }));
  const winMat = keep(new T.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: new T.Color('#ffffff'), emissiveIntensity: .9, color: '#5a5480', roughness: .6, metalness: .3 }));
  const boxGeo = keep(new T.BoxGeometry(1, 1, 1)); const sk = []; const sr = rng(21);
  const cx = 500, cz = 340;
  for (let k = 0; k < (lowDetail ? 70 : 150); k++) { const a = sr() * TAU, d = 720 + sr() * 380, w = 25 + sr() * 45, h = 40 + Math.pow(sr(), 1.6) * 170; sk.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, w, d2: 20 + sr() * 40, h, rot: sr() * TAU }); }
  const skyI = new T.InstancedMesh(boxGeo, winMat, sk.length); sk.forEach((b, k) => { E.set(0, b.rot, 0); Q.setFromEuler(E); M.compose(V.set(b.x, b.h / 2 - 2, b.z), Q, S.set(b.w, b.h, b.d2)); skyI.setMatrixAt(k, M); }); skyI.instanceMatrix.needsUpdate = true; skyI.computeBoundingSphere(); skyI.name = 'neon:skyline'; group.add(skyI);
  // nearer low-rise blocks across the canal (opposite bank), dark with lit windows
  const near = []; for (let s = 0; s < NEON.len; s += 26 + sr() * 18) { const p = neonAt(s), o = -(40 + sr() * 30); near.push({ x: p.x + Math.sin(p.yaw) * o, z: p.z - Math.cos(p.yaw) * o, w: 14 + sr() * 14, h: 5 + sr() * 12, rot: -p.yaw }); }
  const nearI = new T.InstancedMesh(boxGeo, winMat, near.length); near.forEach((b, k) => { E.set(0, b.rot, 0); Q.setFromEuler(E); M.compose(V.set(b.x, b.h / 2 - 3, b.z), Q, S.set(b.w, b.h, 12)); nearI.setMatrixAt(k, M); }); nearI.instanceMatrix.needsUpdate = true; nearI.computeBoundingSphere(); group.add(nearI);
  // behind the graffiti wall: warehouses
  const wh = []; for (let s = 0; s < NEON.len; s += 30 + sr() * 15) { const p = neonAt(s), o = wallOff + 12 + sr() * 8; wh.push({ x: p.x + Math.sin(p.yaw) * o, z: p.z - Math.cos(p.yaw) * o, w: 18 + sr() * 12, h: 8 + sr() * 9, rot: -p.yaw }); }
  const whI = new T.InstancedMesh(boxGeo, keep(new T.MeshStandardMaterial({ color: '#3d3550', roughness: .9 })), wh.length); wh.forEach((b, k) => { E.set(0, b.rot, 0); Q.setFromEuler(E); M.compose(V.set(b.x, b.h / 2, b.z), Q, S.set(b.w, b.h, 14)); whI.setMatrixAt(k, M); }); whI.instanceMatrix.needsUpdate = true; whI.computeBoundingSphere(); group.add(whI);
  // ---- the loop (neon rims) and the neon ring over the last gap ----
  for (const L of NEON_LOOPS) { const lane = { pos: [], uv: [], idx: [] }, rimL = [], rimR = []; const pt = (a, inset = 0) => { const rad = L.radius - inset; return [L.x + rad * Math.sin(a) + L.exitOffset * a / TAU, L.y + L.radius - rad * Math.cos(a)]; };
    for (let i = 0; i < 128; i++) { const a0 = TAU * i / 128, a1 = TAU * (i + 1) / 128, [x0, y0] = pt(a0, -.05), [x1, y1] = pt(a1, -.05); quadStrip(lane, [x0, y0, L.z - 2.1], [x0, y0, L.z + 2.1], [x1, y1, L.z - 2.1], [x1, y1, L.z + 2.1], a0 * 3, a1 * 3, 0, 1);
      rimL.push(new T.Vector3(x0, y0 + .02, L.z - 2.15)); rimR.push(new T.Vector3(x0, y0 + .02, L.z + 2.15)); }
    const lm = mk(lane, asphalt, 'loop'); lm.material = keep(asphalt.clone()); lm.material.side = T.DoubleSide;
    for (const [rim, mat] of [[rimL, neonPurple], [rimR, neonBlue]]) group.add(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(rim, true), 200, .07, 6)), mat));
    // outer shell of the loop (a big concrete-and-metal ring) with glow
    const shell = new T.Mesh(keep(new T.TorusGeometry(L.radius + .35, .28, 10, 80)), keep(new T.MeshStandardMaterial({ color: '#3c3550', metalness: .7, roughness: .35 }))); shell.position.set(L.x + L.exitOffset / 2, L.y + L.radius, L.z); group.add(shell);
    for (const dz of [-2.4, 2.4]) { const t = new T.Mesh(keep(new T.TorusGeometry(L.radius + .62, .06, 6, 90)), dz < 0 ? neonPurple : neonBlue); t.position.set(L.x + L.exitOffset / 2, L.y + L.radius, L.z + dz); group.add(t); } }
  { const p = neonAt(NEON_FEATURES.ring), y = 9; const ring = new T.Mesh(keep(new T.TorusGeometry(5.5, .35, 12, 90)), neonPurple); ring.position.set(p.x, y, p.z); ring.rotation.y = -p.yaw + Math.PI / 2; group.add(ring);
    const ring2 = new T.Mesh(keep(new T.TorusGeometry(5.0, .12, 8, 90)), neonBlue); ring2.position.copy(ring.position); ring2.rotation.copy(ring.rotation); group.add(ring2); }
  // ---- start + finish arches ----
  const archText = (txt, col) => keep(canvasTex(T, 1024, 192, (g, w, h) => { g.fillStyle = 'rgba(10,4,24,.9)'; g.fillRect(0, 0, w, h); g.font = '900 120px Impact, "Arial Black", system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 30; g.fillStyle = col; g.fillText(txt, w / 2, h / 2 + 6); g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = .55; g.fillText(txt, w / 2, h / 2 + 6); }));
  const arch = (s, txt, col) => { const p = neonAt(s), h0 = neonProfile(s); const a = new T.Group(); a.position.set(p.x, h0, p.z); a.rotation.y = -p.yaw + Math.PI / 2; group.add(a);
    for (const o of [-half - .5, half + .5]) { const leg = new T.Mesh(keep(new T.BoxGeometry(.4, 5.4, .4)), housing); leg.position.set(o, 2.7, 0); a.add(leg); const nl = new T.Mesh(keep(new T.BoxGeometry(.08, 5.4, .08)), col === '#47d4ff' ? neonBlue : neonPurple); nl.position.set(o, 2.7, .24); a.add(nl); }
    const sign = new T.Mesh(keep(new T.PlaneGeometry(W + 1.4, 1.5)), keep(new T.MeshBasicMaterial({ map: archText(txt, col), toneMapped: false, side: T.DoubleSide }))); sign.position.set(0, 5.6, 0); a.add(sign); };
  arch(NEON_FEATURES.start, 'NEON CANAL', '#47d4ff'); arch(NEON.finish, 'FINISH', '#ff5ccf');
  // ---- coins ----
  const coinMat = keep(new T.MeshStandardMaterial({ color: '#ffc93c', emissive: '#ff9a1a', emissiveIntensity: .55, metalness: .85, roughness: .25 }));
  const coinGeo = keep(new T.CylinderGeometry(.42, .42, .09, 20)); coinGeo.rotateX(Math.PI / 2);
  const coins = new T.InstancedMesh(coinGeo, coinMat, NEON_COINS.length); coins.name = 'neon:coins'; coins.frustumCulled = false; group.add(coins);
  const taken = new Uint8Array(NEON_COINS.length); let spin = 0;
  const placeCoins = () => { NEON_COINS.forEach((c, k) => { if (taken[k]) { M.makeScale(0, 0, 0); } else { E.set(0, spin + c.s * .2, 0); Q.setFromEuler(E); M.compose(V.set(c.x, c.y + Math.sin(spin * 2 + k) * .06, c.z), Q, S.set(1, 1, 1)); } coins.setMatrixAt(k, M); }); coins.instanceMatrix.needsUpdate = true; };
  placeCoins();
  return {
    group,
    update(dt) { spin += dt * 2.6; placeCoins(); },
    // side view looks across from the canal side: the fence would sit between the camera and the bike
    setView(blend) { const v = blend < .5; fenceMesh.visible = v; posts.visible = v; },
    takeCoin(k) { if (taken[k]) return false; taken[k] = 1; return true; },
    resetCoins() { taken.fill(0); },
    coinsTaken: () => taken.reduce((a, b) => a + b, 0),
    state: () => ({ neon: true, len: NEON.len, coins: NEON_COINS.length, lamps: lampPos.length, palms: nPalms }),
    dispose() { res.forEach(o => o.dispose?.()); group.removeFromParent(); },
  };
}
