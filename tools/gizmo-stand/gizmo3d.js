// Concept: 3D floor gizmo (curved rotate arrows on a ring round the base + 3D floor move arrows) and a
// raised bike workstand. Injected into the running game by proto.mjs; no game files are changed.
export function makeGizmo(T, radius) {
 const g = new T.Group(); g.name = 'concept:gizmo3d';
 const glow = (c, e = .9) => new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, metalness: .25, roughness: .32 });
 const dark = new T.MeshStandardMaterial({ color: '#0d1420', metalness: .4, roughness: .5, transparent: true, opacity: .78 });
 const flat = (shape, mat, depth = .022) => { const geo = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 3, curveSegments: 48 }); geo.rotateX(-Math.PI / 2); const m = new T.Mesh(geo, mat); m.castShadow = false; return m; };
 // base ring: dark glass track with a bright inner edge
 const ring = new T.Shape(); ring.absarc(0, 0, radius + .045, 0, Math.PI * 2, false); const hole = new T.Path(); hole.absarc(0, 0, radius - .045, 0, Math.PI * 2, true); ring.holes.push(hole);
 const base = flat(ring, dark, .012); base.position.y = .004; g.add(base);
 const edge = new T.Mesh(new T.TorusGeometry(radius - .045, .006, 8, 128), glow('#52e6ff', .5)); edge.rotation.x = Math.PI / 2; edge.position.y = .02; g.add(edge);
 // two opposed curved rotate arrows on the ring (front-left turns left, back-right turns right)
 const arc = (mid, span, dir) => { const a0 = mid - span / 2, a1 = mid + span / 2, ro = radius + .06, ri = radius - .06, s = new T.Shape();
  const P = (r, a) => [Math.cos(a) * r, Math.sin(a) * r]; const tip = dir > 0 ? a1 : a0, tail = dir > 0 ? a0 : a1, back = tip - dir * .0;
  s.moveTo(...P(ro, tail)); s.absarc(0, 0, ro, tail, back, dir < 0); s.lineTo(...P(ro + .05, back)); s.lineTo(...P(radius, tip + dir * .22)); s.lineTo(...P(ri - .05, back)); s.lineTo(...P(ri, back)); s.absarc(0, 0, ri, back, tail, dir > 0); s.closePath();
  return s; };
 const rotMat = glow('#1fb8e6', .38);
 for (const [mid, dir] of [[Math.PI * .78, 1], [-Math.PI * .22, 1]]) { const m = flat(arc(mid, 1.05, dir), rotMat, .03); m.position.y = .012; g.add(m); }
 // four 3D move arrows on the floor, outside the ring
 const mv = new T.Shape(), L = .17, sw = .032, hw = .085, hl = .11; mv.moveTo(0, -sw); mv.lineTo(L, -sw); mv.lineTo(L, -hw); mv.lineTo(L + hl, 0); mv.lineTo(L, hw); mv.lineTo(L, sw); mv.lineTo(0, sw); mv.closePath();
 const moveMat = glow('#2fd16a', .32);
 for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, m = flat(mv, moveMat, .03); m.rotation.y = a; m.position.set(Math.cos(a) * (radius + .1), .012, -Math.sin(a) * (radius + .1)); g.add(m); }
 g.traverse(o => { if (o.isMesh) o.renderOrder = 5; });
 return g;
}

export function makeWorkstand(T, { seat, groundY = 0, standZ = -.42 }) {
 // seat = world point to clamp (seat post just below the saddle). Mast stands behind the bike (non-drive side).
 const g = new T.Group(); g.name = 'concept:workstand';
 const steel = new T.MeshStandardMaterial({ color: '#2a2f3a', metalness: .75, roughness: .38 }), chrome = new T.MeshStandardMaterial({ color: '#c9d2dc', metalness: 1, roughness: .18 });
 const accent = new T.MeshStandardMaterial({ color: '#d8262f', metalness: .3, roughness: .35 }), rubber = new T.MeshStandardMaterial({ color: '#16181d', roughness: .85 });
 const tube = (r, a, b, mat) => { const d = new T.Vector3().subVectors(b, a), m = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 20), mat); m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()); g.add(m); return m; };
 const V = (x, y, z) => new T.Vector3(x, y, z), cx = seat.x - .05, top = seat.y + .04, hub = V(cx, groundY + .32, standZ);
 // tripod legs with rubber feet
 for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i * Math.PI * 2 / 3, foot = V(cx + Math.cos(a) * .46, groundY + .02, standZ - Math.sin(a) * .34);
  tube(.017, hub, foot, steel); const f = new T.Mesh(new T.CylinderGeometry(.03, .034, .03, 16), rubber); f.position.copy(foot).setY(groundY + .015); g.add(f); }
 // mast: lower steel tube, red quick-release collar, chrome upper tube
 const mid = V(cx, groundY + .82, standZ), mastTop = V(cx, top, standZ);
 tube(.026, V(cx, groundY + .25, standZ), mid, steel);
 const collar = new T.Mesh(new T.CylinderGeometry(.036, .036, .06, 24), accent); collar.position.copy(mid); g.add(collar);
 const lever = tube(.007, mid.clone().add(V(0, 0, .03)), mid.clone().add(V(.09, -.06, .05)), accent);
 tube(.019, mid, mastTop, chrome);
 // tool tray
 const tray = new T.Mesh(new T.CylinderGeometry(.16, .14, .03, 36), steel); tray.position.set(cx, groundY + .62, standZ - .02); g.add(tray);
 const rim = new T.Mesh(new T.TorusGeometry(.16, .008, 8, 48), accent); rim.rotation.x = Math.PI / 2; rim.position.set(cx, groundY + .64, standZ - .02); g.add(rim);
 // swivel head and arm to the seat post
 const head = new T.Mesh(new T.SphereGeometry(.04, 24, 16), accent); head.position.copy(mastTop); g.add(head);
 const jawAt = V(seat.x, seat.y, seat.z - .06); tube(.018, mastTop, jawAt, steel);
 // clamp jaws with red pads, closing on the seat post
 for (const s of [-1, 1]) { const j = new T.Mesh(new T.BoxGeometry(.05, .085, .03), accent); j.position.set(seat.x + s * .035, seat.y, seat.z - .012 + s * 0); g.add(j); }
 const screw = tube(.008, V(seat.x, seat.y - .06, seat.z - .07), V(seat.x, seat.y - .06, seat.z - .16), chrome);
 const knob = new T.Mesh(new T.CylinderGeometry(.03, .03, .025, 20), rubber); knob.rotation.x = Math.PI / 2; knob.position.set(seat.x, seat.y - .06, seat.z - .17); g.add(knob);
 g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
 return g;
}
