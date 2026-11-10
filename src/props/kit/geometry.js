// Cached geometry builders. Identical part params reuse one BufferGeometry,
// which lets bake() turn repeated parts (casters, handles, bins) into instances.
export function createGeometry(T) {
 const cache = new Map();
 const memo = (key, fn) => { if (!cache.has(key)) { const g = fn(); g.userData.kitKey = key; cache.set(key, g); } return cache.get(key); };
 const r3 = v => Math.round(v * 1e4) / 1e4;
 /** Box with rounded edges/corners, centred on the origin. */
 function rbox(w, h, d, r = .006, seg = 2) {
  w = r3(w); h = r3(h); d = r3(d);
  r = Math.max(.0005, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  return memo(`rbox:${w}:${h}:${d}:${r3(r)}:${seg}`, () => {
   // inner outline inset by r; the bevel grows it back to w x h and rounds every edge
   const iw = w / 2 - r, ih = h / 2 - r, c = Math.min(r * .6, iw * .9, ih * .9), s = new T.Shape();
   s.moveTo(-iw + c, -ih); s.lineTo(iw - c, -ih); s.quadraticCurveTo(iw, -ih, iw, -ih + c); s.lineTo(iw, ih - c); s.quadraticCurveTo(iw, ih, iw - c, ih);
   s.lineTo(-iw + c, ih); s.quadraticCurveTo(-iw, ih, -iw, ih - c); s.lineTo(-iw, -ih + c); s.quadraticCurveTo(-iw, -ih, -iw + c, -ih);
   const g = new T.ExtrudeGeometry(s, { depth: Math.max(.0002, d - 2 * r), bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: seg, curveSegments: 3, steps: 1 });
   g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals(); return g;
  });
 }
 const box = (w, h, d) => memo(`box:${r3(w)}:${r3(h)}:${r3(d)}`, () => new T.BoxGeometry(w, h, d));
 /** Cylinder along Y. */
 const cyl = (rt, rb, h, seg = 20, open = false) => memo(`cyl:${r3(rt)}:${r3(rb)}:${r3(h)}:${seg}:${open}`, () => new T.CylinderGeometry(rt, rb, h, seg, 1, open));
 /** Cylinder along X (wheels, bars). */
 const cylX = (r, len, seg = 20) => memo(`cylX:${r3(r)}:${r3(len)}:${seg}`, () => new T.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2));
 const torus = (R, r, seg = 24, tube = 8, arc = Math.PI * 2) => memo(`torus:${r3(R)}:${r3(r)}:${seg}:${tube}:${r3(arc)}`, () => new T.TorusGeometry(R, r, tube, seg, arc));
 const sphere = (r, a = 12, b = 8) => memo(`sph:${r3(r)}:${a}:${b}`, () => new T.SphereGeometry(r, a, b));
 const lathe = (key, pts, seg = 20) => memo('lathe:' + key, () => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg));
 /** Extrude a 2D outline (array of [x,y]) along Z, centred. */
 const extrude = (key, pts, depth, bevel = .002) => memo('ext:' + key, () => {
  const s = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(.0005, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2 + bevel); g.computeVertexNormals(); return g;
 });
 const shape = (key, build, depth, bevel = .0015) => memo('shape:' + key, () => {
  const s = build(new T.Shape(), T);
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(.0005, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2 + bevel); g.computeVertexNormals(); return g;
 });
 const plane = (w, h) => memo(`plane:${r3(w)}:${r3(h)}`, () => new T.PlaneGeometry(w, h));
 return { rbox, box, cyl, cylX, torus, sphere, lathe, extrude, shape, plane, memo, dispose() { for (const g of cache.values()) g.dispose(); cache.clear(); } };
}
