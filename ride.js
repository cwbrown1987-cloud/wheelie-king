import { mountRideReplay } from './ride-replay.js';
import { pauseMenuMarkup, mountRidePause } from './ride-pause.js';
import { restoreRideState } from './ride-buffer.js';
import { makeLoopMesh } from './ride-loop.js';
// Wheelie King ride (v16). MotoX-Mayhem-style side-on 3D ride using the REAL garage bike (cloned, with its parts and stickers).
// Physics: ride-physics.js (pure 2D, reusable for a later 3D mode). This file is only rendering, input, FX, HUD and saving condition.
import * as T from "./vendor/three.module.js";
import { RGBELoader } from "./vendor/RGBELoader.js";
import { EffectComposer } from "./vendor/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./vendor/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./vendor/postprocessing/OutputPass.js";
import { createSideCamera } from "./ride-camera.js";
import { lightenForRide } from "./ride-lod.js";
import { TIERS, pickTier, createQualityMonitor } from "./ride-quality.js";
import { getTheme } from "./ride-themes.js";
import { makeTerrain, makeFlatTerrain, makePlaygroundTerrain, makeState, step } from "./ride-physics.js";
import {WK_VERSION} from './version.js';
import { createJoltRide } from './ride-jolt.js';
import { wrapAngle } from "./ride-freeroam.js";
import {rideParameters} from './ride-parameters.js';
import {createBikeMotion} from './bike-motion.js';
import {rideControlsMarkup,mountLeanControls,mountSteerSlider,mountTricksMenu,mountStick} from './ride-controls.js';
import {makeStuntRig} from './ride-tricks.js';
import {roadLayers} from './ride-scenery.js';
import {makeRider} from './rider-model.js';
import {makeUbcRider} from './rider-ubc.js';
import {makeEnvironment} from './ride-environment.js';
import {makePlaygroundWorld,SIDE_TRACK,PLAYGROUND_PADS} from './ride-playground.js';
import {NEON,NEON_COINS,makeNeonTerrain,neonLock,neonProject,neonAt,neonSafeS,neonProfile,neonInGap} from './ride-neon.js';
import {makeNeonWorld} from './ride-neon-world.js';
import {makeSoccer} from './ride-soccer.js';
import {makeTyreTracks} from './ride-tracks.js';
import {deriveRideProfile} from './ride-profile.js';
import {makeCrashRig} from './crash-rig.js';
const COND_KEY = "wk-condition";
export const loadCond = () => ({dirt:0,wear:{}}); // Repair/condition system paused at Chris's request.
export const saveCond = (c) => localStorage.setItem(COND_KEY, JSON.stringify(c));
const find = (id) => globalThis.__WK_CAT__?.().items.find((i) => i.id === id);
const DIRT = new T.Color("#5b4630");
// dirt tint + damage look; used both in the ride (live) and in the garage build hook (carry-back)
export function applyCondition(root, cond) {
  return; // Keep every purchased part intact while repairs are disabled.
  const d = Math.min(1, cond.dirt || 0);
  root.traverse((o) => { if (!o.isMesh || !o.material || o.userData.wkFx) return; const ms = [].concat(o.material);
    const out = ms.map((m) => { const base = m.userData.wkBase || m; let c = m.userData.wkBase ? m : base.clone(); c.userData.wkBase = base;
      if (base.color) c.color.copy(base.color).lerp(DIRT, d * 0.55); if ("roughness" in base) c.roughness = Math.min(1, base.roughness + d * 0.5); return c; });
    o.material = Array.isArray(o.material) ? out : out[0]; });
  for (const [slot, w] of Object.entries(cond.wear || {})) { const g = root.getObjectByName("wk:part:" + slot) || root.getObjectByName("wk:" + slot); if (!g) continue;
    if (w >= 1) g.visible = false; // broken off
    else if (w >= 0.4) { g.rotation.z = slot === "fender_r" ? -0.12 : 0.05; g.traverse((o) => { if (o.isMesh && o.material?.color) o.material.color.multiplyScalar(0.55); }); } } // cracked / bent
}
export const condLabel = (w) => (w >= 1 ? "BROKEN" : w >= 0.4 ? "CRACKED" : w > 0.05 ? "WORN" : "OK");
globalThis.__WK_COND__ = { load: loadCond, save: saveCond, apply: applyCondition, label: condLabel };

// v2.0: the game is the Jolt Playground. Chris's original side-scroller (classic physics: Trials /
// Endless) stays intact behind the dev-only URL param ?legacy=1 (or ?legacy=trials | ?legacy=endless).
export function legacyParam(){
  try{const q=new URLSearchParams(location.search);return q.has('legacy')?(q.get('legacy')||'1'):null}catch{return null}
}
export function readRideLevel(){
  const legacy=legacyParam();
  if(!legacy){try{if(localStorage.getItem('wk-level')==='neon')return 'neon'}catch{}return 'arena';} // v2.1-35: Neon Canal level
  if(legacy==='endless'||legacy==='flat')return 'flat';
  if(legacy==='trials')return 'trials';
  try{const v=localStorage.getItem('wk-level');if(v==='flat'||v==='trials'||v==='arena'||v==='neon')return v}catch{}
  return 'trials';
}

// Three.js clones userData through JSON. Editor decal records contain live mesh
// references; omit those runtime links while retaining the rendered decal mesh.
function rideData(value,parents=new WeakSet()){
 if(value===null||typeof value!=='object')return typeof value==='function'?undefined:value;
 if(value.isObject3D||value.isMaterial||value.isTexture||value.isBufferGeometry||parents.has(value))return undefined;
 parents.add(value);const out=Array.isArray(value)?[]:{};for(const [key,item]of Object.entries(value))if(key!=='wkDecal'){const v=rideData(item,parents);if(v!==undefined)out[key]=v}parents.delete(value);return out;
}
// Phones/low-detail only: meshes smaller than ~3.5 cm across are under 3 px at the ride camera distance, so skip drawing them.
export const RIDE_TINY_MESH_M=.035;
export function trimTinyMeshes(bike,limit=RIDE_TINY_MESH_M){let hidden=0,tris=0;bike.updateMatrixWorld(true);bike.traverse(o=>{if(!o.isMesh||!o.visible||o.isInstancedMesh||o.isSkinnedMesh)return;const g=o.geometry;if(!g.boundingSphere)g.computeBoundingSphere();if(g.boundingSphere.radius*2*o.matrixWorld.getMaxScaleOnAxis()<limit){o.visible=false;hidden++;tris+=(g.index?g.index.count:g.attributes.position.count)/3}});return {hidden,tris}}
export function cloneForRide(src) {
 const originals=[];let bike;try{src.traverse(o=>{originals.push([o,o.userData]);o.userData=rideData(o.userData)});bike=src.clone(true)}finally{for(const [o,data]of originals)o.userData=data;}

  // src.clone(true) shares materials and geometries with the garage bike. The
  // garage can later wear()/dispose the helmet, which left the ride copy with
  // a live graph but dead GPU buffers — the lime shell never appeared and the
  // jersey collar read as a dark-blue disc. Give the rider its own resources.
  bike.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh)return;
    let rider=false,p=o;while(p){if(p.name==='wk:rider'){rider=true;break}p=p.parent}
    if(rider){
      if(o.geometry)o.geometry=o.geometry.clone();
      const cm=m=>m.clone();
      if(o.material)o.material=Array.isArray(o.material)?o.material.map(cm):cm(o.material);
    }
    if(!o.userData.wkFlashBase)return;
    const base=o.userData.wkFlashBase;
    const restore=m=>{const out=m.clone();if(out.emissive){out.emissive.setHex(base.color);out.emissiveIntensity=base.intensity;}return out;};
    o.material=Array.isArray(o.material)?o.material.map(restore):restore(o.material);
    delete o.userData.cl;delete o.userData.wkFlashBase;
  });
  return bike;
}

export function mountRide(el, { stats = {}, build = {}, onResult, onClose, lowDetail=false, quality=null, theme=null, qualityManual=false, pixelRatioCap=null }) {
  let disposed=false;
  const TH=typeof theme==='object'&&theme?theme:getTheme(theme);
  const picked=pickTier(),qualityPick=lowDetail||picked.manual?{name:'low',manual:true}:quality&&TIERS[quality]?{name:quality,manual:qualityManual}:picked,Q=(t=>(readRideLevel()==='arena'||readRideLevel()==='neon')?{...t,aa:true,maxPR:Math.max(t.maxPR,{low:1.5,medium:1.75,high:2}[qualityPick.name]||1.5)}:t)(TIERS[qualityPick.name]),qualityMon=createQualityMonitor(qualityPick);let maxPR=Math.min(Q.maxPR,Number.isFinite(pixelRatioCap)&&pixelRatioCap>0?pixelRatioCap:Q.maxPR),qualityLog=[];lowDetail=Q.envLow;let fpsFrames=0,fpsTime=0,fpsLast=0;
  const src=(()=>{let root=null;globalThis.__WK_VIEW__?.scene.traverse(o=>{if(!root&&o.name==='wk:frame')root=o.parent});return root})(),preparedBike=src?cloneForRide(src):null;if(Q.trimTiny&&preparedBike)trimTinyMeshes(preparedBike);
  el.setAttribute('data-wk-ride-surface','');
  const blockBrowserGesture=e=>{if(e.type.startsWith('touch')&&e.target.closest?.('[data-r],button,input'))return;if(e.cancelable)e.preventDefault()};
  const blockedGestures=['selectstart','contextmenu','dragstart','gesturestart','gesturechange','touchstart','touchmove'];
  for(const type of blockedGestures)el.addEventListener(type,blockBrowserGesture,{passive:false});
  window.getSelection()?.removeAllRanges();
  const W = () => el.clientWidth || 900, H = () => el.clientHeight || 420;
  const R = new T.WebGLRenderer({ antialias: Q.aa,powerPreference:"high-performance" }); R.setPixelRatio(Math.min(maxPR, devicePixelRatio*el.getBoundingClientRect().width/W())); R.shadowMap.enabled = Q.shadows; R.shadowMap.type = T.PCFSoftShadowMap; R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping;
  R.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;z-index:0"; el.appendChild(R.domElement);
  const scene = new T.Scene(); scene.background = new T.Color(TH.background); scene.fog = new T.Fog(TH.fog.color, TH.fog.near, TH.fog.far);
  const cam = new T.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  const speedLineN=32,speedLinePos=new Float32Array(speedLineN*6),speedLineStreaks=Array.from({length:speedLineN},()=>({x:0,y:0,z:0,len:1}));
  const speedLineGeo=new T.BufferGeometry();speedLineGeo.setAttribute('position',new T.BufferAttribute(speedLinePos,3));
  const speedLineMat=new T.LineBasicMaterial({color:0xc8ffe0,transparent:true,opacity:0,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,toneMapped:false});
  const speedLines=new T.LineSegments(speedLineGeo,speedLineMat);speedLines.name='wk:speed-lines';speedLines.frustumCulled=false;speedLines.visible=false;scene.add(speedLines);
  const _slO=new T.Vector3(),_slX=new T.Vector3(),_slY=new T.Vector3(),_slZ=new T.Vector3();
  const resetSpeedStreak=st=>{st.x=(Math.random()<.5?-1:1)*(.85+Math.random()*1.55);st.y=(Math.random()-.42)*1.35;st.z=-(3.2+Math.random()*7);st.len=1.1+Math.random()*2;};
  speedLineStreaks.forEach(resetSpeedStreak);
  const level=readRideLevel(),legacyMenu=!!legacyParam(),flat=level==='flat',neon=level==='neon',arena=level==='arena'||neon,freeRoam=arena; // v2.1-35: Neon Canal runs on the Playground engine, locked to its track
  // Playground is lit only by the HDRI (PMREM environment) and one directional sun. Legacy keeps hemi+sun.
  let hemi=null;
  if(!arena){hemi=new T.HemisphereLight(TH.hemi.sky, TH.hemi.ground, TH.hemi.intensity);scene.add(hemi);}
  const sun = new T.DirectionalLight(TH.sun.color, TH.sun.intensity); sun.name='wk:sun'; sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias=-0.0009;sun.shadow.normalBias=0.04;sun.shadow.radius=2;
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 2, far: 48 }); scene.add(sun, sun.target);
  // Brightest pixel on the playground sky HDR (kloofendal_48d_partly_cloudy_puresky_1k), unit vector toward the sun.
  const sunDir=neon?new T.Vector3(0.83,0.27,0.49).normalize():new T.Vector3(0.553,0.743,0.377).normalize(); // neon: low sunset sun (raised a little for readable shadows)
  if(arena){
    sun.color.set(neon?'#ffae74':'#fff0dc');sun.intensity=neon?1.9:2.3;sun.shadow.radius=3;sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.05;
    R.toneMapping=T.ACESFilmicToneMapping;R.outputColorSpace=T.SRGBColorSpace;R.toneMappingExposure=neon?0.85:0.95;
    if(neon){const fill=new T.HemisphereLight('#9a7bd6','#3a2848',.35);fill.name='wk:neon-fill';scene.add(fill);}
  }
  // sky gradient + sun disc
  const sky = new T.Mesh(new T.PlaneGeometry(900, 260), new T.ShaderMaterial({ depthWrite: false, fog: false, uniforms: {}, vertexShader: "varying float v;void main(){v=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}", fragmentShader: `varying float v;void main(){gl_FragColor=vec4(mix(vec3(${TH.sky.low.map(n=>Number(n).toFixed(3)).join(",")}),vec3(${TH.sky.high.map(n=>Number(n).toFixed(3)).join(",")}),smoothstep(.35,.8,v)),1.);}` }));
  sky.position.set(0, 40, -120);
  const sunDisc = new T.Mesh(new T.CircleGeometry(9, 32), new T.MeshBasicMaterial({ color: TH.sunDisc, fog: false })); sunDisc.position.set(40, 30, -110);
  const legacyScenery=[];let backdropLoaded=false,horizonTex=null;let attachWorldSky=null,worldSky=null,worldSkyTex=null;
  function composeHorizonBackdrop(image){
    // Lift the painted city into the visible sky band (above the 3D wall) and keep a full sunset sky, so the
    // skyline fills the frame in side and chase on phone and desktop. Horizontal crop drops the photo's left
    // trees/wall so they don't float in the sky.
    const w=2048,h=1024,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
    const iw=image.width,ih=image.height,sx=iw*.36,sw=iw*.64;
    x.drawImage(image,sx,0,sw,ih*.34,0,0,w,h*.24);
    x.drawImage(image,sx,ih*.22,sw,ih*.30,0,h*.16,w,h*.24);
    const g=x.createLinearGradient(0,h*.36,0,h*.55);g.addColorStop(0,'rgba(110,80,120,0)');g.addColorStop(1,'#6a5a78');
    x.fillStyle=g;x.fillRect(0,h*.36,w,h*.64);x.fillStyle='#5c4c68';x.fillRect(0,h*.52,w,h*.48);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
  }
  function layoutBackdrop(tex,vw,vh,sway=0,blend=0){
    if(!tex?.image)return;
    const imgA=(tex.image.width||2)/(tex.image.height||1),viewA=Math.max(.2,vw/Math.max(1,vh));
    // Side: city sits just above the wall. Chase: slide it down onto the road horizon ahead.
    const cityV=.64,horizon=.70-blend*.22;
    if(viewA>imgA){const ry=imgA/viewA;tex.repeat.set(1,ry);tex.offset.set(0,Math.max(0,Math.min(1-ry,cityV-horizon*ry)));}
    else{
      const rx=viewA/imgA,ry=1-.28*blend;
      const ox=Math.max(0,Math.min(1-rx,.52-rx/2+sway));
      const oy=Math.max(0,Math.min(1-ry,cityV-horizon*ry));
      tex.repeat.set(rx,ry);tex.offset.set(ox,oy);
    }
  }
  // terrain
  if(!arena){scene.add(sky);scene.add(sunDisc);}
  else{scene.fog=neon?new T.Fog('#6b5487',150,1100):new T.Fog('#cdd8e3',160,1300);} // v2.1-21: light haze so distant hills and the town fade into the sky
  // Playground sky (v2.1-10): Poly Haven kloofendal_48d_partly_cloudy_puresky (CC0), midday, no ground in it.
  // The 1k HDR lights the scene; a sharper 4k tone-mapped JPG of the same sky is the visible background.
  const SKY=neon?'neon_sunset':'kloofendal_48d_partly_cloudy_puresky'; // neon: Poly Haven qwantani_dusk_2_puresky (CC0), graded purple/orange
  let skyKind=arena?'hdri-'+SKY:'painted';
  let backdrop=null;
  if(arena){
    // World-fixed HDRI sky. A marker group stops the render loop installing the painted billboard.
    worldSky=new T.Group();worldSky.name='wk:world-sky';scene.add(worldSky);
    sky.visible=false;sunDisc.visible=false;
    backdrop=new T.Texture();
    // Never render black: a soft sky/ground fill (matched to the HDRI) stays on until the
    // environment is really installed. Phones without half-float render targets, or a failed
    // .hdr load, get the tone-mapped LDR jpg of the same sky instead.
    let skyFill=new T.HemisphereLight('#d5dde8','#6f6a66',1.1);skyFill.name='wk:sky-fill';scene.add(skyFill);
    const dropFill=()=>{if(skyFill){skyFill.removeFromParent();skyFill.dispose?.();skyFill=null;}};
    const gl=R.getContext(),caps=R.capabilities;
    const halfFloatOk=caps.isWebGL2?!!(gl.getExtension('EXT_color_buffer_float')||gl.getExtension('EXT_color_buffer_half_float')):!!(gl.getExtension('OES_texture_half_float')&&gl.getExtension('OES_texture_half_float_linear')&&gl.getExtension('EXT_color_buffer_half_float'));
    const installEnv=(tex,kind)=>{
      if(disposed){tex.dispose();return false;}
      tex.mapping=T.EquirectangularReflectionMapping;
      let env=null;
      try{const pmrem=new T.PMREMGenerator(R);env=pmrem.fromEquirectangular(tex).texture;pmrem.dispose();}catch(e){console.warn('PMREM failed',e);}
      const glErr=gl.getError();
      if(!env||glErr){env?.dispose();return false;}
      scene.background=tex;scene.environment=env;skyKind=kind;
      sky.visible=false;sunDisc.visible=false;legacyScenery.forEach(o=>o.visible=false);
      dropFill();backdropLoaded=true;
      new T.TextureLoader().load('./assets/hdri/'+SKY+'_4k.jpg',bg=>{if(disposed){bg.dispose();return;}bg.colorSpace=T.SRGBColorSpace;bg.mapping=T.EquirectangularReflectionMapping;scene.background=bg;worldSkyTex?.dispose?.();worldSkyTex=bg;tex.dispose?.();});
      return true;
    };
    const loadLdr=()=>{
      if(disposed)return;
      new T.TextureLoader().load('./assets/hdri/'+SKY+'_1k_ldr.jpg',tex=>{
        tex.colorSpace=T.SRGBColorSpace;
        if(!installEnv(tex,'ldr-'+SKY)){if(!disposed){scene.background=tex;tex.mapping=T.EquirectangularReflectionMapping;skyKind='ldr-fill';backdropLoaded=true;}}
      },undefined,()=>{if(!disposed){scene.background=new T.Color('#9fb0c8');skyKind='fill-only';backdropLoaded=true;}});
    };
    if(!halfFloatOk||/[?&]sky=ldr\b/.test(location.search))loadLdr();
    else fetch('./assets/hdri/'+SKY+'_1k.hdr').then(r=>{
      // A missing file comes back as the HTML app shell (200 text/html); never hand that to the parser.
      if(!r.ok||/text\/html/.test(r.headers.get('content-type')||''))throw Error('hdr missing');
      return r.blob();
    }).then(blob=>{
      const url=URL.createObjectURL(blob);
      new RGBELoader().load(url,hdr=>{URL.revokeObjectURL(url);if(!hdr?.image?.data||!installEnv(hdr,'hdri-'+SKY))loadLdr();},undefined,()=>{URL.revokeObjectURL(url);loadLdr();});
    }).catch(()=>loadLdr());
  }else{
    backdrop=new T.TextureLoader().load(TH.backdrop.image,texture=>{if(disposed)return;texture.colorSpace=T.SRGBColorSpace;horizonTex=composeHorizonBackdrop(texture.image);scene.background=horizonTex;sky.visible=false;sunDisc.visible=false;legacyScenery.forEach(o=>o.visible=false);backdropLoaded=true;if(attachWorldSky)attachWorldSky(horizonTex);else layoutBackdrop(horizonTex,el.clientWidth||16,el.clientHeight||9,0);},undefined,()=>{if(!disposed)buildLegacy()});
  }
  const ter=flat?makeFlatTerrain():neon?makeNeonTerrain():arena?makePlaygroundTerrain():makeTerrain((build.frame || "bmx").length * 7 + 3),renderEnd=flat||arena?500:ter.finish;const pts=ter.pts;
  const shape = new T.Shape(); shape.moveTo(pts[0][0],pts[0][1]-.45);pts.forEach(([x,y])=>shape.lineTo(x,y));[...pts].reverse().forEach(([x,y])=>shape.lineTo(x,y-.45));shape.closePath();
  const groundGeo = new T.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false }); groundGeo.translate(0, 0, -1.2);
  const ground = new T.Mesh(groundGeo, new T.MeshStandardMaterial({ color: "#292d39", roughness: 1 })); ground.receiveShadow = true; if(!arena)scene.add(ground);
  const strip = []; pts.forEach(([x, y]) => strip.push(x, y + 0.02, 1.2, x, y + 0.02, -1.2)); const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute(strip, 3));
  const idx = []; for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } sg.setIndex(idx); sg.computeVertexNormals();
  const layers=arena?{foreground:null,topMap:null}:roadLayers(T,scene,pts,sg);
  const dirtTop = arena?null:new T.Mesh(sg, new T.MeshStandardMaterial({ map:layers.topMap,roughness: .38,metalness:.16, side: T.DoubleSide })); if(dirtTop){dirtTop.receiveShadow = true; scene.add(dirtTop);}
  const loopMesh = ter.loop ? makeLoopMesh(T, ter.loop) : null;
  if (loopMesh) scene.add(loopMesh);
  let flatMarkers;if(flat){flatMarkers=new T.InstancedMesh(new T.BoxGeometry(2,.006,.055),new T.MeshStandardMaterial({color:'#7ed4ed',emissive:'#174b63',emissiveIntensity:.5,roughness:.7}),82);const marker=new T.Object3D();for(let i=0;i<82;i++){marker.position.set(-200+(i%41)*10,.028,i<41?-1.05:1.05);marker.updateMatrix();flatMarkers.setMatrixAt(i,marker.matrix)}scene.add(flatMarkers);}
  ter.puddles.forEach(([a, b]) => { const m = new T.Mesh(new T.PlaneGeometry(b - a, 2.3), new T.MeshStandardMaterial({ color: "#3d6f8f", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })); m.rotation.x = -Math.PI / 2; m.position.set((a + b) / 2, ter.h((a + b) / 2) + 0.04, 0); scene.add(m); });
  const flag = (x, col, label) => { const g = new T.Group(); const y = ter.h(x); const pole = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 2.6), new T.MeshStandardMaterial({ color: "#ddd" })); pole.position.set(x, y + 1.3, -1.6);
    const f = new T.Mesh(new T.PlaneGeometry(0.9, 0.55), new T.MeshStandardMaterial({ color: col, side: T.DoubleSide })); f.position.set(x + 0.45, y + 2.3, -1.6); g.add(pole, f); g.userData.label = label; scene.add(g); return g; };
  ter.checkpoints.slice(1).forEach((x) => flag(x, "#39ff7a", "CP")); if(!flat&&!arena&&isFinite(ter.finish)){flag(ter.finish, "#ffffff", "FINISH"); flag(ter.finish, "#111111", "FINISH").position.z = 3.2;}
  // parallax hills (far layers move slower thanks to perspective) + scrub
  const buildLegacy=()=>{const rnd = ((r) => () => ((r = (r * 16807) % 2147483647) / 2147483647))(9);
  [[-18, "#c26a3a", 6, 0.6], [-40, "#9b5a43", 12, 0.4], [-75, "#6e4c5a", 22, 0.25]].forEach(([z, col, hh, den]) => { const s = new T.Shape(); s.moveTo(-60, -20); for (let x = -60; x <= renderEnd + 120; x += 8) s.lineTo(x, Math.sin(x * 0.05 * den + z) * hh * 0.5 + hh * 0.4 + rnd() * hh * 0.2); s.lineTo(renderEnd + 120, -20); s.closePath();
    const m = new T.Mesh(new T.ShapeGeometry(s), new T.MeshBasicMaterial({ color: col })); m.position.z = z; scene.add(m);legacyScenery.push(m); });
  for (let x = -20; x < renderEnd + 40; x += 3 + rnd() * 6) { const b = new T.Mesh(new T.IcosahedronGeometry(0.3 + rnd() * 0.4, 0), new T.MeshStandardMaterial({ color: rnd() > 0.5 ? "#6b7b3a" : "#8a8f4a", flatShading: true })); b.position.set(x, ter.h(x) + 0.1, -2.5 - rnd() * 3); b.castShadow = true; scene.add(b);legacyScenery.push(b); }};
  const neonWorld=neon?makeNeonWorld(T,scene,{lowDetail}):null;
  const environment=neon?{update:(x,o)=>neonWorld.update(o?.dt||0),view:b=>neonWorld.setView(b),surfaceAt:()=>'asphalt',isDirt:()=>false,state:()=>neonWorld.state(),dispose:()=>neonWorld.dispose()}:arena?makePlaygroundWorld(T,scene,ter,{lowDetail,theme:TH.environment}):makeEnvironment(T,scene,ter,{lowDetail,theme:TH.environment});
  // Playground soccer: push the big ball into the goal for fireworks (ride-soccer.js)
  const tracks=arena?makeTyreTracks(T,scene,(x,z)=>ter.height?ter.height(x,z):0):null;
  const soccer=arena&&!neon?makeSoccer(T,scene,ter,{lowDetail,onGoal:()=>{s.score+=500;s.events.push({type:'trick',t:'GOAL!',pts:500});}}):null;
  // Playground runs Chris's original (classic) ride physics in free roam: same wheelie, stoppie, air
  // and landing feel as the side-scroller, plus handlebar steering (ride-freeroam.js). Jolt stays
  // available for comparison with ?physics=jolt.
  const physics=arena&&/[?&]physics=jolt\b/.test(location.search)?'jolt':'classic';
  let jolt=null;
