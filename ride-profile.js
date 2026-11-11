// Ride profile = base frame/platform data + whatever the fitted parts declare.
// Data-driven: a part may carry `kg`, `com` ([x, y] in bike-model metres) and a
// `ride` block. Any key in a ride block is combined by RULES (unknown keys
// override), so new parts never need code here. Parts with no ride block are
// cosmetic: they only add their mass (if any) at their anchor.
// Optional part fields (all data, no code):
//   attach: { seat|pegs|bars|rearHub|frontHub: [x, y], gripHalfWidth|pegHalfWidth: m }  rider/wheel attach points this part provides
//           (e.g. a future `pegs` slot part carries attach.pegs; the frame can carry seat/bars).
//   durability: number   reserved for part damage (later: tyre pops after long burnouts, bent rims).
//   damagedVisual: string|object  reserved: model/texture to show when damaged.
// durability/damagedVisual are passed through on profile.parts; nothing reads them in v2.0.
// The Jolt Playground reads the profile (ride-jolt.js); classic physics does not.

export const RIDER_KG = 75;

// How each ride key combines across parts. Anything not listed: last part wins.
export const RULES = {
  mass: 'sum',            // extra kg beyond `kg` (ballast, luggage)
  friction: 'multiply',   // tyre grip multiplier
  brakeTorque: 'multiply',// brake strength multiplier
  torque: 'add',          // wheel Nm added on top of the drivetrain
  power: 'add',           // W added
  topSpeed: 'max',        // m/s
};

// Legacy catalogue fields -> ride keys (existing Garage data keeps working as-is).
// Keyed on field names; `travel`/`damp` go to the axle the part sits on.
export function rideBlockOf(part, slot) {
  if (!part) return null;
  const out = {};
  const axle = /shock|rear/.test(slot || part.slot || '') ? 'rear' : /suspension|fork|front/.test(slot || part.slot || '') ? 'front' : null;
  if (axle && Number.isFinite(part.travel) && part.travel > 0) out[axle + 'Travel'] = part.travel;
  if (axle && Number.isFinite(part.damp)) out[axle + 'Damping'] = part.damp;
  if (Number.isFinite(part.grip)) out.friction = part.grip;
  if (part.ride && typeof part.ride === 'object') Object.assign(out, part.ride);
  return Object.keys(out).length ? out : null;
}

// Fallback mass anchors by slot keyword (bike-model coords from the garage anchors).
// A part's own `com` always wins; unknown slots sit at the bottom bracket.
const mid = (a, b) => a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : (a || b);
const ANCHORS = [
  [/seat/, A => A.seatTop],
  [/bars|grip|throttle|light|display/, A => A.headTop],
  [/battery|controller|fuel|tank|elec/, A => mid(A.bb, A.headTop)],
  [/suspension|fork|crown|fender_f|brake_f/, A => mid(A.frontAxle, A.headTop)],
  [/shock|swing/, A => mid(A.swingPivot || A.bb, A.seatTop)],
  [/tyre|rim|wheel/, A => mid(A.rearAxle, A.frontAxle)],
  [/frame/, A => mid(mid(A.rearAxle, A.headTop), mid(A.bb, A.seatTop))],
  [/sprocket_r|fender_r|rear/, A => A.rearAxle],
];
function anchorFor(slot, part, A) {
  if (Array.isArray(part.com) && part.com.length >= 2) return part.com;
  if (part.ride && Array.isArray(part.ride.com)) return part.ride.com;
  if (/motor/.test(slot)) return part.kind === 'front' ? A.frontAxle : part.kind === 'rear' ? A.rearAxle : A.bb;
  for (const [re, f] of ANCHORS) if (re.test(slot)) { const p = f(A); if (p) return p; }
  return A.bb || [0, (A.wheelR || 0.33) + 0.05];
}

function combine(acc, key, value) {
  if (key === 'com') return;
  const rule = RULES[key] || 'override';
  if (!(key in acc)) { acc[key] = value; return; }
  if (rule === 'sum' || rule === 'add') acc[key] += value;
  else if (rule === 'multiply') acc[key] *= value;
  else if (rule === 'max') acc[key] = Math.max(acc[key], value);
  else acc[key] = value;
}

