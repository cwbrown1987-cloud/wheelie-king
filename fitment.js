// Wheelie King fitment-standards model (v14). Frames declare standards; parts declare needs.
// fit(build, partId) -> { status: "ok" | "adapter" | "no", adapters: [adapterIds], reason }
import {TRAX_RADIUS,traxGeometry} from './trax-bike.js';
import {baseId,canonicalBuild} from './modular-catalogue.js';
import {VEHICLES,prototypeFor,vehicleFit,vehicleReady} from './vehicle-platforms.js';
export const FRAME_STD = {
  trax_lime: {bb:'68',drop:'135qr',head:'straight',seat:25.4,brake:['rim'],shock:'trax-short',batt:[],wheel:'20',alloy:false},
  bmx:       { bb: "bmx", drop: "110", head: "straight", seat: 25.4, brake: ["rim"], shock: null, batt: [], wheel: "20", alloy: false },
  rbmx:      { bb: "bmx", drop: "110", head: "straight", seat: 25.4, brake: ["rim", "is"], shock: null, batt: ["bottle"], wheel: "20", alloy: false },
  mtb_rigid: { bb: "68", drop: "135qr", head: "straight", seat: 27.2, brake: ["rim", "is"], shock: null, batt: ["bottle", "bag", "rack"], wheel: "27.5", alloy: false },
  mtb_ht:    { bb: "73", drop: "148ta", head: "tapered", seat: 31.6, brake: ["post"], shock: null, batt: ["bottle", "bag"], wheel: "29", alloy: true },
  mtb_fs:    { bb: "73", drop: "148ta", head: "tapered", seat: 31.6, brake: ["post"], shock: "metric", batt: ["bottle"], wheel: "27.5", alloy: true },
  fat:       { bb: "100", drop: "197", head: "tapered", seat: 30.9, brake: ["post"], shock: null, batt: ["bottle", "bag", "rack"], wheel: "26f", alloy: true },
  moto:      { bb: "moto", drop: "moto", head: "triple", seat: 0, brake: ["moto", "post"], shock: "moto", batt: ["integrated"], wheel: "moto", alloy: true },
  emoto:     { bb: "moto", drop: "moto", head: "triple", seat: 0, brake: ["moto", "post"], shock: "moto", batt: ["integrated"], wheel: "moto", alloy: true },
};
// frame geometry (side-on, metres) + default wheel radius for the new push-bike frames
const GEO = {
  trax_lime: { R:TRAX_RADIUS, x:traxGeometry },
  mtb_rigid: { R: 0.355, x: (R) => ({ rear: [-0.43, R], bb: [0, 0.31], seat: [-0.15, 0.86], htT: [0.58, 0.84], htB: [0.62, 0.66], front: [0.74, R], tr: 0.017 }) },
  mtb_ht:    { R: 0.375, x: (R) => ({ rear: [-0.44, R], bb: [0, 0.32], seat: [-0.15, 0.88], htT: [0.6, 0.87], htB: [0.64, 0.68], front: [0.77, R], tr: 0.021 }) },
  mtb_fs:    { R: 0.355, x: (R) => ({ rear: [-0.44, R], bb: [0, 0.33], seat: [-0.16, 0.86], htT: [0.6, 0.85], htB: [0.64, 0.67], front: [0.77, R], tr: 0.022 }) },
  fat:       { R: 0.37,  x: (R) => ({ rear: [-0.45, R], bb: [0, 0.32], seat: [-0.15, 0.86], htT: [0.6, 0.85], htB: [0.64, 0.68], front: [0.77, R], tr: 0.022 }) },
};
for(const [id,v]of Object.entries(VEHICLES)){FRAME_STD[id]={bb:id,drop:id,head:id,seat:0,brake:[id],shock:id,batt:v.powertrain==='electric'?['deck']:[],wheel:id};GEO[id]={R:v.wheelR,x:v.geometry};}
const TYRE_R = { "24": .315, "27.5": 0.355, "29": 0.375, "26f": 0.37 };
globalThis.__WK_FRAMEGEO__ = (frameId,R,build={})=>{
 const f=baseId(frameId),moto=['moto','emoto'].includes(f),x=GEO[f]?.x(R)||(moto?{rear:[-.52,R],bb:[0,.36],seat:[-.14,.86],htT:[.6,.93],htB:[.66,.7],front:[.82,R],tr:.03}:{rear:[-.37,R],bb:[0,R+.035],seat:[-.1,.7],htT:[.5,.74],htB:[.545,.58],front:[.63,R],tr:f==='rbmx'?.022:.017});
 const travel=P(baseId(build.suspension))?.travel||0,dx=x.front[0]-x.htB[0]-.012,L=R+.048+travel*.8,needed=R+Math.sqrt(Math.max(.01,L*L-dx*dx))+.03,raise=Math.max(0,needed-x.htB[1]);
 x.htB[1]+=raise;x.htT[1]+=raise;return x;
};
globalThis.__WK_WHEELR__ = (frameId, tyre) => (GEO[baseId(frameId)] ? (TYRE_R[tyre?.size] || GEO[baseId(frameId)].R) : undefined);
const cat = () => globalThis.__WK_CAT__?.().items || [];
const P = (id) => cat().find((i) => i.id === id);
const DUAL = new Set(["dnm", "fox40", "corro"]), TAPERED_FORK = new Set(["pike", "dnm", "fox40", "corro"]);
export function fit(build, id) {
  build=canonicalBuild(build);id=baseId(id);
  const p = P(id);const platform=vehicleFit(build,p);if(platform)return platform; if (!p) return { status: "ok", adapters: [] };
  const fid = p.slot === "frame" ? id : build.frame || "bmx", f = FRAME_STD[fid] || FRAME_STD.bmx, fr = P(fid);
  const no = (reason) => ({ status: "no", adapters: [], reason }), ad = [];
  const need = (a) => ad.push(a);
  if(['battery','controller'].includes(p.slot)){const motor=P(build.motor);if(motor&&motor.powertrain!=='petrol'&&motor.v){if(p.v!==motor.v)return no('electrical voltage does not match the motor system');if(!p.a||p.v*p.a<motor.w)return no('electrical current capacity is below this motor requirement');}}

  if (p.slot === "kit") { const kb = p.completeBike ? {} : { ...build, frame: fid }; for (const c of p.kit) kb[P(c)?.slot] = c; for (const c of p.kit) { const r = fit(kb, c); if (r.status === "no") return no(`${P(c)?.name}: ${r.reason}`); r.adapters.forEach((a) => !p.kit.includes(a) && need(a)); } }
  else if (p.slot === "motor") {
    if (p.kind === "rear") {
      if(p.drop&&p.drop!==f.drop)return no('hub motor axle/dropout standard does not match this frame');
      if (f.drop === "moto" && p.w < 3000) return no("bicycle hub axle won't fit the moto swingarm");
      if (f.drop !== "moto" && p.w >= 5000) return no("moto hub needs a moto swingarm frame");
      if (f.drop === "197" && !p.fat) return no("fat bike needs a 190/197mm fat hub");
      if (f.drop !== "197" && p.fat) return no("fat hub only fits 190/197mm fat dropouts");
      if (f.drop !== "moto" && (f.alloy || p.w >= 1000)) need("adp_torque");
    } else if (p.kind === "front") {
      if(P(build.suspension)?.frontAxle&&P(build.suspension).frontAxle!=='100qr')return no('front hub motor needs the bicycle QR fork axle standard');
      if (f.head === "triple") return no("front hub kits don't fit a moto triple clamp");
      if (DUAL.has(build.suspension)) return no("dual-crown fork axle is too wide for a bicycle front hub");
      need("adp_torque");
    } else if (p.kind === "mid") {
      if (p.nopedal) { if (f.bb !== "moto") return no("moto mid-drive needs a moto frame with a mid-drive mount"); }
      else if (f.bb === "moto") return no("moto frame has no pedal bottom bracket");
      else if (f.bb === "100" && !p.bb100) return no("100mm fat BB needs the 100mm mid-drive version");
      else if (f.bb === "bmx") need("adp_bb");
    }
  } else if (p.slot === "suspension") {
    if(p.wheels&&!p.wheels.includes(f.wheel))return no('fork wheel/tyre clearance does not match this frame');
    if(p.steerer==='tapered'&&f.head==='straight')return no('tapered fork steerer needs a matching head tube');
    if (f.head === "triple") { if (!DUAL.has(id)) return no("moto frame needs a dual-crown/USD fork"); }
    else if (DUAL.has(id) && f.head === "straight") return no("dual-crown fork needs a tapered head tube");
    else if (TAPERED_FORK.has(id) && f.head === "straight") return no("tapered steerer won't go in a 1-1/8 straight head tube");
    else if (p.steerer!=='tapered' && !TAPERED_FORK.has(id) && id !== "rigid" && f.head === "tapered") need("adp_crown");
  } else if (p.slot === "brakes") {
    const disc = id !== "rim";
    if (!disc && !f.brake.includes("rim")) return no("frame has no rim-brake bosses");
    if (disc && f.brake.length === 1 && f.brake[0] === "rim") need("adp_disc");
    else if (disc && f.brake.includes("is") && !f.brake.includes("post")) need("adp_brake");
  } else if (p.slot === 'rear_frame'||p.slot==='body_panels'||p.slot==='number_plate') {
    if(p.family&&p.family!==fid||p.families&&!p.families.includes(fid))return no('mounting points do not match this main frame');
    if(p.slot==='rear_frame'&&!f.shock)return no('this welded rigid rear triangle is part of the main frame');
  } else if(p.slot==='stem') {
    const type=['moto','emoto'].includes(fid)?'moto':['bmx','rbmx','trax_lime'].includes(fid)?'quill':'threadless';
    if(p.interface!==type)return no('stem/steerer mounting interface does not match');
    const bars=P(build.bars);if(bars&&bars.clamp!==p.clamp)return no('bar clamp diameter does not match the fitted handlebar');
  } else if(p.slot==='bars') {
    const stem=P(build.stem);if(stem&&stem.clamp!==p.clamp)return no('handlebar clamp diameter does not match the fitted stem');
    if(f.bb==='moto'&&p.clamp!==28.6)return no('moto cockpit needs the moto bar clamp');
  } else if(p.slot==='headset') {
    if(p.interface!==f.head)return no('headset cups/bearings do not match the head tube');
  } else if(p.slot==='seatpost') {
    if(!f.seat)return no('bench-seat frame has no seatpost bore');
    if(p.diameter>f.seat+.01)return no('seatpost is larger than the seat-tube bore');
    if(p.diameter<f.seat-.01)need('adp_shim');
    const saddle=P(build.seat);if(saddle&&saddle.saddleMount!==p.saddleMount)return no('seatpost clamp does not match the saddle mount');
  } else if(p.slot==='hubs') {
    if(p.drop!==f.drop)return no('hub axle/dropout interface does not match');
  } else if(p.slot==='rims') {
    if(p.size!==f.wheel)return no('rim diameter/width does not match this frame wheel standard');
    const tyre=P(build.tyres);if(tyre&&(tyre.size||'20')!==p.size)return no('rim diameter/width does not match the fitted tyre');
  } else if(p.slot==='pedals') {
    const noPedals=P(build.motor)?.nopedal||P(build.cranks)?.pegs;
    if(p.pegs&&f.bb!=='moto')return no('frame has no moto footpeg mounting bosses');
    if(!p.pegs&&(f.bb==='moto'||noPedals))return no('this drivetrain has no pedal crank axle');
  } else if (p.slot === "shock") {
    if (!f.shock) return no("frame has no rear shock mount (rigid/hardtail)");
    if (f.shock === 'trax-short' && id !== 'trax_coil') return no('TRAX frame needs its short diagonal coil shock');
    if (id === 'trax_coil' && f.shock !== 'trax-short') return no('short TRAX coil mounts only to the TRAX linkage');
    if (f.shock === "moto" && id !== "shk_moto230") return no("moto swingarm needs the moto shock");
    if (f.shock !== "moto" && id === "shk_moto230") return no("moto shock is too long for an MTB linkage");
  } else if (p.slot === "battery") {
    const m = p.mount || ({ tri72: "bag", redc: "integrated", nullarbor: "bag", moto60: "integrated", moto72: "integrated" })[id] || (p.kg >= 10 ? "integrated" : p.v >= 60 ? "integrated" : p.kg >= 5 ? "bag" : "bottle");
    if (m === "integrated" && !f.batt.includes("integrated") && !f.batt.includes("bag")) return no("pack too big: needs a moto frame or a frame-triangle bag mount");
    if (m !== "integrated" && !f.batt.includes(m) && !f.batt.includes("integrated")) need("adp_battmount");
  } else if (p.slot === "tyres") {
    const s = p.size || "20";
    if (f.wheel === "moto") { if (!["moto", "20", "26"].includes(s)) return no(`${s}" tyre doesn't fit moto rims`); }
    else if (s !== f.wheel) return no(`${s === "26f" ? "26x4 fat" : s + '"'} tyre on a ${f.wheel === "26f" ? "26x4 fat" : f.wheel + '"'} frame`);
    const rim=P(build.rims);if(rim&&s!==rim.size)return no('tyre bead size/width does not match the fitted rim');
  } else if (p.slot === "seat") {
    if (id === "seat_moto" && f.bb !== "moto") return no("bench seat bolts to a moto subframe");
    if (id !== "seat_moto" && f.bb === "moto") return no("moto frame takes a bench seat");
    const post=P(build.seatpost);if(post&&post.saddleMount!==p.saddleMount)return no('saddle mount does not match the fitted seatpost');
  } else if (p.slot === "cranks") {
    if(p.pegs&&f.bb!=='moto')return no('frame has no moto footpeg bosses');
    if (f.bb === "moto" && !p.pegs) return no("moto frame has no pedal bottom bracket");
    if (id === "crank_mid" && !["mid"].includes(P(build.motor)?.kind)) return no("mid-drive cranks bolt to a mid-drive motor");
  } else if(['fender_f','wing','fender_r','bash'].includes(p.slot)) {
    if((p.id.includes('mx')||p.id.includes('neon')||p.slot==='wing'||p.id==='bash_skid')&&!['moto','emoto'].includes(fid))return no('moto bodywork mounting points do not match this bicycle frame');
  } else if (p.slot === "frame") {
    // switching frames: the frame itself always fits; the other parts get re-checked as warnings
  }
  return ad.length ? { status: "adapter", adapters: [...new Set(ad)], reason: "needs " + [...new Set(ad)].map((a) => P(a)?.name || a).join(" + ") } : { status: "ok", adapters: [] };
}
globalThis.__WK_FIT__ = fit;
globalThis.__WK_BUILD_READY__=build=>{
 const platform=vehicleReady(build,P);if(platform)return platform;
 const b=canonicalBuild(build),f=FRAME_STD[b.frame]||FRAME_STD.bmx,m=P(b.motor),needed=['frame','suspension','headset','stem','bars','grips','seat','tyres','rims','hubs','brakes'];
 if(f.seat)needed.push('seatpost');if(f.shock)needed.push('rear_frame','shock');
 if(!m||m.kind==='mid'&&!m.nopedal)needed.push('cranks','pedals','chain','sprocket_f','sprocket_r');
 if(m){needed.push('battery','controller','throttle');if(m.nopedal)needed.push('pedals','chain','sprocket_f','sprocket_r');}
 if(f.bb==='moto'&&!m)return {ready:false,reason:'Fit a moto motor and drivetrain first'};
 const missing=needed.filter(s=>!b[s]);if(missing.length)return {ready:false,reason:'Fit '+missing.map(s=>s.replaceAll('_',' ')).join(', ')};
 for(const [slot,id] of Object.entries(b)){if(!id)continue;const r=fit(b,id);if(r.status==='no')return {ready:false,reason:r.reason};if(r.status==='adapter'&&r.adapters.some(a=>b[P(a)?.slot]!==a))return {ready:false,reason:r.reason};}
 return {ready:true};
};
// warnings for the whole build (fed into Kr())
globalThis.__WK_FIT_WARN__ = (build) => { const out = [];
  for (const [slot, id] of Object.entries(build)) { if (!id || slot === "frame" || slot.startsWith("adp_") || slot === "kit") continue; const r = fit(build, id), n = P(id)?.name || id;
    if (r.status === "no") out.push({ t: `${n} doesn't fit: ${r.reason}`, bad: true });
    else if (r.status === "adapter") { const miss = r.adapters.filter((a) => build[P(a)?.slot] !== a); miss.length && out.push({ t: `${n} needs ${miss.map((a) => P(a)?.name || a).join(" + ")}`, bad: true }); } }
  return out; };