if(!arena){dirtTop.material.map=environment.roadMap;dirtTop.material.needsUpdate=true;}if(flatMarkers)flatMarkers.visible=false;
  if(arena){
    R.shadowMap.enabled=true;
    // v2.1-21: bigger, sharper sun shadows (trees, buildings and ramps around you, not just the bike)
    const sz=qualityPick.name==='high'?2048:1024;sun.shadow.mapSize.set(sz,sz);sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.035;
    cam.far=1400;cam.updateProjectionMatrix();
  }
  // the real garage bike, cloned
  const pivot = new T.Group(), body = new T.Group(); pivot.rotation.order="YXZ"; pivot.add(body); scene.add(pivot);
  const meshQ=new T.Quaternion(), meshFwd=new T.Vector3();
  let bike = preparedBike, A = src?.userData.wkAnchors;
  if (!bike) { bike = new T.Group(); A = { rearAxle: [-0.5, 0.33], frontAxle: [0.5, 0.33], wheelR: 0.33, bb: [0, 0.3], seatTop: [-0.2, 0.75], headTop: [0.4, 0.8] }; }
  bike.position.set(0, 0, 0); bike.rotation.set(0, 0, 0); bike.scale.set(1, 1, 1); bike.traverse((o) => { o.castShadow = true; if (o.name === "wk:stand" || o.name?.includes("platform")) o.visible = false; });
  bike.children.filter((c) => c.name === "wk:stand").forEach((c) => (c.visible = false));
  const cond = loadCond(); applyCondition(bike, cond);
  const P=rideParameters(stats,build,A,find);
  P.forkAxis=bike.getObjectByName('wk:model:fork')?.userData.wkFork?.axis||[0,1,0];
  // Playground: Jolt settings come from base platform data + fitted parts (ride-profile.js).
  // The drawn bike uses the same COM so the visual wheels sit on the physics wheels.
  const rideProfile=arena?deriveRideProfile({stats,build,find,anchors:A,base:P,forkAxis:P.forkAxis}):null;
  if(rideProfile){P.comBack=rideProfile.comBack;P.comH=rideProfile.comH;}P.forkVertical=P.forkAxis[1];P.rearLink=A.swingPivot?[A.rearAxle[0]-A.swingPivot[0],A.rearAxle[1]-A.swingPivot[1]]:null;
  const hC = P.comH - P.R; bike.position.set(-P.wb * P.comBack - A.rearAxle[0], -hC - A.rearAxle[1], 0); body.add(bike);
  // wheels move with their suspension (visible travel); find the wheel groups at each axle
  const wheels = [[], []]; bike.traverse((o) => { if (o.isGroup && o.parent && /wk:(tyres|motor)/.test(o.parent.name) && o.children.some((c) => c.geometry?.type === "TorusGeometry")) { const i = Math.abs(o.position.x - A.frontAxle[0]) < 0.05 ? 1 : 0; wheels[i].push([o, o.position.y]); } });
  const forkG = bike.getObjectByName("wk:suspension"), forkY = forkG?.position.y || 0;
  const mechanical=createBikeMotion(bike,build,find);let wheelAngleOffset=null;
  const stuntRig=makeStuntRig(T,bike,A,find(build.motor)?.kind);
  // Playground: Quaternius rider IK-posed on the profile's attach points. Legacy keeps rider-model.js.
  const riderModel=arena?makeUbcRider(T,body,bike,A,rideProfile,mechanical):makeRider(T,body,bike,A,mechanical);riderModel.update();let supermanPose=0,hopQueued=false;
  body.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=!!o.receiveShadow}});
  const blobGeo=new T.CircleGeometry(.26,18);blobGeo.rotateX(-Math.PI/2);
  const contactBlobs=[0,1].map(()=>{const m=new T.Mesh(blobGeo,new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.3,depthWrite:false}));m.renderOrder=1;m.visible=false;m.name='wk:contact-blob';scene.add(m);return m;});
  // particles: one instanced pool (roost, landing dust, puddle splash, scrape sparks)
  const NP = 260, pm = new T.InstancedMesh(new T.BoxGeometry(0.06, 0.06, 0.06), new T.MeshBasicMaterial({ color: "#fff" }), NP); pm.userData.wkFx = 1; pm.frustumCulled = false; scene.add(pm);
  const parts = Array.from({ length: NP }, () => ({ life: 0 })); let pi = 0; const o3 = new T.Object3D(), col = new T.Color();
  // v2.1-26: smoke/dust are soft camera-facing puffs (radial-gradient billboards with per-puff fade), not
  // see-through spheres: spheres showed hard rims where they cut into the ground and each other ("seams").
  const smokeTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.45,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;})();
  const smokeMat=new T.MeshBasicMaterial({map:smokeTex,transparent:true,depthWrite:false,fog:true});
  const smokeAlpha=new T.InstancedBufferAttribute(new Float32Array(96),1);smokeAlpha.setUsage(T.DynamicDrawUsage);
  smokeMat.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float puffA;varying float vPuffA;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPuffA=puffA;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vPuffA;').replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.a*=vPuffA;');};
  smokeMat.customProgramCacheKey=()=>'wk-puff';
  const smokeGeo=new T.PlaneGeometry(1,1);smokeGeo.setAttribute('puffA',smokeAlpha);
  const smoke=new T.InstancedMesh(smokeGeo,smokeMat,96),smokeParts=Array.from({length:96},()=>({life:0}));let smokeIndex=0;smoke.frustumCulled=false;smoke.userData.wkFx=1;smoke.renderOrder=2;
  for(let i=0;i<96;i++)smoke.setColorAt(i,new T.Color('#c9c9c4'));scene.add(smoke);
  const puffCol={asphalt:new T.Color('#cfd0cc'),dirt:new T.Color('#b59d7c')};
  const emit = (x, y, vx, vy, c, life = 0.8, g = 9.8, sz = 1, z) => { const p = parts[pi = (pi + 1) % NP]; Object.assign(p, { x, y, z: z==null?(Math.random()-.5)*.6:z+(Math.random()-.5)*.2, vx, vy, vz:(Math.random()-.5)*1.2, life, max: life, g, sz }); pm.setColorAt(pi, col.set(c)); pm.instanceColor.needsUpdate = true; };
  for (let i = 0; i < NP; i++) pm.setColorAt(i, col.set("#fff"));
  const slowKey = 'wk-trials-completed';
  let slowUnlocked = !flat && localStorage.getItem(slowKey) === '1';
  let slowMo = false, reviewing = false, replayTail = 0, dropInEase = 0, rewinding = false, rewindT = 0, rewindPtr = null, rewindPrevX = null;
  let finishTime = 0, finishSpeed = 0, finishHeight = 0, finishFall = false, finishTumble = false;
  let photoDelay = -1, photoCount = 0;
  // state + input
  let crashRig=null;let s = makeState(P, neon?2:arena?SIDE_TRACK.x0+3:2, ter), lastCP = 2, cpI = 0, t0 = performance.now(), dirt = cond.dirt || 0, wear = { ...(cond.wear || {}) }, flips = 0, finished = false, crashT = 0, msg = "GO!", msgT = 2, maxScore = 0, reported = false, bank = 0;
  if(arena)s.z=neon?0:SIDE_TRACK.z; // Playground opens in side view at the start of the side track; Neon Canal at its start line
  // Same visual cleanup as RECOVER: put the rider back on the bike and hide the crash bar.
  function clearCrashVisuals(){
    cancelRewindHold();
    crashRig?.restore();
    crashRig=null;
    delete el.dataset.wkCrashed;
    recover.hidden=true;
    crashT=0;
    finishTumble=false;
    const bikeZ=s.z||0,bikeYaw=s.yaw||0;
    pivot.position.set(s.x,s.y,bikeZ);
    pivot.rotation.set(0,-bikeYaw,s.pitch||0);
  }
  const joltWanted=()=>physics==='jolt'&&arena&&!disposed;
  async function ensureJolt(){
    if(!joltWanted())return;
    if(!jolt)jolt=createJoltRide({P,profile:rideProfile});
    if(!jolt.ready)await jolt.start();
    if(jolt.ready&&!disposed){
      jolt.enabled=true;
      jolt.adopt(s);
      globalThis.__WK_JOLT_RESET__=(pose)=>{
        Object.assign(touch,{throttle:0,brake:0,steer:0,steerLeft:0,steerRight:0,lean:0,hop:0,trick:0});
        for(const k of Object.keys(keys))keys[k]=false;
        if(pose)Object.assign(s,pose);
        if(s.y==null||(pose&&pose.y==null))s.y=(ter.height?ter.height(s.x,s.z||0):0)+(P.comH||.9);
        s.joltRoll=null;s.crashed=null;s.air=0;s.spinV=0;s.spin=0;
        jolt.adopt(s);
        chasePosX=null;airClose=0;
        clearCrashVisuals();
        return {x:s.x,y:s.y,z:s.z,yaw:s.yaw,vx:s.vx};
      };
    }
    return jolt;
  }
  if(joltWanted())ensureJolt();
  // Classic Playground: same reset hook the QA harness uses for Jolt (pose = {x,z,yaw,vx,...}).
  if(arena&&physics==='classic')globalThis.__WK_JOLT_RESET__=(pose)=>{
    Object.assign(touch,{throttle:0,brake:0,steer:0,steerLeft:0,steerRight:0,lean:0,hop:0,trick:0});
    for(const k of Object.keys(keys))keys[k]=false;
    const fresh=makeState(P,0,ter),x=pose?.x??s.x,z=pose?.z??s.z??0,yaw=pose?.yaw??s.yaw??0;
    for(const k of Object.keys(fresh))s[k]=fresh[k];
    Object.assign(s,{x,z,yaw,steer:0},pose||{});
    if(pose?.y==null)s.y=(ter.height?ter.height(x,z):0)+fresh.y;
    s.events=[];s.crashed=null;chasePosX=null;airClose=0;
    clearCrashVisuals();
    return {x:s.x,y:s.y,z:s.z,yaw:s.yaw,vx:s.vx};
  };


  if(!P.pedal&&P.batteryWh<=0)s.battery=0;
  const inp = { throttle: 0, brake: 0, lean: 0, hop: 0, trick: 0, whip: 0, steer: 0 }, keys = {}, touch = { throttle: 0, brake: 0, lean: 0, steer: 0 }; let paused=false; let pauseUi=null;
  let composer=null,bloomPass=null,composerSize='',bloomFailed=false,vertCam=0,vertCamYaw=0,camZoom=1,lookHold=0,visDive=0,visSquat=0,chaseFollowY=0,chaseLookY=0,chaseFollowX=null,chaseHorizon=0,chaseTakeoffY=0,chaseYaw=0,chasePosX=null,chasePosZ=0,visRoll=0,camShake=0,lookYaw=0,lookPitch=0,lookVY=0,lookVP=0,lookDrag=null,lookLast=null,meshYaw=0,lastChaseCam={fov:40,radius:5.8,camY:0,lookY:0,clearance:0,followY:0};
  const kd = (e) => { const k = e.key.toLowerCase(); if (reviewing) { if (k === "escape") { const wasPaused=paused; replay.clear(); if (wasPaused) pauseUi?.showMenu(); } return; } if (k === "escape" || k === "p") { e.preventDefault(); pauseUi?.toggle(); return; } if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ","w","a","s","d"].includes(k)) e.preventDefault(); if(k===" ")hopQueued=true;if(arena){if(k==='shift'||k===' '){e.preventDefault();keys[k]=true;return;}const mv={b:'burnout',g:'stand',c:'onehand',x:'kneeknock'}[k];if(mv){e.preventDefault();if(!e.repeat)setToggle(mv,!rideToggles[mv]);return;}}const action=arena?null:({z:"tailwhip",e:"tailwhip",x:"barspin",c:"superman"})[k];if(action&&!keys[k])s.stuntRequest={name:action,expires:.7};keys[k]=true;if(k==="r")respawn(); }, ku = (e) => (keys[e.key.toLowerCase()] = false);
  addEventListener("keydown", kd); addEventListener("keyup", ku);
  // HUD + touch controls (DOM over the canvas)
  const ui = document.createElement("div"); ui.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:4;font-family:'Bungee',Impact,sans-serif;color:#fff;user-select:none;-webkit-user-select:none;touch-action:none"; el.appendChild(ui);
  ui.innerHTML = `<div class="ride-review-scrim" aria-hidden="true"></div><button type="button" class="ride-view-label" data-r="view" aria-label="Switch camera view" aria-pressed="false">▣ SIDE VIEW (2.5D)</button><div class="ride-toolbar" style="position:absolute;top:8px;left:8px;display:flex;gap:8px;pointer-events:auto">
    <button data-r="back" style="${btnCss("#222", 54, 44)}">←</button><button data-r="reset" aria-label="Reset ride" style="${btnCss("#222", 48, 44)}">↻</button><button data-r="level" ${legacyMenu?"":"hidden"} title="Change course and start a new run" style="${btnCss("#214632", 130, 44)}">${arena?"PLAYGROUND":("ENDLESS "+(flat?"∞":"OFF"))}</button></div>
   ${pauseMenuMarkup(level,{legacy:legacyMenu})}
   <div style="position:absolute;top:8px;right:10px;text-align:right;text-shadow:0 2px 6px #000"><div data-h="score" style="font-size:30px;color:#39ff7a">0</div><div data-h="best" style="font-size:13px;opacity:.85"></div></div>
   <div style="position:absolute;top:96px;left:10px;text-shadow:0 2px 6px #000"><div data-h="speed" style="font-size:34px">0<small> km/h</small></div><div data-h="heading" style="font-size:13px;letter-spacing:.06em;opacity:.9"></div><div data-h="wheelie" style="font-size:15px;color:#ffd23d"></div><div data-h="batt" style="font-size:13px;opacity:.85"></div><div data-h="prog" style="width:150px;height:6px;background:#0006;border-radius:3px;margin-top:6px"><div style="height:100%;width:0;background:#39ff7a;border-radius:3px"></div></div></div>
   <div data-h="trick" style="position:absolute;top:22%;width:100%;text-align:center;font-size:34px;color:#39ff7a;text-shadow:0 0 14px #000"></div>
   <div data-h="msg" style="position:absolute;top:36%;width:100%;text-align:center;font-size:26px;text-shadow:0 0 10px #000"></div>
   <button class="ride-replay-alert ride-glass" data-r="replay" hidden>● REPLAY</button>
   <section class="ride-replay ride-glass" hidden role="dialog" aria-label="Replay">
    <header class="ride-replay-head"><strong>REPLAY</strong><button type="button" class="ride-replay-x" data-r="replay-close" aria-label="Close">✕</button></header>
    <div class="ride-replay-layout">
      <div class="ride-replay-main">
        <div class="ride-replay-stage">
          <video playsinline></video>
          <button type="button" class="ride-replay-overlay-play" data-r="overlay-play" aria-label="Play">▶</button>
        </div>
        <div class="ride-replay-scrub" data-r="replay-seek"><label><span class="ride-sr">Seek</span> <input type="range" min="0" step=".05" aria-label="Scrub replay"></label><span data-r="replay-time">0:00 / 0:00</span></div>
        <div class="ride-replay-actions">
          <button type="button" class="ride-replay-playbtn" data-r="replay-play" aria-label="Play">▶</button>
          <button type="button" class="ride-replay-drop" data-r="drop-in"><span aria-hidden="true">⤵</span> Drop In</button>
          <button type="button" class="ride-save-btn" data-r="save-shot-gallery" title="Save frame to Gallery"><span class="ri" aria-hidden="true">🖼</span><span class="rl">Screenshot</span></button>
          <button type="button" class="ride-save-btn" data-r="save-video-gallery" title="Save video to Gallery"><span class="ri" aria-hidden="true">💾</span><span class="rl">Save to Gallery</span></button>
          <button type="button" class="ride-save-btn" data-r="save-video-device" title="Save video to device"><span class="ri" aria-hidden="true">⬇</span><span class="rl">Save to Device</span></button>
          <a data-r="download-video" download="wheelie-king.webm" hidden><span class="ri" aria-hidden="true">🎬</span><span class="rl">Save clip</span></a>
        </div>
      </div>
      <aside class="ride-replay-library" aria-label="Saved replays">
        <h3>Library</h3>
        <button type="button" class="ride-replay-latest" data-r="latest-run" aria-pressed="true">
          <span class="ride-replay-thumb ride-replay-thumb-live" aria-hidden="true">LIVE</span>
          <span class="ride-replay-meta"><strong>Latest run</strong><small data-r="latest-meta">Last 20s · Drop In ready</small></span>
        </button>
        <div class="ride-replay-list" data-r="replay-list"></div>
      </aside>
    </div>
    <div class="ride-replay-theatre">
      <button type="button" class="ride-theatre-close" data-r="theatre-close" aria-label="Exit theatre">✕</button>
      <div class="ride-theatre-bar">
        <button type="button" data-r="theatre-rew" aria-label="Rewind 5 seconds">⏪ Rewind</button>
        <button type="button" data-r="theatre-play" aria-label="Play">▶ Play</button>
        <button type="button" data-r="theatre-ff" aria-label="Fast forward 5 seconds">Fast forward ⏩</button>
        <label class="ride-theatre-seek">Scrub <input type="range" min="0" step=".05" data-r="theatre-scrub" aria-label="Scrub replay"></label>
        <span data-r="theatre-time">0:00 / 0:00</span>
        <button type="button" class="ride-replay-drop" data-r="theatre-drop"><span aria-hidden="true">⤵</span> Drop In</button>
      </div>
    </div>
   </section>
   <section class="ride-gallery ride-glass" hidden role="dialog" aria-label="Gallery">
    <header class="ride-replay-head"><strong>GALLERY</strong><button type="button" class="ride-replay-x" data-r="gallery-close" aria-label="Close">✕</button></header>
    <div class="ride-gallery-grid" data-r="gallery-grid"></div>
    <p class="ride-gallery-empty" data-r="gallery-empty">No saves yet — capture screenshots or save replays.</p>
   </section>
   <section class="ride-finish ride-glass" hidden><strong>TRIALS COMPLETE</strong><p></p><div class="ride-finish-photos"></div><div><button data-r="menu">MAIN MENU</button><button data-r="restart">RESTART RACE</button></div></section>
   ${rideControlsMarkup({playground:arena})}`;
  const $ = (q) => ui.querySelector(q), hud = Object.fromEntries([...ui.querySelectorAll("[data-h]")].map((e) => [e.dataset.h, e]));
  const finishPanel = $('.ride-finish'), photos = $('.ride-finish-photos');
  const slowButton = $('[data-r="slow"]');
  slowButton.hidden = !slowUnlocked;
  const replay = mountRideReplay(ui, R.domElement, value => {
    reviewing = value;
    el.toggleAttribute('data-wk-reviewing', value);
    if (value) releaseControls();
  }, {
    getMeta: () => ({
      bike: find(build.frame)?.name || build.frame || 'Bike',
      title: (flat ? 'Endless' : 'Trials') + ' run',
    }),
    onClose() { pauseUi?.showMenu(); },
    onDropIn(frame) {
      return applyRideSnapshot(frame, { ease: true, clearCrash: true });
    },
  });
  function endSlow() {
    if (!slowMo) return;
    slowMo = false;
    slowButton.setAttribute('aria-pressed', 'false');
    replayTail = 2.5;
  }
  // Toggle: press once to start slow-mo, press again to stop. No hold, no timeout. Works on the ground too.
  function showSlowUnlockToast(){
    ui.querySelector('.ride-slow-toast')?.remove();
    const toast=document.createElement('div');
    toast.className='ride-slow-toast';toast.dataset.wkSlowToast='1';toast.setAttribute('role','status');
    toast.textContent='SLOW MO UNLOCKED';ui.append(toast);
    setTimeout(()=>toast.remove(),2800);
  }
  slowButton.onclick = () => {
    if (slowMo) return endSlow();
    if (!slowUnlocked || paused || reviewing || finished || s.crashed || s.loopRide) return;
    replayTail = 0;
    slowMo = true;
    slowButton.setAttribute('aria-pressed', 'true');
    replay.start();
  };
  $('[data-r="menu"]').onclick = () => close();
  $('[data-r="restart"]').onclick = () => respawn();
  const held = new Map(); // pointerId -> control
  const leanControls=mountLeanControls(ui,touch);const steerSlider=mountSteerSlider(ui,touch);const stick=mountStick(ui,touch);const tricksMenu=mountTricksMenu(ui,{autoClose:!arena});
  // Playground: wheelie/stoppie come from the body (throttle or brake + weight shift), not buttons.
  // Touch: drag the ACCELERATE thumb down = weight back (wheelie), drag the BRAKE thumb up = weight
  // forward (stoppie); the amount follows the drag. Keys: W/Up throttle, S/Down brake, Shift lean back,
  // Space lean forward. TRICKS list toggles: B = BURNOUT, G = STAND, C = ONE-HANDER, X = KNEE-KNOCK.
  const rideToggles={burnout:false,stand:false,onehand:false,kneeknock:false};
  const setToggle=(k,v)=>{rideToggles[k]=v;ui.querySelectorAll(`[data-t="${k}"]`).forEach(b=>b.setAttribute('aria-pressed',String(v)));};
  // Brake lock: a finger that slides from BRAKE onto ACCELERATE keeps the brake on and adds throttle
  // until it lifts (burnout while the other hand steers).
  let brakeLockId=null;const dragLean=new Map(); // pointerId -> {c, y, v}
  const brakeLockUi=()=>{const el=ui.querySelector('.ride-brake-lock');if(el)el.hidden=brakeLockId==null;};
  ui.querySelectorAll('[data-t]').forEach(b=>{const c=b.dataset.t;
    b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if (reviewing || finished) return;if(arena&&c in rideToggles){setToggle(c,!rideToggles[c]);return;}b.setPointerCapture?.(e.pointerId);held.set(e.pointerId,c);touch[c]=1;if(c==='throttle'||c==='brake')dragLean.set(e.pointerId,{c,y:e.clientY});if(c==='hop')hopQueued=true;if(['tailwhip','barspin','superman','nohander','cancan','nacnac'].includes(c))s.stuntRequest={name:c,expires:.7};b.dataset.pressed='true';b.style.filter='brightness(1.5)'},{passive:false});
    if(c==='throttle'||c==='brake')b.addEventListener('pointermove',e=>{const d=dragLean.get(e.pointerId);if(!d)return;const dy=e.clientY-d.y,px=Math.max(36,Math.min(90,innerHeight*.14));
      // throttle thumb dragged down = weight back (+), brake thumb dragged up = weight forward (-); 10 px dead zone
      d.v=d.c==='throttle'?Math.max(0,Math.min(1,(dy-10)/px)):-Math.max(0,Math.min(1,(-dy-10)/px));touch.dragLean=arena?0:[...dragLean.values()].reduce((a,x)=>Math.abs(x.v||0)>Math.abs(a)?x.v:a,0);}); // v2.1-32: no sliding-thumb lean on gas/brake in the Playground
    if(c==='brake')b.addEventListener('pointermove',e=>{if(held.get(e.pointerId)!=='brake'||brakeLockId===e.pointerId)return;const t=ui.querySelector('[data-t="throttle"]')?.getBoundingClientRect();if(t&&e.clientX>=t.left&&e.clientX<=t.right&&e.clientY>=t.top&&e.clientY<=t.bottom){brakeLockId=e.pointerId;touch.throttle=1;brakeLockUi();}});
    const up=e=>{e.stopPropagation();if(held.get(e.pointerId)!==c)return;held.delete(e.pointerId);if(dragLean.delete(e.pointerId))touch.dragLean=[...dragLean.values()].reduce((a,x)=>Math.abs(x.v||0)>Math.abs(a)?x.v:a,0);if(brakeLockId===e.pointerId){brakeLockId=null;brakeLockUi();if(![...held.values()].includes('throttle'))touch.throttle=0;}if([...held.values()].includes(c))return;touch[c]=0;delete b.dataset.pressed;b.style.filter=''};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,up);
  });
  const stopHudPointer=e=>e.stopPropagation();
  ui.querySelectorAll('button,[data-t],[data-r],.ride-controls,.ride-toolbar,.ride-dpad,.ride-pause-fab,.ride-pause-menu').forEach(n=>{
    for(const ev of ['pointerdown','pointermove','pointerup','pointercancel']) n.addEventListener(ev,stopHudPointer);
  });
  const setZoom=z=>{camZoom=Math.max(.12,Math.min(1.8,z));};
  const zoomWheel=e=>{if(!freeRoam)return;e.preventDefault();setZoom(camZoom*Math.exp(e.deltaY*.0012));};
  const zoomKey=e=>{if(!freeRoam||e.repeat&&false)return;if(e.key==='+'||e.key==='='||e.key==='PageUp')setZoom(camZoom/1.15);else if(e.key==='-'||e.key==='_'||e.key==='PageDown')setZoom(camZoom*1.15);};
  const pinch=new Map();let pinchD=0,pinchZ=1;
  const pinchDown=e=>{if(!freeRoam||e.pointerType!=='touch')return;if(e.target?.closest?.('button,[data-t],[data-r],.ride-controls,.ride-toolbar,.ride-dpad,.ride-pause-fab,.ride-pause-menu'))return;pinch.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch.size===2){const [a,b]=[...pinch.values()];pinchD=Math.hypot(a.x-b.x,a.y-b.y)||1;pinchZ=camZoom;lookOff();}};
  const pinchMove=e=>{if(!pinch.has(e.pointerId))return;pinch.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch.size===2){const [a,b]=[...pinch.values()];setZoom(pinchZ*pinchD/(Math.hypot(a.x-b.x,a.y-b.y)||1));}};
  const pinchUp=e=>{pinch.delete(e.pointerId);};
  const lookOn=e=>{
    if(pinch.size>=2)return;
    if(!freeRoam||reviewing||finished||paused||s.crashed||lookDrag!=null)return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    if(e.target?.closest?.('button,[data-t],[data-r],.ride-controls,.ride-toolbar,.ride-dpad,.ride-pause-fab,.ride-pause-menu'))return;
    e.preventDefault();
    lookDrag=e.pointerId;lookLast={x:e.clientX,y:e.clientY};lookVY=0;lookVP=0;
    try{R.domElement.setPointerCapture(e.pointerId)}catch{}
  };
  const lookMove=e=>{
    if(lookDrag==null||e.pointerId!==lookDrag)return;
    e.preventDefault();
    const dx=e.clientX-lookLast.x,dy=e.clientY-lookLast.y;
    lookLast={x:e.clientX,y:e.clientY};
    // drag the view the way your finger moves (was inverted)
    lookYaw=Math.max(-2.7,Math.min(2.7,lookYaw+dx*0.0055));
    lookPitch=Math.max(-0.45,Math.min(0.55,lookPitch-dy*0.0045));lookHold=1;
  };
  const lookOff=e=>{
    if(lookDrag==null)return;
    if(e&&e.pointerId!==lookDrag&&e.type!=='lostpointercapture')return;
    lookDrag=null;lookLast=null;
    try{if(e)R.domElement.releasePointerCapture(e.pointerId)}catch{}
  };
  R.domElement.addEventListener('pointerdown',pinchDown);R.domElement.addEventListener('pointermove',pinchMove);for(const ev of ['pointerup','pointercancel'])R.domElement.addEventListener(ev,pinchUp);
  R.domElement.addEventListener('wheel',zoomWheel,{passive:false});addEventListener('keydown',zoomKey);
  R.domElement.addEventListener('pointerdown',lookOn,{passive:false});
  R.domElement.addEventListener('pointermove',lookMove,{passive:false});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])R.domElement.addEventListener(ev,lookOff);

  const releaseControls=()=>{hopQueued=false;held.clear();dragLean.clear();brakeLockId=null;brakeLockUi();for(const key of Object.keys(touch))touch[key]=0;for(const key of Object.keys(keys))delete keys[key];leanControls.release();steerSlider.release();stick.release();lookDrag=null;lookLast=null;ui.querySelectorAll('[data-t]').forEach(b=>{b.style.filter='';delete b.dataset.pressed})};
  const visibility=()=>{if(document.hidden){releaseControls();replay.setCaptureActive?.(false)}};
  const appCovered=()=>{if(document.hidden||document.body.dataset.playerView)return true;for(const n of document.querySelectorAll('[role=menu],[role=dialog],[aria-modal="true"]'))if(!el.contains(n)&&!n.hidden&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden')return true;return false};
  addEventListener('blur',releaseControls);document.addEventListener('visibilitychange',visibility);
  $('[data-r="back"]').onclick = () => close(); $('[data-r="reset"]').onclick = () => respawn();
  const restartRun=()=>{finished=true;respawn();};
  let replacementStop=null;const switchLevel=(next)=>{const dest=typeof next==='string'?next:(level==='flat'?'trials':'flat');if(dest===level)return;localStorage.setItem('wk-level',dest);stop(false);replacementStop=mountRide(el,{stats,build,onResult,onClose,lowDetail:qualityPick.manual,quality:qualityMon.state().tier,qualityManual:qualityPick.manual,pixelRatioCap:maxPR,theme:TH});};$('[data-r="level"]').onclick=()=>switchLevel();
  pauseUi = mountRidePause(ui, {
    getPaused: () => paused,
    setPaused: (v) => { paused = v; },
    onRespawn: () => respawn(),
    onRestart: () => restartRun(),
    onMode: (next) => switchLevel(next),
    onReplay: () => { paused = true; el.toggleAttribute('data-wk-paused', true); replay.openFromPause(); },
    onGallery: () => { paused = true; el.toggleAttribute('data-wk-paused', true); pauseUi?.syncFab(true); replay.openGallery?.(); },
    onWorkshop: () => close(), // same as the toolbar back button: save the ride result and return to the workshop
    releaseControls,
    rootEl: el,
    level,
    flat,
  });
  function cancelRewindHold() {
    rewinding = false; rewindPtr = null; rewindPrevX = null;
    const btn = ui.querySelector('[data-r="rewind"]');
    if (btn) { btn.classList.remove('is-held'); btn.setAttribute('aria-pressed', 'false'); }
  }
  function respawn() {
    chaseFollowX=null;chaseHorizon=0;chaseTakeoffY=0;
    cancelRewindHold();
    const restarting = finished;
    const keep = restarting ? {} : {score:s.score,odo:s.odo,battery:s.battery,bestWheelie:s.bestWheelie};
    // v2.1-30: RECOVER puts you back where you crashed (facing the way you were going), not at a checkpoint
    const spot = restarting ? null : {x:s.x,z:s.z||0,yaw:s.moveYaw??s.yaw??0};const coinsKept=s.coins||0;
    if (restarting) {
      lastCP = 2;
      cpI = flips = maxScore = finishTime = photoCount = 0;
      photoDelay = -1;
      finished = reported = finishTumble = false;
      finishPanel.hidden = true;
      slowButton.hidden = !slowUnlocked;
      photos.replaceChildren();
      delete el.dataset.wkFinished;
      for (const particle of parts) particle.life = 0;
      for (const particle of smokeParts) particle.life = 0;
      hud.trick.textContent = '';
    }
    endSlow();
    if (restarting) {
      replay.clear();
      replayTail = 0;
    }
    crashRig?.restore();
    crashRig = null;
    releaseControls();
    paused = false;
    el.removeAttribute('data-wk-paused');
    pauseUi?.close(true);
    pauseUi?.syncFab(false);
    delete el.dataset.wkCrashed;
    recover.hidden = true;
    if (spot && !freeRoam) s = Object.assign(makeState(P, Math.max(lastCP, spot.x - 1.5), ter), keep);
    else s = Object.assign(makeState(P, lastCP, ter), keep);
    if (neon) { // Neon Canal: back onto the line where you crashed (before the run-up if you fell in a gap); restart = start line
      const S=restarting?2:neonSafeS(Math.max(2,neonProject(spot?.x??2,spot?.z??0).s-2)),p=neonAt(S),base=makeState(P,0,ter).y-ter.height(0,0);
      Object.assign(s,{x:p.x,z:p.z,yaw:p.yaw,moveYaw:p.yaw,trackS:S,trackI:p.i,y:neonProfile(S)+base});if(restarting){s.coins=0;neonWorld?.resetCoins();}
    } else if (spot && freeRoam && Number.isFinite(spot.x)) {
      let {x,z}=spot;const yaw=spot.yaw; // side view snaps it square to the track on the next step
      // step clear of whatever you hit (tree, rock, post) so you don't start inside it
      for(const q of ter.posts||[]){const dx=x-q.x,dz=z-q.z,d=Math.hypot(dx,dz),need=q.r+1.2;if(d<need){const k=d>1e-6?need/d:0;x=q.x+(k?dx*k:-Math.cos(yaw)*need);z=q.z+(k?dz*k:-Math.sin(yaw)*need);}}
      const base=makeState(P,0,ter).y-(ter.height?ter.height(0,0):0);
      Object.assign(s,{x,z,yaw,moveYaw:yaw,y:(ter.height?ter.height(x,z):0)+base});
    } else if (arena) s.z = SIDE_TRACK.z;
    if(neon&&!restarting)s.coins=coinsKept;
    if (restarting && !P.pedal && P.batteryWh <= 0) s.battery = 0;
    if(jolt?.ready&&physics==='jolt')jolt.adopt(s);
    pivot.position.set(s.x, s.y, s.z||0);
    pivot.rotation.set(0, -(s.yaw||0), 0);
    lookYaw=0;lookPitch=0;lookVY=0;lookVP=0;lookDrag=null;lookLast=null;airClose=0;chasePosX=null;
    crashT = 0;
    msg = restarting ? "GO!" : "RECOVERED";
    msgT = restarting ? 2 : .7;
  }
  const crashActions=document.createElement('div');crashActions.className='ride-crash-actions';crashActions.hidden=true;
  const recover=document.createElement('button');recover.dataset.r='recover';recover.type='button';recover.className='ride-crash-btn';recover.textContent='↻ RECOVER';recover.setAttribute('aria-label','Instant recover');recover.onclick=respawn;
  const crashReplay=document.createElement('button');crashReplay.dataset.r='crash-replay';crashReplay.type='button';crashReplay.className='ride-crash-btn';crashReplay.textContent='● REPLAY';crashReplay.setAttribute('aria-label','Replay last 20 seconds');crashReplay.onclick=()=>{paused=true;el.toggleAttribute('data-wk-paused',true);releaseControls();pauseUi?.syncFab(true);replay.openFromPause();};
  const rewind=document.createElement('button');rewind.dataset.r='rewind';rewind.type='button';rewind.className='ride-rewind';rewind.hidden=true;rewind.setAttribute('aria-label','Rewind. Hold to rewind the ride');rewind.setAttribute('aria-pressed','false');rewind.innerHTML='<span aria-hidden="true">⏪</span><span>REWIND</span>';
  function applyRideSnapshot(frame,{ease=true,clearCrash=false}={}){
    const meta=restoreRideState(s,frame)||{};
    if(arena&&frame?.meta?.jolt)jolt?.restore(frame.meta.jolt,s);
    if(meta.dirt!=null)dirt=meta.dirt;
    if(meta.wear)wear={...meta.wear};
    if(meta.flips!=null)flips=meta.flips;
    if(meta.maxScore!=null)maxScore=meta.maxScore;
    if(meta.lastCP!=null)lastCP=meta.lastCP;
    crashRig?.restore();crashRig=null;
    if(clearCrash||!s.crashed){
      delete el.dataset.wkCrashed;
      recover.hidden=true;
      msgT=0;
    }else{
      el.dataset.wkCrashed='true';
      recover.hidden=false;
    }
    endSlow();
    if(ease)dropInEase=1;
    paused=false;
    el.removeAttribute('data-wk-paused');
    pauseUi?.syncFab(false);
    if(pauseUi?.menu)pauseUi.menu.hidden=true;
    releaseControls();
    sideCam.reset();
    last=performance.now();
    globalThis.__WK_LAST_DROP__={frame,restored:structuredClone(s)};
    return meta;
  }
  function applyRewindPose(){
    const frame=replay.buffer?.at(rewindT,true);
    if(!frame)return;
    restoreRideState(s,frame);
    const meta=frame.meta||{};
    if(arena&&meta.jolt)jolt?.restore(meta.jolt,s);
    if(meta.dirt!=null)dirt=meta.dirt;
    if(meta.wear)wear={...meta.wear};
  }
  function startRewind(e){
    if(finished||reviewing||paused||!s.crashed||rewinding)return;
    if(!replay.buffer?.length)return;
    e.preventDefault();e.stopPropagation();
    try{rewind.setPointerCapture(e.pointerId)}catch{}
    rewindPtr=e.pointerId;
    rewinding=true;
    rewindPrevX=null;
    rewindT=replay.buffer.at(1).t;
    rewind.classList.add('is-held');
    rewind.setAttribute('aria-pressed','true');
    crashRig?.restore();crashRig=null;
    replay.setCaptureActive?.(false);
    applyRewindPose();
  }
  function endRewind(e){
    if(e)e.stopPropagation();
    if(!rewinding)return;
    if(e&&rewindPtr!=null&&e.pointerId!==rewindPtr&&e.type!=='lostpointercapture')return;
    rewinding=false;rewindPtr=null;rewindPrevX=null;
    rewind.classList.remove('is-held');
    rewind.setAttribute('aria-pressed','false');
    try{if(e)rewind.releasePointerCapture(e.pointerId)}catch{}
    const buf=replay.buffer,frame=buf?.at(rewindT,true);
    if(frame){
      applyRideSnapshot(frame,{ease:false,clearCrash:false});
      buf.trimTo?.(rewindT,true);
    }
  }
  rewind.addEventListener('pointerdown',startRewind);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])rewind.addEventListener(type,endRewind);
  crashActions.append(recover,crashReplay);ui.append(crashActions,rewind);
  Object.defineProperty(recover,'hidden',{configurable:true,get(){return crashActions.hidden},set(v){crashActions.hidden=!!v;rewind.hidden=!!v;if(!v)tricksMenu.close();}});
  function report() { if (reported) return; reported = true; saveCond({ dirt: Math.min(1, dirt), wear }); try { onResult?.({ score: Math.round(maxScore), flips, wheelieT: s.bestWheelie || 0, finished, money: Math.round(maxScore / 10) }); } catch (e) { console.warn(e); } }
  function close() { report(); onClose?.(); }
  // loop
  let raf = 0, last = performance.now(), fxT = 0, spinVis = 0;
  let cameraView='side',cameraBlend=0,cameraReady=false,airClose=0;
  let sideYaw=null;
  const airPedal={wasAir:false,thrHeld:false,brkHeld:false,t:0};let keyLean=0;
  // Camera only: switching view never touches the bike's pose or velocity.
  function setCameraView(view){
    const next=view==='chase'?'chase':'side';
    cameraView=next;
    el.dataset.wkCam=cameraView;
    // Playground side view = the straight side track: start there (unless already on it), heading +X.
    if(arena&&!neon&&next==='side'&&s&&!s.crashed){const T0=SIDE_TRACK,on=Math.abs((s.z||0)-T0.z)<T0.w/2+1&&s.x>T0.x0-5&&s.x<T0.x0+T0.len+5;
      if(!on)globalThis.__WK_JOLT_RESET__?.({x:T0.x0+3,z:T0.z,yaw:0,vx:0});else{const t=Math.round((s.yaw||0)/Math.PI)*Math.PI;s.yaw=t;s.moveYaw=t;s.sliding=false;}}
    if(!freeRoam&&cameraView!=='chase')steerSlider.release();
    return cameraView;
  }
  const viewLabel=ui.querySelector('.ride-view-label');viewLabel?.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();if(reviewing||finished)return;setCameraView(cameraView==='chase'?'side':'chase');});const hc={},put=(e,k,v)=>{if(hc[k]!==v){hc[k]=v;e.textContent=v}},putHtml=(e,k,v)=>{if(hc[k]!==v){hc[k]=v;e.innerHTML=v}},sty=(k,v)=>{if(hc['s'+k]!==v){hc['s'+k]=v;ui.style[k]=v}};
  const frame = (now) => { raf = requestAnimationFrame(frame); const cameraDt=Math.max(0,Math.min(.25,(now-last)/1000)),rotateLocked=document.body.classList.contains('wk-portrait-lock'),realDt = paused || reviewing || rewinding || rotateLocked ? 0 : Math.min(0.05,cameraDt);
    let timeScale = 1;
    if (slowMo) timeScale = .62;
    else if (dropInEase > 0) { timeScale = 0.5 + (1 - dropInEase) * 0.5; dropInEase = Math.max(0, dropInEase - cameraDt); }
    const dt = realDt * timeScale;
    last = now;
    // Replay video + Drop In buffer hold live riding only: app menus/overlays opened over the ride (More, Settings,
    // Shop, Garage...) don't pause the ride itself, so they must stop capture too.
    const capturing = !paused && !reviewing && !finished && !rewinding && !rotateLocked && !appCovered();
    replay.setCaptureActive?.(capturing);
    if (capturing) replay.buffer?.tick(cameraDt); // capture clock = replay video timeline
    let rewindDx=0;
    if(rewinding&&replay.buffer?.length){
      const startT=replay.buffer.at(0).t;
      rewindT=Math.max(startT,rewindT-2*cameraDt);
      applyRewindPose();
      rewindDx=rewindPrevX==null?0:s.x-rewindPrevX;
      rewindPrevX=s.x;
    }
    const activeTime = realDt > 0 ? cameraDt : 0;
    if (replayTail > 0 && (replayTail -= activeTime) <= 0) replay.finish();
    if (finished && realDt > 0) {
      finishTime += activeTime;
      if (finishTime >= 1) finishPanel.hidden = false;
      if (!finishTumble) {
        s.vx = finishSpeed * Math.max(0, 1 - finishTime / (finishFall ? 7 : 5));
        if(freeRoam){const yaw=s.yaw||0;s.x+=s.vx*Math.cos(yaw)*realDt;s.z=(s.z||0)+s.vx*Math.sin(yaw)*realDt;s.y+=(ter.height(s.x,s.z)+finishHeight-s.y)*Math.min(1,realDt*8);}
        else {s.x += s.vx * realDt;s.y += (ter.h(s.x) + finishHeight - s.y) * Math.min(1, realDt * 8);}
        s.pitch *= Math.exp(-5 * realDt);
        if (finishFall && finishTime >= 5) {
          s.pitch = -.32;
          s.w = -2.3;
          finishTumble = true;
        }
      }
    }
    if(cameraDt>0&&cameraDt<.25){fpsTime+=cameraDt;fpsFrames++;if(fpsTime>=.5){fpsLast=fpsFrames/fpsTime;fpsFrames=0;fpsTime=0;}}
    if(!paused&&!reviewing){const qa=qualityMon.sample(cameraDt);if(qa){qualityLog.push(qa.type);if(qa.type==='down'){maxPR=Math.max(.75,maxPR*.8);if(R.shadowMap.enabled){R.shadowMap.enabled=false;scene.traverse(o=>{if(o.material)for(const m of [].concat(o.material))m.needsUpdate=true})}}}}
    leanControls.update(dt);steerSlider.update(dt);
    // Playground: in the air the arrow keys tilt the bike (up = nose down / front flip, down = nose up / backflip).
    const airArrows=arena&&!(s.ground[0]||s.ground[1])&&!s.crashed;
    inp.throttle = Math.max(touch.throttle, keys.w || ((!freeRoam||arena)&&!airArrows&&keys.arrowup) ? 1 : 0); inp.brake = Math.max(touch.brake, keys.s || ((!freeRoam||arena)&&!airArrows&&keys.arrowdown) ? 1 : 0);
    const sideView=!!freeRoam&&cameraView==='side';
    const leanKey=arena?((keys[' ']||(sideView&&keys.d)||(airArrows&&keys.arrowup)?1:0)-(keys.shift||(sideView&&keys.a)||(airArrows&&keys.arrowdown)?1:0)+(sideView?Math.max(-1,Math.min(1,(touch.steerRight||0)-(touch.steerLeft||0))):0)):freeRoam?((keys.arrowup||(sideView&&keys.d)?1:0)-(keys.arrowdown||(sideView&&keys.a)?1:0)):(keys.arrowright||keys.d?1:0)-(keys.arrowleft||keys.a?1:0);
    // Playground: keys are on/off, so ease the lean in (full in ~0.35 s) and the front comes up progressively, not in a snap
    if(arena){const k=Math.min(1,dt*(Math.abs(leanKey)>Math.abs(keyLean)?3:6));keyLean+=Math.max(-k,Math.min(k,leanKey-keyLean));}else keyLean=leanKey;
    inp.lean = Math.max(-1, Math.min(1, touch.lean+(touch.leanForward||0)-(touch.leanBack||0)+keyLean-(touch.dragLean||0)))*-1;
    // Playground air control on the pedals (keyboard W/S only since v2.1-30): in the air, throttle rotates the bike forward (front flip),
    // brake rotates it back (backflip). Adds to any lean input.
    // Gas/brake already held at take-off don't count until you let go and press again, so holding the
    // throttle over a jump doesn't nose-dive you.
    {const airNow=arena&&!(s.ground[0]||s.ground[1])&&!s.crashed;
     if(!airNow){airPedal.thr=false;airPedal.brk=false;airPedal.wasAir=false;airPedal.t=0;}
     else{if(!airPedal.wasAir){airPedal.wasAir=true;airPedal.t=0;airPedal.thrHeld=(inp.throttle||0)>.1;airPedal.brkHeld=(inp.brake||0)>.1;}
       airPedal.t+=dt;
       if((inp.throttle||0)<=.1)airPedal.thrHeld=false;if((inp.brake||0)<=.1)airPedal.brkHeld=false;
       // a pedal held from take-off joins in after a moment in the air (so a small hop doesn't nose-dive you,
       // but on a real jump you can keep holding W or S to rotate)
       const held=Math.max(0,Math.min(1,(airPedal.t-.25)/.3));
       // v2.1-30: on touch the right-thumb gas/brake buttons don't rotate the bike (lean with the stick instead);
       // keyboard W/S still do, as asked for on PC
       const kThr=keys.w?1:0,kBrk=keys.s?1:0;
       const thr=kThr*(airPedal.thrHeld?held:1),brk=kBrk*(airPedal.brkHeld?held:1);
       inp.lean=Math.max(-1,Math.min(1,inp.lean+brk-thr));}}
    // Side view: A/D lean (see leanKey), touch steer still steers.
    // Playground side view is the side-scroller: no sideways steering at all.
    inp.steer = freeRoam&&!(arena&&cameraView==='side')?Math.max(-1,Math.min(1,(touch.steerRight||0)-(touch.steerLeft||0)+(!sideView&&(keys.d||keys.arrowright)?1:0)-(!sideView&&(keys.a||keys.arrowleft)?1:0))):0;
    if(arena){inp.burnout=rideToggles.burnout;inp.stand=rideToggles.stand;inp.brakeLock=brakeLockId!=null;}
    inp.hop=hopQueued||touch.hop||keys[" "]?1:0;hopQueued=false;inp.trick=touch.trick||keys.q?1:0;inp.whip=0;inp.tailwhip=touch.tailwhip||keys.z||keys.e?1:0;inp.barspin=touch.barspin||keys.x?1:0;inp.superman=touch.superman||keys.c?1:0;inp.nohander=touch.nohander||keys.v?1:0;inp.cancan=touch.cancan||keys.b?1:0;inp.nacnac=touch.nacnac||keys.n?1:0;
    // Playground style moves (toggles): one-hander, knee-knock. Air tricks/HOP are classic-only.
    if(arena){inp.hop=0;inp.trick=0;inp.oneHand=rideToggles.onehand?1:0;inp.kneeKnock=rideToggles.kneeknock?1:0;s.oneHand=!!inp.oneHand&&!s.crashed;s.kneeKnock=!!inp.kneeKnock&&!s.crashed;}
    if (finished) Object.keys(inp).forEach(key => { inp[key] = 0; });
    if (!s.crashed && !finished) {
      const useJolt=physics==='jolt'&&jolt?.ready&&jolt.enabled;
      if(useJolt){
        if(dt>0){
          jolt.step(s,P,inp,dt,ter,step);
          s.odo=(s.odo||0)+Math.abs(s.vx||0)*dt; // HUD distance (Jolt path skips ride-loop's odometer)
          if(capturing)replay.recordStep(s,dt,{dirt,wear,flips,maxScore,lastCP,jolt:jolt.snapshot()});
        }
      }else{
        const n = Math.ceil(dt * 480);
        if(arena&&!neon&&cameraView==='side'&&!s.crashed){const t=Math.round((s.yaw||0)/Math.PI)*Math.PI;s.yaw=t;s.moveYaw=t;s.sliding=false;s.lean=0;s.steer=0;}
        for (let k = 0; k < n; k++) {
          step(s, P, inp, dt / n, ter);
          if(neon&&!s.crashed)neonLock(s,dt/n);
          if (dt > 0 && capturing) replay.recordStep(s, dt / n, { dirt, wear, flips, maxScore, lastCP });
        }
        // Playground teleport rings (e.g. the downhill start): ride through one to be put at its target.
        soccer?.step(dt,s,P);
        if(neon&&!s.crashed){ // coins: ride through them; falling into a gap is a splash
          for(let k=0;k<NEON_COINS.length;k++){const c=NEON_COINS[k];if(Math.abs(c.s-(s.trackS||0))<1.4&&Math.abs(c.y-(s.y-.35))<1.5&&neonWorld.takeCoin(k)){s.coins=(s.coins||0)+1;s.score+=10;}}
          if(neonInGap(s.trackS||0)&&s.y<NEON.water+1.6){s.crashed='SPLASH! IN THE CANAL';s.events.push({type:'crash',why:s.crashed,part:'frame'});}
        }
        if(arena&&!neon&&!s.crashed&&cameraView!=='side')for(const pd of PLAYGROUND_PADS){if(Math.hypot(s.x-pd.x,(s.z||0)-pd.z)<pd.r){if(pd.level){switchLevel(pd.level);break;}globalThis.__WK_JOLT_RESET__?.({...pd.to});break;}}
      }
    }
    if (s.crashed) endSlow();
    // events -> FX, wear, messages
    for (const ev of s.events.splice(0)) {
      if (!flat && photoCount < 3 && photoDelay < 0 &&
          (ev.type === 'crash' ? Math.random() < .45 : ev.type === 'trick' && ev.pts >= 100 && Math.random() < .3)) {
        photoDelay = ev.type === 'crash' ? .28 : 0;
      }
      if (ev.type === "trick") { hud.trick.textContent = ev.t + (ev.pts ? " +" + ev.pts : ""); hud.trick.style.opacity = 1; if (/FLIP/.test(ev.t)) flips += +(ev.t.match(/^(\d)x/)?.[1] || 1); }
      if (ev.type === "land") { const rx = s.x - P.wb * P.comBack; for (let i = 0; i < 18; i++) emit(rx + (Math.random() - 0.5), ter.h(rx) + 0.05, (Math.random() - 0.5) * 4, Math.random() * 2.5, "#d9b48a", 0.9, 4); if (ev.v < -6) { msg = "HARD LANDING"; msgT = 0.8; wear.suspension = (wear.suspension || 0) + 0.04; } if(freeRoam&&ev.v<-4)camShake=Math.min(.16,-ev.v*.022); }
      if (ev.type === "bottom") { msg = "BOTTOMED OUT – MORE SUSPENSION!"; msgT = 1; wear.shock = (wear.shock || 0) + 0.02; }
      if (ev.type === "scrape") { for (let i = 0; i < 2; i++) emit(ev.x, ev.y, -s.vx * 0.3 - Math.random() * 2, Math.random() * 2, Math.random() > 0.5 ? "#ffd23d" : "#ff8c1a", 0.35, 6, 0.6); }
      if (ev.type === "crash") { msg = "CRASH! " + ev.why; msgT = 99; hud.trick.textContent = ""; for (let i = 0; i < 30; i++) emit(s.x, s.y, (Math.random() - 0.5) * 6, Math.random() * 4, "#c9844a", 1.2, 8); }
    }
    for (const k in s.wear) { wear[k] = (wear[k] || 0) + s.wear[k]; } s.wear = {};
    if(!s.crashed&&!paused){
      const yaw=freeRoam?(s.yaw||0):0,cy=Math.cos(yaw),sy=Math.sin(yaw);
      const axles=[-P.wb*P.comBack,P.wb*(1-P.comBack)];
      // tyre tracks: pressed in harder under load, braking, drive and slides; light on tarmac
      if(tracks&&dt>0){for(let i=0;i<2;i++){const bx=s.x+cy*axles[i],bz=(s.z||0)+sy*axles[i],drive=i===(P.driveAxle==='front'?1:0)?(s.thr||0)*.25:0;
        const press=.3+(s.comp?.[i]||0)*.35+(inp.brake||0)*.3+drive+Math.min(.5,Math.abs(s.slip?.[i]||0)*.08)+(s.sliding?.45:0);
        tracks.mark(i,{x:bx,z:bz},!!s.ground[i]&&Math.abs(s.vx||0)>.3,press*(bx>1500-520-260?.35:1));}tracks.update(dt);}
      // dirt kicked up from the driven wheel when you get on the gas on dirt/grass (not only when it spins)
      if(arena&&dt>0&&(s.thr||0)>.55&&s.ground[P.driveAxle==='front'?1:0]&&Math.abs(s.vx||0)<14&&!P.pedal){const i=P.driveAxle==='front'?1:0,bx=s.x+cy*axles[i],bz=(s.z||0)+sy*axles[i];
        if(bx<1500-520-260&&Math.random()<(s.thr-.5)*dt*30){const gy=ter.height(bx,bz)+.04;emit(bx,gy,-cy*(1.5+Math.random()*2.5),.8+Math.random()*1.8,Math.random()>.5?'#6a4228':'#8a5a32',.45,9.8,.6,bz);}}
      for(let i=0;i<2;i++){
        if(!s.ground[i])continue;
        const slip=s.slip?s.slip[i]:(s.burnout&&i===(P.driveAxle==='front'?1:0)?8:0);
        const spinning=Math.abs(slip)>=1.4||(s.burnout&&i===(P.driveAxle==='front'?1:0))||(i===0&&Math.abs(s.drift||0)>.2);
        if(!spinning)continue;
        const bx=s.x+cy*axles[i],bz=freeRoam?(s.z||0)+sy*axles[i]:0,gy=(freeRoam?ter.height(bx,bz):ter.h(bx))+.04;
        const onDirt=freeRoam?(environment.isDirt?.(bx,bz)??((ter.track&&ter.track.nearest(bx,bz).dist<(ter.track.width||6)/2+3.5)||ter.height(bx,bz)>.04)):true;
        const surface=environment.surfaceAt?.(bx,bz)||(onDirt?'dirt':'asphalt');
        const absS=Math.abs(slip);
        // Light counts (mobile): 1–2 bits per slipping wheel, only at the contact patch.
        if(surface==='asphalt'){
          const n=Math.min(2,1+absS*.2);
          for(let k=0;k<n;k++){const j=smokeIndex++%smokeParts.length,particle=smokeParts[j],life=1.2+Math.random()*.6;Object.assign(particle,{x:bx+(Math.random()-.5)*.05,y:gy+.12,z:bz+(Math.random()-.5)*.05,vx:-cy*(.3+Math.random()*.8)+(Math.random()-.5)*.4,vy:.3+Math.random()*.5,life,max:life,sz:.7+Math.random()*.4,a:.34});smoke.setColorAt(j,puffCol.asphalt);}
        }else if(surface==='grass'){
          const n=Math.min(3,1+absS*.2);
          for(let k=0;k<n;k++)emit(bx+(Math.random()-.5)*.06,gy,-cy*(1.2+Math.random()*2.2)+ (Math.random()-.5)*1.2,1.4+Math.random()*2.2,Math.random()>.5?'#4d8a38':'#2f6a32',.5,12,.55,bz+(Math.random()-.5)*.06);
        }else{
          const n=Math.min(2,1+absS*.18);
          for(let k=0;k<n;k++){const j=smokeIndex++%smokeParts.length,particle=smokeParts[j],life=.8+Math.random()*.5;Object.assign(particle,{x:bx+(Math.random()-.5)*.05,y:gy+.1,z:bz+(Math.random()-.5)*.05,vx:-cy*(.25+Math.random()*.6)+(Math.random()-.5)*.35,vy:.2+Math.random()*.35,life,max:life,sz:.55+Math.random()*.35,a:.22});smoke.setColorAt(j,puffCol.dirt);}
          for(let k=0;k<Math.min(2,1+absS*.15);k++)emit(bx,gy,-cy*(2+Math.random()*3+absS*.15),1.2+Math.random()*2.4,Math.random()>.6?'#6a4228':'#8a5a32',.5,9.8,.85,bz);
        }
      }
      if(s.burnout){msg='BURNOUT';msgT=.25;}
    }
    // roost + splash + dirt build-up
    const rx = s.x + Math.cos(s.pitch) * (-P.wb * P.comBack) + Math.sin(s.pitch) * hC, onRear = s.ground[0];
    if (!paused && onRear && inp.throttle && Math.abs(s.vx) > 0.5 && Math.random() < 0.55) {
      const rz=freeRoam?(s.z||0):0;
      const surf=environment.surfaceAt?.(rx,rz)||(environment.isDirt?.(rx,rz)!==false?'dirt':'asphalt');
      if(ter.inPuddle(rx)) emit(rx - P.R * 0.6, ter.h(rx) + 0.05, -2 - Math.random() * 3 - Math.abs(s.vx) * 0.2, 1 + Math.random() * 2.5, "#7fb4d6", 0.7);
      else if(surf==='grass'&&Math.random()<0.7) emit(rx - P.R * 0.6, (freeRoam?ter.height(rx,rz):ter.h(rx)) + 0.05, -1.6 - Math.random() * 2.2, 1 + Math.random() * 2.2, Math.random()>.5?'#4d8a38':'#2f6a32', 0.5, 12, .5, rz);
      else if(surf==='dirt') emit(rx - P.R * 0.6, (freeRoam?ter.height(rx,rz):ter.h(rx)) + 0.05, -2 - Math.random() * 3 - Math.abs(s.vx) * 0.2, 1 + Math.random() * 2.5, "#a8693a", 0.7);
    }
    if (!paused && ter.inPuddle(s.x) && (s.ground[0] || s.ground[1])) { dirt += dt * 0.05 * Math.min(10, Math.abs(s.vx)); if (Math.abs(s.vx) > 2 && Math.random() < 0.9) for (let i = 0; i < 3; i++) emit(s.x + (Math.random() - 0.5), ter.h(s.x) + 0.05, (Math.random() - 0.3) * s.vx * 0.4, 2 + Math.random() * 3, "#9fd0ef", 0.8); }
    else if (s.ground[0] || s.ground[1]) dirt += dt * 0.0015 * Math.abs(s.vx);
    if ((fxT += dt) > 0.6) { fxT = 0; applyCondition(bike, { dirt: Math.min(1, dirt), wear: {} }); const fr = bike.getObjectByName("wk:part:fender_r"); if (fr) { const w = 0; fr.visible = w < 1; if (w >= 0.4 && w < 1) fr.rotation.z = -0.12; } }
    // particles update
    for (let i = 0; i < NP; i++) { const p = parts[i]; if (p.life > 0) { p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z=(p.z||0)+(p.vz||0)*dt; const gy=freeRoam?ter.height(p.x,p.z||0):ter.h(p.x); if (p.y < gy) { p.y = gy; p.vy *= -0.2; p.vx *= 0.5; p.vz=(p.vz||0)*.5; } o3.position.set(p.x, p.y, p.z); o3.scale.setScalar(Math.max(0.01, p.life / p.max) * p.sz); } else o3.scale.setScalar(0); o3.updateMatrix(); pm.setMatrixAt(i, o3.matrix); }
    pm.instanceMatrix.needsUpdate = true;
    o3.quaternion.copy(cam.quaternion);
    smokeParts.forEach((particle,i)=>{if(particle.life>0){particle.life-=dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.vx*=1-1.2*dt;particle.vy*=1-.8*dt;const age=1-particle.life/particle.max;o3.position.set(particle.x,particle.y,particle.z);o3.scale.setScalar(particle.sz*(.35+age*1.4));smokeAlpha.array[i]=particle.a*Math.min(1,age*6)*Math.min(1,particle.life*1.6);}else{o3.scale.setScalar(0);smokeAlpha.array[i]=0;}o3.updateMatrix();smoke.setMatrixAt(i,o3.matrix)});o3.quaternion.identity();smoke.instanceMatrix.needsUpdate=true;smokeAlpha.needsUpdate=true;if(smoke.instanceColor)smoke.instanceColor.needsUpdate=true;
    // Rider and bike inherit momentum, then collide as separate constrained bodies.
    const bikeZ=freeRoam?(s.z||0):0,bikeYaw=freeRoam?(s.yaw||0):0;
    if(rewinding){pivot.position.set(s.x,s.y,bikeZ);pivot.rotation.set(0,-bikeYaw,s.pitch);}
    else if(s.crashed || finishTumble){if(!crashRig){stuntRig.restore();s.stunt=null;pivot.position.set(s.x,s.y,bikeZ);pivot.rotation.set(0,-bikeYaw,s.pitch);crashRig=makeCrashRig(T,scene,body,pivot,bike,A,riderModel,P,ter,s,environment.colliders||[]);releaseControls();if (!finished) { el.dataset.wkCrashed='true';recover.hidden=false; }}crashT+=dt;crashRig.step(dt);}
    else { pivot.position.set(s.x, s.y, bikeZ); pivot.rotation.z = s.pitch; }
    // Jolt ride height sags below classic comH. Without this the visual tyres
    // slip into the floor (the mesh is offset for a fixed comH at comp=0).
    if(physics==='jolt'&&!crashRig&&(s.ground[0]||s.ground[1])){
      const gy=ter.height? (ter.height(s.x,s.z||0)||0):0;
      const restAxle=s.y-(P.comH||.9)+(P.R||.33);
      const rearY=restAxle+(s.comp[0]||0)*(P.travelR||.12)*.8;
      const frontY=restAxle+(s.comp[1]||0)*(P.travelF||.14)*.8;
      const lowest=Math.min(rearY,frontY)-(P.R||.33);
      if(lowest<gy-0.005) pivot.position.y += (gy-lowest);
    }
    spinVis = s.spinV ? s.spin : s.whip ? Math.sin(Math.min(1, s.air * 2) * Math.PI) * 0.9 : 0; if(!crashRig){const kappa=s.curvature||0,leanT=s.joltRoll!=null?s.joltRoll:(freeRoam&&(s.ground[0]||s.ground[1])?Math.max(-.75,Math.min(.75,(s.lean??Math.atan((s.vx||0)*(s.vx||0)*kappa/9.8))*.75)):freeRoam?visRoll*Math.exp(-.35*Math.max(cameraDt,0)):0); /* in the air the bike keeps the lean it left the lip with, easing off slowly */visRoll+=(leanT-visRoll)*(1-Math.exp(-(s.joltRoll!=null?18:14)*Math.max(cameraDt,.001)));pivot.rotation.y=-(bikeYaw+spinVis);pivot.rotation.x=visRoll;s.visRoll=visRoll;
      // Lean about the tyre contact line, not the COM: rolling about the COM swung the wheels sideways off
      // the ground (looked floaty). Shift the bike so the contact patches stay planted.
      if(freeRoam&&s.joltRoll==null&&visRoll){const hR=Math.max(.3,s.y-(ter.height?ter.height(s.x,s.z||0):0)),sr=Math.sin(visRoll);pivot.position.x-=Math.sin(bikeYaw)*hR*sr;pivot.position.z+=Math.cos(bikeYaw)*hR*sr;pivot.position.y-=hR*(1-Math.cos(visRoll));}} pivot.updateMatrixWorld();pivot.getWorldQuaternion(meshQ);meshFwd.set(1,0,0).applyQuaternion(meshQ);meshYaw=Math.atan2(meshFwd.z,meshFwd.x);
    // suspension: wheels slide toward the frame by compression*travel
    stuntRig.restore();
    const onGVis=!!(s.ground[0]||s.ground[1]);
    const diveT=onGVis&&!s.reversing?Math.max(0,inp.brake||0)*.42:0;
    const squatT=onGVis&&!s.burnout?Math.max(0,s.thr||0)*.28:0;
    visDive+=(diveT-visDive)*(1-Math.exp(-8*Math.max(dt,.001)));
    visSquat+=(squatT-visSquat)*(1-Math.exp(-8*Math.max(dt,.001)));
    const wheelDist=rewinding?rewindDx:s.vx*dt;
    const axleR=P.R||A.wheelR||.33;
    const omegaAt=i=>{const w=Array.isArray(s.wheelOmega)?s.wheelOmega[i]:NaN;return Number.isFinite(w)?w:null};
    const axleDist=i=>{
      if(rewinding)return rewindDx;
      const w=omegaAt(i);
      // A leftover [0,0] array is truthy; only a finite omega should drive spin.
      // In classic air (or a stale zero after handover) fall back to travel speed.
      if(w!=null&&!(jolt?.air&&Math.abs(w)<1e-3&&Math.abs(s.vx)>0.4))return w*axleR*dt;
      return (Number.isFinite(s.vx)?s.vx:0)*dt;
    };
    const mech={distance:wheelDist,frontDistance:axleDist(1),rearDistance:axleDist(0),driveDistance:axleDist(P.driveAxle==='front'?1:0),rearCompression:crashRig?0:Math.min(1,(build.shock?s.comp[0]||0:0)+visSquat),frontCompression:crashRig?0:Math.min(1,(s.comp[1]||0)+visDive),travelR:P.travelR,travelF:P.travelF,steerAngle:freeRoam?(s.sliding?-s.slideDir*.45*Math.min(1,Math.abs(s.slipAngle||0)/.6):Math.max(-.6,Math.min(.6,(s.steer||0)*Math.min(3,1+Math.abs(s.vx||0)*.15)))):(s.steer||0)};
    // Jolt drives the wheels: the drawn wheel angle is Jolt's own wheel rotation angle (offset kept so a
    // switch from distance-integration, e.g. after a rewind, doesn't jump). Mesh spins -angle about +z.
    const ja=s.wheelAngle;
    if(physics==='jolt'&&jolt?.ready&&!rewinding&&!crashRig&&Array.isArray(ja)&&Number.isFinite(ja[0])&&Number.isFinite(ja[1])&&mechanical){
      if(!wheelAngleOffset)wheelAngleOffset=[(mechanical.state.rearWheelPhase||0)+ja[0],(mechanical.state.wheelPhase||0)+ja[1]];
      mech.rearAngle=wheelAngleOffset[0]-ja[0];mech.frontAngle=wheelAngleOffset[1]-ja[1];
    }else wheelAngleOffset=null;
    const burnoutRear=!!(s.burnout&&Math.abs(omegaAt(0)||0)<8);
    if(burnoutRear&&mech.rearAngle==null)mech.rearDistance=Math.max(mech.rearDistance,18*axleR*dt);
    if(mechanical)mechanical.update(mech);
    else wheels.forEach((ws, i) => ws.forEach(([w, y0]) => (w.position.y = y0 + (s.comp[i] || 0) * (i ? P.travelF : P.travelR) * 0.8)));
    supermanPose=s.stunt?.name==="superman"?Math.sin(Math.PI*Math.min(1,s.stunt.elapsed/s.stunt.duration)):0;if(!crashRig)riderModel.update({lean:inp.lean,superman:supermanPose,s,inp,dt});stuntRig.pose(s.stunt);
    // checkpoints / finish (Legacy trials only; the Playground has none)
    const hitGate=x=>neon?((s.trackS||0)>x):arena?false:(s.x>x);
    while (cpI + 1 < ter.checkpoints.length && hitGate(ter.checkpoints[cpI + 1])) { cpI++; lastCP = ter.checkpoints[cpI] + 1; msg = "CHECKPOINT " + cpI; msgT = 1.2; }
    if (!finished && !s.crashed && hitGate(ter.finish)) {
      finished = true;
      el.dataset.wkFinished = 'true';
      finishSpeed = Math.min(15, Math.max(0, s.vx));
      finishHeight = makeState(P, s.x, ter).y - ter.h(s.x);
      finishFall = Math.random() < .5;
      endSlow();
      releaseControls();
      const firstUnlock=localStorage.getItem(slowKey)!=='1';
      localStorage.setItem(slowKey, '1');
      slowUnlocked = true;
      if(firstUnlock){slowButton.hidden=false;showSlowUnlockToast();}
      maxScore = Math.max(maxScore, s.score);
      report();
      finishPanel.querySelector('p').textContent = `${Math.round(maxScore).toLocaleString()} points · +$${Math.round(maxScore / 10).toLocaleString()}`;
      msg = "FINISH!";
      msgT = 1;
      const colors = ['#48fb88', '#fa48ff', '#45deff', '#ffda50'];
      for (let burst = 0; burst < colors.length; burst++) {
        for (let i = 0; i < 36; i++) {
          const angle = Math.random() * Math.PI * 2, speed = 2 + Math.random() * 4;
          emit(s.x + burst * 2, ter.h(s.x) + 2.8 + (burst % 2), Math.cos(angle) * speed,
            Math.sin(angle) * speed + 1, colors[burst], 1 + Math.random(), 3, 1.4);
        }
      }
    }
    
    maxScore = Math.max(maxScore, s.score);
    // camera: side-on follow, zooms out with speed
    const crashFocus=crashRig?.focus(),sp=crashFocus?.speed??Math.hypot(s.vx,s.vy);
    camShake*=Math.exp(-8*cameraDt);
    const targetBlend=cameraView==='chase'?1:0;const swingDur=targetBlend>cameraBlend?.7:.9;cameraBlend+=Math.max(-cameraDt/swingDur,Math.min(cameraDt/swingDur,targetBlend-cameraBlend));const uBlend=cameraBlend;const blend=uBlend*uBlend*(3-2*uBlend);
    let dist=6.5;
    if(freeRoam){
      // v2.1-32: in a vert air the camera keeps facing the wall you launched off (it doesn't whip round with the
      // bike's turn), then swings round behind you smoothly once you're rolling back down
      if(s.vertAir&&s.vertH0!=null){vertCam=1.1;vertCamYaw=s.vertH0;}else if(vertCam>0)vertCam=Math.max(0,vertCam-cameraDt);
      const yaw=s.vertAir&&s.vertH0!=null?s.vertH0:(s.sliding&&s.moveYaw!=null?s.moveYaw:(s.yaw||0)),z=s.z||0,followDt=reviewing?0:cameraDt,roadY=ter.height(s.x,z),inAir=!(s.ground[0]||s.ground[1]);
      const lookT=arena?0.10:0;
      const tx=s.x+Math.cos(yaw)*(s.vx||0)*lookT, tz=z+Math.sin(yaw)*(s.vx||0)*lookT;
      const k=1-Math.exp(-(arena?(inAir?14:12):5.8)*followDt);
      // Playground side view sits on the bike's right. It follows the heading only while
      // rolling, so a donut or burnout does not spin the camera round with it.
      if(neon&&cameraView==='side'){const ty=s.loopRide?0:neonAt(s.trackS||0).yaw;if(sideYaw==null||!Number.isFinite(sideYaw))sideYaw=ty;else sideYaw+=wrapAngle(ty-sideYaw)*(1-Math.exp(-3*cameraDt));} // side view turns with the track
      else if(arena&&cameraView==='side')sideYaw=0; // camera locked square to the track
      else if(arena){if(sideYaw==null||!Number.isFinite(sideYaw))sideYaw=yaw;else if(Math.abs(s.vx||0)>1.5&&!crashRig)sideYaw+=wrapAngle(yaw-sideYaw)*(1-Math.exp(-2.4*followDt));}
      if(!crashRig){
        if(chasePosX==null||!Number.isFinite(chasePosX)||!Number.isFinite(chasePosZ)||!Number.isFinite(chaseFollowY)||!Number.isFinite(tx)||!Number.isFinite(tz)||Math.hypot(s.x-chasePosX,z-chasePosZ)>8){chasePosX=Number.isFinite(tx)?tx:s.x;chasePosZ=Number.isFinite(tz)?tz:z;chaseYaw=yaw;chaseHorizon=roadY;chaseFollowY=s.y+1.15;chaseLookY=s.y+.45;if(arena)airClose=0;}
        chasePosX+=(tx-chasePosX)*k;chasePosZ+=(tz-chasePosZ)*k;chaseYaw+=wrapAngle(yaw-chaseYaw)*(1-Math.exp(-(arena?(vertCam>0?2.6:10):8)*followDt));
      }
      if(lookDrag==null&&lookHold>0)lookHold=Math.max(0,lookHold-followDt); // stay where you left it for a second
      if(!lookDrag&&lookHold<=0){
        const wn=2.2,zn=1; // then ease back behind the bike, slowly
        lookVY+=(-wn*wn*lookYaw-2*zn*wn*lookVY)*followDt;lookYaw+=lookVY*followDt;
        lookVP+=(-wn*wn*lookPitch-2*zn*wn*lookVP)*followDt;lookPitch+=lookVP*followDt;
        if(Math.abs(lookYaw)<.012&&Math.abs(lookVY)<.08){lookYaw=0;lookVY=0;}
        if(Math.abs(lookPitch)<.012&&Math.abs(lookVP)<.08){lookPitch=0;lookVP=0;}
      }
      if(!inAir)chaseTakeoffY=roadY;
      if(crashRig){
        const f=crashFocus||crashRig.focus(),fx=f.x,fy=f.y,fz=f.z||0,fyaw=f.yaw??yaw;
        const ck=1-Math.exp(-8*followDt);
        if(chasePosX==null){chasePosX=fx;chasePosZ=fz;chaseYaw=fyaw;chaseFollowY=fy+1.5;chaseLookY=fy+.4;}
        chasePosX+=(fx-chasePosX)*ck;chasePosZ+=(fz-chasePosZ)*ck;
        chaseYaw+=wrapAngle(fyaw-chaseYaw)*(1-Math.exp(-6*followDt));
        chaseFollowY+=(fy+1.5-chaseFollowY)*ck;chaseLookY+=(fy+.4-chaseLookY)*ck;
        cameraReady=true;
        const speedT=Math.max(0,Math.min(1,(sp-2.8)/8)),shake=(Math.random()-.5)*camShake;
        const viewYaw=chaseYaw+lookYaw*blend,cy=Math.cos(viewYaw),sy=Math.sin(viewYaw);
        const chaseR=4.6,sideR=7.2,ahead=1.4;dist=sideR;
        const chaseX=chasePosX-cy*chaseR,chaseZ=chasePosZ-sy*chaseR;
        let sideX=chasePosX,sideZ=chasePosZ+sideR;
        if(arena&&sideYaw!=null){sideX=chasePosX-Math.sin(sideYaw)*sideR;sideZ=chasePosZ+Math.cos(sideYaw)*sideR;}
        const camX=sideX*(1-blend)+chaseX*blend,camZ=sideZ*(1-blend)+chaseZ*blend;
        const camY=chaseFollowY+lookPitch*2.6*blend+shake;
        const lookX=fx*(1-blend)+(chasePosX+cy*ahead)*blend,lookZ=fz*(1-blend)+(chasePosZ+sy*ahead)*blend,lookY=(fy+.35)*(1-blend)+chaseLookY*blend;
        if(!globalThis.__WK_CAM_HOLD__){
          cam.position.set(camX,camY,camZ);
          cam.lookAt(lookX,lookY,lookZ);
          cam.fov=(46+8*speedT)*(1-blend)+(64+8*speedT)*blend;cam.updateProjectionMatrix();
        }
        speedLineMat.opacity=0;speedLines.visible=false;
        lastChaseCam={fov:cam.fov,radius:sideR*(1-blend)+chaseR*blend,camY:cam.position.y,lookY,clearance:Math.max(0,fy-ter.height(fx,fz)),followY:chaseFollowY,yaw:chaseYaw,lookYaw,lookPitch,viewYaw,lookAhead:ahead,airClose,crash:true};
      } else if(!arena){
      // Ballistic landing prediction (step along heading under gravity until we meet terrain).
      const pred=(()=>{let px=s.x,pz=z,py=s.y,pvy=s.vy||0,dt=1/30,cy0=Math.cos(yaw),sy0=Math.sin(yaw),ride=P.R||.33;for(let i=0;i<90;i++){pvy-=9.8*dt;px+=cy0*(s.vx)*dt;pz+=sy0*(s.vx)*dt;py+=pvy*dt;const g=ter.height(px,pz);if(py<=g+ride&&pvy<=0)return {x:px,z:pz,y:g,t:i*dt};}return {x:px,z:pz,y:ter.height(px,pz),t:3};})();
      const landingY=pred.y,range=Math.hypot(pred.x-s.x,pred.z-z);
      const horizonTarget=inAir?Math.min(chaseTakeoffY,landingY):roadY;
      chaseHorizon+=(horizonTarget-chaseHorizon)*(1-Math.exp(-(inAir?1.8:8)*followDt));
      // Close air chase (Descenders/RR): stay ~4–5 m behind the bike, rise with it,
      // and look at the bike with only a slight bias toward the landing. No FOV punch.
      airClose+=( (inAir?1:0) - airClose ) * (1-Math.exp(-(inAir?2.8:2.5)*followDt));
      if(!inAir&&airClose<.02)airClose=0;
      const rise=Math.max(0,s.y-chaseHorizon);
      const groundCamY=chaseHorizon+2.15+rise*.16,airCamY=s.y+1.35;
      const groundLookY=chaseHorizon+.52+rise*.08,airLookY=s.y+.3+(landingY-(s.y+.3))*.18;
      const camYTarget=groundCamY*(1-airClose)+airCamY*airClose;
      const lookYTarget=groundLookY*(1-airClose)+airLookY*airClose;
      const yRate=inAir?8:5.2;
      chaseFollowY+=(camYTarget-chaseFollowY)*(1-Math.exp(-yRate*followDt));
      chaseLookY+=(lookYTarget-chaseLookY)*(1-Math.exp(-(inAir?8:5.0)*followDt));
      cameraReady=true;
      const speedT=Math.max(0,Math.min(1,(sp-2.8)/8)),shake=(Math.random()-.5)*camShake;
      const viewYaw=chaseYaw+lookYaw*blend,cy=Math.cos(viewYaw),sy=Math.sin(viewYaw);
      const chaseR0=3.6+Math.min(1.25,sp*.08);
      const chaseR=chaseR0*(1-airClose)+(4.4+Math.min(.4,sp*.02))*airClose;
      const groundY=Math.min(roadY,landingY);
      const span=Math.max(2.4,s.y-groundY)+2.4;
      const sideFov=(46+8*speedT)*Math.PI/180;
      const fitR=(span/2)/Math.tan(sideFov/2);
      const sideR0=6.6+Math.min(1.8,sp*.12);
      const sideR=sideR0+airClose*Math.max(0,fitR-sideR0+1.2);
      dist=sideR;
      const ahead=6+Math.min(8,Math.abs(s.vx)*.65);
      const lookAhead=ahead*(1-airClose)+1.6*airClose;
      const followX=chasePosX*(1-airClose)+s.x*airClose,followZ=chasePosZ*(1-airClose)+z*airClose;
      const chaseX=followX-cy*chaseR,chaseZ=followZ-sy*chaseR;
      let sideX=chasePosX,sideZ=chasePosZ+sideR;
      if(arena&&sideYaw!=null){sideX=chasePosX-Math.sin(sideYaw)*sideR;sideZ=chasePosZ+Math.cos(sideYaw)*sideR;}
      const camX=sideX*(1-blend)+chaseX*blend,camZ=sideZ*(1-blend)+chaseZ*blend;
      const midY=(s.y+groundY)*.5;
      const camY=((s.y+1.2)*(1-airClose)+(midY+.35)*airClose)*(1-blend)+(chaseFollowY+lookPitch*2.6*blend)*blend+shake;
      const lookX=s.x*(1-blend)+(followX+cy*lookAhead+airClose*(pred.x-s.x)*.12)*blend;
      const lookZ=z*(1-blend)+(followZ+sy*lookAhead+airClose*(pred.z-z)*.12)*blend;
      const lookY=((s.y+.35)*(1-airClose)+midY*airClose)*(1-blend)+chaseLookY*blend;
      if(!globalThis.__WK_CAM_HOLD__){
        // v2.1-11 ride zoom (mouse wheel, +/- keys, two-finger pinch): zooming in pulls the camera and its aim
        // onto the bike so you can watch the forks, shock and tyres work while you ride.
        const zm=camZoom,near=Math.min(1,zm),tx=s.x+(lookX-s.x)*near,ty=s.y+(lookY-s.y)*near,tz=z+(lookZ-z)*near;
        const zx=tx+(camX-lookX)*zm,zy=Math.max((ter.height?ter.height(tx+(camX-lookX)*zm,tz+(camZ-lookZ)*zm):0)+.25,ty+(camY-lookY)*zm),zz=tz+(camZ-lookZ)*zm;
        cam.position.set(zx,zy,zz);
        cam.lookAt(tx,ty,tz);
        cam.fov=(46+8*speedT)*(1-blend)+(64+8*speedT)*blend;cam.updateProjectionMatrix();
      }
      speedLineMat.opacity=0;speedLines.visible=false;
      lastChaseCam={fov:cam.fov,radius:sideR*(1-blend)+chaseR*blend,camY:cam.position.y,lookY,clearance:Math.max(0,s.y-roadY),followY:chaseFollowY,yaw:chaseYaw,lookYaw,lookPitch,viewYaw,lookAhead:ahead,airClose};
      } else {
      // Arena chase: close Cinemachine-style follow, speed pull-back, look-ahead
      // with damping that has no constant-speed lag (fixes the lip hitch). In
      // the air, Descenders-style framing — bike ~33% of screen height, a slight
      // tilt toward the landing, and a smooth return on touchdown.
      const pred=(()=>{let px=s.x,pz=z,py=s.y,pvy=s.vy||0,dt=1/30,cy0=Math.cos(yaw),sy0=Math.sin(yaw),ride=P.R||.33;for(let i=0;i<90;i++){pvy-=9.8*dt;px+=cy0*(s.vx)*dt;pz+=sy0*(s.vx)*dt;py+=pvy*dt;const g=ter.height(px,pz);if(py<=g+ride&&pvy<=0)return {x:px,z:pz,y:g,t:i*dt};}return {x:px,z:pz,y:ter.height(px,pz),t:3};})();
      const landingY=pred.y;
      if(!inAir)chaseTakeoffY=roadY;
      airClose+=( (inAir?1:0) - airClose ) * (1-Math.exp(-(inAir?5.2:1.8)*followDt));
      if(!inAir&&airClose<.02)airClose=0;
      const bikeH=1.85;
      const airFovDeg=50, groundFovDeg=48+Math.min(8,Math.max(0,sp-4)*0.7);
      const airR=bikeH/(0.33*2*Math.tan(airFovDeg*Math.PI/360));
      const chaseR0=3.15+Math.min(1.85,sp*.10);
      const chaseR=chaseR0*(1-airClose)+airR*airClose;
      const groundCamY=s.y+1.15+Math.max(0,s.vy||0)*.06;
      const airCamY=s.y+1.12;
      const groundLookY=s.y+.48;
      const airLookY=s.y+.28+(landingY-(s.y+.28))*.30;
      const camYTarget=groundCamY*(1-airClose)+airCamY*airClose;
      const lookYTarget=groundLookY*(1-airClose)+airLookY*airClose;
      const yRate=inAir?12:10;
      chaseFollowY+=(camYTarget-chaseFollowY)*(1-Math.exp(-yRate*followDt));
      chaseLookY+=(lookYTarget-chaseLookY)*(1-Math.exp(-(inAir?12:9)*followDt));
      cameraReady=true;
      const shake=(Math.random()-.5)*camShake;
      const viewYaw=chaseYaw+lookYaw*blend,cy=Math.cos(viewYaw),sy=Math.sin(viewYaw);
      const lookAhead=(1.15+Math.min(2.0,Math.abs(s.vx)*.12))*(1-airClose)+0.55*airClose;
      const followX=chasePosX,followZ=chasePosZ;
      const chaseX=followX-cy*chaseR,chaseZ=followZ-sy*chaseR;
      const sideR=6.8+Math.min(1.6,sp*.10);
      let sideX=chasePosX,sideZ=chasePosZ+sideR;
      if(arena&&sideYaw!=null){sideX=chasePosX-Math.sin(sideYaw)*sideR;sideZ=chasePosZ+Math.cos(sideYaw)*sideR;}
      const camX=sideX*(1-blend)+chaseX*blend,camZ=sideZ*(1-blend)+chaseZ*blend;
      const camY=((s.y+1.2)*(1-airClose)+(s.y+.6)*airClose)*(1-blend)+(chaseFollowY+lookPitch*2.6*blend)*blend+shake;
      const lookX=s.x*(1-blend)+(followX+cy*lookAhead+airClose*(pred.x-s.x)*.18)*blend;
      const lookZ=z*(1-blend)+(followZ+sy*lookAhead+airClose*(pred.z-z)*.18)*blend;
      const lookY=((s.y+.35)*(1-airClose)+(s.y+.28)*airClose)*(1-blend)+chaseLookY*blend;
      if(!globalThis.__WK_CAM_HOLD__){
        // ride zoom (wheel, +/- keys, pinch): zooming in pulls the camera and its aim onto the bike
        const zm=camZoom,near=Math.min(1,zm),tx=s.x+(lookX-s.x)*near,ty=s.y+(lookY-s.y)*near,tz=z+(lookZ-z)*near;
        const zx=tx+(camX-lookX)*zm,zz=tz+(camZ-lookZ)*zm,zy=Math.max((ter.height?ter.height(zx,zz):0)+.25,ty+(camY-lookY)*zm);
        cam.position.set(zx,zy,zz);
        cam.lookAt(tx,ty,tz);
        cam.fov=groundFovDeg*(1-blend)+(groundFovDeg*(1-airClose)+airFovDeg*airClose)*blend;
        cam.updateProjectionMatrix();
      }
      speedLineMat.opacity=0;speedLines.visible=false;
      lastChaseCam={fov:cam.fov,radius:sideR*(1-blend)+chaseR*blend,camY:cam.position.y,lookY,clearance:Math.max(0,s.y-roadY),followY:chaseFollowY,followX:chasePosX,followZ:chasePosZ,yaw:chaseYaw,lookYaw,lookPitch,viewYaw,lookAhead,airClose,chaseR,bikeFrac:bikeH/(2*chaseR*Math.tan((cam.fov*Math.PI/180)/2))};
      }
      environment.update(s.x,{s,P,inp,dt:cameraDt,paused});environment.view(1);
      put(viewLabel,'view',cameraView==='chase'?'▣ CHASE':'▣ SIDE VIEW');viewLabel?.setAttribute('aria-pressed',String(cameraView==='chase'));
      if(el.dataset.wkCam!==cameraView)el.dataset.wkCam=cameraView;
    } else {
    const sc=sideCam.update(reviewing ? 0 : cameraDt,{x:s.x,y:s.y,vx:s.vx,vy:s.vy,speed:sp,grounded:!!(s.ground[0]||s.ground[1]),groundY:ter.h(s.x),landingY:ter.h(s.x+Math.max(2,s.vx*.35)),inLoop:!!s.loopRide,focus:crashFocus,reduceMotion:reduceMotion.matches});dist=sc.dist;
    const angle=blend*Math.PI/2;
    // Chase-only framing (side view and its zoom are unchanged at blend=0):
    // pulled back/up so the whole bike+rider sit in the lower-middle third; jump height is lagged
    // so air reads bigger; FOV widens with speed (60–72) without changing physics speed.
    const chaseRadius=5.8+Math.min(1.2,sp*.08),radius=dist*(1-blend)+chaseRadius*blend;
    const cx=sc.x*(1-blend)+(crashFocus?.x??s.x+Math.min(3,s.vx*.15))*blend,riderY=sc.y*(1-blend)+(crashFocus?.y??s.y)*blend,side=1-blend;
    const roadY=ter.h(s.x),inAir=!(s.ground[0]||s.ground[1]),landingY=ter.h(s.x+Math.max(3,s.vx*.4));
    if(!inAir)chaseTakeoffY=roadY;
    const horizonTarget=inAir?Math.min(chaseTakeoffY,landingY):roadY;
    const followDt=reviewing?0:cameraDt;
    const riseForSnap=Math.max(0,s.y-horizonTarget);
    if(chaseFollowX==null||Math.abs(s.x-chaseFollowX)>20){chaseHorizon=horizonTarget;chaseFollowY=horizonTarget+2.15+riseForSnap*.14;chaseLookY=horizonTarget+.42+riseForSnap*.08;}
    chaseFollowX=s.x;
    chaseHorizon+=(horizonTarget-chaseHorizon)*(1-Math.exp(-(inAir?1.8:8)*followDt));
    const rise=Math.max(0,s.y-chaseHorizon),camYTarget=chaseHorizon+2.15+rise*.14,lookYTarget=chaseHorizon+.42+rise*.08;
    const yRate=inAir?(camYTarget>chaseFollowY?1.3:2.0):6;
    chaseFollowY+=(camYTarget-chaseFollowY)*(1-Math.exp(-yRate*followDt));
    chaseLookY+=(lookYTarget-chaseLookY)*(1-Math.exp(-(inAir?1.6:6)*followDt));
    cameraReady=true;
    const speedT=Math.max(0,Math.min(1,(sp-3)/12)),chaseFov=60+12*speedT;
    if(!globalThis.__WK_CAM_HOLD__){
      const camY=(riderY+(.45+dist*.025)+sc.bobY)*side+chaseFollowY*blend;
      const lookY=(riderY+(.45+dist*.025-.65)+sc.bobY*.6)*side+chaseLookY*blend;
      cam.position.set(cx-Math.sin(angle)*radius+sc.bobX*side,camY,Math.cos(angle)*radius+.55*blend);
      cam.lookAt(cx+blend*4.0,lookY,0);
      if(side>0&&sc.roll)cam.rotateZ(sc.roll*side);
      cam.fov=40*side+chaseFov*blend;cam.updateProjectionMatrix();
    }
    // Cheap edge speed lines in chase only; opacity scales with speed, no physics change.
    const lineAmt=blend*Math.max(0,Math.min(1,(sp-4)/11));
    speedLineMat.opacity=lineAmt*.5;speedLines.visible=lineAmt>.03;
    if(lineAmt>.03){
      cam.updateMatrixWorld();cam.matrixWorld.decompose(_slO,new T.Quaternion(),new T.Vector3());cam.matrixWorld.extractBasis(_slX,_slY,_slZ);
      const rush=(10+sp*1.15)*cameraDt;
      for(let i=0;i<speedLineN;i++){
        const st=speedLineStreaks[i];st.z+=rush;if(st.z>-1.15)resetSpeedStreak(st);
        const i6=i*6,fx=-_slZ.x,fy=-_slZ.y,fz=-_slZ.z;
        const x0=_slO.x+_slX.x*st.x+_slY.x*st.y+fx*(-st.z),y0=_slO.y+_slX.y*st.x+_slY.y*st.y+fy*(-st.z),z0=_slO.z+_slX.z*st.x+_slY.z*st.y+fz*(-st.z);
        const x1=_slO.x+_slX.x*st.x+_slY.x*st.y+fx*(-st.z+st.len),y1=_slO.y+_slX.y*st.x+_slY.y*st.y+fy*(-st.z+st.len),z1=_slO.z+_slX.z*st.x+_slY.z*st.y+fz*(-st.z+st.len);
        speedLinePos[i6]=x0;speedLinePos[i6+1]=y0;speedLinePos[i6+2]=z0;speedLinePos[i6+3]=x1;speedLinePos[i6+4]=y1;speedLinePos[i6+5]=z1;
      }
      speedLineGeo.attributes.position.needsUpdate=true;
    }
    lastChaseCam={fov:cam.fov,radius:dist*(1-blend)+(5.8+Math.min(1.2,sp*.08))*blend,camY:cam.position.y,lookY:chaseLookY,clearance:Math.max(0,s.y-ter.h(s.x)),followY:chaseFollowY};
    environment.update(s.x,{s,P,inp,dt:cameraDt,paused});environment.view(blend);put(viewLabel,'view',cameraView==='chase'?'▣ CHASE · DEPTH PREVIEW':'▣ SIDE VIEW (2.5D)');viewLabel?.setAttribute('aria-pressed',String(cameraView==='chase'));
    if(el.dataset.wkCam!==cameraView){el.dataset.wkCam=cameraView;if(cameraView!=='chase')steerSlider.release();}
    }

    const sunZ=freeRoam?(s.z||0):0;
    if(arena){
      const dist=60,ext=26,snap=2*ext/sun.shadow.mapSize.x; // snap the shadow box to its texels: no shimmering edges
      const fx=Math.round(s.x/snap)*snap,fy=Math.round(s.y/snap)*snap,fz=Math.round(sunZ/snap)*snap;
      sun.position.set(fx+sunDir.x*dist,fy+sunDir.y*dist,fz+sunDir.z*dist);
      sun.target.position.set(fx,fy,fz);sun.target.updateMatrixWorld();
      if(R.shadowMap.enabled){
        Object.assign(sun.shadow.camera,{left:-ext,right:ext,top:ext,bottom:-ext,near:1,far:dist+40});
        sun.shadow.camera.updateProjectionMatrix();
      }
    }else{
      const sdx=8,sdy=20,sdz=6,slen=Math.hypot(sdx,sdy,sdz);
      sun.position.set(s.x+sdx,s.y+sdy,sunZ+sdz);sun.target.position.set(s.x,s.y,sunZ);sun.target.updateMatrixWorld();
      if(R.shadowMap.enabled){
        const ext=12;
        Object.assign(sun.shadow.camera,{left:-ext,right:ext,top:ext,bottom:-ext,near:2,far:slen+28});
        sun.shadow.camera.updateProjectionMatrix();
      }
    }
    const blobOn=!R.shadowMap.enabled;
    if(contactBlobs){
      const yawB=freeRoam?(s.yaw||0):0,cB=Math.cos(yawB),nB=Math.sin(yawB),axB=[-P.wb*P.comBack,P.wb*(1-P.comBack)];
      for(let i=0;i<2;i++){
        const bx=s.x+cB*axB[i],bz=freeRoam?sunZ+nB*axB[i]:0,gy=(freeRoam?ter.height(bx,bz):ter.h(bx))+.018;
        const clear=Math.max(0,(s.y-P.comH+P.R)-gy);
        const bo=contactBlobs[i];
        bo.position.set(bx,gy,bz);
        const op=(blobOn?0.34:0.08)*Math.exp(-clear*1.35);
        bo.material.opacity=op;bo.visible=op>0.03;bo.scale.setScalar(.85+Math.min(1.4,clear*.35));
      }
    }
    if(!worldSky){sky.position.x = cam.position.x; sky.position.z=cam.position.z||0; sunDisc.position.x = cam.position.x + 40;}
    // HUD
    put(hud.score,"score",Math.round(s.score).toLocaleString()); if(!flat)put(hud.best,"best","$ +" + Math.round(maxScore / 10).toLocaleString() + " · DIRT " + Math.round(Math.min(1, dirt) * 100) + "%");
    putHtml(hud.speed,'speed',Math.round(sp * 3.6) + "<small style='font-size:14px'> km/h</small>");
    if(freeRoam&&hud.heading){const deg=((Math.atan2(Math.sin(s.yaw||0),Math.cos(s.yaw||0))*180/Math.PI)+360)%360;const card=['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];put(hud.heading,'heading',card+' · '+Math.round(deg)+'°')}
    else if(hud.heading)put(hud.heading,'heading','');
    put(hud.wheelie,'wheelie',s.balance ? `${s.balance} ${(s.balance.includes("WHEEL") || s.balance === "MANUAL" ? s.wheelieT : s.stoppieT).toFixed(1)}s` : s.bestWheelie ? `BEST MONO ${s.bestWheelie.toFixed(1)}s` : "");
    put(hud.batt,'batt',P.powertrain==='petrol'?'FUEL '+Math.round(s.battery*100)+'% · '+(stats.cc??find(build.motor)?.cc??'')+'cc':P.pedal ? "PEDAL POWER" : "BATTERY " + Math.round(s.battery * 100) + "%"); {const pw = Math.max(0, Math.min(100, s.x / ter.finish * 100)) + "%"; if(hc.pw!==pw){hc.pw=pw;hud.prog.firstChild.style.width = pw;}}
    if (s.trickT <= 0 && hud.trick.style.opacity!=='0') hud.trick.style.opacity = Math.max(0, +hud.trick.style.opacity - dt * 2); msgT -= dt; put(hud.msg,'msg',paused?"PAUSED":msgT > 0 ? msg : "");
    const w = W(), h = H(),screenScale=el.getBoundingClientRect().width/w;sty("transformOrigin","top left");sty("transform",`scale(${1/screenScale})`);sty("width",(w*screenScale)+"px");sty("height",(h*screenScale)+"px");sty("right","auto");sty("bottom","auto");const pixelRatio=Math.min(maxPR,devicePixelRatio*screenScale);if(R.getPixelRatio()!==pixelRatio)R.setPixelRatio(pixelRatio);if (R.domElement.width !== Math.floor(w * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if(!worldSky&&!arena)layoutBackdrop(horizonTex||backdrop,w,h,Math.sin(s.x*.001)*TH.backdrop.sway,blend);
    if(flat){const tile=Math.floor(s.x/100)*100;ground.position.x=tile;dirtTop.position.x=tile;layers.foreground.position.x=tile;layers.update(tile);flatMarkers.position.x=tile;sky.position.x=s.x;sunDisc.position.x=s.x+40;if(hc.pd!=='none'){hc.pd='none';hud.prog.style.display='none'}put(hud.best,'best','FLAT ENDLESS · '+Math.floor(s.odo)+' m');}
    if(neon){if(hc.pd!=='none'){hc.pd='none';hud.prog.style.display='none'}put(hud.best,'best','NEON CANAL · '+Math.floor(Math.min(NEON.finish,s.trackS||0))+' / '+NEON.finish+' m · 🪙 '+(s.coins||0));}
    else if(arena){if(hc.pd!=='none'){hc.pd='none';hud.prog.style.display='none'}put(hud.best,'best','PLAYGROUND · '+Math.floor(s.odo)+' m');}
    // While the replay panel covers the game, the scene is frozen: draw it once and leave the GPU/main thread to the video decoder (fixes stuttery replays on phones).
    if (!reviewing || !hc.reviewDrawn) {
      // v2.1-36: Neon Canal glows (bloom) on medium/high; everything else renders straight
      if(neon&&qualityPick.name!=='low'&&!bloomFailed){try{
        if(!composer){const rt=new T.WebGLRenderTarget(w,h,{type:T.HalfFloatType,samples:R.capabilities.isWebGL2?4:0});composer=new EffectComposer(R,rt);composer.addPass(new RenderPass(scene,cam));bloomPass=new UnrealBloomPass(new T.Vector2(w,h),.38,.4,.95);composer.addPass(bloomPass);composer.addPass(new OutputPass());}
        if(composerSize!==w+'x'+h+'@'+R.getPixelRatio()){composer.setPixelRatio(R.getPixelRatio());composer.setSize(w,h);composerSize=w+'x'+h+'@'+R.getPixelRatio();}
        composer.render();
      }catch(e){console.warn('[wk] bloom off',e);bloomFailed=true;composer=null;R.render(scene,cam);}}
      else R.render(scene, cam);
      hc.reviewDrawn = reviewing; }
    if (photoDelay >= 0 && realDt && (photoDelay -= realDt) <= 0) {
      photoDelay = -1;
      const photo = document.createElement('canvas');
      photo.width = 240;
      photo.height = Math.max(1, Math.round(240 * h / w));
      photo.getContext('2d')?.drawImage(R.domElement, 0, 0, photo.width, photo.height);
      photo.setAttribute('role', 'img');
      photo.setAttribute('aria-label', 'Race highlight');
      photos.append(photo);
      photoCount++;
    }
  };
  const sideCam=createSideCamera(),reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');el.dataset.wkCam='side';if(freeRoam)el.dataset.wkFreeroam='';globalThis.__WK_SCENE_VIEW__=setCameraView;
  const rideLod=lightenForRide(T,scene);
  raf = requestAnimationFrame(frame);
  globalThis.__WK_RIDE_SCENE__=()=>({scene,cam,renderer:R,body,pivot});globalThis.__WK_THREE__=T;globalThis.__WK_REPLAY__=replay;
  globalThis.__WK_RIDE_HOLD__=(patch)=>{
    if(patch&&patch.clearKeys){for(const k of Object.keys(keys))keys[k]=false;delete patch.clearKeys;}
    if(patch&&patch.steer!=null){touch.steerRight=patch.steer>0?patch.steer:0;touch.steerLeft=patch.steer<0?-patch.steer:0;const rest={...patch};delete rest.steer;Object.assign(touch,rest);return touch;}
    return Object.assign(touch,patch||{});
  };

  // QA telemetry (v2.0): one flat read of the live ride. Arrays are [rear, front].
  globalThis.__WK_TELEMETRY__ = () => {
    const j=jolt?.ready?jolt.dump():null,D=180/Math.PI,R0=P.R||.33;
    const om=s.wheelOmega||[0,0],slipRatio=om.map(w=>{const v=s.vx||0;return (w*R0-v)/Math.max(1.5,Math.abs(v));});
    return {version:WK_VERSION,level,physics,ready:physics!=='jolt'||!!j,t:performance.now(),
      speedKmh:(s.vx||0)*3.6,speedMs:s.vx||0,pitchDeg:(s.pitch||0)*D,rollDeg:(s.joltRoll!=null?s.joltRoll:(s.visRoll||0))*D,yawDeg:(s.yaw||0)*D,yawRate:s.wYaw||0,
      x:s.x,y:s.y,z:s.z,ground:s.ground?[...s.ground]:null,wheelOmega:[...om],wheelSlipMs:s.slip?[...s.slip]:null,wheelSlipRatio:slipRatio,
      suspensionComp:s.comp?[...s.comp]:null,impactN:s.impactN||0,impactPeakN:s.impactPeakN||0,attach:rideProfile?.attach||null,
      trick:{wheelie:!!s.mono,frontUp:!!(s.ground&&!s.ground[1]&&s.ground[0]),rearUp:!!(s.ground&&s.ground[1]&&!s.ground[0]),standing:!!s.standing,burnout:!!s.burnout,drift:!!s.drift,crashed:s.crashed||null,
        oneHand:!!s.oneHand,kneeKnock:!!s.kneeKnock,stoppie:!!s.stoppie,brakeLock:brakeLockId!=null,toggles:{...rideToggles},stunt:s.stunt?.name||null},rider:arena?riderModel.state():null,wheelVisual:{probe:mechanical?.probe?.()||null,phase:[mechanical?.state.rearWheelPhase??null,mechanical?.state.wheelPhase??null],joltAngle:s.wheelAngle?[...s.wheelAngle]:null,steer:s.steer||0},
      input:{throttle:inp.throttle||0,brake:inp.brake||0,steer:inp.steer||0,lean:inp.lean||0,mono:!!s.mono,stand:!!inp.stand},
      engine:j?j.engine:null,driver:j?j.driver:null,calibration:j?j.calibration:null,profile:rideProfile?{mass:rideProfile.mass,comBack:rideProfile.comBack,comH:rideProfile.comH,front:rideProfile.front,rear:rideProfile.rear,engine:rideProfile.engine}:null};
  };
  globalThis.__WK_RIDE_STATE__ = () => ({ s, P, physics, physicsReady:physics!=='jolt'||!!(jolt&&jolt.ready), jolt:jolt?jolt.dump():null,rideProfile, dirt, wear, flips, finished, inp, ter, level, legacyMenu, arena, freeRoam, slowMo, slowUnlocked, cameraX:cam.position.x,groundX:ground.position.x,render:{calls:R.info.render.calls,triangles:R.info.render.triangles,geometries:R.info.memory.geometries,textures:R.info.memory.textures},environment:environment.state(),soccer:soccer?.state()||null,cameraView,cameraBlend,crash:crashRig?.state()||null,rider:riderModel.state(),backdropLoaded,sceneryLayers:['background','road','foreground'],paused,stunt:s.stunt?{...s.stunt}:null,supermanPose,stuntVisual:stuntRig.state(),controls:leanControls.state(),toggles:{...rideToggles},steer:steerSlider.state(),visual:{steer:inp.steer||0,bar:s.steer||0,roll:pivot.rotation.x,z:pivot.position.z,yaw:s.yaw||0,meshYaw,lookYaw,lookPitch,dive:visDive,squat:visSquat,slip:s.slip?s.slip.slice():[0,0],wheelOmega:s.wheelOmega?s.wheelOmega.slice():[0,0],smoke:smokeParts.reduce((n,p)=>n+(p.life>0?1:0),0)},chaseCam:lastChaseCam,tricksOpen:tricksMenu.state().open,quality:{antialias:R.getContext().getContextAttributes().antialias,start:qualityPick.name,manual:qualityPick.manual,maxPR,shadows:R.shadowMap.enabled,shadowMap:R.shadowMap.enabled,fps:fpsLast,blobs:!!(contactBlobs&&contactBlobs[0]?.visible),worldSky:!!worldSky,sky:skyKind,...qualityMon.state(),log:qualityLog},rideLod:{swapped:rideLod.swapped,before:rideLod.before,after:rideLod.after},mechanical:mechanical?.state,rewinding,rewindT,bufferLength:replay.buffer?.length||0,bufferT:replay.buffer?.t||0 });
  function stop(save=true) {if(disposed)return;disposed=true;try{composer?.dispose?.();composer?.renderTarget1?.dispose();composer?.renderTarget2?.dispose();bloomPass?.dispose?.();}catch{}try{jolt?.dispose();jolt=null;delete globalThis.__WK_JOLT_RESET__;delete globalThis.__WK_TELEMETRY__;delete globalThis.__WK_RIDE_HOLD__;}catch{}if(save)report();replay.dispose();releaseControls();cancelAnimationFrame(raf); removeEventListener("keydown", kd); removeEventListener("keyup", ku);removeEventListener('blur',releaseControls);document.removeEventListener('visibilitychange',visibility);for(const type of blockedGestures)el.removeEventListener(type,blockBrowserGesture);R.domElement.removeEventListener('pointerdown',lookOn);R.domElement.removeEventListener('pointerdown',pinchDown);R.domElement.removeEventListener('pointermove',pinchMove);for(const ev of ['pointerup','pointercancel'])R.domElement.removeEventListener(ev,pinchUp);R.domElement.removeEventListener('wheel',zoomWheel);removeEventListener('keydown',zoomKey);R.domElement.removeEventListener('pointermove',lookMove);for(const ev of ['pointerup','pointercancel','lostpointercapture'])R.domElement.removeEventListener(ev,lookOff);el.removeAttribute('data-wk-ride-surface');el.removeAttribute('data-wk-paused');el.removeAttribute('data-wk-crashed');el.removeAttribute('data-wk-finished');el.removeAttribute('data-wk-cam');el.removeAttribute('data-wk-freeroam');cancelRewindHold();crashRig?.restore();crashRig=null; delete globalThis.__WK_SCENE_VIEW__;delete globalThis.__WK_RIDE_SCENE__;environment.dispose();soccer?.dispose();tracks?.dispose();if(worldSky){worldSky.geometry?.dispose();worldSky.material?.dispose();if(scene.background&&scene.background.isTexture&&scene.background!==horizonTex&&scene.background!==backdrop)scene.background.dispose();if(scene.environment&&scene.environment.isTexture)scene.environment.dispose();worldSky.removeFromParent();}worldSkyTex?.dispose();contactBlobs?.forEach(b=>{b.material.dispose();b.removeFromParent()});blobGeo?.dispose();speedLineGeo.dispose();speedLineMat.dispose();speedLines.removeFromParent();loopMesh?.geometry.dispose();loopMesh?.material.dispose();rideLod.dispose();horizonTex?.dispose();backdrop.dispose();smoke.geometry.dispose();smoke.material.dispose();R.dispose();R.forceContextLoss();el.innerHTML="";}
  return ()=>{replacementStop?.();stop();};
}
function btnCss(bg, w, h) { return `width:${w}px;height:${h}px;border-radius:16px;background:${bg};border:2px solid #fff4;color:#fff;font:15px 'Bungee',Impact,sans-serif;display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none`; }
globalThis.__WK_RIDE__ = mountRide;
// ---- garage: dirt + damage panel (WASH / REPAIR), shown only when the bike is dirty or damaged ----
const NAMES = { fender_r: "Rear fender", fender_f: "Front fender", bash: "Bash guard", bars: "Bars", suspension: "Fork", shock: "Shock" };
const COST = { fender_r: 60, fender_f: 60, bash: 80, bars: 120, suspension: 300, shock: 250 };
function garagePanel() {
  if (typeof document === "undefined") return; const box = document.createElement("div"); box.id = "wk-cond";
  box.style.cssText = "position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:30;display:none;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;background:#0d1310ee;border:2px solid #c9844a;border-radius:14px;padding:6px 10px;font:13px 'Bungee',Impact,sans-serif;color:#fff;max-width:92vw";
  document.body.appendChild(box);
  const rebuild = () => globalThis.__WK_SETBUILD__?.((b) => ({ ...b }));
  const render = () => { const c = loadCond(), riding = !!document.querySelector("[data-ride]"), garage = !!globalThis.__WK_VIEW__ && !riding;
    const dmg = Object.entries(c.wear || {}).filter(([, w]) => w > 0.05); const show = garage && (c.dirt > 0.02 || dmg.length);
    box.style.display = show ? "flex" : "none"; if (!show) return;
    const key = JSON.stringify(c); if (box.dataset.k === key) return; box.dataset.k = key;
    box.innerHTML = (c.dirt > 0.02 ? `<span>🟫 DIRT ${Math.round(c.dirt * 100)}%</span><button data-wash style="${btnCss("#3ab8ff", 92, 32)}">🧽 WASH</button>` : "") +
      dmg.map(([k, w]) => `<span style="color:${w >= 1 ? "#ff5468" : w >= 0.4 ? "#ffb347" : "#ffd23d"}">${NAMES[k] || k}: ${condLabel(w)}</span><button data-fix="${k}" style="${btnCss("#39ff7a", 120, 32)};color:#062">🔧 REPAIR $${COST[k] || 100}</button>`).join("");
    box.querySelector("[data-wash]")?.addEventListener("click", () => { saveCond({ ...loadCond(), dirt: 0 }); rebuild(); render(); });
    box.querySelectorAll("[data-fix]").forEach((b) => b.addEventListener("click", () => { const c2 = loadCond(), k = b.dataset.fix; delete c2.wear[k]; saveCond(c2); globalThis.__WK_MONEY__?.((m) => m - (COST[k] || 100)); rebuild(); render(); })); };
  setInterval(render, 700); render();
}
// garagePanel is retained for later, but repair UI is currently disabled.
