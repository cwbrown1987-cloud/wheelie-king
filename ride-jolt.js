// Switchable Jolt MotorcycleController backend for the arena.
// Classic ride-physics.js stays the default and is never removed. Jolt drives
// ground riding; the existing step() trick / rotation path stays in charge in the air.
import initJolt from './vendor/jolt/jolt-physics.wasm.js';
import { rampLength, arenaRamp } from './ride-physics.js';

const LAYER_NON_MOVING = 0, LAYER_MOVING = 1, LAYER_CHASSIS = 2, NUM_OBJECT_LAYERS = 3;
const STEER_BURNOUT = 0.7;
const CREEP = 0.45;
const BALANCE_END = 5.5; // m/s — assist fully gone by this speed
const BALANCE_FULL = 1.1;

export function readRidePhysics() {
  try {
    const q = new URLSearchParams(location.search).get('physics');
    if (q === 'jolt' || q === 'classic') {
      globalThis.__WK_PHYSICS_PREF__ = q;
      return q;
    }
  } catch {}
  return globalThis.__WK_PHYSICS_PREF__ || 'classic';
}

export function setRidePhysicsPref(next) {
  const v = next === 'jolt' ? 'jolt' : 'classic';
  globalThis.__WK_PHYSICS_PREF__ = v;
  return v;
}

function setupCollisionFiltering(Jolt, settings) {
  const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
  objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
  objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);
  // Chassis stays off the world — only the wheel tester should hit ramps/ground.
  const BP_NON = new Jolt.BroadPhaseLayer(0), BP_MOV = new Jolt.BroadPhaseLayer(1);
  const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, 2);
  bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, BP_NON);
  bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, BP_MOV);
  bpInterface.MapObjectToBroadPhaseLayer(LAYER_CHASSIS, BP_MOV);
  settings.mObjectLayerPairFilter = objectFilter;
  settings.mBroadPhaseLayerInterface = bpInterface;
  settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(bpInterface, 2, objectFilter, NUM_OBJECT_LAYERS);
}

function addStaticBox(Jolt, bodyInterface, hx, hy, hz, x, y, z, friction = 1.05) {
  const shape = new Jolt.BoxShape(new Jolt.Vec3(hx, hy, hz));
  const settings = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(x, y, z), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Static, LAYER_NON_MOVING);
  const body = bodyInterface.CreateBody(settings);
  body.SetFriction(friction);
  body.SetRestitution(0);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(settings);
  return body;
}

function addStaticCylinder(Jolt, bodyInterface, r, halfH, x, y, z, friction = 0.8) {
  const shape = new Jolt.CylinderShape(halfH, r);
  const settings = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(x, y, z), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Static, LAYER_NON_MOVING);
  const body = bodyInterface.CreateBody(settings);
  body.SetFriction(friction);
  body.SetRestitution(0);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(settings);
  return body;
}

function heightWithoutRamps(ter, x, z) {
  const full = typeof ter.height === 'function' ? (ter.height(x, z) || 0) : 0;
  let ramp = 0;
  for (const r of ter.ramps || []) ramp = Math.max(ramp, arenaRamp(x, z, r) || 0);
  // height is max(bumps, ramps). Under a ramp footprint, drop the coarse ramp
  // so only the dense MeshShape is the launch surface (avoids dual-contact jitter).
  if (ramp <= 0.001) return full;
  return Math.max(0, full - ramp);
}

function fillHeights(Jolt, ter, HALF, N) {
  const cell = (2 * HALF) / (N - 1);
  const samples = new Jolt.ArrayFloat();
  samples.reserve(N * N);
  for (let iz = 0; iz < N; iz++) {
    const z = -HALF + iz * cell;
    // Include ramps in the field so the run-up is continuous. A no-collision
    // hole just in front of a kicker was launching the bike off the face.
    for (let ix = 0; ix < N; ix++) samples.push_back(ter.height(-HALF + ix * cell, z));
  }
  return { samples, cell };
}

function addHeightField(Jolt, bodyInterface, ter) {
  const HALF = Math.abs(ter.bounds?.xmax || 150);
  // Jolt requires (N-1)/mBlockSize to be a power of two. 769 violated that
  // (768/2=384) and could produce a broken field that curbs the run-up.
  const N = 1025; // 2^10+1, ~0.293 m cells, (N-1)/2 = 512
  const { samples, cell } = fillHeights(Jolt, ter, HALF, N);
  const settings = new Jolt.HeightFieldShapeSettings();
  settings.mOffset = new Jolt.Vec3(-HALF, 0, -HALF);
  settings.mScale = new Jolt.Vec3(cell, 1, cell);
  settings.mSampleCount = N;
  if (settings.mBlockSize !== undefined) settings.mBlockSize = 2;
  settings.mHeightSamples = samples;
  const result = settings.Create();
  if (result.HasError && result.HasError()) throw new Error(result.GetError ? result.GetError() : 'HeightField failed');
  const shape = result.Get();
  const bodySet = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(0, 0, 0), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Static, LAYER_NON_MOVING);
  const body = bodyInterface.CreateBody(bodySet);
  body.SetFriction(1.15);
  body.SetRestitution(0);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(bodySet);
  Jolt.destroy(settings);
  return body;
}


