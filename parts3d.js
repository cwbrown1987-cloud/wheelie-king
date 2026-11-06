// Wheelie King modular parts (v13): per-slot 3D swaps at named mount anchors.
// Called by app.js at the end of each bike rebuild (the bike root is rebuilt from scratch every time,
// so equipping a part always REPLACES the previous one: one group "wk:part:<slot>" per slot, never stacked).
import * as PM from "./partmodels.js";
import {canonicalBuild} from './modular-catalogue.js';
import {buildVehicle} from './vehicle-models.js';
import {modularAnchors,finishModular} from './modular-render.js';
import { buildFrame as smoothFrame } from "./frame-geometry.js";
export { buildFrame as smoothFrame } from "./frame-geometry.js";
import { detailPass, startLOD } from "./detail.js";
import { loadCond, applyCondition } from "./ride.js";
import { TRAX_ID, traxAnchors, finishTrax } from './trax-bike.js';
import {traxShockModel} from './trax-suspension.js';
import {chainRoute} from './bike-motion.js';
const find = (id) => globalThis.__WK_CAT__?.().items.find((i) => i.id === id);
export function anchors(x, R) { // named mount anchors per frame (x = frame geometry from app.js)
  const v = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { frontAxle: x.front, rearAxle: x.rear, bb: x.bb, headTop: x.htT, headBottom: x.htB, seatTop: x.seat, wheelR: R,
    stem: [x.htT[0] + 0.01, x.htT[1] + 0.06], shockFrame: v(x.seat, x.bb, 0.3), shockArm: [v(x.bb, x.rear, 0.5)[0], v(x.bb, x.rear, 0.5)[1] + 0.03],
    underBB: [x.bb[0], x.bb[1] - 0.07], headlight: [x.htT[0] + 0.07, x.htT[1] + 0.02], tail: [x.seat[0] - 0.12, x.seat[1] - 0.02] };
}
function recolor(group, test, color, T) { if (!group) return 0; let n = 0; group.traverse((o) => { if (o.isMesh && test(o)) { o.material = o.material.clone(); o.material.color = new T.Color(color); n++; } }); return n; }
globalThis.__WK_BUILD_HOOK__ = (root, { x, R, b }, T) => {
  const selectedBuild=b;b=canonicalBuild(b);
  if(buildVehicle(root,selectedBuild,T,find))return;
  if (!x) return; const A = modularAnchors({...anchors(x, R), ...(b.frame === TRAX_ID ? traxAnchors(x) : {})},b), g = (n) => root.children.find((c) => c.name === "wk:" + n);
  const mat = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2, ...o });
  const slotGroup = (slot) => { const old = root.children.find((c) => c.name === "wk:part:" + slot); old && root.remove(old); const G = new T.Group(); G.name = "wk:part:" + slot; G.userData.slot = slot; root.add(G); return G; };
  const cyl = (a, b2, r, m, G) => { const va = new T.Vector3(...a), vb = new T.Vector3(...b2), d = vb.clone().sub(va), M = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 24), m);
    M.position.copy(va).addScaledVector(d, 0.5); M.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); M.castShadow = true; G.add(M); return M; };
  const box = (w, h, d, m, G, px, py, pz = 0, rz = 0) => { const M = new T.Mesh(new T.BoxGeometry(w, h, d), m); M.position.set(px, py, pz); M.rotation.z = rz; M.castShadow = true; G.add(M); return M; };
  const part = (slot) => find(b[slot]);
  // --- added-geometry slots: exactly one group each ---
  const fender = (slot, axle, a0, a1, wide) => { const p = part(slot); if (!p) return; const G = slotGroup(slot), r = R + 0.035;
    const M = new T.Mesh(new T.TorusGeometry(r, 0.006, 6, 48, (a1 - a0) * Math.PI / 180), mat(p.color, { side: T.DoubleSide })); M.scale.z = wide; M.position.set(axle[0], axle[1], 0); M.rotation.z = a0 * Math.PI / 180; M.castShadow = true; G.add(M);
    G.userData.mount = slot === "fender_f" ? "frontAxle" : "rearAxle"; };
  fender("fender_f", A.frontAxle, 35, 150, 6);
  const fr = part("fender_r"); fender("fender_r", A.rearAxle, 55, fr?.id === "fr_short" ? 120 : 175, 6);
  const bash = part("bash"); if (bash) { const G = slotGroup("bash"); G.userData.mount = "underBB"; box(bash.id === "bash_skid" ? 0.26 : 0.16, 0.012, 0.1, mat(bash.color, { metalness: 0.7, roughness: 0.35 }), G, A.underBB[0], A.underBB[1], 0, bash.id === "bash_skid" ? 0.1 : 0); }
  const li = part("lights"); if (li) { const G = slotGroup("lights"); G.userData.mount = "headlight"; const glow = mat(li.color, { emissive: li.color, emissiveIntensity: 1.2 });
    if (li.id === "light_bar") box(0.03, 0.03, 0.22, glow, G, A.headlight[0], A.headlight[1] + 0.05);
    else { const h = new T.Mesh(new T.CylinderGeometry(li.lm > 1 ? 0.05 : 0.025, li.lm > 1 ? 0.05 : 0.025, 0.04, 24), glow); h.rotation.z = Math.PI / 2; h.position.set(A.headlight[0], A.headlight[1], 0); G.add(h); }
    if (li.lm > 1) box(0.03, 0.02, 0.05, mat("#ff2020", { emissive: "#ff2020", emissiveIntensity: 1 }), G, A.tail[0], A.tail[1]); }
  // --- in-place swaps of the existing meshes (the stock mesh is restyled, not duplicated) ---
  const st = part("seat"), sg = g("seat"); if (st && sg) sg.traverse((o) => { if (o.isMesh && o.geometry.type === "SphereGeometry") { o.scale.x *= st.sx || 1; o.material = o.material.clone(); o.material.color = new T.Color(st.color); } });
  const rim = part("rims"); if (rim) for (const n of ["tyres", "motor"]) recolor(g(n), (o) => o.geometry.type === "TorusGeometry" && Math.abs(o.geometry.parameters.tube-.009)<1e-5 || o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.openEnded, rim.color, T);
  realParts(root, A, b, T, g, slotGroup, part, x, R);
  try { smoothFrame(root, x, T, g, b); } catch (e) { console.warn("wk frame", e); }
  try { respoke(root, T); } catch (e) { console.warn("wk spokes", e); }
  try { detailPass(root, A, b, T, find, slotGroup, g); startLOD(); } catch (e) { console.warn("wk detail", e); }
  try { finishTrax(root,A,b,T,g,slotGroup); } catch(e) { console.warn('wk trax',e); }
  try { finishModular(root,A,b,selectedBuild,T,slotGroup,g); } catch(e) { console.warn('wk modular',e); }
  root.userData.wkAnchors = A;
  root.userData.wkBuild = {...b};
  try { const c = loadCond(); if (c.dirt > 0.01 || Object.keys(c.wear || {}).length) applyCondition(root, c); } catch (e) { console.warn("wk cond", e); }
};

