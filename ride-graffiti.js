// Graffiti (v2.1-46): a texture atlas of many different pieces, generated on the fly, so walls look actually
// tagged instead of tiled. Styles: wildstyle, bubble throw-ups, chrome 3D blocks, flat roller letters, handstyle
// tags, stencils, slap stickers, original cartoon characters, spray scribbles (crowns, hearts, stars, arrows, X).
// The wall itself is plain dirty concrete; the pieces are laid over it as decals at random sizes, heights,
// tilts and overlaps (ride-neon-world.js), drawn from a shuffled bag so neighbours never repeat.
const TAU = Math.PI * 2;
export function rng(seed) { let r = seed % 2147483647; if (r <= 0) r += 2147483646; return () => (r = (r * 16807) % 2147483647) / 2147483647; }
const NAMES = ['DREK', 'KASE', 'ZONE', 'SKUF', 'REKS', 'VAPR', 'MOSK', 'TREZ', 'KRYP', 'OZMO', 'SEKT', 'JUNO', 'RAZE', 'BLK', 'WKR', 'NOVA', 'FURY', 'GRIM', 'HAZE', 'KOAS', 'SNAK', 'ZEPH', 'VOID', 'EKO', 'RUST', 'DUSK', 'NEKO', 'KRAM', 'SOZE', 'TOXE', 'YRAK', 'BYTE', 'FLUX', 'ORKA', 'PRYM', 'QUEK'];
const PAL = [ // [fill a, fill b, outline, shadow]
  ['#a23dff', '#36e6ff', '#0d0614', '#2a0a4a'], ['#ff3fa4', '#ffd23f', '#14060e', '#4a0a2a'], ['#2fd9c4', '#7a4dff', '#04140f', '#062a28'],
  ['#ff4a2a', '#ffcf3a', '#140804', '#3a0a04'], ['#3aa8ff', '#c6ff4f', '#050d1c', '#0a2244'], ['#ffffff', '#ff5ccf', '#16061a', '#3a0c3a'],
  ['#fff04a', '#ff6a1a', '#120c02', '#3a1a02'], ['#6cff7a', '#1a8a5a', '#03120a', '#0a2a14'], ['#ff7ad9', '#7a5cff', '#120624', '#2a0a3a'],
  ['#e8e8f0', '#8a8aa0', '#08080c', '#22222e'], ['#ff2a4a', '#1a1a1a', '#ffffff', '#3a0610'], ['#00e5ff', '#ff00a8', '#06001a', '#1a0030']];
