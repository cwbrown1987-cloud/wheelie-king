// Playground on Chris's classic ride physics (node, no browser). Locks in that the free-roam
// version keeps the side-view feel and none of the Jolt-era handling bugs come back:
// no rest creep, no random hops, hard turns and bump-turns don't flip, ramps launch and land.
import assert from 'node:assert/strict';
import {makePlaygroundTerrain,makeState,step,bikeParams} from '../ride-physics.js';
import {TERRAIN,PLAYGROUND_RAMPS} from '../ride-playground.js';
const ter=makePlaygroundTerrain(),dt=1/60,N=8,D={throttle:0,brake:0,lean:0,steer:0,hop:0,trick:0};
const bikes={emoto:bikeParams({kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15}),bmx:bikeParams({kg:11,powertrain:'human',wb:1.0,wheelR:.25})};
const fresh=(P,pose={})=>{const s=makeState(P,0,ter),y0=s.y;Object.assign(s,pose);s.y=ter.height(s.x,s.z||0)+y0;return s};
const run=(P,s,inp,sec,cb)=>{for(let i=0;i<sec/dt&&!s.crashed;i++){for(let k=0;k<N;k++)step(s,P,{...D,...(typeof inp==='function'?inp(s,i*dt):inp)},dt/N,ter);cb?.(s,i*dt)}return s};
const finite=s=>['x','y','z','yaw','vx','vy','pitch','w'].every(k=>Number.isFinite(s[k]));
for(const [name,P] of Object.entries(bikes)){
  {const s=fresh(P);run(P,s,{},4);assert.ok(Math.abs(s.x)<.01&&finite(s),name+' rest: no creep');}
  {const s=fresh(P);run(P,s,s=>({throttle:s.vx<4?1:0}),3);let maxVy=0;run(P,s,s=>({throttle:s.vx<4?.6:0}),5,s=>{maxVy=Math.max(maxVy,Math.abs(s.vy))});assert.ok(maxVy<.05,name+' flat cruise: no random hops '+maxVy);}
  {const s=fresh(P);run(P,s,s=>({throttle:s.vx<5?1:0}),4);const y0=s.yaw;run(P,s,s=>({throttle:s.vx<5?.7:0,steer:1}),4);assert.equal(s.crashed,null,name+' hard turn must not flip');assert.ok(Math.abs(s.yaw-y0)>3,name+' hard turn actually turns');}
  {const s=fresh(P,{x:TERRAIN.x0-10,z:TERRAIN.z});run(P,s,(s,t)=>({throttle:s.vx<5?1:0,steer:Math.sin(t*1.5)*.6}),16);assert.equal(s.crashed,null,name+' bump-turn weave on the terrain lane');assert.ok(finite(s));}
  {const s=fresh(P);run(P,s,{throttle:.6},2);let wt=0;run(P,s,s=>({throttle:.8,lean:s.pitch>.6?.2:1}),5,s=>{if(s.ground[0]&&!s.ground[1])wt+=dt});assert.equal(s.crashed,null);assert.ok(wt>3,name+' wheelie from throttle + weight back '+wt);}
}
{const P=bikes.emoto;for(const r of PLAYGROUND_RAMPS){const s=fresh(P,{x:r.x-25,z:r.z});let air=0,maxSpeed=0;run(P,s,s=>({throttle:s.vx<8.3?1:0}),6,s=>{if(!s.ground[0]&&!s.ground[1])air+=dt;maxSpeed=Math.max(maxSpeed,Math.hypot(s.vx,s.vy))});
  assert.equal(s.crashed,null,r.id+' ramp: clean landing');assert.ok(air>.3,r.id+' ramp launches '+air);assert.ok(maxSpeed<12,r.id+' ramp: no violent launch '+maxSpeed);}}
{const P=bikes.emoto,s=fresh(P);run(P,s,s=>({throttle:s.vx<7?1:0}),4);let st=0;run(P,s,{brake:1,lean:-1},1.5,s=>{if(s.ground[1]&&!s.ground[0])st+=dt});assert.ok(st>.5,'stoppie from front brake + weight forward '+st);}
// slopeAt follows the ground along the heading (wheelie balance on ramps/hills needs it)
{const r=PLAYGROUND_RAMPS[1];assert.ok(ter.slopeAt(r.x+1,r.z,0)>.05);assert.ok(Math.abs(ter.slopeAt(r.x+1,r.z,Math.PI/2))<.02);assert.equal(ter.slopeAt(0,0,0),0);}
console.log('playground-classic: ok');
