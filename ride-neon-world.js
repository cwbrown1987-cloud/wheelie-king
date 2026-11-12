// Neon Canal visuals (v2.1-35): wet asphalt ride line with glowing blue edges, concrete ramps and bridges,
// graffiti walls with lamps, a chain-link fence over the canal, palms, containers, cones and barrels, boost
// chevrons, the neon loop and ring, coins, start/finish arches and a city skyline against the sunset.
// Everything is generated here (canvas textures for graffiti, fence, windows, chevrons, signs), plus the
// ambientCG asphalt/concrete sets. Built to stay light: merged ribbons, instancing, emissive "glow" instead of lights.
import { GLTFLoader as GLTF } from './vendor/GLTFLoader.js';
import { NEON, NEON_PATH, NEON_GAPS, NEON_COINS, NEON_FEATURES, NEON_BOOSTS, NEON_LOOPS, neonProfile, neonAt, neonInGap } from './ride-neon.js';
const TAU = Math.PI * 2;
function rng(seed) { let r = seed; return () => (r = (r * 16807) % 2147483647) / 2147483647; }
function canvasTex(T, w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
// ---- graffiti panels (v2.1-45: gritty dark concrete, dense wildstyle pieces in purple/teal/pink, gold crowns) ----
const TAGS = ['BLK', 'WKR', 'ZRO', 'KNG', 'SKR', 'EZR', 'RKT', 'VYB', 'OKS', 'BMX', 'WK', 'NRV'];
const PALETTES = [['#a23dff', '#36e6ff', '#1a0730'], ['#ff3fa4', '#8a3dff', '#2a0622'], ['#2fd9c4', '#7a4dff', '#04201f'], ['#c04dff', '#ff7ad9', '#190826'], ['#3aa8ff', '#c34dff', '#060f2c'], ['#8f3dff', '#3fffc9', '#12062a']];
function concreteBase(g, w, h, r) {
  g.fillStyle = '#4a4650'; g.fillRect(0, 0, w, h);
  const id = g.getImageData(0, 0, w, h), d = id.data;            // speckle grit
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 38; d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.1; }
  g.putImageData(id, 0, 0);
  for (let i = 0; i < 340; i++) { g.fillStyle = `rgba(${20 + r() * 50},${18 + r() * 45},${26 + r() * 50},${.06 + r() * .16})`; const s = 15 + r() * 140; g.beginPath(); g.ellipse(r() * w, r() * h, s, s * (.3 + r() * .8), r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h * .5, len = 60 + r() * 260; const gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, 'rgba(15,12,20,.35)'); gr.addColorStop(1, 'rgba(15,12,20,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 7, len); } // water stains
  for (let x = 0; x < w; x += 256) { g.fillStyle = 'rgba(12,10,16,.55)'; g.fillRect(x, 0, 4, h); g.fillStyle = 'rgba(120,115,130,.18)'; g.fillRect(x + 4, 0, 2, h); } // panel joints
  g.fillStyle = 'rgba(10,8,14,.5)'; for (const y of [h * .18]) g.fillRect(0, y, w, 3);
}
function wildLetters(g, word, x0, y0, size, a, b, dark, r) {
  // letter by letter: skewed, overlapping, a deep drop extrusion, outline, gradient fill, white shine, arrows
  g.font = `900 ${size}px Impact, "Arial Black", system-ui, sans-serif`; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const ws = [...word].map(ch => g.measureText(ch).width * .82), tot = ws.reduce((p, q) => p + q, 0); let x = x0 - tot / 2;
  const L = [...word].map((ch, i) => { const o = { ch, x: x + ws[i] / 2, y: y0 + (r() - .5) * size * .22, rot: (r() - .5) * .35, sc: .9 + r() * .3 }; x += ws[i]; return o; });
  const each = fn => L.forEach(l => { g.save(); g.translate(l.x, l.y); g.rotate(l.rot); g.transform(1, 0, -.18, 1, 0, 0); g.scale(l.sc, l.sc); g.textAlign = 'center'; fn(l); g.restore(); });
  for (let k = 14; k > 0; k -= 2) each(l => { g.fillStyle = dark; g.fillText(l.ch, k * .9, k); });         // 3D block
  each(l => { g.lineWidth = size * .2; g.strokeStyle = '#0d0614'; g.strokeText(l.ch, 0, 0); });
  each(l => { g.lineWidth = size * .1; g.strokeStyle = b; g.strokeText(l.ch, 0, 0); });
  each(l => { const gr = g.createLinearGradient(0, -size * .45, 0, size * .45); gr.addColorStop(0, a); gr.addColorStop(.55, b); gr.addColorStop(1, a); g.fillStyle = gr; g.fillText(l.ch, 0, 0); });
  each(l => { g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(-size * .22, -size * .3, size * .12, size * .05); g.fillRect(-size * .05, -size * .32, size * .05, size * .05); });
  g.strokeStyle = b; g.fillStyle = b; g.lineWidth = size * .07; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const l = L[Math.floor(r() * L.length)], ang = (r() < .5 ? -1 : 1) * (.4 + r() * .8) + (r() < .5 ? 0 : Math.PI), len = size * (.4 + r() * .3); const sx = l.x + Math.cos(ang) * size * .35, sy = l.y + Math.sin(ang) * size * .4, ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2 + Math.sin(ang) * len * .3, (sy + ey) / 2, ex, ey); g.stroke(); g.beginPath(); g.moveTo(ex + Math.cos(ang) * size * .12, ey + Math.sin(ang) * size * .12); g.lineTo(ex + Math.cos(ang + 2.2) * size * .1, ey + Math.sin(ang + 2.2) * size * .1); g.lineTo(ex + Math.cos(ang - 2.2) * size * .1, ey + Math.sin(ang - 2.2) * size * .1); g.fill(); }
  return tot;
}
function crown(g, cx, cy, s, dark) {
  g.lineJoin = 'round'; g.lineWidth = s * .14; g.strokeStyle = dark;
  const path = () => { g.beginPath(); g.moveTo(cx - s, cy + s * .55); g.lineTo(cx - s * 1.05, cy - s * .45); g.lineTo(cx - s * .5, cy); g.lineTo(cx, cy - s * .75); g.lineTo(cx + s * .5, cy); g.lineTo(cx + s * 1.05, cy - s * .45); g.lineTo(cx + s, cy + s * .55); g.closePath(); };
  path(); g.stroke(); const gr = g.createLinearGradient(0, cy - s, 0, cy + s * .6); gr.addColorStop(0, '#ffe07a'); gr.addColorStop(1, '#e09a1a'); g.fillStyle = gr; path(); g.fill();
  g.fillStyle = '#fff3b0'; for (const dx of [-1.05, 0, 1.05]) { g.beginPath(); g.arc(cx + dx * s, cy - (dx ? s * .5 : s * .8), s * .11, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - s, cy + s * .3, s * 2, s * .25);
}
function graffiti(T, seed) {
  const r = rng(seed * 97 + 13);
  return canvasTex(T, 1024, 512, (g, w, h) => {
    concreteBase(g, w, h, r);
    const [a, b, dark] = PALETTES[Math.floor(r() * PALETTES.length)];
    // faded older layers underneath
    for (let i = 0; i < 6; i++) { g.globalAlpha = .12 + r() * .14; g.fillStyle = [a, b, '#d9d2e6'][i % 3]; g.beginPath(); g.ellipse(r() * w, h * (.35 + r() * .5), 70 + r() * 170, 35 + r() * 90, r(), 0, TAU); g.fill(); }
    g.globalAlpha = .35; g.strokeStyle = '#e8e2f0'; g.lineWidth = 4; for (let i = 0; i < 7; i++) { g.beginPath(); let x = r() * w, y = h * (.15 + r() * .7); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += 8 + r() * 16; y += (r() - .5) * 30; g.lineTo(x, y); } g.stroke(); } // tags
    g.globalAlpha = 1;
    // the main piece fills the panel
    const word = TAGS[Math.floor(r() * TAGS.length)], size = Math.min(330, 900 / word.length * 1.25);
    wildLetters(g, word, w / 2 + (r() - .5) * 60, h * .6, size, a, b, dark, r);
    // drips under it
    g.fillStyle = b; for (let i = 0; i < 16; i++) { const x = w * (.15 + r() * .7), y = h * .6 + size * .35, len = 15 + r() * 80; g.fillRect(x, y, 5, len); g.beginPath(); g.arc(x + 2.5, y + len, 5, 0, TAU); g.fill(); }
    if (r() < .7) crown(g, w * (.2 + r() * .6), h * .17, 46 + r() * 22, '#140a06');
    else for (let i = 0; i < 5; i++) { const cx = r() * w, cy = r() * h * .25 + 20; g.fillStyle = [a, '#ffd23f', '#fff'][i % 3]; g.beginPath(); for (let k = 0; k < 10; k++) { const ang = k * TAU / 10 - Math.PI / 2, rr = k % 2 ? 9 : 24; g.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); } g.fill(); }
    // grime band at the foot, damp darkening
    const gb = g.createLinearGradient(0, h * .72, 0, h); gb.addColorStop(0, 'rgba(8,6,12,0)'); gb.addColorStop(1, 'rgba(8,6,12,.7)'); g.fillStyle = gb; g.fillRect(0, h * .72, w, h * .28);
  });
}
export function makeNeonWorld(T, root, { lowDetail = false, GLTFLoader = GLTF, reflect = false } = {}) {
  const group = new T.Group(); group.name = 'environment:neon'; root.add(group); const res = [];
  const keep = o => (res.push(o), o);
  const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3(1, 1, 1);
  const tl = new T.TextureLoader(), tex = (f, srgb, rep = 1) => { const t = keep(tl.load(f)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = T.SRGBColorSpace; t.repeat.set(rep, rep); return t; };
  const W = NEON.width, half = W / 2, P = NEON_PATH, N = P.length;
  // v2.1-45: wall right beside the line and the fence on a low parapet at the canal edge, like the picture
  const wallH = 4.4, wallOff = half + 2.1, quayR = -(half + 1.5), fenceOff = -(half + 1.15);
  // ---- materials ----
  const asphalt = keep(new T.MeshStandardMaterial({ map: tex('./assets/ambientcg/Asphalt026C/Asphalt026C_Color.jpg', true), normalMap: lowDetail ? null : tex('./assets/ambientcg/Asphalt026C/Asphalt026C_NormalGL.jpg', false), roughnessMap: tex('./assets/ambientcg/Asphalt026C/Asphalt026C_Roughness.jpg', false), color: '#2a2534', roughness: .45, metalness: .15, envMapIntensity: .4 }));
  asphalt.normalScale?.set(.6, .6);
  // v2.1-45 wet ground: planar mirror of the scene (rendered at reduced size from a camera flipped about y=0)
  // blended into the road, paving and canal, strongest in the puddles and at grazing angles, smeared into vertical
  // streaks like light on a wet street. Low quality skips the mirror and keeps the glossy puddles only.
  const mirror = reflect ? (() => {
    const rt = keep(new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType })), vcam = new T.PerspectiveCamera(), texMat = new T.Matrix4(), bias = new T.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
    const U = { wkRefl: { value: rt.texture }, wkTexMat: { value: texMat }, wkReflOn: { value: 0 }, wkTime: { value: 0 } };
    const cp = new T.Vector3(), fw = new T.Vector3(), up = new T.Vector3(), sz = new T.Vector2(), pl = new T.Plane(), q = new T.Vector4(), cl = new T.Vector4(), hide = [];
    return { U, hide, render(R, scene, cam, scale) {
      if (!(scale > 0)) { U.wkReflOn.value = 0; return; }
      R.getDrawingBufferSize(sz); const w = Math.max(64, Math.round(sz.x * scale)), h = Math.max(64, Math.round(sz.y * scale)); if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      cam.updateMatrixWorld(); cp.setFromMatrixPosition(cam.matrixWorld); if (cp.y < .1) { U.wkReflOn.value = 0; return; }
      fw.set(0, 0, -1).transformDirection(cam.matrixWorld); up.set(0, 1, 0).transformDirection(cam.matrixWorld);
      vcam.position.set(cp.x, -cp.y, cp.z); vcam.up.set(up.x, -up.y, up.z); vcam.lookAt(cp.x + fw.x, -(cp.y + fw.y), cp.z + fw.z); vcam.far = cam.far; vcam.near = cam.near;
      vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(cam.projectionMatrix); texMat.copy(bias).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
      pl.setFromNormalAndCoplanarPoint(V.set(0, 1, 0), fw.set(0, .04, 0)).applyMatrix4(vcam.matrixWorldInverse); cl.set(pl.normal.x, pl.normal.y, pl.normal.z, pl.constant);   // oblique near plane = the ground
      const e = vcam.projectionMatrix.elements; q.x = (Math.sign(cl.x) + e[8]) / e[0]; q.y = (Math.sign(cl.y) + e[9]) / e[5]; q.z = -1; q.w = (1 + e[10]) / e[14]; cl.multiplyScalar(2 / cl.dot(q)); e[2] = cl.x; e[6] = cl.y; e[10] = cl.z + 1; e[14] = cl.w;
      const vis = hide.map(m => m.visible); hide.forEach(m => { m.visible = false; }); const prevRT = R.getRenderTarget(), sh = R.shadowMap.autoUpdate; R.shadowMap.autoUpdate = false;
      R.setRenderTarget(rt); R.clear(); R.render(scene, vcam); R.setRenderTarget(prevRT); R.shadowMap.autoUpdate = sh; hide.forEach((m, k) => { m.visible = vis[k]; }); U.wkReflOn.value = 1;
    } };
  })() : null;
  // puddles (v2.1-44): noise patches where the surface goes glassy and dark; + the mirror where there is one
  const puddles = (mat, key, amount = 1, { wet = .3, flat = true, water = false } = {}) => { mat.customProgramCacheKey = () => 'wk-puddle-' + key + (mirror ? '-m' : ''); mat.onBeforeCompile = sh => {
    if (mirror) Object.assign(sh.uniforms, mirror.U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;varying vec4 vWkClip;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPW=(modelMatrix*vec4(transformed,1.)).xyz;').replace('#include <project_vertex>', '#include <project_vertex>\nvWkClip=gl_Position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec4 vWkClip;
${mirror ? '#define WK_REFL\nuniform sampler2D wkRefl;uniform mat4 wkTexMat;uniform float wkReflOn;uniform float wkTime;' : ''}
varying vec3 vPW;float pH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float pN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(pH(i),pH(i+vec2(1,0)),f.x),mix(pH(i+vec2(0,1)),pH(i+vec2(1,1)),f.x),f.y);}
float wkPud;`).replace('#include <map_fragment>', `#include <map_fragment>
wkPud=${water ? '1.' : `smoothstep(.56,.66,pN(vPW.xz*.32)*.7+pN(vPW.xz*1.3+5.)*.3)*${amount.toFixed(2)}`};diffuseColor.rgb*=1.-.45*wkPud;`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,.12,wkPud);`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${water ? '' : 'normal=normalize(mix(normal,(viewMatrix*vec4(0.,1.,0.,0.)).xyz,wkPud));'}`).replace('#include <opaque_fragment>', `#ifdef WK_REFL
{ vec2 ruv=vec2(.5-.5*vWkClip.x/vWkClip.w,.5+.5*vWkClip.y/vWkClip.w);
  vec3 gn=normalize(vNormal);vec2 d=(normal.xy-gn.xy)*${water ? '.0' : '.05'}*(1.-wkPud);
  ${water ? 'd+=vec2(pN(vPW.xz*.35+vec2(wkTime*.6,0.))-.5,pN(vPW.xz*.5-vec2(0.,wkTime*.4))-.5)*.022;' : ''}
  float st=${water ? '.005' : '.007'}*(1.-.6*wkPud);vec3 rc=vec3(0.);float ws=0.;
  for(int i=-3;i<=3;i++){float w=1.-abs(float(i))*.22;rc+=texture2D(wkRefl,ruv+d+vec2(0.,float(i)*st)).rgb*w;ws+=w;}rc/=ws;
  float fr=.06+.94*pow(1.-clamp(dot(gn,normalize(vViewPosition)),0.,1.),4.);
  float fl=${flat ? '1.-smoothstep(.06,.16,abs(vPW.y))' : '1.'};
  float k=fl*wkReflOn*clamp(${wet.toFixed(2)}+wkPud*.7,0.,1.)*(.1+.6*fr);
  outgoingLight=outgoingLight*(1.-k*.5)+rc*k*.85; }
#endif
outgoingLight=min(outgoingLight,vec3(1.25)); /* no white-out sun glare on the wet ground: a warm sheen, not a blinding bloom */
#include <opaque_fragment>`); }; };
  puddles(asphalt, 'road', 1, { wet: .38 });
  const concrete = keep(new T.MeshStandardMaterial({ map: tex('./assets/ambientcg/Concrete034/Concrete034_Color.jpg', true), normalMap: lowDetail ? null : tex('./assets/ambientcg/Concrete034/Concrete034_NormalGL.jpg', false), color: '#8a8094', roughness: .85, metalness: 0 }));
  const paving = keep(new T.MeshStandardMaterial({ map: tex('./assets/ambientcg/Concrete034/Concrete034_Color.jpg', true), color: '#26202e', roughness: .5, metalness: .1, envMapIntensity: .35 }));
  puddles(paving, 'pave', 1, { wet: .3 });
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
    for (const [o1, o2] of [[half, wallOff + .3], [-half, quayR]]) quadStrip(pave, [A.x + A.nx * o1, 0, A.z + A.nz * o1], [A.x + A.nx * o2, 0, A.z + A.nz * o2], [B.x + B.nx * o1, 0, B.z + B.nz * o1], [B.x + B.nx * o2, 0, B.z + B.nz * o2], A.s / 3, B.s / 3, o1 / 3, o2 / 3); }
  const paveMesh = mk(pave, paving, 'paving'); paveMesh.receiveShadow = true; paveMesh.material.side = T.DoubleSide;
  // canal: one big reflective water plane under everything (seen past the fence, under the bridge and the gaps)
  const water = keep(new T.MeshStandardMaterial({ color: '#0b0816', roughness: .18, metalness: .2, envMapIntensity: .35 })); puddles(water, 'canal', 1, { wet: .6, flat: false, water: true });
  const wmesh = new T.Mesh(keep(new T.PlaneGeometry(3000, 3000)), water); wmesh.rotation.x = -Math.PI / 2; wmesh.position.set(500, NEON.water + .4, 350); wmesh.name = 'neon:canal'; group.add(wmesh);
  // canal floor walls under the paving edge (so the promenade reads as a quay)
  const quay = { pos: [], uv: [], idx: [] };
  for (let i = 0; i < N - 1; i += 2) { const A = frame(i), B = frame(Math.min(N - 1, i + 2)); if (neonInGap(A.s) || neonInGap(B.s)) continue; for (const o of [quayR, wallOff + .3]) quadStrip(quay, [A.x + A.nx * o, NEON.water, A.z + A.nz * o], [A.x + A.nx * o, 0, A.z + A.nz * o], [B.x + B.nx * o, NEON.water, B.z + B.nz * o], [B.x + B.nx * o, 0, B.z + B.nz * o], A.s / 3, B.s / 3, 0, 1); }
  const quayMesh = mk(quay, concrete, 'quay'); quayMesh.material.side = T.DoubleSide;
  // far bank across the canal: a paved quay where palms and low blocks stand (city lights reflect between)
  const farBank = { pos: [], uv: [], idx: [] }, nearFeat = s => (s > NEON_FEATURES.bridge[0] - 30 && s < NEON_FEATURES.bridge[1] + 30) || NEON_GAPS.some(([a, b]) => s > a - 25 && s < b + 25);
  for (let i = 0; i < N - 8; i += 8) { const A = frame(i), B = frame(i + 8); if (nearFeat(A.s) || nearFeat(B.s)) continue;
    quadStrip(farBank, [A.x + A.nx * -24, 0, A.z + A.nz * -24], [A.x + A.nx * -46, 0, A.z + A.nz * -46], [B.x + B.nx * -24, 0, B.z + B.nz * -24], [B.x + B.nx * -46, 0, B.z + B.nz * -46], A.s / 4, B.s / 4, 0, 6);
    quadStrip(farBank, [A.x + A.nx * -24, NEON.water, A.z + A.nz * -24], [A.x + A.nx * -24, 0, A.z + A.nz * -24], [B.x + B.nx * -24, NEON.water, B.z + B.nz * -24], [B.x + B.nx * -24, 0, B.z + B.nz * -24], A.s / 3, B.s / 3, 0, 1); }
  const farMesh = mk(farBank, paving, 'far-bank'); farMesh.material.side = T.DoubleSide;
  // ---- graffiti wall (left), lamps, wire on top ----
  const wallNrm = lowDetail ? null : tex('./assets/ambientcg/Concrete034/Concrete034_NormalGL.jpg', false, 2);
  const noWall = s => neonInGap(s) || (s > NEON_FEATURES.bridge[0] - 4 && s < NEON_FEATURES.bridge[1] + 4) || (s > NEON_FEATURES.rooftop[0] - 6 && s < NEON_FEATURES.rooftop[1] + 6);
  const graf = []; for (let k = 0; k < (lowDetail ? 4 : 8); k++) graf.push(keep(new T.MeshStandardMaterial({ map: keep(graffiti(T, k + 1)), normalMap: wallNrm, normalScale: new T.Vector2(.9, .9), roughness: .82, metalness: 0, envMapIntensity: .5 })));
  const panel = 7;
  const wallGeo = keep(new T.PlaneGeometry(panel + .45, wallH)); /* overlap so bends show no gaps */ const lampPos = [];
  for (let s = 0; s < NEON.len; s += panel) { if (noWall(s) || noWall(s + panel)) continue; const p = neonAt(s + panel / 2), c = Math.cos(p.yaw), n = Math.sin(p.yaw);
    const m = new T.Mesh(wallGeo, graf[(Math.round(s / panel) * 5 + (Math.round(s / panel / graf.length) % 3)) % graf.length] /* neighbours never repeat */); m.position.set(p.x + n * wallOff, wallH / 2, p.z - c * wallOff); m.rotation.y = -p.yaw; m.receiveShadow = true; m.name = 'neon:wall'; group.add(m);
    if (Math.round(s / panel) % 2 === 0) lampPos.push({ x: p.x + n * (wallOff - .35), z: p.z - c * (wallOff - .35), yaw: p.yaw }); }
  const housing = keep(new T.MeshStandardMaterial({ color: '#2a2630', roughness: .5, metalness: .6 }));
  // wall top: steel railing and a strand of barbed wire, like the picture
  { const railPts = [[], []]; for (let s2 = 0; s2 < NEON.len; s2 += 2) { if (noWall(s2)) { if (railPts[0].length > 1) { for (const k of [0, 1]) group.add(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(railPts[k]), Math.max(2, railPts[k].length * 2), k ? .02 : .04, 5)), housing)); } railPts[0] = []; railPts[1] = []; continue; }
      const p = neonAt(s2), n = Math.sin(p.yaw), c = Math.cos(p.yaw); railPts[0].push(new T.Vector3(p.x + n * wallOff, wallH + .9, p.z - c * wallOff)); railPts[1].push(new T.Vector3(p.x + n * (wallOff + .1), wallH + 1.25, p.z - c * (wallOff + .1))); }
    for (const k of [0, 1]) if (railPts[k].length > 1) group.add(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(railPts[k]), Math.max(2, railPts[k].length * 2), k ? .02 : .04, 5)), housing));
    const posts2 = []; for (let s2 = 0; s2 < NEON.len; s2 += 3.5) { if (noWall(s2)) continue; const p = neonAt(s2); posts2.push([p.x + Math.sin(p.yaw) * wallOff, p.z - Math.cos(p.yaw) * wallOff]); }
    const pi = new T.InstancedMesh(keep(new T.CylinderGeometry(.03, .03, 1.35, 5)), housing, posts2.length); posts2.forEach(([x, z], k) => { M.makeTranslation(x, wallH + .62, z); pi.setMatrixAt(k, M); }); pi.instanceMatrix.needsUpdate = true; pi.computeBoundingSphere(); group.add(pi); }
  // ivy and shrubs at the foot of the wall (Quaternius bushes), and a few on the canal side
  if (GLTFLoader) { const shrubs = []; const rr = rng(77); for (let s2 = 3; s2 < NEON.len; s2 += 3 + rr() * 6) { if (noWall(s2)) continue; const p = neonAt(s2), o = wallOff - .45 - rr() * .5; shrubs.push({ x: p.x + Math.sin(p.yaw) * o, z: p.z - Math.cos(p.yaw) * o, s: .45 + rr() * .55, r: rr() * TAU }); }
    /* canal side: behind the fence now, no shrubs */
    new GLTFLoader().loadAsync('./assets/quaternius/nature/Bush_Common.gltf').then(g => { g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (!o.isMesh) return; [].concat(o.material).forEach(mm => { mm.alphaTest = .45; mm.transparent = false; mm.side = T.DoubleSide; mm.color?.multiplyScalar(.6); keep(mm); }); keep(o.geometry);
      const inst = new T.InstancedMesh(o.geometry, o.material, shrubs.length); shrubs.forEach((b, k) => { Q.setFromAxisAngle(new T.Vector3(0, 1, 0), b.r); M.compose(V.set(b.x, 0, b.z), Q, S.set(b.s, b.s, b.s)).multiply(o.matrixWorld); inst.setMatrixAt(k, M); }); inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.name = 'neon:shrubs'; group.add(inst); }); }).catch(() => {}); }
  // trees behind the wall top (Quaternius leafy trees, dusk-tinted), like the picture's skyline of foliage
  if (GLTFLoader) { const tr = rng(31), trees = { CommonTree_3: [], CommonTree_5: [] };
    for (let s2 = 5; s2 < NEON.len; s2 += 7 + tr() * 9) { if (noWall(s2)) continue; const p = neonAt(s2), o = wallOff + 2.5 + tr() * 5; (tr() < .5 ? trees.CommonTree_3 : trees.CommonTree_5).push({ x: p.x + Math.sin(p.yaw) * o, z: p.z - Math.cos(p.yaw) * o, s: .9 + tr() * .5, r: tr() * TAU }); }
    for (const [name, list] of Object.entries(trees)) new GLTFLoader().loadAsync('./assets/quaternius/nature/' + name + '.gltf').then(g => { g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (!o.isMesh) return; [].concat(o.material).forEach(mm => { if (mm.alphaTest > 0 || mm.transparent) { mm.transparent = false; mm.alphaTest = .45; mm.side = T.DoubleSide; } mm.color?.multiplyScalar(.55); keep(mm); }); keep(o.geometry);
      const inst = new T.InstancedMesh(o.geometry, o.material, list.length); list.forEach((b, k) => { Q.setFromAxisAngle(new T.Vector3(0, 1, 0), b.r); M.compose(V.set(b.x, 0, b.z), Q, S.set(b.s, b.s, b.s)).multiply(o.matrixWorld); inst.setMatrixAt(k, M); }); S.set(1, 1, 1); inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.name = 'neon:trees'; group.add(inst); }); }).catch(() => {}); }
  // lamps: a little housing, a warm bulb, a light pool down the wall and on the ground (no real lights: cheap)
  const lampWarm = keep(new T.MeshBasicMaterial({ color: new T.Color('#ffcf8a').multiplyScalar(2), toneMapped: false }));
  const poolMat = keep(new T.MeshBasicMaterial({ map: glowTex, color: '#ffb46b', transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  // warm light cone washing down the wall from each flood lamp (bright at the lamp, fanning out and fading)
  const coneTex = keep(canvasTex(T, 128, 256, (g, w, h) => { const id = g.createImageData(w, h), d = id.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = y / h, half2 = .08 + t * .42, dx = Math.abs(x / w - .5); const side = Math.max(0, 1 - Math.pow(dx / half2, 2)), fall = Math.pow(1 - t, 1.6) * (t < .04 ? t / .04 : 1), v = side * fall + Math.exp(-((x / w - .5) ** 2 + (t * .6) ** 2) * 160) * .9; const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, v * 255); } g.putImageData(id, 0, 0); }));
  const lightConeMat = keep(new T.MeshBasicMaterial({ map: coneTex, color: new T.Color('#ffb066').multiplyScalar(1.7), transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const bulbGeo = keep(new T.BoxGeometry(.5, .14, .3)), poolGeo = keep(new T.PlaneGeometry(4.5, 4.5));
  const bulbs = new T.InstancedMesh(bulbGeo, lampWarm, lampPos.length), cases = new T.InstancedMesh(keep(new T.BoxGeometry(.6, .22, .4)), housing, lampPos.length), pools = new T.InstancedMesh(poolGeo, poolMat, lampPos.length), cones2 = new T.InstancedMesh(keep(new T.PlaneGeometry(5.2, 4.2)), lightConeMat, lampPos.length);
  lampPos.forEach((l, k) => { S.set(1, 1, 1); E.set(0, -l.yaw, 0); Q.setFromEuler(E); V.set(l.x, wallH - .45, l.z); M.compose(V, Q, S); cases.setMatrixAt(k, M); V.y -= .1; M.compose(V, Q, S); bulbs.setMatrixAt(k, M);
    E.set(0, -l.yaw, 0); Q.setFromEuler(E); V.set(l.x + Math.sin(l.yaw) * .33, wallH - .35 - 2.1, l.z - Math.cos(l.yaw) * .33); M.compose(V, Q, S.set(1, 1, 1)); cones2.setMatrixAt(k, M);
    E.set(-Math.PI / 2, 0, 0); Q.setFromEuler(E); V.set(l.x - Math.sin(l.yaw) * 1.4, .03, l.z + Math.cos(l.yaw) * 1.4); M.compose(V, Q, S.set(1.1, 1.1, 1)); pools.setMatrixAt(k, M); });
  for (const m of [bulbs, cases, pools, cones2]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); group.add(m); } pools.renderOrder = 2; cones2.renderOrder = 2; bulbs.name = 'neon:lamps';
  // ---- chain-link fence along the canal side ----
  const fenceTex = keep(canvasTex(T, 128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(190,190,205,.95)'; g.lineWidth = 3; for (let k = -128; k < 256; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 128, 128); g.stroke(); g.beginPath(); g.moveTo(k + 128, 0); g.lineTo(k, 128); g.stroke(); } }, { repeat: true }));
  const fenceMat = keep(new T.MeshStandardMaterial({ map: fenceTex, transparent: true, alphaTest: .35, side: T.DoubleSide, color: '#77728a', metalness: .35, roughness: .45 }));
  const fence = { pos: [], uv: [], idx: [] }, parapet = { pos: [], uv: [], idx: [] }, fenceH = 2.1, postPos = [], railTop = [], railRuns = [];
  for (let i = 0; i < N - 1; i += 4) { const A = frame(i), B = frame(Math.min(N - 1, i + 4)); if (neonInGap(A.s) || neonInGap(B.s) || (A.s > NEON_FEATURES.bridge[0] - 2 && A.s < NEON_FEATURES.bridge[1] + 2)) { if (railTop.length > 1) railRuns.push(railTop.splice(0)); else railTop.length = 0; continue; }
    const pH = .5, f0 = fenceOff + .18, f1 = fenceOff - .18;
    quadStrip(fence, [A.x + A.nx * fenceOff, pH, A.z + A.nz * fenceOff], [A.x + A.nx * fenceOff, pH + fenceH, A.z + A.nz * fenceOff], [B.x + B.nx * fenceOff, pH, B.z + B.nz * fenceOff], [B.x + B.nx * fenceOff, pH + fenceH, B.z + B.nz * fenceOff], A.s / 1.2, B.s / 1.2, 0, fenceH / 1.2);
    quadStrip(parapet, [A.x + A.nx * f0, 0, A.z + A.nz * f0], [A.x + A.nx * f0, pH, A.z + A.nz * f0], [B.x + B.nx * f0, 0, B.z + B.nz * f0], [B.x + B.nx * f0, pH, B.z + B.nz * f0], A.s / 3, B.s / 3, 0, pH / 3);
    quadStrip(parapet, [A.x + A.nx * f0, pH, A.z + A.nz * f0], [A.x + A.nx * f1, pH, A.z + A.nz * f1], [B.x + B.nx * f0, pH, B.z + B.nz * f0], [B.x + B.nx * f1, pH, B.z + B.nz * f1], A.s / 3, B.s / 3, 0, .12);
    railTop.push(new T.Vector3(A.x + A.nx * fenceOff, pH + fenceH, A.z + A.nz * fenceOff));
    if (i % 8 === 0) postPos.push([A.x + A.nx * fenceOff, A.z + A.nz * fenceOff]); }
  const fenceMesh = mk(fence, fenceMat, 'fence'); if (railTop.length > 1) railRuns.push(railTop.splice(0));
  const parapetMesh = mk(parapet, concrete, 'parapet'); parapetMesh.receiveShadow = true;
  const railTopG = new T.Group(); group.add(railTopG); for (const run of railRuns) railTopG.add(new T.Mesh(keep(new T.TubeGeometry(new T.CatmullRomCurve3(run), Math.max(2, run.length), .035, 5)), housing));
  const posts = new T.InstancedMesh(keep(new T.CylinderGeometry(.05, .05, fenceH + .1, 6)), housing, postPos.length); postPos.forEach(([x, z], k) => { M.makeTranslation(x, .5 + fenceH / 2, z); posts.setMatrixAt(k, M); }); posts.instanceMatrix.needsUpdate = true; posts.computeBoundingSphere(); group.add(posts);
  // ---- boost chevrons on the line (glowing ^^ arrows) + chevron signs on the wall ----
  const chevTex = keep(canvasTex(T, 256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.lineWidth = 34; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#ffffff'; for (const y of [80, 170]) { g.beginPath(); g.moveTo(40, y + 50); g.lineTo(128, y - 30); g.lineTo(216, y + 50); g.stroke(); } }));
  const chevMat = keep(new T.MeshBasicMaterial({ map: chevTex, color: new T.Color('#f1e4ff').multiplyScalar(.9), transparent: true, depthWrite: false, toneMapped: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }));
  const chev = []; for (const [a, b] of NEON_BOOSTS) for (let s = a + 1; s < b; s += 3.2) chev.push(s);
  const chevI = new T.InstancedMesh(keep(new T.PlaneGeometry(2.2, 2.2)), chevMat, chev.length);
  chev.forEach((s, k) => { const p = neonAt(s), h0 = neonProfile(s - .6), h1 = neonProfile(s + .6), pitch = Math.atan2(h1 - h0, 1.2); E.set(-Math.PI / 2 + pitch * 0, 0, 0); const q1 = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -p.yaw - Math.PI / 2), q2 = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2 + pitch); Q.copy(q1).multiply(q2); V.set(p.x, neonProfile(s) + .04, p.z); M.compose(V, Q, S.set(1, 1, 1)); chevI.setMatrixAt(k, M); });
  mirror?.hide.push(roadMesh, paveMesh, farMesh, wmesh, gm, pools, chevI);
  chevI.instanceMatrix.needsUpdate = true; chevI.computeBoundingSphere(); chevI.renderOrder = 3; chevI.name = 'neon:boost-chevrons'; group.add(chevI);
  const signTex = keep(canvasTex(T, 512, 192, (g, w, h) => { g.clearRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round'; const ch = (lw, col, blur) => { g.lineWidth = lw; g.strokeStyle = col; g.shadowColor = '#b04dff'; g.shadowBlur = blur; for (const x of [80, 210, 340]) { g.beginPath(); g.moveTo(x, 36); g.lineTo(x + 78, 96); g.lineTo(x, 156); g.stroke(); } }; ch(34, 'rgba(150,60,255,.55)', 30); ch(22, '#c77dff', 18); ch(8, '#ffffff', 6); }));
  const signMat = keep(new T.MeshBasicMaterial({ map: signTex, color: new T.Color('#ffffff').multiplyScalar(1.15), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide }));
  const signGeo = keep(new T.PlaneGeometry(3.8, 1.42));
  // purple >>> signs along the outside of raised sections (bridge, mega ramp, rooftop), seen from the side view
  for (let s2 = 0; s2 < NEON.len; s2 += 9) { const h = neonProfile(s2); if (h < 2.6 || neonInGap(s2)) continue; const p = neonAt(s2), m = new T.Mesh(signGeo, signMat); m.position.set(p.x - Math.sin(p.yaw) * (half + .04), h - .78, p.z + Math.cos(p.yaw) * (half + .04)); m.rotation.y = -p.yaw; m.renderOrder = 3; m.name = 'neon:side-chevrons'; /* double-sided: from the canal side it reads >>> in the riding direction */ group.add(m); }
  for (const s of [...NEON_FEATURES.chevrons, ...Array.from({ length: 26 }, (_, k) => 30 + k * 63)]) { if (noWall(s) || neonProfile(s) > 1) continue; const p = neonAt(s), c = Math.cos(p.yaw), n = Math.sin(p.yaw), m = new T.Mesh(signGeo, signMat); m.position.set(p.x + n * (wallOff - .06), 1.55, p.z - c * (wallOff - .06)); m.rotation.y = -p.yaw; m.renderOrder = 3; m.name = 'neon:chevron-sign'; group.add(m); }
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
  [[150, 3], [452, 2], [655, 4], [990, 0], [1240, 1], [1600, 3], [380, 1], [720, 2], [1380, 4]].forEach(([s, c], k) => { if (noWall(s)) return; contAt(s, contCols[c], wallH - 1.6, wallOff + 4.2); if (k % 2) contAt(s + 1.5, contCols[(c + 2) % 5], wallH + 1, wallOff + 4.2); });
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
  for (const s of NEON_FEATURES.cones) for (let k = 0; k < 3; k++) { const p = neonAt(s + k * 1.2), o = (r() < .5 ? 1 : -1) * (half + .4 + r() * .45); cones.push([p.x + Math.sin(p.yaw) * o, p.z - Math.cos(p.yaw) * o]); }
  for (let s = 40; s < NEON.len; s += 55 + r() * 40) { const p = neonAt(s), o = half + .8 + r() * .7; barrels.push([p.x + Math.sin(p.yaw) * o, p.z - Math.cos(p.yaw) * o]); }
  { const p = neonAt(76); for (let k = -1; k <= 1; k++) barrels.push([p.x + Math.sin(p.yaw) * k * 1.2 + Math.cos(p.yaw) * 9, p.z - Math.cos(p.yaw) * k * 1.2 + Math.sin(p.yaw) * 9]); }
  const coneI = new T.InstancedMesh(coneGeo, coneMat, cones.length); cones.forEach(([x, z], k) => { M.makeTranslation(x, .35, z); coneI.setMatrixAt(k, M); });
  const barI = new T.InstancedMesh(barrelGeo, barrelMat, barrels.length); barrels.forEach(([x, z], k) => { M.makeTranslation(x, .45, z); barI.setMatrixAt(k, M); });
  for (const m of [coneI, barI]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.castShadow = !lowDetail; group.add(m); }
  // ---- palms (procedural): curved trunk + drooping fronds ----
  const frondTex = keep(canvasTex(T, 128, 512, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#2f5a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); for (let y = 10; y < h; y += 9) { const l = (w / 2 - 4) * Math.sin(Math.PI * y / h); g.strokeStyle = y % 18 ? '#3f7d33' : '#356b2c'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - l, y + 26); g.moveTo(w / 2, y); g.lineTo(w / 2 + l, y + 26); g.stroke(); } }));
  const frondMat = keep(new T.MeshStandardMaterial({ map: frondTex, alphaTest: .4, side: T.DoubleSide, roughness: .8 })), trunkMat = keep(new T.MeshStandardMaterial({ color: '#6b5440', roughness: .95 }));
  const frondGeo = keep(new T.PlaneGeometry(1.5, 5.4, 1, 8)); { const pa = frondGeo.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) + 2.7, t = y / 5.4; pa.setY(i, y * .9 - t * t * 1.6); pa.setZ(i, Math.abs(pa.getX(i)) * -.25); } frondGeo.translate(0, 0, 0); frondGeo.rotateX(Math.PI / 2); frondGeo.computeVertexNormals(); }
  const palms = []; const pr = rng(9);
  for (let s = 20; s < NEON.len; s += 22 + pr() * 30) { if (neonInGap(s)) continue; const p = neonAt(s), side = pr() < .55 ? -1 : 1, o = side > 0 ? wallOff + 2 + pr() * 6 : -(26 + pr() * 9); /* canal-side palms stand behind the side-view camera */ palms.push({ x: p.x + Math.sin(p.yaw) * o, z: p.z - Math.cos(p.yaw) * o, h: 7 + pr() * 6, lean: (pr() - .5) * .5, rot: pr() * TAU, y0: side > 0 ? 0 : 0 }); }
  const trunkGeoCache = new Map();
  const nPalms = lowDetail ? Math.ceil(palms.length / 2) : palms.length, frondI = new T.InstancedMesh(frondGeo, frondMat, nPalms * 12);
  palms.slice(0, nPalms).forEach((pm, k) => { const pts = []; for (let t = 0; t <= 1.001; t += .25) pts.push(new T.Vector3(Math.sin(pm.lean) * pm.h * t * t * .5, pm.h * t, 0));
    const g = keep(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 10, .22, 7)); const trunk = new T.Mesh(g, trunkMat); trunk.position.set(pm.x, pm.y0, pm.z); trunk.rotation.y = pm.rot; trunk.castShadow = !lowDetail; group.add(trunk);
    const top = pts[pts.length - 1].clone().applyAxisAngle(new T.Vector3(0, 1, 0), pm.rot).add(new T.Vector3(pm.x, pm.y0, pm.z));
    for (let f = 0; f < 12; f++) { E.set(0, f * TAU / 12 + pm.rot, 0, 'YXZ'); Q.setFromEuler(E); const tilt = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -.35 + (f % 3) * .18); Q.multiply(tilt); M.compose(top, Q, S.set(1, 1, 1)); frondI.setMatrixAt(k * 12 + f, M); } });
  frondI.instanceMatrix.needsUpdate = true; frondI.computeBoundingSphere(); frondI.castShadow = !lowDetail; group.add(frondI);
  // ---- skyline ----
  const winTex = keep(canvasTex(T, 128, 256, (g, w, h) => { g.fillStyle = '#1b1830'; g.fillRect(0, 0, w, h); const rr = rng(3); for (let y = 6; y < h; y += 12) for (let x = 6; x < w; x += 12) { const lit = rr(); g.fillStyle = lit > .72 ? (rr() < .7 ? '#ffd38a' : '#9fe7ff') : lit > .55 ? '#3a3560' : '#24203c'; g.fillRect(x, y, 7, 8); } }, { repeat: true }));
  const winMat = keep(new T.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: new T.Color('#ffffff'), emissiveIntensity: 1.1, color: '#262038', roughness: .7, metalness: .2, envMapIntensity: .4 }));
  const boxGeo = keep(new T.BoxGeometry(1, 1, 1)); const sk = []; const sr = rng(21);
  const cx = 500, cz = 340;
  for (let k = 0; k < (lowDetail ? 70 : 150); k++) { const a = sr() * TAU, d = 720 + sr() * 380, w = 25 + sr() * 45, h = 40 + Math.pow(sr(), 1.6) * 170; sk.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, w, d2: 20 + sr() * 40, h, rot: sr() * TAU }); }
  const skyI = new T.InstancedMesh(boxGeo, winMat, sk.length); sk.forEach((b, k) => { E.set(0, b.rot, 0); Q.setFromEuler(E); M.compose(V.set(b.x, b.h / 2 - 2, b.z), Q, S.set(b.w, b.h, b.d2)); skyI.setMatrixAt(k, M); }); skyI.instanceMatrix.needsUpdate = true; skyI.computeBoundingSphere(); skyI.name = 'neon:skyline'; group.add(skyI);
  // nearer low-rise blocks across the canal (opposite bank), dark with lit windows
  const near = []; for (let s = 0; s < NEON.len; s += 26 + sr() * 18) { const p = neonAt(s), o = -(40 + sr() * 30); near.push({ x: p.x + Math.sin(p.yaw) * o, z: p.z - Math.cos(p.yaw) * o, w: 14 + sr() * 14, h: 5 + sr() * 12, rot: -p.yaw }); }
  const nearI = new T.InstancedMesh(boxGeo, winMat, near.length); near.forEach((b, k) => { E.set(0, b.rot, 0); Q.setFromEuler(E); M.compose(V.set(b.x, b.h / 2 - 3, b.z), Q, S.set(b.w, b.h, 12)); nearI.setMatrixAt(k, M); }); nearI.instanceMatrix.needsUpdate = true; nearI.computeBoundingSphere(); group.add(nearI);
  // behind the graffiti wall: warehouses
  const wh = []; for (let s = 0; s < NEON.len; s += 30 + sr() * 15) { const p = neonAt(s), o = wallOff + 12 + sr() * 8; wh.push({ x: p.x + Math.sin(p.yaw) * o, z: p.z - Math.cos(p.yaw) * o, w: 18 + sr() * 12, h: 8 + sr() * 9, rot: -p.yaw }); }
  const whI = new T.InstancedMesh(boxGeo, winMat, wh.length); wh.forEach((b, k) => { E.set(0, b.rot, 0); Q.setFromEuler(E); M.compose(V.set(b.x, b.h / 2, b.z), Q, S.set(b.w, b.h, 14)); whI.setMatrixAt(k, M); }); whI.instanceMatrix.needsUpdate = true; whI.computeBoundingSphere(); group.add(whI);
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
  const coinMat = keep(new T.MeshStandardMaterial({ color: '#ffc93c', emissive: '#ff9a1a', emissiveIntensity: .5, metalness: .85, roughness: .25 }));
  const coinGeo = keep(new T.CylinderGeometry(.42, .42, .09, 20)); coinGeo.rotateX(Math.PI / 2);
  const coins = new T.InstancedMesh(coinGeo, coinMat, NEON_COINS.length); coins.name = 'neon:coins'; coins.frustumCulled = false; group.add(coins);
  const taken = new Uint8Array(NEON_COINS.length); let spin = 0;
  const placeCoins = () => { NEON_COINS.forEach((c, k) => { if (taken[k]) { M.makeScale(0, 0, 0); } else { E.set(0, spin + c.s * .2, 0); Q.setFromEuler(E); M.compose(V.set(c.x, c.y + Math.sin(spin * 2 + k) * .06, c.z), Q, S.set(1, 1, 1)); } coins.setMatrixAt(k, M); }); coins.instanceMatrix.needsUpdate = true; };
  placeCoins();
  return {
    group,
    update(dt) { spin += dt * 2.6; placeCoins(); if (mirror) mirror.U.wkTime.value += dt; },
    // call just before the frame is drawn (medium/high): refreshes the wet-ground mirror
    beforeRender(R, scene, cam, scale = .4) { if (mirror) mirror.render(R, scene, cam, scale); },
    reflecting: () => !!mirror,
    // side view looks across from the canal side: the fence would sit between the camera and the bike
    setView(blend) { const v = blend < .5; fenceMesh.visible = v; posts.visible = v; parapetMesh.visible = v; railTopG.visible = v; },
    takeCoin(k) { if (taken[k]) return false; taken[k] = 1; return true; },
    resetCoins() { taken.fill(0); },
    coinsTaken: () => taken.reduce((a, b) => a + b, 0),
    state: () => ({ neon: true, len: NEON.len, coins: NEON_COINS.length, lamps: lampPos.length, palms: nPalms }),
    dispose() { res.forEach(o => o.dispose?.()); group.removeFromParent(); },
  };
}
