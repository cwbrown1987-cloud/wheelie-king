// Playground physics: a port of Jolt's own Samples/Tests/Vehicle/MotorcycleTest.cpp
// (settings, controller usage and ProcessInput logic kept as in the sample).
// Patches are marked "PATCH" with the reason. Ground: flat floor + ramp MeshShapes + terrain HeightFieldShape.
import initJolt from './vendor/jolt/jolt-physics.wasm.js';
import { PLAYGROUND_RAMPS, rampTriangles, TERRAIN, terrainHeight, playgroundHeight } from './ride-playground.js';

const LAYER_NON_MOVING = 0, LAYER_MOVING = 1, NUM_OBJECT_LAYERS = 2;
const DEG = Math.PI / 180;
// Collision steps per 1/60 s (the Samples app's "collision steps" setting). With one step the
// lean controller goes unstable once the COM sits near the body origin (a rider on a light
// bike); 4 keeps it stable for every profile tested at ~0.5 ms per frame.
const COLLISION_STEPS = 4;
const REVERSE_INPUT = 0.3, REVERSE_MAX = 7 / 3.6; // PATCH values, see processInput

// MotorcycleTest.cpp values, unchanged.
export const MOTO_SAMPLE = Object.freeze({
  backWheelRadius: 0.31, backWheelWidth: 0.05, backWheelPosZ: -0.75,
  backSuspMin: 0.3, backSuspMax: 0.5, backSuspFreq: 2.0, backBrakeTorque: 250,
  frontWheelRadius: 0.31, frontWheelWidth: 0.05, frontWheelPosZ: 0.75,
  frontSuspMin: 0.3, frontSuspMax: 0.5, frontSuspFreq: 1.5, frontBrakeTorque: 500,
  halfLength: 0.4, halfWidth: 0.2, halfHeight: 0.3,
  maxSteer: 30 * DEG, caster: 30 * DEG, mass: 240, maxPitchRoll: 60 * DEG,
  engineMaxTorque: 150, engineMinRPM: 1000, engineMaxRPM: 10000,
  shiftDownRPM: 2000, shiftUpRPM: 8000,
  gearRatios: [2.27, 1.63, 1.3, 1.09, 0.96, 0.88], reverseGearRatios: [-4.0],
  clutchStrength: 2.0, differentialRatio: 1.93 * 40 / 16,
  steerSpeed: 4.0, enableLeanController: true,
});


// Jolt settings from a ride profile (ride-profile.js). With no profile this returns the
// MotorcycleTest values unchanged (wheel positions/radius still follow the garage bike).
const sagOf = hz => 9.81 / Math.pow(2 * Math.PI * hz, 2);
export function joltSettingsFrom(profile, P) {
  const S = MOTO_SAMPLE;
  const pr = profile || {};
  const wheelR = pr.wheelR || P?.R || S.backWheelRadius;
  const wb = pr.wheelbase || P?.wb || 1.5, comBack = pr.comBack ?? P?.comBack ?? 0.5;
  const axle = (w, minL, maxL, hz0) => {
    // Rigid (travel 0 in part data, e.g. a stock BMX fork, or no shock): the tyre is the only
    // compliance, ~3 cm. Unknown (no data) keeps the sample stroke.
    const travel = w?.travel > 0.02 ? w.travel : (profile && Number.isFinite(w?.travel) ? 0.03 : maxL - minL);
    // Spring rate rule: the sample's Hz is for its 0.2 m stroke; a shorter stroke needs a
    // proportionally stiffer spring for the same sag ratio (Hz ~ 1/sqrt(travel)).
    const hz = w?.hz > 0 ? w.hz : (profile ? Math.max(1, Math.min(4, hz0 * Math.sqrt((S.backSuspMax - S.backSuspMin) / travel))) : hz0);
    return { min: minL, max: minL + travel, travel, hz, hzFromData: w?.hz > 0, damping: w?.damping ?? null };
  };
  const front = axle(pr.front, S.frontSuspMin, S.frontSuspMax, S.frontSuspFreq);
  const rear = axle(pr.rear, S.backSuspMin, S.backSuspMax, S.backSuspFreq);
  const mass = pr.mass || S.mass;
  // COM height: body origin rests at 0.9*halfHeight + (rear max - sag) + R above ground.
  const originH = 0.9 * S.halfHeight + (rear.max - sagOf(rear.hz)) + wheelR;
  const comOffsetY = profile && pr.comH ? pr.comH - originH : -S.halfHeight;
  const brakeScale = profile ? (mass / S.mass) * (pr.brakeTorque || 1) : 1;
  let engine, engineLaunchCap = 1;
  const e = pr.engine || {};
  if (profile && e.torque > 0 && e.topSpeed > 0) {
    // Single fixed reduction: motor spins to MOTOR_RPM at the part's top speed (keeps Jolt's
    // clutch in the rpm range it is built for); wheel torque = part torque. The power limit
    // is the normalized torque curve, and torque drops to 0 at max RPM (= top speed).
    const MOTOR_RPM = 8000;
    const wheelRPM = e.topSpeed / wheelR * 60 / (2 * Math.PI), ratio = MOTOR_RPM / wheelRPM;
    const curve = [];
    for (let i = 0; i <= 10; i++) {
      const x = i / 10, omegaW = Math.max(1e-3, x * wheelRPM * 2 * Math.PI / 60);
      curve.push([x, e.power > 0 ? Math.min(1, e.power / (e.torque * omegaW)) : 1]);
    }
    curve.push([0.97, curve[curve.length - 1][1]]); curve[curve.length - 2][1] = curve[curve.length - 1][1];
    // Launch map (motor controller current limit): never more drive torque than lifts the front at
    // 85 % of its static load, so a big e-moto doesn't loop out or spin up from a standstill on full
    // throttle. Wheelies need the rider (weight back / clutch-up pop), as on a real bike.
    const liftFull = (e.torque / wheelR) * (pr.comH || 0.9) / (wb * mass * 9.81 * Math.max(0.15, comBack));
    const launchCap = Math.min(1, 0.85 / Math.max(1e-6, liftFull));
    for (const pt of curve) pt[1] = Math.min(pt[1], launchCap);
    engineLaunchCap = launchCap;
    curve.splice(curve.length - 2, 1); curve.push([1, 0]); // governor: torque fades to 0 over the last 3 % to the part's top speed
    // Rotor inertia as seen at the wheel = inertia x ratio^2. Fix that at 0.02 kg·m² (a light flywheel)
    // so a 43:1 pedal-bike reduction doesn't add ~140 kg of effective mass (v2.0 QA: stock BMX crawled).
    engine = { inertia: 0.02 / (ratio * ratio), maxTorque: e.torque / ratio, minRPM: MOTOR_RPM * 0.02, maxRPM: MOTOR_RPM, curve, gears: [1], reverse: [-1], diff: ratio, shiftUpRPM: MOTOR_RPM * 2, shiftDownRPM: 0 };
  } else {
    engine = { maxTorque: S.engineMaxTorque, minRPM: S.engineMinRPM, maxRPM: S.engineMaxRPM, curve: null, gears: S.gearRatios, reverse: S.reverseGearRatios, diff: S.differentialRatio, shiftUpRPM: S.shiftUpRPM, shiftDownRPM: S.shiftDownRPM };
  }
  return {
    mass, wheelR, wb, comBack, comH: pr.comH ?? P?.comH ?? 0.9, comOffsetY, originH,
    rearZ: -wb * comBack, frontZ: wb * (1 - comBack),
    caster: pr.caster ?? S.caster, steerMax: pr.steerMax ?? S.maxSteer,
    front, rear, friction: pr.friction || 1,
    frontBrake: S.frontBrakeTorque * brakeScale, rearBrake: S.backBrakeTorque * brakeScale,
    launchCap: engineLaunchCap, engine, driveFront: e.driveAxle === 'front',
    leanScale: profile ? mass / S.mass : 1,
    // How far full drive alone goes to lifting the front (weight transfer / static front load).
    // The wheelie pop (rider yanking the bars) makes up the deficit, so a strong e-moto gets
    // none and a 250 W BMX gets most of it.
    liftRatio: profile && e.torque > 0 ? Math.min(0.85, (e.torque / wheelR) * (pr.comH || 0.9) / (wb * mass * 9.81 * Math.max(0.15, comBack))) : 1,
    // Wheel inertia (kg·m²): part data `wheelInertia`, else ~8% of the bike's own mass at the rim radius
    // (e-moto ~0.5, BMX ~0.1). Jolt's 0.9 default is a car wheel: on a BMX it adds ~28 kg of spin mass.
    wheelInertia: profile ? (pr.wheelInertia ?? Math.max(0.04, 0.08 * Math.max(5, mass - 75) * wheelR * wheelR)) : null,
  };
}

