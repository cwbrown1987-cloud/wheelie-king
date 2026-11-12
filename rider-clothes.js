// Wearable rider clothes for the Playground rider (Quaternius UBC, rider-ubc.js) and the store preview.
// Garments are reusable base models (assets/clothing/base/<base>.glb, baked by tools/clothes-lab/bake.html
// from the rider's own body, see tools/clothes-lab/garment-bake.js and assets/clothing/base/README.md), skinned to the
// same 65-bone skeleton so they follow every IK pose. A clothing item is data (clothing-catalogue.js): a
// base + a look. The look is painted onto the base's UV template on a canvas (fabric, ribbing, wordmarks,
// pocket) or loaded from a PNG. Body triangles fully under a garment are hidden so skin never pokes
// through. Hem, hood and strings flutter with speed in the vertex shader (no cloth sim; phone friendly).
import { CLOTHING_BASES, clothingById } from './clothing-catalogue.js';
const BASE_URL = new URL('./assets/clothing/base/', import.meta.url).href;
let gearVersion = 0;
if (typeof addEventListener === 'function') addEventListener('wk-gear-change', () => { gearVersion++; });
export const clothesGearVersion = () => gearVersion;

// ---------------------------------------------------------------- base model loading (shared, cached)
const fileCache = new Map();
function loadBase(name) {
  const file = name === 'hood_up' ? 'hood_up.glb' : CLOTHING_BASES[name]?.file;
  if (!file) return Promise.reject(Error('unknown garment base ' + name));
  if (!fileCache.has(file)) fileCache.set(file, (async () => {
    const { GLTFLoader } = await import('./vendor/GLTFLoader.js');
    const r = await fetch(BASE_URL + file); if (!r.ok) throw Error('garment ' + file + ' ' + r.status);
    const g = await new GLTFLoader().parseAsync(await r.arrayBuffer(), BASE_URL);
    const meshes = []; g.scene.traverse(o => { if (o.isSkinnedMesh && o.userData.wkClothing) meshes.push(o); });
    return meshes.map(m => ({ role: m.userData.wkClothing.role, meta: m.userData.wkClothing, geo: m.geometry, boneNames: m.skeleton.bones.map(b => b.name) }));
  })());
  return fileCache.get(file);
}

