// Playground physics: a port of Jolt's own Samples/Tests/Vehicle/MotorcycleTest.cpp
// (settings, controller usage and ProcessInput logic kept as in the sample).
// Patches are marked "PATCH" with the reason. Flat ground only.
import initJolt from './vendor/jolt/jolt-physics.wasm.js';

const LAYER_NON_MOVING = 0, LAYER_MOVING = 1, NUM_OBJECT_LAYERS = 2;
const DEG = Math.PI / 180;
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

export function createJoltRide({ P }) {
  const S = MOTO_SAMPLE;
  const api = { ready: false, enabled: true, error: null, air: false, forward: 'z' };
  let Jolt, jolt, physicsSystem, bodyInterface, body, constraint, controller, floorBody;
  // ProcessInput state, as in the sample.
  let mForward = 0, mPreviousForward = 1, mRight = 0, mBrake = 0;
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

      // PATCH (scale to our bike): wheel Z positions and radii come from the garage
      // bike so the physics wheels sit under the drawn wheels. Everything else is the sample's.
      wheelR = P?.R || S.backWheelRadius;
      const wb = P?.wb || 1.5, comBack = P?.comBack ?? 0.5;
      const backZ = -wb * comBack, frontZ = wb * (1 - comBack);

      const shape = new Jolt.OffsetCenterOfMassShapeSettings(new Jolt.Vec3(0, -S.halfHeight, 0),
        new Jolt.BoxShapeSettings(new Jolt.Vec3(S.halfWidth, S.halfHeight, S.halfLength))).Create().Get();
      const bs = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(0, 2, 0), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Dynamic, LAYER_MOVING);
      bs.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      bs.mMassPropertiesOverride.mMass = S.mass;
      body = bodyInterface.CreateBody(bs);
      bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
      Jolt.destroy(bs);

      const vehicle = new Jolt.VehicleConstraintSettings();
      vehicle.mMaxPitchRollAngle = S.maxPitchRoll;
      vehicle.mWheels.clear();
      const front = new Jolt.WheelSettingsWV();
      front.mPosition = new Jolt.Vec3(0, -0.9 * S.halfHeight, frontZ);
      front.mMaxSteerAngle = S.maxSteer;
      front.mSuspensionDirection = new Jolt.Vec3(0, -1, Math.tan(S.caster)).Normalized();
      front.mSteeringAxis = new Jolt.Vec3(0, 1, -Math.tan(S.caster)).Normalized(); // = -suspension direction
      front.mRadius = wheelR;
      front.mWidth = S.frontWheelWidth;
      front.mSuspensionMinLength = S.frontSuspMin;
      front.mSuspensionMaxLength = S.frontSuspMax;
      front.mSuspensionSpring.mFrequency = S.frontSuspFreq;
      front.mMaxBrakeTorque = S.frontBrakeTorque;
      vehicle.mWheels.push_back(front);
      const back = new Jolt.WheelSettingsWV();
      back.mPosition = new Jolt.Vec3(0, -0.9 * S.halfHeight, backZ);
      back.mMaxSteerAngle = 0;
      back.mRadius = wheelR;
      back.mWidth = S.backWheelWidth;
      back.mSuspensionMinLength = S.backSuspMin;
      back.mSuspensionMaxLength = S.backSuspMax;
      back.mSuspensionSpring.mFrequency = S.backSuspFreq;
      back.mMaxBrakeTorque = S.backBrakeTorque;
      vehicle.mWheels.push_back(back);

      const cs = new Jolt.MotorcycleControllerSettings();
      cs.mEngine.mMaxTorque = S.engineMaxTorque;
      cs.mEngine.mMinRPM = S.engineMinRPM;
      cs.mEngine.mMaxRPM = S.engineMaxRPM;
      cs.mTransmission.mShiftDownRPM = S.shiftDownRPM;
      cs.mTransmission.mShiftUpRPM = S.shiftUpRPM;
      cs.mTransmission.mGearRatios.clear();
      for (const g of S.gearRatios) cs.mTransmission.mGearRatios.push_back(g);
      cs.mTransmission.mReverseGearRatios.clear();
      for (const g of S.reverseGearRatios) cs.mTransmission.mReverseGearRatios.push_back(g);
      cs.mTransmission.mClutchStrength = S.clutchStrength;
      vehicle.mController = cs;
      cs.mDifferentials.clear();
      const diff = new Jolt.VehicleDifferentialSettings();
      diff.mLeftWheel = -1; diff.mRightWheel = 1; diff.mDifferentialRatio = S.differentialRatio;
      cs.mDifferentials.push_back(diff);

      constraint = new Jolt.VehicleConstraint(body, vehicle);
      constraint.SetVehicleCollisionTester(new Jolt.VehicleCollisionTesterCastCylinder(LAYER_MOVING, 1.0));
      physicsSystem.AddConstraint(constraint);
      physicsSystem.AddStepListener(new Jolt.VehicleConstraintStepListener(constraint));
      controller = Jolt.castObject(constraint.GetController(), Jolt.MotorcycleController);

      // PATCH (visual mapping only): the game draws the bike from s.y = centre-of-mass height
      // (P.comH above ground). Settle once at rest and record the sample body's ride height.
      for (let i = 0; i < 180; i++) { controller.SetDriverInput(0, 0, 0, false); jolt.Step(1 / 60, 1); }
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
    // Steering: our "right" is +inp.steer.
    const right = Math.max(-1, Math.min(1, inp.steer || 0));
    if (right > mRight) mRight = Math.min(mRight + S.steerSpeed * dt, right);
    else if (right < mRight) mRight = Math.max(mRight - S.steerSpeed * dt, right);
    // When leaned, don't use the brakes fully.
    if (mBrake > 0) {
      const a = axes();
      // world_up x up . fwd
      const sinLean = Math.abs(a.up.z * a.fwd.x - a.up.x * a.fwd.z);
      mBrake *= (1 - sinLean) * (1 - sinLean);
    }
  }

  function step(s, P, inp, dt) {
    if (!api.ready || !api.enabled || destroyed || dt <= 0) return;
    processInput(inp, dt);
    // MotorcycleTest::PrePhysicsUpdate
    if (mRight !== 0 || mForward !== 0 || mBrake !== 0) bodyInterface.ActivateBody(body.GetID());
    controller.SetDriverInput(mForward, mRight, mBrake, false);
    controller.EnableLeanController(S.enableLeanController);
    const n = Math.max(1, Math.ceil(dt * 60 - 1e-6));
    jolt.Step(Math.min(dt, 0.1), n);
    writeState(s);
  }

  function writeState(s) {
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
    const range = S.backSuspMax - S.backSuspMin;
    s.comp = [Math.max(0, Math.min(1, (S.backSuspMax - wR.GetSuspensionLength()) / range)), Math.max(0, Math.min(1, (S.frontSuspMax - wF.GetSuspensionLength()) / range))];
    s.steer = mRight * S.maxSteer;
    s.air = 0; s.burnout = false;
    s.curvature = Math.abs(s.vx) > 0.4 ? s.wYaw / Math.max(0.4, s.vx) : 0;
  }

  function dispose() {
    destroyed = true; api.ready = false; api.enabled = false;
    try { jolt && jolt.Destroy && jolt.Destroy(); } catch {}
    Jolt = jolt = physicsSystem = bodyInterface = body = constraint = controller = null;
  }

  api.start = start; api.step = step; api.adopt = adopt; api.dispose = dispose;
  api.dump = () => {
    if (!api.ready) return { ready: false, error: api.error };
    const p = body.GetPosition(), wF = wheel(0), wR = wheel(1);
    let rpm = 0, gear = null;
    try { rpm = controller.GetEngine().GetCurrentRPM(); gear = controller.GetTransmission().GetCurrentGear(); } catch {}
    return {
      ready: true, air: false, error: api.error, forward: 'z', sample: 'MotorcycleTest',
      x: p.GetX(), y: p.GetY(), z: p.GetZ(), restY: api.restY, rideLift,
      driver: { forward: mForward, right: mRight, brake: mBrake, previousForward: mPreviousForward },
      engine: { rpm, gear, torque: S.engineMaxTorque },
      contact: {
        rear: wR.HasContact() ? { py: wR.GetContactPosition().GetY(), susp: wR.GetSuspensionLength() } : null,
        front: wF.HasContact() ? { py: wF.GetContactPosition().GetY(), susp: wF.GetSuspensionLength() } : null,
      },
    };
  };
  return api;
}