function setupCollisionFiltering(Jolt, settings) {
  const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
  objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
  objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);
  const BP_NON = new Jolt.BroadPhaseLayer(0), BP_MOV = new Jolt.BroadPhaseLayer(1);
  const bp = new Jolt.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, 2);
  bp.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, BP_NON);
  bp.MapObjectToBroadPhaseLayer(LAYER_MOVING, BP_MOV);
  settings.mObjectLayerPairFilter = objectFilter;
  settings.mBroadPhaseLayerInterface = bp;
  settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(bp, 2, objectFilter, NUM_OBJECT_LAYERS);
}

// Game heading: yaw 0 = +X. Jolt's vehicle faces +Z (sample default), converted only here.
function bodyAxes(qx, qy, qz, qw) {
  return {
    right: { x: 1 - 2 * (qy * qy + qz * qz), y: 2 * (qx * qy + qw * qz), z: 2 * (qx * qz - qw * qy) },
    up: { x: 2 * (qx * qy - qw * qz), y: 1 - 2 * (qx * qx + qz * qz), z: 2 * (qy * qz + qw * qx) },
    fwd: { x: 2 * (qx * qz + qw * qy), y: 2 * (qy * qz - qw * qx), z: 1 - 2 * (qx * qx + qy * qy) },
  };
}
function quatFromYaw(Jolt, yaw) {
  const h = (Math.PI / 2 - yaw) / 2;
  return new Jolt.Quat(0, Math.sin(h), 0, Math.cos(h));
}
const yawOf = a => Math.atan2(a.fwd.z, a.fwd.x);