// ---------------------------------------------------------------- canvas art
const hex = (c, k = 1) => { const n = parseInt(c.slice(1), 16); return [((n >> 16) & 255) / 255 * k, ((n >> 8) & 255) / 255 * k, (n & 255) / 255 * k]; };
const shade = (c, k) => { const [r, g, b] = hex(c).map(v => Math.max(0, Math.min(1, v * k + (k > 1 ? (k - 1) * 0.08 : 0)))); return `rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0})`; };
const makeCanvas = (w, h) => { if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// HOODRICH wordmark: condensed block capitals with the blade notches on the stems, drawn as paths so it
// looks the same on every device (no font dependency). Returns a transparent canvas, aspect ~5.6:1.
const markCache = new Map();
export function wordmark(color, H = 160) {
  const key = color + H; if (markCache.has(key)) return markCache.get(key);
  const s = 0.165, w = 0.56, gap = 0.075, letters = 'HOODRICH';
  const widths = { H: w, O: w, D: w, R: w, I: s, C: w * 0.94 };
  const total = [...letters].reduce((a, l) => a + widths[l] + gap, 0) + 0.32;
  const c = makeCanvas(Math.ceil(total * H) + 8, H + 8), x = c.getContext('2d');
  x.translate(4, 4); x.scale(H, H); x.fillStyle = color;
  const rr = (X, Y, W, Hh, r) => { x.roundRect ? x.roundRect(X, Y, W, Hh, r) : x.rect(X, Y, W, Hh); };
  const notch = (X, side) => { x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); const y = 0.5; if (side < 0) { x.moveTo(X - 0.01, y - 0.05); x.lineTo(X + 0.05, y); x.lineTo(X - 0.01, y + 0.05); } else { x.moveTo(X + 0.01, y - 0.05); x.lineTo(X - 0.05, y); x.lineTo(X + 0.01, y + 0.05); } x.fill(); x.restore(); };
  let X = 0;
  for (const l of letters) {
    const W = widths[l]; x.beginPath();
    if (l === 'H') { x.rect(X, 0, s, 1); x.rect(X + W - s, 0, s, 1); x.rect(X, 0.42, W, 0.16); x.fill(); notch(X, -1); notch(X + W, 1); }
    else if (l === 'O') { rr(X, 0, W, 1, 0.2); rr(X + s, 0.17, W - 2 * s, 0.66, 0.06); x.fill('evenodd'); notch(X, -1); notch(X + W, 1); }
    else if (l === 'D') { rr(X, 0, W, 1, [0, 0.22, 0.22, 0]); rr(X + s, 0.17, W - 2 * s, 0.66, [0, 0.07, 0.07, 0]); x.fill('evenodd'); notch(X, -1); }
    else if (l === 'R') { rr(X, 0, W, 0.6, [0, 0.2, 0.2, 0]); rr(X + s, 0.16, W - 2 * s, 0.28, [0, 0.06, 0.06, 0]); x.fill('evenodd'); x.beginPath(); x.rect(X, 0.4, s, 0.6); x.moveTo(X + W * 0.36, 0.52); x.lineTo(X + W * 0.36 + s * 1.05, 0.52); x.lineTo(X + W, 1); x.lineTo(X + W - s * 1.1, 1); x.closePath(); x.fill(); notch(X, -1); }
    else if (l === 'I') { x.rect(X, 0, s, 1); x.fill(); notch(X, -1); notch(X + s, 1); }
    else if (l === 'C') { rr(X, 0, W, 1, 0.22); rr(X + s, 0.17, W - 2 * s, 0.66, 0.06); x.fill('evenodd'); x.save(); x.globalCompositeOperation = 'destination-out'; x.fillRect(X + W * 0.55, 0.36, W, 0.28); x.restore(); notch(X, -1); }
    X += W + gap;
  }
  // ® mark
  x.lineWidth = 0.035; x.strokeStyle = color; x.beginPath(); x.arc(X + 0.1, 0.88, 0.1, 0, Math.PI * 2); x.stroke();
  x.font = 'bold 0.13px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('R', X + 0.1, 0.885);
  const out = { canvas: c, aspect: c.width / c.height };
  markCache.set(key, out); return out;
}

// draw helper: put a rect given in body metres (front or back) onto the garment canvas
function painter(ctx, S, box) {
  const [x0, y0, x1, y1] = box, sx = S / (x1 - x0), sy = S * 0.5 / (y1 - y0);
  return {
    toPx(x, y, back) { return [back ? (x1 - x) * sx : (x - x0) * sx, back ? S - (y - y0) * sy : S * 0.5 - (y - y0) * sy]; },
    sx, sy,
    image(img, cx, cy, wM, back) { const hM = wM / img.aspect, [px, py] = this.toPx(cx, cy, back); ctx.drawImage(img.canvas, px - wM * sx / 2, py - hM * sy / 2, wM * sx, hM * sy); },
    poly(pts, back) { ctx.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = this.toPx(x, y, back); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); },
  };
}
function fleece(ctx, S, base, amount = 9000) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < amount; i++) { ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; ctx.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2); }
}

