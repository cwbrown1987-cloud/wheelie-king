// On foot (v2.1-38): get off the bike and walk, run, jump, do a Fortnite-style slide, or go full ragdoll.
// The same Quaternius UBC character as the rider, posed procedurally: every frame we work out where the joints
// should be (pelvis, chest, head, shoulders/elbows/hands, hips/knees/feet) for the current move, then two-bone
// IK puts the skinned body on them. The ragdoll is a little verlet skeleton over those same joints.
import { GLTFLoader } from './vendor/GLTFLoader.js';
const URL_GLB = './assets/quaternius/ubc-superhero-male.glb', URL_ANIM = './assets/quaternius/ual-locomotion.glb', HEIGHT = 1.74;
// v2.1-42: walking/running/jumping use Quaternius' Universal Animation Library (CC0) clips on the same skeleton,
// blended by speed and synced to the ground so the feet don't skate. Slide, ragdoll and get on/off stay procedural.
const CLIP = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', jumpStart: 'Jump_Start', jumpLoop: 'Jump_Loop', land: 'Jump_Land', slide: 'Sitting_Idle_Loop' }; // slide = the sitting pose laid back on the ground
// metres covered per full cycle of each loop (two steps) — sets how fast each clip plays for a given speed
const CYCLE = { walk: 1.55, jog: 2.5, sprint: 3.6 };
export const WALK = { walk: 1.7, run: 6.2, accel: 14, airAccel: 3, turn: 10, jump: 5.2, g: 9.8, step: .45, slideTime: .9, slideBoost: 1.8, slideFric: 1.4, slideMin: 1.6, slideSteer: 1.6, ragdollFall: 10.5, getUp: 2.4 };
const JOINTS = ['pelvis', 'chest', 'head', 'shoulderL', 'elbowL', 'handL', 'shoulderR', 'elbowR', 'handR', 'hipL', 'kneeL', 'footL', 'hipR', 'kneeR', 'footR'];
// verlet ragdoll links (bones + braces that keep the torso a torso)
const LINKS = [['pelvis', 'chest'], ['chest', 'head'], ['chest', 'shoulderL'], ['chest', 'shoulderR'], ['shoulderL', 'shoulderR'], ['shoulderL', 'elbowL'], ['elbowL', 'handL'], ['shoulderR', 'elbowR'], ['elbowR', 'handR'],
  ['pelvis', 'hipL'], ['pelvis', 'hipR'], ['hipL', 'hipR'], ['hipL', 'kneeL'], ['kneeL', 'footL'], ['hipR', 'kneeR'], ['kneeR', 'footR'], ['shoulderL', 'hipL'], ['shoulderR', 'hipR'], ['shoulderL', 'hipR'], ['shoulderR', 'hipL'], ['head', 'shoulderL'], ['head', 'shoulderR'], ['chest', 'hipL'], ['chest', 'hipR']];