function addRampMeshes(Jolt, bodyInterface, ter) {
  const ramps = ter.ramps || [];
  for (const r of ramps) {
    const len = rampLength(r), w = r.w || 6;
    if (!len) continue;
    const ds = 0.16, dw = 0.28;
    const nx = Math.max(4, Math.ceil(len / ds)), nz = Math.max(3, Math.ceil(w / dw));
    const c = Math.cos(r.yaw || 0), n = Math.sin(r.yaw || 0);
    const pts = [];
    for (let iz = 0; iz <= nz; iz++) {
      const lz = -w / 2 + (w * iz) / nz;
      for (let ix = 0; ix <= nx; ix++) {
        const lx = (len * ix) / nx;
        const x = r.x + c * lx - n * lz;
        const z = r.z + n * lx + c * lz;
        pts.push({ x, y: (ter.height(x, z) || 0) + 0.02, z });
      }
    }
    const cols = nx + 1;
    const triangles = new Jolt.TriangleList();
    triangles.reserve(nx * nz * 2);
    const add = (tr) => { if (triangles.push_back) triangles.push_back(tr); else triangles.push(tr); };
    const F = (p) => new Jolt.Float3(p.x, p.y, p.z);
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const i00 = iz * cols + ix, i10 = i00 + 1, i01 = i00 + cols, i11 = i01 + 1;
        const a = pts[i00], b = pts[i10], cpt = pts[i01], d = pts[i11];
        if (a.y < 0.02 && b.y < 0.02 && cpt.y < 0.02 && d.y < 0.02) continue;
        // CCW when viewed from +Y so MeshShape normals point up (right-hand rule).
        add(new Jolt.Triangle(F(a), F(d), F(b)));
        add(new Jolt.Triangle(F(a), F(cpt), F(d)));
      }
    }
    if (!triangles.size()) { Jolt.destroy(triangles); continue; }
    const settings = new Jolt.MeshShapeSettings(triangles);
    const result = settings.Create();
    if (result.HasError && result.HasError()) {
      console.warn('ramp mesh failed', r.name, result.GetError && result.GetError());
      Jolt.destroy(settings);
      continue;
    }
    const shape = result.Get();
    const bodySet = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(0, 0, 0), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Static, LAYER_NON_MOVING);
    const body = bodyInterface.CreateBody(bodySet);
    body.SetFriction(1.15);
    body.SetRestitution(0);
    bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
    Jolt.destroy(bodySet);
    Jolt.destroy(settings);
  }
}

function addWalls(Jolt, bodyInterface, ter) {
  const b = ter.bounds || { xmin: -150, xmax: 150, zmin: -150, zmax: 150 };
  const t = 2, h = 8, midY = 3.5;
  const w = b.xmax - b.xmin, d = b.zmax - b.zmin;
  addStaticBox(Jolt, bodyInterface, w / 2 + t, h, t, (b.xmin + b.xmax) / 2, midY, b.zmin - t);
  addStaticBox(Jolt, bodyInterface, w / 2 + t, h, t, (b.xmin + b.xmax) / 2, midY, b.zmax + t);
  addStaticBox(Jolt, bodyInterface, t, h, d / 2 + t, b.xmin - t, midY, (b.zmin + b.zmax) / 2);
  addStaticBox(Jolt, bodyInterface, t, h, d / 2 + t, b.xmax + t, midY, (b.zmin + b.zmax) / 2);
}

function addPropColliders(Jolt, bodyInterface, colliders) {
  if (!colliders) return;
  for (const c of colliders) {
    if (c.kind === 'box') {
      const hy = Math.max(0.1, (c.y1 - c.y0) / 2);
      addStaticBox(Jolt, bodyInterface, c.hx || 0.5, hy, c.hz || 0.5, c.x, c.y0 + hy, c.z, 0.7);
    } else if (c.kind === 'cyl') {
      const hy = Math.max(0.1, (c.y1 - c.y0) / 2);
      addStaticCylinder(Jolt, bodyInterface, c.r || 0.15, hy, c.x, c.y0 + hy, c.z, 0.7);
    }
  }
}

// Jolt VehicleConstraint and the v33a sandbox are Z-forward, Y-up, X-right
// (the same as three.js and MotorcycleTest). The live game is X-forward
// (yaw 0 = +X). Convert only at the adopt/writeState boundary. Forcing
// mForward=(1,0,0) with wheels on X spun the bike out and collapsed omega.
function bodyAxes(qx, qy, qz, qw) {
  return {
    right: { x: 1 - 2 * (qy * qy + qz * qz), y: 2 * (qx * qy + qw * qz), z: 2 * (qx * qz - qw * qy) },
    up:    { x: 2 * (qx * qy - qw * qz),     y: 1 - 2 * (qx * qx + qz * qz), z: 2 * (qy * qz + qw * qx) },
    fwd:   { x: 2 * (qx * qz + qw * qy),     y: 2 * (qy * qz - qw * qx),     z: 1 - 2 * (qx * qx + qy * qy) },
  };
}

function quatFromYawPitch(Jolt, yaw, pitch) {
  // Game yaw 0 = +X; Jolt identity faces +Z, so apply yaw + π/2, then pitch about local X (right).
  const hy = (yaw + Math.PI / 2) / 2, hp = pitch / 2;
  const qy = { x: 0, y: Math.sin(hy), z: 0, w: Math.cos(hy) };
  const qp = { x: Math.sin(hp), y: 0, z: 0, w: Math.cos(hp) };
  const x = qy.w * qp.x + qy.x * qp.w + qy.y * qp.z - qy.z * qp.y;
  const y = qy.w * qp.y - qy.x * qp.z + qy.y * qp.w + qy.z * qp.x;
  const z = qy.w * qp.z + qy.x * qp.y - qy.y * qp.x + qy.z * qp.w;
  const w = qy.w * qp.w - qy.x * qp.x - qy.y * qp.y - qy.z * qp.z;
  return new Jolt.Quat(x, y, z, w);
}

function yawFromQuat(qx, qy, qz, qw) {
  const f = bodyAxes(qx, qy, qz, qw).fwd;
  return Math.atan2(f.z, f.x);
}

function pitchFromQuat(qx, qy, qz, qw) {
  const f = bodyAxes(qx, qy, qz, qw).fwd;
  return Math.asin(Math.max(-1, Math.min(1, f.y)));
}

