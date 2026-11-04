// Wheelie King part models (v15). Realistic-proportion parts built from efficient primitives.
// Every part is a Group of NAMED sub-meshes, each with its OWN material (ready for the future paint/inspect "detail workshop").
// Coordinates: metres, x forward, y up, z lateral (bike's right side is +z).
let T = null; export const useThree = (three) => (T = three);
const M = (name, color, o = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.5, ...o }); m.name = name; return m; };
const mesh = (G, name, geo, mat) => { const m = new T.Mesh(geo, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };
const inst = (G, name, geo, mat, n, place) => { const im = new T.InstancedMesh(geo, mat, n), o = new T.Object3D(); im.name = name;
  for (let i = 0; i < n; i++) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); place(o, i); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } im.castShadow = true; G.add(im); return im; };
const zCyl = (r1, r2, h, seg = 32) => { const g = new T.CylinderGeometry(r1, r2, h, seg); g.rotateX(Math.PI / 2); return g; }; // axis along z
const between = (G, name, a, b, r, mat, seg = 16) => { const va = new T.Vector3(...a), vb = new T.Vector3(...b), d = vb.clone().sub(va);
  const m = mesh(G, name, new T.CylinderGeometry(r, r, d.length(), seg), mat); m.position.copy(va).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m; };
export const PITCH = 0.0127; // 1/2" pitch: bicycle, 420 and 428 chain all use it (428 is wider)
export const sprocketR = (n) => PITCH / (2 * Math.sin(Math.PI / n));
const CHAIN = { bicycle: { w: 0.0078, plate: 0.0095, roller: 0.0039, t: 0.003 }, "420": { w: 0.0105, plate: 0.0115, roller: 0.0039, t: 0.006 }, "428": { w: 0.0135, plate: 0.0125, roller: 0.0042, t: 0.007 } };
export function sprocket(n = 44, std = "bicycle", color = "#2a2a2a", name = "sprocket") {
  const G = new T.Group(); G.name = name; const r = sprocketR(n), t = CHAIN[std]?.t || 0.003, mat = M(name + ":plate", color, { metalness: 0.8, roughness: 0.3 });
  mesh(G, name + ":ring", new T.RingGeometry(r * (n > 20 ? 0.78 : 0.45), r - 0.002, Math.max(24, n), 1), mat).geometry.translate(0, 0, 0);
  const back = mesh(G, name + ":ringBack", new T.RingGeometry(r * (n > 20 ? 0.78 : 0.45), r - 0.002, Math.max(24, n), 1), mat); back.rotation.y = Math.PI;
  inst(G, name + ":teeth", new T.BoxGeometry(PITCH * 0.42, 0.007, t), M(name + ":teeth", color, { metalness: 0.85, roughness: 0.25 }), n, (o, i) => { const a = i / n * Math.PI * 2; o.position.set(Math.cos(a) * (r + 0.001), Math.sin(a) * (r + 0.001), 0); o.rotation.z = a - Math.PI / 2; });
  if (n > 20) { const arms = 5; inst(G, name + ":spider", new T.BoxGeometry(r * 0.8, 0.012, t * 1.6), M(name + ":spider", "#1a1a1a"), arms, (o, i) => { const a = i / arms * Math.PI * 2 + 0.3; o.position.set(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, 0.002); o.rotation.z = a; });
    inst(G, name + ":bolts", zCyl(0.004, 0.004, t * 2.4, 8), M(name + ":bolts", "#c0c0c0", { metalness: 1 }), arms, (o, i) => { const a = i / arms * Math.PI * 2 + 0.3; o.position.set(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, 0); }); }
  else mesh(G, name + ":hub", zCyl(r * 0.42, r * 0.42, t * 2.5, 24), M(name + ":hub", "#555", { metalness: 0.9 }));
  G.userData.r = r; G.userData.teeth = n; return G;
}
// links placed along a closed polyline (array of [x,y]) at depth z
export function chainAlong(points, std = "bicycle", color = "#4a4a4a", z = 0, name = "chain") {
  const G = new T.Group(); G.name = name; const c = CHAIN[std] || CHAIN.bicycle; const pts = points.map((p) => new T.Vector2(p[0], p[1]));
  const L = []; let tot = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], d = a.distanceTo(b); L.push([a, b, d, tot]); tot += d; }
  const n = Math.max(8, Math.round(tot / PITCH)), step = tot / n, at = (s) => { s = ((s % tot) + tot) % tot; const seg = L.find((q) => s >= q[3] && s <= q[3] + q[2]) || L[0]; const t = seg[2] ? (s - seg[3]) / seg[2] : 0; return [seg[0].x + (seg[1].x - seg[0].x) * t, seg[0].y + (seg[1].y - seg[0].y) * t, Math.atan2(seg[1].y - seg[0].y, seg[1].x - seg[0].x)]; };
  const pm = M(name + ":plates", color, { metalness: 0.85, roughness: 0.35 }), rm = M(name + ":rollers", "#8a8a8a", { metalness: 0.9, roughness: 0.3 });
  for (const side of [-1, 1]) inst(G, name + ":plates" + (side > 0 ? "R" : "L"), new T.BoxGeometry(PITCH * 1.35, c.plate * 0.8, 0.0012), pm, n, (o, i) => { const [x, y, a] = at(i * step + step / 2); o.position.set(x, y, z + side * (c.w / 2 + (i % 2 ? 0.0012 : 0))); o.rotation.z = a; });
  inst(G, name + ":rollers", zCyl(c.roller, c.roller, c.w, 8), rm, n, (o, i) => { const [x, y] = at(i * step); o.position.set(x, y, z); });
  G.userData.links = n; return G;
}
export function chainSegment(std = "bicycle", color = "#4a4a4a", links = 16) { const len = links * PITCH; return chainAlong([[-len / 2, 0], [len / 2, 0], [len / 2, -0.0001], [-len / 2, -0.0001]], std, color, 0, "chain"); }
export function hubFlange(radius, holeRadius, side, color = '#9aa0a6') {
  const profile = new T.Shape(); profile.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const center = new T.Path(); center.absarc(0, 0, Math.max(.008, holeRadius - .011), 0, Math.PI * 2, true); profile.holes.push(center);
  for (let k = 0; k < 18; k++) {
    const a = (k + (side > 0 ? .5 : 0)) / 18 * Math.PI * 2;
    const hole = new T.Path(); hole.absarc(Math.cos(a) * holeRadius, Math.sin(a) * holeRadius, .002, 0, Math.PI * 2, true); profile.holes.push(hole);
  }
  const geo = new T.ExtrudeGeometry(profile, {depth:.004,bevelEnabled:false,curveSegments:8}); geo.translate(0,0,-.002);
  const flange = new T.Mesh(geo, M('hub:flange', color, {metalness:.9,roughness:.25}));
  flange.name = 'hub:flange' + (side > 0 ? 'R' : 'L'); flange.castShadow = flange.receiveShadow = true;
  flange.userData.spokeBores = { radius:holeRadius, count:18, phase:side > 0 ? .5 : 0 };
  return flange;
}
export function hubMotor(p, opts = {}) {
  const G = new T.Group(); G.name = "hub"; const w = p.w || 1000, r = opts.r || 0.05 + Math.min(0.06, w / 140000), wd = opts.wd || 0.05 + Math.min(0.04, w / 200000), front = p.kind === "front";
  mesh(G, "hub:shell", zCyl(r, r, wd, 48), M("hub:shell", opts.color || "#2b2d30", { metalness: 0.7, roughness: 0.35 }));
  for (const s of [-1, 1]) { const f = hubFlange(r + .014, r + .009, s); G.add(f); f.position.z = s * (wd / 2 - 0.004);
    const c = mesh(G, "hub:cover" + (s > 0 ? "R" : "L"), zCyl(r * 0.7, r * 0.75, 0.008, 32), M("hub:cover", "#1c1d1f", { metalness: 0.6 })); c.position.z = s * (wd / 2 + 0.003);
    inst(G, "hub:bolts" + (s > 0 ? "R" : "L"), zCyl(0.0035, 0.0035, 0.004, 6), M("hub:bolts", "#d0d0d0", { metalness: 1 }), 8, (o, i) => { const a = i / 8 * Math.PI * 2; o.position.set(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, s * (wd / 2 + 0.008)); });
  }
  inst(G, "hub:fins", new T.BoxGeometry(0.006, 0.01, wd * 0.6), M("hub:fins", "#3a3c40", { metalness: 0.7 }), 24, (o, i) => { const a = i / 24 * Math.PI * 2; o.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); o.rotation.z = a; });
  const ax = (front ? 0.1 : 0.14) + 0.02; mesh(G, "hub:axle", zCyl(0.006, 0.006, ax + 0.04, 12), M("hub:axle", "#b8b8b8", { metalness: 1, roughness: 0.2 }));
  for (const s of [-1, 1]) { const n = mesh(G, "hub:axleNut" + (s > 0 ? "R" : "L"), zCyl(0.011, 0.011, 0.008, 6), M("hub:nut", "#cfcfcf", { metalness: 1 })); n.position.z = s * (ax / 2 + 0.008); }
  const cz = (ax / 2 + 0.004) * (front ? -1 : 1), path = new T.CatmullRomCurve3([new T.Vector3(0, 0, cz), new T.Vector3(0.0, 0.0, cz + Math.sign(cz) * 0.02), new T.Vector3(0.03, 0.03, cz + Math.sign(cz) * 0.025), new T.Vector3(0.09, 0.1, cz + Math.sign(cz) * 0.02)]);
  mesh(G, "hub:cable", new T.TubeGeometry(path, 16, 0.0045, 6), M("hub:cable", "#111", { metalness: 0.1, roughness: 0.8 }));
  G.userData = { r, wd }; return G;
}
export function midDrive(p, opts = {}) { // BBSHD-style: motor can angled forward-down + gear housing round the BB + chainring
  const G = new T.Group(); G.name = "mid"; const big = (p.w || 1000) >= 1000;
  const gh = mesh(G, "mid:gearHousing", zCyl(0.072, 0.072, 0.05, 40), M("mid:gearHousing", "#2a2c2f", { metalness: 0.6, roughness: 0.4 })); gh.position.z = -0.005;
  const can = new T.Group(); can.name = "mid:motorAssembly"; G.add(can); can.rotation.z = -0.55;
  const m1 = mesh(can, "mid:motor", new T.CylinderGeometry(0.056, 0.056, big ? 0.13 : 0.11, 36), M("mid:motor", opts.color || "#1d1f22", { metalness: 0.65, roughness: 0.35 })); m1.rotation.z = Math.PI / 2; m1.position.set(0.1, 0, -0.02);
  inst(can, "mid:fins", new T.BoxGeometry(big ? 0.12 : 0.1, 0.006, 0.006), M("mid:fins", "#2e3034"), 14, (o, i) => { const a = i / 14 * Math.PI * 2; o.position.set(0.1, Math.cos(a) * 0.057, -0.02 + Math.sin(a) * 0.057); });
  const cap = mesh(can, "mid:endCap", new T.CylinderGeometry(0.05, 0.05, 0.012, 32), M("mid:endCap", "#9aa0a6", { metalness: 0.9 })); cap.rotation.z = Math.PI / 2; cap.position.set(0.1 + (big ? 0.07 : 0.06), 0, -0.02);
  const cab = new T.CatmullRomCurve3([new T.Vector3(0.17, 0.02, -0.02), new T.Vector3(0.21, 0.05, 0), new T.Vector3(0.26, 0.1, 0.01)]); mesh(can, "mid:cable", new T.TubeGeometry(cab, 12, 0.005, 6), M("mid:cable", "#111", { metalness: 0.1, roughness: 0.8 }));
  const cr = sprocket(opts.teeth || 44, "bicycle", "#222", "mid:chainring"); cr.position.z = 0.055; G.add(cr);
  const cv = mesh(G, "mid:cover", zCyl(0.04, 0.04, 0.01, 32), M("mid:cover", "#9aa0a6", { metalness: 0.9 })); cv.position.z = 0.03;
  return G;
}
export function motoMid(p, opts = {}) { // e-moto mid: pancake motor + controller + small 428 front sprocket
  const G = new T.Group(); G.name = "motoMid"; const r = 0.085 + Math.min(0.03, (p.w || 6000) / 600000);
  mesh(G, "motoMid:motor", zCyl(r, r, 0.13, 48), M("motoMid:motor", opts.color || "#202226", { metalness: 0.7, roughness: 0.35 }));
  inst(G, "motoMid:fins", new T.BoxGeometry(0.008, 0.014, 0.12), M("motoMid:fins", "#2f3236"), 30, (o, i) => { const a = i / 30 * Math.PI * 2; o.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); o.rotation.z = a; });
  for (const s of [-1, 1]) { const c = mesh(G, "motoMid:cover" + (s > 0 ? "R" : "L"), zCyl(r * 0.85, r * 0.9, 0.012, 40), M("motoMid:cover", s > 0 ? "#c8ccd0" : "#2a2c30", { metalness: 0.85 })); c.position.z = s * 0.071; }
  const ctl = mesh(G, "motoMid:controller", new T.BoxGeometry(0.16, 0.06, 0.09), M("motoMid:controller", "#111317", { metalness: 0.5 })); ctl.position.set(0.04, r + 0.04, 0); ctl.rotation.z = -0.25;
  inst(G, "motoMid:ctlFins", new T.BoxGeometry(0.15, 0.01, 0.004), M("motoMid:ctlFins", "#2a2c30"), 7, (o, i) => { o.position.set(0.04, r + 0.075, -0.035 + i * 0.012); o.rotation.z = -0.25; });
  const sp = sprocket(opts.teeth || 14, "428", "#333", "motoMid:sprocket"); sp.position.z = 0.09; G.add(sp);
  return G;
}
const BATT = { hl36: "bottle", hl48: "downtube", hl52: "downtube", bat_dt48: "downtube", tri72: "triangle", bat_tri52: "triangle", nullarbor: "triangle", redc: "moto", moto60: "moto", moto72: "moto", bat_rack48: "rack" };
export const batteryType = (p) => p.mount === "rack" ? "rack" : BATT[p.id] || (p.kg >= 9 ? "moto" : p.kg >= 5 ? "triangle" : "downtube");
export function battery(p) {
  const G = new T.Group(); G.name = "battery"; const type = batteryType(p), col = p.v >= 60 ? "#1a1c20" : "#23262b", accent = p.v >= 72 ? "#ff3b30" : p.v >= 52 ? "#39ff7a" : "#3ab8ff";
  const scale = Math.cbrt((p.kg || 4) / 4);
  if (type === "triangle") { const sh = new T.Shape(); sh.moveTo(-0.2, -0.12); sh.lineTo(0.22, -0.1); sh.lineTo(0.2, 0.06); sh.lineTo(-0.16, 0.14); sh.lineTo(-0.22, 0.02); sh.closePath();
    const g = new T.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }); g.translate(0, 0, -0.035); g.scale(scale, scale, 1);
    mesh(G, "battery:case", g, M("battery:case", col, { metalness: 0.2, roughness: 0.7 }));
    inst(G, "battery:straps", new T.BoxGeometry(0.02, 0.3 * scale, 0.1), M("battery:straps", "#111", { metalness: 0 }), 3, (o, i) => { o.position.set((-0.12 + i * 0.12) * scale, 0.01, 0); o.rotation.z = 0.15; });
    mesh(G, "battery:stripe", new T.BoxGeometry(0.3 * scale, 0.012, 0.072), M("battery:stripe", accent, { emissive: accent, emissiveIntensity: 0.3 })).position.set(0, -0.06 * scale, 0); }
  else if (type === "moto") { mesh(G, "battery:case", new T.BoxGeometry(0.36 * scale, 0.22 * scale, 0.14), M("battery:case", col, { metalness: 0.6, roughness: 0.35 }));
    inst(G, "battery:fins", new T.BoxGeometry(0.34 * scale, 0.006, 0.01), M("battery:fins", "#30343a", { metalness: 0.7 }), 9, (o, i) => o.position.set(0, (-0.09 + i * 0.022) * scale, 0.075));
    inst(G, "battery:terminals", zCyl(0.012, 0.012, 0.02, 12), M("battery:terminals", "#d4a017", { metalness: 1 }), 2, (o, i) => o.position.set((i ? 0.12 : -0.12) * scale, 0.115 * scale, 0));
    mesh(G, "battery:label", new T.BoxGeometry(0.14, 0.04, 0.002), M("battery:label", accent, { emissive: accent, emissiveIntensity: 0.4 })).position.set(0, 0.03, 0.071); }
  else if (type === "bottle") { mesh(G, "battery:case", new T.CylinderGeometry(0.036, 0.036, 0.26, 32), M("battery:case", col, { metalness: 0.3 }));
    mesh(G, "battery:cap", new T.CylinderGeometry(0.03, 0.036, 0.04, 32), M("battery:cap", "#111")).position.y = 0.15; mesh(G, "battery:ring", new T.TorusGeometry(0.037, 0.003, 6, 32), M("battery:ring", accent, { emissive: accent, emissiveIntensity: 0.5 })).rotation.x = Math.PI / 2; G.rotation.z = -1.1; }
  else if (type === "rack") { mesh(G, "battery:case", new T.BoxGeometry(0.34, 0.07, 0.12), M("battery:case", col, { metalness: 0.3 }));
    for (const s of [-1, 1]) between(G, "battery:rackRail" + (s > 0 ? "R" : "L"), [-0.2, -0.045, s * 0.07], [0.2, -0.045, s * 0.07], 0.005, M("battery:rack", "#888", { metalness: 0.9 }));
    mesh(G, "battery:taillight", new T.BoxGeometry(0.01, 0.025, 0.06), M("battery:taillight", "#ff2020", { emissive: "#ff2020", emissiveIntensity: 1 })).position.set(-0.175, 0, 0); }
  else { const g = new T.CapsuleGeometry(0.042 * scale, 0.3 * scale, 6, 16); g.rotateZ(Math.PI / 2); g.scale(1, 0.85, 1.05); mesh(G, "battery:case", g, M("battery:case", col, { metalness: 0.3, roughness: 0.5 }));
    mesh(G, "battery:rail", new T.BoxGeometry(0.34 * scale, 0.012, 0.05), M("battery:rail", "#111")).position.y = -0.04 * scale;
    mesh(G, "battery:lock", zCyl(0.008, 0.008, 0.01, 12), M("battery:lock", "#c0c0c0", { metalness: 1 })).position.set(0.12 * scale, 0, 0.047);
    inst(G, "battery:leds", new T.BoxGeometry(0.008, 0.004, 0.002), M("battery:leds", accent, { emissive: accent, emissiveIntensity: 0.8 }), 4, (o, i) => o.position.set(0.05 + i * 0.012, 0.02, 0.046)); }
  G.userData.type = type; return G;
}
// --- forks / shocks / bars, built between bike anchors ---
export function fork(p, top, bottom, axle, headTop, opts = {}) {
  const G = new T.Group(); G.name = "fork"; const id = p?.id || "rigid", travel = p?.travel || 0.03, dual = ["dnm", "fox40", "corro"].includes(id), usd = id === "dnm";
  const crown = new T.Vector3(...bottom, 0).add(new T.Vector3(0.012, -0.03, 0)), ax = new T.Vector3(...axle, 0), dir = ax.clone().sub(crown), len = dir.length(); dir.normalize();
  const sideZ = 0.065, stanchionR = travel >= 0.18 ? 0.019 : travel >= 0.14 ? 0.0175 : 0.016, lowerR = stanchionR + 0.006;
  const silver = M("fork:stanchions", usd ? "#c9a227" : "#d8dde2", { metalness: 0.95, roughness: 0.15 }), lowers = M("fork:lowers", opts.color || (id === "fox40" ? "#1a1a1a" : id === "pike" ? "#141414" : "#202020"), { metalness: 0.4, roughness: 0.45 });
  if (id === "rigid" || travel < 0.05) { // rigid steel blades
    for (const s of [-1, 1]) { const a = crown.clone().setZ(s * sideZ), b = ax.clone().setZ(s * sideZ); between(G, "fork:blade" + (s > 0 ? "R" : "L"), a.toArray(), b.toArray(), 0.011, M("fork:blades", opts.color || "#2b2b2b", { metalness: 0.5 })); }
    mesh(G, "fork:crown", new T.BoxGeometry(0.05, 0.03, 0.16), M("fork:crown", "#2b2b2b", { metalness: 0.5 })).position.copy(crown);
  } else {
    const split = usd ? 0.55 : 0.42, mid = crown.clone().addScaledVector(dir, len * split);
    for (const s of [-1, 1]) { const top3 = crown.clone().setZ(s * sideZ), m = mid.clone().setZ(s * sideZ), b = ax.clone().setZ(s * sideZ);
      if (usd) { between(G, "fork:upperTube" + (s > 0 ? "R" : "L"), top3.toArray(), m.toArray(), lowerR + 0.004, lowers); between(G, "fork:stanchion" + (s > 0 ? "R" : "L"), m.toArray(), b.toArray(), stanchionR, silver); }
      else { between(G, "fork:stanchion" + (s > 0 ? "R" : "L"), top3.toArray(), m.clone().addScaledVector(dir, 0.04).toArray(), stanchionR, silver); between(G, "fork:lower" + (s > 0 ? "R" : "L"), m.toArray(), b.toArray(), lowerR, lowers); }
      const foot = mesh(G, "fork:dropout" + (s > 0 ? "R" : "L"), zCyl(0.016, 0.016, 0.02, 16), M("fork:dropouts", "#333", { metalness: 0.6 })); foot.position.copy(b); }
    if (!usd) { const arch = mesh(G, "fork:arch", new T.TorusGeometry(sideZ, 0.011, 8, 24, Math.PI), lowers); arch.position.copy(mid.clone().addScaledVector(dir, 0.03)); arch.rotation.y = Math.PI / 2; arch.rotation.order = "YXZ"; arch.rotation.x = -Math.atan2(dir.x, -dir.y) * 0; arch.translateX(0); }
    mesh(G, "fork:crown", new T.BoxGeometry(0.06, 0.03, 2 * sideZ + 0.05), M("fork:crown", "#2a2a2a", { metalness: 0.7 })).position.copy(crown);
    if (dual && headTop) { const up = new T.Vector3(...headTop, 0).add(new T.Vector3(-0.01, 0.01, 0)); mesh(G, "fork:upperCrown", new T.BoxGeometry(0.06, 0.025, 2 * sideZ + 0.05), M("fork:upperCrown", "#2a2a2a", { metalness: 0.7 })).position.copy(up);
      for (const s of [-1, 1]) between(G, "fork:stanchionTop" + (s > 0 ? "R" : "L"), up.clone().setZ(s * sideZ).toArray(), crown.clone().setZ(s * sideZ).toArray(), usd ? lowerR + 0.004 : stanchionR, usd ? lowers : silver); }
    const cap = mesh(G, "fork:topCaps", zCyl(0.012, 0.012, 2 * sideZ + 0.03, 12), M("fork:topCaps", "#ff6a00", { metalness: 0.8 })); cap.position.copy(dual && headTop ? new T.Vector3(...headTop, 0).add(new T.Vector3(-0.01, 0.03, 0)) : crown.clone().add(new T.Vector3(0, 0.02, 0)));
  }
  return G;
}
export function shock(p, a, b) {
  const G = new T.Group(); G.name = "shock"; const A = new T.Vector3(...a, 0), B = new T.Vector3(...b, 0), d = B.clone().sub(A), L = d.length(), u = d.clone().normalize();
  const air = p.id === "shk_air180", moto = p.id === "shk_moto230", body = M("shock:body", air ? "#1a1a1a" : "#2a2a2a", { metalness: 0.6 });
  for (const [P, nm] of [[A, "shock:eyeletTop"], [B, "shock:eyeletBottom"]]) mesh(G, nm, zCyl(0.012, 0.012, 0.03, 16), M(nm, "#999", { metalness: 0.9 })).position.copy(P);
  between(G, "shock:shaft", A.clone().addScaledVector(u, L * 0.45).toArray(), B.toArray(), 0.006, M("shock:shaft", "#e0e0e0", { metalness: 1, roughness: 0.1 }));
  between(G, "shock:body", A.toArray(), A.clone().addScaledVector(u, L * 0.55).toArray(), air ? 0.02 : 0.014, body);
  if (air) between(G, "shock:airCan", A.clone().addScaledVector(u, L * 0.12).toArray(), A.clone().addScaledVector(u, L * 0.62).toArray(), 0.026, M("shock:airCan", "#101010", { metalness: 0.5, roughness: 0.4 }));
  else { const coils = 9, r = moto ? 0.03 : 0.025, pts = []; for (let i = 0; i <= coils * 16; i++) { const t = i / (coils * 16), a2 = t * coils * Math.PI * 2; pts.push(new T.Vector3(Math.cos(a2) * r, L * (0.18 + 0.7 * t), Math.sin(a2) * r)); }
    const sp = mesh(G, "shock:spring", new T.TubeGeometry(new T.CatmullRomCurve3(pts), coils * 16, moto ? 0.0045 : 0.0035, 6), M("shock:spring", p.color || "#ff8c1a", { metalness: 0.6, roughness: 0.35 }));
    sp.position.copy(A); sp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), u);
    if (moto) { const res = between(G, "shock:reservoir", A.clone().add(new T.Vector3(0.02, 0, 0.035)).toArray(), A.clone().addScaledVector(u, L * 0.35).add(new T.Vector3(0.02, 0, 0.035)).toArray(), 0.016, M("shock:reservoir", "#c00", { metalness: 0.7 })); } }
  return G;
}
export function bars(spec, clamp) { // spec: {rise, sweep, width, up} — real rise (mm) and backsweep
  const G = new T.Group(); G.name = "bars"; const [cx, cy] = clamp, rise = spec.rise ?? 0.05, sweep = spec.sweep ?? 0.04, w = spec.width ?? 0.36, col = spec.color || "#333";
  const pts = []; for (const s of [-1, 1]) for (const t of s < 0 ? [1, 0.75, 0.45, 0.2] : [0.2, 0.45, 0.75, 1]) pts.push(new T.Vector3(cx - sweep * t * t, cy + rise * Math.min(1, t * 1.6) , s * w * t));
  pts.splice(4, 0, new T.Vector3(cx, cy, 0));
  mesh(G, "bars:bar", new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, 0.011, 10), M("bars:bar", col, { metalness: 0.6, roughness: 0.35 }));
  mesh(G, "bars:clamp", zCyl(0.02, 0.02, 0.05, 16), M("bars:clamp", "#1a1a1a", { metalness: 0.7 })).position.set(cx, cy, 0);
  if (spec.crossbar) { const cb = between(G, "bars:crossbar", [cx - sweep * 0.2, cy + rise * 0.65, -w * 0.38], [cx - sweep * 0.2, cy + rise * 0.65, w * 0.38], 0.008, M("bars:crossbar", col, { metalness: 0.6 }));
    if (spec.pad) between(G, "bars:pad", [cx - sweep * 0.2, cy + rise * 0.65, -0.09], [cx - sweep * 0.2, cy + rise * 0.65, 0.09], 0.02, M("bars:pad", "#c8102e", { metalness: 0, roughness: 0.8 })); }
  const end = (s) => new T.Vector3(cx - sweep, cy + rise, s * w), inner = (s) => new T.Vector3(cx - sweep * 0.56, cy + rise, s * w * 0.75);
  for (const s of [-1, 1]) between(G, "grips:" + (s > 0 ? "R" : "L"), inner(s).lerp(end(s), 0.15).toArray(), end(s).toArray(), 0.016, M("grips:" + (s > 0 ? "R" : "L"), spec.gripColor || "#222", { metalness: 0, roughness: 0.9 }));
  G.userData.ends = [end(-1).toArray(), end(1).toArray()]; return G;
}
