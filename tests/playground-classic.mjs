// Playground on Chris's classic ride physics (node, no browser). Locks in that the free-roam
// version keeps the side-view feel and none of the Jolt-era handling bugs come back:
// no rest creep, no random hops, hard turns and bump-turns don't flip, ramps launch and land.
import assert from 'node:assert/strict';
import {makePlaygroundTerrain,makeState,step,bikeParams} from '../ride-physics.js';
import {TERRAIN,PLAYGROUND_RAMPS,PLAYGROUND_LOOPS,PLAYGROUND_POSTS,PLAYGROUND_PROPS} from '../ride-playground.js';
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
{const P=bikes.emoto;for(const r of PLAYGROUND_RAMPS.filter(r=>r.dir!==-1)){const s=fresh(P,{x:r.x-25,z:r.z});let air=0,maxSpeed=0;run(P,s,s=>({throttle:s.vx<8.3?1:0}),6,s=>{if(!s.ground[0]&&!s.ground[1])air+=dt;maxSpeed=Math.max(maxSpeed,Math.hypot(s.vx,s.vy))});
  assert.equal(s.crashed,null,r.id+' ramp: clean landing');assert.ok(air>.3,r.id+' ramp launches '+air);assert.ok(maxSpeed<12,r.id+' ramp: no violent launch '+maxSpeed);}}
{const P=bikes.emoto,s=fresh(P);run(P,s,s=>({throttle:s.vx<7?1:0}),4);let st=0;run(P,s,{brake:1,lean:-1},1.5,s=>{if(s.ground[1]&&!s.ground[0])st+=dt});assert.ok(st>.5,'stoppie from front brake + weight forward '+st);}
// slopeAt follows the ground along the heading (wheelie balance on ramps/hills needs it)
{const r=PLAYGROUND_RAMPS[1];assert.ok(ter.slopeAt(r.x+1,r.z,0)>.05);assert.ok(Math.abs(ter.slopeAt(r.x+1,r.z,Math.PI/2))<.02);assert.equal(ter.slopeAt(0,0,0),0);}
// Wheelies/stoppies: easy to hold, full input doesn't loop; glancing a ramp side slides instead of crashing.
// v2.1-8: monos are a real balance again: part input holds, pinned input goes past the balance point and loops
// (after dragging the fender), and full stoppie input goes over the bars.
for(const [name,P] of Object.entries(bikes)){
 {const s=fresh(P);run(P,s,{throttle:.6},2);let mx=0;run(P,s,{throttle:1,lean:.7},5,s=>{mx=Math.max(mx,s.pitch)});assert.equal(s.crashed,null,name+' part pull holds the wheelie');assert.ok(mx>1.2&&mx<1.7,name+' high wheelie under the tip '+mx);}
 {const s=fresh(P);run(P,s,{throttle:.6},2);let sc=0;run(P,s,{throttle:.6,lean:1},5,s=>{if(s.events.at(-1)?.type==='scrape')sc++});assert.equal(s.crashed,'LOOPED OUT',name+' full pull goes over');assert.ok(sc>5,name+' drags the fender before it goes '+sc);}
}
{const P=bikes.emoto,s=fresh(P);run(P,s,s=>({throttle:s.vx<8?1:0}),4);let st=0;run(P,s,{brake:1,lean:-.6},2,s=>{if(s.ground[1]&&!s.ground[0])st+=dt});assert.equal(s.crashed,null,'part stoppie input holds');assert.ok(st>1,'stoppie holds '+st);}
{const P=bikes.emoto,s=fresh(P);run(P,s,s=>({throttle:s.vx<8?1:0}),4);run(P,s,{brake:1,lean:-1},2);assert.equal(s.crashed,'OVER THE BARS','full stoppie input goes over the bars');}
{const P=bikeParams({kg:85,P:8000,nm:150,wb:1.3,wheelR:.33,travel:.2,shock:.2});for(const [x0,deg] of [[58,20],[92,25],[58,35]]){const a=deg/57.3,s=fresh(P,{x:x0+4-Math.cos(a)*15,z:14-2.1-Math.sin(a)*15,yaw:a,vx:16});run(P,s,s=>({throttle:s.vx<16?1:0}),3);assert.equal(s.crashed,null,'glancing a ramp side at '+deg+' deg slides');}}
// Brake slides: a tap at speed swings the bike round ~180 deg; holding the brake power-slides at a steady angle.
{const P=bikeParams({kg:85,P:8000,nm:150,wb:1.3,wheelR:.33,travel:.2,shock:.2});
 const go=()=>{const s=fresh(P,{x:-150,z:-120});run(P,s,s=>({throttle:s.vx<15?1:0}),4);return s};
 {const s=go(),y0=s.yaw;let t=0;run(P,s,()=>{t+=dt;return {steer:1,brake:t<.15?1:0}},2.5);assert.equal(s.crashed,null);assert.ok(Math.abs(s.yaw-y0)>2.4,'tap slide swings round '+(s.yaw-y0));}
 {const s=go();let mx=0,t=0;run(P,s,()=>{t+=dt;return {steer:1,brake:1,throttle:1}},1.5,s=>{mx=Math.max(mx,Math.abs(s.slipAngle||0))});assert.equal(s.crashed,null);assert.ok(s.sliding,'power slide holds while the brake is held');assert.ok(mx>.7&&mx<1.2,'power slide angle '+mx);}}
