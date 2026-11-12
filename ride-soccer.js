// Playground soccer (v2.1-13), Rocket League style: a big ball you push around with the bike and a goal.
// Score and the goal goes up in fireworks; the ball comes back to the centre spot a few seconds later.
// Our own simple ball physics on the playground heightfield (gravity, bounce, rolling friction, spin look).
export const SOCCER = {
  centre: { x: 62, z: -75 }, r: 0.9, halfLen: 42, halfWidth: 26,
  goal: { halfW: 6, h: 3.6, depth: 3 },
  restitution: 0.62, friction: 0.35, kick: 1.15, respawn: 3.5,
  // catch net behind each goal end (back + side wings), 7 m behind the goal mouth
  fence: { back: 10, halfW: 24, h: 9, wing: 10 },
};
// Two goals, one at each end of the pitch. dir = +1 means the goal opens toward -x (sits at the +x end).
export const GOALS = [
  { id: 'east', x: SOCCER.centre.x + SOCCER.halfLen, z: SOCCER.centre.z, dir: 1 },
  { id: 'west', x: SOCCER.centre.x - SOCCER.halfLen, z: SOCCER.centre.z, dir: -1 },
];
const G = { ...SOCCER.goal, ...GOALS[0] }; // kept for older callers (east goal)
// Goal frames for bike collisions (same shape as the playground tree posts).
export const GOAL_POSTS = GOALS.flatMap(g => [-1, 1].map(sd => ({ x: g.x, z: g.z + sd * SOCCER.goal.halfW, r: 0.12, kind: 'post', h: SOCCER.goal.h })));
function netTexture(T, cell = 16, line = 2, color = '#ffffff') {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64); g.strokeStyle = color; g.lineWidth = line;
  for (let i = 0; i <= 64; i += cell) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
}
function pitchTexture(T, L, W) {
  if (typeof document === 'undefined') return null;
  const px = 8, c = document.createElement('canvas'); c.width = Math.round(L * px); c.height = Math.round(W * px); const g = c.getContext('2d');
  // mowed stripes
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3f7d34' : '#4a8c3c'; g.fillRect(i * c.width / 12, 0, c.width / 12 + 1, c.height); }
  g.strokeStyle = '#f5f5f0'; g.lineWidth = 0.15 * px * 1.2; const m = 3 * px, X = v => m + v * px, Y = v => m + v * px, l = L - 6, w = W - 6;
  g.strokeRect(X(0), Y(0), l * px, w * px);                                      // touch + goal lines
  g.beginPath(); g.moveTo(X(l / 2), Y(0)); g.lineTo(X(l / 2), Y(w)); g.stroke();  // halfway
  g.beginPath(); g.arc(X(l / 2), Y(w / 2), 7.5 * px, 0, Math.PI * 2); g.stroke(); // centre circle
  g.fillStyle = '#f5f5f0'; g.beginPath(); g.arc(X(l / 2), Y(w / 2), 0.35 * px, 0, Math.PI * 2); g.fill();
  for (const end of [0, 1]) {
    const x0 = end ? X(l - 13) : X(0), x1 = end ? X(l - 4.5) : X(0);
    g.strokeRect(x0, Y(w / 2 - 15), 13 * px, 30 * px);                           // penalty box
    g.strokeRect(x1, Y(w / 2 - 8), 4.5 * px, 16 * px);                           // goal box
    g.beginPath(); g.arc(end ? X(l - 9) : X(9), Y(w / 2), 0.3 * px, 0, Math.PI * 2); g.fill(); // penalty spot
    g.beginPath(); g.arc(end ? X(l - 9) : X(9), Y(w / 2), 7.5 * px, end ? Math.PI * 0.62 : -Math.PI * 0.38, end ? Math.PI * 1.38 : Math.PI * 0.38); g.stroke(); // D
  }
  for (const [cx, cy] of [[0, 0], [l, 0], [0, w], [l, w]]) { g.beginPath(); g.arc(X(cx), Y(cy), 1 * px, 0, Math.PI * 2); g.stroke(); } // corner arcs
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
}

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
  // the pitch: striped grass with full markings, slightly raised so it sits over the playground floor
  const L = SOCCER.halfLen * 2 + 6, Wd = SOCCER.halfWidth * 2 + 6, ptex = pitchTexture(T, L, Wd); if (ptex) keep(ptex);
  const pitch = new T.Mesh(keep(new T.PlaneGeometry(L, Wd)), keep(new T.MeshStandardMaterial({ map: ptex, color: ptex ? 0xffffff : 0x4a8c3c, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(SOCCER.centre.x, 0.015, SOCCER.centre.z); pitch.receiveShadow = true; pitch.name = 'soccer:pitch'; root.add(pitch);
  const frameMat = keep(new T.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35, metalness: 0.2 }));
  const poleMat = keep(new T.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.6, metalness: 0.4 }));
  const post = (h, r = 0.12) => keep(new T.CylinderGeometry(r, r, h, 12));
  // real-looking net: a fine white mesh texture with see-through holes (alpha test), on both sides
  const ntex = netTexture(T); if (ntex) keep(ntex);
  const ftex = netTexture(T, 16, 2, '#1d2228'); if (ftex) keep(ftex);
  const netMesh = (w, h, mat, tex, cell) => { const m = mat.clone(); keep(m); if (tex) { m.map = tex.clone(); keep(m.map); m.map.repeat.set(w / cell, h / cell); m.map.needsUpdate = true; } return new T.Mesh(keep(new T.PlaneGeometry(w, h)), m); };
  const netMat = keep(new T.MeshStandardMaterial({ color: 0xffffff, transparent: !ntex, opacity: ntex ? 1 : 0.25, alphaTest: ntex ? 0.35 : 0, side: T.DoubleSide, roughness: 0.9, wireframe: !ntex }));
  const fenceMat = keep(new T.MeshStandardMaterial({ color: 0xffffff, transparent: !ftex, opacity: ftex ? 1 : 0.3, alphaTest: ftex ? 0.35 : 0, side: T.DoubleSide, roughness: 0.9, wireframe: !ftex }));
  const GG = SOCCER.goal, F = SOCCER.fence;
  for (const g of GOALS) {
    const goal = new T.Group(); goal.name = 'soccer:goal:' + g.id; goal.position.set(g.x, 0, g.z); goal.rotation.y = g.dir > 0 ? 0 : Math.PI; root.add(goal);
    for (const dz of [-GG.halfW, GG.halfW]) {
      const p = new T.Mesh(post(GG.h), frameMat); p.position.set(0, GG.h / 2, dz); p.castShadow = true; goal.add(p);
      const back = new T.Mesh(post(GG.h, 0.05), frameMat); back.position.set(GG.depth, GG.h / 2, dz); goal.add(back);
      const top = new T.Mesh(post(GG.depth, 0.05), frameMat); top.rotation.z = Math.PI / 2; top.position.set(GG.depth / 2, GG.h, dz); goal.add(top);
      const side = netMesh(GG.depth, GG.h, netMat, ntex, 0.12); side.position.set(GG.depth / 2, GG.h / 2, dz); goal.add(side);
    }
    const bar = new T.Mesh(post(GG.halfW * 2), frameMat); bar.rotation.x = Math.PI / 2; bar.position.set(0, GG.h, 0); bar.castShadow = true; goal.add(bar);
    const nb = netMesh(GG.halfW * 2, GG.h, netMat, ntex, 0.12); nb.rotation.y = Math.PI / 2; nb.position.set(GG.depth, GG.h / 2, 0); goal.add(nb);
    const nt = netMesh(GG.depth, GG.halfW * 2, netMat, ntex, 0.12); nt.rotation.x = -Math.PI / 2; nt.position.set(GG.depth / 2, GG.h, 0); goal.add(nt);
    // catch fence behind the goal end: dark sports netting on poles
    const fb = netMesh(F.halfW * 2, F.h, fenceMat, ftex, 0.25); fb.rotation.y = Math.PI / 2; fb.position.set(F.back, F.h / 2, 0); goal.add(fb);
    for (const sd of [-1, 1]) { const w = netMesh(F.wing, F.h, fenceMat, ftex, 0.25); w.position.set(F.back - F.wing / 2, F.h / 2, sd * F.halfW); goal.add(w);
      const pole = new T.Mesh(post(F.h, 0.08), poleMat); pole.position.set(F.back - F.wing, F.h / 2, sd * F.halfW); goal.add(pole); }
    for (let k = -3; k <= 3; k++) { const pole = new T.Mesh(post(F.h, 0.08), poleMat); pole.position.set(F.back, F.h / 2, k * F.halfW / 3); pole.castShadow = !lowDetail; goal.add(pole); }
  }

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
  const show = g => { for (let i = 0; i < 9; i++) rockets.push({ t: -i * 0.28, x: g.x - g.dir * 4 + Math.random() * 10 * g.dir, z: g.z + (Math.random() * 2 - 1) * (SOCCER.goal.halfW + 6), y: 0, vy: 22 + Math.random() * 6, hue: Math.random() }); };

  const b = { x: SOCCER.centre.x, y: 0, z: SOCCER.centre.z, vx: 0, vy: 0, vz: 0, scored: 0, goals: 0, touches: 0, score: { east: 0, west: 0 }, respawns: 0 };
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
      for (const g of GOALS) {
        // goal-local: u runs into the goal (0 = goal line), w across it
        const d = g.dir, GG = SOCCER.goal, F = SOCCER.fence;
        let u = (b.x - g.x) * d, w = b.z - g.z, vu = b.vx * d, vw = b.vz;
        if (u < -2 || u > F.back + R + 1) continue;
        if (b.y < F.h + R && Math.abs(w) < F.halfW && u > F.back - R) { u = F.back - R; vu = -Math.abs(vu) * 0.25; vw *= 0.6; }
        for (const sd of [-1, 1]) { const wz = sd * F.halfW; if (b.y < F.h + R && u > F.back - F.wing && u < F.back + R && Math.abs(w - wz) < R) { w = wz - sd * R; vw = -vw * 0.25; } }
        if (u > 0 && u < GG.depth + R && Math.abs(w) < GG.halfW + R && b.y < GG.h + R) {
          if (u > GG.depth - R) { u = GG.depth - R; vu = -Math.abs(vu) * 0.2; }
          if (u > 0.3) { if (w > GG.halfW - R) { w = GG.halfW - R; vw = -Math.abs(vw) * 0.2; } if (w < -GG.halfW + R) { w = -GG.halfW + R; vw = Math.abs(vw) * 0.2; } }
          if (b.y > GG.h - R && b.vy > 0 && u > 0.3) { b.vy = -Math.abs(b.vy) * 0.2; } // roof net
        }
        b.x = g.x + u * d; b.z = g.z + w; b.vx = vu * d; b.vz = vw;
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
    // goal? (either end)
    if (!b.scored) for (const g of GOALS) {
      const u = (b.x - g.x) * g.dir;
      if (u > R * 0.6 && u < SOCCER.goal.depth + 0.5 && Math.abs(b.z - g.z) < SOCCER.goal.halfW && b.y < SOCCER.goal.h) { b.scored = SOCCER.respawn; b.goals++; b.score[g.id]++; show(g); onGoal?.(b.goals, g.id); break; }
    }
    if (b.scored) { b.scored -= dt; if (b.scored <= 0) { b.scored = 0; reset(); } }
    // out of play: over/past a catch net, or well off the side of the pitch -> back to the centre spot
    const F = SOCCER.fence, along = Math.abs(b.x - SOCCER.centre.x), across = Math.abs(b.z - SOCCER.centre.z);
    if (!b.scored && (along > SOCCER.halfLen + F.back + 1 || across > SOCCER.halfWidth + 25 || b.y < -50)) { b.respawns++; reset(); }
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
    state: () => ({ ball: [b.x, b.y, b.z], v: [b.vx, b.vy, b.vz], goals: b.goals, score: { ...b.score }, respawns: b.respawns, touches: b.touches, celebrating: b.scored > 0, fireworks: sparks.visible }),
    dispose() { disposables.forEach(d => d.dispose?.()); root.removeFromParent(); },
  };
}
