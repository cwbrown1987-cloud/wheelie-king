import { mountRideReplay } from './ride-replay.js';
import { pauseMenuMarkup, mountRidePause } from './ride-pause.js';
import { restoreRideState } from './ride-buffer.js';
import { makeLoopMesh } from './ride-loop.js';
// Wheelie King ride (v16). MotoX-Mayhem-style side-on 3D ride using the REAL garage bike (cloned, with its parts and stickers).
// Physics: ride-physics.js (pure 2D, reusable for a later 3D mode). This file is only rendering, input, FX, HUD and saving condition.
import * as T from "./vendor/three.module.js";
import { createSideCamera } from "./ride-camera.js";
import { lightenForRide } from "./ride-lod.js";
import { TIERS, pickTier, createQualityMonitor } from "./ride-quality.js";
import { getTheme } from "./ride-themes.js";
import { makeTerrain, makeFlatTerrain, makeState, step } from "./ride-physics.js";
import {rideParameters} from './ride-parameters.js';
import {createBikeMotion} from './bike-motion.js';
import {rideControlsMarkup,mountLeanControls,mountTricksMenu} from './ride-controls.js';
import {makeStuntRig} from './ride-tricks.js';
import {roadLayers} from './ride-scenery.js';
import {makeRider} from './rider-model.js';
import {makeEnvironment} from './ride-environment.js';
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

  bike.traverse(o=>{
    if(!o.isMesh||!o.userData.wkFlashBase)return;
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
  const picked=pickTier(),qualityPick=lowDetail||picked.manual?{name:'low',manual:true}:quality&&TIERS[quality]?{name:quality,manual:qualityManual}:picked,Q=TIERS[qualityPick.name],qualityMon=createQualityMonitor(qualityPick);let maxPR=Math.min(Q.maxPR,Number.isFinite(pixelRatioCap)&&pixelRatioCap>0?pixelRatioCap:Q.maxPR),qualityLog=[];lowDetail=Q.envLow;
  const src=(()=>{let root=null;globalThis.__WK_VIEW__?.scene.traverse(o=>{if(!root&&o.name==='wk:frame')root=o.parent});return root})(),preparedBike=src?cloneForRide(src):null;if(Q.trimTiny&&preparedBike)trimTinyMeshes(preparedBike);
  el.setAttribute('data-wk-ride-surface','');
  const blockBrowserGesture=e=>{if(e.type.startsWith('touch')&&e.target.closest?.('[data-r],button,input'))return;if(e.cancelable)e.preventDefault()};
  const blockedGestures=['selectstart','contextmenu','dragstart','gesturestart','gesturechange','touchstart','touchmove'];
  for(const type of blockedGestures)el.addEventListener(type,blockBrowserGesture,{passive:false});
  window.getSelection()?.removeAllRanges();
  const W = () => el.clientWidth || 900, H = () => el.clientHeight || 420;
  const R = new T.WebGLRenderer({ antialias: Q.aa,powerPreference:"high-performance" }); R.setPixelRatio(Math.min(maxPR, devicePixelRatio*el.getBoundingClientRect().width/W())); R.shadowMap.enabled = Q.shadows; R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping;
  R.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none"; el.appendChild(R.domElement);
  const scene = new T.Scene(); scene.background = new T.Color(TH.background); scene.fog = new T.Fog(TH.fog.color, TH.fog.near, TH.fog.far);
  const cam = new T.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  scene.add(new T.HemisphereLight(TH.hemi.sky, TH.hemi.ground, TH.hemi.intensity)); const sun = new T.DirectionalLight(TH.sun.color, TH.sun.intensity); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 }); scene.add(sun, sun.target);
  // sky gradient + sun disc
  const sky = new T.Mesh(new T.PlaneGeometry(900, 260), new T.ShaderMaterial({ depthWrite: false, fog: false, uniforms: {}, vertexShader: "varying float v;void main(){v=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}", fragmentShader: `varying float v;void main(){gl_FragColor=vec4(mix(vec3(${TH.sky.low.map(n=>Number(n).toFixed(3)).join(",")}),vec3(${TH.sky.high.map(n=>Number(n).toFixed(3)).join(",")}),smoothstep(.35,.8,v)),1.);}` }));
  sky.position.set(0, 40, -120); scene.add(sky);
  const sunDisc = new T.Mesh(new T.CircleGeometry(9, 32), new T.MeshBasicMaterial({ color: TH.sunDisc, fog: false })); sunDisc.position.set(40, 30, -110); scene.add(sunDisc);
  const legacyScenery=[];let backdropLoaded=false,horizonTex=null;
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
  const backdrop=new T.TextureLoader().load(TH.backdrop.image,texture=>{if(disposed)return;texture.colorSpace=T.SRGBColorSpace;horizonTex=composeHorizonBackdrop(texture.image);scene.background=horizonTex;sky.visible=false;sunDisc.visible=false;legacyScenery.forEach(o=>o.visible=false);backdropLoaded=true;layoutBackdrop(horizonTex,el.clientWidth||16,el.clientHeight||9,0);},undefined,()=>{if(!disposed)buildLegacy()});
  // terrain
  const flat=(localStorage.getItem('wk-level')||'trials')==='flat',ter=flat?makeFlatTerrain():makeTerrain((build.frame || "bmx").length * 7 + 3),renderEnd=flat?500:ter.finish;const pts=ter.pts;
  const shape = new T.Shape(); shape.moveTo(pts[0][0],pts[0][1]-.45);pts.forEach(([x,y])=>shape.lineTo(x,y));[...pts].reverse().forEach(([x,y])=>shape.lineTo(x,y-.45));shape.closePath();
  const groundGeo = new T.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false }); groundGeo.translate(0, 0, -1.2);
  const ground = new T.Mesh(groundGeo, new T.MeshStandardMaterial({ color: "#292d39", roughness: 1 })); ground.receiveShadow = true; scene.add(ground);
  const strip = []; pts.forEach(([x, y]) => strip.push(x, y + 0.02, 1.2, x, y + 0.02, -1.2)); const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute(strip, 3));
  const idx = []; for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } sg.setIndex(idx); sg.computeVertexNormals();
  const layers=roadLayers(T,scene,pts,sg);
  const dirtTop = new T.Mesh(sg, new T.MeshStandardMaterial({ map:layers.topMap,roughness: .38,metalness:.16, side: T.DoubleSide })); dirtTop.receiveShadow = true; scene.add(dirtTop);
  const loopMesh = ter.loop ? makeLoopMesh(T, ter.loop) : null;
  if (loopMesh) scene.add(loopMesh);
  let flatMarkers;if(flat){flatMarkers=new T.InstancedMesh(new T.BoxGeometry(2,.006,.055),new T.MeshStandardMaterial({color:'#7ed4ed',emissive:'#174b63',emissiveIntensity:.5,roughness:.7}),82);const marker=new T.Object3D();for(let i=0;i<82;i++){marker.position.set(-200+(i%41)*10,.028,i<41?-1.05:1.05);marker.updateMatrix();flatMarkers.setMatrixAt(i,marker.matrix)}scene.add(flatMarkers);}
  ter.puddles.forEach(([a, b]) => { const m = new T.Mesh(new T.PlaneGeometry(b - a, 2.3), new T.MeshStandardMaterial({ color: "#3d6f8f", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })); m.rotation.x = -Math.PI / 2; m.position.set((a + b) / 2, ter.h((a + b) / 2) + 0.04, 0); scene.add(m); });
  const flag = (x, col, label) => { const g = new T.Group(); const y = ter.h(x); const pole = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 2.6), new T.MeshStandardMaterial({ color: "#ddd" })); pole.position.set(x, y + 1.3, -1.6);
    const f = new T.Mesh(new T.PlaneGeometry(0.9, 0.55), new T.MeshStandardMaterial({ color: col, side: T.DoubleSide })); f.position.set(x + 0.45, y + 2.3, -1.6); g.add(pole, f); g.userData.label = label; scene.add(g); return g; };
  ter.checkpoints.slice(1).forEach((x) => flag(x, "#39ff7a", "CP")); if(!flat){flag(ter.finish, "#ffffff", "FINISH"); flag(ter.finish, "#111111", "FINISH").position.z = 3.2;}
  // parallax hills (far layers move slower thanks to perspective) + scrub
  const buildLegacy=()=>{const rnd = ((r) => () => ((r = (r * 16807) % 2147483647) / 2147483647))(9);
  [[-18, "#c26a3a", 6, 0.6], [-40, "#9b5a43", 12, 0.4], [-75, "#6e4c5a", 22, 0.25]].forEach(([z, col, hh, den]) => { const s = new T.Shape(); s.moveTo(-60, -20); for (let x = -60; x <= renderEnd + 120; x += 8) s.lineTo(x, Math.sin(x * 0.05 * den + z) * hh * 0.5 + hh * 0.4 + rnd() * hh * 0.2); s.lineTo(renderEnd + 120, -20); s.closePath();
    const m = new T.Mesh(new T.ShapeGeometry(s), new T.MeshBasicMaterial({ color: col })); m.position.z = z; scene.add(m);legacyScenery.push(m); });
  for (let x = -20; x < renderEnd + 40; x += 3 + rnd() * 6) { const b = new T.Mesh(new T.IcosahedronGeometry(0.3 + rnd() * 0.4, 0), new T.MeshStandardMaterial({ color: rnd() > 0.5 ? "#6b7b3a" : "#8a8f4a", flatShading: true })); b.position.set(x, ter.h(x) + 0.1, -2.5 - rnd() * 3); b.castShadow = true; scene.add(b);legacyScenery.push(b); }};
  const environment=makeEnvironment(T,scene,ter,{lowDetail,theme:TH.environment});dirtTop.material.map=environment.roadMap;dirtTop.material.needsUpdate=true;if(flatMarkers)flatMarkers.visible=false;
  // the real garage bike, cloned
  const pivot = new T.Group(), body = new T.Group(); pivot.add(body); scene.add(pivot);
  let bike = preparedBike, A = src?.userData.wkAnchors;
  if (!bike) { bike = new T.Group(); A = { rearAxle: [-0.5, 0.33], frontAxle: [0.5, 0.33], wheelR: 0.33, bb: [0, 0.3], seatTop: [-0.2, 0.75], headTop: [0.4, 0.8] }; }
  bike.position.set(0, 0, 0); bike.rotation.set(0, 0, 0); bike.scale.set(1, 1, 1); bike.traverse((o) => { o.castShadow = true; if (o.name === "wk:stand" || o.name?.includes("platform")) o.visible = false; });
  bike.children.filter((c) => c.name === "wk:stand").forEach((c) => (c.visible = false));
  const cond = loadCond(); applyCondition(bike, cond);
  const P=rideParameters(stats,build,A,find);
  P.forkAxis=bike.getObjectByName('wk:model:fork')?.userData.wkFork?.axis||[0,1,0];P.forkVertical=P.forkAxis[1];P.rearLink=A.swingPivot?[A.rearAxle[0]-A.swingPivot[0],A.rearAxle[1]-A.swingPivot[1]]:null;
  const hC = P.comH - P.R; bike.position.set(-P.wb * P.comBack - A.rearAxle[0], -hC - A.rearAxle[1], 0); body.add(bike);
  // wheels move with their suspension (visible travel); find the wheel groups at each axle
  const wheels = [[], []]; bike.traverse((o) => { if (o.isGroup && o.parent && /wk:(tyres|motor)/.test(o.parent.name) && o.children.some((c) => c.geometry?.type === "TorusGeometry")) { const i = Math.abs(o.position.x - A.frontAxle[0]) < 0.05 ? 1 : 0; wheels[i].push([o, o.position.y]); } });
  const forkG = bike.getObjectByName("wk:suspension"), forkY = forkG?.position.y || 0;
  const mechanical=createBikeMotion(bike,build,find);
  const stuntRig=makeStuntRig(T,bike,A,find(build.motor)?.kind);
  const riderModel=makeRider(T,body,bike,A,mechanical);riderModel.update();let supermanPose=0,hopQueued=false;
  // particles: one instanced pool (roost, landing dust, puddle splash, scrape sparks)
  const NP = 260, pm = new T.InstancedMesh(new T.BoxGeometry(0.06, 0.06, 0.06), new T.MeshBasicMaterial({ color: "#fff" }), NP); pm.userData.wkFx = 1; pm.frustumCulled = false; scene.add(pm);
  const parts = Array.from({ length: NP }, () => ({ life: 0 })); let pi = 0; const o3 = new T.Object3D(), col = new T.Color();
  const smoke=new T.InstancedMesh(new T.SphereGeometry(.12,8,6),new T.MeshBasicMaterial({color:'#c5cec5',transparent:true,opacity:.32,depthWrite:false}),96),smokeParts=Array.from({length:96},()=>({life:0}));let smokeIndex=0;smoke.frustumCulled=false;smoke.userData.wkFx=1;scene.add(smoke);
  const emit = (x, y, vx, vy, c, life = 0.8, g = 9.8, sz = 1) => { const p = parts[pi = (pi + 1) % NP]; Object.assign(p, { x, y, z: (Math.random() - 0.5) * 0.6, vx, vy, life, max: life, g, sz }); pm.setColorAt(pi, col.set(c)); pm.instanceColor.needsUpdate = true; };
  for (let i = 0; i < NP; i++) pm.setColorAt(i, col.set("#fff"));
  const slowKey = 'wk-trials-completed';
  let slowUnlocked = !flat && localStorage.getItem(slowKey) === '1';
  let slowMo = false, reviewing = false, replayTail = 0, dropInEase = 0, rewinding = false, rewindT = 0, rewindPtr = null, rewindPrevX = null;
  let finishTime = 0, finishSpeed = 0, finishHeight = 0, finishFall = false, finishTumble = false;
  let photoDelay = -1, photoCount = 0;
  // state + input
  let crashRig=null;let s = makeState(P, 2, ter), lastCP = 2, cpI = 0, t0 = performance.now(), dirt = cond.dirt || 0, wear = { ...(cond.wear || {}) }, flips = 0, finished = false, crashT = 0, msg = "GO!", msgT = 2, maxScore = 0, reported = false, bank = 0;
  if(!P.pedal&&P.batteryWh<=0)s.battery=0;
  const inp = { throttle: 0, brake: 0, lean: 0, hop: 0, trick: 0, whip: 0 }, keys = {}, touch = { throttle: 0, brake: 0, lean: 0 }; let tilt = false, tiltLean = 0,paused=false; let pauseUi=null;
  const kd = (e) => { const k = e.key.toLowerCase(); if (reviewing) { if (k === "escape") { const wasPaused=paused; replay.clear(); if (wasPaused) pauseUi?.showMenu(); } return; } if (k === "escape" || k === "p") { e.preventDefault(); pauseUi?.toggle(); return; } if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault(); if(k===" ")hopQueued=true;const action=({z:"tailwhip",e:"tailwhip",x:"barspin",c:"superman"})[k];if(action&&!keys[k])s.stuntRequest={name:action,expires:.7};keys[k]=true;if(k==="r")respawn(); }, ku = (e) => (keys[e.key.toLowerCase()] = false);
  addEventListener("keydown", kd); addEventListener("keyup", ku);
  const ori = (e) => { if (tilt && e.gamma != null) { const land = Math.abs(window.orientation || screen.orientation?.angle || 0) === 90; const v = land ? (e.beta || 0) * Math.sign(window.orientation || screen.orientation?.angle || 1) : e.gamma; tiltLean = Math.max(-1, Math.min(1, -v / 25)); } };
  addEventListener("deviceorientation", ori);
  // HUD + touch controls (DOM over the canvas)
  const ui = document.createElement("div"); ui.style.cssText = "position:absolute;inset:0;pointer-events:none;font-family:'Bungee',Impact,sans-serif;color:#fff;user-select:none;-webkit-user-select:none"; el.appendChild(ui);
  ui.innerHTML = `<div class="ride-review-scrim" aria-hidden="true"></div><div class="ride-view-label">▣ SIDE VIEW (2.5D)</div><div class="ride-toolbar" style="position:absolute;top:8px;left:8px;display:flex;gap:8px;pointer-events:auto">
    <button data-r="back" style="${btnCss("#222", 54, 44)}">←</button><button data-r="reset" aria-label="Reset ride" style="${btnCss("#222", 48, 44)}">↻</button><button data-r="tilt" style="${btnCss("#222", 96, 44)}">TILT: OFF</button><button data-r="level" title="Change course and start a new run" style="${btnCss("#214632", 130, 44)}">ENDLESS ${flat?"∞":"OFF"}</button></div>
   ${pauseMenuMarkup(flat)}
   <div style="position:absolute;top:8px;right:10px;text-align:right;text-shadow:0 2px 6px #000"><div data-h="score" style="font-size:30px;color:#39ff7a">0</div><div data-h="best" style="font-size:13px;opacity:.85"></div></div>
   <div style="position:absolute;top:96px;left:10px;text-shadow:0 2px 6px #000"><div data-h="speed" style="font-size:34px">0<small> km/h</small></div><div data-h="wheelie" style="font-size:15px;color:#ffd23d"></div><div data-h="batt" style="font-size:13px;opacity:.85"></div><div data-h="prog" style="width:150px;height:6px;background:#0006;border-radius:3px;margin-top:6px"><div style="height:100%;width:0;background:#39ff7a;border-radius:3px"></div></div></div>
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
   ${rideControlsMarkup()}`;
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
  const leanControls=mountLeanControls(ui,touch);const tricksMenu=mountTricksMenu(ui);
  ui.querySelectorAll('[data-t]').forEach(b=>{const c=b.dataset.t;
    b.addEventListener('pointerdown',e=>{e.preventDefault();if (reviewing || finished) return;b.setPointerCapture?.(e.pointerId);held.set(e.pointerId,c);touch[c]=1;if(c==='hop')hopQueued=true;if(['tailwhip','barspin','superman'].includes(c))s.stuntRequest={name:c,expires:.7};b.dataset.pressed='true';b.style.filter='brightness(1.5)'});
    const up=e=>{if(held.get(e.pointerId)!==c)return;held.delete(e.pointerId);if([...held.values()].includes(c))return;touch[c]=0;delete b.dataset.pressed;b.style.filter=''};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,up);
  });
  const releaseControls=()=>{hopQueued=false;held.clear();for(const key of Object.keys(touch))touch[key]=0;for(const key of Object.keys(keys))delete keys[key];leanControls.release();ui.querySelectorAll('[data-t]').forEach(b=>{b.style.filter='';delete b.dataset.pressed})};
  const visibility=()=>{if(document.hidden){releaseControls();replay.setCaptureActive?.(false)}};
  const appCovered=()=>{if(document.hidden||document.body.dataset.playerView)return true;for(const n of document.querySelectorAll('[role=menu],[role=dialog],[aria-modal="true"]'))if(!el.contains(n)&&!n.hidden&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden')return true;return false};
  addEventListener('blur',releaseControls);document.addEventListener('visibilitychange',visibility);
  $('[data-r="back"]').onclick = () => close(); $('[data-r="reset"]').onclick = () => respawn();
  const restartRun=()=>{finished=true;respawn();};
  let replacementStop=null;const switchLevel=()=>{localStorage.setItem('wk-level',flat?'trials':'flat');stop(false);replacementStop=mountRide(el,{stats,build,onResult,onClose,lowDetail:qualityPick.manual,quality:qualityMon.state().tier,qualityManual:qualityPick.manual,pixelRatioCap:maxPR,theme:TH});};$('[data-r="level"]').onclick=switchLevel;
  pauseUi = mountRidePause(ui, {
    getPaused: () => paused,
    setPaused: (v) => { paused = v; },
    onRespawn: () => respawn(),
    onRestart: () => restartRun(),
    onMode: () => switchLevel(),
    onReplay: () => { paused = true; el.toggleAttribute('data-wk-paused', true); replay.openFromPause(); },
    onGallery: () => { paused = true; el.toggleAttribute('data-wk-paused', true); pauseUi?.syncFab(true); replay.openGallery?.(); },
    releaseControls,
    rootEl: el,
    flat,
  });
  $('[data-r="tilt"]').onclick = async (e) => { try { if (!tilt && typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); } catch {} tilt = !tilt; tiltLean = 0; e.target.textContent = "TILT: " + (tilt ? "ON" : "OFF"); };
  function cancelRewindHold() {
    rewinding = false; rewindPtr = null; rewindPrevX = null;
    const btn = ui.querySelector('[data-r="rewind"]');
    if (btn) { btn.classList.remove('is-held'); btn.setAttribute('aria-pressed', 'false'); }
  }
  function respawn() {
    cancelRewindHold();
    const restarting = finished;
    const keep = restarting ? {} : {score:s.score,odo:s.odo,battery:s.battery,bestWheelie:s.bestWheelie};
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
    s = Object.assign(makeState(P, lastCP, ter), keep);
    if (restarting && !P.pedal && P.batteryWh <= 0) s.battery = 0;
    pivot.position.set(s.x, s.y, 0);
    pivot.rotation.set(0, 0, 0);
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
    if(meta.dirt!=null)dirt=meta.dirt;
    if(meta.wear)wear={...meta.wear};
  }
  function startRewind(e){
    if(finished||reviewing||paused||!s.crashed||rewinding)return;
    if(!replay.buffer?.length)return;
    e.preventDefault();
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
  const viewLabel=ui.querySelector('.ride-view-label'),hc={},put=(e,k,v)=>{if(hc[k]!==v){hc[k]=v;e.textContent=v}},putHtml=(e,k,v)=>{if(hc[k]!==v){hc[k]=v;e.innerHTML=v}},sty=(k,v)=>{if(hc['s'+k]!==v){hc['s'+k]=v;ui.style[k]=v}};
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
        s.x += s.vx * realDt;
        s.y += (ter.h(s.x) + finishHeight - s.y) * Math.min(1, realDt * 8);
        s.pitch *= Math.exp(-5 * realDt);
        if (finishFall && finishTime >= 5) {
          s.pitch = -.32;
          s.w = -2.3;
          finishTumble = true;
        }
      }
    }
    if(!paused&&!reviewing){const qa=qualityMon.sample(cameraDt);if(qa){qualityLog.push(qa.type);if(qa.type==='down'){maxPR=Math.max(.75,maxPR*.8);if(R.shadowMap.enabled){R.shadowMap.enabled=false;scene.traverse(o=>{if(o.material)for(const m of [].concat(o.material))m.needsUpdate=true})}}}}
    leanControls.update(dt);
    inp.throttle = Math.max(touch.throttle, keys.arrowup || keys.w ? 1 : 0); inp.brake = Math.max(touch.brake, keys.arrowdown || keys.s ? 1 : 0);
    inp.lean = Math.max(-1, Math.min(1, touch.lean+(touch.leanForward||0)-(touch.leanBack||0)+(keys.arrowright||keys.d?1:0)-(keys.arrowleft||keys.a?1:0)+(tilt?tiltLean:0)))*-1;
    inp.hop=hopQueued||touch.hop||keys[" "]?1:0;hopQueued=false;inp.trick=touch.trick||keys.q?1:0;inp.whip=0;inp.tailwhip=touch.tailwhip||keys.z||keys.e?1:0;inp.barspin=touch.barspin||keys.x?1:0;inp.superman=touch.superman||keys.c?1:0;
    if (finished) Object.keys(inp).forEach(key => { inp[key] = 0; });
    if (!s.crashed && !finished) {
      const n = Math.ceil(dt * 480);
      for (let k = 0; k < n; k++) {
        step(s, P, inp, dt / n, ter);
        if (dt > 0 && capturing) replay.recordStep(s, dt / n, { dirt, wear, flips, maxScore, lastCP });
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
      if (ev.type === "land") { const rx = s.x - P.wb * P.comBack; for (let i = 0; i < 18; i++) emit(rx + (Math.random() - 0.5), ter.h(rx) + 0.05, (Math.random() - 0.5) * 4, Math.random() * 2.5, "#d9b48a", 0.9, 4); if (ev.v < -6) { msg = "HARD LANDING"; msgT = 0.8; wear.suspension = (wear.suspension || 0) + 0.04; } }
      if (ev.type === "bottom") { msg = "BOTTOMED OUT – MORE SUSPENSION!"; msgT = 1; wear.shock = (wear.shock || 0) + 0.02; }
      if (ev.type === "scrape") { for (let i = 0; i < 2; i++) emit(ev.x, ev.y, -s.vx * 0.3 - Math.random() * 2, Math.random() * 2, Math.random() > 0.5 ? "#ffd23d" : "#ff8c1a", 0.35, 6, 0.6); }
      if (ev.type === "crash") { msg = "CRASH! " + ev.why; msgT = 99; hud.trick.textContent = ""; for (let i = 0; i < 30; i++) emit(s.x, s.y, (Math.random() - 0.5) * 6, Math.random() * 4, "#c9844a", 1.2, 8); }
    }
    for (const k in s.wear) { wear[k] = (wear[k] || 0) + s.wear[k]; } s.wear = {};
    if(s.burnout&&!s.crashed&&!paused){for(let i=0;i<3;i++){const particle=smokeParts[smokeIndex++%smokeParts.length];Object.assign(particle,{x:s.x+P.wb*(P.driveAxle==='front'?1-P.comBack:-P.comBack),y:ter.h(s.x)+.12,z:(Math.random()-.5)*.35,vx:-.5-Math.random(),vy:.5+Math.random()*.6,life:1.8});}msg='BURNOUT';msgT=.2;}
    // roost + splash + dirt build-up
    const rx = s.x + Math.cos(s.pitch) * (-P.wb * P.comBack) + Math.sin(s.pitch) * hC, onRear = s.ground[0];
    if (!paused && onRear && inp.throttle && Math.abs(s.vx) > 0.5 && Math.random() < 0.8) emit(rx - P.R * 0.6, ter.h(rx) + 0.05, -2 - Math.random() * 3 - Math.abs(s.vx) * 0.2, 1 + Math.random() * 2.5, ter.inPuddle(rx) ? "#7fb4d6" : "#a8693a", 0.7);
    if (!paused && ter.inPuddle(s.x) && (s.ground[0] || s.ground[1])) { dirt += dt * 0.05 * Math.min(10, Math.abs(s.vx)); if (Math.abs(s.vx) > 2 && Math.random() < 0.9) for (let i = 0; i < 3; i++) emit(s.x + (Math.random() - 0.5), ter.h(s.x) + 0.05, (Math.random() - 0.3) * s.vx * 0.4, 2 + Math.random() * 3, "#9fd0ef", 0.8); }
    else if (s.ground[0] || s.ground[1]) dirt += dt * 0.0015 * Math.abs(s.vx);
    if ((fxT += dt) > 0.6) { fxT = 0; applyCondition(bike, { dirt: Math.min(1, dirt), wear: {} }); const fr = bike.getObjectByName("wk:part:fender_r"); if (fr) { const w = 0; fr.visible = w < 1; if (w >= 0.4 && w < 1) fr.rotation.z = -0.12; } }
    // particles update
    for (let i = 0; i < NP; i++) { const p = parts[i]; if (p.life > 0) { p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y < ter.h(p.x)) { p.y = ter.h(p.x); p.vy *= -0.2; p.vx *= 0.5; } o3.position.set(p.x, p.y, p.z); o3.scale.setScalar(Math.max(0.01, p.life / p.max) * p.sz); } else o3.scale.setScalar(0); o3.updateMatrix(); pm.setMatrixAt(i, o3.matrix); }
    pm.instanceMatrix.needsUpdate = true;
    smokeParts.forEach((particle,i)=>{if(particle.life>0){particle.life-=dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;o3.position.set(particle.x,particle.y,particle.z);o3.scale.setScalar((1+(1-particle.life/1.8)*3)*Math.min(1,particle.life*3));}else o3.scale.setScalar(0);o3.updateMatrix();smoke.setMatrixAt(i,o3.matrix)});smoke.instanceMatrix.needsUpdate=true;
    // Rider and bike inherit momentum, then collide as separate constrained bodies.
    if(rewinding){pivot.position.set(s.x,s.y,0);pivot.rotation.z=s.pitch;}
    else if(s.crashed || finishTumble){if(!crashRig){stuntRig.restore();s.stunt=null;pivot.position.set(s.x,s.y,0);pivot.rotation.z=s.pitch;crashRig=makeCrashRig(T,scene,body,pivot,bike,A,riderModel,P,ter,s);releaseControls();if (!finished) { el.dataset.wkCrashed='true';recover.hidden=false; }}crashT+=dt;crashRig.step(dt);}
    else { pivot.position.set(s.x, s.y, 0); pivot.rotation.z = s.pitch; }
    spinVis = s.spinV ? s.spin : s.whip ? Math.sin(Math.min(1, s.air * 2) * Math.PI) * 0.9 : 0; pivot.rotation.y = spinVis;
    // suspension: wheels slide toward the frame by compression*travel
    stuntRig.restore();
    const wheelDist=rewinding?rewindDx:s.vx*dt;
    if(mechanical)mechanical.update({distance:wheelDist,frontDistance:rewinding?rewindDx:s.burnout&&P.driveAxle==='front'?dt*Math.min(18,4+P.power/1500):s.vx*dt,rearDistance:rewinding?rewindDx:s.burnout&&P.driveAxle!=='front'?dt*Math.min(18,4+P.power/1500):s.vx*dt,driveDistance:rewinding?rewindDx:s.burnout?(find(build.motor)?.kind==="mid"?dt*Math.min(18,4+P.power/1500):0):inp.throttle>0||find(build.motor)?.nopedal||s.reversing?s.vx*dt:0,rearCompression:crashRig?0:build.shock?s.comp[0]||0:0,frontCompression:crashRig?0:s.comp[1]||0,travelR:P.travelR,travelF:P.travelF});
    else wheels.forEach((ws, i) => ws.forEach(([w, y0]) => (w.position.y = y0 + (s.comp[i] || 0) * (i ? P.travelF : P.travelR) * 0.8)));
    supermanPose=s.stunt?.name==="superman"?Math.sin(Math.PI*Math.min(1,s.stunt.elapsed/s.stunt.duration)):0;if(!crashRig)riderModel.update({lean:inp.lean,superman:supermanPose});stuntRig.pose(s.stunt);
    // checkpoints / finish
    while (cpI + 1 < ter.checkpoints.length && s.x > ter.checkpoints[cpI + 1]) { cpI++; lastCP = ter.checkpoints[cpI] + 1; msg = "CHECKPOINT " + cpI; msgT = 1.2; }
    if (!finished && !s.crashed && s.x > ter.finish) {
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
    const sc=sideCam.update(reviewing ? 0 : cameraDt,{x:s.x,y:s.y,vx:s.vx,vy:s.vy,speed:sp,grounded:!!(s.ground[0]||s.ground[1]),groundY:ter.h(s.x),landingY:ter.h(s.x+Math.max(2,s.vx*.35)),inLoop:!!s.loopRide,focus:crashFocus,reduceMotion:reduceMotion.matches}),dist=sc.dist;
    const targetBlend=cameraView==='chase'?1:0;cameraBlend+=Math.max(-cameraDt/.4,Math.min(cameraDt/.4,targetBlend-cameraBlend));const blend=cameraBlend*cameraBlend*(3-2*cameraBlend),angle=blend*Math.PI/2,radius=dist*(1-blend)+(3.0+Math.min(2,sp*.12))*blend;
    const cx=sc.x*(1-blend)+(crashFocus?.x??s.x+Math.min(3,s.vx*.15))*blend,riderY=sc.y*(1-blend)+(crashFocus?.y??s.y)*blend,side=1-blend;
    cameraReady=true;
    if(!globalThis.__WK_CAM_HOLD__){cam.position.set(cx-Math.sin(angle)*radius+sc.bobX*side,riderY+(.45+dist*.025)*side+1.10*blend+sc.bobY*side,Math.cos(angle)*radius+.4*blend);cam.lookAt(cx+blend*3.2,riderY+(.45+dist*.025-.65)*side-.65*blend+sc.bobY*.6*side,0);if(side>0&&sc.roll)cam.rotateZ(sc.roll*side);cam.fov=40+blend*5;cam.updateProjectionMatrix();}
    environment.update(s.x);environment.view(blend);put(viewLabel,'view',cameraView==='chase'?'▣ CHASE · DEPTH PREVIEW':'▣ SIDE VIEW (2.5D)');

    sun.position.set(s.x + 4, s.y + 10, 6); sun.target.position.set(s.x, s.y, 0);
    sky.position.x = cam.position.x; sunDisc.position.x = cam.position.x + 40;
    // HUD
    put(hud.score,"score",Math.round(s.score).toLocaleString()); if(!flat)put(hud.best,"best","$ +" + Math.round(maxScore / 10).toLocaleString() + " · DIRT " + Math.round(Math.min(1, dirt) * 100) + "%");
    putHtml(hud.speed,'speed',Math.round(sp * 3.6) + "<small style='font-size:14px'> km/h</small>"); put(hud.wheelie,'wheelie',s.balance ? `${s.balance} ${(s.balance.includes("WHEEL") || s.balance === "MANUAL" ? s.wheelieT : s.stoppieT).toFixed(1)}s` : s.bestWheelie ? `BEST MONO ${s.bestWheelie.toFixed(1)}s` : "");
    put(hud.batt,'batt',P.powertrain==='petrol'?'FUEL '+Math.round(s.battery*100)+'% · '+(stats.cc??find(build.motor)?.cc??'')+'cc':P.pedal ? "PEDAL POWER" : "BATTERY " + Math.round(s.battery * 100) + "%"); {const pw = Math.max(0, Math.min(100, s.x / ter.finish * 100)) + "%"; if(hc.pw!==pw){hc.pw=pw;hud.prog.firstChild.style.width = pw;}}
    if (s.trickT <= 0 && hud.trick.style.opacity!=='0') hud.trick.style.opacity = Math.max(0, +hud.trick.style.opacity - dt * 2); msgT -= dt; put(hud.msg,'msg',paused?"PAUSED":msgT > 0 ? msg : "");
    const w = W(), h = H(),screenScale=el.getBoundingClientRect().width/w;sty("transformOrigin","top left");sty("transform",`scale(${1/screenScale})`);sty("width",(w*screenScale)+"px");sty("height",(h*screenScale)+"px");sty("right","auto");sty("bottom","auto");const pixelRatio=Math.min(maxPR,devicePixelRatio*screenScale);if(R.getPixelRatio()!==pixelRatio)R.setPixelRatio(pixelRatio);if (R.domElement.width !== Math.floor(w * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    layoutBackdrop(horizonTex||backdrop,w,h,Math.sin(s.x*.001)*TH.backdrop.sway,blend);
    if(flat){const tile=Math.floor(s.x/100)*100;ground.position.x=tile;dirtTop.position.x=tile;layers.foreground.position.x=tile;layers.update(tile);flatMarkers.position.x=tile;sky.position.x=s.x;sunDisc.position.x=s.x+40;if(hc.pd!=='none'){hc.pd='none';hud.prog.style.display='none'}put(hud.best,'best','FLAT ENDLESS · '+Math.floor(s.odo)+' m');}
    // While the replay panel covers the game, the scene is frozen: draw it once and leave the GPU/main thread to the video decoder (fixes stuttery replays on phones).
    if (!reviewing || !hc.reviewDrawn) { R.render(scene, cam); hc.reviewDrawn = reviewing; }
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
  const sideCam=createSideCamera(),reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');let cameraView='side',cameraBlend=0,cameraReady=false;globalThis.__WK_SCENE_VIEW__=view=>{cameraView=view==='chase'?'chase':'side';return cameraView};
  const rideLod=lightenForRide(T,scene);
  raf = requestAnimationFrame(frame);
  globalThis.__WK_RIDE_SCENE__=()=>({scene,cam});globalThis.__WK_REPLAY__=replay;
  globalThis.__WK_RIDE_STATE__ = () => ({ s, P, dirt, wear, flips, finished, inp, ter, slowMo, slowUnlocked, cameraX:cam.position.x,groundX:ground.position.x,render:{calls:R.info.render.calls,triangles:R.info.render.triangles,geometries:R.info.memory.geometries,textures:R.info.memory.textures},environment:environment.state(),cameraView,cameraBlend,crash:crashRig?.state()||null,rider:riderModel.state(),backdropLoaded,sceneryLayers:['background','road','foreground'],paused,stunt:s.stunt?{...s.stunt}:null,supermanPose,stuntVisual:stuntRig.state(),controls:leanControls.state(),tricksOpen:tricksMenu.state().open,quality:{antialias:R.getContext().getContextAttributes().antialias,start:qualityPick.name,manual:qualityPick.manual,maxPR,shadows:R.shadowMap.enabled,...qualityMon.state(),log:qualityLog},rideLod:{swapped:rideLod.swapped,before:rideLod.before,after:rideLod.after},mechanical:mechanical?.state,rewinding,rewindT,bufferLength:replay.buffer?.length||0,bufferT:replay.buffer?.t||0 });
  function stop(save=true) {if(disposed)return;disposed=true;if(save)report();replay.dispose();releaseControls();cancelAnimationFrame(raf); removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("deviceorientation", ori);removeEventListener('blur',releaseControls);document.removeEventListener('visibilitychange',visibility);for(const type of blockedGestures)el.removeEventListener(type,blockBrowserGesture);el.removeAttribute('data-wk-ride-surface');el.removeAttribute('data-wk-paused');el.removeAttribute('data-wk-crashed');el.removeAttribute('data-wk-finished');cancelRewindHold();crashRig?.restore();crashRig=null; delete globalThis.__WK_SCENE_VIEW__;delete globalThis.__WK_RIDE_SCENE__;environment.dispose();loopMesh?.geometry.dispose();loopMesh?.material.dispose();rideLod.dispose();horizonTex?.dispose();backdrop.dispose();smoke.geometry.dispose();smoke.material.dispose();R.dispose();R.forceContextLoss();el.innerHTML="";}
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
