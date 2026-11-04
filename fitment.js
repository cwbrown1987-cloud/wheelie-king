// Wheelie King fitment-standards model (v14). Frames declare standards; parts declare needs.
// fit(build, partId) -> { status: "ok" | "adapter" | "no", adapters: [adapterIds], reason }
export const FRAME_STD = {
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
  mtb_rigid: { R: 0.355, x: (R) => ({ rear: [-0.43, R], bb: [0, 0.31], seat: [-0.15, 0.86], htT: [0.58, 0.84], htB: [0.62, 0.66], front: [0.74, R], tr: 0.017 }) },
  mtb_ht:    { R: 0.375, x: (R) => ({ rear: [-0.44, R], bb: [0, 0.32], seat: [-0.15, 0.88], htT: [0.6, 0.87], htB: [0.64, 0.68], front: [0.77, R], tr: 0.021 }) },
  mtb_fs:    { R: 0.355, x: (R) => ({ rear: [-0.44, R], bb: [0, 0.33], seat: [-0.16, 0.86], htT: [0.6, 0.85], htB: [0.64, 0.67], front: [0.77, R], tr: 0.022 }) },
  fat:       { R: 0.37,  x: (R) => ({ rear: [-0.45, R], bb: [0, 0.32], seat: [-0.15, 0.86], htT: [0.6, 0.85], htB: [0.64, 0.68], front: [0.77, R], tr: 0.022 }) },
};
const TYRE_R = { "27.5": 0.355, "29": 0.375, "26f": 0.37 };
globalThis.__WK_FRAMEGEO__ = (frameId, R) => GEO[frameId]?.x(R);
globalThis.__WK_WHEELR__ = (frameId, tyre) => (GEO[frameId] ? (TYRE_R[tyre?.size] || GEO[frameId].R) : undefined);
const cat = () => globalThis.__WK_CAT__?.().items || [];
const P = (id) => cat().find((i) => i.id === id);
const DUAL = new Set(["dnm", "fox40", "corro"]), TAPERED_FORK = new Set(["pike", "dnm", "fox40", "corro"]);
export function fit(build, id) {
  const p = P(id); if (!p) return { status: "ok", adapters: [] };
  const fid = p.slot === "frame" ? id : build.frame || "bmx", f = FRAME_STD[fid] || FRAME_STD.bmx, fr = P(fid);
  const no = (reason) => ({ status: "no", adapters: [], reason }), ad = [];
  const need = (a) => ad.push(a);
  if (p.slot === "kit") { const kb = { ...build, frame: fid }; for (const c of p.kit) kb[P(c)?.slot] = c; for (const c of p.kit) { const r = fit(kb, c); if (r.status === "no") return no(`${P(c)?.name}: ${r.reason}`); r.adapters.forEach((a) => !p.kit.includes(a) && need(a)); } }
  else if (p.slot === "motor") {
    if (p.kind === "rear") {
      if (f.drop === "moto" && p.w < 3000) return no("bicycle hub axle won't fit the moto swingarm");
      if (f.drop !== "moto" && p.w >= 5000) return no("moto hub needs a moto swingarm frame");
      if (f.drop === "197" && !p.fat) return no("fat bike needs a 190/197mm fat hub");
      if (f.drop !== "197" && p.fat) return no("fat hub only fits 190/197mm fat dropouts");
      if (f.drop !== "moto" && (f.alloy || p.w >= 1000)) need("adp_torque");
    } else if (p.kind === "front") {
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
    if (f.head === "triple") { if (!DUAL.has(id)) return no("moto frame needs a dual-crown/USD fork"); }
    else if (DUAL.has(id) && f.head === "straight") return no("dual-crown fork needs a tapered head tube");
    else if (TAPERED_FORK.has(id) && f.head === "straight") return no("tapered steerer won't go in a 1-1/8 straight head tube");
    else if (!TAPERED_FORK.has(id) && id !== "rigid" && f.head === "tapered") need("adp_crown");
  } else if (p.slot === "brakes") {
    const disc = id !== "rim";
    if (!disc && !f.brake.includes("rim")) return no("frame has no rim-brake bosses");
    if (disc && f.brake.length === 1 && f.brake[0] === "rim") need("adp_disc");
    else if (disc && f.brake.includes("is") && !f.brake.includes("post")) need("adp_brake");
  } else if (p.slot === "shock") {
    if (!f.shock) return no("frame has no rear shock mount (rigid/hardtail)");
    if (f.shock === "moto" && id !== "shk_moto230") return no("moto swingarm needs the moto shock");
    if (f.shock !== "moto" && id === "shk_moto230") return no("moto shock is too long for an MTB linkage");
  } else if (p.slot === "battery") {
    const m = p.mount || ({ tri72: "bag", redc: "integrated", nullarbor: "bag", moto60: "integrated", moto72: "integrated" })[id] || (p.kg >= 10 ? "integrated" : p.v >= 60 ? "integrated" : p.kg >= 5 ? "bag" : "bottle");
    if (m === "integrated" && !f.batt.includes("integrated") && !f.batt.includes("bag")) return no("pack too big: needs a moto frame or a frame-triangle bag mount");
    if (m !== "integrated" && !f.batt.includes(m) && !f.batt.includes("integrated")) need("adp_battmount");
  } else if (p.slot === "tyres") {
    const s = p.size || "20";
    if (f.wheel === "moto") { if (!["moto", "20", "26"].includes(s)) return no(`${s}" tyre doesn't fit moto rims`); }
    else if (s !== f.wheel && !(f.wheel === "20" && s === "26" && fid === "rbmx")) return no(`${s === "26f" ? "26x4 fat" : s + '"'} tyre on a ${f.wheel === "26f" ? "26x4 fat" : f.wheel + '"'} frame`);
  } else if (p.slot === "seat") {
    if (id === "seat_moto" && f.bb !== "moto") return no("bench seat bolts to a moto subframe");
    if (id !== "seat_moto" && f.bb === "moto") return no("moto frame takes a bench seat");
    if (f.seat > 27.2) need("adp_shim");
  } else if (p.slot === "cranks") {
    if (f.bb === "moto" && !p.pegs) return no("moto frame has no pedal bottom bracket");
    if (id === "crank_mid" && !["mid"].includes(P(build.motor)?.kind)) return no("mid-drive cranks bolt to a mid-drive motor");
  } else if (p.slot === "frame") {
    // switching frames: the frame itself always fits; the other parts get re-checked as warnings
  }
  return ad.length ? { status: "adapter", adapters: [...new Set(ad)], reason: "needs " + [...new Set(ad)].map((a) => P(a)?.name || a).join(" + ") } : { status: "ok", adapters: [] };
}
globalThis.__WK_FIT__ = fit;
// warnings for the whole build (fed into Kr())
globalThis.__WK_FIT_WARN__ = (build) => { const out = [];
  for (const [slot, id] of Object.entries(build)) { if (!id || slot === "frame" || slot.startsWith("adp_") || slot === "kit") continue; const r = fit(build, id), n = P(id)?.name || id;
    if (r.status === "no") out.push({ t: `${n} doesn't fit: ${r.reason}`, bad: true });
    else if (r.status === "adapter") { const miss = r.adapters.filter((a) => build[P(a)?.slot] !== a); miss.length && out.push({ t: `${n} needs ${miss.map((a) => P(a)?.name || a).join(" + ")}`, bad: true }); } }
  return out; };
// one-tap adapter prompt
const bar = document.createElement("div");
bar.style.cssText = "position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 78px);transform:translateX(-50%);z-index:10003;background:#1d1408f2;border:2px solid #ffc23d;color:#fff;font:600 14px system-ui;padding:8px 10px;border-radius:12px;display:none;gap:8px;align-items:center;max-width:92vw";
document.addEventListener("DOMContentLoaded", () => document.body.append(bar)); if (document.body) document.body.append(bar);
globalThis.__WK_FIT_PROMPT__ = (r, build) => { const miss = r.adapters.filter((a) => build?.[P(a)?.slot] !== a); if (!miss.length) return;
  bar.innerHTML = ""; const t = document.createElement("span"); t.textContent = "⚠ Needs " + miss.map((a) => P(a)?.name).join(" + "); bar.append(t);
  const add = document.createElement("button"); add.textContent = "+ ADD ADAPTER" + (miss.length > 1 ? "S" : ""); add.dataset.wk = "add-adapter";
  add.style.cssText = "background:#39ff7a;border:0;border-radius:8px;padding:6px 10px;font:700 13px system-ui;color:#062a06";
  add.onclick = () => { globalThis.__WK_EQUIP_MANY__?.(miss); bar.style.display = "none"; };
  const x = document.createElement("button"); x.textContent = "✕"; x.style.cssText = "background:none;border:0;color:#aaa;font-size:16px"; x.onclick = () => (bar.style.display = "none");
  bar.append(add, x); bar.style.display = "flex"; clearTimeout(bar._t); bar._t = setTimeout(() => (bar.style.display = "none"), 9000); };
