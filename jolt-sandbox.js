// Standalone Jolt MotorcycleController sandbox. Does not import or change ride-physics.js.
// Ground: Jolt. Air: a copy of the current trick / pitch-rotation rules, then Jolt resumes on landing.
import * as T from './vendor/three.module.js';
import initJolt from './vendor/jolt/jolt-physics.wasm.js';

const EMOTO = {
  mass: 40 + 75,      // bike + rider, same as bikeParams({kg:40})
  wb: 1.34,
  wheelR: 0.33,       // 0.66 m diameter
  wheelW: 0.10,
  comBack: 0.42,
  comH: 0.90,
  torque: 60,         // bikeParams default nm
  power: 4000,
  travelF: 0.14,
  travelR: 0.12,
  steerMax: 33 * Math.PI / 180,
  caster: 27 * Math.PI / 180,
};

const LAYER_NON_MOVING = 0, LAYER_MOVING = 1, NUM_OBJECT_LAYERS = 2;
const $ = (s) => document.querySelector(s);
const put = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };

const inp = { throttle: 0, brake: 0, steer: 0, lean: 0, hop: 0, trick: 0 };
const keys = {
  KeyW: 'throttle', ArrowUp: 'up', KeyS: 'brake', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'hop', KeyT: 'trick',
};

function bindInput() {
  const hold = (name, v) => {
    if (name === 'throttle') inp.throttle = v;
    else if (name === 'brake') inp.brake = v;
    else if (name === 'left') inp.steer = v ? -1 : (inp.steer < 0 ? 0 : inp.steer);
    else if (name === 'right') inp.steer = v ? 1 : (inp.steer > 0 ? 0 : inp.steer);
    else if (name === 'up') inp.lean = v ? -1 : (inp.lean < 0 ? 0 : inp.lean);
    else if (name === 'down') inp.lean = v ? 1 : (inp.lean > 0 ? 0 : inp.lean);
    else if (name === 'hop') inp.hop = v;
    else if (name === 'trick') inp.trick = v;
    const btn = document.querySelector(`[data-k="${name}"]`) ||
      (name === 'up' || name === 'down' ? document.querySelector(`[data-k="${name}"]`) : null);
    const map = { throttle: 'throttle', brake: 'brake', left: 'left', right: 'right', up: 'up', down: 'down', hop: 'hop', trick: 'trick' };
    const b = document.querySelector(`[data-k="${map[name] || name}"]`);
    if (b) b.classList.toggle('on', !!v);
  };
  addEventListener('keydown', (e) => { const k = keys[e.code]; if (!k) return; e.preventDefault(); hold(k === 'up' || k === 'down' ? k : k, 1); });
  addEventListener('keyup', (e) => { const k = keys[e.code]; if (!k) return; e.preventDefault(); hold(k, 0); });
  for (const b of document.querySelectorAll('[data-k]')) {
    const name = b.getAttribute('data-k');
    const on = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); hold(name, 1); };
    const off = (e) => { e.preventDefault(); hold(name, 0); };
    b.addEventListener('pointerdown', on);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, off);
  }
}

function grassTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3f7a3a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const n = Math.abs(Math.sin(i * 12.99) * 43758.5) % 1, m = Math.abs(Math.sin(i * 78.23) * 24634.8) % 1, p = Math.abs(Math.sin(i * 3.7 + n) * 91873) % 1;
    g.fillStyle = p > .7 ? '#5a9a48' : p > .4 ? '#2f6a32' : '#4a8a3e';
    g.globalAlpha = .35 + .5 * n; g.fillRect((n * 256) | 0, (m * 256) | 0, 2, 2);
  }
  g.globalAlpha = 1;
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(18, 18);
  return t;
}
function dirtTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6a5134'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const n = Math.abs(Math.sin(i * 12.99) * 43758.5) % 1, m = Math.abs(Math.sin(i * 78.23) * 24634.8) % 1;
    g.fillStyle = n > .55 ? '#8a6a42' : '#4a3824'; g.globalAlpha = .4 + .4 * n; g.fillRect((n * 256) | 0, (m * 256) | 0, 3, 2);
  }
  g.globalAlpha = 1;
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(8, 40);
  return t;
}