export function createJoltRide({ P, profile = null }) {
  const S = MOTO_SAMPLE;
  const api = { ready: false, enabled: true, error: null, air: false, forward: 'z' };
  let Jolt, jolt, physicsSystem, bodyInterface, body, constraint, controller, floorBody;
  // ProcessInput state, as in the sample.
  let mForward = 0, mPreviousForward = 1, mRight = 0, mBrake = 0;
  // Rider actions (Project Wheelie style). The rider is not a physics body, so a weight shift
  // is applied as the pitch torque of the rider's weight moving fore/aft over the bike.
  let stoppieLean = 0, airT = 0, footDown = false, brkWas = false, brkUpT = 9, revArmed = false, leanPrev = 0, wheelSet = null, monoOn = false, stoppieOn = false, prevPitch = null, monoKick = 0, standOn = false, shapes = null, latScaleNow = 1, handBrake = 0, mode = 'ride';
  const RIDER_KG = 75, G = 9.81;
  let rideLift = 0, wheelR = S.backWheelRadius, destroyed = false;
  const scratch = {};

  async function start() {
    if (api.ready || destroyed) return api;
    try {
      Jolt = await initJolt();
      if (destroyed) return api;
      const settings = new Jolt.JoltSettings();
      setupCollisionFiltering(Jolt, settings);
      jolt = new Jolt.JoltInterface(settings);
      Jolt.destroy(settings);
      physicsSystem = jolt.GetPhysicsSystem();
      bodyInterface = physicsSystem.GetBodyInterface();

      // Flat floor, like the sample's VehicleTest "Flat" terrain.
      const fs = new Jolt.BodyCreationSettings(new Jolt.BoxShape(new Jolt.Vec3(2000, 1, 2000)), new Jolt.RVec3(0, -1, 0), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Static, LAYER_NON_MOVING);
      // PATCH (road grip): Jolt combines tyre and ground friction as sqrt(tyre x body). The floor kept
      // Jolt's 0.2 body default, capping grip at ~0.5 g (weak brakes, launch wheelspin, no stoppie,
      // shallow lean). Dry asphalt: 1.0.
      if (profile) fs.mFriction = globalThis.__WK_TUNE__?.ground ?? 1.0; // sample (no profile) stays verbatim
      floorBody = bodyInterface.CreateBody(fs);
      bodyInterface.AddBody(floorBody.GetID(), Jolt.EActivation_DontActivate);
      Jolt.destroy(fs);
      // Playground jumps (ride-playground.js): static MeshShapes from the same triangles as the drawn
      // ramps (a curved kicker transition is concave, so a convex hull would flatten it).
      const addStatic = (shape, x, z) => {
        const rb = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(x, 0, z), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Static, LAYER_NON_MOVING);
        rb.mFriction = 1.0;
        const b = bodyInterface.CreateBody(rb); bodyInterface.AddBody(b.GetID(), Jolt.EActivation_DontActivate); Jolt.destroy(rb);
      };
      if (profile) for (const r of PLAYGROUND_RAMPS) {
        const tl = new Jolt.TriangleList(), tris = rampTriangles(r).filter(([a, b, c]) => {
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) > 1e-6;
        });
        tl.resize(tris.length);
        tris.forEach((t, i) => { const tri = tl.at(i); for (let k = 0; k < 3; k++) tri.set_mV(k, new Jolt.Float3(t[k][0] - r.x, t[k][1], t[k][2] - r.z)); });
        const ms = new Jolt.MeshShapeSettings(tl, new Jolt.PhysicsMaterialList());
        const res = ms.Create(); if (res.HasError()) throw new Error('ramp mesh: ' + res.GetError().c_str());
        addStatic(res.Get(), r.x, r.z); Jolt.destroy(tl);
      }
      // Uneven terrain lane: Jolt HeightFieldShape sampled from terrainHeight (0.5 m cells). Samples
      // outside the lane are holes (cNoCollisionValue), so the flat floor carries the rest.
      if (profile) {
        const N = 320, CELL = 0.5, ox = TERRAIN.x0 - 2, oz = TERRAIN.z - N * CELL / 2;
        const hs = new Jolt.HeightFieldShapeSettings();
        hs.mOffset = new Jolt.Vec3(0, 0, 0); hs.mScale = new Jolt.Vec3(CELL, 1, CELL);
        hs.mSampleCount = N; hs.mBlockSize = 4;
        const hole = 3.4028234663852886e38; // HeightFieldShapeConstants::cNoCollisionValue (FLT_MAX)
        const reach = TERRAIN.core + TERRAIN.bank + 1;
        const hsamp = hs.mHeightSamples; hsamp.reserve(N * N);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const x = ox + i * CELL, z = oz + j * CELL, u = x - TERRAIN.x0;
          hsamp.push_back( Math.abs(z - TERRAIN.z) > reach || u < -1.5 || u > TERRAIN.len + 1.5 ? hole : terrainHeight(x, z));
        }
        const res = hs.Create(); if (res.HasError()) throw new Error('terrain heightfield: ' + res.GetError().c_str());
        addStatic(res.Get(), ox, oz); api.terrain = { shape: 'HeightFieldShape', samples: N, cell: CELL, x: ox, z: oz };
      }

      const C = joltSettingsFrom(profile, P);
      api.settings = C;
      wheelR = C.wheelR;
      const shape = new Jolt.OffsetCenterOfMassShapeSettings(new Jolt.Vec3(0, C.comOffsetY, 0),
        new Jolt.BoxShapeSettings(new Jolt.Vec3(S.halfWidth, S.halfHeight, S.halfLength))).Create().Get();
      const bs = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(0, C.originH + 0.02, 0), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Dynamic, LAYER_MOVING);
      bs.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      bs.mMassPropertiesOverride.mMass = C.mass;
      body = bodyInterface.CreateBody(bs);
      // Stand on the pegs: the rider's 75 kg rises ~0.3 m, so the COM rises 75*0.3/mass.
      const standLift = RIDER_KG * (profile?.standRise ?? 0.3) / C.mass; // rider rise from the seat/pegs attach data
      shapes = { sit: shape, stand: new Jolt.OffsetCenterOfMassShapeSettings(new Jolt.Vec3(0, C.comOffsetY + standLift, 0),
        new Jolt.BoxShapeSettings(new Jolt.Vec3(S.halfWidth, S.halfHeight, S.halfLength))).Create().Get(), standLift };
      bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
      Jolt.destroy(bs);

      const vehicle = new Jolt.VehicleConstraintSettings();
      // PATCH (wheelie): the sample's 60° pitch/roll stop would hold a wheelie up forever and
      // makes a loop-out impossible. 88° keeps the constraint but lets the bike go past balance.
      vehicle.mMaxPitchRollAngle = profile ? 88 * DEG : S.maxPitchRoll;
      vehicle.mWheels.clear();
      const scaleCurve = (curve, pts) => { curve.Clear(); for (const [x, y] of pts) curve.AddPoint(x, y * C.friction); };
      const makeWheel = (w, z, steer, brake) => {
        const ws = new Jolt.WheelSettingsWV();
        ws.mPosition = new Jolt.Vec3(0, -0.9 * S.halfHeight, z);
        ws.mMaxSteerAngle = steer;
        if (steer) {
          ws.mSuspensionDirection = new Jolt.Vec3(0, -1, Math.tan(C.caster)).Normalized();
          ws.mSteeringAxis = new Jolt.Vec3(0, 1, -Math.tan(C.caster)).Normalized(); // = -suspension direction
        }
        ws.mRadius = C.wheelR;
        if (C.wheelInertia) ws.mInertia = C.wheelInertia;
        ws.mWidth = S.frontWheelWidth;
        ws.mSuspensionMinLength = w.min;
        ws.mSuspensionMaxLength = w.max;
        ws.mSuspensionSpring.mFrequency = w.hz;
        if (w.damping != null) ws.mSuspensionSpring.mDamping = w.damping;
        ws.mMaxBrakeTorque = brake;
        if (profile) {
          // Jolt's default longitudinal curve stays at 1.0 once the tyre slides. A real tyre loses grip as
          // slip grows (spinning/locked rubber ~0.55-0.8 of peak), which is what lets a burnout spin in
          // place against a braked front and a locked rear slide. Peak/onset kept as Jolt's defaults.
          scaleCurve(ws.mLongitudinalFriction, [[0, 0], [0.06, 1.2], [0.2, 1.0], [1, globalThis.__WK_TUNE__?.l1 ?? 0.8], [3, globalThis.__WK_TUNE__?.l3 ?? 0.55]]);
          scaleCurve(ws.mLateralFriction, [[0, 0], [3, 1.2], [20, 1.0]]);
        }
        ws.mMaxHandBrakeTorque = 0; // set live by the burnout/drift patch
        vehicle.mWheels.push_back(ws);
        return ws;
      };
      wheelSet = [makeWheel(C.front, C.frontZ, C.steerMax, C.frontBrake), makeWheel(C.rear, C.rearZ, 0, C.rearBrake)];

      const cs = new Jolt.MotorcycleControllerSettings();
      cs.mEngine.mMaxTorque = C.engine.maxTorque;
      cs.mEngine.mMinRPM = C.engine.minRPM;
      cs.mEngine.mMaxRPM = C.engine.maxRPM;
      // An e-motor rotor is ~0.005 kg·m²; Jolt's 0.5 default seen through a 12:1 reduction adds
      // hundreds of kg of effective mass (and its damping eats the torque).
      if (C.engine.inertia) { cs.mEngine.mInertia = C.engine.inertia; cs.mEngine.mAngularDamping = 0.02; }
      if (C.engine.curve) { cs.mEngine.mNormalizedTorque.Clear(); for (const [x, y] of C.engine.curve) cs.mEngine.mNormalizedTorque.AddPoint(x, y); }
      cs.mTransmission.mShiftDownRPM = C.engine.shiftDownRPM;
      cs.mTransmission.mShiftUpRPM = C.engine.shiftUpRPM;
      cs.mTransmission.mGearRatios.clear();
      for (const g of C.engine.gears) cs.mTransmission.mGearRatios.push_back(g);
      cs.mTransmission.mReverseGearRatios.clear();
      for (const g of C.engine.reverse) cs.mTransmission.mReverseGearRatios.push_back(g);
      cs.mTransmission.mClutchStrength = S.clutchStrength;
      // PATCH (throttle latency): Jolt's auto gearbox starts in neutral and takes mSwitchTime 0.5 s +
      // mClutchReleaseTime 0.3 s to engage 1st, so the throttle bit ~0.7 s late. A single-speed drive
      // (e-motor / pedal chain from part data) has no gearbox: engage instantly.
      if (C.engine.gears.length === 1) { cs.mTransmission.mSwitchTime = 0; cs.mTransmission.mClutchReleaseTime = 0.05; cs.mTransmission.mSwitchLatency = 0; }
      // Lean controller gains are absolute (N·m/rad, N·m·s/rad) and tuned for the sample's
      // 240 kg body. Scale them with mass so a lighter bike gets the same lean dynamics
      // (unscaled, the damping term goes unstable at 60 Hz and a 110 kg bike falls over).
      if (C.leanScale !== 1) { cs.mLeanSpringConstant *= C.leanScale; cs.mLeanSpringDamping *= C.leanScale; }
      const TU = globalThis.__WK_TUNE__ || {};
      if (profile) {
        // v2.0 lean tune: stiffer spring (roll inertia ~ m·h², so scale by comH² too), an integral term
        // to remove the steady-state lean error, and less smoothing so the bike tips in fast.
        const k = (TU.k ?? 7) * (C.comH / 0.9) ** 2, d = TU.d ?? 0.45;
        cs.mLeanSpringConstant *= k; cs.mLeanSpringDamping *= d * Math.sqrt(k);
        cs.mLeanSpringIntegrationCoefficient = TU.integ ?? 0; cs.mLeanSpringIntegrationCoefficientDecay = TU.decay ?? 4;
        cs.mLeanSmoothingFactor = TU.smooth ?? 0.45; cs.mMaxLeanAngle = (TU.maxLean ?? 45) * DEG;
      }
      vehicle.mController = cs;
      cs.mDifferentials.clear();
      const diff = new Jolt.VehicleDifferentialSettings();
      diff.mLeftWheel = -1; diff.mRightWheel = C.driveFront ? 0 : 1; diff.mDifferentialRatio = C.engine.diff;
      cs.mDifferentials.push_back(diff);

      constraint = new Jolt.VehicleConstraint(body, vehicle);
      constraint.SetVehicleCollisionTester(new Jolt.VehicleCollisionTesterCastCylinder(LAYER_MOVING, 1.0));
      physicsSystem.AddConstraint(constraint);
      physicsSystem.AddStepListener(new Jolt.VehicleConstraintStepListener(constraint));
      controller = Jolt.castObject(constraint.GetController(), Jolt.MotorcycleController);

      // PATCH (visual mapping only): the game draws the bike from s.y = centre-of-mass height
      // (P.comH above ground). Settle once at rest and record the sample body's ride height.
      // PATCH (sag): Jolt sizes a frequency spring from the effective mass at the contact, which for a
      // bike's low pitch inertia is small, so the sample's springs bottom the fork at rest (sample front
      // sits at min length). Set rider sag like a real setup: rear 30 %, front 25 % of travel, by scaling
      // each spring Hz from a measured settle (a few iterations). Hz given in part data is left alone.
      const SAG = [0.25, 0.30]; // [front, rear]
      api.sag = null;
      if (profile) {
        const spawn = () => { bodyInterface.SetPositionRotationAndVelocity(body.GetID(), new Jolt.RVec3(0, C.originH + 0.02, 0), new Jolt.Quat(0, 0, 0, 1), new Jolt.Vec3(0, 0, 0), new Jolt.Vec3(0, 0, 0)); if (constraint.ResetWarmStart) constraint.ResetWarmStart(); };
        const axleOf = i => (i === 0 ? C.front : C.rear);
        for (let it = 0; it < 8; it++) {
          spawn();
          for (let i = 0; i < 120; i++) { controller.SetDriverInput(0, 0, 0, false); jolt.Step(1 / 60, COLLISION_STEPS); }
          const comp = [0, 1].map(i => Math.max(0.02, Math.min(1, (axleOf(i).max - wheel(i).GetSuspensionLength()) / axleOf(i).travel)));
          api.sag = comp;
          let done = true;
          for (const i of [0, 1]) {
            const ax = axleOf(i);
            if (ax.hzFromData || Math.abs(comp[i] - SAG[i]) < 0.03) continue;
            done = false;
            // bottomed (comp 1) under-reports: push harder
            const k = comp[i] >= 0.99 ? 1.6 : Math.sqrt(comp[i] / SAG[i]);
            ax.hz = Math.max(1, Math.min(8, ax.hz * k));
            wheelSet[i].mSuspensionSpring.mFrequency = ax.hz;
          }
          // Level at rest: move the front wheel mount so the sprung body sits at 0° pitch with the rider on.
          const pitchRest = Math.asin(Math.max(-1, Math.min(1, axes().fwd.y)));
          if (Math.abs(pitchRest) > 0.004) {
            done = false;
            const m = wheelSet[0].mPosition;
            wheelSet[0].mPosition = new Jolt.Vec3(m.GetX(), m.GetY() + Math.tan(pitchRest) * (C.frontZ - C.rearZ), m.GetZ());
          }
          api.restPitch = pitchRest;
          if (done) break;
        }
        spawn();
      }
      for (let i = 0; i < 180; i++) { controller.SetDriverInput(0, 0, 0, false); jolt.Step(1 / 60, COLLISION_STEPS); }
      rideLift = body.GetPosition().GetY() - (P?.comH || 0.95);
      api.restY = body.GetPosition().GetY();
      api.ready = true;
    } catch (e) {
      api.error = (e && e.message) || String(e);
      console.error('Jolt playground init failed', e);
    }
    return api;
  }

  function axes() { const r = body.GetRotation(); return bodyAxes(r.GetX(), r.GetY(), r.GetZ(), r.GetW()); }
  function wheel(i) { return Jolt.castObject(constraint.GetWheel(i), Jolt.WheelWV); }

  // PATCH (spawn/reset): place the sample body upright at a pose, at rest height.
  function adopt(s) {
    if (!api.ready) return;
    const yaw = s.yaw || 0, v = s.vx || 0, x = s.x || 0, z = s.z || 0, C = api.settings;
    // On the terrain/ramps: drop in level, just clear of the highest ground under either wheel.
    const gh = profile ? Math.max(...[C.rearZ, 0, C.frontZ].map(d => playgroundHeight(x + Math.cos(yaw) * d, z + Math.sin(yaw) * d))) : 0;
    bodyInterface.SetPositionRotationAndVelocity(body.GetID(), new Jolt.RVec3(x, api.restY + gh + (gh > 0 ? 0.05 : 0), z), quatFromYaw(Jolt, yaw),
      new Jolt.Vec3(Math.cos(yaw) * v, 0, Math.sin(yaw) * v), new Jolt.Vec3(0, 0, 0));
    for (let i = 0; i < 2; i++) wheel(i).SetAngularVelocity(v / wheelR);
    if (constraint.ResetWarmStart) constraint.ResetWarmStart();
    mForward = 0; mPreviousForward = 1; mRight = 0; mBrake = 0; prevPitch = null; leanPrev = 0;
    bodyInterface.ActivateBody(body.GetID());
    writeState(s);
  }

  // MotorcycleTest::ProcessInput. Our buttons map to the sample keys:
  // throttle = Up, brake = Down (sample: brakes until stopped, then reverses).
  function processInput(inp, dt) {
    const thr = Math.max(0, Math.min(1, inp.throttle || 0)), brk = Math.max(0, Math.min(1, inp.brake || 0));
    mForward = 0; mBrake = 0;
    if (thr > 0.05) mForward = thr;
    else if (brk > 0.05) mForward = -brk;
    // PATCH (brake holds, double-tap reverses): holding BRAKE to a stop, or at a standstill, holds the
    // bike (slopes too); a quick release + press again while stopped (within 0.4 s) is reverse.
    {
      const v = body.GetLinearVelocity(), a = axes(), vf = v.GetX() * a.fwd.x + v.GetY() * a.fwd.y + v.GetZ() * a.fwd.z;
      const pressed = brk > 0.05 && thr <= 0.05;
      if (pressed && !brkWas) revArmed = Math.abs(vf) < 0.5 && brkUpT < 0.4;
      if (!pressed) { if (brkWas) brkUpT = 0; brkUpT += dt; revArmed = false; }
      brkWas = pressed;
      if (pressed && !revArmed && vf < 0.3) { mForward = 0; mBrake = brk; }
    }
    // PATCH (burnout / drift, missing from the sample where Up simply wins): throttle + brake
    // drives the rear and uses Jolt's hand brake on one wheel. Slow: front locked = burnout.
    // Moving: rear dragged = rear-brake slide. Grip loss comes from the friction circle below.
    handBrake = 0; mode = 'ride';
    // Body input (v2.0.1): lean > 0 = rider weight back, < 0 = forward. Throttle + weight back is a
    // wheelie, front brake + weight forward is a stoppie. No trick buttons.
    const lean = Math.max(-1, Math.min(1, inp.lean || 0)), back = Math.max(0, lean), fwdL = Math.max(0, -lean);
    const frontUp = !wheel(0).HasContact() && wheel(1).HasContact();
    if (fwdL > 0.15 && brk > 0.05 && thr <= 0.05) {
      // STOPPIE: braking with the weight forward the rider squeezes the front lever only (Jolt hand brake
      // on the front wheel); the forward weight shift (riderActions) and the brake lift the rear.
      // Lever pressure for the decel that puts the COM over the front contact (tan(balance) g), +15 %,
      // capped at 1.1 g; the tyre's own grip still limits it in Jolt.
      const C = api.settings, aFrac = Math.min(1.1, 1.15 * (1 - C.comBack) * C.wb / Math.max(0.3, C.comH ?? 0.9)) * (globalThis.__WK_TUNE__?.sb ?? 1);
      stoppieLean = fwdL; mode = 'stoppie'; handBrake = brk; setHandBrakeWheel(0); wheelSet[0].mMaxHandBrakeTorque = aFrac * 9.81 * C.mass * C.wheelR; mForward = 0; mBrake = 0; mPreviousForward = 1;
      return finishSteer(inp, dt);
    }
    if (inp.burnout && back <= 0.1 && thr <= 0.05) {
      // BURNOUT toggled, waiting for throttle: front brake held, bike parked.
      mode = 'burnout-hold'; handBrake = 1; setHandBrakeWheel(0); mForward = 0; mBrake = 0; mPreviousForward = 1;
      return finishSteer(inp, dt);
    }
    if (back > 0.1 && frontUp) {
      // Front up with the weight back: the rider covers the rear brake. Off the throttle (or braking) it
      // dabs/holds the rear brake; on the throttle, wheelie control rolls drive off past the balance
      // point (as real e-bikes/e-motos), so a touch thumb can't loop it by accident.
      const C = api.settings, a = axes(), pitch = Math.asin(Math.max(-1, Math.min(1, a.fwd.y)));
      const balance = Math.atan2(C.comBack * C.wb, Math.max(0.3, C.comH ?? 0.9));
      const rate = prevPitch == null ? 0 : (pitch - prevPitch) / Math.max(1e-3, dt);
      if (brk > 0.05) { mode = thr > 0.05 ? 'mono-feather' : 'mono-brake'; handBrake = 0; mForward = thr; mBrake = brk; mPreviousForward = 1; return finishSteer(inp, dt); }
      if (thr <= 0.05) {
        const dab = Math.max(0, Math.min(1, 4 * (pitch - 0.85 * balance) + 0.6 * rate));
        if (dab > 0) { mode = 'mono-brake'; handBrake = 0; mForward = 0; mBrake = dab; mPreviousForward = 1; return finishSteer(inp, dt); }
      } else {
        const over = pitch - balance + 0.15 * rate;
        if (over > 0) { mode = 'mono-wc'; handBrake = 0; mForward = thr * Math.max(0, 1 - 6 * over); mBrake = Math.min(1, 3 * over); mPreviousForward = 1; return finishSteer(inp, dt); }
      }
    }
    if (thr > 0.05 && (brk > 0.05 || inp.burnout)) {
      const v = body.GetLinearVelocity(), speed = Math.hypot(v.GetX(), v.GetZ());
      mode = speed < 3 ? 'burnout' : 'drift';
      // Donut: at full lock the rider eases the front lever so the front rolls round a tight circle while
      // the spinning rear swings out (a locked front would just pin the bike: the thrust points at it).
      const lock = Math.min(1, Math.abs(mRight) / 0.6);
      handBrake = mode === 'burnout' ? 1 - (globalThis.__WK_TUNE__?.donutRel ?? 0.8) * lock : brk;
      // Burnout drive: just enough wheel torque to break the rear loose (1.5 x peak grip x rear load x R),
      // capped by the launch-map lift; more only lifts the front against the locked brake.
      const C = api.settings, Tfull = (profile?.engine?.torque || 0), Tspin = 1.5 * 1.2 * C.friction * (1 - C.comBack) * C.mass * 9.81 * C.wheelR;
      const burnFrac = Tfull > 0 ? Math.min(1 / (C.launchCap || 1), Tspin / Tfull) : 1 / (C.launchCap || 1);
      // The rider holds the revs in a burnout (feathers to keep the rear tyre spinning at ~burnV); full
      // drive into a free-spinning light wheel would just wind the motor up and wheelie the bike.
      const burnV = globalThis.__WK_TUNE__?.burnV ?? 9, wr = Math.abs(wheel(1).GetAngularVelocity()) * C.wheelR;
      const rev = Math.max(0.15, Math.min(1, (burnV - wr) / 3));
      mPreviousForward = 1; mForward = mode === 'burnout' ? thr * burnFrac * rev : thr * 0.5; mBrake = 0;
      setHandBrakeWheel(mode === 'burnout' ? 0 : 1);
      return finishSteer(inp, dt);
    }
    if (mPreviousForward * mForward < 0) {
      const v = body.GetLinearVelocity(), a = axes();
      const velocity = v.GetX() * a.fwd.x + v.GetY() * a.fwd.y + v.GetZ() * a.fwd.z;
      if ((mForward > 0 && velocity < -0.1) || (mForward < 0 && velocity > 0.1)) { mBrake = Math.abs(mForward); mForward = 0; }
      else mPreviousForward = mForward;
    }
    // PATCH (reverse is a parking move, not a second drive mode): the sample's reverse is
    // full engine torque through a -4.0 gear (27 km/h in 4 s). Feed reverse at REVERSE_INPUT
    // and stop feeding past REVERSE_MAX; and with no input, brake a backwards roll to a stop
    // (the sample just lets it coast backwards).
    if (mForward < 0 || (mForward === 0 && mBrake === 0)) {
      const v = body.GetLinearVelocity(), a = axes();
      const velocity = v.GetX() * a.fwd.x + v.GetY() * a.fwd.y + v.GetZ() * a.fwd.z;
      if (mForward < 0) mForward = velocity < -REVERSE_MAX ? 0 : mForward * REVERSE_INPUT;
      else if (velocity < -0.1) mBrake = 1;
      // PATCH (rest creep): stopped with no input the rider holds the brake (foot down), as a real rider does.
      else if (mForward === 0 && Math.abs(velocity) < 0.3 && !inp.burnout) mBrake = 1;
    }
        finishSteer(inp, dt);
    // When leaned, don't use the brakes fully.
    if (mBrake > 0) {
      const a = axes();
      // world_up x up . fwd
      const sinLean = Math.abs(a.up.z * a.fwd.x - a.up.x * a.fwd.z);
      mBrake *= (1 - sinLean) * (1 - sinLean);
    }
  }

  function finishSteer(inp, dt) {
    // Steering: our "right" is +inp.steer (sample: 4/s towards the target).
    let right = Math.max(-1, Math.min(1, inp.steer || 0));
    // PATCH (rider-limited steer): at speed a rider can't hold full lock; the bars only go as far as a
    // turn the tyres can carry (lateral accel ~0.9 g -> ~42° lean), so lean always matches the turn.
    if (api.settings && profile) {
      const v = body.GetLinearVelocity(), sp = Math.hypot(v.GetX(), v.GetZ()), C = api.settings, TU = globalThis.__WK_TUNE__ || {};
      const aLat = (TU.aLat ?? 0.9) * 9.81 * Math.min(1.2, C.friction || 1);
      const dMax = sp > 0.5 ? Math.atan(aLat * C.wb / (sp * sp)) : C.steerMax;
      right *= Math.min(1, dMax / C.steerMax);
    }
    if (right > mRight) mRight = Math.min(mRight + S.steerSpeed * dt, right);
    else if (right < mRight) mRight = Math.max(mRight - S.steerSpeed * dt, right);
  }
  function setHandBrakeWheel(i) {
    // Drift: the rider stomps the rear brake (1.5x its rated torque) so it locks against the drive.
    for (let k = 0; k < 2; k++) wheelSet[k].mMaxHandBrakeTorque = k === i ? (i === 0 ? api.settings.frontBrake : api.settings.rearBrake * 1.5) : 0;
  }
  // Tyre friction circle: a spinning or locked rear tyre loses side grip. Jolt evaluates the
  // wheel's lateral friction curve every step, so the curve is rescaled from the slip ratio.
  function updateRearGrip() {
    const w = wheel(1), v = body.GetLinearVelocity(), a = axes();
    const vf = v.GetX() * a.fwd.x + v.GetZ() * a.fwd.z;
    const slip = Math.abs(w.GetAngularVelocity() * api.settings.wheelR - vf) / Math.max(1.5, Math.abs(vf));
    // Full side grip up to 15% slip, falling to 45% when fully spun or locked.
    const u = Math.max(0, Math.min(1, (slip - 0.15) / 0.85)), scale = 1 - 0.55 * u;
    if (Math.abs(scale - latScaleNow) < 0.03) return;
    latScaleNow = scale;
    const f = api.settings.friction * scale, c = wheelSet[1].mLateralFriction;
    c.Clear(); c.AddPoint(0, 0); c.AddPoint(3, 1.2 * f); c.AddPoint(20, 1.0 * f);
  }
  function riderActions(s, inp, dt) {
    if (!!inp.stand !== standOn) {
      standOn = !!inp.stand;
      bodyInterface.SetShape(body.GetID(), standOn ? shapes.stand : shapes.sit, false, Jolt.EActivation_Activate);
      // Standing, the legs soak up the hits: better-damped suspension.
      for (let k = 0; k < 2; k++) {
        const w = k ? api.settings.rear : api.settings.front;
        wheelSet[k].mSuspensionSpring.mDamping = (w.damping ?? 0.5) + (standOn ? 0.15 : 0);
      }
    }
    const lean = Math.max(-1, Math.min(1, inp.lean || 0)), back = Math.max(0, lean), fwdL = Math.max(0, -lean);
    const thrOn = (inp.throttle || 0) > 0.05, brkOn = (inp.brake || 0) > 0.05;
    // Wheelie = throttle + weight back. A quick pull back (lean rising fast) is the yank/clutch-up pop.
    const wantMono = back > 0.1 && (thrOn || !wheel(0).HasContact());
    const yank = dt > 0 ? (back - leanPrev) / dt : 0; leanPrev = back;
    if (wantMono && !monoOn && thrOn) monoKick = 0.25 * Math.min(1, 0.4 + Math.max(0, yank) / 8);
    monoOn = wantMono; if (!monoOn) monoKick = 0;
    stoppieOn = fwdL > 0.1 && brkOn;
    const a = axes(), pitch = Math.asin(Math.max(-1, Math.min(1, a.fwd.y)));
    const pitchRate = prevPitch == null || dt <= 0 ? 0 : (pitch - prevPitch) / dt; prevPitch = pitch;
    const fwdLen = Math.hypot(a.fwd.x, a.fwd.z) || 1;
    const rollNow = Math.atan2((a.up.x * -a.fwd.z + a.up.z * a.fwd.x) / fwdLen, a.up.y);
    // Weight shift (m, + = back). Standing gives more reach.
    const reach = standOn ? 1.5 : 1;
    const frontUp = !wheel(0).HasContact() && wheel(1).HasContact();
    const airborne = !wheel(0).HasContact() && !wheel(1).HasContact();
    const deficit = Math.max(0, Math.min(1, 1 - api.settings.liftRatio));
    // The pop: the rider pulls the bars and drives the pedals/throttle while the front is still down
    // (how low-power bikes get it up). Weak drive = harder yank (up to ~520 N·m for 75 kg).
    const vNow = body.GetLinearVelocity(), rolling = Math.hypot(vNow.GetX(), vNow.GetZ()) > 1.5;
    const pop = monoKick > 0 && rolling && wheel(0).HasContact() ? 0.45 + 0.3 * deficit : 0;
    // Balance points: COM straight over the rear (wheelie) or front (stoppie) contact patch.
    const comH = Math.max(0.3, api.settings.comH ?? 0.9), wbC = api.settings.wb, cb = api.settings.comBack;
    const balance = Math.atan2(cb * wbC, comH), stoppieBalance = Math.atan2((1 - cb) * wbC, comH);
    const rearUp = !wheel(1).HasContact() && wheel(0).HasContact();
    airT = airborne ? airT + dt : 0;
    let body_m = 0; // rider COM shift (m, + = back), limited by how far a rider can move on the bike
    if (airborne) {
      // In the air the rider holds the bike parallel to the flight path (lands both wheels), and the
      // lean input tips it nose-up/down from there (+-20 deg); past 85 % lean the rider yanks it round (to ~+-90 deg). Torque limit = 75 kg x 0.35 m.
      const vh = Math.hypot(vNow.GetX(), vNow.GetZ()), target = Math.max(-0.6, Math.min(0.6, Math.atan2(vNow.GetY(), Math.max(1, vh)))) + lean * 0.35
        + Math.sign(lean) * Math.max(0, Math.abs(lean) - 0.85) * (globalThis.__WK_TUNE__?.yank ?? 8) * Math.min(1, Math.max(0, airT - 0.15) / 0.1); // a full yank in real flight over-rotates: loop-out / endo (not a wheel skipping off a bump)
      const I = api.settings.mass * 0.25, cap = RIDER_KG * G * 0.35;
      const tau = Math.max(-cap, Math.min(cap, I * 14 * (target - pitch) - I * 7 * pitchRate));
      body.AddTorque(new Jolt.Vec3(-a.right.x * tau, -a.right.y * tau, -a.right.z * tau));
    } else if (monoOn) {
      // Wheelie: lean amount sets the target pitch (full pull = the balance point). The rider hangs back
      // to lift, eases off near the target and pushes forward past it.
      body_m = Math.max(-0.28, Math.min(0.16 + 0.12 * deficit, 1.4 * (back * balance - pitch) - 0.3 * pitchRate)) + pop;
    } else if (stoppieOn && (mode === 'stoppie' || rearUp)) {
      // Stoppie: weight forward while the front brake bites; lean amount sets how high the rear goes.
      body_m = Math.max(-(globalThis.__WK_TUNE__?.sreach ?? 0.28), Math.min(0.2, 1.4 * (-0.85 * fwdL * stoppieBalance - pitch) - 0.3 * pitchRate));
    } else if (frontUp) body_m = -0.2;
    else if (rearUp) body_m = 0.2;
    else body_m = lean * 0.12;
    const shift = airborne ? 0 : (body_m + (mode === 'burnout' ? -(globalThis.__WK_TUNE__?.bshift ?? 0.4) : 0)) * reach;
    if (shift) {
      const tau = RIDER_KG * G * shift * Math.cos(pitch); // nose-up = negative about body right
      body.AddTorque(new Jolt.Vec3(-a.right.x * tau, -a.right.y * tau, -a.right.z * tau));
    }
    footDown = false;
    if ((mode === 'burnout' || mode === 'burnout-hold' || mode === 'drift') && !airborne) {
      // Rider balance (foot down / flat-track dab): in a burnout, donut or slide the rider holds the bike
      // at the lean the turn needs (centripetal: tan(lean) = v * yawRate / g), with the inside boot as an
      // outrigger (75 kg x 0.6 m leg reach). Jolt's lean controller balances by steering, which can't work with the
      // front locked or the rear sliding, so it is handed over to the rider while the foot is down.
      const TU = globalThis.__WK_TUNE__ || {};
      const av = body.GetAngularVelocity(), fx = a.fwd.x, fz = a.fwd.z, fl = Math.hypot(fx, fz) || 1;
      const rollRate = (av.GetX() * fx + av.GetZ() * fz) / fl, sp = Math.hypot(vNow.GetX(), vNow.GetZ());
      footDown = mode !== 'drift' || sp < (TU.footV ?? 6);
      const want = -Math.max(-0.6, Math.min(0.6, Math.atan(sp * av.GetY() / G))); // lean into the turn (roll sign is opposite to yaw rate)
      const cap = RIDER_KG * G * (TU.footArm ?? 0.6), err = rollNow - want, I = api.settings.mass * Math.max(0.3, api.settings.comH ?? 0.9) ** 2;
      const tau = Math.max(-cap, Math.min(cap, -I * (TU.fk ?? 60) * err - I * (TU.fd ?? 12) * rollRate));
      if (footDown || TU.footAlways) body.AddTorque(new Jolt.Vec3(fx / fl * tau, 0, fz / fl * tau));
    }
    if (mode === 'burnout') {
      // Rider's feet planted: ground friction on the boots (75 kg x 0.8) resists creeping.
      const v = body.GetLinearVelocity(), m = api.settings.mass, Fmax = RIDER_KG * G * (globalThis.__WK_TUNE__?.boot ?? 0.8);
      const vx = v.GetX(), vz = v.GetZ(), sp = Math.hypot(vx, vz);
      const steerAmt = Math.min(1, Math.abs(mRight) / 0.3); // steering into a donut: the boot is the pivot, not a brake
      if (sp > 1e-3) { const F = Math.min(Fmax, sp * m / dt) * (1 - steerAmt); body.AddForce(new Jolt.Vec3(-vx / sp * F, 0, -vz / sp * F)); }
    }
    if (!wheel(0).HasContact() && wheel(1).HasContact()) {
      // Front up: the lean controller can't steer, so the rider balances side to side with a
      // sideways weight shift (capped at 75 kg x 0.25 m), as a real wheelie rider does.
      const av = body.GetAngularVelocity(), fx = a.fwd.x, fz = a.fwd.z, fl = Math.hypot(fx, fz) || 1;
      const rollRate = (av.GetX() * fx + av.GetZ() * fz) / fl;
      const cap = RIDER_KG * G * (globalThis.__WK_TUNE__?.side ?? 0.25), tau = Math.max(-cap, Math.min(cap, -(cap * 4) * rollNow - (cap * 0.8) * rollRate));
      body.AddTorque(new Jolt.Vec3(fx / fl * tau, 0, fz / fl * tau));
    }
    if (monoKick > 0 && !rolling) monoKick = 0; // toggling at a standstill is just a stance change
    if (monoKick > 0) { if (thrOn) { mForward = Math.max(mForward, 1); mBrake = 0; } monoKick = Math.max(0, monoKick - dt); }
    if (Math.abs(rollNow) > 75 * DEG && !s.crashed) {
      s.crashed = 'FELL OVER';
      s.events = s.events || []; s.events.push({ type: 'crash', why: 'FELL OVER' });
    }
    if (pitch < -(stoppieBalance + 25 * DEG) && !s.crashed) {
      s.crashed = 'ENDO';
      s.events = s.events || []; s.events.push({ type: 'crash', why: 'ENDO' });
    }
    if (pitch > 80 * DEG && !s.crashed) {
      s.crashed = 'LOOPED OUT';
      s.events = s.events || []; s.events.push({ type: 'crash', why: 'LOOPED OUT' });
    }
  }
  // A rider feels the front tyre start to skid and eases the lever (no ABS in Jolt's MotorcycleController):
  // once front slip passes ~18 % the lever eases (to 30 %), then comes back as the wheel spins up. Stoppies use set pressure.
  let leverFeel = 1, leverRamp = 0;
  function modulateFrontBrake(dt) {
    const v = body.GetLinearVelocity(), a = axes(), vf = v.GetX() * a.fwd.x + v.GetY() * a.fwd.y + v.GetZ() * a.fwd.z;
    const wf = wheel(0).GetAngularVelocity() * api.settings.wheelR;
    // Feathered at the tyre's grip peak (slip ~6-20 %, see the friction curve): ease off past ~18 % slip,
    // squeeze back in below it. A light BMX wheel locks in one frame, so on/off cut-outs never reached peak.
    const TU = globalThis.__WK_TUNE__ || {}, slipF = vf > 1.5 && wheel(0).HasContact() ? 1 - wf / vf : 0;
    leverFeel = slipF > (TU.skid ?? 0.18) ? Math.max(TU.feelMin ?? 0.3, leverFeel - (TU.feelDn ?? 8) * dt) : Math.min(1, leverFeel + (TU.feelUp ?? 6) * dt);
    // A hand squeezes the lever over ~0.25 s, so weight transfer loads the front before full torque.
    leverRamp = mBrake > 0 || (handBrake > 0 && mode === 'stoppie') ? Math.min(1, leverRamp + 4 * dt) : 0;
    if (mBrake > 0) mBrake *= leverFeel * leverRamp;
    if (handBrake > 0 && mode === 'stoppie') handBrake *= leverRamp;
    if (handBrake > 0 && mode === 'burnout-hold') handBrake *= leverFeel;
    if (handBrake > 0 && mode === 'stoppie') {
      // Stoppie: the rider holds a set lever pressure (feed-forward, below) and eases it as the rear
      // passes the target height (stoppie control, the mirror of wheelie control). No skid cut-outs:
      // a light BMX wheel trips them in one frame and the stoppie never loads up.
      const C = api.settings, pitch = Math.asin(Math.max(-1, Math.min(1, axes().fwd.y)));
      const sb = Math.atan2((1 - C.comBack) * C.wb, Math.max(0.3, C.comH ?? 0.9)), target = 0.85 * stoppieLean * sb;
      handBrake *= Math.max(0, Math.min(1, 1 - 4 * (-pitch - target)));
    }
  }
  function step(s, P, inp, dt) {
    if (!api.ready || !api.enabled || destroyed || dt <= 0) return;
    processInput(inp, dt);
    if (profile) modulateFrontBrake(dt);
    if (handBrake === 0 && wheelSet) for (const w of wheelSet) w.mMaxHandBrakeTorque = 0;
    riderActions(s, inp, dt);
    updateRearGrip();
    // MotorcycleTest::PrePhysicsUpdate
    if (mRight !== 0 || mForward !== 0 || mBrake !== 0 || handBrake) bodyInterface.ActivateBody(body.GetID());
    controller.SetDriverInput(mForward, mRight, mBrake, handBrake);
    controller.EnableLeanController(S.enableLeanController && !footDown);
    const n = Math.max(COLLISION_STEPS, Math.ceil(dt * 60 * COLLISION_STEPS - 1e-6));
    jolt.Step(Math.min(dt, 0.1), n);
    writeState(s, dt);
  }

  let vyPrev = null;
  function writeState(s, dt = 0) {
    const p = body.GetPosition(), v = body.GetLinearVelocity(), av = body.GetAngularVelocity(), a = axes();
    const yaw = yawOf(a), c = Math.cos(yaw), n = Math.sin(yaw);
    const fwdLen = Math.hypot(a.fwd.x, a.fwd.z) || 1;
    s.x = p.GetX(); s.z = p.GetZ(); s.y = p.GetY() - rideLift;
    s.yaw = yaw; s.pitch = Math.asin(Math.max(-1, Math.min(1, a.fwd.y)));
    const rx = -a.fwd.z / fwdLen, rz = a.fwd.x / fwdLen;
    const roll = Math.atan2(a.up.x * rx + a.up.z * rz, a.up.y);
    s.joltRoll = roll; s.joltRollRaw = roll;
    s.vx = v.GetX() * c + v.GetZ() * n; s.vy = v.GetY();
    s.wYaw = av.GetY();
    s.w = -(av.GetX() * a.right.x + av.GetY() * a.right.y + av.GetZ() * a.right.z);
    const wF = wheel(0), wR = wheel(1);
    s.ground = [wR.HasContact(), wF.HasContact()];
    s.wheelOmega = [wR.GetAngularVelocity(), wF.GetAngularVelocity()];
    s.wheelAngle = [wR.GetRotationAngle ? wR.GetRotationAngle() : 0, wF.GetRotationAngle ? wF.GetRotationAngle() : 0];
    s.slip = [s.wheelOmega[0] * wheelR - s.vx, s.wheelOmega[1] * wheelR - s.vx];
    const C = api.settings;
    s.comp = [Math.max(0, Math.min(1, (C.rear.max - wR.GetSuspensionLength()) / C.rear.travel)), Math.max(0, Math.min(1, (C.front.max - wF.GetSuspensionLength()) / C.front.travel))];
    s.steer = mRight * S.maxSteer;
    s.air = 0; s.burnout = mode === 'burnout'; s.drift = mode === 'drift'; s.mono = monoOn; s.stoppie = stoppieOn; s.standing = standOn;
    s.curvature = Math.abs(s.vx) > 0.4 ? s.wYaw / Math.max(0.4, s.vx) : 0;
    // Impact force (N above static weight): upward velocity change per step x mass. Telemetry only
    // (reserved for part damage later); peak decays over ~0.5 s so a frame-rate read still sees landings.
    const vy = v.GetY();
    const impact = dt > 0 && vyPrev != null ? Math.max(0, api.settings.mass * (vy - vyPrev) / dt) : 0;
    vyPrev = dt > 0 ? vy : null;
    s.impactN = impact; s.impactPeakN = Math.max(impact, (s.impactPeakN || 0) * Math.exp(-(dt || 0) / 0.5));
  }

  function dispose() {
    destroyed = true; api.ready = false; api.enabled = false;
    try { jolt && jolt.Destroy && jolt.Destroy(); } catch {}
    Jolt = jolt = physicsSystem = bodyInterface = body = constraint = controller = null;
  }

  // PATCH (rewind / drop-in): full Jolt state, small plain object so the ride buffer can store one per step.
  function snapshot() {
    if (!api.ready) return null;
    const p = body.GetPosition(), q = body.GetRotation(), v = body.GetLinearVelocity(), w = body.GetAngularVelocity();
    let rpm = 0, gear = 1;
    try { rpm = controller.GetEngine().GetCurrentRPM(); gear = controller.GetTransmission().GetCurrentGear(); } catch {}
    return { p: [p.GetX(), p.GetY(), p.GetZ()], q: [q.GetX(), q.GetY(), q.GetZ(), q.GetW()], v: [v.GetX(), v.GetY(), v.GetZ()], w: [w.GetX(), w.GetY(), w.GetZ()],
      wheels: [wheel(0).GetAngularVelocity(), wheel(1).GetAngularVelocity()], rpm, gear, mono: monoOn, stand: standOn, prevForward: mPreviousForward,
      // full controller state so a rewind doesn't snap the bars straight (QA #7)
      right: mRight, steerAngle: [wheel(0).GetSteerAngle(), wheel(1).GetSteerAngle()], rot: [wheel(0).GetRotationAngle(), wheel(1).GetRotationAngle()],
      stoppie: stoppieOn, lever: [leverFeel, leverRamp], brk: [brkWas, brkUpT, revArmed], leanPrev, latScale: latScaleNow, stoppieLean };
  }
  function restore(snap, s) {
    if (!api.ready || !snap) return false;
    const id = body.GetID();
    bodyInterface.SetPositionRotationAndVelocity(id, new Jolt.RVec3(...snap.p), new Jolt.Quat(...snap.q), new Jolt.Vec3(...snap.v), new Jolt.Vec3(...snap.w));
    for (let i = 0; i < 2; i++) wheel(i).SetAngularVelocity(snap.wheels[i]);
    try { controller.GetEngine().SetCurrentRPM(snap.rpm); controller.GetTransmission().Set(snap.gear, 1); } catch {}
    if (standOn !== !!snap.stand) { standOn = !!snap.stand; bodyInterface.SetShape(id, standOn ? shapes.stand : shapes.sit, false, Jolt.EActivation_Activate); }
    monoOn = !!snap.mono; monoKick = 0; prevPitch = null; mPreviousForward = snap.prevForward ?? 1;
    mForward = 0; mRight = snap.right ?? 0; mBrake = 0; handBrake = 0; mode = 'ride';
    stoppieOn = !!snap.stoppie; if (snap.lever) [leverFeel, leverRamp] = snap.lever;
    if (snap.brk) [brkWas, brkUpT, revArmed] = snap.brk;
    leanPrev = snap.leanPrev ?? 0; stoppieLean = snap.stoppieLean ?? 0;
    if (snap.latScale != null && snap.latScale !== latScaleNow) {
      latScaleNow = snap.latScale; const f = api.settings.friction * latScaleNow, c = wheelSet[1].mLateralFriction;
      c.Clear(); c.AddPoint(0, 0); c.AddPoint(3, 1.2 * f); c.AddPoint(20, 1.0 * f);
    }
    if (snap.steerAngle) for (let i = 0; i < 2; i++) wheel(i).SetSteerAngle(snap.steerAngle[i]);
    if (snap.rot) for (let i = 0; i < 2; i++) wheel(i).SetRotationAngle(snap.rot[i]);
    controller.SetDriverInput?.(0, mRight, 0, 0);
    if (constraint.ResetWarmStart) constraint.ResetWarmStart();
    bodyInterface.ActivateBody(id);
    if (s) writeState(s);
    return true;
  }
  api.snapshot = snapshot; api.restore = restore;
  api.start = start; api.step = step; api.adopt = adopt; api.dispose = dispose;
  api.dump = () => {
    if (!api.ready) return { ready: false, error: api.error };
    const p = body.GetPosition(), wF = wheel(0), wR = wheel(1);
    let rpm = 0, gear = null;
    try { rpm = controller.GetEngine().GetCurrentRPM(); gear = controller.GetTransmission().GetCurrentGear(); } catch {}
    return {
      ready: true, air: false, error: api.error, forward: 'z', sample: 'MotorcycleTest',
      x: p.GetX(), y: p.GetY(), z: p.GetZ(), restY: api.restY, rideLift,
      driver: { forward: mForward, right: mRight, brake: mBrake, handBrake, mode, mono: monoOn, stand: standOn, rearLatScale: latScaleNow, previousForward: mPreviousForward },
      engine: { rpm, gear, torque: api.settings.engine.maxTorque, maxRPM: api.settings.engine.maxRPM },
      calibration: { sagAtRest: api.sag, restPitchBefore: api.restPitch ?? null, frontHz: api.settings.front.hz, rearHz: api.settings.rear.hz, wheelInertia: api.settings.wheelInertia, liftRatio: api.settings.liftRatio, engineInertia: api.settings.engine.inertia ?? null },
      settings: { mass: api.settings.mass, comOffsetY: api.settings.comOffsetY, front: api.settings.front, rear: api.settings.rear, friction: api.settings.friction },
      contact: {
        rear: wR.HasContact() ? { py: wR.GetContactPosition().GetY(), susp: wR.GetSuspensionLength() } : null,
        front: wF.HasContact() ? { py: wF.GetContactPosition().GetY(), susp: wF.GetSuspensionLength() } : null,
      },
    };
  };
  return api;
}