// ---------------------------------------------------------------- texture painting from a look
function markImage(m) {
  if (m.font === 'hoodrich') return wordmark(m.color, 200);
  const key = m.text + m.font + m.color; if (markCache.has(key)) return markCache.get(key);
  const H = 160, probe = makeCanvas(8, 8).getContext('2d'); const font = (m.font || '900 1px system-ui').replace(/(^|\s)1px/, '$1' + H + 'px');
  probe.font = font; const w = Math.ceil(probe.measureText(m.text).width) + 16;
  const c = makeCanvas(w, H + 30), x = c.getContext('2d'); x.font = font; x.fillStyle = m.color; x.textBaseline = 'middle'; x.fillText(m.text, 8, (H + 30) / 2);
  const out = { canvas: c, aspect: c.width / c.height }; markCache.set(key, out); return out;
}
const texCache = new Map();
const isCoarse = () => typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
function lookTexture(T, item, meta) {
  const look = item.look, key = item.id;
  if (texCache.has(key)) return texCache.get(key);
  let tex;
  if (look.texture) { tex = new T.TextureLoader().load(look.texture); tex.colorSpace = T.SRGBColorSpace; }
  else {
    const top = ['hoodie', 'jumper', 'tshirt'].includes(item.base), S = top && !isCoarse() ? 2048 : 1024;
    const cv = makeCanvas(S, S), ctx = cv.getContext('2d'), box = meta.uvBox, p = painter(ctx, S, box), A = meta.anchors || {};
    if (item.base === 'trainers') paintTrainers(ctx, S, look);
    else {
      fleece(ctx, S, look.base, S * 9);
      const line = (x0, y0, x1, y1, back) => { const [a, b] = p.toPx(x0, y0, back), [c, d] = p.toPx(x1, y1, back); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
      const lw = Math.max(1, S / 512);
      for (const back of [0, 1]) {
        ctx.strokeStyle = shade(look.base, 0.8); ctx.lineWidth = lw;
        if (meta.hemY && top) { for (let x = -0.3; x <= 0.3; x += 0.0065) line(x, meta.hemY - 0.02, x, meta.hemY + 0.058, back); }
        if (meta.cuffX && meta.cuffX > 0.6) for (const sd of [-1, 1]) for (let y = 1.32; y <= 1.6; y += 0.0065) line(sd * (meta.cuffX + 0.02), y, sd * (meta.cuffX - 0.07), y, back);
        if (item.base === 'joggers') for (const sd of [-1, 1]) for (let x = -0.1; x <= 0.1; x += 0.0065) line(sd * 0.114 + x, meta.ankleY - 0.01, sd * 0.114 + x, meta.ankleY + 0.07, back);
        ctx.strokeStyle = shade(look.base, 0.68); ctx.lineWidth = lw * 1.5;
        if (meta.hemY && top) line(-0.3, meta.hemY + 0.058, 0.3, meta.hemY + 0.058, back);
        if (meta.cuffX && meta.cuffX > 0.6) for (const sd of [-1, 1]) line(sd * (meta.cuffX - 0.07), 1.3, sd * (meta.cuffX - 0.07), 1.62, back);
        if (item.base === 'joggers') line(-0.3, meta.ankleY + 0.07, 0.3, meta.ankleY + 0.07, back);
        if (item.base === 'tshirt') for (const sd of [-1, 1]) line(sd * (meta.cuffX - 0.025), 1.3, sd * (meta.cuffX - 0.025), 1.62, back); // sleeve hem stitch
      }
      if (look.pocket) {
        const y0 = (meta.hemY || 0.875) + 0.06, pk = [[-0.15, 0.985], [-0.112, 1.1], [0.112, 1.1], [0.15, 0.985]];
        ctx.fillStyle = shade(look.base, 0.93); p.poly([...pk, [0.15, y0], [-0.15, y0]], 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = shade(look.base, 1.35); ctx.lineWidth = Math.max(1.5, S / 420); ctx.setLineDash([S / 180, S / 260]); p.poly(pk, 0); ctx.stroke();
        ctx.setLineDash([]); ctx.strokeStyle = shade(look.base, 0.6); p.poly(pk, 0); ctx.stroke();
      }
      for (const m of look.marks || []) { const a = A[m.at]; if (!a) continue; p.image(markImage(m), a[0] + (m.x || 0), a[1] + (m.y || 0), m.width || 0.2, m.at === 'back' ? 1 : 0); }
    }
    tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  }
  texCache.set(key, tex); return tex;
}
// trainers UV: u = heel->toe, v = height; outer side on the top half, inner side on the bottom half
function paintTrainers(ctx, S, l) {
  const B = [-0.15, -0.025, 0.215, 0.145], px = (z, y, inner) => [(z - B[0]) / (B[2] - B[0]) * S, inner ? S - (y - B[1]) / (B[3] - B[1]) * S * 0.5 : S * 0.5 - (y - B[1]) / (B[3] - B[1]) * S * 0.5];
  ctx.fillStyle = l.upper; ctx.fillRect(0, 0, S, S);
  for (const inner of [0, 1]) {
    const band = (y0, y1, col) => { const [, a] = px(0, y1, inner), [, b] = px(0, y0, inner); ctx.fillStyle = col; ctx.fillRect(0, a, S, b - a); };
    band(-0.03, 0.006, l.sole); band(0.006, 0.011, l.line);
    const poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([z, y], i) => { const [a, b] = px(z, y, inner); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); ctx.fill(); };
    poly([[0.14, 0.011], [0.22, 0.011], [0.22, 0.035], [0.16, 0.032]], l.accent);        // toe cap
    poly([[-0.16, 0.011], [-0.095, 0.011], [-0.105, 0.1], [-0.16, 0.11]], l.accent);     // heel counter
    if (l.stripe && !inner) poly([[-0.075, 0.032], [0.06, 0.024], [0.09, 0.03], [-0.07, 0.052]], l.stripe); // side stripe
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = S / 400; ctx.setLineDash([S / 140, S / 200]);
    ctx.beginPath(); { const [a, b] = px(-0.1, 0.016, inner), [c] = px(0.2, 0.016, inner); ctx.moveTo(a, b); ctx.lineTo(c, b); } ctx.stroke(); ctx.setLineDash([]);
  }
}

// flutter: bind-space sway toward the rider's back (-Z), scaled by speed; zero cost when standing still
const windUniforms = new Map();
function clothMaterial(T, opts, uniforms) {
  const m = new T.MeshStandardMaterial({ roughness: 0.93, metalness: 0, side: T.DoubleSide, ...opts });
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = uniforms.uWind; sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float flap;\nuniform float uWind;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      { float f = flap * uWind; if (f > 0.0) { float ph = uTime * 15.0 + position.x * 23.0 + position.y * 9.0;
        transformed += vec3(sin(ph) * 0.006, 0.010 + 0.006 * sin(ph * 1.3), -0.035 - 0.012 * sin(ph * 0.7)) * f; } }`);
  };
  m.customProgramCacheKey = () => 'wk-cloth-v1';
  return m;
}
void windUniforms;

// ---------------------------------------------------------------- per-rider dresser
// model = loaded UBC scene. wear(outfit, style) with outfit = gear-state outfit() ({ top, pants, shoes } items)
// and style = { hoodUp }. Loads the needed base GLBs (cached), then swaps garments in one go.
export function dressUbc(T, model) {
  let body = null; model.traverse(o => { if (o.isSkinnedMesh && (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = o; });
  if (!body) return null;
  const bodyIndex = (body.geometry.index ? body.geometry.index.array : Uint32Array.from({ length: body.geometry.attributes.position.count }, (_, i) => i)).slice();
  // weld body vertices by position so a covered vertex also covers its UV-seam twins
  const P = body.geometry.attributes.position, weld = new Int32Array(P.count), keys = new Map();
  for (let i = 0; i < P.count; i++) { const k = Math.round(P.getX(i) * 2e4) + ',' + Math.round(P.getY(i) * 2e4) + ',' + Math.round(P.getZ(i) * 2e4); let w = keys.get(k); if (w == null) keys.set(k, w = i); weld[i] = w; }
  const boneIndex = new Map(body.skeleton.bones.map((b, i) => [b.name, i]));
  const uniforms = { uWind: { value: 0 }, uTime: { value: 0 } };
  const built = new Map(); let worn = [], key = '', pending = 0, stats = { slots: [], loading: false }, error = null;
  function instance(item, parts, hoodUp) {
    const k = item.id + (hoodUp ? ':up' : ''); if (built.has(k)) return built.get(k);
    const meshes = [], covers = new Set(), mainMeta = parts.find(p => p.role === 'body')?.meta || parts[0].meta;
    const tex = lookTexture(T, item, mainMeta);
    for (const p of parts) {
      if (p.role === 'hood' && (p.meta.base === 'hoodie') === hoodUp) continue; // hood down piece only when the hood is down
      const geo = p.geo.clone();
      if (geo.attributes._flap) { geo.setAttribute('flap', geo.attributes._flap); geo.deleteAttribute('_flap'); }
      if (!geo.attributes.flap) geo.setAttribute('flap', new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
      // remap joints from the GLB's own bone order onto this rider's skeleton (by name)
      const si = geo.attributes.skinIndex; for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) { const g = ['getX', 'getY', 'getZ', 'getW'][c], s = ['setX', 'setY', 'setZ', 'setW'][c]; si[s](i, boneIndex.get(p.boneNames[si[g](i)]) ?? 0); }
      const solid = p.role === 'hood' ? (item.look.hood || item.look.base) : p.role === 'strings' ? (item.look.string || '#111111') : null;
      const mat = solid ? clothMaterial(T, { color: solid, roughness: p.role === 'strings' ? 0.7 : 0.95, vertexColors: !!geo.attributes.color }, uniforms)
        : item.base === 'trainers' ? new T.MeshStandardMaterial({ map: tex, vertexColors: !!geo.attributes.color, roughness: 0.55, metalness: 0, side: T.DoubleSide })
        : clothMaterial(T, { map: tex, vertexColors: !!geo.attributes.color }, uniforms);
      const m = new T.SkinnedMesh(geo, mat); m.name = 'clothes:' + item.base + ':' + p.role; m.castShadow = true; m.frustumCulled = false; m.userData.wkClothes = item.id;
      meshes.push(m); for (const v of p.meta.covers || []) covers.add(weld[v] ?? v);
    }
    const out = { item, meshes, covers }; built.set(k, out); return out;
  }
  function apply(list) {
    for (const g of worn) for (const m of g.meshes) m.removeFromParent();
    worn = list; const covered = new Set();
    for (const g of list) { for (const m of g.meshes) { body.parent.add(m); m.position.copy(body.position); m.quaternion.copy(body.quaternion); m.scale.copy(body.scale); m.bind(body.skeleton, body.bindMatrix); } for (const v of g.covers) covered.add(v); }
    const keep = []; for (let t = 0; t < bodyIndex.length; t += 3) { const a = bodyIndex[t], b = bodyIndex[t + 1], c = bodyIndex[t + 2]; if (!(covered.has(weld[a]) && covered.has(weld[b]) && covered.has(weld[c]))) keep.push(a, b, c); }
    body.geometry.setIndex(keep);
    stats = { slots: list.map(g => CLOTHING_BASES[g.item.base].slot), ids: list.map(g => g.item.id), bases: list.map(g => g.item.base), meshes: list.flatMap(g => g.meshes.map(m => m.name)),
      bodyTris: keep.length / 3, bodyTrisFull: bodyIndex.length / 3, clothTris: list.reduce((a, g) => a + g.meshes.reduce((b, m) => b + m.geometry.index.count / 3, 0), 0), loading: false };
  }
  const api = {
    wear(outfit = {}, style = {}) {
      const items = ['top', 'pants', 'shoes'].map(s => outfit[s] && clothingById(outfit[s].id)).filter(Boolean);
      const hoodUp = it => it.base === 'hoodie' && !!(style.hoodUp ?? it.look.hoodUp);
      const k = items.map(it => it.id + (hoodUp(it) ? ':up' : '')).join('|');
      if (k === key) return api.ready; key = k; const ticket = ++pending; stats.loading = true;
      api.ready = Promise.all(items.map(it => Promise.all([loadBase(it.base), hoodUp(it) ? loadBase('hood_up') : []]).then(([a, b]) => instance(it, [...a, ...b], hoodUp(it)))))
        .then(list => { if (ticket === pending) apply(list); }).catch(e => { error = e.message || String(e); stats.loading = false; console.error('rider clothes', e); });
      return api.ready;
    },
    ready: Promise.resolve(),
    update(dt, speed) {
      uniforms.uTime.value = (uniforms.uTime.value + (dt || 0)) % 1000;
      const want = Math.max(0, Math.min(1, ((speed || 0) - 1.5) / 14));
      uniforms.uWind.value += (want - uniforms.uWind.value) * (1 - Math.exp(-(dt || 0) * 4));
    },
    meshes: () => worn.flatMap(g => g.meshes),
    state: () => ({ ...stats, error, wind: +uniforms.uWind.value.toFixed(3) }),
  };
  return api;
}