// stats: garage stats (kg = whole-bike mass, nm/P/speed already include motor, battery,
// sprockets and kits). build: slot -> part id (or ids). find: id -> part. anchors: garage
// model anchors. base: platform numbers (wb, wheelR, comH, comBack, torque, power, vmax).
// Rider as a power source: sprint ~700 W; 110 rpm cadence on BMX 44/16 gearing (2.75).
export const HUMAN = Object.freeze({ sprintW: 700, cadenceRpm: 110, gearRatio: 44 / 16 });
export const pedalTopSpeed = (ratio, wheelR) => HUMAN.cadenceRpm / 60 * (ratio || HUMAN.gearRatio) * 2 * Math.PI * (wheelR || 0.254);
export function deriveRideProfile({ stats = {}, build = {}, find = () => null, anchors = {}, base = {}, forkAxis = null } = {}) {
  const A = { ...anchors };
  const R = A.wheelR || base.R || 0.33;
  A.rearAxle = A.rearAxle || [-(base.wb || 1.3) / 2, R];
  A.frontAxle = A.frontAxle || [(base.wb || 1.3) / 2, R];
  A.bb = A.bb || [0, R + 0.05];
  A.seatTop = A.seatTop || [-0.2, R + 0.5];
  A.headTop = A.headTop || [A.frontAxle[0] - 0.15, R + 0.55];
  const groundY = A.rearAxle[1] - R;

  const parts = [];
  for (const [slot, ids] of Object.entries(build || {})) {
    for (const id of [].concat(ids || [])) {
      if (id == null || typeof id === 'object') continue;
      const part = find(id);
      if (!part) continue;
      const ride = rideBlockOf(part, slot);
      const kg = Math.max(0, Number(part.kg) || 0) + Math.max(0, Number(ride?.mass) || 0);
      parts.push({ slot, id, kg, at: anchorFor(slot, part, A), ride, cosmetic: !ride, attach: part.attach || null,
        durability: part.durability ?? null, damagedVisual: part.damagedVisual ?? null });
    }
  }

  // Bare platform mass = garage total minus the parts we place individually; it and the
  // rider sit at the platform's own COM.
  const wb = A.frontAxle[0] - A.rearAxle[0];
  const partKg = parts.reduce((a, p) => a + p.kg, 0);
  const totalKg = Number.isFinite(stats.kg) ? stats.kg : partKg;
  const bareKg = Math.max(0, totalKg - partKg);
  const baseCom = [A.rearAxle[0] + wb * (base.comBack ?? 0.42), groundY + (base.comH ?? 0.95)];
  const riderAt = [A.seatTop[0], A.seatTop[1] + 0.25]; // seated rider COM ~0.25 m above the seat
  const masses = [{ kg: bareKg, at: baseCom }, { kg: RIDER_KG, at: riderAt }, ...parts.map(p => ({ kg: p.kg, at: p.at }))];
  const mass = masses.reduce((a, m) => a + m.kg, 0);
  const cx = masses.reduce((a, m) => a + m.kg * m.at[0], 0) / mass;
  const cy = masses.reduce((a, m) => a + m.kg * m.at[1], 0) / mass;

  const ride = {};
  for (const p of parts) if (p.ride) for (const [k, v] of Object.entries(p.ride)) if (k !== 'mass') combine(ride, k, v);

  const caster = Number.isFinite(ride.caster) ? ride.caster
    : (() => { // head angle from the modelled fork; ignore a vertical/odd axis
      if (!forkAxis || !(forkAxis[1] > 0.3)) return null;
      const c = Math.atan2(Math.abs(forkAxis[0]), forkAxis[1]);
      return c > 10 * Math.PI / 180 && c < 40 * Math.PI / 180 ? c : null;
    })();
  // Attach points (bike-model metres): model anchors, overridden by any fitted part's `attach`.
  // seat/pegs/bars/hubs are points [x, y]; *HalfWidth are lateral offsets (m). bars = the grips.
  const attach = { seat: A.seatTop, pegs: A.pegs || A.feet || A.bb, bars: A.hand || [A.headTop[0] - 0.04, A.headTop[1] + 0.2],
    rearHub: A.rearAxle, frontHub: A.frontAxle, gripHalfWidth: A.handWidth || 0.18, pegHalfWidth: 0.145, cranks: null };
  for (const p of parts) if (p.attach) for (const [k, v] of Object.entries(p.attach)) {
    if (Array.isArray(v) && v.length >= 2) attach[k] = v; else if (Number.isFinite(v)) attach[k] = v;
  }
  // Pedal bikes: feet go round the cranks centred on the pegs point (crank part length, default 0.14 m).
  const crank = parts.find(p => /crank/.test(p.slot));
  if (crank && !parts.some(p => p.slot === 'pegs')) attach.cranks = Number(find(crank.id)?.length) > 0.05 ? Number(find(crank.id).length) : 0.14;
  return {
    mass, comBack: (cx - A.rearAxle[0]) / wb, comH: cy - groundY,
    wheelbase: ride.wheelbase || wb, wheelR: ride.wheelR || R, caster,
    steerMax: ride.steerMax ?? null,
    front: { travel: ride.frontTravel ?? base.travelF ?? null, hz: ride.frontSpringHz ?? null, damping: ride.frontDamping ?? null },
    rear: { travel: ride.rearTravel ?? base.travelR ?? null, hz: ride.rearSpringHz ?? null, damping: ride.rearDamping ?? null },
    engine: {
      torque: (base.torque || 0) + (ride.torque || 0),
      // Pedal bikes: the rider is the motor. The shop 'speed' stat is cruising pace; a standing sprint
      // (what the throttle button is) is ~700 W, and top speed is the cadence limit of the gearing.
      power: (base.pedal ? Math.max(base.power || 0, HUMAN.sprintW) : (base.power || 0)) + (ride.power || 0),
      topSpeed: Math.max(base.vmax || 0, ride.topSpeed || 0, base.pedal ? pedalTopSpeed(ride.gearRatio, ride.wheelR || R) : 0) || null,
      driveAxle: ride.driveAxle || base.driveAxle || 'rear',
    },
    friction: ride.friction ?? 1,
    wheelInertia: ride.wheelInertia ?? null,
    brakeTorque: ride.brakeTorque ?? 1,
    attach,
    // Rider COM rise when standing on the pegs (standing hip ~1.0 m over the pegs vs seated ~0.25 m over the seat).
    standRise: Math.max(0.1, Math.min(0.5, (attach.pegs[1] + 1.0) - (attach.seat[1] + 0.25))),
    parts: parts.map(p => ({ slot: p.slot, id: p.id, kg: p.kg, cosmetic: p.cosmetic, keys: p.ride ? Object.keys(p.ride) : [], durability: p.durability, damagedVisual: p.damagedVisual })),
    extra: ride,
  };
}
