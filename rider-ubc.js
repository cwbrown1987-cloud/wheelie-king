// Playground rider: Quaternius Universal Base Character (CC0, assets/LICENSES.md), posed by analytic
// two-bone IK onto the ride profile's attach points (seat, pegs/cranks, grips). No animation clips:
// every pose (seated, standing on the pegs, wheelie lean-back, lean forward, lean into turns,
// one-hander, knee-knock) is targets + IK, so any frame/part with attach data is ridden correctly.
// Same interface as rider-model.js (update / joints / ragdoll / attach / state) for the crash rig.
// Legacy keeps rider-model.js; this file is only used by the Playground.
import { GLTFLoader } from './vendor/GLTFLoader.js';

const URL_GLB = './assets/quaternius/ubc-superhero-male.glb';
const HEIGHT = 1.74;      // standing height of the game's rider (m)
let bufferPromise = null;
const loadBuffer = () => bufferPromise || (bufferPromise = fetch(URL_GLB).then(r => { if (!r.ok) throw Error('rider glb ' + r.status); return r.arrayBuffer(); }));

import { dressUbc, fitHelmet } from './rider-outfit.js';
export const UBC_POSES = ['seated', 'stand', 'wheelie', 'leanForward', 'oneHand', 'kneeKnock', 'turnLean'];

