// Grass field (v2.1-49): tens of thousands of real grass blades round the rider, drawn on the GPU. A ring of
// tiles (each a merged patch of blades) follows the bike, snapped to the tile grid so blades never swim; each
// blade reads the ground height and a density mask from a small texture baked round the rider (re-baked as you
// move), sways in the wind, bends away from the bike and fades out at the edge of the patch.
const TAU = Math.PI * 2;
function rng(seed) { let r = seed; return () => (r = (r * 16807) % 2147483647) / 2147483647; }
export function makeGrassField(T, root, { height, mask, lowDetail = false, quality = 'high' } = {}) {
  const tier = quality === 'high' ? { tiles: 9, blades: 2000, tile: 6.5 } : quality === 'medium' ? { tiles: 9, blades: 800, tile: 6 } : { tiles: 7, blades: 420, tile: 6 };
  const TILE = tier.tile, NT = tier.tiles, SIZE = TILE * NT, RES = 128, half = SIZE / 2;
  // one tile of blades: each blade a tapered, curved 3-segment strip (6 tris), random lean/size/colour seed
  const r = rng(91), pos = [], uvb = [], seed = [], root2 = [], idx = [];
  for (let b = 0; b < tier.blades; ) { const rx = r() * TILE, rz = r() * TILE, n = 3 + Math.floor(r() * 4), sd = r(), hc = .22 + r() * .38;
    for (let c = 0; c < n && b < tier.blades; c++, b++) {
      const x = rx + (r() - .5) * .12, z = rz + (r() - .5) * .12, ang = r() * TAU, h = hc * (.7 + r() * .6), w = .018 + r() * .02, lean = (r() - .5) * .9;
      const ca = Math.cos(ang), sa = Math.sin(ang), k0 = pos.length / 3, dx = Math.cos(ang + 1.57) * lean, dz = Math.sin(ang + 1.57) * lean;
      for (let i = 0; i <= 2; i++) { const t = i / 2, ww = w * (1 - t * .9), bend = t * t * h;
        for (const side of [-1, 1]) { pos.push(x + ca * ww * side + dx * bend, t * h, z + sa * ww * side + dz * bend); uvb.push(t, side * .5 + .5); seed.push(sd, h); root2.push(x, z); } }
      for (let i = 0; i < 2; i++) { const a = k0 + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uvb, 2)); g.setAttribute('bseed', new T.Float32BufferAttribute(seed, 2)); g.setAttribute('broot', new T.Float32BufferAttribute(root2, 2)); g.setIndex(idx);
  g.setAttribute('normal', new T.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  g.boundingSphere = new T.Sphere(new T.Vector3(TILE / 2, 1, TILE / 2), TILE);
  // height + density baked round the rider
  const data = new Float32Array(RES * RES * 4), tex = new T.DataTexture(data, RES, RES, T.RGBAFormat, T.FloatType); tex.magFilter = tex.minFilter = T.LinearFilter; tex.needsUpdate = true;
  const U = { gTex: { value: tex }, gOrigin: { value: new T.Vector2() }, gSize: { value: SIZE }, gTime: { value: 0 }, gBike: { value: new T.Vector3(0, -99, 0) }, gCenter: { value: new T.Vector2() }, gRad: { value: half - TILE * .6 } };
  const mat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .9, metalness: 0, side: T.DoubleSide, envMapIntensity: .35 });
  mat.customProgramCacheKey = () => 'wk-grass'; mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec2 bseed;attribute vec2 broot;uniform sampler2D gTex;uniform vec2 gOrigin;uniform float gSize;uniform float gTime;uniform vec3 gBike;uniform vec2 gCenter;uniform float gRad;varying vec3 vGCol;varying float vGT;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vec2 wxz=(instanceMatrix*vec4(position,1.)).xz;vec4 gd=texture2D(gTex,(wxz-gOrigin)/gSize);
float edge=1.-smoothstep(gRad*.72,gRad,length(wxz-gCenter));float t=uv.x;float hs=gd.g*edge*(.75+bseed.x*.5);
float dc=length(wxz-gCenter);transformed.xz=broot+(transformed.xz-broot)*(1.+dc*.09); /* far blades get wider so the field still reads as a carpet */
transformed.y*=hs;transformed.y+=gd.r-.02;
float wind=sin(gTime*1.7+wxz.x*.35+wxz.y*.22)*.5+sin(gTime*3.1+wxz.x*1.3)*.25;vec2 push=vec2(wind*.12,wind*.05)*t*t*hs;
vec2 db=wxz-gBike.xz;float bd=length(db);float near=(1.-smoothstep(.2,1.3,bd))*step(abs(gBike.y-gd.r),1.6);push+=normalize(db+1e-4)*near*.35*t*hs;transformed.y-=near*.18*t*hs;
transformed.xz+=push;
vGT=t;vec3 dry=vec3(.36,.33,.13),lush=vec3(.12,.25,.05);vGCol=mix(lush,dry,clamp(gd.b*.8+bseed.x*.3-.15,0.,1.))*(.35+.65*t)*(.8+.4*bseed.x);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGCol;varying float vGT;').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb=vGCol;').replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz*.7+normal*(gl_FrontFacing?.3:-.3));'); /* lit like the ground, both faces */
  };
  const mesh = new T.InstancedMesh(g, mat, NT * NT); mesh.name = 'environment:grass-field'; mesh.frustumCulled = false; mesh.receiveShadow = !lowDetail; root.add(mesh);
  const M = new T.Matrix4(); let cx = 1e9, cz = 1e9;
  const bake = (ox, oz) => { for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) { const x = ox + (i + .5) / RES * SIZE, z = oz + (j + .5) / RES * SIZE, k = (j * RES + i) * 4, m = mask(x, z);
      data[k] = height(x, z); data[k + 1] = m.density; data[k + 2] = m.dry; data[k + 3] = 1; } tex.needsUpdate = true; };
  return {
    mesh,
    update(x, z, y, dt) {
      U.gTime.value += dt || 0; U.gBike.value.set(x, y, z);
      const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
      if (tx !== cx || tz !== cz) { cx = tx; cz = tz; const ox = (tx - (NT - 1) / 2) * TILE, oz = (tz - (NT - 1) / 2) * TILE;
        let k = 0; for (let j = 0; j < NT; j++) for (let i = 0; i < NT; i++) { M.makeTranslation(ox + i * TILE, 0, oz + j * TILE); mesh.setMatrixAt(k++, M); }
        mesh.instanceMatrix.needsUpdate = true; U.gOrigin.value.set(ox, oz); U.gCenter.value.set(ox + SIZE / 2, oz + SIZE / 2); bake(ox, oz); }
    },
    dispose() { g.dispose(); mat.dispose(); tex.dispose(); mesh.removeFromParent(); },
  };
}
