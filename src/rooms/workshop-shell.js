// Workshop room shell: Chris's neon-garage art is projected onto the BACK walls and
// ceiling only (from the photo's own camera). Everywhere a prop stood in the art, a
// precomputed mask swaps the art for relit brick so the modelled kit props can stand
// there without a painted copy behind them. No runtime depth pass is needed: the walls
// are the only projected surfaces and they never occlude each other from the projector.
export const ART = { W: 1672, H: 941, F: 1100, CX: 836, CY: 420, RIG: { s: .94, dx: -.6, dz: 3.4 } };

export function workshopGeometry(T) {
 const V = (x, y, z) => new T.Vector3(x, y, z), UP = V(0, 1, 0), { F, CX, CY, RIG } = ART;
 const rigM = new T.Matrix4().makeTranslation(RIG.dx, 0, RIG.dz).multiply(new T.Matrix4().makeScale(RIG.s, RIG.s, RIG.s));
 const P0 = V(0, 1, 0), G = p => p.clone().applyMatrix4(rigM);
 const ray = (u, v) => V((u - CX) / F, -(v - CY) / F, -1), floorT = v => 1 / ((v - CY) / F);
 const WALLZ = -8.4, CEILP = 1 + (420 - 60) / F * 8.4;
 const fA = P0.clone().add(ray(52, 615).multiplyScalar(floorT(615))); fA.y = 0;
 const fB = P0.clone().add(ray(420, 560).multiplyScalar(floorT(560))); fB.y = 0;
 const LT = fB.clone().sub(fA).normalize(), LN = new T.Vector3().crossVectors(LT, UP);
 const lwP0 = fA.clone().addScaledVector(LN, -.5), cornerP = lwP0.clone().addScaledVector(LT, (WALLZ - lwP0.z) / LT.z);
 const CEIL = CEILP * RIG.s, BACKZ = WALLZ * RIG.s + RIG.dz, RIGHTX = 6.38 * RIG.s + RIG.dx, LEFTX = -6, FRONTZ = 6.5;
 const corner = G(cornerP), CH = LT.clone().negate(), chamferEnd = corner.clone().addScaledVector(CH, (corner.x - LEFTX) / (-CH.x));
 return { rigM, projPos: G(P0), CEIL, BACKZ, RIGHTX, LEFTX, FRONTZ, corner, chamferEnd, chamferDir: CH.clone().negate() };
}

const LIGHTS = [ // [pos, colour, intensity, radius] shared by wall/floor shaders and the PBR point lights
 [[-3.2, 3.3, -1.0], '#b04cff', 1.2, 2.4], [[0.9, 3.3, -1.2], '#4fd8ff', 1.0, 2.4], [[3.6, 3.3, 0.6], '#b04cff', 1.1, 2.4],
 [[-2.4, 3.3, 3.0], '#4fd8ff', 1.0, 2.4], [[2.2, 3.3, 3.4], '#b04cff', 1.0, 2.4],
 [[-5.3, 2.45, 2.1], '#ffb35a', 1.9, 1.7], [[4.75, 2.5, 1.1], '#ffb35a', 1.7, 1.7], [[0, 3.15, 6.15], '#ffb35a', 1.6, 1.8],
 [[5.25, 1.8, -1.25], '#4fd8ff', 1.3, 1.4], [[-5.85, 1.8, 5.6], '#b04cff', 1.4, 1.4], [[-4.1, 3.3, 5.6], '#b04cff', 1.2, 2.2],
 [[-4.6, 2.1, -0.9], '#ffb35a', .9, 1.3], [[0.4, 3.2, -3.6], '#4fd8ff', .7, 2.5], [[-5.9, 2.35, 4.2], '#3dff8a', .5, .9]];
export const SHELL_LIGHTS = LIGHTS;