function rollFromQuat(qx, qy, qz, qw) {
  const { fwd, up } = bodyAxes(qx, qy, qz, qw);
  const len = Math.hypot(fwd.x, fwd.z) || 1;
  const rightX = -fwd.z / len, rightZ = fwd.x / len;
  return Math.atan2(up.x * rightX + up.z * rightZ, up.y);
}

function joltBare() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('joltBare') === '1' || q.get('joltDebug') === 'bare') return true;
  } catch {}
  return !!globalThis.__WK_JOLT_BARE__;
}

const LAYER_KEYS = ['lean', 'leanSpring', 'balance', 'yawDamp', 'creep', 'nan', 'hop'];
function joltLayers() {
  const on = Object.fromEntries(LAYER_KEYS.map(k => [k, false]));
  if (joltBare()) return on;
  try {
    const q = new URLSearchParams(location.search).get('joltLayers');
    if (q != null && q !== '') {
      for (const k of q.split(',')) if (on.hasOwnProperty(k.trim())) on[k.trim()] = true;
      return on;
    }
    // no param: all on (normal play). empty joltLayers= is none (same as bare)
    if (q === '') return on;
  } catch {}
  if (globalThis.__WK_JOLT_LAYERS__) return { ...on, ...globalThis.__WK_JOLT_LAYERS__ };
  for (const k of LAYER_KEYS) on[k] = true;
  return on;
}

