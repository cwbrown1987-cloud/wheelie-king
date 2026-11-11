// Playground physics: a port of Jolt's own Samples/Tests/Vehicle/MotorcycleTest.cpp
// (settings, controller usage and ProcessInput logic kept as in the sample).
// Patches are marked "PATCH" with the reason. Flat ground only.
import initJolt from './vendor/jolt/jolt-physics.wasm.js';

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
    const travel = w?.travel > 0.02 ? w.travel : maxL - minL;
    // Spring rate rule: the sample's Hz is for its 0.2 m stroke; a shorter stroke needs a
    // proportionally stiffer spring for the same sag ratio (Hz ~ 1/sqrt(travel)).
    const hz = w?.hz > 0 ? w.hz : (profile ? Math.max(1, Math.min(4, hz0 * Math.sqrt((S.backSuspMax - S.backSuspMin) / travel))) : hz0);
    return { min: minL, max: minL + travel, travel, hz, damping: w?.damping ?? null };
  };
  const front = axle(pr.front, S.frontSuspMin, S.frontSuspMax, S.frontSuspFreq);
  const rear = axle(pr.rear, S.backSuspMin, S.backSuspMax, S.backSuspFreq);
  const mass = pr.mass || S.mass;
  // COM height: body origin rests at 0.9*halfHeight + (rear max - sag) + R above ground.
  const originH = 0.9 * S.halfHeight + (rear.max - sagOf(rear.hz)) + wheelR;
  const comOffsetY = profile && pr.comH ? pr.comH - originH : -S.halfHeight;
  const brakeScale = profile ? (mass / S.mass) * (pr.brakeTorque || 1) : 1;
  let engine;
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
    engine = { inertia: 0.005, maxTorque: e.torque / ratio, minRPM: MOTOR_RPM * 0.02, maxRPM: MOTOR_RPM, curve, gears: [1], reverse: [-1], diff: ratio, shiftUpRPM: MOTOR_RPM * 2, shiftDownRPM: 0 };
  } else {
    engine = { maxTorque: S.engineMaxTorque, minRPM: S.engineMinRPM, maxRPM: S.engineMaxRPM, curve: null, gears: S.gearRatios, reverse: S.reverseGearRatios, diff: S.differentialRatio, shiftUpRPM: S.shiftUpRPM, shiftDownRPM: S.shiftDownRPM };
  }
  return {
    mass, wheelR, wb, comBack, comOffsetY, originH,
    rearZ: -wb * comBack, frontZ: wb * (1 - comBack),
    caster: pr.caster ?? S.caster, steerMax: pr.steerMax ?? S.maxSteer,
    front, rear, friction: pr.friction || 1,
    frontBrake: S.frontBrakeTorque * brakeScale, rearBrake: S.backBrakeTorque * brakeScale,
    engine, driveFront: e.driveAxle === 'front',
    leanScale: profile ? mass / S.mass : 1,
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
  let wheelSet = null, monoOn = false, monoKick = 0, standOn = false, shapes = null, latScaleNow = 1, handBrake = 0, mode = 'ride';
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
      floorBody = bodyInterface.CreateBody(fs);
      bodyInterface.AddBody(floorBody.GetID(), Jolt.EActivation_DontActivate);
      Jolt.destroy(fs);

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
        ws.mWidth = S.frontWheelWidth;
        ws.mSuspensionMinLength = w.min;
        ws.mSuspensionMaxLength = w.max;
        ws.mSuspensionSpring.mFrequency = w.hz;
        if (w.damping != null) ws.mSuspensionSpring.mDamping = w.damping;
        ws.mMaxBrakeTorque = brake;
        if (C.friction !== 1) {
          scaleCurve(ws.mLongitudinalFriction, [[0, 0], [0.06, 1.2], [0.2, 1.0]]); // Jolt defaults x friction
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
      // Lean controller gains are absolute (N·m/rad, N·m·s/rad) and tuned for the sample's
      // 240 kg body. Scale them with mass so a lighter bike gets the same lean dynamics
      // (unscaled, the damping term goes unstable at 60 Hz and a 110 kg bike falls over).
      if (C.leanScale !== 1) { cs.mLeanSpringConstant *= C.leanScale; cs.mLeanSpringDamping *= C.leanScale; }
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
    const yaw = s.yaw || 0, v = s.vx || 0;
    bodyInterface.SetPositionRotationAndVelocity(body.GetID(), new Jolt.RVec3(s.x || 0, api.restY, s.z || 0), quatFromYaw(Jolt, yaw),
      new Jolt.Vec3(Math.cos(yaw) * v, 0, Math.sin(yaw) * v), new Jolt.Vec3(0, 0, 0));
    for (let i = 0; i < 2; i++) wheel(i).SetAngularVelocity(v / wheelR);
    if (constraint.ResetWarmStart) constraint.ResetWarmStart();
    mForward = 0; mPreviousForward = 1; mRight = 0; mBrake = 0;
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
    // PATCH (burnout / drift, missing from the sample where Up simply wins): throttle + brake
    // drives the rear and uses Jolt's hand brake on one wheel. Slow: front locked = burnout.
    // Moving: rear dragged = rear-brake slide. Grip loss comes from the friction circle below.
    handBrake = 0; mode = 'ride';
    if (inp.mono && brk > 0.05 && thr <= 0.05) {
      // In a wheelie the brake button is the rear brake: a tap brings the nose down.
      mode = 'mono-brake'; handBrake = 0; mForward = 0; mBrake = brk; mPreviousForward = 1;
      return finishSteer(inp, dt);
    }
    if (thr > 0.05 && brk > 0.05) {
      const v = body.GetLinearVelocity(), speed = Math.hypot(v.GetX(), v.GetZ());
      mode = speed < 3 ? 'burnout' : 'drift';
      handBrake = mode === 'burnout' ? 1 : brk;
      mPreviousForward = 1; mForward = mode === 'burnout' ? thr : thr * 0.5; mBrake = 0;
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
    const right = Math.max(-1, Math.min(1, inp.steer || 0));
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
    if (!!inp.mono !== monoOn) { monoOn = !!inp.mono; monoKick = monoOn ? 0.2 : 0; }
    const a = axes(), pitch = Math.asin(Math.max(-1, Math.min(1, a.fwd.y)));
    const fwdLen = Math.hypot(a.fwd.x, a.fwd.z) || 1;
    const rollNow = Math.atan2((a.up.x * -a.fwd.z + a.up.z * a.fwd.x) / fwdLen, a.up.y);
    // Weight shift (m, + = back): Up/Down lean fine-tunes, the wheelie toggle throws the rider
    // back. Standing gives more reach.
    const reach = standOn ? 1.5 : 1;
    const frontUp = !wheel(0).HasContact() && wheel(1).HasContact();
    // Wheelie off with the front still up: the rider throws their weight forward to set it down.
    // Toggle on = 0.2 s pop: the rider yanks the bars while the front is still down (how low-power bikes get it up).
    const pop = monoKick > 0 && wheel(0).HasContact() ? 0.35 : 0;
    const shift = ((monoOn ? 0.16 + pop : frontUp ? -0.2 : 0) + Math.max(-1, Math.min(1, inp.lean || 0)) * 0.12 + (mode === 'burnout' ? -0.25 : 0)) * reach;
    if (shift) {
      const tau = RIDER_KG * G * shift * Math.cos(pitch); // nose-up = negative about body right
      body.AddTorque(new Jolt.Vec3(-a.right.x * tau, -a.right.y * tau, -a.right.z * tau));
    }
    if (mode === 'burnout') {
      // Rider's feet planted: ground friction on the boots (75 kg x 0.8) resists creeping.
      const v = body.GetLinearVelocity(), m = api.settings.mass, Fmax = RIDER_KG * G * 0.8;
      const vx = v.GetX(), vz = v.GetZ(), sp = Math.hypot(vx, vz);
      if (sp > 1e-3) { const F = Math.min(Fmax, sp * m / dt); body.AddForce(new Jolt.Vec3(-vx / sp * F, 0, -vz / sp * F)); }
    }
    if (!wheel(0).HasContact() && wheel(1).HasContact()) {
      // Front up: the lean controller can't steer, so the rider balances side to side with a
      // sideways weight shift (capped at 75 kg x 0.15 m), as a real wheelie rider does.
      const av = body.GetAngularVelocity(), fx = a.fwd.x, fz = a.fwd.z, fl = Math.hypot(fx, fz) || 1;
      const rollRate = (av.GetX() * fx + av.GetZ() * fz) / fl;
      const cap = RIDER_KG * G * 0.15, tau = Math.max(-cap, Math.min(cap, -(cap * 4) * rollNow - (cap * 0.8) * rollRate));
      body.AddTorque(new Jolt.Vec3(fx / fl * tau, 0, fz / fl * tau));
    }
    if (monoKick > 0) { mForward = Math.max(mForward, 1); mBrake = 0; monoKick = Math.max(0, monoKick - dt); }
    if (Math.abs(rollNow) > 75 * DEG && !s.crashed) {
      s.crashed = 'FELL OVER';
      s.events = s.events || []; s.events.push({ type: 'crash', why: 'FELL OVER' });
    }
    if (pitch > 80 * DEG && !s.crashed) {
      s.crashed = 'LOOPED OUT';
      s.events = s.events || []; s.events.push({ type: 'crash', why: 'LOOPED OUT' });
    }
  }
  function step(s, P, inp, dt) {
    if (!api.ready || !api.enabled || destroyed || dt <= 0) return;
    processInput(inp, dt);
    if (handBrake === 0 && wheelSet) for (const w of wheelSet) w.mMaxHandBrakeTorque = 0;
    riderActions(s, inp, dt);
    updateRearGrip();
    // MotorcycleTest::PrePhysicsUpdate
    if (mRight !== 0 || mForward !== 0 || mBrake !== 0 || handBrake) bodyInterface.ActivateBody(body.GetID());
    controller.SetDriverInput(mForward, mRight, mBrake, handBrake);
    controller.EnableLeanController(S.enableLeanController);
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
    s.air = 0; s.burnout = mode === 'burnout'; s.drift = mode === 'drift'; s.mono = monoOn; s.standing = standOn;
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
      wheels: [wheel(0).GetAngularVelocity(), wheel(1).GetAngularVelocity()], rpm, gear, mono: monoOn, stand: standOn, prevForward: mPreviousForward };
  }
  function restore(snap, s) {
    if (!api.ready || !snap) return false;
    const id = body.GetID();
    bodyInterface.SetPositionRotationAndVelocity(id, new Jolt.RVec3(...snap.p), new Jolt.Quat(...snap.q), new Jolt.Vec3(...snap.v), new Jolt.Vec3(...snap.w));
    for (let i = 0; i < 2; i++) wheel(i).SetAngularVelocity(snap.wheels[i]);
    try { controller.GetEngine().SetCurrentRPM(snap.rpm); controller.GetTransmission().Set(snap.gear, 1); } catch {}
    if (standOn !== !!snap.stand) { standOn = !!snap.stand; bodyInterface.SetShape(id, standOn ? shapes.stand : shapes.sit, false, Jolt.EActivation_Activate); }
    monoOn = !!snap.mono; monoKick = 0; mPreviousForward = snap.prevForward ?? 1;
    mForward = 0; mRight = 0; mBrake = 0; handBrake = 0; mode = 'ride';
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
      settings: { mass: api.settings.mass, comOffsetY: api.settings.comOffsetY, front: api.settings.front, rear: api.settings.rear, friction: api.settings.friction },
      contact: {
        rear: wR.HasContact() ? { py: wR.GetContactPosition().GetY(), susp: wR.GetSuspensionLength() } : null,
        front: wF.HasContact() ? { py: wF.GetContactPosition().GetY(), susp: wF.GetSuspensionLength() } : null,
      },
    };
  };
  return api;
}
