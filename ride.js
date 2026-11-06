// Wheelie King ride (v16). MotoX-Mayhem-style side-on 3D ride using the REAL garage bike (cloned, with its parts and stickers).
// Physics: ride-physics.js (pure 2D, reusable for a later 3D mode). This file is only rendering, input, FX, HUD and saving condition.
import * as T from "./vendor/three.module.js";
import { makeTerrain, makeFlatTerrain, makeState, step } from "./ride-physics.js";
import {rideParameters} from './ride-parameters.js';
import {createBikeMotion} from './bike-motion.js';
import {rideControlsMarkup,mountLeanControls} from './ride-controls.js';
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

export function mountRide(el, { stats = {}, build = {}, onResult, onClose, lowDetail=false }) {
  const src=(()=>{let root=null;globalThis.__WK_VIEW__?.scene.traverse(o=>{if(!root&&o.name==='wk:frame')root=o.parent});return root})(),preparedBike=src?cloneForRide(src):null;
  el.setAttribute('data-wk-ride-surface','');
  const blockBrowserGesture=e=>{if(e.type.startsWith('touch')&&e.target.closest?.('[data-r],button,input'))return;if(e.cancelable)e.preventDefault()};
  const blockedGestures=['selectstart','contextmenu','dragstart','gesturestart','gesturechange','touchstart','touchmove'];
  for(const type of blockedGestures)el.addEventListener(type,blockBrowserGesture,{passive:false});
  window.getSelection()?.removeAllRanges();
  const W = () => el.clientWidth || 900, H = () => el.clientHeight || 420;
  const R = new T.WebGLRenderer({ antialias: !lowDetail,powerPreference:"high-performance" }); R.setPixelRatio(Math.min(lowDetail?1:1.5, devicePixelRatio*el.getBoundingClientRect().width/W())); R.shadowMap.enabled = !lowDetail; R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping;
  R.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none"; el.appendChild(R.domElement);
  const scene = new T.Scene(); scene.background = new T.Color("#55516d"); scene.fog = new T.Fog("#69637e", 25, 95);
  const cam = new T.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  scene.add(new T.HemisphereLight("#d3d4ff", "#725d89", 1.8)); const sun = new T.DirectionalLight("#ffd7c6", 2.4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 }); scene.add(sun, sun.target);
  // sky gradient + sun disc
  const sky = new T.Mesh(new T.PlaneGeometry(900, 260), new T.ShaderMaterial({ depthWrite: false, fog: false, uniforms: {}, vertexShader: "varying float v;void main(){v=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}", fragmentShader: "varying float v;void main(){gl_FragColor=vec4(mix(vec3(.98,.6,.3),vec3(.25,.45,.85),smoothstep(.35,.8,v)),1.);}" }));
  sky.position.set(0, 40, -120); scene.add(sky);
  const sunDisc = new T.Mesh(new T.CircleGeometry(9, 32), new T.MeshBasicMaterial({ color: "#fff3b0", fog: false })); sunDisc.position.set(40, 30, -110); scene.add(sunDisc);
  const legacyScenery=[];let backdropLoaded=false;const backdrop=new T.TextureLoader().load('./icons/neon-skatepark-background.png',texture=>{texture.colorSpace=T.SRGBColorSpace;scene.background=texture;sky.visible=false;sunDisc.visible=false;legacyScenery.forEach(o=>o.visible=false);backdropLoaded=true;});
  // terrain
  const flat=(localStorage.getItem('wk-level')||'flat')==='flat',ter=flat?makeFlatTerrain():makeTerrain((build.frame || "bmx").length * 7 + 3),renderEnd=flat?500:ter.finish;const pts=ter.pts;
  const shape = new T.Shape(); shape.moveTo(pts[0][0],pts[0][1]-.45);pts.forEach(([x,y])=>shape.lineTo(x,y));[...pts].reverse().forEach(([x,y])=>shape.lineTo(x,y-.45));shape.closePath();
  const groundGeo = new T.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false }); groundGeo.translate(0, 0, -1.2);
  const ground = new T.Mesh(groundGeo, new T.MeshStandardMaterial({ color: "#292d39", roughness: 1 })); ground.receiveShadow = true; scene.add(ground);
  const strip = []; pts.forEach(([x, y]) => strip.push(x, y + 0.02, 1.2, x, y + 0.02, -1.2)); const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute(strip, 3));
  const idx = []; for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } sg.setIndex(idx); sg.computeVertexNormals();
  const layers=roadLayers(T,scene,pts,sg);
  const dirtTop = new T.Mesh(sg, new T.MeshStandardMaterial({ map:layers.topMap,roughness: .38,metalness:.16, side: T.DoubleSide })); dirtTop.receiveShadow = true; scene.add(dirtTop);
  let flatMarkers;if(flat){flatMarkers=new T.InstancedMesh(new T.BoxGeometry(2,.006,.055),new T.MeshStandardMaterial({color:'#7ed4ed',emissive:'#174b63',emissiveIntensity:.5,roughness:.7}),82);const marker=new T.Object3D();for(let i=0;i<82;i++){marker.position.set(-200+(i%41)*10,.028,i<41?-1.05:1.05);marker.updateMatrix();flatMarkers.setMatrixAt(i,marker.matrix)}scene.add(flatMarkers);}
  ter.puddles.forEach(([a, b]) => { const m = new T.Mesh(new T.PlaneGeometry(b - a, 2.3), new T.MeshStandardMaterial({ color: "#3d6f8f", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })); m.rotation.x = -Math.PI / 2; m.position.set((a + b) / 2, ter.h((a + b) / 2) + 0.04, 0); scene.add(m); });
  const flag = (x, col, label) => { const g = new T.Group(); const y = ter.h(x); const pole = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 2.6), new T.MeshStandardMaterial({ color: "#ddd" })); pole.position.set(x, y + 1.3, -1.6);
    const f = new T.Mesh(new T.PlaneGeometry(0.9, 0.55), new T.MeshStandardMaterial({ color: col, side: T.DoubleSide })); f.position.set(x + 0.45, y + 2.3, -1.6); g.add(pole, f); g.userData.label = label; scene.add(g); return g; };
  ter.checkpoints.slice(1).forEach((x) => flag(x, "#39ff7a", "CP")); if(!flat){flag(ter.finish, "#ffffff", "FINISH"); flag(ter.finish, "#111111", "FINISH").position.z = 3.2;}
  // parallax hills (far layers move slower thanks to perspective) + scrub
  const rnd = ((r) => () => ((r = (r * 16807) % 2147483647) / 2147483647))(9);
  [[-18, "#c26a3a", 6, 0.6], [-40, "#9b5a43", 12, 0.4], [-75, "#6e4c5a", 22, 0.25]].forEach(([z, col, hh, den]) => { const s = new T.Shape(); s.moveTo(-60, -20); for (let x = -60; x <= renderEnd + 120; x += 8) s.lineTo(x, Math.sin(x * 0.05 * den + z) * hh * 0.5 + hh * 0.4 + rnd() * hh * 0.2); s.lineTo(renderEnd + 120, -20); s.closePath();
    const m = new T.Mesh(new T.ShapeGeometry(s), new T.MeshBasicMaterial({ color: col })); m.position.z = z; scene.add(m);legacyScenery.push(m); });
  for (let x = -20; x < renderEnd + 40; x += 3 + rnd() * 6) { const b = new T.Mesh(new T.IcosahedronGeometry(0.3 + rnd() * 0.4, 0), new T.MeshStandardMaterial({ color: rnd() > 0.5 ? "#6b7b3a" : "#8a8f4a", flatShading: true })); b.position.set(x, ter.h(x) + 0.1, -2.5 - rnd() * 3); b.castShadow = true; scene.add(b);legacyScenery.push(b); }
  const environment=makeEnvironment(T,scene,ter,{lowDetail});dirtTop.material.map=environment.roadMap;dirtTop.material.needsUpdate=true;if(flatMarkers)flatMarkers.visible=false;
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
  // state + input
  let crashRig=null;let s = makeState(P, 2, ter), lastCP = 2, cpI = 0, t0 = performance.now(), dirt = cond.dirt || 0, wear = { ...(cond.wear || {}) }, flips = 0, finished = false, crashT = 0, msg = "GO!", msgT = 2, maxScore = 0, reported = false, bank = 0;
  if(!P.pedal&&P.batteryWh<=0)s.battery=0;
  const inp = { throttle: 0, brake: 0, lean: 0, hop: 0, trick: 0, whip: 0 }, keys = {}, touch = { throttle: 0, brake: 0, lean: 0 }; let tilt = false, tiltLean = 0,paused=false;
  const kd = (e) => { const k = e.key.toLowerCase(); if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault(); if(k===" ")hopQueued=true;const action=({z:"tailwhip",e:"tailwhip",x:"barspin",c:"superman"})[k];if(action&&!keys[k])s.stuntRequest={name:action,expires:.7};keys[k]=true;if(k==="r")respawn(); if (k === "escape") close(); }, ku = (e) => (keys[e.key.toLowerCase()] = false);
  addEventListener("keydown", kd); addEventListener("keyup", ku);
  const ori = (e) => { if (tilt && e.gamma != null) { const land = Math.abs(window.orientation || screen.orientation?.angle || 0) === 90; const v = land ? (e.beta || 0) * Math.sign(window.orientation || screen.orientation?.angle || 1) : e.gamma; tiltLean = Math.max(-1, Math.min(1, -v / 25)); } };
  addEventListener("deviceorientation", ori);
  // HUD + touch controls (DOM over the canvas)
  const ui = document.createElement("div"); ui.style.cssText = "position:absolute;inset:0;pointer-events:none;font-family:'Bungee',Impact,sans-serif;color:#fff;user-select:none;-webkit-user-select:none"; el.appendChild(ui);
  ui.innerHTML = `<div class="ride-view-label">▣ SIDE VIEW (2.5D)</div><div class="ride-toolbar" style="position:absolute;top:8px;left:8px;display:flex;gap:8px;pointer-events:auto">
    <button data-r="back" style="${btnCss("#222", 54, 44)}">←</button><button data-r="pause" aria-label="Pause ride" style="${btnCss("#222", 48, 44)}">Ⅱ</button><button data-r="reset" aria-label="Reset ride" style="${btnCss("#222", 48, 44)}">↻</button><button data-r="tilt" style="${btnCss("#222", 96, 44)}">TILT: OFF</button><button data-r="level" title="Change course and start a new run" style="${btnCss("#214632", 130, 44)}">ENDLESS ${flat?"∞":"OFF"}</button></div>
   <div style="position:absolute;top:8px;right:10px;text-align:right;text-shadow:0 2px 6px #000"><div data-h="score" style="font-size:30px;color:#39ff7a">0</div><div data-h="best" style="font-size:13px;opacity:.85"></div></div>
   <div style="position:absolute;top:96px;left:10px;text-shadow:0 2px 6px #000"><div data-h="speed" style="font-size:34px">0<small> km/h</small></div><div data-h="wheelie" style="font-size:15px;color:#ffd23d"></div><div data-h="batt" style="font-size:13px;opacity:.85"></div><div data-h="prog" style="width:150px;height:6px;background:#0006;border-radius:3px;margin-top:6px"><div style="height:100%;width:0;background:#39ff7a;border-radius:3px"></div></div></div>
   <div data-h="trick" style="position:absolute;top:22%;width:100%;text-align:center;font-size:34px;color:#39ff7a;text-shadow:0 0 14px #000"></div>
   <div data-h="msg" style="position:absolute;top:36%;width:100%;text-align:center;font-size:26px;text-shadow:0 0 10px #000"></div>
   ${rideControlsMarkup()}`;
  const $ = (q) => ui.querySelector(q), hud = Object.fromEntries([...ui.querySelectorAll("[data-h]")].map((e) => [e.dataset.h, e]));
  const held = new Map(); // pointerId -> control
  const leanControls=mountLeanControls(ui,touch);
  ui.querySelectorAll('[data-t]').forEach(b=>{const c=b.dataset.t;
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);held.set(e.pointerId,c);touch[c]=1;if(c==='hop')hopQueued=true;if(['tailwhip','barspin','superman'].includes(c))s.stuntRequest={name:c,expires:.7};b.dataset.pressed='true';b.style.filter='brightness(1.5)'});
    const up=e=>{if(held.get(e.pointerId)!==c)return;held.delete(e.pointerId);if([...held.values()].includes(c))return;touch[c]=0;delete b.dataset.pressed;b.style.filter=''};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,up);
  });
  const releaseControls=()=>{hopQueued=false;held.clear();for(const key of Object.keys(touch))touch[key]=0;for(const key of Object.keys(keys))delete keys[key];leanControls.release();ui.querySelectorAll('[data-t]').forEach(b=>{b.style.filter='';delete b.dataset.pressed})};
  const visibility=()=>{if(document.hidden)releaseControls()};
  addEventListener('blur',releaseControls);document.addEventListener('visibilitychange',visibility);
  $('[data-r="back"]').onclick = () => close(); $('[data-r="reset"]').onclick = () => respawn();
  $('[data-r="pause"]').onclick=()=>{paused=!paused;el.toggleAttribute('data-wk-paused',paused);releaseControls();const b=$('[data-r="pause"]');b.textContent=paused?'▶':'Ⅱ';b.setAttribute('aria-label',paused?'Resume ride':'Pause ride');};
  let replacementStop=null,disposed=false;const switchLevel=()=>{localStorage.setItem('wk-level',flat?'trials':'flat');stop(false);replacementStop=mountRide(el,{stats,build,onResult,onClose});};$('[data-r="level"]').onclick=switchLevel;
  $('[data-r="tilt"]').onclick = async (e) => { try { if (!tilt && typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); } catch {} tilt = !tilt; tiltLean = 0; e.target.textContent = "TILT: " + (tilt ? "ON" : "OFF"); };
  function respawn() { const keep={score:s.score,odo:s.odo,battery:s.battery,bestWheelie:s.bestWheelie};crashRig?.restore();crashRig=null;releaseControls();paused=false;el.removeAttribute("data-wk-paused");const pause=ui.querySelector('[data-r="pause"]');pause.textContent="Ⅱ";pause.setAttribute("aria-label","Pause ride");delete el.dataset.wkCrashed;const recover=ui.querySelector('[data-r="recover"]');if(recover)recover.hidden=true;s=Object.assign(makeState(P,lastCP,ter),keep);pivot.position.set(s.x,s.y,0);pivot.rotation.set(0,0,0);crashT=0;msg="RECOVERED";msgT=.7; }
  const recover=document.createElement('button');recover.dataset.r='recover';recover.hidden=true;recover.textContent='↻ RECOVER';recover.setAttribute('aria-label','Instant recover');recover.style.cssText=btnCss('#65ee6b',170,48)+';position:absolute;left:50%;bottom:130px;transform:translateX(-50%);pointer-events:auto;font-weight:900;color:#092015;z-index:10';recover.onclick=respawn;ui.append(recover);
  function report() { if (reported) return; reported = true; saveCond({ dirt: Math.min(1, dirt), wear }); try { onResult?.({ score: Math.round(maxScore), flips, wheelieT: s.bestWheelie || 0, finished, money: Math.round(maxScore / 10) }); } catch (e) { console.warn(e); } }
  function close() { report(); onClose?.(); }
  // loop
  let raf = 0, last = performance.now(), fxT = 0, spinVis = 0;
  const frame = (now) => { raf = requestAnimationFrame(frame); const cameraDt=Math.max(0,Math.min(.25,(now-last)/1000)),dt = paused?0:Math.min(0.05,cameraDt); last = now;
    leanControls.update(dt);
    inp.throttle = Math.max(touch.throttle, keys.arrowup || keys.w ? 1 : 0); inp.brake = Math.max(touch.brake, keys.arrowdown || keys.s ? 1 : 0);
    inp.lean = Math.max(-1, Math.min(1, touch.lean+(touch.leanForward||0)-(touch.leanBack||0)+(keys.arrowright||keys.d?1:0)-(keys.arrowleft||keys.a?1:0)+(tilt?tiltLean:0)))*-1;
    inp.hop=hopQueued||touch.hop||keys[" "]?1:0;hopQueued=false;inp.trick=touch.trick||keys.q?1:0;inp.whip=0;inp.tailwhip=touch.tailwhip||keys.z||keys.e?1:0;inp.barspin=touch.barspin||keys.x?1:0;inp.superman=touch.superman||keys.c?1:0;
    if (!s.crashed && !finished) { const n = Math.ceil(dt * 480); for (let k = 0; k < n; k++) step(s, P, inp, dt / n, ter); }
    // events -> FX, wear, messages
    for (const ev of s.events.splice(0)) {
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
    if(s.crashed){if(!crashRig){stuntRig.restore();s.stunt=null;pivot.position.set(s.x,s.y,0);pivot.rotation.z=s.pitch;crashRig=makeCrashRig(T,scene,body,pivot,bike,A,riderModel,P,ter,s);releaseControls();el.dataset.wkCrashed='true';recover.hidden=false;}crashT+=dt;crashRig.step(dt);}
    else { pivot.position.set(s.x, s.y, 0); pivot.rotation.z = s.pitch; }
    spinVis = s.spinV ? s.spin : s.whip ? Math.sin(Math.min(1, s.air * 2) * Math.PI) * 0.9 : 0; pivot.rotation.y = spinVis;
    // suspension: wheels slide toward the frame by compression*travel
    stuntRig.restore();
    if(mechanical)mechanical.update({distance:s.vx*dt,frontDistance:s.burnout&&P.driveAxle==='front'?dt*Math.min(18,4+P.power/1500):s.vx*dt,rearDistance:s.burnout&&P.driveAxle!=='front'?dt*Math.min(18,4+P.power/1500):s.vx*dt,driveDistance:s.burnout?(find(build.motor)?.kind==="mid"?dt*Math.min(18,4+P.power/1500):0):inp.throttle>0||find(build.motor)?.nopedal||s.reversing?s.vx*dt:0,rearCompression:crashRig?0:build.shock?s.comp[0]||0:0,frontCompression:crashRig?0:s.comp[1]||0,travelR:P.travelR,travelF:P.travelF});
    else wheels.forEach((ws, i) => ws.forEach(([w, y0]) => (w.position.y = y0 + (s.comp[i] || 0) * (i ? P.travelF : P.travelR) * 0.8)));
    supermanPose=s.stunt?.name==="superman"?Math.sin(Math.PI*Math.min(1,s.stunt.elapsed/s.stunt.duration)):0;if(!crashRig)riderModel.update({lean:inp.lean,superman:supermanPose});stuntRig.pose(s.stunt);
    // checkpoints / finish
    while (cpI + 1 < ter.checkpoints.length && s.x > ter.checkpoints[cpI + 1]) { cpI++; lastCP = ter.checkpoints[cpI] + 1; msg = "CHECKPOINT " + cpI; msgT = 1.2; }
    if (!finished && s.x > ter.finish) { finished = true; msg = `FINISH! SCORE ${Math.round(s.score).toLocaleString()} · +$${Math.round(s.score / 10).toLocaleString()}`; msgT = 99; maxScore = Math.max(maxScore, s.score); report(); }
    maxScore = Math.max(maxScore, s.score);
    // camera: side-on follow, zooms out with speed
    const crashFocus=crashRig?.focus(),sp=crashFocus?.speed??Math.hypot(s.vx,s.vy),dist=6.5+Math.min(6,Math.max(sp*.35,(crashFocus?.separation||0)*.7)),cx=crashFocus?.x??s.x+Math.min(3,s.vx*.15);
    const targetBlend=cameraView==='chase'?1:0;cameraBlend+=Math.max(-cameraDt/.4,Math.min(cameraDt/.4,targetBlend-cameraBlend));const blend=cameraBlend*cameraBlend*(3-2*cameraBlend),angle=blend*Math.PI/2,radius=dist*(1-blend)+(3.0+Math.min(2,sp*.12))*blend;
    const riderY=crashFocus?.y??s.y,cameraTarget=new T.Vector3(cx-Math.sin(angle)*radius,riderY+(.45+dist*.025)*(1-blend)+1.10*blend,Math.cos(angle)*radius+.4*blend);
    if(!cameraReady||blend>0||cam.position.distanceTo(cameraTarget)>50)cam.position.copy(cameraTarget);else cam.position.lerp(cameraTarget,.12);
    cameraReady=true;cam.lookAt(cx+blend*3.2,riderY+(.45+dist*.025-.65)*(1-blend)-.65*blend,0);cam.fov=40+blend*5;cam.updateProjectionMatrix();
    environment.update(s.x);environment.view(blend);ui.querySelector('.ride-view-label').textContent=cameraView==='chase'?'▣ CHASE · DEPTH PREVIEW':'▣ SIDE VIEW (2.5D)';

    sun.position.set(s.x + 4, s.y + 10, 6); sun.target.position.set(s.x, s.y, 0);
    sky.position.x = cam.position.x; sunDisc.position.x = cam.position.x + 40;
    // HUD
    hud.score.textContent = Math.round(s.score).toLocaleString(); hud.best.textContent = "$ +" + Math.round(maxScore / 10).toLocaleString() + " · DIRT " + Math.round(Math.min(1, dirt) * 100) + "%";
    hud.speed.innerHTML = Math.round(sp * 3.6) + "<small style='font-size:14px'> km/h</small>"; hud.wheelie.textContent = s.balance ? `${s.balance} ${(s.balance.includes("WHEEL") || s.balance === "MANUAL" ? s.wheelieT : s.stoppieT).toFixed(1)}s` : s.bestWheelie ? `BEST MONO ${s.bestWheelie.toFixed(1)}s` : "";
    hud.batt.textContent = P.powertrain==='petrol'?'FUEL '+Math.round(s.battery*100)+'% · '+(stats.cc??find(build.motor)?.cc??'')+'cc':P.pedal ? "PEDAL POWER" : "BATTERY " + Math.round(s.battery * 100) + "%"; hud.prog.firstChild.style.width = Math.max(0, Math.min(100, s.x / ter.finish * 100)) + "%";
    if (s.trickT <= 0) hud.trick.style.opacity = Math.max(0, +hud.trick.style.opacity - dt * 2); msgT -= dt; hud.msg.textContent = paused?"PAUSED":msgT > 0 ? msg : "";
    const w = W(), h = H(),screenScale=el.getBoundingClientRect().width/w;ui.style.transformOrigin="top left";ui.style.transform=`scale(${1/screenScale})`;ui.style.width=(w*screenScale)+"px";ui.style.height=(h*screenScale)+"px";ui.style.right=ui.style.bottom="auto";const pixelRatio=Math.min(lowDetail?1:1.5,devicePixelRatio*screenScale);if(R.getPixelRatio()!==pixelRatio)R.setPixelRatio(pixelRatio);if (R.domElement.width !== Math.floor(w * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    backdrop.repeat.set(Math.min(1,w/h*.3),.6);backdrop.offset.set(Math.max(0,Math.min(1-backdrop.repeat.x,(1-backdrop.repeat.x)/2+Math.sin(s.x*.001)*.08)),.4);
    if(flat){const tile=Math.floor(s.x/100)*100;ground.position.x=tile;dirtTop.position.x=tile;layers.foreground.position.x=tile;layers.update(tile);flatMarkers.position.x=tile;sky.position.x=s.x;sunDisc.position.x=s.x+40;hud.prog.style.display='none';hud.best.textContent='FLAT ENDLESS · '+Math.floor(s.odo)+' m';}
    R.render(scene, cam); };
  let cameraView='side',cameraBlend=0,cameraReady=false;globalThis.__WK_SCENE_VIEW__=view=>{cameraView=view==='chase'?'chase':'side';return cameraView};
  raf = requestAnimationFrame(frame);
  globalThis.__WK_RIDE_SCENE__=()=>({scene,cam});
  globalThis.__WK_RIDE_STATE__ = () => ({ s, P, dirt, wear, flips, finished, inp, ter, cameraX:cam.position.x,groundX:ground.position.x,render:{calls:R.info.render.calls,triangles:R.info.render.triangles,geometries:R.info.memory.geometries,textures:R.info.memory.textures},environment:environment.state(),cameraView,cameraBlend,crash:crashRig?.state()||null,rider:riderModel.state(),backdropLoaded,sceneryLayers:['background','road','foreground'],paused,stunt:s.stunt?{...s.stunt}:null,supermanPose,stuntVisual:stuntRig.state(),controls:leanControls.state(),mechanical:mechanical?.state });
  function stop(save=true) {if(disposed)return;disposed=true;if(save)report();releaseControls();cancelAnimationFrame(raf); removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("deviceorientation", ori);removeEventListener('blur',releaseControls);document.removeEventListener('visibilitychange',visibility);for(const type of blockedGestures)el.removeEventListener(type,blockBrowserGesture);el.removeAttribute('data-wk-ride-surface');el.removeAttribute('data-wk-paused');el.removeAttribute('data-wk-crashed');crashRig?.restore();crashRig=null; delete globalThis.__WK_SCENE_VIEW__;delete globalThis.__WK_RIDE_SCENE__;environment.dispose();backdrop.dispose();smoke.geometry.dispose();smoke.material.dispose();R.dispose();R.forceContextLoss();el.innerHTML="";}
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