// v2.1-8: circuit ramps (both directions), loops, trees/rocks.
{const P=bikes.emoto;for(const r of PLAYGROUND_RAMPS.filter(r=>r.dir===-1)){const s=fresh(P,{x:r.x+25,z:r.z,yaw:Math.PI});let air=0;run(P,s,s=>({throttle:s.vx<8.3?1:0}),6,s=>{if(!s.ground[0]&&!s.ground[1])air+=dt});
  assert.equal(s.crashed,null,r.id+' reverse ramp: clean landing');assert.ok(air>.3,r.id+' reverse ramp launches '+air);}}
{const P=bikeParams({kg:85,P:8000,nm:150,wb:1.3,wheelR:.33,travel:.2,shock:.2});
 for(const L of PLAYGROUND_LOOPS){
  {const s=fresh(P,{x:L.x-20,z:L.z,vx:13});let done=false,top=0;run(P,s,s=>({throttle:s.vx<15?1:0}),7,s=>{if(s.loopRide)top=Math.max(top,s.y);if(s.events.some(e=>e.t==='LOOP CLEARED'))done=true});
   assert.equal(s.crashed,null,L.id+' fast: no crash');assert.ok(done,L.id+' fast: loop cleared, top '+top.toFixed(2));assert.ok(top>L.radius*1.4,L.id+' went over the top');assert.ok(Math.abs(s.z-(L.z+L.zShift/2))<.6,L.id+' exits shifted sideways '+s.z);}
  {const s=fresh(P,{x:L.x-20,z:L.z,vx:7});run(P,s,s=>({throttle:s.vx<7?1:0}),6);assert.ok(/LOOP|SPEED/.test(s.crashed||''),L.id+' slow: falls off '+s.crashed);}
  {const s=fresh(P,{x:L.x-20,z:L.z+L.w,vx:13});run(P,s,s=>({throttle:s.vx<15?1:0}),4);assert.ok(!s.loopRide&&s.x>L.x,L.id+' off-line rides past');}
 }
 // trees: straight into one fast crashes, glancing slides off, slow bump stops
 const t=PLAYGROUND_POSTS.find(q=>q.kind==='tree'&&q.z<0);
 {const s=fresh(P,{x:t.x-12,z:t.z,vx:14});run(P,s,s=>({throttle:s.vx<14?1:0}),3);assert.equal(s.crashed,'HIT A TREE','head-on tree crash');}
 {const s=fresh(P,{x:t.x-12,z:t.z+t.r,vx:12});run(P,s,s=>({throttle:s.vx<12?1:0}),3);assert.equal(s.crashed,null,'glancing a tree slides off');assert.ok(s.x>t.x+3&&s.postHit>0,'touched and carried on past the tree '+s.postHit);}
 {const s=fresh(P,{x:t.x-6,z:t.z});run(P,s,s=>({throttle:s.vx<2?1:0}),6);assert.equal(s.crashed,null,'slow into a tree: stops');assert.ok(s.x<t.x-t.r,'held back by the trunk '+s.x);}
 // rock garden: weaving through at speed over the rideable rocks stays upright (posts may crash, so steer clear of them)
 const rock=PLAYGROUND_PROPS.find(q=>q.m==='rock7');
 {const s=fresh(P,{x:rock.x-12,z:rock.z});let maxY=0;const g=s.y;run(P,s,s=>({throttle:s.vx<6?1:0}),3,s=>{maxY=Math.max(maxY,s.y-g)});assert.ok(!s.crashed||/HIT/.test(s.crashed),'rock hump rideable '+s.crashed);assert.ok(maxY>.05,'rode up the rock '+maxY);}
 for(const x of [-12]){const s=fresh(P,{x:x+8,z:6,yaw:Math.PI});let maxY=0;const g=s.y;run(P,s,s=>({throttle:s.vx<6?1:0}),3,s=>{maxY=Math.max(maxY,s.y-g)});assert.equal(s.crashed,null,'log crossing');assert.ok(maxY>.15&&s.x<x-2,'rode over the log '+maxY+' '+s.x);}
}
console.log('playground-classic: ok');