// ---------- v15 realistic parts: the stock app meshes in each group are REMOVED and replaced by one named model ----------
const isDrivetrainMesh = (o) => (o.isInstancedMesh && o.count === 40) || o.geometry?.type === "TubeGeometry" || (o.isMesh && Math.abs(o.position.z - 0.055) < 0.004) || (o.isMesh && Math.abs(o.position.z - 0.057) < 0.002);
export const driveType = (m) => !m ? "none" : m.kind === "mid" ? (m.nopedal || (!m.real && (m.w || 0) >= 2500) || m.id === "x1" ? "mmid" : "pmid") : "hub";
const DEF = { none: [{ teeth: 25, std: "bicycle" }, { teeth: 9, std: "bicycle" }, "bicycle"], hub: [{ teeth: 25, std: "bicycle" }, { teeth: 9, std: "bicycle" }, "bicycle"],
  pmid: [{ teeth: 44, std: "bicycle" }, { teeth: 18, std: "bicycle" }, "bicycle"], mmid: [{ teeth: 14, std: "428" }, { teeth: 48, std: "428" }, "428"] };
export function gearing(b) { const dt = driveType(find(b.motor)), d = DEF[dt], f = find(b.sprocket_f) || d[0], r = find(b.sprocket_r) || d[1], ch = find(b.chain), cstd = ch?.std || d[2];
  const ratio = r.teeth / f.teeth, base = d[1].teeth / d[0].teeth, g = ratio / base, w = dt === "hub" ? 0 : 1, warn = [];
  for (const [nm, sp] of [["front", f], ["rear", r]]) if (sp.std !== cstd) warn.push({ t: `${cstd} chain won't run on the ${sp.std} ${nm} sprocket: swap chain or sprocket`, bad: true });
  if (dt === "mmid" && f.std === "bicycle") warn.push({ t: "Moto mid needs a 420/428 front sprocket", bad: true });
  if (Math.abs(g - 1) > 0.04) warn.push({ t: `Gearing ${f.teeth}T/${r.teeth}T = ${ratio.toFixed(2)}:1: ${g > 1 ? "more wheelie pull, lower top speed" : "higher top speed, less pull"}`, bad: false });
  return { front: f.teeth, rear: r.teeth, ratio, g, dt, chain: cstd, speedF: Math.pow(g, -0.6 * w), wheelF: Math.pow(g, 0.7 * w), kg: 0, warn }; }
