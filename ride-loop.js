// A single guided loop uses the same path for its road surface and bike motion.
// The regular terrain solver handles the approach and resumes on the flat exit.
const FULL_TURN = Math.PI * 2;
function point(loop, angle, inset = 0) {
  const radius = loop.radius - inset;
  return {
    x: loop.x + radius * Math.sin(angle) + loop.exitOffset * angle / FULL_TURN,
    y: loop.y + loop.radius - radius * Math.cos(angle),
    dx: radius * Math.cos(angle) + loop.exitOffset / FULL_TURN,
    dy: radius * Math.sin(angle),
  };
}

export function stepLoop(s, p, input, dt, loop) {
  if (!s.loopRide) {
    const crossing = s.x <= loop.x && s.x + s.vx * dt >= loop.x;
    if (!crossing || s.vx < loop.minSpeed || !s.ground.every(Boolean)) return false;
    s.loopRide = { angle: 0, entrySpeed: s.vx };
  }

  const ride = s.loopRide;
  const inset = Math.min(p.comH, loop.radius - .65);
  const before = point(loop, ride.angle, inset);
  const speed = Math.sqrt(Math.max(0, ride.entrySpeed ** 2 - 19.6 * (before.y - loop.y - inset)));
  ride.entrySpeed = Math.max(0, ride.entrySpeed - (input.brake || 0) * 4 * dt);
  if (speed < 1.5) {
    delete s.loopRide;
    s.crashed = 'NOT ENOUGH SPEED';
    s.events.push({ type: 'crash', why: s.crashed, part: 'suspension' });
    return true;
  }
  ride.angle = Math.min(FULL_TURN, ride.angle + speed * dt / Math.hypot(before.dx, before.dy));
  const next = point(loop, ride.angle, inset);
  const length = Math.hypot(next.dx, next.dy);
  s.x = next.x;
  s.y = next.y;
  s.pitch = Math.atan2(next.dy, next.dx);
  s.vx = speed * next.dx / length;
  s.vy = speed * next.dy / length;
  s.w = 0;
  s.odo += speed * dt;
  s.wheelSpin[0] += speed / p.R * dt;
  s.wheelSpin[1] += speed / p.R * dt;
  s.air = s.airRot = 0;
  s.wasAir = false;
  s.balance = '';
  s.comp = [0, 0];
  s.ground = [true, true];
  if (ride.angle === FULL_TURN) {
    delete s.loopRide;
    s.score += 350;
    s.events.push({ type: 'trick', t: 'LOOP CLEARED', pts: 350 });
  }
  return true;
}

export function makeLoopMesh(T, loop) {
  const vertices = [], indices = [], colors = [];
  const lanes = [-1.2, -1.1, 1.1, 1.2];
  for (let i = 0; i <= 96; i++) {
    const p = point(loop, FULL_TURN * i / 96);
    for (let j = 0; j < lanes.length; j++) {
      vertices.push(p.x, p.y + .025, lanes[j]);
      colors.push(...(j === 0 || j === 3 ? [.14, .8, .95] : [.18, .22, .29]));
      if (i && j) {
        const a = i * lanes.length + j;
        indices.push(a - 5, a - 4, a - 1, a - 1, a - 4, a);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({
    side: T.DoubleSide, vertexColors: true, roughness: .8,
  }));
  mesh.name = 'trials-loop';
  mesh.receiveShadow = true;
  return mesh;
}
