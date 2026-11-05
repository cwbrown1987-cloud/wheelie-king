// Wheelie King shop 3D previews (v15): ONE shared WebGL renderer draws every part thumbnail (cached data URLs)
// and the big drag-to-rotate preview in the part sheet. Same realistic models as on the bike (partmodels.js).
import * as T from "./vendor/three.module.js";
import * as PM from "./partmodels.js";
import {TRAX_ID,traxPreview,traxGeometry,traxAnchors} from './trax-bike.js';
import {rearFrameModel,traxShockModel} from './trax-suspension.js';
import {part,baseId,canonicalBuild} from './modular-catalogue.js';
import {componentModel,previewBuild,paintBuild} from './modular-render.js';
import {makeRider} from './rider-model.js';
PM.useThree(T);
const find = (id) => globalThis.__WK_CAT__?.().items.find((i) => i.id === id);
const MODEL_SLOTS = new Set(["motor", "battery", "chain", "sprocket_f", "sprocket_r", "suspension", "shock", "bars", "rear_frame", "frame", "stem", "seatpost", "pedals", "headset", "hubs", "body_panels", "number_plate", "grips", "seat", "rims", "tyres"]);
const accessorySlots=['controller','throttle','cranks','brakes','fender_f','fender_r','wing','bash','lights'];accessorySlots.forEach(s=>MODEL_SLOTS.add(s));
function accessoryModel(p){
 if(!accessorySlots.includes(p.slot))return null;if(p.slot==='cranks'){const g=PM.crankset([0,0],p.color||'#30363d');const pedals=[];g.traverse(o=>{if(o.userData.wkPedal)pedals.push(o)});pedals.forEach(o=>o.removeFromParent());return g;}
 const g=new T.Group();g.name='preview:'+p.slot;const mat=new T.MeshStandardMaterial({color:p.color||'#77848b',metalness:.65,roughness:.4}),dark=new T.MeshStandardMaterial({color:'#17212a',roughness:.8});
 const box=(name,w,h,d,x=0,y=0,z=0,m=mat)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);g.add(o);return o};
 const cyl=(name,r,h,x,y,z,m=mat)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,20),m);o.name=name;o.position.set(x,y,z);o.rotation.z=Math.PI/2;g.add(o);return o};
 if(p.slot==='controller'){box('controller:case',.2,.07,.13);for(let i=0;i<8;i++)box('controller:fins',.007,.025,.13,-.09+i*.025,.045);for(let i=0;i<4;i++)cyl('controller:connector',.006,.025,.11,-.02,i*.025-.035,dark);}
 else if(p.slot==='throttle'){cyl('throttle:grip',.023,.12,0,0,0,dark);cyl('throttle:collar',.03,.018,-.06,0,0);if(!p.id.includes('twist')){const o=box('throttle:thumb-paddle',.055,.018,.035,-.075,-.025,.027,dark);o.rotation.z=-.4;}}
 else if(p.slot==='brakes'){const shape=new T.Shape();shape.absarc(0,0,.085,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,.065,0,Math.PI*2,true);shape.holes.push(hole);for(let i=0;i<12;i++){const a=i/12*Math.PI*2,h=new T.Path();h.absarc(Math.cos(a)*.075,Math.sin(a)*.075,.003,0,Math.PI*2,true);shape.holes.push(h)}g.add(new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.002,bevelEnabled:false}),mat));for(let i=0;i<6;i++){const o=box('brake:spider',.06,.008,.003,Math.cos(i*Math.PI/3)*.04,Math.sin(i*Math.PI/3)*.04);o.rotation.z=i*Math.PI/3}box('brake:caliper',.055,.035,.035,.065,.045,.014,dark);box('brake:lever',.09,.009,.014,-.025,.12,0,dark);}
 else if(p.slot.startsWith('fender')){const shape=new T.Shape();shape.absarc(0,0,.24,.15,Math.PI-.15,false);shape.absarc(0,0,.227,Math.PI-.15,.15,true);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:false});geo.translate(0,0,-.035);g.add(new T.Mesh(geo,mat));}
 else if(p.slot==='lights'){cyl('light:housing',.036,.06,0,0,0,dark);cyl('light:lens',.029,.003,.032,0,0,new T.MeshStandardMaterial({color:'#e7f4ff',emissive:'#b8dbff',emissiveIntensity:.6}));box('light:mount',.025,.05,.02,-.012,-.035);}
 else{box(p.slot+':plate',.25,.012,p.slot==='wing'?.09:.15);for(const x of [-.09,.09])box(p.slot+':mount',.015,.04,.02,x,-.025);}
 return g;
}
const makeModel = (p) => {
  if (!p) return null;
  if(p.id==='ui_helmet'){const body=new T.Group(),bike=new T.Group();makeRider(T,body,bike,{seatTop:[0,0],headTop:[.3,.3],bb:[0,0]},{});const head=body.getObjectByName('rider:head');head.removeFromParent();return head;}
  if(p.id==='ui_sticker'){const g=new T.Group(),card=new T.Mesh(new T.BoxGeometry(.2,.15,.006),new T.MeshStandardMaterial({color:'#edf6ff',roughness:.4}));g.add(card);const shape=new T.Shape();shape.moveTo(.015,.06);shape.lineTo(-.045,-.006);shape.lineTo(-.005,-.006);shape.lineTo(-.015,-.06);shape.lineTo(.045,.006);shape.lineTo(.005,.006);shape.closePath();const bolt=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:false}),new T.MeshStandardMaterial({color:'#69ed57'}));bolt.position.z=.004;g.add(bolt);return g;}

  if(accessorySlots.includes(p.slot))return accessoryModel(p);
  if(p.slot==='frame'){const root=previewBuild(T,p.id),fr=root.getObjectByName('wk:frame');fr.removeFromParent();return fr;}
  if(p.slot==='rear_frame'||p.slot==='body_panels'){const root=previewBuild(T,p.family||'trax_lime'),g=root.getObjectByName('wk:part:'+p.slot);g?.removeFromParent();return g;}
  if(['stem','seatpost','pedals','headset','hubs','number_plate','grips','seat','rims','tyres'].includes(p.slot))return componentModel(T,p);
  if(p.id==='trax_coil')return traxShockModel(T,[.1,.06],[-.1,-.03],p.color);
  if (p.slot === "kit") { const f=(p.kit||[]).map(find).find(q=>q?.slot==='frame');if(f)return previewBuild(T,f.id,Object.fromEntries(p.kit.map(id=>[part(id).slot,id])));const bundle=new T.Group();bundle.name='wk:conversion-kit';
    for(const [index,slot]of ['motor','battery','controller','throttle'].entries()){
      const item=(p.kit||[]).map(find).find(q=>q?.slot===slot);if(!item)continue;
      let model;if(slot==='controller'){model=new T.Group();const mat=new T.MeshStandardMaterial({color:'#77848b',metalness:.8,roughness:.4});model.add(new T.Mesh(new T.BoxGeometry(.2,.08,.13),mat));for(let i=0;i<7;i++){const fin=new T.Mesh(new T.BoxGeometry(.008,.025,.13),mat);fin.position.set(-.085+i*.028,.05,0);model.add(fin)}}else if(slot==='throttle'){model=new T.Group();const grip=new T.Mesh(new T.CylinderGeometry(.024,.024,.13,12),new T.MeshStandardMaterial({color:'#222b2d'}));grip.rotation.z=Math.PI/2;model.add(grip);const lever=new T.Mesh(new T.BoxGeometry(.06,.025,.02),new T.MeshStandardMaterial({color:'#e3a34b'}));lever.position.set(-.05,-.025,.03);model.add(lever)}else model=modelFor(item);
      if(!model)continue;const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),scale=.31/Math.max(size.x,size.y,size.z);model.position.sub(center);const holder=new T.Group();holder.name='kit:'+slot;holder.userData.partId=item.id;holder.add(model);holder.scale.setScalar(scale);holder.position.set((index%2-.5)*.4,index<2?.21:-.21,0);bundle.add(holder);
    }return bundle; }
  if (!MODEL_SLOTS.has(p.slot)) return null;
  if (p.slot === "motor") return p.kind === "mid" ? (p.nopedal || (!p.real && (p.w || 0) >= 2500) || p.id === "x1" ? PM.motoMid(p) : PM.midDrive(p)) : PM.hubMotor(p);
  if (p.slot === "battery") return PM.battery(p);
  if (p.slot === "sprocket_f" || p.slot === "sprocket_r") return PM.sprocket(p.teeth, p.std, p.color || (p.std === "bicycle" ? "#2a2a2a" : "#3a3a3a"), "sprocket");
  if (p.slot === "chain") { const G = new T.Group(); const rf = PM.sprocketR(18), rr = PM.sprocketR(12), cx = 0.09, pts = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + (i / 12) * Math.PI; pts.push([-cx + Math.cos(a) * rr, Math.sin(a) * rr]); }
    for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (i / 12) * Math.PI; pts.push([cx + Math.cos(a) * rf, Math.sin(a) * rf]); }
    G.add(PM.chainAlong(pts, p.std || "bicycle", p.color || "#4a4a4a")); G.name = "chainLoop"; return G; }
  if (p.slot === "suspension") return PM.fork(p, [0, 0.5], [0, 0.35], [0.12, -0.18], [0, 0.48], {color:p.color});
  if (p.slot === "shock") return PM.shock(p, [0, 0.12], [0, -0.12]);
  if (p.slot === "bars") return PM.bars(globalThis.__WK_BARSPEC__?.(p, find(globalThis.__WK_BUILD__?.grips)) || {}, [0, 0]);
  return null;
};
export const modelFor=p=>{if(!p)return null;const selected=p,p0=part(baseId(p.id))||p;const obj=makeModel({...p0,color:p.color||p0.color});if(obj&&selected.color){const root=new T.Group(),holder=new T.Group();holder.name='wk:'+p.slot;root.add(holder);holder.add(obj);paintBuild(root,{[p.slot]:selected.id},T);obj.removeFromParent();}return obj;};
let R = null, scene, cam, holder;
function ensure() {
  if (R) return R;
  R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.6;
  scene = new T.Scene(); cam = new T.PerspectiveCamera(30, 4 / 3, 0.01, 50);
  scene.add(new T.HemisphereLight("#e8f4ff", "#505048", 3)); const f2 = new T.DirectionalLight("#cfe0ff", 1.5); f2.position.set(-1, 0.5, 4); scene.add(f2); const k = new T.DirectionalLight("#ffffff", 3.5); k.position.set(2, 3, 4); scene.add(k);
  const rim = new T.DirectionalLight("#39ff7a", 0.8); rim.position.set(-3, 1, -2); scene.add(rim);
  holder = new T.Group(); scene.add(holder); return R;
}
function frame(obj) { const box = new T.Box3().setFromObject(obj), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3()); obj.position.sub(c);
  const r = Math.max(sz.x, sz.y, sz.z) * 0.5 || 0.2; cam.position.set(r * 1.5, r * 0.9, r * 2.6); cam.near = r / 50; cam.far = r * 30; cam.updateProjectionMatrix(); cam.lookAt(0, 0, 0); }
