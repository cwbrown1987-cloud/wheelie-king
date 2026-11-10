// 3D floor gizmo for moving / rotating a selected room object (garage + workshop):
// a dark glass ring round the object's base, two opposed curved rotate arrows on the ring and
// four 3D move arrows on the floor outside it. Drawn in the world so it follows the camera.
// Meshes carry userData.gizmo = 'rotate' | 'move' for picking.
export const GIZMO_COLORS = { rotate: '#1fb8e6', move: '#2fd16a', edge: '#52e6ff', base: '#0d1420' };

export function makeGizmo(T, radius) {
 const g = new T.Group(); g.name = 'wk:gizmo3d'; g.userData.radius = radius;
 const glow = (c, e) => new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, metalness: .25, roughness: .32 });
 const dark = new T.MeshStandardMaterial({ color: GIZMO_COLORS.base, metalness: .4, roughness: .5, transparent: true, opacity: .78 });
 const flat = (shape, mat, depth, kind) => { const geo = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 3, curveSegments: 48 }); geo.rotateX(-Math.PI / 2); const m = new T.Mesh(geo, mat); m.userData.gizmo = kind; m.castShadow = false; m.receiveShadow = false; return m; };
 const ring = new T.Shape(); ring.absarc(0, 0, radius + .045, 0, Math.PI * 2, false); const hole = new T.Path(); hole.absarc(0, 0, radius - .045, 0, Math.PI * 2, true); ring.holes.push(hole);
 const base = flat(ring, dark, .012, 'rotate'); base.position.y = .004; g.add(base);
 const edge = new T.Mesh(new T.TorusGeometry(radius - .045, .006, 8, 128), glow(GIZMO_COLORS.edge, .5)); edge.rotation.x = Math.PI / 2; edge.position.y = .02; edge.userData.gizmo = 'rotate'; g.add(edge);
 // curved rotate arrow: band on the ring from tail to tip, arrowhead past the tip (shape angle a -> world (cos a, -sin a))
 const arc = (mid, span) => { const a0 = mid - span / 2, a1 = mid + span / 2, ro = radius + .06, ri = radius - .06, P = (r, a) => [Math.cos(a) * r, Math.sin(a) * r], s = new T.Shape();
  s.moveTo(...P(ro, a0)); s.absarc(0, 0, ro, a0, a1, false); s.lineTo(...P(ro + .05, a1)); s.lineTo(...P(radius, a1 + .22)); s.lineTo(...P(ri - .05, a1)); s.lineTo(...P(ri, a1)); s.absarc(0, 0, ri, a1, a0, true); s.closePath(); return s; };
 const rotMat = glow(GIZMO_COLORS.rotate, .38), moveMat = glow(GIZMO_COLORS.move, .32);
 for (const mid of [Math.PI * .78, -Math.PI * .22]) { const m = flat(arc(mid, 1.05), rotMat, .03, 'rotate'); m.position.y = .012; g.add(m); }
 const mv = new T.Shape(), L = .17, sw = .032, hw = .085, hl = .11; mv.moveTo(0, -sw); mv.lineTo(L, -sw); mv.lineTo(L, -hw); mv.lineTo(L + hl, 0); mv.lineTo(L, hw); mv.lineTo(L, sw); mv.lineTo(0, sw); mv.closePath();
 for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, m = flat(mv, moveMat, .03, 'move'); m.rotation.y = a; m.position.set(Math.cos(a) * (radius + .1), .012, -Math.sin(a) * (radius + .1)); g.add(m); }
 g.userData.dispose = () => { const mats = new Set(); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); mats.add(o.material); } }); for (const m of mats) m.dispose(); };
 return g;
}

/** Floor-plane hit test (generous for touch): 'rotate' on the ring band, 'move' on an arrow, else null. */
export function gizmoHitFloor(radius, dx, dz, tol) {
 const d = Math.hypot(dx, dz);
 if (Math.abs(d - radius) <= .06 + tol) return 'rotate';
 if (d > radius + .06 && d <= radius + .1 + .28 + tol) { const a = Math.atan2(-dz, dx), q = Math.round(a / (Math.PI / 2)) * Math.PI / 2; if (Math.abs(a - q) * d <= .09 + tol) return 'move'; }
 return null;
}