// one-tap adapter prompt
const bar = document.createElement("div");
bar.style.cssText = "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 78px);transform:translateX(-50%);z-index:2147483100;background:#1d1408f2;border:2px solid #ffc23d;color:#fff;font:600 14px system-ui;padding:8px 10px;border-radius:12px;display:none;gap:8px;align-items:center;max-width:92vw";
globalThis.__WK_FIT_CLEAR__=()=>{bar.style.display='none';clearTimeout(bar._t);};
document.addEventListener("DOMContentLoaded", () => document.body.append(bar)); if (document.body) document.body.append(bar);
globalThis.__WK_FIT_PROMPT__ = (r, build) => { const miss = r.adapters.filter((a) => build?.[P(a)?.slot] !== a); if (!miss.length) return;
  bar.innerHTML = ""; const t = document.createElement("span"); t.textContent = "⚠ Needs " + miss.map((a) => P(a)?.name).join(" + "); bar.append(t);
  const add = document.createElement("button"); add.textContent = "+ ADD ADAPTER" + (miss.length > 1 ? "S" : ""); add.dataset.wk = "add-adapter";
  add.style.cssText = "background:#39ff7a;border:0;border-radius:8px;padding:6px 10px;font:700 13px system-ui;color:#062a06";
  add.onclick = () => { globalThis.__WK_EQUIP_MANY__?.(miss); bar.style.display = "none"; };
  const x = document.createElement("button"); x.textContent = "✕"; x.style.cssText = "background:none;border:0;color:#aaa;font-size:16px"; x.onclick = () => (bar.style.display = "none");
  bar.append(add, x); bar.style.display = "flex"; clearTimeout(bar._t); bar._t = setTimeout(() => (bar.style.display = "none"), 9000); };