export function makeUbcRider(T, body, bike, A, profile, mechanical) {
  const root = new T.Group(); root.name = 'wk:rider'; root.userData.kind = 'ubc'; body.add(root);
  const at = profile?.attach || {};
  const off = (p, y = 0) => new T.Vector3(p[0] + bike.position.x, p[1] + bike.position.y + y, 0);
  const seat = off(at.seat || A.seatTop), pegs = off(at.pegs || A.feet || A.bb);
  const grips = off(at.bars || A.hand || [A.headTop[0] - 0.04, A.headTop[1] + 0.2]);
  const gripW = at.gripHalfWidth || A.handWidth || 0.18, pegW = at.pegHalfWidth || 0.145, crankR = at.cranks || 0;
  const stance = profile?.stance || 'seated'; // v2.1-39: scooter | moto | bmx | seated
  const W = { stand: 0, wheelie: 0, lean: 0, oneHand: 0, kneeKnock: 0, roll: 0 };
  const trick = { name: '', env: 0, dir: 1 };
  let model = null, bones = null, rest = null, pelvisRest = null, legLen = 0.86, armLen = 0.6, reach = { pitch: 0, shift: 0 }, error = null, meshes = 0;
  const target = { hip: new T.Vector3(), pitch: 0, roll: 0, hands: [new T.Vector3(), new T.Vector3()], feet: [new T.Vector3(), new T.Vector3()] };

  const v = () => new T.Vector3(), q = () => new T.Quaternion();
  const _a = v(), _b = v(), _c = v(), _d = v(), _q1 = q(), _q2 = q(), _q3 = q();
  const wpos = (o, out = v()) => o.getWorldPosition(out);
  function rotateWorld(bone, delta) {
    bone.parent.getWorldQuaternion(_q1); bone.getWorldQuaternion(_q2);
    bone.quaternion.copy(_q1.invert().multiply(_q3.copy(delta).multiply(_q2)));
    bone.updateMatrixWorld(true);
  }
  function aim(bone, child, worldTarget) {
    const a = wpos(bone, _a), from = wpos(child, _b).sub(a), to = _c.copy(worldTarget).sub(a);
    if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
    rotateWorld(bone, new T.Quaternion().setFromUnitVectors(from.normalize(), to.normalize()));
  }
  // Analytic two-bone IK in world space; pole = a world point the middle joint bends towards.
  function twoBone(upper, lower, end, worldTarget, worldPole) {
    const a = wpos(upper, v()), m = wpos(lower, v()), e = wpos(end, v());
    const l1 = a.distanceTo(m), l2 = m.distanceTo(e);
    const t = worldTarget.clone(), n = t.clone().sub(a); let d = n.length();
    if (d < 1e-4) return; n.divideScalar(d); d = Math.min(d, (l1 + l2) * 0.999); d = Math.max(d, Math.abs(l1 - l2) + 1e-3);
    const p = worldPole.clone().sub(a); p.addScaledVector(n, -p.dot(n)); if (p.lengthSq() < 1e-8) p.set(0, 1, 0); p.normalize();
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const mid = a.clone().addScaledVector(n, x).addScaledVector(p, h);
    aim(upper, lower, mid);
    aim(lower, end, a.clone().addScaledVector(n, d));
  }
  const W2 = p => root.localToWorld(p.clone());

  loadBuffer().then(buf => new GLTFLoader().parseAsync(buf.slice(0), './assets/quaternius/')).then(g => {
    model = g.scene; model.name = 'rider:ubc';
    model.rotation.y = Math.PI / 2; // model faces +Z; bike forward is +X
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; meshes++; } });
    root.add(model); root.updateMatrixWorld(true);
    const by = n => model.getObjectByName(n);
    // Size from the skeleton (what the skinned mesh follows), not the mesh bounds: head bone to
    // ball of foot is 0.876 of standing height on this rig.
    const yIn = n => root.worldToLocal(by(n).getWorldPosition(new T.Vector3())).y;
    model.scale.setScalar(HEIGHT * 0.876 / Math.max(1e-6, yIn('Head') - yIn('ball_l'))); root.updateMatrixWorld(true);
    try { dressUbc(T, model); fitHelmet(T, model); } catch (e) { console.warn('[wk] outfit failed', e); } // v2.1-56: riding kit + helmet
    bones = {};
    for (const n of ['index_01_l','index_02_l','index_03_l','middle_01_l','middle_02_l','middle_03_l','ring_01_l','ring_02_l','ring_03_l','pinky_01_l','pinky_02_l','pinky_03_l','thumb_01_l','thumb_02_l','thumb_03_l','index_01_r','index_02_r','index_03_r','middle_01_r','middle_02_r','middle_03_r','ring_01_r','ring_02_r','ring_03_r','pinky_01_r','pinky_02_r','pinky_03_r','thumb_01_r','thumb_02_r','thumb_03_r']) bones[n] = by(n) || null;
    for (const n of ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r']) {
      bones[n] = by(n); if (!bones[n]) throw Error('rider bone missing: ' + n);
    }
    rest = []; model.traverse(o => { if (o.isBone) rest.push([o, o.quaternion.clone()]); });
    pelvisRest = root.worldToLocal(wpos(bones.pelvis)).sub(model.position);
    const L = n => root.worldToLocal(wpos(bones[n]));
    legLen = L('thigh_l').distanceTo(L('calf_l')) + L('calf_l').distanceTo(L('foot_l'));
    armLen = L('upperarm_l').distanceTo(L('lowerarm_l')) + L('lowerarm_l').distanceTo(L('hand_l'));
    api.update(lastArgs);
  }).catch(e => { error = e.message || String(e); console.error('Playground rider failed to load', e); });

  // ---- pose targets (root = bike-body space: +x forward, +y up, +z = rider's right) ----
  let lastArgs = {}, lastT = 0;
  // v2.1-12 body dynamics: the rider is a sprung mass on the bike. Bumps and landings push the hips down
  // (knees and elbows bend, then extend), rough or steep ground puts him in the attack position (up off
  // the seat, hips back), he leans into turns while his head stays level, and looks where he's going.
  const D = { y: 0, vy: 0, lastVy: null, ay: 0, rough: 0, attack: 0, attackHold: 0, slope: 0, air: 0, look: 0, back: 0 };
  function dynamics(s, inp, dt) {
    if (!(dt > 0)) return;
    const onG = !!(s.ground && (s.ground[0] || s.ground[1])), both = !!(s.ground && s.ground[0] && s.ground[1]);
    if (D.lastVy == null) D.lastVy = s.vy || 0;
    const ay = Math.max(-80, Math.min(80, ((s.vy || 0) - D.lastVy) / dt)); D.lastVy = s.vy || 0;
    D.ay += (ay - D.ay) * (1 - Math.exp(-dt * 30));
    // rider mass on legs: 2 Hz, lightly under-damped; bike accelerating up = hips pushed down
    // on a mono the rider sits and holds the balance point: no bump bounce from the pitching bike, no stand-ups
    const mono = !!(s.ground && s.ground[0] && !s.ground[1] && (s.pitch || 0) > 0.25);
    const k = 160, c = 18, acc = -k * D.y - c * D.vy - (onG && !mono ? D.ay : 0) * 0.9 + (onG ? 0 : (0.02 - D.y) * 6);
    D.vy += acc * dt; D.y += D.vy * dt;
    if (D.y < -0.2) { D.y = -0.2; D.vy = Math.max(0, D.vy); } if (D.y > 0.08) { D.y = 0.08; D.vy = Math.min(0, D.vy); }
    D.rough += (Math.min(1, Math.abs(D.ay) / 25) - D.rough) * (1 - Math.exp(-dt * (Math.abs(D.ay) > 25 * D.rough ? 8 : 0.8)));
    if (both) D.slope += ((s.pitch || 0) - D.slope) * (1 - Math.exp(-dt * 4));
    D.air = onG ? Math.max(0, D.air - dt * 3) : Math.min(1, D.air + dt * 4);
    const speed = Math.abs(s.vx || 0);
    // attack position: going fast over rough ground, down a steep slope, through the air, or just landed
    const wantAttack = !mono && onG && speed > 4.5 && (D.rough > 0.25 || D.slope < -0.1 || (inp.lean || 0) < -0.3);
    if (wantAttack) D.attackHold = 1.2; else if (onG) D.attackHold = mono ? 0 : Math.max(0, D.attackHold - dt); // airborne: stance held
    D.attack += ((D.attackHold > 0 ? 1 : 0) - D.attack) * (1 - Math.exp(-dt * 5));
    // hips back on descents (weight over the rear wheel), slightly forward climbing
    D.back += (Math.max(-0.6, Math.min(1, -D.slope * 2.5)) - D.back) * (1 - Math.exp(-dt * 3));
    D.look += ((Math.max(-1, Math.min(1, inp.steer || 0)) * 0.35 + (s.slipAngle || 0) * 0.6) - D.look) * (1 - Math.exp(-dt * 6));
  }
  let gripMeshes = null, gripScan = 0;
  const _gc = new T.Vector3();
  function gripPoints() {
    if (!gripMeshes || (!gripMeshes.length && (gripScan += 1) % 120 === 0)) {
      gripMeshes = []; bike.traverse(o => { if (o.isMesh && /^grips?[:_-]|(^|[:_-])grips?($|[:_-])/i.test(o.name)) gripMeshes.push(o); });
      if (gripMeshes.length > 2) { // several pieces per grip: keep the outermost on each side
        const byZ = gripMeshes.map(o => { o.updateWorldMatrix(true, false); if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); return [o, root.worldToLocal(o.localToWorld(_gc.copy(o.geometry.boundingSphere.center))).z]; });
        byZ.sort((a, b) => a[1] - b[1]); gripMeshes = [byZ[0][0], byZ[byZ.length - 1][0]];
      }
    }
    if (gripMeshes.length !== 2) return null;
    const pts = gripMeshes.map(o => { o.updateWorldMatrix(true, false); if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); return root.worldToLocal(o.localToWorld(new T.Vector3().copy(o.geometry.boundingSphere.center))); });
    pts.sort((a, b) => a.z - b.z); // left (-z) then right (+z)
    if (Math.abs(pts[1].z - pts[0].z) < 0.15) return null;
    return pts;
  }
  function targets({ s = {}, inp = {}, dt = 1 / 60 } = {}) {
    dynamics(s, inp, dt);
    // airborne: the rider holds the stance he left the lip with (stance weights change slowly); only real
    // input (lean for a flip, one-hander) moves him quickly
    const air = !(s.ground && (s.ground[0] || s.ground[1]));
    const k = 1 - Math.exp(-Math.max(0, dt) * (air ? 1.2 : 9));
    const frontUp = !!(s.ground && s.ground[0] && !s.ground[1]);
    const go = (key, val) => { W[key] += (val - W[key]) * k; };
    go('stand', stance === 'scooter' || s.standing || D.attack > 0.5 || (stance === 'bmx' && (inp.throttle || 0) > .5 && Math.abs(s.vx || 0) < 7 && !air) ? 1 : 0); // scooters are always stood on; BMX riders stand to sprint
    // steady weights on a mono: saturate early and move slowly, so the hips don't pump with every balance correction
    if (!air) go('wheelie', s.mono || frontUp ? Math.min(1, Math.max(0, (s.pitch || 0) / 0.22) + (s.mono ? 0.4 : 0)) : 0);
    { const kl = 1 - Math.exp(-Math.max(0, dt) * (W.wheelie > 0.5 ? 2.5 : 9)); W.lean += (Math.max(-1, Math.min(1, -(inp.lean || 0) + (s.stoppie && !(s.ground && s.ground[0]) ? 0.9 : 0))) - W.lean) * kl; }                 // + = lean forward (inp.lean + = back)
    go('oneHand', s.oneHand ? 1 : 0); go('kneeKnock', s.kneeKnock ? 1 : 0);
    go('roll', Math.max(-0.5, Math.min(0.5, (s.joltRoll ?? s.visRoll ?? 0) * 0.35)));      // extra lean into the turn
    const st = W.stand, wh = W.wheelie;
    // v2.1-32 air tricks: superman, no-hander, can-can, nac-nac (sin envelope over the trick)
    const sk = s.stunt && !s.crashed ? s.stunt : null, env = sk ? Math.sin(Math.PI * Math.min(1, sk.elapsed / sk.duration)) : 0;
    trick.name = sk ? sk.name : ''; trick.env = env; trick.dir = sk?.dir || 1;
    const hipSit = seat.clone().add(_d.set(-0.02, 0.09, 0));
    const hipStand = stance === 'scooter' ? new T.Vector3(pegs.x - 0.04, pegs.y + legLen * 0.84, 0) : new T.Vector3(pegs.x - 0.06, pegs.y + legLen * 0.86, 0);
    target.hip.copy(hipSit).lerp(hipStand, st);
    target.hip.x += -0.13 * wh + 0.06 * W.lean; target.hip.y += -0.03 * wh * (1 - st);
    // attack stance: hips low and back; absorb bumps through the legs (D.y); hips back on descents
    target.hip.y += D.y * (0.5 + 0.5 * st) - 0.1 * st * D.attack;
    target.hip.x += -0.14 * D.back * st - 0.05 * D.back * (1 - st) - 0.04 * st * D.attack;
    // torso pitch from vertical (+ = forward): seated 38°, standing 28°, wheelie ~8°, lean ±18°
    target.pitch = (stance === 'scooter' ? 12 : stance === 'moto' ? 30 - 6 * st : 38 - 10 * st) * Math.PI / 180 * (1 - 0.8 * wh) + W.lean * 0.32 - 0.12 * W.kneeKnock;
    // chest drops toward the bars when the legs soak up a hit; torso stays nearer vertical on steep descents
    target.pitch += -D.y * 1.2 * st + 0.12 * st * D.attack + Math.min(0, D.slope) * 0.35;
    if (trick.name === 'superman') { target.hip.x -= 0.42 * env; target.hip.y += 0.22 * env; target.pitch += 0.75 * env; }
    if (trick.name === 'nohander') { target.pitch -= 0.15 * env; }
    target.look = D.look;
    target.roll = W.roll;
    // The handlebar grips are their own meshes: put the hands on the real grips (they already turn with the bars).
    const gp = gripPoints();
    for (const i of [0, 1]) {
      const side = i ? 1 : -1;
      target.hands[i].set(grips.x, grips.y, side * gripW);
      if (gp) { target.hands[i].copy(gp[i]); }
      // Hands ride the handlebar: apply the same steering rotation the bars get (bike-motion), so the
      // rider's arms actually turn the bike instead of holding a fixed pose.
      const sm = mechanical?.state?.steerMatrix;
      if (!gp && sm && mechanical.state.steerAngle) { const h = target.hands[i]; h.x -= bike.position.x; h.y -= bike.position.y; h.applyMatrix4(sm); h.x += bike.position.x; h.y += bike.position.y; }
      let foot;
      if (crankR && (!st || stance === 'bmx')) { // pedalling (BMX riders keep pedalling stood up)
        const a = (mechanical?.state.crankPhase || 0) + (i ? Math.PI : 0);
        foot = new T.Vector3(pegs.x + Math.cos(a) * crankR, pegs.y + Math.sin(a) * crankR, side * (pegW - 0.02));
      } else if (stance === 'scooter') foot = new T.Vector3(pegs.x + (i ? -0.2 : 0.17), pegs.y + 0.03, i ? 0.06 : -0.05); // front foot forward on the deck, back foot behind it
      else foot = new T.Vector3(pegs.x + (st ? -0.02 : -0.03), pegs.y + 0.03, side * pegW);
      // knee-knock: feet off the pegs, knees pulled in and up to the top tube
      const knock = new T.Vector3(pegs.x + 0.12, pegs.y + 0.22, side * 0.05);
      target.feet[i].copy(foot).lerp(knock, W.kneeKnock);
      if (trick.name === 'superman') target.feet[i].lerp(new T.Vector3(pegs.x - 0.95, pegs.y + 0.55, side * 0.16), trick.env);
      if (trick.name === 'cancan' && i === 0) target.feet[i].lerp(new T.Vector3(pegs.x + 0.5, pegs.y + 0.32, 0.38), trick.env);
      if (trick.name === 'nacnac' && i === 0) target.feet[i].lerp(new T.Vector3(pegs.x - 0.75, pegs.y + 0.5, 0.42), trick.env);
    }
    return target;
  }

  function torso(extraPitch, shiftX) {
    for (const [b, r] of rest) b.quaternion.copy(r);
    model.position.copy(target.hip).sub(pelvisRest); model.position.x += shiftX;
    root.updateMatrixWorld(true);
    const lateral = root.localToWorld(v().set(0, 0, 1)).sub(root.localToWorld(v())).normalize();
    const forward = root.localToWorld(v().set(1, 0, 0)).sub(root.localToWorld(v())).normalize();
    const pitch = target.pitch + extraPitch;
    rotateWorld(bones.spine_01, q().setFromAxisAngle(lateral, -pitch));
    if (target.roll) rotateWorld(bones.spine_01, q().setFromAxisAngle(forward, target.roll));
    rotateWorld(bones.neck_01, q().setFromAxisAngle(lateral, pitch * 0.55)); // eyes up the trail
    if (target.roll) rotateWorld(bones.neck_01, q().setFromAxisAngle(forward, -target.roll * 0.7)); // head stays level in a lean
    if (target.look) { const up = root.localToWorld(v().set(0, 1, 0)).sub(root.localToWorld(v())).normalize(); rotateWorld(bones.neck_01, q().setFromAxisAngle(up, -target.look)); }
  }
  // How far the gripping hands are beyond a comfortable (slightly bent) arm reach.
  function overReach() {
    let worst = 0;
    for (const [s, i] of [['l', 0], ['r', 1]]) {
      if ((i === 1 && W.oneHand > 0.5) || (trick.name === 'nohander' && trick.env > 0.4)) continue;
      worst = Math.max(worst, wpos(bones['upperarm_' + s]).distanceTo(W2(target.hands[i])) - armLen * 0.97);
    }
    return worst;
  }
  function solve() {
    if (!model) return;
    // Arms are rigid-length: if the bars are out of reach, fold the torso forward (up to 40°), then
    // slide the hips forward. Real riders do the same when they stand or hang off the back.
    let extra = 0, shift = 0;
    torso(extra, shift);
    for (let it = 0; it < 10; it++) {
      const need = overReach();
      if (need < 0.004) break;
      // In a wheelie keep the torso back (arms straight, hips slide forward first); otherwise fold.
      if (W.wheelie > 0.5 && shift < 0.15) shift = Math.min(0.15, shift + need);
      else if (extra < 0.7) extra = Math.min(0.7, extra + need / 0.45);
      else shift += need;
      torso(extra, shift);
    }
    reach.pitch = extra; reach.shift = shift;
    const side = [['l', 0], ['r', 1]];
    for (const [s, i] of side) {
      const sign = i ? 1 : -1;
      const shoulder = wpos(bones['upperarm_' + s]);
      let hand = W2(target.hands[i]);
      const offH = trick.name === 'nohander' ? trick.env : 0;
      if (offH > 0.01) { const out = shoulder.clone().add(root.localToWorld(v().set(-0.05, 0.25, sign * 0.55)).sub(root.localToWorld(v()))); hand = hand.lerp(out, offH); }
      if (i === 1 && W.oneHand > 0.01) { // right hand off the bars, arm up and out
        const up = shoulder.clone().add(root.localToWorld(v().set(-0.12, 0.42, 0.42)).sub(root.localToWorld(v())));
        hand = hand.lerp(up, W.oneHand);
      }
      const elbowPole = W2(v().set(target.hip.x - 0.35, target.hip.y + 0.1, sign * 0.55));
      const gripping = !(i === 1 && W.oneHand > 0.5) && !(trick.name === 'nohander' && trick.env > 0.4);
      if (gripping && bones['middle_01_' + s]) {
        // wrist sits behind the bar so the palm and wrapped fingers, not the wrist, are on the grip
        const kd = root.localToWorld(v().set(0.92, -0.38, 0)).sub(root.localToWorld(v())).normalize();
        const kl = wpos(bones['hand_' + s]).distanceTo(wpos(bones['middle_01_' + s]));
        hand = hand.clone().addScaledVector(kd, -kl * 0.75).add(root.localToWorld(v().set(0, 0.03, 0)).sub(root.localToWorld(v())));
        twoBone(bones['upperarm_' + s], bones['lowerarm_' + s], bones['hand_' + s], hand, elbowPole);
        aim(bones['hand_' + s], bones['middle_01_' + s], wpos(bones['hand_' + s]).addScaledVector(kd, kl));
        // knuckle roll: back of the hand up
        const bar = root.localToWorld(v().set(0, 0, 1)).sub(root.localToWorld(v())).normalize();
        for (const f of ['index', 'middle', 'ring', 'pinky']) for (const j of ['01', '02', '03']) { const b = bones[f + '_' + j + '_' + s]; if (b) rotateWorld(b, q().setFromAxisAngle(bar, -(j === '01' ? 0.9 : 0.75))); }
        for (const j of ['01', '02', '03']) { const b = bones['thumb_' + j + '_' + s]; if (b) rotateWorld(b, q().setFromAxisAngle(bar, -0.35)); }
      } else twoBone(bones['upperarm_' + s], bones['lowerarm_' + s], bones['hand_' + s], hand, elbowPole);
      const kneePole = W2(v().set(target.hip.x + 0.8, target.hip.y + 0.2, sign * (0.25 - 0.2 * W.kneeKnock)));
      twoBone(bones['thigh_' + s], bones['calf_' + s], bones['foot_' + s], W2(target.feet[i]), kneePole);
    }
  }

  const J = { pelvis: ['pelvis', 0.10, 12], chest: ['spine_03', 0.11, 15], head: ['Head', 0.12, 4],
    shoulderL: ['upperarm_l', 0.065, 2], elbowL: ['lowerarm_l', 0.05, 2], handL: ['hand_l', 0.04, 1],
    shoulderR: ['upperarm_r', 0.065, 2], elbowR: ['lowerarm_r', 0.05, 2], handR: ['hand_r', 0.04, 1],
    hipL: ['thigh_l', 0.065, 4], kneeL: ['calf_l', 0.052, 3], footL: ['foot_l', 0.05, 1.5],
    hipR: ['thigh_r', 0.065, 4], kneeR: ['calf_r', 0.052, 3], footR: ['foot_r', 0.05, 1.5] };

  const api = {
    root,
    update(args = {}) {
      lastArgs = args; targets(args); solve();
    },
    // World joint points for the crash rig (same keys as rider-model.js).
    joints() {
      root.updateWorldMatrix(true, true);
      const out = {};
      if (!model) { // not loaded yet: approximate from the pose targets
        const p = x => ({ position: W2(x).toArray() });
        const hip = target.hip, chest = hip.clone().add(v().set(0.25, 0.4, 0));
        Object.assign(out, { pelvis: p(hip), chest: p(chest), head: p(chest.clone().add(v().set(0.08, 0.28, 0))) });
        for (const [k, i] of [['L', 0], ['R', 1]]) {
          const z = i ? 0.17 : -0.17;
          out['shoulder' + k] = p(chest.clone().setZ(z)); out['hand' + k] = p(target.hands[i]); out['elbow' + k] = p(chest.clone().lerp(target.hands[i], 0.5).setZ(z * 1.3));
          out['hip' + k] = p(hip.clone().setZ(z * 0.5)); out['foot' + k] = p(target.feet[i]); out['knee' + k] = p(hip.clone().lerp(target.feet[i], 0.5).add(v().set(0.2, 0.1, 0)));
        }
        for (const [k, [, r, m]] of Object.entries(J)) Object.assign(out[k], { radius: r, mass: m });
        return out;
      }
      for (const [k, [b, r, m]] of Object.entries(J)) {
        const p = wpos(bones[b]); if (k === 'head') p.add(v().set(0, 0.1, 0));
        out[k] = { position: p.toArray(), radius: r, mass: m };
      }
      return out;
    },
    // Pose the skinned rider onto simulated joint points (crash rig), in scene space.
    ragdoll(scene, P) {
      if (root.parent !== scene) scene.add(root);
      root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1);
      if (!model) return;
      for (const [b, r] of rest) b.quaternion.copy(r);
      const V = k => new T.Vector3(...P[k]);
      model.position.copy(V('pelvis')).sub(pelvisRest); root.updateMatrixWorld(true);
      aim(bones.pelvis, bones.spine_03, V('chest'));
      // twist the torso so the shoulder line matches
      const axis = wpos(bones.spine_03).sub(wpos(bones.pelvis)).normalize();
      const cur = wpos(bones.upperarm_r).sub(wpos(bones.upperarm_l)), want = V('shoulderR').sub(V('shoulderL'));
      cur.addScaledVector(axis, -cur.dot(axis)); want.addScaledVector(axis, -want.dot(axis));
      if (cur.lengthSq() > 1e-6 && want.lengthSq() > 1e-6) rotateWorld(bones.pelvis, q().setFromUnitVectors(cur.normalize(), want.normalize()));
      aim(bones.neck_01, bones.Head, V('head'));
      for (const [s, k] of [['l', 'L'], ['r', 'R']]) {
        twoBone(bones['upperarm_' + s], bones['lowerarm_' + s], bones['hand_' + s], V('hand' + k), V('elbow' + k));
        twoBone(bones['thigh_' + s], bones['calf_' + s], bones['foot_' + s], V('foot' + k), V('knee' + k));
      }
    },
    attach() { body.add(root); root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1); this.update(lastArgs); },
    setOutfit() {}, appearance() {},
    state() {
      const handErr = [], footErr = [];
      if (model) { for (const [s, i] of [['l', 0], ['r', 1]]) { handErr.push(wpos(bones['hand_' + s]).distanceTo(W2(target.hands[i]))); footErr.push(wpos(bones['foot_' + s]).distanceTo(W2(target.feet[i]))); } }
      return { kind: 'ubc', stance, reference: 'Quaternius Universal Base Character (CC0)', loaded: !!model, error, meshes,
        weights: { ...W }, hip: target.hip.toArray(), pitchDeg: (target.pitch + reach.pitch) * 180 / Math.PI, reachFoldDeg: reach.pitch * 180 / Math.PI, reachShiftM: reach.shift, armLen,
        hipWorld: model ? wpos(bones.pelvis).toArray() : null, gripMeshes: gripMeshes ? gripMeshes.map(o => o.name) : null, dyn: { absorbM: D.y, attack: D.attack, rough: D.rough, back: D.back, look: D.look }, handErrM: handErr, footErrM: footErr,
        legLen, attach: { seat: seat.toArray(), pegs: pegs.toArray(), grips: grips.toArray(), gripW, pegW, crankR } };
    },
  };
  return api;
}
