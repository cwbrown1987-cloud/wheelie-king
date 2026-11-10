// Placement collision for rooms: oriented boxes on the floor plane (XZ) + a height range.
// Pure functions (no THREE), so they are cheap and easy to test.
//  obb = { cx, cz, hx, hz, yaw, y0, y1, name? }   yaw follows THREE rotation.y
export function obbFrom(localBox, at, yaw = 0, name = '', roll = 0) {
 const lx = (localBox.min[0] + localBox.max[0]) / 2, ly = (localBox.min[1] + localBox.max[1]) / 2, lz = (localBox.min[2] + localBox.max[2]) / 2, c = Math.cos(yaw), s = Math.sin(yaw);
 let hx = (localBox.max[0] - localBox.min[0]) / 2, hy = (localBox.max[1] - localBox.min[1]) / 2, hz = (localBox.max[2] - localBox.min[2]) / 2;
 // 90° / 270° roll in the wall plane swaps the along-wall (X) and upright (Y) extents
 if (Math.abs(Math.sin(roll)) > .5) { const t = hx; hx = hy; hy = t; }
 return { cx: at[0] + lx * c + lz * s, cz: at[2] - lx * s + lz * c, hx, hz, yaw, y0: at[1] + ly - hy, y1: at[1] + ly + hy, name };
}
const axes = o => { const c = Math.cos(o.yaw), s = Math.sin(o.yaw); return [[c, -s], [s, c]]; }; // local X and Z in world XZ
export function corners(o) {
 const [ax, az] = axes(o), out = [];
 for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push([o.cx + ax[0] * o.hx * sx + az[0] * o.hz * sz, o.cz + ax[1] * o.hx * sx + az[1] * o.hz * sz]);
 return out;
}
/** Separating-axis test in XZ plus a vertical interval test. */
export function overlaps(a, b, eps = .004) {
 if (a.y1 <= b.y0 + eps || b.y1 <= a.y0 + eps) return false;
 const A = axes(a), B = axes(b), d = [b.cx - a.cx, b.cz - a.cz];
 for (const ax of [...A, ...B]) {
  const ra = a.hx * Math.abs(A[0][0] * ax[0] + A[0][1] * ax[1]) + a.hz * Math.abs(A[1][0] * ax[0] + A[1][1] * ax[1]);
  const rb = b.hx * Math.abs(B[0][0] * ax[0] + B[0][1] * ax[1]) + b.hz * Math.abs(B[1][0] * ax[0] + B[1][1] * ax[1]);
  if (Math.abs(d[0] * ax[0] + d[1] * ax[1]) >= ra + rb - eps) return false;
 }
 return true;
}
/** Convex room outline (array of [x,z]) -> inward half-planes {nx,nz,d}: inside when nx*x+nz*z >= d. */
export function halfPlanes(poly) {
 let area = 0; for (let i = 0; i < poly.length; i++) { const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length]; area += x0 * z1 - x1 * z0; }
 const sgn = area > 0 ? 1 : -1;
 return poly.map((p, i) => { const q = poly[(i + 1) % poly.length], ex = q[0] - p[0], ez = q[1] - p[1], len = Math.hypot(ex, ez); const nx = -ez / len * sgn, nz = ex / len * sgn; return { nx, nz, d: nx * p[0] + nz * p[1], wall: p.wall || i }; });
}
/** How far the box pokes through each wall (<= 0 means inside). */
export function wallPenetration(o, planes, margin = .01) {
 let worst = { depth: 0, plane: null };
 for (const pl of planes) for (const [x, z] of corners(o)) { const dpt = pl.d + margin - (pl.nx * x + pl.nz * z); if (dpt > worst.depth) worst = { depth: dpt, plane: pl }; }
 return worst;
}
/** Slide a box back inside the walls (used while dragging so walls feel solid). */
export function pushInside(o, planes, margin = .01) {
 for (let i = 0; i < 6; i++) { const w = wallPenetration(o, planes, margin); if (!w.plane) break; o.cx += w.plane.nx * (w.depth + 1e-4); o.cz += w.plane.nz * (w.depth + 1e-4); }
 return o;
}
/** Full validity check for a candidate placement. */
export function validate(o, { planes, ceil, colliders = [], zones = [], items = [], ignore = null }) {
 if (o.y0 < -.005) return { ok: false, reason: 'floor' };
 if (o.y1 > ceil - .01) return { ok: false, reason: 'ceiling' };
 if (wallPenetration(o, planes).plane) return { ok: false, reason: 'wall' };
 for (const z of zones) if (overlaps(o, z)) return { ok: false, reason: 'zone', hit: z.name };
 for (const c of colliders) if (overlaps(o, c)) return { ok: false, reason: 'prop', hit: c.name };
 for (const it of items) if (it.uid !== ignore && overlaps(o, it.obb)) return { ok: false, reason: 'item', hit: it.uid };
 return { ok: true };
}
