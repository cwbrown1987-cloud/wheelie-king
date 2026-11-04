// Wheelie King detail pass (v18): PBR, bevelled geometry, LOD'd fasteners/welds/knobs/nipples, real rotors+calipers,
// extruded-profile fenders, the rear WING slot, and the generic "Enduro E-Moto" frame look (boxy bevelled battery
// enclosure, finned controller, box-section swingarm, long flat seat, headlight + number plate).
// LOD rule: meshes with userData.lod = "hi" only show when the garage camera is close (< LOD_NEAR m from the bike).
export const LOD_NEAR = 1.5;
let T;
const std = (name, color, o = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.4, ...o }); m.name = name; return m; };
const phys = (name, color, o = {}) => { const m = new T.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.25, ...o }); m.name = name; return m; };
const mk = (G, name, geo, mat, lod) => { const m = new T.Mesh(geo, mat); m.name = name; m.castShadow = m.receiveShadow = true; if (lod) m.userData.lod = lod; G.add(m); return m; };
const rrect = (w, h, r) => { const s = new T.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2); s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
// bevelled box: extruded rounded rect, centred
export const bbox = (w, h, d, r = 0.008, bev = 0.004) => { const g = new T.ExtrudeGeometry(rrect(w - bev * 2, h - bev * 2, r), { depth: Math.max(0.001, d - bev * 2), bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -(d - bev * 2) / 2); return g; };
const hexBolts = (G, name, pts, r = 0.0045, len = 0.006, axis = "z") => { const im = new T.InstancedMesh(new T.CylinderGeometry(r, r, len, 6), std(name, "#c9ccd0", { metalness: 1, roughness: 0.25 }), pts.length), o = new T.Object3D();
  pts.forEach((p, i) => { o.position.set(...p); o.rotation.set(axis === "z" ? Math.PI / 2 : 0, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.name = name; im.userData.lod = "hi"; G.add(im); return im; };
// side-profile fender: an arc band extruded across the tyre width, with bevelled edges (real fender thickness)
export function fenderArc(name, R, a0, a1, width, color, thick = 0.006) {
  const s = new T.Shape(), n = 24; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; s[i ? "lineTo" : "moveTo"](Math.cos(a) * (R + thick), Math.sin(a) * (R + thick)); }
  for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; s.lineTo(Math.cos(a) * R, Math.sin(a) * R); } s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 2 }); g.translate(0, 0, -width / 2);
  const G = new T.Group(); G.name = name; mk(G, name + ":shell", g, phys(name + ":shell", color)); return G;
}
// high moto front fender / rear wing: a long gently-curved blade (profile = shallow arc), wider in the middle
function blade(name, len, width, rise, color) {
  const s = new T.Shape(), n = 20, t = 0.007; const y = (u) => rise * (1 - (2 * u - 1) ** 2); for (let i = 0; i <= n; i++) { const u = i / n; s[i ? "lineTo" : "moveTo"](u * len, y(u) + t); } for (let i = n; i >= 0; i--) { const u = i / n; s.lineTo(u * len, y(u)); } s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.006, bevelSegments: 2 }); g.translate(0, 0, -width / 2);
  const G = new T.Group(); G.name = name; mk(G, name + ":blade", g, phys(name + ":blade", color)); return G;
}
export function detailPass(root, A, b, three, find, slotGroup, g) {
  T = three; const isMoto = ["moto", "emoto"].includes(b.frame || "bmx"), em = b.frame === "emoto", R = A.wheelR;
  const fr = g("frame");
  // ---- frame welds (hi LOD bead rings) + fasteners ----
  if (fr) { const weldMat = fr.children.find((c) => c.name?.startsWith("frame:"))?.material; fr.children.filter((c) => c.name?.startsWith("frame:weld")).forEach((w) => { const r = w.geometry.parameters.radius;
      const bead = new T.Mesh(new T.TorusGeometry(r * 0.92, r * 0.18, 6, 20), weldMat); bead.name = "frame:weldBead"; bead.position.copy(w.position); bead.rotation.y = Math.PI / 2; bead.userData.lod = "hi"; fr.add(bead); });
    hexBolts(fr, "frame:bolts", [[A.bb[0], A.bb[1], 0.048], [A.bb[0], A.bb[1], -0.048], [A.rearAxle[0], A.rearAxle[1], 0.068], [A.rearAxle[0], A.rearAxle[1], -0.068], [A.headTop[0], A.headTop[1] + 0.02, 0.03]], 0.006, 0.008); }
  // ---- brakes: real rotors with holes + bevelled calipers with pistons ----
  const br = g("brakes"); if (br) { br.children.slice().forEach((o) => {
      if (o.geometry?.type === "TorusGeometry" && Math.abs(o.scale.z - 0.15) < 0.01) { const rr = o.geometry.parameters.radius + 0.012, sh = new T.Shape(); sh.absarc(0, 0, rr, 0, Math.PI * 2, false);
        const inner = new T.Path(); inner.absarc(0, 0, rr - 0.026, 0, Math.PI * 2, true); sh.holes.push(inner);
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rad = rr - (i % 2 ? 0.009 : 0.016), h = new T.Path(); h.absarc(Math.cos(a) * rad, Math.sin(a) * rad, 0.0028, 0, Math.PI * 2, true); sh.holes.push(h); }
        const rotor = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.0022, bevelEnabled: false, curveSegments: 20 }), std("brake:rotor", "#d2d5d8", { metalness: 1, roughness: 0.22 })); rotor.name = "brake:rotor"; rotor.position.copy(o.position); rotor.castShadow = true; br.remove(o); br.add(rotor);
        hexBolts(br, "brake:rotorBolts", Array.from({ length: 6 }, (_, i) => [o.position.x + Math.cos(i / 6 * 6.283) * 0.022, o.position.y + Math.sin(i / 6 * 6.283) * 0.022, o.position.z - 0.003]), 0.003, 0.004); }
      if (o.geometry?.type === "BoxGeometry" && Math.abs(o.geometry.parameters.width - 0.05) < 1e-4) { const G = new T.Group(); G.name = "brake:caliper"; G.position.copy(o.position); G.rotation.copy(o.rotation);
        const red = b.brakes === "zee" || isMoto ? "#d0161b" : "#2b2b2b"; mk(G, "caliper:body", bbox(0.056, 0.036, 0.034, 0.01, 0.004), phys("caliper:body", red, { metalness: 0.5, roughness: 0.3 }));
        for (const s of [-1, 1]) { const pz = mk(G, "caliper:piston", new T.CylinderGeometry(0.008, 0.008, 0.004, 16), std("caliper:piston", "#e0e0e0", { metalness: 1 }), "hi"); pz.position.set(s * 0.013, 0, 0.018); pz.rotation.x = Math.PI / 2; }
        mk(G, "caliper:pad", bbox(0.044, 0.012, 0.006, 0.003, 0.001), std("caliper:pad", "#333", { metalness: 0.2 }), "hi").position.set(0, -0.012, 0);
        hexBolts(G, "caliper:bolts", [[-0.022, 0.012, 0.018], [0.022, 0.012, 0.018]], 0.004, 0.006); br.remove(o); br.add(G); } }); }
  // ---- tyres: second staggered row of knobs (hi LOD) ----
  for (const grp of [g("tyres"), g("motor")]) grp?.traverse((o) => { if (o.isInstancedMesh && o.count === 64 && !o.userData.wkKnobs) { o.userData.wkKnobs = 1; const tor = o.parent.children.find((c) => c.geometry?.type === "TorusGeometry"); if (!tor) return; const Rt = tor.geometry.parameters.radius + tor.geometry.parameters.tube;
      const im = new T.InstancedMesh(new T.BoxGeometry(0.012, 0.008, 0.01), o.material, 96), ob = new T.Object3D(); for (let i = 0; i < 96; i++) { const a = (i + 0.5) / 96 * Math.PI * 2, z = (i % 3 - 1) * 0.022; ob.position.set(Math.cos(a) * (Rt - 0.004), Math.sin(a) * (Rt - 0.004), z); ob.rotation.set(0, 0, a); ob.updateMatrix(); im.setMatrixAt(i, ob.matrix); }
      im.name = "tyre:knobsHi"; im.userData.lod = "hi"; im.castShadow = true; o.parent.add(im); } });
  // spoke nipples count as hi detail
  root.traverse((o) => { if (o.name === "wheel:nipples") o.userData.lod = "hi"; });
  // ---- fenders (extruded profiles) + REAR WING slot ----
  const ffp = find(b.fender_f), frp = find(b.fender_r), wg = find(b.wing);
  const old = (slot) => root.children.find((c) => c.name === "wk:part:" + slot);
  if (ffp) { const G = old("fender_f") ? (old("fender_f").clear(), old("fender_f")) : slotGroup("fender_f");
    if (isMoto || ffp.id === "ff_mx" || ffp.id === "ff_neon") { const bl = blade("fender_f", 0.62, 0.11, 0.05, ffp.color); bl.position.set(A.headBottom[0] - 0.24, A.headBottom[1] - 0.07, 0); bl.rotation.z = -0.12; G.add(bl); G.userData.mount = "underTripleClamp";
      hexBolts(G, "fender_f:bolts", [[A.headBottom[0] - 0.02, A.headBottom[1] - 0.04, 0.03], [A.headBottom[0] + 0.02, A.headBottom[1] - 0.045, -0.03]], 0.004, 0.016, "y"); }
    else { const a = fenderArc("fender_f", R + 0.03, 0.6, 2.6, 0.075, ffp.color); a.position.set(A.frontAxle[0], A.frontAxle[1], 0); G.add(a); G.userData.mount = "frontAxle"; } }
  if (frp) { const G = old("fender_r") ? (old("fender_r").clear(), old("fender_r")) : slotGroup("fender_r"); const short = frp.id === "fr_short";
    const a = fenderArc("fender_r", R + 0.025, short ? 0.9 : 0.75, short ? 2.1 : 2.6, 0.085, frp.color); a.position.set(A.rearAxle[0], A.rearAxle[1], 0); G.add(a); G.userData.mount = "swingarm (hugger)";
    hexBolts(G, "fender_r:bolts", [[A.rearAxle[0] + 0.07, A.rearAxle[1] + R * 0.85, 0.045]], 0.004, 0.008); }
  if (wg) { const G = slotGroup("wing"); const bl = blade("wing", 0.5, 0.13, 0.03, wg.color); bl.position.set(A.seatTop[0] - 0.58, A.seatTop[1] - 0.02, 0); bl.rotation.z = 0.12; G.add(bl); G.userData.mount = "behind seat";
    const tl = mk(G, "wing:taillight", bbox(0.012, 0.025, 0.07, 0.004, 0.002), std("wing:taillight", "#ff2020", { emissive: "#ff2020", emissiveIntensity: 1.2 })); tl.position.set(A.seatTop[0] - 0.6, A.seatTop[1] - 0.015, 0);
    hexBolts(G, "wing:bolts", [[A.seatTop[0] - 0.12, A.seatTop[1] + 0.0, 0.05], [A.seatTop[0] - 0.12, A.seatTop[1], -0.05]], 0.004, 0.01); }
  // ---- generic Enduro E-Moto look ----
  if (em) emoto(root, A, b, g, fr);
}
function emoto(root, A, b, g, fr) {
  const G = new T.Group(); G.name = "wk:emoto"; root.add(G); const { headTop: ht, headBottom: hb, bb, seatTop: st, rearAxle: ra, frontAxle: fa } = A;
  // big bevelled battery / side-panel enclosure filling the frame triangle
  const prof = new T.Shape(); const P = [[hb[0] - 0.05, hb[1] + 0.07], [ht[0] - 0.12, ht[1] - 0.04], [st[0] + 0.1, st[1] - 0.06], [bb[0] + 0.02, bb[1] + 0.06], [bb[0] + 0.14, bb[1] + 0.03]];
  prof.moveTo(...P[0]); P.slice(1).forEach((p) => prof.lineTo(...p)); prof.closePath();
  const body = mk(G, "emoto:enclosure", new T.ExtrudeGeometry(prof, { depth: 0.13, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.014, bevelSegments: 3 }), phys("emoto:enclosure", "#15171a", { roughness: 0.42, clearcoat: 0.6 })); body.geometry.translate(0, 0, -0.065);
  for (const s of [-1, 1]) { const seam = new T.Mesh(new T.ExtrudeGeometry(prof, { depth: 0.001, bevelEnabled: false }), std("emoto:seam", "#050505", { roughness: 0.9 })); seam.scale.set(0.985, 0.985, 1); seam.position.set(P[0][0] * 0.015, P[0][1] * 0.015, s * 0.08); seam.name = "emoto:panelSeam"; seam.userData.lod = "hi"; G.add(seam); }
  const lid = mk(G, "emoto:batteryLid", bbox(0.26, 0.05, 0.12, 0.012, 0.006), phys("emoto:batteryLid", "#101214")); lid.position.set(ht[0] - 0.3, ht[1] - 0.02, 0); lid.rotation.z = -0.05;
  // controller with vent fins on the left side, cable run to the motor
  const ctl = new T.Group(); ctl.name = "emoto:controller"; ctl.position.set(hb[0] - 0.1, hb[1] - 0.07, -0.09); G.add(ctl);
  mk(ctl, "controller:case", bbox(0.16, 0.11, 0.03, 0.008, 0.003), std("controller:case", "#2a2d31", { metalness: 0.75, roughness: 0.3 }));
  const fins = new T.InstancedMesh(new T.BoxGeometry(0.15, 0.005, 0.012), std("controller:fins", "#3a3e44", { metalness: 0.85, roughness: 0.3 }), 9), o = new T.Object3D();
  for (let i = 0; i < 9; i++) { o.position.set(0, -0.045 + i * 0.011, -0.02); o.updateMatrix(); fins.setMatrixAt(i, o.matrix); } fins.name = "controller:fins"; ctl.add(fins);
  hexBolts(ctl, "controller:bolts", [[-0.07, 0.048, -0.017], [0.07, 0.048, -0.017], [-0.07, -0.048, -0.017], [0.07, -0.048, -0.017]], 0.004, 0.005);
  const cab = new T.CatmullRomCurve3([new T.Vector3(hb[0] - 0.05, hb[1] - 0.1, -0.09), new T.Vector3(bb[0] + 0.05, bb[1] + 0.02, -0.08), new T.Vector3(ra[0] + 0.2, ra[1] + 0.06, -0.07), new T.Vector3(ra[0] + 0.03, ra[1] + 0.02, -0.07)]);
  mk(G, "emoto:motorCable", new T.TubeGeometry(cab, 40, 0.006, 8), std("emoto:cable", "#0b0b0b", { roughness: 0.8, metalness: 0 }));
  // box-section swingarm replaces the round stock arms
  fr?.children.filter((c) => c.geometry?.type === "CylinderGeometry" && [0.024, 0.025].includes(c.geometry.parameters.radiusTop)).forEach((c) => (c.visible = false));
  fr?.children.filter((c) => c.geometry?.type === "BoxGeometry" && Math.abs(c.geometry.parameters.width - 0.06) < 1e-4).forEach((c) => (c.visible = false));
  const piv = [bb[0] + 0.04, bb[1] + 0.12]; for (const s of [-1, 1]) { const dx = ra[0] - piv[0], dy = ra[1] - piv[1], L = Math.hypot(dx, dy); const arm = mk(G, "swingarm:" + (s < 0 ? "L" : "R"), bbox(L + 0.05, 0.055, 0.03, 0.012, 0.005), std("swingarm", "#1c1e21", { metalness: 0.7, roughness: 0.35 }));
    arm.position.set((piv[0] + ra[0]) / 2, (piv[1] + ra[1]) / 2, s * 0.075); arm.rotation.z = Math.atan2(dy, dx); }
  mk(G, "swingarm:pivot", new T.CylinderGeometry(0.014, 0.014, 0.19, 16), std("swingarm:pivot", "#b0b4b8", { metalness: 1 })).position.set(piv[0], piv[1], 0); G.children[G.children.length - 1].rotation.x = Math.PI / 2;
  hexBolts(G, "swingarm:axleBolts", [[ra[0], ra[1], 0.095], [ra[0], ra[1], -0.095], [piv[0], piv[1], 0.1], [piv[0], piv[1], -0.1]], 0.009, 0.01);
  // long flat seat (hides the stock round saddle)
  const sg = g("seat"); sg?.traverse((c) => { if (c.isMesh && c.geometry.type === "SphereGeometry") c.visible = false; });
  const seat = mk(G, "emoto:seat", bbox(0.62, 0.06, 0.2, 0.025, 0.012), phys("emoto:seat", "#1b1b1b", { roughness: 0.85, clearcoat: 0.1 })); seat.position.set(st[0] - 0.12, st[1] + 0.035, 0); seat.rotation.z = 0.03;
  // headlight + small number plate on the triple clamp
  const hl = new T.Group(); hl.name = "emoto:headlight"; hl.position.set(ht[0] + 0.07, ht[1] - 0.03, 0); G.add(hl);
  mk(hl, "headlight:housing", bbox(0.05, 0.11, 0.12, 0.02, 0.008), std("headlight:housing", "#151515", { metalness: 0.3 }));
  const lens = mk(hl, "headlight:lens", new T.CylinderGeometry(0.032, 0.032, 0.012, 24), std("headlight:lens", "#ffffff", { emissive: "#fff6d8", emissiveIntensity: 1.4, roughness: 0.05 })); lens.rotation.z = Math.PI / 2; lens.position.x = 0.028;
  const plate = mk(G, "emoto:numberPlate", bbox(0.012, 0.12, 0.16, 0.02, 0.003), phys("emoto:numberPlate", "#f2f2f2", { roughness: 0.5 })); plate.position.set(ht[0] + 0.06, ht[1] + 0.09, 0);
  hexBolts(G, "emoto:plateBolts", [[ht[0] + 0.068, ht[1] + 0.13, 0.05], [ht[0] + 0.068, ht[1] + 0.13, -0.05]], 0.004, 0.004, "y");
  // fork accent
  root.getObjectByName("wk:suspension")?.traverse((c) => { if (c.isMesh && /fork:lower/.test(c.name)) { c.material = c.material.clone(); c.material.color.set("#20c050"); } });
}
// LOD switcher (runs ~4x/s; cheap)
let lodTimer = 0;
export function startLOD() { if (lodTimer) return; lodTimer = setInterval(() => { const v = globalThis.__WK_VIEW__; if (!v?.camera) return; let root = null; v.scene.traverse((o) => { if (!root && o.children?.some((c) => c.name === "wk:frame")) root = o; }); if (!root) return;
  const p = new T.Vector3(); root.getWorldPosition(p); const near = v.controls?.target ? v.camera.position.distanceTo(v.controls.target) < LOD_NEAR : v.camera.position.distanceTo(p) < LOD_NEAR + 0.5;
  if (root.userData.lodNear === near) return; root.userData.lodNear = near; root.traverse((o) => { if (o.userData.lod === "hi") o.visible = near; }); globalThis.__WK_LOD__ = near ? "hi" : "lo"; }, 250); }
export function applyLODNow(root) { const near = root.userData.lodNear ?? false; root.traverse((o) => { if (o.userData.lod === "hi") o.visible = !!near; }); }