export function createJoltRide({ ter, P, colliders }) {
  const BARE = joltBare();
  const LAY = joltLayers();
  const api = {
    ready: false,
    enabled: true,
    error: null,
    usedHandBrakeWorkaround: false,
    air: false,
    bare: BARE, layers: LAY,
  };
  let Jolt, jolt, physicsSystem, bodyInterface, motoBody, constraint, controller;
  let currentRight = 0, hasLanded = false, airOff = 0, settleT = 0.8, adoptClearance = 1.08, syncWheelT = 0;
  let bothOffSteps = 0, leftRampFace = false;
  let wheelR = 0.33, joltMass = 115;
  let lastGood = null;
  const tmp = { destroyed: false };

  async function start() {
    if (api.ready || tmp.destroyed) return api;
    try {
      Jolt = await initJolt();
      if (tmp.destroyed) return api;
      const settings = new Jolt.JoltSettings();
      setupCollisionFiltering(Jolt, settings);
      jolt = new Jolt.JoltInterface(settings);
      Jolt.destroy(settings);
      physicsSystem = jolt.GetPhysicsSystem();
      bodyInterface = physicsSystem.GetBodyInterface();
      const hfBody = addHeightField(Jolt, bodyInterface, ter);
      api.world = { heightField: hfBody && hfBody.GetID ? hfBody.GetID().GetIndex() : null };
      // Ramp MeshShapes 2 cm above the heightfield were sapping a 16 m/s
      // run-up (front-wheel curb strike, speed gone in 2 m). The heightfield
      // already includes the ramps; wheels ride that surface alone.
      addWalls(Jolt, bodyInterface, ter);
      addPropColliders(Jolt, bodyInterface, colliders);

      // Same vehicle recipe as jolt-sandbox.js (v33a): leave mForward/mUp at
      // Jolt defaults (Z-forward, Y-up), wheels on Z, chassis on LAYER_MOVING
      // unless a later layer re-enables LAYER_CHASSIS.
      wheelR = P.R || 0.33;
      joltMass = P.mass || 115;
      const wb = P.wb || 1.34, comBack = P.comBack || 0.42, comH = P.comH || 0.9;
      const travelF = Math.max(0.08, P.travelF || 0.14);
      const travelR = Math.max(0.08, P.travelR || 0.12);
      const rearZ = -wb * comBack, frontZ = wb * (1 - comBack);
      const caster = 27 * Math.PI / 180;
      const steerMax = 33 * Math.PI / 180;
      const halfW = 0.18, halfH = 0.32, halfL = wb * 0.42;
      const attachY = -0.9 * halfH;
      // Same as the v33a sandbox: chassis on LAYER_MOVING. LAYER_CHASSIS
      // (no collisions) broke C after a 30s ride — adopt did not stop the bike.
      const chassisLayer = LAYER_MOVING;

      const comOffset = new Jolt.Vec3(0, -halfH, 0);
      const box = new Jolt.BoxShapeSettings(new Jolt.Vec3(halfW, halfH, halfL));
      const shapeSettings = new Jolt.OffsetCenterOfMassShapeSettings(comOffset, box);
      const shape = shapeSettings.Create().Get();
      const y0 = (typeof ter.height === 'function' ? ter.height(0, 0) : 0) + (comH || 0.9) + 0.08;
      const bodySet = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(0, y0, 0), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Dynamic, chassisLayer);
      bodySet.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      bodySet.mMassPropertiesOverride.mMass = joltMass;
      motoBody = bodyInterface.CreateBody(bodySet);
      motoBody.SetRestitution(0);
      bodyInterface.SetFriction(motoBody.GetID(), 0.4);
      bodyInterface.AddBody(motoBody.GetID(), Jolt.EActivation_Activate);
      Jolt.destroy(bodySet);

      const vehicle = new Jolt.VehicleConstraintSettings();
      // Do not set mForward/mUp — defaults match the sandbox and MotorcycleTest.
      vehicle.mMaxPitchRollAngle = 60 * Math.PI / 180;
      vehicle.mWheels.clear();

      const front = new Jolt.WheelSettingsWV();
      front.mPosition = new Jolt.Vec3(0, attachY, frontZ);
      front.mMaxSteerAngle = steerMax;
      front.mSuspensionDirection = new Jolt.Vec3(0, -1, Math.tan(caster)).Normalized();
      front.mSteeringAxis = new Jolt.Vec3(0, 1, -Math.tan(caster)).Normalized();
      front.mRadius = wheelR;
      front.mWidth = 0.10;
      front.mSuspensionMinLength = 0.22;
      front.mSuspensionMaxLength = 0.22 + travelF;
      front.mSuspensionSpring.mFrequency = 1.6;
      front.mMaxBrakeTorque = 220;
      front.mMaxHandBrakeTorque = 0;
      front.mInertia = 0.9;
      vehicle.mWheels.push_back(front);

      const back = new Jolt.WheelSettingsWV();
      back.mPosition = new Jolt.Vec3(0, attachY, rearZ);
      back.mMaxSteerAngle = 0;
      back.mRadius = wheelR;
      back.mWidth = 0.10;
      back.mSuspensionMinLength = 0.22;
      back.mSuspensionMaxLength = 0.22 + travelR;
      back.mSuspensionSpring.mFrequency = 2.0;
      back.mMaxBrakeTorque = 180;
      back.mMaxHandBrakeTorque = 0;
      back.mInertia = 0.9;
      vehicle.mWheels.push_back(back);

      const cs = new Jolt.MotorcycleControllerSettings();
      // Workshop e-moto motors are 250–320 Nm. Jolt's MotorcycleController is
      // tuned around 60–150 Nm (sandbox 60, MotorcycleTest 150). Feeding 320
      // raw loops a 115 kg bike out and wrecks takeoff pitch.
      cs.mEngine.mMaxTorque = Math.max(45, Math.min(90, (P.torque || 60) * 0.25));
      cs.mEngine.mMinRPM = 800;
      cs.mEngine.mMaxRPM = 9000;
      cs.mTransmission.mShiftDownRPM = 2000;
      cs.mTransmission.mShiftUpRPM = 7500;
      cs.mTransmission.mClutchStrength = 2.0;
      if (LAY.leanSpring) {
        cs.mMaxLeanAngle = 36 * Math.PI / 180;
        cs.mLeanSpringConstant = 2600;
        cs.mLeanSpringDamping = 1100;
        cs.mLeanSpringIntegrationCoefficient = 0;
        cs.mLeanSpringIntegrationCoefficientDecay = 4;
        if (cs.mLeanSmoothingFactor !== undefined) cs.mLeanSmoothingFactor = 0.82;
      } else {
        cs.mMaxLeanAngle = 48 * Math.PI / 180;
      }
      vehicle.mController = cs;
      cs.mDifferentials.clear();
      const differential = new Jolt.VehicleDifferentialSettings();
      differential.mLeftWheel = -1;
      differential.mRightWheel = 1;
      differential.mDifferentialRatio = 4.8;
      cs.mDifferentials.push_back(differential);

      constraint = new Jolt.VehicleConstraint(motoBody, vehicle);
      constraint.SetVehicleCollisionTester(new Jolt.VehicleCollisionTesterCastCylinder(LAYER_MOVING, 1));
      physicsSystem.AddConstraint(constraint);
      physicsSystem.AddStepListener(new Jolt.VehicleConstraintStepListener(constraint));
      controller = Jolt.castObject(constraint.GetController(), Jolt.MotorcycleController);

      const dirYZ = -1 / Math.hypot(1, Math.tan(caster));
      const belowF = -attachY - dirYZ * front.mSuspensionMaxLength + wheelR;
      const belowR = -attachY + back.mSuspensionMaxLength + wheelR;
      adoptClearance = Math.max(belowF, belowR) + 0.03;
      api.bare = BARE;
      api.forward = 'z';

      api.ready = true;
    } catch (e) {
      api.error = (e && e.message) || String(e);
      console.error('Jolt arena init failed', e);
    }
    return api;
  }

  function poseOf() {
    const p = motoBody.GetPosition(), r = motoBody.GetRotation();
    return { x: p.GetX(), y: p.GetY(), z: p.GetZ(), qx: r.GetX(), qy: r.GetY(), qz: r.GetZ(), qw: r.GetW() };
  }

  function applyDriverInput(forward, right, brake, handBrake) {
    const hb = handBrake ? 1 : 0;
    // Front hand-brake torque is 0 unless we are actually in a low-speed burnout,
    // so a stuck mHandBrakeInput cannot lock the front wheel at speed.
    try {
      const raw = constraint.GetWheel(0);
      const wh = Jolt.castObject ? Jolt.castObject(raw, Jolt.WheelWV) : raw;
      const st = wh.GetSettings ? wh.GetSettings() : null;
      if (st && st.mMaxHandBrakeTorque !== undefined) st.mMaxHandBrakeTorque = hb ? 700 : 0;
      if (wh.mBrakeImpulse !== undefined && !hb) wh.mBrakeImpulse = 0;
    } catch {}
    controller.SetDriverInput(forward, right, brake, hb);
    if (controller.SetHandBrakeInput) controller.SetHandBrakeInput(hb);
    if (controller.SetBrakeInput) controller.SetBrakeInput(brake);
    if (controller.SetForwardInput) controller.SetForwardInput(forward);
  }

  function setWheels(omega) {
    for (let i = 0; i < 2; i++) {
      const raw = constraint.GetWheel(i);
      const wh = Jolt.castObject ? Jolt.castObject(raw, Jolt.WheelWV) : raw;
      if (wh.SetAngularVelocity) wh.SetAngularVelocity(omega);
      if (raw.SetAngularVelocity && raw !== wh) raw.SetAngularVelocity(omega);
      if (wh.SetSteerAngle) wh.SetSteerAngle(0);
    }
  }

  function readWheelOmega() {
    const o = [0, 0];
    for (let i = 0; i < 2; i++) {
      const raw = constraint.GetWheel(i);
      const wh = Jolt.castObject ? Jolt.castObject(raw, Jolt.WheelWV) : raw;
      o[i] = wh.GetAngularVelocity ? wh.GetAngularVelocity() : 0;
    }
    return o;
  }

  function syncEngineToSpeed(speed) {
    try {
      const eng = controller.GetEngine && controller.GetEngine();
      if (eng && eng.SetCurrentRPM) {
        const omega = Math.abs(speed) / Math.max(0.2, wheelR);
        // A rest adopt must actually kill residual RPM. Leaving a mid-ride
        // engine (or Math.max(1200,...)) dumps torque into zeroed wheels
        // and the bike walks off at several m/s with the throttle closed.
        const rpm = Math.abs(speed) < 0.2
          ? 0
          : Math.max(1200, Math.min(8000, omega * 4.8 * 2.2 * 60 / (2 * Math.PI)));
        eng.SetCurrentRPM(rpm);
      }
      const tr = controller.GetTransmission && controller.GetTransmission();
      if (tr && tr.SetCurrentGear && Math.abs(speed) < 0.2) tr.SetCurrentGear(1);
    } catch {}
  }

  function placeBody(x, y, z, q, vx, vy, vz, omega) {
    if (constraint.ResetWarmStart) constraint.ResetWarmStart();
    if (motoBody.ResetForce) motoBody.ResetForce();
    if (motoBody.ResetTorque) motoBody.ResetTorque();
    bodyInterface.SetPositionRotationAndVelocity(
      motoBody.GetID(),
      new Jolt.RVec3(x, y, z),
      q,
      new Jolt.Vec3(vx, vy, vz),
      new Jolt.Vec3(0, 0, 0)
    );
    setWheels(omega);
    if (constraint.ResetWarmStart) constraint.ResetWarmStart();
    if (motoBody.ResetForce) motoBody.ResetForce();
    if (motoBody.ResetTorque) motoBody.ResetTorque();
    // ResetWarmStart can drop a just-written omega; set it last.
    setWheels(omega);
    bodyInterface.ActivateBody(motoBody.GetID());
  }

  function adopt(s) {
    if (!api.ready || !motoBody) return;
    const yaw = s.yaw || 0, pitch = s.pitch || 0;
    const q = quatFromYawPitch(Jolt, yaw, pitch);
    const vx = (s.vx || 0) * Math.cos(yaw);
    const vz = (s.vx || 0) * Math.sin(yaw);
    const omega = (s.vx || 0) / Math.max(0.2, wheelR);
    controller.EnableLeanController(false);
    applyDriverInput(0, 0, 0, 0);
    const groundY = ter && typeof ter.height === 'function' ? (ter.height(s.x, s.z || 0) || 0) : 0;
    const minY = groundY + adoptClearance;
    // Only lift a moving teleport. A 10 cm drop at standstill/burnout bounces
    // the bike; a 16 m/s adopt at classic comH buries the forks and stoppies.
    const moving = Math.abs(s.vx || 0) > 2 || Math.abs(s.vy || 0) > 1;
    let y = (s.y != null) ? s.y : minY;
    if (moving && y < minY) y = minY;
    // Ground teleports at speed: settle the suspension at rest first, then
    // apply the run-up. Skipping that plants a locked or buried front wheel
    // and the bike endos on the flat. Air landings keep the incoming pose.
    const fromAir = s.air > 0.05;
    const groundTeleport = moving && !fromAir;
    if (groundTeleport || !fromAir) {
      placeBody(s.x, y, s.z || 0, q, 0, 0, 0, 0);
      syncEngineToSpeed(0);
      const settleN = groundTeleport ? 36 : 24;
      for (let i = 0; i < settleN; i++) {
        applyDriverInput(0, 0, 0, 0);
        jolt.Step(1 / 120, 1);
      }
      const settled = poseOf();
      // Ride height is whatever the suspension settled at. Lifting to comH
      // puts the wheels in the air and the 16 m/s run-up falls into a stoppie.
      y = (settled.y > 0.5 && settled.y < 1.6) ? settled.y : (groundY + (P.comH || 0.95));
      placeBody(s.x, y, s.z || 0, q, vx, s.vy || 0, vz, omega);
    } else {
      placeBody(s.x, y, s.z || 0, q, vx, s.vy || 0, vz, omega);
    }
    currentRight = 0;
    hasLanded = !!(s.ground && (s.ground[0] || s.ground[1]));
    airOff = 0;
    bothOffSteps = 0;
    leftRampFace = false;
    // Lean stays off briefly so a mid-speed teleport does not lean-steer.
    // Balance assist stays on so the bike cannot flop during that window.
    settleT = fromAir ? 0.2 : 0.7;
    // Sync rolling omega after a high-speed teleport and after an air landing.
    syncWheelT = (groundTeleport || fromAir) ? 0.12 : 0;
    syncEngineToSpeed(s.vx || 0);
    api.air = false;
    // Keep the takeoff log across a landing adopt so tests can see the handover.
    if (!fromAir) handovers.length = 0;
    writeState(s, P);
    api.lastAdopt = { y, vx: s.vx, omegaSet: omega, omega: readWheelOmega(), groundTeleport, syncWheelT };
  }

  function writeState(s, P) {
    const p = poseOf();
    const v = motoBody.GetLinearVelocity();
    const av = motoBody.GetAngularVelocity();
    const yaw = yawFromQuat(p.qx, p.qy, p.qz, p.qw);
    const pitch = pitchFromQuat(p.qx, p.qy, p.qz, p.qw);
    const roll = rollFromQuat(p.qx, p.qy, p.qz, p.qw);
    const c = Math.cos(yaw), n = Math.sin(yaw);
    const vxFwd = v.GetX() * c + v.GetZ() * n;
    const wF = constraint.GetWheel(0), wR = constraint.GetWheel(1);
    const onF = wF.HasContact(), onR = wR.HasContact();
    const omegaR = Jolt.castObject(wR, Jolt.WheelWV).GetAngularVelocity();
    const omegaF = Jolt.castObject(wF, Jolt.WheelWV).GetAngularVelocity();
    s.x = p.x; s.y = p.y; s.z = p.z;
    s.yaw = yaw; s.pitch = pitch;
    s.joltRoll = Math.max(-0.7, Math.min(0.7, roll));
    s.joltRollRaw = roll;
    s.vx = vxFwd;
    s.vy = v.GetY();
    // Pitch rate around Jolt's local +X (right). Right-hand +ωx is nose-down;
    // classic s.pitch / s.w are nose-up positive, so flip the sign at the boundary.
    const axes = bodyAxes(p.qx, p.qy, p.qz, p.qw);
    s.w = -(av.GetX() * axes.right.x + av.GetY() * axes.right.y + av.GetZ() * axes.right.z);
    s.ground = [onR, onF];
    s.wheelOmega = s.wheelOmega || [0, 0];
    s.slip = s.slip || [0, 0];
    s.wheelOmega[0] = omegaR; s.wheelOmega[1] = omegaF;
    s.slip[0] = omegaR * wheelR - vxFwd;
    s.slip[1] = omegaF * wheelR - vxFwd;
    s.steer = currentRight * 33 * Math.PI / 180;
    if ([s.x, s.y, s.z, s.yaw, s.vx].every(Number.isFinite)) {
      lastGood = { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, vx: s.vx, vy: s.vy, w: 0, ground: [true, true] };
    }
    const lenF = wF.GetSuspensionLength ? wF.GetSuspensionLength() : 0;
    const lenR = wR.GetSuspensionLength ? wR.GetSuspensionLength() : 0;
    // compression 0..1 roughly
    s.comp = s.comp || [0, 0];
    const travelR = Math.max(0.08, P.travelR || 0.12), travelF = Math.max(0.08, P.travelF || 0.14);
    s.curvature = Math.abs(s.vx) > 0.4 ? (s.wYaw || 0) / Math.max(0.4, s.vx) : 0;
  }


  function limitCreep() {
    const p = poseOf();
    const yaw = yawFromQuat(p.qx, p.qy, p.qz, p.qw);
    const fx = Math.cos(yaw), fz = Math.sin(yaw);
    const vel = motoBody.GetLinearVelocity();
    if (![vel.GetX(), vel.GetY(), vel.GetZ()].every(Number.isFinite)) return;
    const vxFwd = vel.GetX() * fx + vel.GetZ() * fz;
    motoBody.SetLinearVelocity(new Jolt.Vec3(
      vel.GetX() + (CREEP - vxFwd) * fx,
      vel.GetY(),
      vel.GetZ() + (CREEP - vxFwd) * fz
    ));
  }

  function applyBalance(dt, speed, onG, mass, leanOn) {
    if (!onG) return;
    let fade = speed <= BALANCE_FULL ? 1 : speed >= BALANCE_END ? 0 : 1 - (speed - BALANCE_FULL) / (BALANCE_END - BALANCE_FULL);
    // Lean is off on ramps and during settle, and the low-speed assist has
    // already faded out at a 16 m/s run-up. Keep an upright torque so the
    // bike cannot flop on the takeoff face.
    if (!leanOn) fade = Math.max(fade, 0.85);
    if (fade <= 0.001) return;
    const p = poseOf();
    const roll = rollFromQuat(p.qx, p.qy, p.qz, p.qw);
    const yaw = yawFromQuat(p.qx, p.qy, p.qz, p.qw);
    const av = motoBody.GetAngularVelocity();
    // Forward axis in world (roll axis)
    const fx = Math.cos(yaw), fz = Math.sin(yaw);
    const rollRate = av.GetX() * fx + av.GetZ() * fz;
    const stiffness = 90 * mass;
    const damping = 20 * mass;
    const tau = (-stiffness * roll - damping * rollRate) * fade;
    motoBody.AddTorque(new Jolt.Vec3(fx * tau, 0, fz * tau));
  }


  // Locate the bike on a kicker, in that jump's corridor, along the ramp axis.
  function lipInfo(x, z, ter) {
    for (const r of ter.ramps || []) {
      if (r.kind === 'table') continue;
      const c = Math.cos(r.yaw || 0), n = Math.sin(r.yaw || 0);
      const lx = (x - r.x) * c + ((z || 0) - r.z) * n;
      const lz = -(x - r.x) * n + ((z || 0) - r.z) * c;
      if (Math.abs(lz) > (r.w || 6) / 2 + 1.5) continue;
      const takeoff = r.takeoff || 0;
      const onFace = lx > -3 && lx < takeoff - 0.15;
      const after = takeoff + (r.back || 0) + (r.gap || 0) + 2;
      const pastLip = lx >= takeoff - 0.15 && lx < after;
      if (onFace || pastLip) return { r, lx, lz, takeoff, onFace, pastLip };
    }
    return null;
  }
  function pastKickerLip(x, z, ter) {
    const info = lipInfo(x, z, ter);
    return !!(info && info.pastLip);
  }

  const handovers = [];
  function logHandover(kind, s, ter, extra) {
    const rec = { kind, x: s.x, y: s.y, z: s.z || 0, yaw: s.yaw, vx: s.vx, vy: s.vy, air: s.air, apiAir: api.air, ...extra };
    if (ter && ter.ramps) {
      const r = ter.ramps.find(rr => rr.name === 'large') || ter.ramps[0];
      if (r) {
        const c = Math.cos(r.yaw || 0), n = Math.sin(r.yaw || 0);
        rec.lx = (s.x - r.x) * c + ((s.z || 0) - r.z) * n;
        rec.lz = -(s.x - r.x) * n + ((s.z || 0) - r.z) * c;
        rec.rampH = arenaRamp(s.x, s.z || 0, r) || 0;
      }
    }
    handovers.push(rec);
    if (handovers.length > 24) handovers.shift();
    try { console.log('WK handover', JSON.stringify(rec)); } catch {}
  }


  function preGround(s, P, inp, dt, ter) {
    const wF = constraint.GetWheel(0), wR = constraint.GetWheel(1);
    const onF = wF.HasContact(), onR = wR.HasContact();
    const onG = onF || onR;
    const v = motoBody.GetLinearVelocity();
    const speed = Math.hypot(v.GetX(), v.GetZ());
    const target = Math.max(-1, Math.min(1, inp.steer || 0));
    const steerSpeed = 6;
    if (target > currentRight) currentRight = Math.min(currentRight + steerSpeed * dt, target);
    else if (target < currentRight) currentRight = Math.max(currentRight - steerSpeed * dt, target);

    if (onG) { hasLanded = true; airOff = 0; }
    else airOff += dt;
    if (settleT) settleT = Math.max(0, settleT - dt);
    const wantGo = inp.throttle > 0.5, wantStop = inp.brake > 0.5;
    // Front hand-brake is the burnout workaround only. Never latch it on a
    // 16 m/s run-up: Jolt locks a wheel when brakeTorque exceeds I*w/dt.
    const burnout = wantGo && wantStop && speed < 2.0;
    const pose = poseOf();
    const groundY = ter && ter.height ? (ter.height(pose.x, pose.z) || 0) : 0;
    // Lean-steer on a takeoff or during a burnout yaws the bike unexpectedly.
    const leanOn = LAY.lean && settleT <= 0 && groundY < 0.35 && !burnout;
    controller.EnableLeanController(leanOn);
    const canSteer = burnout || speed > 0.55;
    let forward = 0, brake = 0, handBrake = 0;
    if (burnout) {
      forward = 1; handBrake = 1; brake = 0;
      api.usedHandBrakeWorkaround = true;
    } else {
      forward = Math.max(0, Math.min(1, inp.throttle || 0));
      brake = Math.max(0, Math.min(1, inp.brake || 0));
    }
    // Gentle anti-wheelie: cut rear torque when the front unloads or the
    // nose-up pitch rate is high — same idea as traction/wheelie control.
    // Do not use this on a burnout, and don't fight a planted takeoff face.
    if (!burnout && forward > 0 && onR && !BARE) {
      const axes = bodyAxes(pose.qx, pose.qy, pose.qz, pose.qw);
      const avw = motoBody.GetAngularVelocity();
      const noseUpRate = -(avw.GetX() * axes.right.x + avw.GetY() * axes.right.y + avw.GetZ() * axes.right.z);
      let cut = 0;
      if (!onF) cut = Math.max(cut, 0.85);
      if (noseUpRate > 1.15) cut = Math.max(cut, Math.min(0.9, (noseUpRate - 1.15) / 2.8));
      forward *= (1 - cut);
    }
    const right = canSteer ? currentRight : 0;
    if (LAY.hop && inp.hop && onF && onR && speed < 8) {
      motoBody.SetLinearVelocity(new Jolt.Vec3(v.GetX(), v.GetY() + 3.4, v.GetZ()));
    }
    applyDriverInput(forward, right, brake, handBrake);
    if (forward || right || brake || handBrake) bodyInterface.ActivateBody(motoBody.GetID());
    // Brief rolling-omega lock-in after a high-speed teleport only.
    if (syncWheelT > 0 && !burnout) {
      const yawNow = yawFromQuat(pose.qx, pose.qy, pose.qz, pose.qw);
      const vxNow = v.GetX() * Math.cos(yawNow) + v.GetZ() * Math.sin(yawNow);
      setWheels(vxNow / Math.max(0.2, wheelR));
      syncEngineToSpeed(vxNow);
      syncWheelT = Math.max(0, syncWheelT - dt);
    }

    if (LAY.balance) applyBalance(dt, speed, onG, joltMass, leanOn);
    // With the bars straight, kill uncommanded yaw on a run-up or ramp so a
    // 16 m/s approach does not wander off a 6 m kicker. Leave free riding alone.
    if (LAY.yawDamp && onG && Math.abs(currentRight) < 0.08 && speed > 1.5 && (settleT > 0 || groundY > 0.25)) {
      const av = motoBody.GetAngularVelocity();
      motoBody.SetAngularVelocity(new Jolt.Vec3(av.GetX(), av.GetY() * 0.12, av.GetZ()));
    }

    if (LAY.creep && burnout && onG) {
      limitCreep();
      if (Math.abs(currentRight) > 0.05) {
        const p = poseOf();
        const yaw = yawFromQuat(p.qx, p.qy, p.qz, p.qw);
        const fx = Math.cos(yaw), fz = Math.sin(yaw);
        const front = (P.wb || 1.34) * (1 - (P.comBack || 0.42));
        const px = p.x + fx * front, pz = p.z + fz * front;
        const dYaw = currentRight * STEER_BURNOUT * dt;
        const yaw2 = yaw + dYaw;
        const nx = px - Math.cos(yaw2) * front;
        const nz = pz - Math.sin(yaw2) * front;
        const r = motoBody.GetRotation();
        // premultiply world-Y rotation
        const hy = dYaw / 2, dy = Math.sin(hy), dw = Math.cos(hy);
        const qx = r.GetX(), qy = r.GetY(), qz = r.GetZ(), qw = r.GetW();
        const nqx = dw * qx + dy * qz;
        const nqy = dw * qy + dy * qw;
        const nqz = dw * qz - dy * qx;
        const nqw = dw * qw - dy * qy;
        bodyInterface.SetPositionAndRotation(
          motoBody.GetID(),
          new Jolt.RVec3(nx, p.y, nz),
          new Jolt.Quat(nqx, nqy, nqz, nqw),
          Jolt.EActivation_Activate
        );
      }
    }
    s.burnout = !!(burnout && onG);
    return { onG, speed };
  }

  function step(s, P, inp, dt, ter, classicStep) {
    if (!api.ready || !api.enabled || tmp.destroyed || dt <= 0) return;
    if (api.air) {
      // classicStep zeroes s.air on a successful landing, so snapshot first.
      const airBefore = s.air;
      classicStep(s, P, inp, dt, ter);
      if (!s.crashed && (s.ground[0] || s.ground[1]) && airBefore > 0.08) {
        // classicStep already cleared s.air; restore it so adopt treats this
        // as a landing (omega sync, no 36-step rest settle, keep handover log).
        s.air = airBefore;
        api.air = false;
        airOff = 0;
        adopt(s);
        s.air = 0;
        settleT = 0.2;
      }
      return;
    }
    const info = preGround(s, P, inp, dt, ter);
    jolt.Step(dt, dt > 1 / 55 ? 2 : 1);
    writeState(s, P);
    if (![s.x, s.y, s.z, s.yaw, s.vx].every(Number.isFinite)) {
      if (LAY.nan && lastGood) adopt(lastGood);
      return;
    }
    if (LAY.creep && s.burnout) {
      limitCreep();
      writeState(s, P);
    }
    const clearance = s.y - (ter.height ? ter.height(s.x, s.z || 0) : 0);
    const vy = motoBody.GetLinearVelocity().GetY();
    // Keep s.air at 0 while Jolt is driving so a wheel unload cannot look like a launch.
    s.air = 0;
    const onR = !!(s.ground && s.ground[0]), onF = !!(s.ground && s.ground[1]);
    const sub = dt > 1 / 55 ? 2 : 1;
    const lip = lipInfo(s.x, s.z, ter);
    if (lip && lip.onFace) leftRampFace = true;
    if (onF || onR) bothOffSteps = 0;
    else bothOffSteps += sub;
    // Hand over once the chassis is past the lip line (rear contact may still
    // be true), or both wheels have been off for 2+ substeps after the face.
    const pastLine = !!(lip && lip.pastLip);
    const bothOffAfterFace = bothOffSteps >= 2 && leftRampFace && !!(!lip || !lip.onFace);
    const wantAir = hasLanded && settleT <= 0 && info.speed > 1.5 && (pastLine || bothOffAfterFace);
    if (wantAir && lip && lip.onFace) {
      logHandover('blocked', s, ter, { clearance, vy, airOff, speed: info.speed, onG: onF || onR, settleT, pastLine, bothOffSteps, onF, onR });
    }
    if (wantAir && (pastLine || bothOffAfterFace) && !(lip && lip.onFace)) {
      const WMAX = 3.5;
      s.w = Math.max(-WMAX, Math.min(WMAX, s.w || 0));
      s.ground = [false, false];
      logHandover('air', s, ter, { clearance, vy, airOff, speed: info.speed, onG: onF || onR, settleT, pastLine, bothOffSteps, w: s.w, pitch: s.pitch, onF, onR });
      api.air = true;
      s.joltRoll = null;
      s.wasAir = true;
      s.air = 0;
      s.airRot = 0;
      s.spin = 0;
      s.spinV = 0;
      leftRampFace = false;
      bothOffSteps = 0;
      controller.EnableLeanController(false);
      applyDriverInput(0, 0, 0, 0);
    }
  }

  function dispose() {
    tmp.destroyed = true;
    api.ready = false;
    api.enabled = false;
    try { if (jolt) { jolt.Destroy && jolt.Destroy(); } } catch {}
    Jolt = jolt = physicsSystem = bodyInterface = motoBody = constraint = controller = null;
  }

  api.start = start;
  api.step = step;
  api.adopt = adopt;
  api.dispose = dispose;
  function wheelHit(w) {
    if (!w || !w.HasContact || !w.HasContact()) return null;
    try {
      const id = w.GetContactBodyID && w.GetContactBodyID();
      const n = w.GetContactNormal && w.GetContactNormal();
      const pt = w.GetContactPosition && w.GetContactPosition();
      return {
        body: id && id.GetIndex ? id.GetIndex() : null,
        seq: id && id.GetIndexAndSequenceNumber ? id.GetIndexAndSequenceNumber() : null,
        nx: n ? +n.GetX().toFixed(3) : 0,
        ny: n ? +n.GetY().toFixed(3) : 0,
        nz: n ? +n.GetZ().toFixed(3) : 0,
        px: pt ? +pt.GetX().toFixed(3) : 0,
        py: pt ? +pt.GetY().toFixed(3) : 0,
        pz: pt ? +pt.GetZ().toFixed(3) : 0,
        hard: !!(w.HasHitHardPoint && w.HasHitHardPoint()),
        susp: w.GetSuspensionLength ? +w.GetSuspensionLength().toFixed(3) : null,
      };
    } catch { return { err: true }; }
  }

  api.dump = () => {
    if (!api.ready) return { ready: false, error: api.error };
    const p = poseOf();
    const wF = constraint && constraint.GetWheel(0);
    const wR = constraint && constraint.GetWheel(1);
    return {
      ready: true, air: api.air, error: api.error, bare: BARE, layers: LAY, forward: api.forward || 'z', world: api.world || null,
      contact: { rear: wheelHit(wR), front: wheelHit(wF) },
      handBrakeWorkaround: api.usedHandBrakeWorkaround,
      lastAdopt: api.lastAdopt || null,
      driver: controller ? {
        forward: controller.GetForwardInput ? controller.GetForwardInput() : 0,
        right: controller.GetRightInput ? controller.GetRightInput() : 0,
        brake: controller.GetBrakeInput ? controller.GetBrakeInput() : 0,
        handBrake: controller.GetHandBrakeInput ? controller.GetHandBrakeInput() : 0,
      } : null,
      x: p.x, y: p.y, z: p.z,
      roll: rollFromQuat(p.qx, p.qy, p.qz, p.qw),
      handovers: handovers.slice(),
    };
  };
  return api;
}
