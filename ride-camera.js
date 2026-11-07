// Side-view follow camera for the ride scene.
// Pure maths (no THREE, no DOM) so it can be unit-tested and reused by every level.
// All feel tunables live in SIDE_CAMERA; levels may pass overrides to createSideCamera().
export const SIDE_CAMERA = {
  gravity: 9.8,
  baseDist: 6.5,          // camera distance on flat ground / small hops (closer than before at speed)
  speedZoom: 0.09,        // extra metres per m/s of speed ...
  speedZoomMax: 2.2,      // ... capped here
  jumpZoom: 0.85,         // extra metres per metre of predicted height above the take-off ground
  jumpZoomMin: 0.7,       // ignore apexes lower than this (small hops keep the close framing)
  jumpZoomMax: 6,
  zoomOutRate: 2.4,       // 1/s – pulls back quickly when a big jump is predicted
  zoomInRate: 0.85,       // 1/s – eases back in slowly after landing
  leadTime: 0.15,         // look-ahead seconds of horizontal velocity
  leadMax: 3,
  leadBack: 0.8,
  followX: 7,             // spring natural frequency (rad/s), critically damped
  followY: 4.6,
  deadZone: 0.28,         // vertical dead zone (m) so tiny hops don't move the frame
  bobHz: 0.7, bobHzPerMs: 0.1, bobHzMax: 3.4,
  bobY: 0.028, bobX: 0.032, bobRoll: 0.0032,
  bobFullSpeed: 12,       // m/s at which bob reaches full amplitude
  bobFade: 7,             // 1/s grounded<->air fade
  landKick: 0.045, landKickMax: 0.3, landKickMinV: 2.5, kickOmega: 15, kickZeta: 0.38,
  teleport: 25,           // jumps further than this (respawn / level switch) snap instead of glide
  maxStep: 1 / 120,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createSideCamera(overrides = {}) {
  const C = { ...SIDE_CAMERA, ...overrides };
  let ready = false, lastX = 0, lastGround = false, lastVy = 0;
  let fx = 0, fxv = 0, fy = 0, fyv = 0, dist = C.baseDist, phase = 0, bobAmp = 0, kick = 0, kickV = 0, takeoffY = 0;
  const out = { x: 0, y: 0, dist: C.baseDist, bobX: 0, bobY: 0, roll: 0, targetDist: C.baseDist };

  const spring = (pos, vel, target, w, dt) => { // critically damped, semi-implicit sub-stepped
    const a = w * w * (target - pos) - 2 * w * vel; vel += a * dt; return [pos + vel * dt, vel];
  };

  function reset() { ready = false; }

  function update(dt, i) {
    // i: {x,y,vx,vy,speed,grounded,groundY, focus?:{x,y,speed,separation}, reduceMotion}
    dt = clamp(dt || 0, 0, 0.25);
    const f = i.focus, speed = f?.speed ?? i.speed ?? Math.hypot(i.vx || 0, i.vy || 0);
    const vx = i.vx || 0, vy = i.vy || 0;
    const tx = f?.x ?? i.x + clamp(vx * C.leadTime, -C.leadBack, C.leadMax);
    const ty = f?.y ?? i.y;

    if (!ready || Math.abs(i.x - lastX) > C.teleport) {
      ready = true; fx = tx; fy = ty; fxv = fyv = 0; kick = kickV = 0; bobAmp = 0; dist = C.baseDist; takeoffY = i.y;
    }
    lastX = i.x;

    // Distance target: close on the flat, opens up for a predicted high apex or a crash spread.
    const g = C.gravity, apex = vy > 0 ? i.y + vy * vy / (2 * g) : i.y;
    if (i.grounded) takeoffY = i.y;
    const rise = Math.max(0, apex - takeoffY - 0.1);
    const jump = rise < C.jumpZoomMin ? 0 : clamp((rise - C.jumpZoomMin) * C.jumpZoom + 0.6, 0, C.jumpZoomMax);
    let target = C.baseDist + Math.min(C.speedZoomMax, speed * C.speedZoom) + (i.grounded ? 0 : jump);
    if (f) target = 6.5 + Math.min(6, Math.max(speed * 0.35, (f.separation || 0) * 0.7));
    out.targetDist = target;
    const rate = target > dist ? C.zoomOutRate : C.zoomInRate;
    dist += (target - dist) * (1 - Math.exp(-rate * dt));

    // Landing impulse (downward kick on the frame).
    if (i.grounded && !lastGround && lastVy < -C.landKickMinV) kickV -= Math.min(C.landKickMax, (-lastVy - C.landKickMinV) * C.landKick) * C.kickOmega;
    lastGround = !!i.grounded; lastVy = vy;

    // Integrate springs in small fixed steps (frame-rate independent).
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(C.maxStep, left); left -= h;
      [fx, fxv] = spring(fx, fxv, tx, C.followX, h);
      let ey = ty - fy; const dz = f ? 0 : C.deadZone;
      ey = Math.abs(ey) < dz ? 0 : ey - Math.sign(ey) * dz;
      [fy, fyv] = spring(fy, fyv, fy + ey, C.followY, h);
      const a = -C.kickOmega * C.kickOmega * kick - 2 * C.kickZeta * C.kickOmega * kickV; kickV += a * h; kick += kickV * h;
    }

    // Natural bob while riding: speed-scaled, fades out in the air and for reduced-motion users.
    const want = i.grounded && !i.reduceMotion ? Math.min(1, speed / C.bobFullSpeed) : 0;
    bobAmp += (want - bobAmp) * (1 - Math.exp(-C.bobFade * dt));
    phase += dt * Math.PI * 2 * Math.min(C.bobHzMax, C.bobHz + speed * C.bobHzPerMs);
    if (phase > 1e6) phase -= 1e6;
    const k = i.reduceMotion ? 0 : 1;

    out.x = fx; out.y = fy; out.dist = dist;
    out.bobY = (Math.sin(phase) * C.bobY * bobAmp + kick) * k;
    out.bobX = Math.sin(phase * 0.5 + 1.3) * C.bobX * bobAmp * k;
    out.roll = Math.sin(phase * 0.5) * C.bobRoll * bobAmp * k;
    return out;
  }
  return { update, reset, config: C };
}
