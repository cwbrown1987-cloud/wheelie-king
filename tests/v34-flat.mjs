// v34: Playground flat-ground feel checks on the Jolt MotorcycleTest port (node, no browser).
// Prints the numbers and asserts sane ranges. Writes test-results/v34-flat.json.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createJoltRide,MOTO_SAMPLE} from '../ride-jolt.js';
import {makePlaygroundTerrain} from '../ride-physics.js';

const P={R:.33,wb:1.34,comBack:.42,comH:.95};
const ter=makePlaygroundTerrain();
const dt=1/60;
async function fresh(){const j=createJoltRide({P});await j.start();assert(j.ready,'jolt ready '+j.error);const s={x:0,z:0,yaw:0,vx:0};j.adopt(s);return {j,s};}
function run(j,s,inp,sec,cb){const n=Math.round(sec/dt);for(let i=0;i<n;i++){j.step(s,P,inp,dt,ter);if(cb&&cb(s,(i+1)*dt)===false)return (i+1)*dt;}return sec;}
// Test-driver speed hold (bang-bang throttle), only used to measure turning.
const hold=(s,target)=>({throttle:Math.max(0,Math.min(0.35,(target-s.vx)*0.15))});
const R={};let t0=performance.now(),steps=0;

{ // rest: no sinking, no creeping
  const {j,s}=await fresh();let ymin=9,ymax=-9,vmin=0,cy=[];
  run(j,s,{},5,s=>{ymin=Math.min(ymin,s.y);ymax=Math.max(ymax,s.y);vmin=Math.min(vmin,s.vx);const d=j.dump();if(d.contact.rear)cy.push(d.contact.rear.py);});
  R.rest={yRange:ymax-ymin,minVx:vmin,drift:Math.hypot(s.x,s.z),roll:s.joltRoll,contactY:[Math.min(...cy),Math.max(...cy)]};
}
{ // launch
  const {j,s}=await fresh();let t20=null,t100=null,top=0,tTop=0,vmin=0;
  run(j,s,{throttle:1},60,(s,t)=>{const k=s.vx*3.6;if(t20==null&&k>=20)t20=t;if(t100==null&&k>=100)t100=t;if(s.vx>top+0.05){top=s.vx;tTop=t;}vmin=Math.min(vmin,s.vx);steps++;});
  // time to 95% of the speed reached in 60 s
  const {j:j2,s:s2}=await fresh();const t95=run(j2,s2,{throttle:1},60,s=>s.vx<top*.95);
  R.launch={t0_20:t20,t0_100:t100,topKmh:top*3.6,t0_95top:t95,minVx:vmin};
  // release: coast, must never go backwards
  let back=0;run(j,s,{},20,s=>{back=Math.min(back,s.vx)});R.launch.coastMinVx=back;R.launch.coastEndKmh=s.vx*3.6;
}
{ // stopping from 30 km/h with brake (sample: Down brakes until stopped)
  const {j,s}=await fresh();run(j,s,{throttle:1},10,s=>s.vx<31/3.6);run(j,s,{},1);
  const x0=s.x,z0=s.z,v0=s.vx;const tStop=run(j,s,{brake:1},10,s=>s.vx>0.1);
  const d=Math.hypot(s.x-x0,s.z-z0);R.stop={fromKmh:v0*3.6,distance:d,time:tStop,decel:v0/tStop,distanceFrom30:d*(30/(v0*3.6))**2,roll:s.joltRoll};
}
{ // reverse: brake held at standstill backs up; release stops reversing
  const {j,s}=await fresh();let vmin=0;run(j,s,{brake:1},4,s=>{vmin=Math.min(vmin,s.vx)});
  let after=0;run(j,s,{},3,s=>{after=s.vx});R.reverse={maxReverseKmh:-vmin*3.6,vxAfterRelease3s:after};
}
for(const kmh of [10,25]){ // turning circle and steering response
  const {j,s}=await fresh();const v=kmh/3.6;run(j,s,{throttle:1},10,s=>s.vx<v);
  run(j,s,hold(s,v),2,s=>{});
  for(let i=0;i<120;i++)j.step(s,P,hold(s,v),dt,ter);
  // step full right steer; record roll
  const rolls=[],yawr=[];let tt=0;
  for(let i=0;i<360;i++){j.step(s,P,{...hold(s,v),steer:1},dt,ter);tt+=dt;rolls.push([tt,Math.abs(s.joltRoll)]);yawr.push([tt,s.wYaw,s.vx]);}
  const ss=rolls.slice(-60).reduce((a,r)=>a+r[1],0)/60;const t90=(rolls.find(r=>r[1]>=.9*ss)||[null])[0];
  const late=yawr.slice(-60),w=late.reduce((a,r)=>a+Math.abs(r[1]),0)/60,vv=late.reduce((a,r)=>a+r[2],0)/60;
  R['turn'+kmh]={radius:vv/w,diameter:2*vv/w,steadyLeanDeg:ss*180/Math.PI,t90Lean:t90,speedKmh:vv*3.6};
}
{ // straight-line stability: 40 km/h, no input 10 s
  const {j,s}=await fresh();run(j,s,{throttle:1},10,s=>s.vx<40/3.6);const yaw0=s.yaw;let rmax=0,wmax=0;
  run(j,s,{},10,s=>{rmax=Math.max(rmax,Math.abs(s.joltRoll));wmax=Math.max(wmax,Math.abs(s.wYaw))});
  R.straight={maxRollDeg:rmax*180/Math.PI,maxYawRate:wmax,headingDriftDeg:Math.abs(s.yaw-yaw0)*180/Math.PI,endKmh:s.vx*3.6};
}
R.physicsMsPerStep=(performance.now()-t0)/Math.max(1,steps);
R.sample=MOTO_SAMPLE;
console.log(JSON.stringify(R,(k,v)=>typeof v==='number'?+v.toFixed(3):v,1));
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/v34-flat.json',JSON.stringify(R,null,1));
assert(R.rest.yRange<0.01&&R.rest.drift<0.05&&Math.abs(R.rest.minVx)<0.05,'rest: no sink/creep');
assert(Math.abs(R.rest.contactY[0])<0.02&&Math.abs(R.rest.contactY[1])<0.02,'wheel contact on the ground plane');
assert(R.launch.t0_20>0.5&&R.launch.t0_20<4,'0-20 km/h');
assert(R.launch.topKmh>60&&R.launch.topKmh<300,'top speed');
assert(R.launch.minVx>-0.05&&R.launch.coastMinVx>-0.05,'no backward motion without brake');
assert(R.stop.distanceFrom30>2&&R.stop.distanceFrom30<20,'stop from 30 km/h');
assert(R.reverse.maxReverseKmh>1&&R.reverse.maxReverseKmh<10&&Math.abs(R.reverse.vxAfterRelease3s)<0.15,'reverse on brake at standstill');
assert(R.turn10.diameter>2&&R.turn10.diameter<20&&R.turn25.diameter>4&&R.turn25.diameter<60,'turning circles');
assert(R.turn25.t90Lean!=null&&R.turn25.t90Lean<5,'steering response');
assert(R.straight.maxRollDeg<3&&R.straight.headingDriftDeg<3,'straight-line stability');
console.log('v34-flat ok');
