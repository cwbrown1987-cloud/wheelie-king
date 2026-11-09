// Small procedural canvas textures (no photo art on props). Cached + disposable.
export function createTextures(T) {
 const cache = new Map();
 const can = typeof document !== 'undefined';
 function make(key, w, h, draw, { repeat = null, color = true } = {}) {
  if (!can) return null;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); if (color) t.colorSpace = T.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 4; cache.set(key, t); return t;
 }
 return {
  /** Pegboard: dark panel with drilled holes (tileable, 8x8 holes per tile). */
  pegboard: (base = '#262a33') => make('peg:' + base, 128, 128, (x, w) => {
   x.fillStyle = base; x.fillRect(0, 0, w, w);
   for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const cx = 8 + i * 16, cy = 8 + j * 16;
    x.fillStyle = '#0a0b0e'; x.beginPath(); x.arc(cx, cy, 2.6, 0, 7); x.fill();
    x.fillStyle = '#ffffff18'; x.beginPath(); x.arc(cx, cy + 1.6, 2.4, 0, Math.PI); x.fill();
   }
  }),
  /** Perforated racking upright (slots), tile along length. */
  upright: (base = '#d9a51f') => make('up:' + base, 32, 128, (x, w, h) => {
   x.fillStyle = base; x.fillRect(0, 0, w, h);
   for (let y = 6; y < h; y += 16) { x.fillStyle = '#16181c'; x.fillRect(12, y, 8, 9); x.fillStyle = '#ffffff22'; x.fillRect(12, y + 9, 8, 1); }
  }),
  /** Bin / drawer label card. */
  label: (text = '', bg = '#e9ecef', fg = '#1a1d22') => make(`lab:${text}:${bg}:${fg}`, 128, 48, (x, w, h) => {
   x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = 'bold 26px system-ui, DejaVu Sans, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 1);
   x.strokeStyle = '#00000033'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, h - 3);
  }),
  /** Original blueprint display content: a bike drawn in cyan line work. */
  blueprint: () => make('blueprint', 512, 320, (x, w, h) => {
   const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#06233f'); g.addColorStop(1, '#031426'); x.fillStyle = g; x.fillRect(0, 0, w, h);
   x.strokeStyle = '#1d6ea855'; x.lineWidth = 1; for (let i = 0; i < w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (let j = 0; j < h; j += 16) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
   x.strokeStyle = '#7fe6ff'; x.shadowColor = '#3fd0ff'; x.shadowBlur = 8; x.lineWidth = 4;
   const wheel = (cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, r * .2, 0, 7); x.stroke(); for (let a = 0; a < 12; a++) { x.beginPath(); x.moveTo(cx + Math.cos(a / 12 * 6.283) * r * .2, cy + Math.sin(a / 12 * 6.283) * r * .2); x.lineTo(cx + Math.cos(a / 12 * 6.283 + .4) * r, cy + Math.sin(a / 12 * 6.283 + .4) * r); x.lineWidth = 1.5; x.stroke(); } x.lineWidth = 4; };
   wheel(130, 205, 72); wheel(360, 205, 72);
   x.beginPath(); x.moveTo(130, 205); x.lineTo(215, 205); x.lineTo(300, 115); x.lineTo(190, 115); x.lineTo(130, 205); x.moveTo(215, 205); x.lineTo(180, 90); x.moveTo(160, 88); x.lineTo(205, 88); x.moveTo(300, 115); x.lineTo(360, 205); x.moveTo(300, 115); x.lineTo(292, 80); x.lineTo(320, 72); x.stroke();
   x.beginPath(); x.arc(215, 205, 18, 0, 7); x.stroke();
   x.shadowBlur = 0; x.fillStyle = '#9feeff'; x.font = 'bold 18px system-ui, DejaVu Sans, sans-serif'; x.fillText('WK-20 / FRAME SPEC', 300, 36); x.font = '13px system-ui, DejaVu Sans, sans-serif'; x.fillText('WB 1045  HT 74°  ST 71°', 300, 58);
   x.strokeStyle = '#7fe6ff88'; x.lineWidth = 1.5; x.strokeRect(10, 10, w - 20, h - 20);
  }),
  /** Soft rectangular contact shadow (alpha in red channel -> alphaMap). */
  contact: () => make('contact', 128, 128, (x, w) => {
   const g = x.createRadialGradient(w / 2, w / 2, w * .12, w / 2, w / 2, w * .5); g.addColorStop(0, '#fff'); g.addColorStop(.55, '#9a9a9a'); g.addColorStop(1, '#000');
   x.fillStyle = '#000'; x.fillRect(0, 0, w, w); x.filter = 'blur(10px)'; x.fillStyle = '#fff'; x.fillRect(22, 22, w - 44, w - 44); x.filter = 'none';
   x.globalCompositeOperation = 'multiply'; x.fillStyle = g; x.fillRect(0, 0, w, w);
  }, { color: false }),
  /** Cardboard tape + print. */
  carton: () => make('carton', 128, 128, (x, w) => {
   x.fillStyle = '#a07c52'; x.fillRect(0, 0, w, w); for (let i = 0; i < 400; i++) { x.fillStyle = Math.random() > .5 ? '#ffffff0c' : '#0000000e'; x.fillRect(Math.random() * w, Math.random() * w, 2, 1); }
   x.fillStyle = '#c9b48f'; x.fillRect(w * .42, 0, w * .16, w); x.strokeStyle = '#3a2a1a'; x.lineWidth = 3; x.strokeRect(18, 70, 40, 30); x.fillStyle = '#3a2a1a'; x.fillRect(80, 76, 30, 4); x.fillRect(80, 86, 22, 4);
  }),
  dispose() { for (const t of cache.values()) t.dispose(); cache.clear(); },
 };
}