export function workshopShell(T, tex, { quality = 'desktop' } = {}) {
 const R = workshopGeometry(T), { F, CX, CY, W: IW, H: IH } = ART, V = (x, y, z) => new T.Vector3(x, y, z);
 const group = new T.Group(); group.name = 'workshop:shell';
 const projCam = new T.PerspectiveCamera(); const n = .05, f = 200;
 projCam.position.copy(R.projPos); projCam.updateMatrixWorld();
 projCam.projectionMatrix.makePerspective(-CX / F * n, (IW - CX) / F * n, CY / F * n, -(IH - CY) / F * n, n, f);
 const projVP = new T.Matrix4().multiplyMatrices(projCam.projectionMatrix, projCam.matrixWorldInverse);
 const NL = LIGHTS.length, uLP = [], uLC = [], uLR = [];
 for (const [p, c, i, r] of LIGHTS) { uLP.push(V(...p)); uLC.push(new T.Color().setStyle(c, T.NoColorSpace).multiplyScalar(i)); uLR.push(r); }
 for (const t of [tex.art, tex.mask, tex.relight]) { t.colorSpace = T.NoColorSpace; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; }
 for (const t of [tex.brick, tex.concrete, tex.ceiling]) { t.colorSpace = T.NoColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; }
 tex.concrete.wrapS = tex.concrete.wrapT = T.MirroredRepeatWrapping;
 const reflScale = quality === 'mobile' ? .25 : .5;
 const reflRT = new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType });
 const shared = { uProjVP: { value: projVP }, uArt: { value: tex.art }, uMask: { value: tex.mask }, uRelight: { value: tex.relight },
  uLP: { value: uLP }, uLC: { value: uLC }, uLR: { value: uLR }, uAmb: { value: new T.Color(.075, .072, .10) }, uLinearOut: { value: 0 } };
 const VS = `varying vec3 vWP;varying vec3 vN;varying vec2 vUv;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`;
 const LIT = `uniform vec3 uLP[${NL}];uniform vec3 uLC[${NL}];uniform float uLR[${NL}];uniform vec3 uAmb;uniform float uLinearOut;
 vec3 lightAt(vec3 N,vec3 P){vec3 c=uAmb;for(int i=0;i<${NL};i++){vec3 L=uLP[i]-P;float d=length(L);L/=d;float f=1./(1.+pow(d/uLR[i],2.2));c+=uLC[i]*f*(.25+.75*max(dot(N,L),0.));}return c;}
 vec4 outCol(vec3 c){return vec4(uLinearOut>.5?pow(max(c,vec3(0.)),vec3(2.2)):c,1.);}`;
 const wallMat = (o) => new T.ShaderMaterial({ vertexShader: VS, side: T.DoubleSide, uniforms: { ...shared, uAlb: { value: o.alb }, uScale: { value: o.scale }, uGain: { value: o.gain }, uProj: { value: o.proj ? 1 : 0 } },
  fragmentShader: LIT + `varying vec3 vWP;varying vec3 vN;uniform mat4 uProjVP;uniform sampler2D uArt,uMask,uRelight,uAlb;uniform float uScale,uGain,uProj;
  void main(){vec3 N=normalize(vN)*(gl_FrontFacing?1.:-1.);vec2 t;if(abs(N.y)>.5)t=vWP.xz;else{vec3 Tg=normalize(cross(vec3(0,1,0),N));t=vec2(dot(vWP,Tg),vWP.y);}
   vec3 alb=texture2D(uAlb,t*uScale).rgb*uGain;vec3 base=alb*lightAt(N,vWP);
   if(uProj<.5){gl_FragColor=outCol(base);return;}
   vec4 c=uProjVP*vec4(vWP,1.);vec2 uv=c.xy/c.w*.5+.5;bool inF=c.w>0.&&uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.;
   if(!inF){gl_FragColor=outCol(base);return;}
   float m=texture2D(uMask,uv).r;vec3 art=texture2D(uArt,uv).rgb;vec3 fill=texture2D(uRelight,uv).rgb*(alb/vec3(.24));
   vec3 a=mix(art,fill,m);float e=smoothstep(0.,.035,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
   gl_FragColor=outCol(mix(base,a,e));}` });
 const quad = (a, b, c, d) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([a, b, c, a, c, d].flatMap(p => [p.x, p.y, p.z]), 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); g.computeVertexNormals(); return g; };
 const { CEIL, BACKZ, RIGHTX, LEFTX, FRONTZ, corner, chamferEnd } = R;
 const brickArt = wallMat({ alb: tex.brick, scale: .25, gain: .85, proj: true }), brick = wallMat({ alb: tex.brick, scale: .25, gain: .85, proj: false });
 const ceil = wallMat({ alb: tex.ceiling, scale: .5, gain: 1.6, proj: true });
 const add = (g, m, name) => { const o = new T.Mesh(g, m); o.name = 'workshop:' + name; group.add(o); return o; };
 add(quad(V(corner.x, 0, BACKZ), V(RIGHTX, 0, BACKZ), V(RIGHTX, CEIL, BACKZ), V(corner.x, CEIL, BACKZ)), brickArt, 'back-wall');
 add(quad(V(chamferEnd.x, 0, chamferEnd.z), V(corner.x, 0, corner.z), V(corner.x, CEIL, corner.z), V(chamferEnd.x, CEIL, chamferEnd.z)), brickArt, 'chamfer-wall');
 add(quad(V(LEFTX, CEIL, BACKZ - 1), V(RIGHTX, CEIL, BACKZ - 1), V(RIGHTX, CEIL, FRONTZ), V(LEFTX, CEIL, FRONTZ)), ceil, 'ceiling');
 add(quad(V(LEFTX, 0, FRONTZ), V(LEFTX, 0, chamferEnd.z), V(LEFTX, CEIL, chamferEnd.z), V(LEFTX, CEIL, FRONTZ)), brick, 'left-wall');
 add(quad(V(RIGHTX, 0, BACKZ), V(RIGHTX, 0, FRONTZ), V(RIGHTX, CEIL, FRONTZ), V(RIGHTX, CEIL, BACKZ)), brick, 'right-wall');
 add(quad(V(RIGHTX, 0, FRONTZ), V(LEFTX, 0, FRONTZ), V(LEFTX, CEIL, FRONTZ), V(RIGHTX, CEIL, FRONTZ)), brick, 'front-wall');
 // ---- clean concrete floor + live planar reflection (blurred, fresnel) ----
 const floorMat = new T.ShaderMaterial({ vertexShader: VS, uniforms: { ...shared, uCon: { value: tex.concrete }, uRefl: { value: reflRT.texture }, uMirVP: { value: new T.Matrix4() }, uPx: { value: new T.Vector2(1 / 512, 1 / 288) } },
  fragmentShader: LIT + `varying vec3 vWP;uniform sampler2D uCon,uRefl;uniform mat4 uMirVP;uniform vec2 uPx;
  vec3 disp(vec3 x){x*=1.1;x=(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14);return pow(clamp(x,0.,1.),vec3(1./2.2));}
  void main(){vec3 N=vec3(0,1,0);vec3 alb=texture2D(uCon,vWP.xz*.23).rgb;vec3 L=lightAt(N,vWP);float lg=dot(L,vec3(.3,.5,.2));L=mix(vec3(lg),L,.5);vec3 col=alb*(L*.75+vec3(.08));
   if(uLinearOut>.5){gl_FragColor=outCol(col);return;}
   vec4 c=uMirVP*vec4(vWP,1.);vec2 r=c.xy/c.w*.5+.5;vec3 Vv=normalize(cameraPosition-vWP);float ndv=max(dot(Vv,N),0.);
   float rough=1.6+3.2*(1.-alb.r*1.8);vec3 acc=vec3(0);float wt=0.;
   for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec2 o=vec2(float(j),float(i))*uPx*rough;float w=1./(1.+float(i*i+j*j)*.3);acc+=texture2D(uRefl,r+o).rgb*w;wt+=w;}
   vec3 refl=disp(acc/wt);float fres=.07+.3*pow(1.-ndv,4.);col+=refl*fres*(.75+.5*smoothstep(.3,.6,alb.r*2.));gl_FragColor=vec4(col,1.);}` });
 const floor = add(quad(V(LEFTX, 0, FRONTZ), V(RIGHTX, 0, FRONTZ), V(RIGHTX, 0, BACKZ), V(LEFTX, 0, BACKZ)), floorMat, 'floor');
 const mirror = new T.PerspectiveCamera(), size = new T.Vector2();
 const shaderMats = [brickArt, brick, ceil, floorMat];
 /** Call before the main render each frame (or when the camera moves). */
 function renderReflection(renderer, scene, camera) {
  renderer.getDrawingBufferSize(size); const w = Math.max(64, Math.round(size.x * reflScale)), h = Math.max(36, Math.round(size.y * reflScale));
  if (reflRT.width !== w || reflRT.height !== h) { reflRT.setSize(w, h); floorMat.uniforms.uPx.value.set(1 / w, 1 / h); }
  camera.updateMatrixWorld(); const cp = new T.Vector3().setFromMatrixPosition(camera.matrixWorld), fw = new T.Vector3(0, 0, -1).transformDirection(camera.matrixWorld), up = new T.Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
  mirror.position.set(cp.x, -cp.y, cp.z); mirror.up.set(up.x, -up.y, up.z); mirror.lookAt(cp.x + fw.x, -(cp.y + fw.y), cp.z + fw.z); mirror.updateMatrix(); mirror.updateMatrixWorld(true);
  mirror.projectionMatrix.copy(camera.projectionMatrix); mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  floorMat.uniforms.uMirVP.value.multiplyMatrices(mirror.projectionMatrix, mirror.matrixWorldInverse);
  const prev = renderer.getRenderTarget(), vis = floor.visible; floor.visible = false; for (const m of shaderMats) m.uniforms.uLinearOut.value = 1;
  renderer.setRenderTarget(reflRT); renderer.clear(); renderer.render(scene, mirror); renderer.setRenderTarget(prev);
  floor.visible = vis; for (const m of shaderMats) m.uniforms.uLinearOut.value = 0;
 }
 /** Matching PBR point lights for modelled props (fewer on phones). */
 function pbrLights(max = quality === 'mobile' ? 6 : 14) {
  const out = [], order = [...LIGHTS.keys()].sort((a, b) => LIGHTS[b][2] * LIGHTS[b][3] - LIGHTS[a][2] * LIGHTS[a][3]).slice(0, max);
  for (const i of order) { const [p, c, inten, r] = LIGHTS[i]; const l = new T.PointLight(c, inten * 7, r * 4.5, 1.6); l.position.set(...p); out.push(l); }
  return out;
 }
 return { group, room: R, floor, renderReflection, pbrLights, projVP, dispose() { group.traverse(o => o.geometry?.dispose()); for (const m of shaderMats) m.dispose(); reflRT.dispose(); for (const t of Object.values(tex)) t.dispose?.(); } };
}