const FONTS = ['900 {s}px Impact, "Arial Black", sans-serif', '900 {s}px "Arial Black", Arial, sans-serif', 'bold {s}px "Trebuchet MS", sans-serif', 'italic 900 {s}px Georgia, serif', '900 {s}px "Courier New", monospace', 'bold {s}px "Comic Sans MS", "Chalkboard SE", cursive', 'italic bold {s}px "Brush Script MT", cursive, serif'];
const font = (r, s, pick) => FONTS[pick ?? Math.floor(r() * FONTS.length)].replace('{s}', Math.round(s));
const pick = (r, a) => a[Math.floor(r() * a.length)];
// soft spray dot cloud, for overspray halos and fades
function spray(g, x, y, rad, col, n = 60, alpha = .08) { g.fillStyle = col; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = Math.pow(Math.random(), .6) * rad; g.globalAlpha = alpha; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + Math.random() * rad * .08, 0, TAU); g.fill(); } g.globalAlpha = 1; }
function drips(g, r, x0, x1, y, col, n, max = 40) { g.fillStyle = col; for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), len = 6 + r() * max, w = 2 + r() * 3; g.fillRect(x, y, w, len); g.beginPath(); g.arc(x + w / 2, y + len, w * .8, 0, TAU); g.fill(); } }
// --- letter styles -----------------------------------------------------------------------------------------------
function letters(g, r, word, cx, cy, size, f, layout) { // per-letter transforms, returns letter boxes
  g.font = f; g.textBaseline = 'middle'; g.textAlign = 'center';
  const ws = [...word].map(ch => g.measureText(ch).width * (layout.tight ?? .85)), tot = ws.reduce((p, q) => p + q, 0); let x = cx - tot / 2;
  return [...word].map((ch, i) => { const o = { ch, x: x + ws[i] / 2, y: cy + (r() - .5) * size * (layout.bounce ?? 0), rot: (r() - .5) * (layout.rot ?? 0), sc: 1 + (r() - .5) * (layout.scale ?? 0) }; x += ws[i]; return o; });
}
function eachL(g, L, skew, fn) { for (const l of L) { g.save(); g.translate(l.x, l.y); g.rotate(l.rot); g.transform(1, 0, skew, 1, 0, 0); g.scale(l.sc, l.sc); fn(l); g.restore(); } }
function fitSize(g, word, f0, w, h, r) { let s = h * .62; g.font = f0.replace(/\d+px/, s + 'px'); const mw = g.measureText(word).width * .85; if (mw > w * .86) s *= w * .86 / mw; return s; }
function wildstyle(g, r, x, y, w, h) {
  const [a, b, o, sh] = pick(r, PAL), word = pick(r, NAMES), f0 = font(r, 100, 0), s = fitSize(g, word, f0, w, h, r), f = font(r, s, 0);
  const L = letters(g, r, word, x + w / 2, y + h * .55, s, f, { bounce: .25, rot: .45, scale: .3, tight: .78 });
  spray(g, x + w / 2, y + h / 2, w * .4, b, 90, .05);
  for (let k = Math.round(s * .1); k > 0; k -= 2) eachL(g, L, -.2, l => { g.fillStyle = sh; g.fillText(l.ch, k * .8, k); });
  eachL(g, L, -.2, l => { g.lineJoin = 'round'; g.lineWidth = s * .2; g.strokeStyle = o; g.strokeText(l.ch, 0, 0); });
  eachL(g, L, -.2, l => { g.lineWidth = s * .09; g.strokeStyle = r() < .5 ? '#ffffff' : b; g.strokeText(l.ch, 0, 0); });
  eachL(g, L, -.2, l => { const gr = g.createLinearGradient(0, -s * .45, 0, s * .45); gr.addColorStop(0, a); gr.addColorStop(.5, b); gr.addColorStop(1, a); g.fillStyle = gr; g.fillText(l.ch, 0, 0); });
  eachL(g, L, -.2, () => { g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(-s * .2, -s * .3, s * .1, s * .04); });
  g.strokeStyle = b; g.fillStyle = b; g.lineWidth = s * .06; g.lineCap = 'round';
  for (let i = 0; i < 2 + r() * 3; i++) { const l = pick(r, L), ang = r() * TAU, len = s * (.35 + r() * .3), sx = l.x + Math.cos(ang) * s * .35, sy = l.y + Math.sin(ang) * s * .35, ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2 + Math.sin(ang) * len * .4, (sy + ey) / 2 - Math.cos(ang) * len * .4, ex, ey); g.stroke(); g.beginPath(); g.moveTo(ex + Math.cos(ang) * s * .12, ey + Math.sin(ang) * s * .12); g.lineTo(ex + Math.cos(ang + 2.3) * s * .1, ey + Math.sin(ang + 2.3) * s * .1); g.lineTo(ex + Math.cos(ang - 2.3) * s * .1, ey + Math.sin(ang - 2.3) * s * .1); g.fill(); }
  if (r() < .5) drips(g, r, x + w * .2, x + w * .8, y + h * .55 + s * .32, b, 10, h * .2);
}
function bubble(g, r, x, y, w, h) { // fat round throw-up: one fill, thick outline, simple highlight
  const [a, , o] = pick(r, PAL), word = pick(r, NAMES).slice(0, 2 + Math.floor(r() * 3)), f0 = font(r, 100, 1), s = fitSize(g, word, f0, w, h, r) * 1.05, f = font(r, s, 1);
  const L = letters(g, r, word, x + w / 2, y + h * .54, s, f, { bounce: .12, rot: .25, scale: .25, tight: .72 });
  const fill = r() < .3 ? '#e9e9f2' : a;
  eachL(g, L, 0, l => { g.lineJoin = 'round'; g.lineWidth = s * .34; g.strokeStyle = o; g.strokeText(l.ch, 0, 0); });
  eachL(g, L, 0, l => { g.lineWidth = s * .2; g.strokeStyle = fill; g.strokeText(l.ch, 0, 0); g.fillStyle = fill; g.fillText(l.ch, 0, 0); });
  eachL(g, L, 0, () => { g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-s * .15, -s * .22, s * .08, s * .04, -.5, 0, TAU); g.fill(); });
  if (r() < .6) { g.fillStyle = o; g.font = font(r, s * .18, 6); g.textAlign = 'left'; g.fillText(pick(r, ['2K26', 'CREW', 'RIP', '♥', 'BMX', 'WK']), x + w * .72, y + h * .9); }
}
function chrome(g, r, x, y, w, h) { // silver 3D block letters with a coloured extrusion
  const [, b, o] = pick(r, PAL), word = pick(r, NAMES), f0 = font(r, 100, 0), s = fitSize(g, word, f0, w, h, r) * .95, f = font(r, s, 0);
  const L = letters(g, r, word, x + w / 2, y + h * .5, s, f, { bounce: 0, rot: 0, scale: 0, tight: .9 });
  const d = s * .14; for (let k = d; k > 0; k -= 1.5) eachL(g, L, 0, l => { g.fillStyle = b; g.fillText(l.ch, k, k); });
  eachL(g, L, 0, l => { g.lineJoin = 'miter'; g.lineWidth = s * .08; g.strokeStyle = o; g.strokeText(l.ch, 0, 0); });
  eachL(g, L, 0, l => { const gr = g.createLinearGradient(0, -s * .45, 0, s * .45); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, '#b9b9c9'); gr.addColorStop(.5, '#5a5a6e'); gr.addColorStop(.75, '#d9d9e6'); gr.addColorStop(1, '#8a8aa0'); g.fillStyle = gr; g.fillText(l.ch, 0, 0); });
  g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { const l = pick(r, L), sx = l.x + (r() - .5) * s * .4, sy = l.y - s * .3; g.beginPath(); for (let k = 0; k < 8; k++) { const an = k * TAU / 8, rr = k % 2 ? s * .015 : s * .08; g.lineTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr); } g.fill(); }
}
function roller(g, r, x, y, w, h) { // flat blockbuster letters painted with a roller (streaky, edges uneven)
  const [a, , o] = pick(r, PAL), word = pick(r, NAMES), f0 = font(r, 100, 1), s = fitSize(g, word, f0, w, h * 1.15, r), f = font(r, s, 1);
  g.save(); g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = r() < .4 ? o : a; g.fillText(word, x + w / 2, y + h * .52);
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 70; i++) { g.globalAlpha = .15 + r() * .3; g.fillRect(x + r() * w, y + r() * h, 30 + r() * 120, 2 + r() * 3); } g.restore();
  drips(g, r, x + w * .1, x + w * .9, y + h * .52 + s * .33, g.fillStyle, 8, h * .15);
}
function tag(g, r, x, y, w, h) { // handstyle: fast, slanted, connected, with an underline swoosh and a crown or star
  const col = pick(r, ['#ffffff', '#111111', '#ff3fa4', '#36e6ff', '#fff04a', '#ff4a2a', '#6cff7a', '#c77dff']);
  const word = pick(r, NAMES).toLowerCase(), f0 = font(r, 100, pick(r, [3, 5, 6, 2])), s = fitSize(g, word, f0, w, h * .9, r);
  g.save(); g.translate(x + w / 2, y + h * .5); g.rotate(-.12 - r() * .25); g.transform(1, 0, -.35, 1, 0, 0); g.font = f0.replace(/\d+px/, s + 'px'); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeStyle = col; g.lineWidth = Math.max(2, s * .06); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeText(word, 0, 0);
  if (r() < .5) { g.fillStyle = col; g.fillText(word, 0, 0); }
  const tw = g.measureText(word).width; g.beginPath(); g.moveTo(-tw * .5, s * .38); g.bezierCurveTo(-tw * .1, s * .62, tw * .3, s * .2, tw * .62, s * .46); g.stroke();
  if (r() < .4) { g.beginPath(); const cx = -tw * .35, cy = -s * .55, z = s * .22; g.moveTo(cx - z, cy + z * .5); g.lineTo(cx - z, cy - z * .3); g.lineTo(cx - z * .4, cy + z * .1); g.lineTo(cx, cy - z * .5); g.lineTo(cx + z * .4, cy + z * .1); g.lineTo(cx + z, cy - z * .3); g.lineTo(cx + z, cy + z * .5); g.closePath(); g.stroke(); }
  g.restore(); if (r() < .3) drips(g, r, x + w * .3, x + w * .7, y + h * .6, col, 4, h * .25);
}
function stencil(g, r, x, y, w, h) {
  const col = pick(r, ['#111111', '#f2f2f2', '#ff2a4a', '#fff04a', '#36e6ff']), msg = pick(r, ['NO BRAKES', 'SEND IT', 'RIDE OR DIE', 'WHEELIE KING', 'NO FEAR', 'KEEP ROLLING', 'FULL SEND', 'OBEY GRAVITY?', 'LOOP THE LOOP', 'CANAL CREW']);
  g.save(); g.fillStyle = col; g.font = font(r, 100, 4); g.textAlign = 'center'; g.textBaseline = 'middle'; const words = msg.split(' '), lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [msg];
  let s = h * .7 / lines.length; g.font = font(r, s, 4); const mw = Math.max(...lines.map(l => g.measureText(l).width)); if (mw > w * .9) s *= w * .9 / mw; g.font = font(r, s, 4);
  lines.forEach((l, i) => { const yy = y + h / 2 + (i - (lines.length - 1) / 2) * s * 1.05; g.fillText(l, x + w / 2, yy); spray(g, x + w / 2, yy, w * .35, col, 50, .03); });
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; for (let i = 0; i < 6; i++) g.fillRect(x + r() * w, y, 3, h); g.restore(); // stencil bridges
}
function sticker(g, r, x, y, w, h) { // paper slap: rectangle, slightly torn, printed name
  const bg = pick(r, ['#ffffff', '#f4e04a', '#ff5a5a', '#5ad1ff', '#f0f0f0']), ink = pick(r, ['#111', '#d0102a', '#1a3aff']);
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((r() - .5) * .5); const sw = w * .8, sh = h * .55;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-sw / 2 + 3, -sh / 2 + 4, sw, sh); g.fillStyle = bg; g.beginPath(); g.moveTo(-sw / 2, -sh / 2); for (let i = 0; i <= 10; i++) g.lineTo(-sw / 2 + sw * i / 10, -sh / 2 + (r() - .5) * 4); g.lineTo(sw / 2, sh / 2); g.lineTo(-sw / 2 + r() * 10, sh / 2); g.closePath(); g.fill();
  g.fillStyle = ink; g.font = font(r, sh * .22, 1); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pick(r, ['HELLO', 'MY NAME IS', 'POST NO BILLS', 'WK CREW', 'STAY WILD']), 0, -sh * .22);
  g.font = font(r, sh * .4, pick(r, [5, 6, 3])); g.fillText(pick(r, NAMES).toLowerCase(), 0, sh * .16); g.restore();
}
function character(g, r, x, y, w, h) { // an original blobby spray-paint mascot face
  const [a, b, o] = pick(r, PAL), cx = x + w / 2, cy = y + h * .55, R = Math.min(w, h) * .38;
  spray(g, cx, cy, R * 1.35, b, 120, .04);
  g.fillStyle = a; g.strokeStyle = o; g.lineWidth = R * .1; g.beginPath(); for (let i = 0; i <= 24; i++) { const an = i / 24 * TAU, rr = R * (1 + (r() - .5) * .12); g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * .9); } g.closePath(); g.fill(); g.stroke();
  const eye = (ex, sz) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, cy - R * .2, sz, sz * 1.25, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = o; g.beginPath(); g.arc(ex + sz * .25, cy - R * .15, sz * .45, 0, TAU); g.fill(); };
  eye(cx - R * .35, R * .24); eye(cx + R * .3, R * (.18 + r() * .1));
  g.beginPath(); g.lineWidth = R * .09; if (r() < .5) { g.arc(cx, cy + R * .15, R * .45, .2, Math.PI - .2); g.stroke(); g.fillStyle = '#fff'; g.fillRect(cx - R * .12, cy + R * .52, R * .14, R * .14); } else { g.moveTo(cx - R * .4, cy + R * .35); g.lineTo(cx - R * .1, cy + R * .45); g.lineTo(cx + R * .15, cy + R * .3); g.lineTo(cx + R * .4, cy + R * .42); g.stroke(); }
  if (r() < .5) { g.fillStyle = '#ffd23f'; g.strokeStyle = o; g.lineWidth = R * .06; const ty = cy - R * 1.05; g.beginPath(); g.moveTo(cx - R * .5, ty + R * .3); g.lineTo(cx - R * .55, ty - R * .2); g.lineTo(cx - R * .25, ty + R * .05); g.lineTo(cx, ty - R * .35); g.lineTo(cx + R * .25, ty + R * .05); g.lineTo(cx + R * .55, ty - R * .2); g.lineTo(cx + R * .5, ty + R * .3); g.closePath(); g.fill(); g.stroke(); }
}
function scribble(g, r, x, y, w, h) { // quick marks: crowns, hearts, stars, arrows, X's, a scrawl
  const col = pick(r, ['#ffffff', '#ffd23f', '#ff3fa4', '#36e6ff', '#ff4a2a', '#111111', '#a23dff']), kind = Math.floor(r() * 6), cx = x + w / 2, cy = y + h / 2, z = Math.min(w, h) * .38;
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(3, z * .14); g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
  if (kind === 0) { g.moveTo(cx - z, cy + z * .5); g.lineTo(cx - z, cy - z * .4); g.lineTo(cx - z * .5, cy); g.lineTo(cx, cy - z * .7); g.lineTo(cx + z * .5, cy); g.lineTo(cx + z, cy - z * .4); g.lineTo(cx + z, cy + z * .5); g.closePath(); g.stroke(); }
  else if (kind === 1) { g.moveTo(cx, cy + z * .8); g.bezierCurveTo(cx - z * 1.4, cy - z * .1, cx - z * .5, cy - z * 1.1, cx, cy - z * .35); g.bezierCurveTo(cx + z * .5, cy - z * 1.1, cx + z * 1.4, cy - z * .1, cx, cy + z * .8); r() < .5 ? g.fill() : g.stroke(); }
  else if (kind === 2) { for (let k = 0; k < 11; k++) { const an = k * TAU / 10 - Math.PI / 2, rr = k % 2 ? z * .4 : z; g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } r() < .5 ? g.fill() : g.stroke(); }
  else if (kind === 3) { g.moveTo(cx - z, cy); g.lineTo(cx + z * .6, cy); g.stroke(); g.beginPath(); g.moveTo(cx + z, cy); g.lineTo(cx + z * .4, cy - z * .45); g.lineTo(cx + z * .4, cy + z * .45); g.fill(); }
  else if (kind === 4) { g.moveTo(cx - z, cy - z); g.lineTo(cx + z, cy + z); g.moveTo(cx + z, cy - z); g.lineTo(cx - z, cy + z); g.stroke(); }
  else { let px = x + w * .1, py = cy; g.moveTo(px, py); for (let k = 0; k < 14; k++) { px += w * .06; py = cy + (r() - .5) * h * .5; g.lineTo(px, py); } g.stroke(); }
  if (r() < .3) drips(g, r, cx - z, cx + z, cy + z * .5, col, 3, h * .25);
}
const BIG = [wildstyle, wildstyle, bubble, bubble, chrome, roller, wildstyle, bubble, chrome, stencil, roller, wildstyle];
const SMALL = [tag, tag, tag, sticker, character, scribble, scribble, tag, stencil, character, bubble, tag];
// atlas: 5 rows of 4 big cells (2:1) + 3 rows of 8 small cells (1:1)  ->  20 big + 24 small pieces
export function makeGraffitiAtlas(T, { lowDetail = false, seed = 7 } = {}) {
  const S = lowDetail ? 1024 : 2048, c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d'), r = rng(seed * 7919 + 3);
  const cells = [], bw = S / 4, bh = S / 8, sw = S / 8;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) cells.push({ x: col * bw, y: row * bh, w: bw, h: bh, big: true });
  for (let row = 5; row < 8; row++) for (let col = 0; col < 8; col++) cells.push({ x: col * sw, y: row * bh, w: sw, h: bh, big: false });
  let bi = 0, si = 0; const bigOrder = [...BIG].sort(() => r() - .5), smallOrder = [...SMALL].sort(() => r() - .5);
  for (const cell of cells) { const pad = cell.w * .03; g.save(); g.beginPath(); g.rect(cell.x + 1, cell.y + 1, cell.w - 2, cell.h - 2); g.clip();
    try { (cell.big ? bigOrder[bi++ % bigOrder.length] : smallOrder[si++ % smallOrder.length])(g, r, cell.x + pad, cell.y + pad, cell.w - pad * 2, cell.h - pad * 2); } catch (e) { /* a missing canvas feature just leaves that cell blank */ }
    g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  return { texture: t, cells: cells.map(k => ({ u0: k.x / S, u1: (k.x + k.w) / S, v0: 1 - (k.y + k.h) / S, v1: 1 - k.y / S, aspect: k.w / k.h, big: k.big })) };
}
// plain dirty concrete for the wall (tiles every 14 m): stains, joints, buffed-out patches, faint old tags
export function makeWallBase(T, { lowDetail = false } = {}) {
  const w = lowDetail ? 1024 : 2048, h = lowDetail ? 256 : 512, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), r = rng(4242);
  g.fillStyle = '#4c4852'; g.fillRect(0, 0, w, h);
  const id = g.getImageData?.(0, 0, w, h); if (id?.data) { const d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.1; } g.putImageData(id, 0, 0); }
  for (let i = 0; i < 420; i++) { g.fillStyle = `rgba(${20 + r() * 50},${18 + r() * 45},${26 + r() * 50},${.05 + r() * .15})`; const s = 15 + r() * 160; g.beginPath(); g.ellipse(r() * w, r() * h, s, s * (.3 + r() * .8), r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 9; i++) { g.fillStyle = pick(r, ['#5a5560', '#3e3a44', '#615a6a', '#46424e']); g.globalAlpha = .85; g.fillRect(r() * w, h * (.1 + r() * .5), 80 + r() * 260, 40 + r() * 140); } g.globalAlpha = 1; // buffed patches
  g.globalAlpha = .22; for (let i = 0; i < 26; i++) tag(g, r, r() * w, h * (.1 + r() * .6), 90 + r() * 140, 50 + r() * 60); g.globalAlpha = 1; // faded old tags
  for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h * .4, len = 60 + r() * 300, gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, 'rgba(15,12,20,.35)'); gr.addColorStop(1, 'rgba(15,12,20,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 7, len); }
  for (let x = 0; x < w; x += w / 4) { g.fillStyle = 'rgba(12,10,16,.55)'; g.fillRect(x, 0, 4, h); g.fillStyle = 'rgba(120,115,130,.18)'; g.fillRect(x + 4, 0, 2, h); }
  g.fillStyle = 'rgba(10,8,14,.5)'; g.fillRect(0, h * .06, w, 3);
  const gb = g.createLinearGradient(0, h * .7, 0, h); gb.addColorStop(0, 'rgba(8,6,12,0)'); gb.addColorStop(1, 'rgba(8,6,12,.7)'); g.fillStyle = gb; g.fillRect(0, h * .7, w, h * .3);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
}