function buildEmoto(scene) {
  // Group origin = Jolt body origin (COM), Z-forward, so wheel local transforms apply directly.
  const g = new T.Group(); g.name = 'wk:emoto';
  const mat = (c, extra = {}) => new T.MeshStandardMaterial({ color: c, roughness: .55, metalness: .25, ...extra });
  const mesh = (geo, m, x, y, z, parent = g) => {
    const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
  };
  const R = EMOTO.wheelR, wb = EMOTO.wb, com = EMOTO.comBack;
  const rearZ = -wb * com, frontZ = wb * (1 - com);
  const y0 = -EMOTO.comH + R; // ground-relative inside body space (COM at y=0)
  mesh(new T.BoxGeometry(.16, .22, 1.05), mat('#252d33'), 0, y0 + .62, (rearZ + frontZ) / 2);
  mesh(new T.BoxGeometry(.28, .28, .55), mat('#1a1f24'), 0, y0 + .70, rearZ + .35);
  const fork = new T.Group(); fork.name = 'wk:fork'; fork.position.set(0, y0 + .78, frontZ - .02); g.add(fork);
  const bars = new T.Mesh(new T.CylinderGeometry(.018, .018, .62, 10), mat('#222')); bars.rotation.z = Math.PI / 2; bars.position.y = .22; bars.castShadow = true; fork.add(bars);
  const stem = new T.Mesh(new T.CylinderGeometry(.03, .025, .42, 10), mat('#333')); stem.position.set(0, -.05, 0); stem.rotation.x = .2; stem.castShadow = true; fork.add(stem);
  mesh(new T.BoxGeometry(.2, .08, .42), mat('#1c1c1e'), 0, y0 + .92, rearZ + .15);
  const rider = new T.Group(); rider.position.set(0, y0 + 1.05, rearZ + .22); g.add(rider);
  mesh(new T.SphereGeometry(.11, 12, 10), mat('#f0d0a0'), 0, .52, .04, rider);
  mesh(new T.SphereGeometry(.12, 10, 8), mat('#c8e05a'), 0, .56, .02, rider);
  mesh(new T.BoxGeometry(.28, .38, .2), mat('#2a6bd4'), 0, .22, 0, rider);
  mesh(new T.BoxGeometry(.22, .32, .28), mat('#1a1a1e'), 0, -.1, .02, rider);
  const wheelMat = mat('#111');
  const makeWheel = (z) => {
    const w = new T.Mesh(new T.CylinderGeometry(R, R, EMOTO.wheelW, 20), wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(0, y0 + R, z); w.castShadow = true; w.receiveShadow = true; g.add(w);
    return w;
  };
  const wR = makeWheel(rearZ), wF = makeWheel(frontZ);
  scene.add(g);
  return { root: g, fork, wheelR: wR, wheelF: wF, rearZ, frontZ };
}

function setupCollisionFiltering(Jolt, settings) {
  const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
  objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
  objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);
  const BP_NON = new Jolt.BroadPhaseLayer(0), BP_MOV = new Jolt.BroadPhaseLayer(1);
  const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, 2);
  bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, BP_NON);
  bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, BP_MOV);
  settings.mObjectLayerPairFilter = objectFilter;
  settings.mBroadPhaseLayerInterface = bpInterface;
  settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(bpInterface, 2, objectFilter, NUM_OBJECT_LAYERS);
}

function addStaticBox(Jolt, bodyInterface, scene, hx, hy, hz, x, y, z, mat, rotY = 0) {
  const shape = new Jolt.BoxShape(new Jolt.Vec3(hx, hy, hz));
  const q = rotY ? Jolt.Quat.prototype.sRotation(new Jolt.Vec3(0, 1, 0), rotY) : new Jolt.Quat(0, 0, 0, 1);
  const settings = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(x, y, z), q, Jolt.EMotionType_Static, LAYER_NON_MOVING);
  const body = bodyInterface.CreateBody(settings);
  body.SetFriction(1.1);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(settings);
  const mesh = new T.Mesh(new T.BoxGeometry(hx * 2, hy * 2, hz * 2), mat);
  mesh.position.set(x, y, z); mesh.rotation.y = rotY; mesh.receiveShadow = true; mesh.castShadow = true;
  scene.add(mesh);
  return body;
}