globalThis.__WK_GEAR__ = gearing;
const BARSPEC = { bar_bmx: { rise: 0.17, sweep: 0.06, crossbar: true }, bar_riser: { rise: 0.05, sweep: 0.035, width: 0.39 }, bar_moto: { rise: 0.09, sweep: 0.05, crossbar: true, pad: true, width: 0.4 } };
globalThis.__WK_BARSPEC__ = (p, grip) => ({ rise: 0.17, sweep: 0.06, crossbar: true, ...(BARSPEC[p?.id] || {}), color: p?.color || "#333", gripColor: grip?.color || "#222" });
function realParts(root, A, b, T, g, slotGroup, part, x, R) {
  PM.useThree(T); const motor = part("motor"), dt = driveType(motor), moto = ["moto", "emoto"].includes(b.frame || "bmx");
  // motor: hub (shell/flanges/covers/axle/cable) or mid (motor can + gear housing + chainring)
  const mg = g("motor");
  if (mg && motor && dt === "hub") { const wheel = mg.children.find((c) => c.isGroup); if (wheel) { const pe = motor.kind === "rear" ? ((motor.w || 0) >= 8e3 ? 0.17 : (motor.w || 0) >= 5e3 ? 0.15 : (motor.w || 0) >= 3e3 ? 0.13 : 0.1) : 0.09;
      wheel.children.filter((o) => (o.geometry?.type === "CylinderGeometry" && (Math.abs(o.geometry.parameters.radiusTop - pe) < 0.002 || [0.006, 0.011].includes(o.geometry.parameters.radiusTop))) || (o.geometry?.type === "TorusGeometry" && Math.abs(o.geometry.parameters.radius - pe * 0.8) < 0.002) || (o.geometry?.type === "BoxGeometry" && Math.abs(o.geometry.parameters.width - 0.008) < 1e-4 && o.geometry.parameters.height === 0.012)).forEach((o) => wheel.remove(o));
      const h = PM.hubMotor({ ...motor, kind: motor.kind }, { r: pe, wd: 0.09 }); h.name = "wk:model:hub"; wheel.add(h); wheel.userData.hubHoles = { r: pe + 0.009, z: 0.09 / 2 - 0.004, phase: true }; } }
  if (mg && motor && dt !== "hub") { mg.clear(); const f = find(b.sprocket_f); const m = dt === "mmid" ? PM.motoMid(motor, { teeth: f?.std !== "bicycle" ? f?.teeth : undefined }) : PM.midDrive(motor, { teeth: f?.std === "bicycle" ? f.teeth : undefined }); m.name = "wk:model:" + m.name; m.position.set(A.bb[0], A.bb[1], 0); mg.add(m); }
  // drivetrain: front sprocket/chainring, rear sprocket, chain with visible links
  const dr = g("drive"); if (dr) { dr.children.filter(isDrivetrainMesh).forEach((o) => dr.remove(o));
    const G = gearing(b), z = dt === "mmid" ? 0.09 : 0.055, fp = find(b.sprocket_f), rp = find(b.sprocket_r);
    let fr = PM.sprocketR(G.front); if (dt !== "pmid" && dt !== "mmid") { const s = PM.sprocket(G.front, fp?.std || G.chain, fp?.color || "#9fa6aa", "sprocketF"); s.position.set(A.bb[0], A.bb[1], z); dr.add(s); }
    const s2 = PM.sprocket(G.rear, rp?.std || G.chain, rp?.color || "#2f2f2f", "sprocketR"); s2.position.set(A.rearAxle[0], A.rearAxle[1], z); dr.add(s2);
    const rr = PM.sprocketR(G.rear) + 0.004; fr += 0.004; const pts = [], [bx, by] = A.bb, [rx, ry] = A.rearAxle;
    for (let i = 0; i <= 14; i++) { const a = Math.PI / 2 + (i / 14) * Math.PI; pts.push([rx + Math.cos(a) * rr, ry + Math.sin(a) * rr]); }
    for (let i = 0; i <= 18; i++) { const a = -Math.PI / 2 + (i / 18) * Math.PI; pts.push([bx + Math.cos(a) * fr, by + Math.sin(a) * fr]); }
    if(b.frame===TRAX_ID&&b.rear_frame)pts.splice(0,pts.length,...chainRoute([{x:rx,y:ry,r:rr},{x:rx-.018,y:ry-.05,r:PM.sprocketR(8)+.004},{x:rx+.028,y:ry-.12,r:PM.sprocketR(8)+.004},{x:bx,y:by,r:fr}]));
    const ch = PM.chainAlong(pts, G.chain, part("chain")?.color || (G.chain === "bicycle" ? "#5a5a5a" : "#2a2a2a"), z, "chain"); ch.name = "wk:model:chain"; dr.add(ch);
    // Replace the anonymous stock cranks/pedals with an explicit rotating axle assembly.
    dr.children.filter(o=>!o.name).forEach(o=>dr.remove(o));
    dr.add(PM.crankset(A.bb,part('cranks')?.color||'#33363a',!!motor?.nopedal||!!part('cranks')?.pegs));
    const cr = part("cranks"); if (cr && !cr.pegs) dr.traverse((o) => { if (o.isMesh && o.geometry.type === "CylinderGeometry" && Math.abs((o.geometry.parameters.radiusBottom || 0) - 0.011) < 0.001) { o.material = o.material.clone(); o.material.color = new T.Color(cr.color); } }); }
  // fork: stanchions/lowers/crown/arch (or rigid blades) between the head tube and front axle
  const sg = g("suspension"); if (sg) { sg.clear(); const fp = part("suspension") || { id: "rigid", travel: 0.03 }; const f = PM.fork(fp, A.headTop, A.headBottom, A.frontAxle, (fp.travel || 0) >= 0.18 ? A.headTop : null, { color: fp.color }); f.name = "wk:model:fork"; sg.add(f); }
  // rear shock: coil (helical spring) or air can, between the frame and swingarm mounts
  const sh = part("shock"); if (sh) { const G = slotGroup("shock"); G.userData.mount = "shockFrame→shockArm"; const m = sh.id==='trax_coil'?traxShockModel(T,A.shockFrame,A.shockArm,sh.color):PM.shock(sh, A.shockFrame, A.shockArm); m.name = "wk:model:shock"; G.add(m); }
  // bars + grips with real rise/sweep (stock tube/crossbar/grips removed; stem, levers kept)
  const cp = g("cockpit"); if (cp) { const old = cp.children.filter((o) => o.isMesh && (o.geometry.type === "TubeGeometry" || [0.008, 0.017].includes(o.geometry.parameters?.radiusTop))); old.forEach((o) => cp.remove(o));
    const clamp = [A.headTop[0] + 0.025, A.headTop[1] + 0.06], spec = { ...globalThis.__WK_BARSPEC__(part("bars"), part("grips")), width: moto ? 0.38 : (BARSPEC[b.bars]?.width || 0.34) };
    const m = PM.bars(spec, clamp); m.name = "wk:model:bars"; cp.add(m);
    // move levers + bar-mounted throttle/display to the new grip height
    const dy = spec.rise - 0.17, dx = 0.06 - spec.sweep; cp.children.forEach((o) => { if (o.isMesh && o.geometry.parameters?.radiusTop === 0.004) o.position.add(new T.Vector3(dx, dy, 0)); });
    const th = g("throttle"); th?.children.forEach((c) => { if (c.position.y > clamp[1] + 0.12) { c.position.y += dy; c.position.x += dx; } }); }
}