export function makeWalker(T, scene, ter) {
  const root = new T.Group(); root.name = 'wk:walker'; root.visible = false; scene.add(root);
  let model = null, bones = null, rest = null, pelvisRest = null, error = null, mixer = null, animReady = false, cyc = 0, airT = 0, landT = 0, wasOnG = true, snap = null, snapT = 0;
  const acts = {}, W8 = { idle: 1, walk: 0, jog: 0, sprint: 0, jumpStart: 0, jumpLoop: 0, land: 0, slide: 0 };
  const v = () => new T.Vector3(), q = () => new T.Quaternion(), _a = v(), _b = v(), _c = v(), _q1 = q(), _q2 = q(), _q3 = q();
  const wpos = (o, out = v()) => o.getWorldPosition(out);
  function rotateWorld(bone, delta) { bone.parent.getWorldQuaternion(_q1); bone.getWorldQuaternion(_q2); bone.quaternion.copy(_q1.invert().multiply(_q3.copy(delta).multiply(_q2))); bone.updateMatrixWorld(true); }
  function aim(bone, child, t) { const a = wpos(bone, _a), from = wpos(child, _b).sub(a), to = _c.copy(t).sub(a); if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return; rotateWorld(bone, q().setFromUnitVectors(from.normalize(), to.normalize())); }
  function twoBone(upper, lower, end, target, pole) {
    const a = wpos(upper, v()), m = wpos(lower, v()), e = wpos(end, v()), l1 = a.distanceTo(m), l2 = m.distanceTo(e), n = target.clone().sub(a); let d = n.length(); if (d < 1e-4) return; n.divideScalar(d);
    d = Math.min(d, (l1 + l2) * .999); d = Math.max(d, Math.abs(l1 - l2) + 1e-3); const p = pole.clone().sub(a); p.addScaledVector(n, -p.dot(n)); if (p.lengthSq() < 1e-8) p.set(0, 1, 0); p.normalize();
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x)); aim(upper, lower, a.clone().addScaledVector(n, x).addScaledVector(p, h)); aim(lower, end, a.clone().addScaledVector(n, d));
  }
  fetch(URL_GLB).then(r => { if (!r.ok) throw Error('walker glb ' + r.status); return r.arrayBuffer(); }).then(buf => new GLTFLoader().parseAsync(buf, './assets/quaternius/')).then(g => {
    model = g.scene; model.name = 'walker:ubc'; model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); root.add(model); root.updateMatrixWorld(true);
    const by = n => model.getObjectByName(n), yIn = n => by(n).getWorldPosition(v()).y;
    model.scale.setScalar(HEIGHT * .876 / Math.max(1e-6, yIn('Head') - yIn('ball_l'))); root.updateMatrixWorld(true);
    bones = {}; for (const n of ['pelvis', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r']) { bones[n] = by(n); if (!bones[n]) throw Error('walker bone missing ' + n); }
    rest = []; model.traverse(o => { if (o.isBone) rest.push([o, o.quaternion.clone()]); });
    pelvisRest = wpos(bones.pelvis).sub(model.position);
    // animation clips: keep rotations (and the pelvis height/sway) so the clips fit this body's own proportions
    new GLTFLoader().loadAsync(URL_ANIM).then(a => { if (!model) return; mixer = new T.AnimationMixer(model);
      for (const [k, name] of Object.entries(CLIP)) { const c = a.animations.find(x => x.name === name); if (!c) continue;
        c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'pelvis.position'); const act = mixer.clipAction(c); act.play(); act.setEffectiveWeight(0); acts[k] = act; }
      animReady = Object.keys(acts).length >= 4; }).catch(e => console.warn('[wk] walker clips failed', e));
  }).catch(e => { error = e.message || String(e); console.warn('[wk] walker failed to load', e); });
  // pose the skin onto world joint points
  function poseTo(J) {
    if (!model) return; root.position.set(0, 0, 0); root.quaternion.identity(); root.updateMatrixWorld(true);
    for (const [b, r] of rest) b.quaternion.copy(r);
    model.position.copy(J.pelvis).sub(pelvisRest); model.rotation.set(0, 0, 0); model.updateMatrixWorld(true);
    // face the body the way the hips face: rotate the model about the pelvis so its forward (+Z) points along hips' forward
    const hipR = J.hipR.clone().sub(J.hipL); hipR.y = 0; if (hipR.lengthSq() > 1e-6) { hipR.normalize(); const fwd = v().set(-hipR.z, 0, hipR.x); /* right x up = forward */ model.rotation.y = Math.atan2(fwd.x, fwd.z); model.position.copy(J.pelvis).sub(pelvisRest.clone().applyAxisAngle(v().set(0, 1, 0), model.rotation.y)); model.updateMatrixWorld(true); }
    aim(bones.pelvis, bones.spine_03, J.chest);
    const axis = wpos(bones.spine_03).sub(wpos(bones.pelvis)).normalize(), cur = wpos(bones.upperarm_r).sub(wpos(bones.upperarm_l)), want = J.shoulderR.clone().sub(J.shoulderL);
    cur.addScaledVector(axis, -cur.dot(axis)); want.addScaledVector(axis, -want.dot(axis)); if (cur.lengthSq() > 1e-6 && want.lengthSq() > 1e-6) rotateWorld(bones.pelvis, q().setFromUnitVectors(cur.normalize(), want.normalize()));
    aim(bones.neck_01, bones.Head, J.head);
    for (const [s, k] of [['l', 'L'], ['r', 'R']]) { twoBone(bones['upperarm_' + s], bones['lowerarm_' + s], bones['hand_' + s], J['hand' + k], J['elbow' + k]); twoBone(bones['thigh_' + s], bones['calf_' + s], bones['foot_' + s], J['foot' + k], J['knee' + k]); }
  }
  // ---- state ----
  const S = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, mode: 'walk', onG: true, phase: 0, t: 0, slideT: 0, ragT: 0, crouch: 0, blend: null, blendT: 0, blendDur: 0, lastJ: null, speed: 0, fallFrom: 0, events: [] };
  const height = (x, z) => ter.height ? ter.height(x, z) : 0;
  let rag = null; // {p:{k:Vector3}, o:{k:Vector3 old}, L:[[a,b,len]]}
  const J = {}; for (const k of JOINTS) J[k] = v();
  function procedural(dt) {
    const f = v().set(Math.cos(S.yaw), 0, Math.sin(S.yaw)), r = v().set(-Math.sin(S.yaw), 0, Math.cos(S.yaw)), up = v().set(0, 1, 0), base = v().set(S.x, S.y, S.z);
    const sp = S.speed, run = Math.min(1, Math.max(0, (sp - WALK.walk) / (WALK.run - WALK.walk))), moving = Math.min(1, sp / .6);
    const stride = .55 + .9 * run; if (S.onG && S.mode === 'walk') S.phase += sp / Math.max(.3, stride) * Math.PI * dt;
    const ph = S.phase, crouch = S.crouch, air = S.onG ? 0 : 1, slide = S.mode === 'slide' ? Math.min(1, S.slideT * 6, (WALK.slideTime - S.slideT) * 0 + 1) : 0;
    const hipH = .93 - .05 * run - .03 * moving * Math.abs(Math.sin(ph * 2)) * (1 - run * .3) - crouch * .3;
    const lean = .05 * moving + .14 * run;
    const pel = base.clone().addScaledVector(up, hipH).addScaledVector(f, lean * .15);
    const chest = pel.clone().addScaledVector(up, .4 * Math.cos(lean)).addScaledVector(f, .4 * Math.sin(lean));
    // slide: low and laid back
    if (slide) { pel.copy(base).addScaledVector(up, .38); chest.copy(pel).addScaledVector(up, .3).addScaledVector(f, -.25); }
    const head = chest.clone().addScaledVector(up, .26).addScaledVector(f, .04 + (slide ? .12 : 0));
    J.pelvis.copy(pel); J.chest.copy(chest); J.head.copy(head);
    for (const [i, k, side] of [[0, 'L', -1], [1, 'R', 1]]) {
      const pi = ph + i * Math.PI, sw = Math.sin(pi), lift = Math.max(0, -Math.cos(pi));
      const hip = pel.clone().addScaledVector(r, side * .1).addScaledVector(up, -.06); J['hip' + k].copy(hip);
      let foot;
      if (slide) foot = i === 0 ? base.clone().addScaledVector(f, .75).addScaledVector(r, side * .12).addScaledVector(up, .1) : base.clone().addScaledVector(f, .05).addScaledVector(r, side * .2).addScaledVector(up, .12);
      else if (air) foot = hip.clone().addScaledVector(up, -.62 + crouch * .1).addScaledVector(f, (i ? .18 : -.08)).addScaledVector(r, side * .04);
      else { const fx = .5 * stride * sw * moving, fh = lift * (.08 + .1 * run) * moving; foot = base.clone().addScaledVector(f, fx).addScaledVector(r, side * .11); foot.y = height(foot.x, foot.z) + .08 + fh; }
      J['foot' + k].copy(foot);
      J['knee' + k].copy(hip).lerp(foot, .5).addScaledVector(f, .45).addScaledVector(r, side * (slide && i === 1 ? .3 : .05));
      const sh = chest.clone().addScaledVector(r, side * .19).addScaledVector(up, .06); J['shoulder' + k].copy(sh);
      let hand;
      if (slide) hand = i === 0 ? base.clone().addScaledVector(f, -.35).addScaledVector(r, side * .35).addScaledVector(up, .05) : sh.clone().addScaledVector(up, .35).addScaledVector(r, side * .2);
      else if (air) hand = sh.clone().addScaledVector(up, -.15 + .35 * Math.max(0, S.vy) / WALK.jump).addScaledVector(r, side * .28).addScaledVector(f, .1);
      else { const swing = -Math.sin(pi) * (.16 + .2 * run) * moving; hand = sh.clone().addScaledVector(up, -.56 + .22 * run).addScaledVector(f, swing + .04 + .08 * run).addScaledVector(r, side * (-.02 + .02 * run)); hand.y += .02 * Math.sin(S.t * 2.1); }
      J['hand' + k].copy(hand);
      J['elbow' + k].copy(sh).lerp(hand, .5).addScaledVector(f, -.45).addScaledVector(r, side * .06).addScaledVector(up, -.05);
    }
  }
  function startRagdoll(vel) {
    const p = {}, o = {}; for (const k of JOINTS) { p[k] = J[k].clone(); o[k] = J[k].clone().addScaledVector(vel, -1 / 60); }
    // a little tumble
    o.head.add(v().set((Math.random() - .5) * .04, 0, (Math.random() - .5) * .04));
    rag = { p, o, L: LINKS.map(([a, b]) => [a, b, J[a].distanceTo(J[b])]) }; S.mode = 'ragdoll'; S.ragT = 0; S.events.push('ragdoll');
  }
  function stepRagdoll(dt) {
    const sub = 3, h = dt / sub;
    for (let it = 0; it < sub; it++) {
      for (const k of JOINTS) { const p = rag.p[k], o = rag.o[k], vx = (p.x - o.x) * .995, vy = (p.y - o.y) * .995, vz = (p.z - o.z) * .995; o.copy(p); p.x += vx; p.y += vy - WALK.g * h * h; p.z += vz; }
      for (let n = 0; n < 6; n++) {
        for (const [a, b, len] of rag.L) { const pa = rag.p[a], pb = rag.p[b], d = _a.copy(pb).sub(pa), l = d.length() || 1e-6, c = (l - len) / l * .5; pa.addScaledVector(d, c); pb.addScaledVector(d, -c); }
        for (const k of JOINTS) { const p = rag.p[k], g = height(p.x, p.z) + (k === 'head' ? .11 : k === 'pelvis' || k === 'chest' ? .1 : .05); if (p.y < g) { p.y = g; const o = rag.o[k]; o.x = p.x - (p.x - o.x) * .55; o.z = p.z - (p.z - o.z) * .55; } }
      }
    }
    for (const k of JOINTS) J[k].copy(rag.p[k]);
  }
  function animate(dt) {
    root.position.set(0, 0, 0); root.quaternion.identity(); root.updateMatrixWorld(true);
    model.position.set(S.x, S.y, S.z); model.rotation.set(0, Math.atan2(Math.cos(S.yaw), Math.sin(S.yaw)), 0);
    const sp = S.speed;
    // blend weights by speed: idle -> walk -> jog -> sprint
    const tw = { idle: 0, walk: 0, jog: 0, sprint: 0, jumpStart: 0, jumpLoop: 0, land: 0, slide: 0 };
    if (S.mode === 'slide' && S.onG) { tw.slide = 1; airT = 0; }
    else if (!S.onG) { airT += dt; if (airT < .3 && S.vy > 0) tw.jumpStart = 1; else tw.jumpLoop = 1; landT = 0; }
    else {
      if (!wasOnG) landT = .3; airT = 0;
      const a = Math.min(1, sp / .5), b = Math.max(0, Math.min(1, (sp - 1.9) / 1.6)), c = Math.max(0, Math.min(1, (sp - 4.2) / 1.6));
      tw.idle = 1 - a; tw.walk = a * (1 - b); tw.jog = a * b * (1 - c); tw.sprint = a * b * c;
      if (landT > 0) { const l = Math.min(1, landT / .3); for (const k of ['idle', 'walk', 'jog', 'sprint']) tw[k] *= 1 - l * .7; tw.land = l * .7; landT -= dt; }
    }
    wasOnG = S.onG;
    const k = 1 - Math.exp(-dt * (S.mode === 'slide' || W8.slide > .5 ? 18 : 12)); for (const key in W8) { W8[key] += (tw[key] - W8[key]) * k; acts[key]?.setEffectiveWeight(W8[key]); }
    // one shared phase for the run cycle so blended clips keep their feet in step; speed sets the rate
    const cd = (W8.walk * CYCLE.walk + W8.jog * CYCLE.jog + W8.sprint * CYCLE.sprint) / Math.max(1e-3, W8.walk + W8.jog + W8.sprint);
    if (S.onG) cyc = (cyc + sp * dt / Math.max(.5, cd)) % 1;
    for (const key of ['walk', 'jog', 'sprint']) if (acts[key]) acts[key].time = cyc * acts[key].getClip().duration;
    if (acts.idle) acts.idle.time = (acts.idle.time + dt) % acts.idle.getClip().duration;
    if (acts.jumpStart) acts.jumpStart.time = Math.min(acts.jumpStart.getClip().duration * .98, airT * 1.4);
    if (acts.jumpLoop) acts.jumpLoop.time = (airT % acts.jumpLoop.getClip().duration);
    if (acts.land) acts.land.time = Math.min(acts.land.getClip().duration * .98, (.3 - Math.max(0, landT)) * 2);
    if (acts.slide) acts.slide.time = (acts.slide.time + dt * .5) % acts.slide.getClip().duration;
    mixer.update(0); model.updateMatrixWorld(true);
    // slide: drop the hips to the ground and lay the body back, lead leg out front (the sitting pose, on the floor)
    if (W8.slide > .01) {
      const sw = W8.slide, back = .5 * sw;
      model.rotation.set(0, model.rotation.y, 0); model.rotateX(-back); model.updateMatrixWorld(true);
      const py = wpos(bones.pelvis).y, want = S.y + .2; model.position.y += (want - py) * sw;
      // a little spray of dust feel: lean into the slide's direction slightly
      model.updateMatrixWorld(true);
      // lead (right) leg straighter, trailing leg tucked; left hand trails on the ground, right arm up for balance
      twoBone(bones.thigh_r, bones.calf_r, bones.foot_r, wpos(bones.thigh_r).add(v().set(Math.cos(S.yaw), 0, Math.sin(S.yaw)).multiplyScalar(.82 * sw)).setY(S.y + .14), wpos(bones.thigh_r).add(v().set(0, .6, 0)));
      const lc = v().set(-Math.sin(S.yaw), 0, Math.cos(S.yaw));
      twoBone(bones.upperarm_l, bones.lowerarm_l, bones.hand_l, wpos(bones.thigh_l).add(lc.clone().multiplyScalar(-.32)).add(v().set(-Math.cos(S.yaw) * .25, 0, -Math.sin(S.yaw) * .25)).setY(S.y + .04), wpos(bones.upperarm_l).add(v().set(0, 0, 0).addScaledVector(lc, -.5)));
      twoBone(bones.upperarm_r, bones.lowerarm_r, bones.hand_r, wpos(bones.upperarm_r).add(v().set(0, .25, 0)).addScaledVector(lc, .3).add(v().set(Math.cos(S.yaw) * .15, 0, Math.sin(S.yaw) * .15)), wpos(bones.upperarm_r).addScaledVector(lc, .5));
    }
    // cross-fade out of a procedural pose (just got off the bike / just got up)
    if (snapT > 0 && snap) { const t = 1 - snapT / .28, e = t * t * (3 - 2 * t); rest.forEach(([b], i) => b.quaternion.slerpQuaternions(snap[i], b.quaternion.clone(), e)); model.updateMatrixWorld(true); snapT -= dt; } else snapT = 0;
  }
  const api = {
    root, S, get loaded() { return !!model; }, error: () => error,
    spawn(x, z, yaw, { vx = 0, vz = 0, fromJoints = null, dur = .45 } = {}) {
      Object.assign(S, { x, z, y: height(x, z), vx, vy: 0, vz, yaw, mode: 'walk', onG: true, slideT: 0, ragT: 0, crouch: 0, speed: Math.hypot(vx, vz) }); rag = null; root.visible = true;
      procedural(0); if (fromJoints) { S.blend = {}; for (const k of JOINTS) if (fromJoints[k]) S.blend[k] = v().fromArray(fromJoints[k].position || fromJoints[k]); S.blendT = 0; S.blendDur = dur; }
    },
    hide() { root.visible = false; rag = null; S.toward = null; },
    blendTo(joints, dur = .4) { S.toward = {}; for (const k of JOINTS) if (joints[k]) S.toward[k] = v().fromArray(joints[k].position || joints[k]); S.towardT = 0; S.towardDur = dur; S.vx = S.vz = 0; },
    // input: {mx, mz} desired move direction in world (length 0..1), run (bool), jump, slide, ragdoll (edges)
    update(dt, inp = {}) {
      if (!root.visible) return; S.t += dt; S.events.length = 0;
      if (S.mode === 'ragdoll') { stepRagdoll(dt); S.ragT += dt; const pc = rag.p.pelvis; S.x = pc.x; S.z = pc.z; S.y = height(S.x, S.z);
        const still = rag.p.pelvis.distanceTo(rag.o.pelvis) / Math.max(1e-3, dt / 3) < .4; if (S.ragT > WALK.getUp && still || S.ragT > 6) { const hd = rag.p.head.clone().sub(rag.p.pelvis); S.yaw = Math.atan2(hd.z, hd.x); S.mode = 'walk'; S.vx = S.vz = S.vy = 0; const from = {}; for (const k of JOINTS) from[k] = J[k].clone(); rag = null; procedural(0); S.blend = from; S.blendT = 0; S.blendDur = .7; S.events.push('getup'); } }
      else {
        const imx = inp.mx || 0, imz = inp.mz || 0, m = Math.min(1, Math.hypot(imx, imz)), top = S.mode === 'slide' ? 0 : (inp.run ? WALK.run : WALK.walk + (WALK.run - WALK.walk) * Math.max(0, m - .8) / .2 * 0) * m;
        if (inp.ragdoll) startRagdoll(v().set(S.vx, S.vy, S.vz).add(v().set(Math.cos(S.yaw), .6, Math.sin(S.yaw)).multiplyScalar(2.5)));
        else {
          if (S.mode === 'slide') { // v2.1-43 Fortnite slide: lasts while the button is held and you've still got momentum
            S.slideT += dt; let sp = Math.hypot(S.vx, S.vz);
            const dir = sp > 1e-3 ? [S.vx / sp, S.vz / sp] : [Math.cos(S.yaw), Math.sin(S.yaw)], e = .4, slope = (height(S.x + dir[0] * e, S.z + dir[1] * e) - height(S.x - dir[0] * e, S.z - dir[1] * e)) / (2 * e);
            sp = Math.max(0, sp - (WALK.slideFric + WALK.g * slope * .9) * dt); // downhill keeps you going, uphill bleeds it off
            let hd = Math.atan2(dir[1], dir[0]); if (m > .05) { let d = Math.atan2(imz, imx) - hd; d = Math.atan2(Math.sin(d), Math.cos(d)); hd += Math.max(-1, Math.min(1, d)) * WALK.slideSteer * dt; }
            S.vx = Math.cos(hd) * sp; S.vz = Math.sin(hd) * sp; S.yaw = hd;
            if ((!inp.slideHeld && S.slideT > .25) || sp < WALK.slideMin) { S.mode = 'walk'; S.events.push('slide-end'); }
            if (inp.jump && S.onG) { S.mode = 'walk'; S.vy = WALK.jump; S.onG = false; S.events.push('jump'); } }
          else {
            if (m > .05) { const want = Math.atan2(imz, imx); let d = want - S.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); S.yaw += d * Math.min(1, dt * WALK.turn); S.yaw = Math.atan2(Math.sin(S.yaw), Math.cos(S.yaw)); }
            const tx = m > .05 ? imx / m * top : 0, tz = m > .05 ? imz / m * top : 0, a = (S.onG ? WALK.accel : WALK.airAccel) * dt;
            const dx = tx - S.vx, dz = tz - S.vz, dl = Math.hypot(dx, dz); if (dl > a) { S.vx += dx / dl * a; S.vz += dz / dl * a; } else { S.vx = tx; S.vz = tz; }
            if (inp.jump && S.onG) { S.vy = WALK.jump; S.onG = false; S.crouch = 0; S.events.push('jump'); }
            if (inp.slide && S.onG && Math.hypot(S.vx, S.vz) > 3.2) { S.mode = 'slide'; S.slideT = 0; const sp = Math.hypot(S.vx, S.vz); S.vx *= (sp + WALK.slideBoost) / sp; S.vz *= (sp + WALK.slideBoost) / sp; S.events.push('slide'); }
          }
        }
        if (S.mode !== 'ragdoll') {
          // move with simple ground/step/post collision
          let nx = S.x + S.vx * dt, nz = S.z + S.vz * dt; const gNow = height(S.x, S.z), gNew = height(nx, nz);
          if (S.onG && gNew - gNow > WALK.step) { nx = S.x; nz = S.z; S.vx *= .2; S.vz *= .2; }
          for (const p of ter.posts || []) { const ddx = nx - p.x, ddz = nz - p.z, d = Math.hypot(ddx, ddz), need = p.r + .3; if (d < need && d > 1e-6) { nx = p.x + ddx / d * need; nz = p.z + ddz / d * need; } }
          S.x = nx; S.z = nz;
          if (S.onG) { const g = height(S.x, S.z); if (S.y - g > .35) { S.onG = false; S.vy = 0; S.fallFrom = S.y; } else S.y = g; }
          else { S.vy -= WALK.g * dt; S.y += S.vy * dt; const g = height(S.x, S.z); if (S.y <= g) { const impact = -S.vy; S.y = g; S.vy = 0; S.onG = true; S.crouch = Math.min(1, impact / 9); S.events.push('land'); if (impact > WALK.ragdollFall) { procedural(0); startRagdoll(v().set(S.vx, -impact * .6, S.vz)); } } }
          S.crouch = Math.max(0, S.crouch - dt * 3.5); S.speed = Math.hypot(S.vx, S.vz);
          if (S.mode !== 'ragdoll') procedural(dt);
        }
      }
      // blend toward a target pose (getting on the bike)
      if (S.toward) { S.towardT += dt; const t = Math.min(1, S.towardT / S.towardDur), e = t * t * (3 - 2 * t); for (const k of JOINTS) if (S.toward[k]) J[k].lerp(S.toward[k], e); }
      // blend in from the previous pose (getting off the bike, getting up)
      if (S.blend) { S.blendT += dt; const t = Math.min(1, S.blendT / S.blendDur), e = t * t * (3 - 2 * t); for (const k of JOINTS) if (S.blend[k]) J[k].lerpVectors(S.blend[k], J[k], e); if (t >= 1) S.blend = null; }
      const useJoints = !animReady || S.mode === "ragdoll" || (S.mode === "slide" && !acts.slide) || S.blend || S.toward;
      if (useJoints) { poseTo(J); if (model && rest) snap = rest.map(([b], i) => (snap?.[i] || new T.Quaternion()).copy(b.quaternion)); snapT = .28; }
      else animate(dt);
    },
    joints: () => J,
    state: () => ({ loaded: !!model, error, mode: S.mode, onG: S.onG, speed: S.speed, x: S.x, y: S.y, z: S.z, yaw: S.yaw, visible: root.visible }),
    dispose() { root.removeFromParent(); model?.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); } }); },
  };
  return api;
}
