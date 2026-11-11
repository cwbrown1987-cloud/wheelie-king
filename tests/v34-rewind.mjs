// v2.0: Jolt rewind / drop-in. A full Jolt snapshot (body pose, velocities, wheel spin, rpm, gear,
// rider toggles) restores cleanly on both rides: no teleport, jitter or runaway; lands upright.
import assert from 'node:assert/strict';
import {createJoltRide} from '../ride-jolt.js';
const dt=1/60,D=180/Math.PI;
const RIDES={
  emoto:{P:{R:.33,wb:1.36,comBack:.37,comH:.95},profile:{mass:137,comBack:.37,comH:.95,wheelbase:1.36,wheelR:.33,front:{travel:.18,damping:.55},rear:{travel:.23},engine:{torque:250,power:6000,topSpeed:80/3.6,driveAxle:'rear'},friction:1.15,brakeTorque:1}},
  ebike:{P:{R:.33,wb:1.36,comBack:.42,comH:.92},profile:{mass:107,comBack:.42,comH:.92,wheelbase:1.36,wheelR:.33,front:{travel:.14,damping:.5},rear:{travel:.15},engine:{torque:120,power:750,topSpeed:32/3.6,driveAxle:'rear'},friction:1,brakeTorque:1}},
};
const out={};
for(const [name,{P,profile}] of Object.entries(RIDES)){
  const j=createJoltRide({P,profile});await j.start();
  const s={x:0,z:0,yaw:0,vx:0,events:[]};j.adopt(s);
  const ring=[];const step=inp=>{j.step(s,P,inp,dt);ring.push({snap:j.snapshot(),x:s.x,vx:s.vx});if(ring.length>600)ring.shift();};
  for(let i=0;i<60;i++)step({});
  for(let i=0;i<150;i++)step({throttle:.6,steer:i>90?.4:0});
  const mark=ring.length-1,ref=ring[mark];
  // mess it up: pinned wheelie + full lock (the e-moto loops out; the e-bike is too weak to)
  for(let i=0;i<300&&!s.crashed;i++)step({mono:true,throttle:1,lean:1,steer:i>60?1:0});
  const crashed=s.crashed||null,diverged=Math.hypot(s.x-ref.x,(s.z||0))+Math.abs(s.pitch||0);
  // rewind = scrub back through the ring (restore every frame), then resume from the mark
  for(let k=ring.length-1;k>=mark;k-=3)j.restore(ring[k].snap,s);
  j.restore(ref.snap,s);s.crashed=null;
  const jumpX=Math.abs(s.x-ref.x),jumpV=Math.abs(s.vx-ref.vx);
  let maxPitch=0,maxRoll=0,maxV=0,prevV=s.vx,maxDv=0;
  for(let i=0;i<180;i++){j.step(s,P,{},dt);maxPitch=Math.max(maxPitch,Math.abs(s.pitch||0));maxRoll=Math.max(maxRoll,Math.abs(s.joltRoll||0));maxV=Math.max(maxV,Math.abs(s.vx));maxDv=Math.max(maxDv,Math.abs(s.vx-prevV));prevV=s.vx;}
  // drop-in at rest from the oldest frame: lands upright
  j.restore(ring[0].snap,s);s.crashed=null;for(let i=0;i<120;i++)j.step(s,P,{},dt);
  out[name]={crashed,diverged,refVx:ref.vx,jumpX,jumpV,maxPitchDeg:maxPitch*D,maxRollDeg:maxRoll*D,maxV,maxDvPerStep:maxDv,dropIn:{pitchDeg:(s.pitch||0)*D,rollDeg:(s.joltRoll||0)*D,crashed:s.crashed||null}};
  const o=out[name];
  assert(o.diverged>2,`${name}: ride moved well away before the rewind`);
  assert(o.jumpX<1e-3&&o.jumpV<.05,`${name}: restore lands exactly on the frame`);
  assert(o.maxV<=ref.vx+.5,`${name}: no runaway after rewind`);
  assert(o.maxDvPerStep<.3,`${name}: no velocity jitter after rewind`);
  assert(o.maxPitchDeg<15&&o.maxRollDeg<20&&!o.dropIn.crashed,`${name}: upright after rewind / drop-in`);
  j.dispose();
}
console.log(JSON.stringify(out,null,1));console.log('v34-rewind ok');