// spokes: replace the stock instanced spokes; each one runs from a flange hole to a rim nipple, ends exactly on both radii
export function respoke(root, T) {
  root.traverse((w) => { if (!w.isGroup) return; const sp = w.children.find((c) => c.isInstancedMesh && c.count === 36 && c.geometry.type === "CylinderGeometry"); if (!sp) return;
    w.userData.wkWheel=true;
    const rim = w.children.find((c) => c.geometry?.type === "TorusGeometry" && Math.abs(c.geometry.parameters.tube - 0.009) < 1e-4); if (!rim) return;
    const nipR = rim.geometry.parameters.radius - Math.sqrt(.009 ** 2 - .003 ** 2), H = w.userData.hubHoles || { r: 0.03, z: 0.035 }, N = 36, mat = sp.material; w.remove(sp);
    if (!w.userData.hubHoles) {
      // Replace the unperforated stock flanges with actual through-bores at the spoke roots.
      w.children.filter(o => o.geometry?.type === 'CylinderGeometry' && Math.abs(o.geometry.parameters.radiusTop - .034) < .00001).forEach(o => w.remove(o));
      PM.useThree(T);
      for (const side of [-1, 1]) { const f = PM.hubFlange(.034, H.r, side); f.position.z = side * H.z; w.add(f); }
    }
    const im = new T.InstancedMesh(new T.CylinderGeometry(0.0013, 0.0013, 1, 5), mat, N), o = new T.Object3D(), up = new T.Vector3(0, 1, 0); im.name = "wheel:spokes";
    const holes = [], nips = [];
    const rimIndices = [];
    for (let i = 0; i < N; i++) { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), ha = (k + (side > 0 ? 0.5 : 0)) / 18 * Math.PI * 2;
      const cross = H.r > .05 ? 1 : 3, rimIndex = 2 * ((k + (k % 2 ? -cross : cross) + 18) % 18) + (side > 0 ? 1 : 0), ra = rimIndex / N * Math.PI * 2;
      rimIndices.push(rimIndex);
      const a = new T.Vector3(Math.cos(ha) * H.r, Math.sin(ha) * H.r, side * H.z), bpt = new T.Vector3(Math.cos(ra) * nipR, Math.sin(ra) * nipR, side * 0.003), d = bpt.clone().sub(a);
      o.position.copy(a).addScaledVector(d, 0.5); o.scale.set(1, d.length(), 1); o.quaternion.setFromUnitVectors(up, d.normalize()); o.updateMatrix(); im.setMatrixAt(i, o.matrix); holes.push(a); nips.push(bpt); }
    im.castShadow = true; w.add(im);
    const nm = new T.InstancedMesh(new T.CylinderGeometry(0.0026, 0.0026, 0.012, 6), new T.MeshStandardMaterial({ color: "#c8c8c8", metalness: 1, roughness: 0.3 }), N); nm.name = "wheel:nipples";
    nips.forEach((p, i) => { o.position.copy(p); o.scale.set(1, 1, 1); o.quaternion.setFromUnitVectors(up, p.clone().sub(holes[i]).normalize()); o.updateMatrix(); nm.setMatrixAt(i, o.matrix); }); w.add(nm);
    w.userData.spokeCheck = { holeR: H.r, nipR, rimIndices, holes: holes.map((v) => v.toArray()), nips: nips.map((v) => v.toArray()) }; });
}