function dispose(o) { o.traverse((m) => { m.geometry?.dispose(); m.material && [].concat(m.material).forEach((x) => x.dispose()); }); }
const cache = new Map();
export function thumb(p, size = 96) {
  const key = p.id + "@" + (size > 120 ? 2 : 1); if (cache.has(key)) return cache.get(key);
  let url = null; try { const obj = modelFor(p); if (!obj) { cache.set(key, null); return null; }
    ensure(); const w = size > 120 ? 240 : 128, h = Math.round(w * 0.75), prev = R.getSize(new T.Vector2()); R.setSize(w, h, false); cam.aspect = w / h;
    holder.clear(); const pivot = new T.Group(); pivot.add(obj); holder.add(pivot); frame(obj); pivot.rotation.set(0.15, -0.35, 0); R.render(scene, cam); url = R.domElement.toDataURL("image/png");
    holder.clear(); dispose(obj); if (live) { R.setSize(prev.x, prev.y, false); cam.aspect = prev.x / prev.y; }
  } catch (e) { console.warn("thumb", p.id, e); url = null; }
  cache.set(key, url); return url;
}
let live = null;
export function mount(el, p) { // big rotatable preview; returns cleanup
  if (!el) return () => {}; ensure(); live?.stop(); const obj = modelFor(p); if (!obj) return () => {};
  const pivot = new T.Group(); pivot.add(obj); holder.clear(); holder.add(pivot); frame(obj); pivot.rotation.set(0.15, -0.35, 0);
  const cv = R.domElement; cv.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab"; cv.dataset.wkPreview = p.id; el.appendChild(cv);
  let raf = 0, drag = null, idle = 0, zoom = 1; const base = cam.position.clone();
  const size = () => { const w = el.clientWidth || 300, h = el.clientHeight || 220; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const pts = new Map();
  const down = (e) => { cv.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = [e.clientX, e.clientY, pivot.rotation.y, pivot.rotation.x]; idle = 0; e.preventDefault(); };
  const move = (e) => { if (!pts.has(e.pointerId)) return; const old = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d1 = Math.hypot(a[0] - b[0], a[1] - b[1]), o2 = [...pts.entries()].find(([k]) => k !== e.pointerId)[1], d0 = Math.hypot(old[0] - o2[0], old[1] - o2[1]); zoom = Math.max(0.5, Math.min(2.2, zoom * (d0 / (d1 || 1)))); return; }
    if (!drag) return; pivot.rotation.y = drag[2] + (e.clientX - drag[0]) * 0.012; pivot.rotation.x = Math.max(-1.2, Math.min(1.2, drag[3] + (e.clientY - drag[1]) * 0.008)); e.preventDefault(); };
  const up = (e) => { pts.delete(e.pointerId); if (!pts.size) drag = null; };
  const wheel = (e) => { zoom = Math.max(0.5, Math.min(2.2, zoom * (e.deltaY > 0 ? 1.1 : 0.9))); e.preventDefault(); };
  cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("wheel", wheel, { passive: false });
  const loop = () => { raf = requestAnimationFrame(loop); size(); if (!drag && ++idle > 90) pivot.rotation.y += 0.006; cam.position.copy(base).multiplyScalar(zoom); cam.lookAt(0, 0, 0); R.render(scene, cam); };
  loop();
  const stop = () => { cancelAnimationFrame(raf); cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up); cv.removeEventListener("wheel", wheel);
    cv.remove(); holder.clear(); dispose(obj); live = null; };
  live = { stop, obj }; return stop;
}
globalThis.__WK_THUMB__ = (p, size) => (modelFor ? thumb(p, size) : null);
globalThis.__WK_PREVIEW__ = { has: (p) => !!p && (p.completeBike || p.id === TRAX_ID || MODEL_SLOTS.has(p.slot) || (p.slot === "kit" && (p.kit || []).some((id) => ["motor", "battery"].includes(find(id)?.slot)))), mount, modelFor };
