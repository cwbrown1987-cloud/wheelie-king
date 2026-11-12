// Playground soccer (v2.1-13), Rocket League style: a big ball you push around with the bike and a goal.
// Score and the goal goes up in fireworks; the ball comes back to the centre spot a few seconds later.
// Our own simple ball physics on the playground heightfield (gravity, bounce, rolling friction, spin look).
export const SOCCER = {
  centre: { x: 62, z: -75 }, r: 0.9, goal: { x: 104, z: -75, halfW: 6, h: 3.6, depth: 3 },
  restitution: 0.62, friction: 0.35, kick: 1.15, respawn: 3.5,
};
const G = SOCCER.goal;
// Goal frame for bike collisions (same shape as the playground tree posts).
export const GOAL_POSTS = [
  { x: G.x, z: G.z - G.halfW, r: 0.12, kind: 'post', h: G.h },
  { x: G.x, z: G.z + G.halfW, r: 0.12, kind: 'post', h: G.h },
];

function ballTexture(T) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 512, 256);
  // equirect-ish panel pattern: dark pentagons on a grid, seams between
  g.fillStyle = '#16181c';
  const pent = (x, y, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; g.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r); } g.closePath(); g.fill(); };
  for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) pent(col * 85 + (row % 2 ? 42 : 0) + 20, row * 64 + 32, row === 0 || row === 3 ? 14 : 20);
  g.strokeStyle = '#9aa0a8'; g.lineWidth = 2;
  for (let x = 0; x < 512; x += 43) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 20, 256); g.stroke(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function makeSoccer(T, scene, ter, { lowDetail = false, onGoal } = {}) {
  const root = new T.Group(); root.name = 'wk:soccer'; scene.add(root);
  const disposables = [];
  const keep = o => (disposables.push(o), o);
  // ball
  const tex = ballTexture(T); if (tex) keep(tex);
  const ball = new T.Mesh(keep(new T.SphereGeometry(SOCCER.r, 32, 20)), keep(new T.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0 })));
  ball.castShadow = true; ball.name = 'soccer:ball'; root.add(ball);
  // pitch markings: centre circle + goal box, flat decals just above the ground
  const lineMat = keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  const ring = new T.Mesh(keep(new T.RingGeometry(7.6, 7.9, 64)), lineMat); ring.rotation.x = -Math.PI / 2; ring.position.set(SOCCER.centre.x, 0.02, SOCCER.centre.z); root.add(ring);
  const box = (w, d, x, z) => { const m = new T.Mesh(keep(new T.PlaneGeometry(w, d)), lineMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); root.add(m); };
  box(0.3, G.halfW * 2 + 8, G.x - 10, G.z); box(10, 0.3, G.x - 5, G.z - G.halfW - 4); box(10, 0.3, G.x - 5, G.z + G.halfW + 4); box(0.25, 60, G.x, G.z);
  // goal: white frame + translucent net
  const frameMat = keep(new T.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35, metalness: 0.2 }));
  const post = h => keep(new T.CylinderGeometry(0.12, 0.12, h, 12));
  for (const dz of [-G.halfW, G.halfW]) { const p = new T.Mesh(post(G.h), frameMat); p.position.set(G.x, G.h / 2, G.z + dz); p.castShadow = true; root.add(p);
    const back = new T.Mesh(post(G.h), frameMat); back.position.set(G.x + G.depth, G.h / 2, G.z + dz); root.add(back);
    const top = new T.Mesh(post(G.depth), frameMat); top.rotation.z = Math.PI / 2; top.position.set(G.x + G.depth / 2, G.h, G.z + dz); root.add(top); }
  const bar = new T.Mesh(post(G.halfW * 2), frameMat); bar.rotation.x = Math.PI / 2; bar.position.set(G.x, G.h, G.z); bar.castShadow = true; root.add(bar);
  const bar2 = new T.Mesh(post(G.halfW * 2), frameMat); bar2.rotation.x = Math.PI / 2; bar2.position.set(G.x + G.depth, G.h, G.z); root.add(bar2);
  const netMat = keep(new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false, wireframe: true }));
  const netBack = new T.Mesh(keep(new T.PlaneGeometry(G.halfW * 2, G.h, 24, 8)), netMat); netBack.rotation.y = Math.PI / 2; netBack.position.set(G.x + G.depth, G.h / 2, G.z); root.add(netBack);
  const netTop = new T.Mesh(keep(new T.PlaneGeometry(G.depth, G.halfW * 2, 6, 24)), netMat); netTop.rotation.x = -Math.PI / 2; netTop.position.set(G.x + G.depth / 2, G.h, G.z); root.add(netTop);
  for (const dz of [-G.halfW, G.halfW]) { const side = new T.Mesh(keep(new T.PlaneGeometry(G.depth, G.h, 6, 8)), netMat); side.position.set(G.x + G.depth / 2, G.h / 2, G.z + dz); root.add(side); }

  // fireworks: pooled particles
  const N = lowDetail ? 900 : 1800, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
  const pgeo = keep(new T.BufferGeometry()); pgeo.setAttribute('position', new T.BufferAttribute(pos, 3)); pgeo.setAttribute('color', new T.BufferAttribute(col, 3));
  const pmat = keep(new T.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
  const sparks = new T.Points(pgeo, pmat); sparks.frustumCulled = false; sparks.visible = false; root.add(sparks);
  let next = 0; const rockets = [];
  const burst = (x, y, z, hue) => {
    const c = new T.Color().setHSL(hue, 1, 0.6), n = lowDetail ? 110 : 220;
    for (let i = 0; i < n; i++) { const k = next; next = (next + 1) % N; const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 7 + Math.random() * 5;
      pos.set([x, y, z], k * 3); vel.set([Math.cos(a) * r * sp, u * sp, Math.sin(a) * r * sp], k * 3); col.set([c.r, c.g, c.b], k * 3); life[k] = 1.4 + Math.random() * 0.8; }
    sparks.visible = true;
  };
  const show = () => { for (let i = 0; i < 9; i++) rockets.push({ t: -i * 0.28, x: G.x - 4 + Math.random() * 10, z: G.z + (Math.random() * 2 - 1) * (G.halfW + 6), y: 0, vy: 22 + Math.random() * 6, hue: Math.random() }); };

  const b = { x: SOCCER.centre.x, y: 0, z: SOCCER.centre.z, vx: 0, vy: 0, vz: 0, scored: 0, goals: 0, touches: 0 };
  const reset = () => { b.x = SOCCER.centre.x; b.z = SOCCER.centre.z; b.y = ter.height(b.x, b.z) + SOCCER.r + 2; b.vx = b.vy = b.vz = 0; };
  reset();
  const q = new T.Quaternion(), axis = new T.Vector3();
  function step(dt, s, P) {
    if (!(dt > 0)) return;
    const n = Math.ceil(dt / (1 / 240)), h = dt / n, R = SOCCER.r;
    for (let i = 0; i < n; i++) {
      b.vy -= 9.8 * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      // ground (playground heightfield, normal from its gradient)
      const gy = ter.height(b.x, b.z);
      if (b.y - R < gy) {
        const e = 0.25, nx = -(ter.height(b.x + e, b.z) - ter.height(b.x - e, b.z)) / (2 * e), nz = -(ter.height(b.x, b.z + e) - ter.height(b.x, b.z - e)) / (2 * e), nl = Math.hypot(nx, 1, nz);
        const Nx = nx / nl, Ny = 1 / nl, Nz = nz / nl, vn = b.vx * Nx + b.vy * Ny + b.vz * Nz;
        b.y = gy + R;
        if (vn < 0) { const j = -(1 + (Math.abs(vn) > 1.2 ? SOCCER.restitution : 0)) * vn; b.vx += j * Nx; b.vy += j * Ny; b.vz += j * Nz; }
        const f = Math.max(0, 1 - SOCCER.friction * h); b.vx *= f; b.vz *= f;
        b.vx += Nx * 9.8 * h; b.vz += Nz * 9.8 * h; // rolls down slopes
      }
      // goal frame: posts and crossbar bounce the ball
      for (const p of GOAL_POSTS) { const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz); if (d < R + p.r && b.y < p.h + R) { const nx = dx / (d || 1), nz = dz / (d || 1), vn = b.vx * nx + b.vz * nz; b.x = p.x + nx * (R + p.r); b.z = p.z + nz * (R + p.r); if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; } } }
      // net: inside the goal the back and sides catch the ball
      if (b.x > G.x && b.x < G.x + G.depth + R && Math.abs(b.z - G.z) < G.halfW + R && b.y < G.h + R) {
        if (b.x > G.x + G.depth - R) { b.x = G.x + G.depth - R; b.vx = -Math.abs(b.vx) * 0.2; }
        if (b.x > G.x + 0.3) { if (b.z > G.z + G.halfW - R) { b.z = G.z + G.halfW - R; b.vz = -Math.abs(b.vz) * 0.2; } if (b.z < G.z - G.halfW + R) { b.z = G.z - G.halfW + R; b.vz = Math.abs(b.vz) * 0.2; } }
      }
    }
    // the bike: a sphere at the rider's hips and one at the front wheel push the ball (bike barely notices)
    if (s && !s.crashed) {
      const yaw = s.yaw || 0, c = Math.cos(yaw), sn = Math.sin(yaw), my = s.sliding && s.moveYaw != null ? s.moveYaw : yaw;
      const bvx = (s.vx || 0) * Math.cos(my), bvz = (s.vx || 0) * Math.sin(my), bvy = s.vy || 0;
      const fw = (P?.wb || 1.2) * 0.6;
      for (const [ox, oy, rad] of [[fw, -0.45, 0.45], [0, 0.1, 0.55], [-fw, -0.45, 0.45]]) {
        const px = s.x + c * ox, pz = (s.z || 0) + sn * ox, py = s.y + oy, dx = b.x - px, dy = b.y - py, dz = b.z - pz, d = Math.hypot(dx, dy, dz), min = R + rad;
        if (d < min && d > 1e-6) {
          const nx = dx / d, ny = dy / d, nz = dz / d; b.x = px + nx * min; b.y = Math.max(b.y, py + ny * min); b.z = pz + nz * min;
          const rv = (b.vx - bvx) * nx + (b.vy - bvy) * ny + (b.vz - bvz) * nz;
          if (rv < 0) { const j = -(1 + 0.75) * rv * SOCCER.kick; b.vx += j * nx; b.vy += j * Math.max(ny, 0.25) + 0.6; b.vz += j * nz; b.touches++; s.vx *= 0.97; }
        }
      }
    }
    // goal?
    if (!b.scored && b.x > G.x + R * 0.6 && Math.abs(b.z - G.z) < G.halfW && b.y < G.h) {
      b.scored = SOCCER.respawn; b.goals++; show(); onGoal?.(b.goals);
    }
    if (b.scored) { b.scored -= dt; if (b.scored <= 0) { b.scored = 0; reset(); } }
    if (Math.hypot(b.x - SOCCER.centre.x, b.z - SOCCER.centre.z) > 400 || b.y < -50) reset();
    // visual: position + rolling spin
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.01) { axis.set(b.vz, 0, -b.vx).normalize(); q.setFromAxisAngle(axis, sp * dt / R); ball.quaternion.premultiply(q); }
    ball.position.set(b.x, b.y, b.z);
    // fireworks
    for (let i = rockets.length - 1; i >= 0; i--) { const r = rockets[i]; r.t += dt; if (r.t < 0) continue; r.vy -= 9.8 * dt; r.y += r.vy * dt; if (r.vy < 2) { burst(r.x, ter.height(r.x, r.z) + r.y, r.z, r.hue); rockets.splice(i, 1); } }
    if (sparks.visible) {
      let alive = 0;
      for (let k = 0; k < N; k++) { if (life[k] <= 0) continue; life[k] -= dt; alive++; const o = k * 3; vel[o + 1] -= 6 * dt; vel[o] *= 0.985; vel[o + 1] *= 0.985; vel[o + 2] *= 0.985; pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt; if (life[k] <= 0) pos[o + 1] = -999; const fade = Math.max(0, Math.min(1, life[k])); col[o] *= 0.995 + 0.005 * fade; }
      pgeo.attributes.position.needsUpdate = true; pgeo.attributes.color.needsUpdate = true; if (!alive && !rockets.length) sparks.visible = false;
    }
  }
  return {
    step, reset,
    _ball: b,
    state: () => ({ ball: [b.x, b.y, b.z], v: [b.vx, b.vy, b.vz], goals: b.goals, touches: b.touches, celebrating: b.scored > 0, fireworks: sparks.visible }),
    dispose() { disposables.forEach(d => d.dispose?.()); root.removeFromParent(); },
  };
}