// Copied air / trick rules from the current game (ride-physics.js), used only while airborne.
function stepAirCopy(s, dt) {
  // s.w is pitch rate. Lean in the air adds the same 11 rad/s² taper as the live game.
  s.w += inp.lean * 11 * dt * Math.max(0, 1 - Math.max(0, Math.sign(inp.lean) * s.w - 6) / 3);
  s.w *= Math.exp(-.22 * dt);
  s.pitch += s.w * dt;
  s.air += dt;
  s.airRot += s.w * dt;
  if (s.spinV) {
    s.spin += s.spinV * dt;
    if (Math.abs(s.spin) >= Math.PI * 2) { s.spin = 0; s.spinV = 0; s.pendingSpin = (s.pendingSpin || 0) + 1; }
  }
  if (inp.trick && s.air > 0.15 && !s.spinV) s.spinV = 2 * Math.PI / 0.7;
}

async function main() {
  bindInput();
  const el = $('#view');
  const hud = { speed: $('[data-h=speed]'), mode: $('[data-h=mode]'), info: $('[data-h=info]'), fps: $('[data-h=fps]'), msg: $('[data-h=msg]'), status: $('[data-h=status]') };
  put(hud.status, 'Loading Jolt WASM…');

  const Jolt = await initJolt();
  const settings = new Jolt.JoltSettings();
  setupCollisionFiltering(Jolt, settings);
  const jolt = new Jolt.JoltInterface(settings);
  Jolt.destroy(settings);
  const physicsSystem = jolt.GetPhysicsSystem();
  const bodyInterface = physicsSystem.GetBodyInterface();

  // Renderer + chase cam + shadows (same idea as the live arena chase).
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setSize(el.clientWidth || innerWidth, el.clientHeight || innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  el.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color('#5c4c68');
  scene.fog = new T.Fog('#5c4c68', 40, 160);
  const cam = new T.PerspectiveCamera(64, (el.clientWidth || 16) / (el.clientHeight || 9), 0.1, 400);
  scene.add(new T.HemisphereLight('#d3d4ff', '#725d89', 1.4));
  const sun = new T.DirectionalLight('#ffd7c6', 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 2, far: 48 });
  scene.add(sun, sun.target);

  // Arena-like ground: grass off the strip, packed dirt on the runway, two kickers.
  const FLOOR = 200;
  const floorMat = new T.MeshStandardMaterial({ map: grassTex(), color: '#5a8a4a', roughness: .94 });
  const floor = new T.Mesh(new T.PlaneGeometry(FLOOR * 2, FLOOR * 2), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  addStaticBox(Jolt, bodyInterface, scene, FLOOR, .5, FLOOR, 0, -.5, 0, new T.MeshStandardMaterial({ visible: false }));

  const dirtMat = new T.MeshStandardMaterial({ map: dirtTex(), color: '#6b5134', roughness: .92 });
  const runway = new T.Mesh(new T.PlaneGeometry(6, 140), dirtMat);
  runway.rotation.x = -Math.PI / 2; runway.position.set(0, 0.02, 30); runway.receiveShadow = true; scene.add(runway);

  const jumpMat = new T.MeshStandardMaterial({ color: '#b06a3a', roughness: .9 });
  // Small kicker: 8 m long, 1.1 m lip. Large: 16 m long, 2.0 m lip. Placed along +Z.
  function addKicker(z0, len, peak, w = 3.2) {
    const take = len * 0.62, angle = Math.atan2(peak, take);
    const hyp = Math.hypot(peak, take) / 2;
    const shape = new Jolt.BoxShape(new Jolt.Vec3(w, 0.14, hyp));
    const q = Jolt.Quat.prototype.sRotation(new Jolt.Vec3(1, 0, 0), -angle);
    const cz = z0 + Math.cos(angle) * hyp, cy = Math.sin(angle) * hyp;
    const settingsB = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(0, cy, cz), q, Jolt.EMotionType_Static, LAYER_NON_MOVING);
    const body = bodyInterface.CreateBody(settingsB);
    body.SetFriction(1.1);
    bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
    Jolt.destroy(settingsB);
    const mesh = new T.Mesh(new T.BoxGeometry(w * 2, 0.28, hyp * 2), jumpMat);
    mesh.position.set(0, cy, cz); mesh.rotation.x = -angle; mesh.receiveShadow = mesh.castShadow = true; scene.add(mesh);
    addStaticBox(Jolt, bodyInterface, scene, w, peak / 2, 1.2, 0, peak / 2, z0 + take + 1.2, jumpMat);
    return { z0, len, peak };
  }
  const jumps = [addKicker(50, 8, 1.1), addKicker(90, 16, 2.0)];

  // Motorcycle body + MotorcycleController, e-moto numbers.
  const rearZ = -EMOTO.wb * EMOTO.comBack, frontZ = EMOTO.wb * (1 - EMOTO.comBack);
  const halfW = 0.18, halfH = 0.32, halfL = EMOTO.wb * 0.42;
  const comOffset = new Jolt.Vec3(0, -halfH, 0);
  const box = new Jolt.BoxShapeSettings(new Jolt.Vec3(halfW, halfH, halfL));
  const shapeSettings = new Jolt.OffsetCenterOfMassShapeSettings(comOffset, box);
  const shape = shapeSettings.Create().Get();
  const bodySet = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(0, 0.98, 0), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Dynamic, LAYER_MOVING);
  bodySet.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
  bodySet.mMassPropertiesOverride.mMass = EMOTO.mass;
  const motoBody = bodyInterface.CreateBody(bodySet);
  bodyInterface.AddBody(motoBody.GetID(), Jolt.EActivation_Activate);
  motoBody.SetRestitution(0);
  bodyInterface.SetFriction(motoBody.GetID(), 0.4);
  Jolt.destroy(bodySet);

  const vehicle = new Jolt.VehicleConstraintSettings();
  vehicle.mMaxPitchRollAngle = 60 * Math.PI / 180;
  vehicle.mWheels.clear();
  const caster = EMOTO.caster;
  const front = new Jolt.WheelSettingsWV();
  front.mPosition = new Jolt.Vec3(0.0, -0.9 * halfH, frontZ);
  front.mMaxSteerAngle = EMOTO.steerMax;
  front.mSuspensionDirection = new Jolt.Vec3(0, -1, Math.tan(caster)).Normalized();
  front.mSteeringAxis = new Jolt.Vec3(0, 1, -Math.tan(caster)).Normalized();
  front.mRadius = EMOTO.wheelR;
  front.mWidth = EMOTO.wheelW;
  front.mSuspensionMinLength = 0.22;
  front.mSuspensionMaxLength = 0.22 + EMOTO.travelF;
  front.mSuspensionSpring.mFrequency = 1.6;
  front.mMaxBrakeTorque = 220;
  front.mMaxHandBrakeTorque = 700; // front-only brake for burnouts
  vehicle.mWheels.push_back(front);

  const back = new Jolt.WheelSettingsWV();
  back.mPosition = new Jolt.Vec3(0.0, -0.9 * halfH, rearZ);
  back.mMaxSteerAngle = 0.0;
  back.mRadius = EMOTO.wheelR;
  back.mWidth = EMOTO.wheelW;
  back.mSuspensionMinLength = 0.22;
  back.mSuspensionMaxLength = 0.22 + EMOTO.travelR;
  back.mSuspensionSpring.mFrequency = 2.0;
  back.mMaxBrakeTorque = 180;
  back.mMaxHandBrakeTorque = 0;
  vehicle.mWheels.push_back(back);

  const controllerSettings = new Jolt.MotorcycleControllerSettings();
  controllerSettings.mEngine.mMaxTorque = EMOTO.torque;
  controllerSettings.mEngine.mMinRPM = 800;
  controllerSettings.mEngine.mMaxRPM = 9000;
  controllerSettings.mTransmission.mShiftDownRPM = 2000;
  controllerSettings.mTransmission.mShiftUpRPM = 7500;
  controllerSettings.mTransmission.mClutchStrength = 2.0;
  controllerSettings.mMaxLeanAngle = 48 * Math.PI / 180;
  vehicle.mController = controllerSettings;
  controllerSettings.mDifferentials.clear();
  const differential = new Jolt.VehicleDifferentialSettings();
  differential.mLeftWheel = -1;
  differential.mRightWheel = 1; // rear
  differential.mDifferentialRatio = 4.8;
  controllerSettings.mDifferentials.push_back(differential);

  const constraint = new Jolt.VehicleConstraint(motoBody, vehicle);
  const tester = new Jolt.VehicleCollisionTesterCastCylinder(LAYER_MOVING, 1);
  constraint.SetVehicleCollisionTester(tester);
  physicsSystem.AddConstraint(constraint);
  physicsSystem.AddStepListener(new Jolt.VehicleConstraintStepListener(constraint));
  const controller = Jolt.castObject(constraint.GetController(), Jolt.MotorcycleController);

  const model = buildEmoto(scene);
  const wheelRight = new Jolt.Vec3(1, 0, 0), wheelUp = new Jolt.Vec3(0, 1, 0);

  // FX: smoke + thin rear tyre marks at the contact patch.
  const dummy = new T.Object3D();
  const smokeN = 64, smoke = new T.InstancedMesh(new T.SphereGeometry(.12, 8, 6), new T.MeshBasicMaterial({ color: '#c5cec5', transparent: true, opacity: .32, depthWrite: false }), smokeN);
  smoke.frustumCulled = false; scene.add(smoke);
  const smokeParts = Array.from({ length: smokeN }, () => ({ life: 0 })); let smokeI = 0;
  const SKID = 160, skidGeo = new T.PlaneGeometry(.16, .10); skidGeo.rotateX(-Math.PI / 2);
  const skids = new T.InstancedMesh(skidGeo, new T.MeshBasicMaterial({ color: '#1a1612', transparent: true, opacity: .45, depthWrite: false }), SKID);
  skids.instanceMatrix.setUsage(T.DynamicDrawUsage); skids.frustumCulled = false; scene.add(skids);
  const skidParts = Array.from({ length: SKID }, () => ({ life: 0 })); let skidI = 0, skidAcc = 0, lastSkid = null;

  // Air state (copy of the live game's trick fields).
  const air = { active: false, pitch: 0, w: 0, air: 0, airRot: 0, spin: 0, spinV: 0, pendingSpin: 0, peakY: 0, hopCd: 0 };
  let currentRight = 0, usedHandBrakeWorkaround = false, hasLanded = false, airOff = 0, settleT = 0, msg = '', msgT = 0;
  let lastAir = { peakY: 0, spinV: 0, airT: 0 };
  let fpsFrames = 0, fpsTime = 0, fps = 0, last = performance.now();
  const tmpV = new T.Vector3(), tmpQ = new T.Quaternion();

  function bodyPose() {
    const p = motoBody.GetPosition(), r = motoBody.GetRotation();
    return { x: p.GetX(), y: p.GetY(), z: p.GetZ(), qx: r.GetX(), qy: r.GetY(), qz: r.GetZ(), qw: r.GetW() };
  }
  function worldYaw() {
    const r = motoBody.GetRotation();
    tmpQ.set(r.GetX(), r.GetY(), r.GetZ(), r.GetW());
    tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
    return Math.atan2(tmpV.x, tmpV.z);
  }
  function forwardSpeed() {
    const v = motoBody.GetLinearVelocity();
    tmpQ.set(motoBody.GetRotation().GetX(), motoBody.GetRotation().GetY(), motoBody.GetRotation().GetZ(), motoBody.GetRotation().GetW());
    tmpV.set(v.GetX(), v.GetY(), v.GetZ()).applyQuaternion(tmpQ.clone().invert());
    return tmpV.z;
  }

  function prePhysics(dt) {
    const wFront = constraint.GetWheel(0), wRear = constraint.GetWheel(1);
    const onF = wFront.HasContact(), onR = wRear.HasContact();
    const onG = onF || onR;
    const speed = Math.hypot(motoBody.GetLinearVelocity().GetX(), motoBody.GetLinearVelocity().GetZ());
    const target = inp.steer, steerSpeed = 6;
    if (target > currentRight) currentRight = Math.min(currentRight + steerSpeed * dt, target);
    else if (target < currentRight) currentRight = Math.max(currentRight - steerSpeed * dt, target);

    if (onG) { hasLanded = true; airOff = 0; }
    else airOff += dt;
    if (onG && air.active && air.air > 0.08) {
      // Hand back to Jolt on first wheel contact.
      lastAir = { peakY: air.peakY, spinV: air.spinV, airT: air.air };
      air.active = false;
      controller.EnableLeanController(true);
      if (air.spinV) msg = 'LANDED MID-SPIN', msgT = 1.4;
      else if (air.pendingSpin) msg = (air.pendingSpin > 1 ? air.pendingSpin * 360 : 360) + ' SPIN', msgT = 1.2;
      else if (air.airRot > 2) msg = 'FLIP', msgT = 1.0;
      air.spinV = 0; air.pendingSpin = 0; air.air = 0; air.airRot = 0;
    }
    if (hasLanded && settleT <= 0 && !onG && !air.active && airOff > 0.12 && speed > 1) {
      // Hand over to the copied air / trick rules.
      air.active = true; air.air = 0; air.airRot = 0; air.w = 0; air.spin = 0; air.spinV = 0; air.peakY = bodyPose().y;
      const av = motoBody.GetAngularVelocity();
      // Pitch rate around local +X (right), given Z-forward.
      tmpQ.set(motoBody.GetRotation().GetX(), motoBody.GetRotation().GetY(), motoBody.GetRotation().GetZ(), motoBody.GetRotation().GetW());
      tmpV.set(av.GetX(), av.GetY(), av.GetZ()).applyQuaternion(tmpQ.clone().invert());
      air.w = tmpV.x;
      controller.EnableLeanController(false);
    }

    let forward = 0, brake = 0, handBrake = 0, right = 0;
    if (air.active) {
      stepAirCopy(air, dt);
      air.peakY = Math.max(air.peakY, bodyPose().y);
      // Write pitch rate back onto the body; Jolt still integrates translation / gravity.
      tmpQ.set(motoBody.GetRotation().GetX(), motoBody.GetRotation().GetY(), motoBody.GetRotation().GetZ(), motoBody.GetRotation().GetW());
      const rightAx = tmpV.set(1, 0, 0).applyQuaternion(tmpQ).clone();
      const upAx = new T.Vector3(0, 1, 0).applyQuaternion(tmpQ);
      const av = rightAx.multiplyScalar(air.w).add(upAx.multiplyScalar(air.spinV || 0));
      motoBody.SetAngularVelocity(new Jolt.Vec3(av.x, av.y, av.z));
      controller.SetDriverInput(0, 0, 0, 0);
    } else {
      const wantGo = inp.throttle > 0, wantStop = inp.brake > 0;
      const burnout = wantGo && wantStop;
      // Bicycle-model rule: at a standstill the bars turn but the chassis does not yaw.
      // Burnouts are the exception — bars swing the rear around the front tyre.
      const canSteer = burnout || speed > 0.55;
      if (burnout) {
        // Front hand-brake + rear throttle = burnout. This is the Jolt workaround
        // (regular brake input acts on every wheel).
        forward = 1; handBrake = 1; brake = 0; usedHandBrakeWorkaround = true;
        msg = 'BURNOUT'; msgT = .25;
      } else if (wantGo) forward = 1;
      else if (wantStop) brake = 1;

      right = canSteer ? currentRight : 0;

      if (inp.hop && onG && onF && onR && air.hopCd <= 0) {
        const v = motoBody.GetLinearVelocity();
        motoBody.SetLinearVelocity(new Jolt.Vec3(v.GetX(), v.GetY() + 3.4, v.GetZ()));
        air.hopCd = 0.4;
      }
      controller.SetDriverInput(forward, right, brake, handBrake);
      if (forward || right || brake || handBrake) bodyInterface.ActivateBody(motoBody.GetID());
      if (wantGo && wantStop && onG) {
        // Keep burnout creep near 0.45 m/s (game target) without killing the lateral donut slide.
        const v = motoBody.GetLinearVelocity();
        const yaw = worldYaw();
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const vxFwd = v.GetX() * fx + v.GetZ() * fz;
        const creep = 0.45;
        const newFwd = vxFwd + (creep - vxFwd) * Math.min(1, 12 * dt);
        motoBody.SetLinearVelocity(new Jolt.Vec3(
          v.GetX() + (newFwd - vxFwd) * fx,
          v.GetY(),
          v.GetZ() + (newFwd - vxFwd) * fz
        ));
        // Donut: Jolt will not swing the rear at creep speed, so copy the game's front-axle pivot.
        if (Math.abs(currentRight) > 0.05) {
          const STEER_BURNOUT = 1.0;
          const p = motoBody.GetPosition();
          const front = EMOTO.wb * (1 - EMOTO.comBack);
          const px = p.GetX() + Math.sin(yaw) * front;
          const pz = p.GetZ() + Math.cos(yaw) * front;
          const dYaw = currentRight * STEER_BURNOUT * dt;
          const yaw2 = yaw + dYaw;
          const nx = px - Math.sin(yaw2) * front;
          const nz = pz - Math.cos(yaw2) * front;
          const r = motoBody.GetRotation();
          tmpQ.set(r.GetX(), r.GetY(), r.GetZ(), r.GetW());
          tmpQ.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), dYaw));
          bodyInterface.SetPositionAndRotation(
            motoBody.GetID(),
            new Jolt.RVec3(nx, p.GetY(), nz),
            new Jolt.Quat(tmpQ.x, tmpQ.y, tmpQ.z, tmpQ.w),
            Jolt.EActivation_Activate
          );
        }
      }
    }
    if (air.hopCd) air.hopCd = Math.max(0, air.hopCd - dt);
    if (settleT) {
      settleT = Math.max(0, settleT - dt);
      controller.EnableLeanController(false);
      if (settleT === 0) controller.EnableLeanController(true);
    }

    // Slip FX at the rear contact.
    const rear = constraint.GetWheel(1);
    if (rear.HasContact()) {
      const omega = Jolt.castObject(rear, Jolt.WheelWV).GetAngularVelocity();
      const vx = forwardSpeed();
      const slip = omega * EMOTO.wheelR - vx;
      const cp = rear.GetContactPosition();
      const px = cp.GetX(), py = cp.GetY(), pz = cp.GetZ();
      if (Math.abs(slip) > 1.4) {
        const n = Math.min(4, 1 + Math.abs(slip) * .3);
        for (let k = 0; k < n; k++) {
          const p = smokeParts[smokeI++ % smokeN];
          Object.assign(p, { x: px + (Math.random() - .5) * .05, y: py + .04, z: pz + (Math.random() - .5) * .05, vx: (Math.random() - .5) * .4, vy: .4 + Math.random() * .7, vz: (Math.random() - .5) * .4, life: 1.3 + Math.random() * .7 });
        }
        skidAcc += Math.max(.35, Math.abs(slip)) * dt;
        if (skidAcc > .09) {
          skidAcc = 0;
          const mark = skidParts[skidI++ % SKID];
          Object.assign(mark, { life: 5.5, x: px, y: py + .012, z: pz, yaw: worldYaw() });
          lastSkid = { x: px, y: py, z: pz, width: EMOTO.wheelW };
        }
      }
    }
  }

  function syncVisual() {
    const p = motoBody.GetPosition(), r = motoBody.GetRotation();
    model.root.position.set(p.GetX(), p.GetY(), p.GetZ());
    model.root.quaternion.set(r.GetX(), r.GetY(), r.GetZ(), r.GetW());
    if (air.spin) model.root.rotateY(air.spin);
    const applyWheel = (mesh, xf) => {
      const tr = xf.GetTranslation(), q = xf.GetRotation().GetQuaternion();
      mesh.position.set(tr.GetX(), tr.GetY(), tr.GetZ());
      mesh.quaternion.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
    };
    applyWheel(model.wheelF, constraint.GetWheelLocalTransform(0, wheelRight, wheelUp));
    applyWheel(model.wheelR, constraint.GetWheelLocalTransform(1, wheelRight, wheelUp));
    const steer = constraint.GetWheel(0).GetSteerAngle();
    model.fork.rotation.y = currentRight || steer;

    for (let i = 0; i < smokeN; i++) {
      const p2 = smokeParts[i];
      if (p2.life > 0) {
        p2.life -= 1 / 60; p2.x += p2.vx / 60; p2.y += p2.vy / 60; p2.z += p2.vz / 60;
        dummy.position.set(p2.x, p2.y, p2.z); dummy.scale.setScalar((1 + (1 - p2.life / 1.8) * 3) * Math.min(1, p2.life * 3));
      } else dummy.scale.setScalar(0);
      dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); smoke.setMatrixAt(i, dummy.matrix);
    }
    smoke.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < SKID; i++) {
      const m = skidParts[i];
      if (m.life <= 0) { dummy.scale.set(0, 0, 0); dummy.position.set(0, -10, 0); }
      else { m.life -= 1 / 60; dummy.position.set(m.x, m.y, m.z); dummy.rotation.set(0, -m.yaw, 0); dummy.scale.set(1, 1, 1); }
      dummy.updateMatrix(); skids.setMatrixAt(i, dummy.matrix);
    }
    skids.instanceMatrix.needsUpdate = true;
  }

  function chaseCam() {
    const p = bodyPose();
    const yaw = worldYaw();
    const behind = 4.6, height = 1.45;
    const cx = p.x - Math.sin(yaw) * behind, cz = p.z - Math.cos(yaw) * behind, cy = p.y + height;
    cam.position.set(cx, cy, cz);
    cam.lookAt(p.x, p.y + 0.35, p.z);
    cam.fov = 64; cam.updateProjectionMatrix();
    sun.position.set(p.x + 8, p.y + 20, p.z + 6);
    sun.target.position.set(p.x, p.y, p.z);
    sun.target.updateMatrixWorld();
  }

  const state = () => {
    const p = bodyPose();
    const wF = constraint.GetWheel(0), wR = constraint.GetWheel(1);
    const omega = Jolt.castObject(wR, Jolt.WheelWV).GetAngularVelocity();
    const vx = forwardSpeed();
    const yaw = worldYaw();
    const speed = Math.hypot(motoBody.GetLinearVelocity().GetX(), motoBody.GetLinearVelocity().GetZ());
    return {
      ready: true,
      fps,
      x: p.x, y: p.y, z: p.z, yaw, pitch: air.pitch,
      speed, vx,
      steer: inp.steer, bar: currentRight, joltSteer: constraint.GetWheel(0).GetSteerAngle(), lean: inp.lean,
      ground: [wR.HasContact(), wF.HasContact()],
      slip: [omega * EMOTO.wheelR - vx, 0],
      wheelOmega: [omega, Jolt.castObject(wF, Jolt.WheelWV).GetAngularVelocity()],
      burnout: !!(inp.throttle && inp.brake && !air.active),
      smoke: smokeParts.reduce((n, p) => n + (p.life > 0 ? 1 : 0), 0),
      skid: lastSkid,
      air: air.active, airT: air.air, airRot: air.airRot, spinV: air.spinV || lastAir.spinV, peakY: Math.max(air.peakY, lastAir.peakY), lastAir, w: air.w,
      handBrakeWorkaround: usedHandBrakeWorkaround,
      wasmBytes: 2024218,
      mass: EMOTO.mass, wb: EMOTO.wb, wheelR: EMOTO.wheelR,
    };
  };
  function resetBike(opt = {}) {
    const x = opt.x ?? 0, y = opt.y ?? 0.98, z = opt.z ?? 0, yaw = opt.yaw ?? 0;
    const q = new Jolt.Quat(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
    const vx = opt.vx ?? 0, vz = opt.vz ?? 0;
    bodyInterface.SetPositionRotationAndVelocity(
      motoBody.GetID(),
      new Jolt.RVec3(x, y, z),
      q,
      new Jolt.Vec3(vx, 0, vz),
      new Jolt.Vec3(0, 0, 0)
    );
    Object.assign(air, { active: false, pitch: 0, w: 0, air: 0, airRot: 0, spin: 0, spinV: 0, pendingSpin: 0, peakY: 0, hopCd: 0 });
    lastAir = { peakY: 0, spinV: 0, airT: 0 };
    currentRight = 0; hasLanded = false; airOff = 0; settleT = 1.0;
    Object.assign(inp, { throttle: 0, brake: 0, steer: 0, lean: 0, hop: 0, trick: 0 });
    controller.EnableLeanController(true);
    controller.SetDriverInput(0, 0, 0, 0);
  }
  globalThis.__WK_JOLT_STATE__ = state;
  globalThis.__WK_JOLT_INPUT__ = (patch) => Object.assign(inp, patch);
  globalThis.__WK_JOLT_RESET__ = resetBike;
  globalThis.__WK_JOLT_SCENE__ = () => ({ scene, cam, renderer, body: model.root });

  put(hud.status, 'Jolt MotorcycleController · e-moto ' + EMOTO.wb + ' m wb');
  addEventListener('resize', () => {
    const w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (dt > 0 && dt < 0.25) { fpsTime += dt; fpsFrames++; if (fpsTime >= 0.5) { fps = fpsFrames / fpsTime; fpsFrames = 0; fpsTime = 0; } }
    prePhysics(dt);
    jolt.Step(dt, dt > 1 / 55 ? 2 : 1);
    syncVisual();
    chaseCam();
    renderer.render(scene, cam);
    const st = state();
    hud.speed.innerHTML = Math.round(st.speed * 3.6) + "<small> km/h</small>";
    put(hud.mode, st.air ? 'AIR · TRICK COPY' : 'GROUND · JOLT');
    put(hud.info, (st.burnout ? 'BURNOUT  ' : '') + 'yaw ' + Math.round(st.yaw * 180 / Math.PI) + '°');
    put(hud.fps, 'FPS ' + (fps ? fps.toFixed(0) : '--'));
    msgT -= dt; put(hud.msg, msgT > 0 ? msg : '');
  }
  requestAnimationFrame(frame);
}

main().catch((e) => {
  console.error(e);
  const s = document.querySelector('[data-h=status]');
  if (s) s.textContent = 'Failed: ' + (e && e.message || e);
});
