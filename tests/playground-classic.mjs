// Playground on Chris's classic ride physics (node, no browser). Locks in that the free-roam
// version keeps the side-view feel and none of the Jolt-era handling bugs come back:
// no rest creep, no random hops, hard turns and bump-turns don't flip, ramps launch and land.
import assert from 'node:assert/strict';
import {makePlaygroundTerrain,makeState,step,bikeParams} from '../ride-physics.js';
import {SIDE_TRACK,DESCENT,descentRoadZ,PLAYGROUND_PADS,TERRAIN,PLAYGROUND_RAMPS,PLAYGROUND_LOOPS,PLAYGROUND_POSTS,PLAYGROUND_PROPS} from '../ride-playground.js';
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
 {const s=fresh(P);run(P,s,s=>({throttle:s.vx<6?1:0}),3);let sc=0;run(P,s,{throttle:1,lean:1},5,s=>{if(s.events.at(-1)?.type==='scrape')sc++});assert.equal(s.crashed,'LOOPED OUT',name+' full pull goes over');assert.ok(sc>5,name+' drags the fender before it goes '+sc);}
}
{const P=bikes.emoto,s=fresh(P);run(P,s,s=>({throttle:s.vx<8?1:0}),4);let st=0;run(P,s,{brake:1,lean:-.6},2,s=>{if(s.ground[1]&&!s.ground[0])st+=dt});assert.equal(s.crashed,null,'part stoppie input holds');assert.ok(st>1,'stoppie holds '+st);}
{const P=bikes.emoto,s=fresh(P);run(P,s,s=>({throttle:s.vx<8?1:0}),4);run(P,s,{brake:1,lean:-1},2);assert.equal(s.crashed,'OVER THE BARS','full stoppie input goes over the bars');}
{const P=bikeParams({kg:85,P:8000,nm:150,wb:1.3,wheelR:.33,travel:.2,shock:.2});for(const [x0,deg] of [[58,20],[92,25],[58,35]]){const a=deg/57.3,s=fresh(P,{x:x0+4-Math.cos(a)*15,z:14-2.1-Math.sin(a)*15,yaw:a,vx:16});run(P,s,s=>({throttle:s.vx<16?1:0}),3);assert.equal(s.crashed,null,'glancing a ramp side at '+deg+' deg slides');}}
// Brake slides: a tap at speed swings the bike round ~180 deg; holding the brake power-slides at a steady angle.
{const P=bikeParams({kg:85,P:8000,nm:150,wb:1.3,wheelR:.33,travel:.2,shock:.2});
 const go=()=>{const s=fresh(P,{x:300,z:-120});run(P,s,s=>({throttle:s.vx<15?1:0}),4);return s};
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
 {const s=fresh(P,{x:rock.x-12,z:rock.z});let mc=0,air=0;run(P,s,s=>({throttle:s.vx<6?1:0}),3,s=>{mc=Math.max(mc,s.comp[0],s.comp[1]);if(!s.ground[0]&&!s.ground[1])air+=dt});assert.ok(!s.crashed||/HIT/.test(s.crashed),'rock hump rideable '+s.crashed);assert.ok(mc>.3,'suspension soaks up the rock '+mc);assert.ok(air<.3,'a rock at 6 m/s is not a jump '+air);}
 for(const x of [-12]){const s=fresh(P,{x:x+8,z:6,yaw:Math.PI});let maxY=0;const g=s.y;run(P,s,s=>({throttle:s.vx<6?1:0}),3,s=>{maxY=Math.max(maxY,s.y-g)});assert.equal(s.crashed,null,'log crossing');assert.ok(maxY>.15&&s.x<x-2,'rode over the log '+maxY+' '+s.x);}
}
// v2.1-10 downhill: ride the dirt road top to bottom (a simple line-follower), tabletops and rollers, no crash.
for(const [name,P] of Object.entries(bikes)){const s=fresh(P,PLAYGROUND_PADS[0].to);let air=0;
 run(P,s,s=>{const L=4+s.vx*.55,u=DESCENT.x0-(s.x+L),zt=descentRoadZ(Math.max(0,u)),want=Math.atan2(zt-s.z,L),err=Math.atan2(Math.sin(want-s.yaw),Math.cos(want-s.yaw)),air=!s.ground[0]&&!s.ground[1];return {throttle:s.vx<10?.5:0,brake:s.vx>12?.6:0,steer:air?0:Math.max(-1,Math.min(1,err*3))}},90,s=>{if(!s.ground[0]&&!s.ground[1])air+=dt});
 assert.equal(s.crashed,null,name+' downhill run');assert.ok(s.x>DESCENT.x0-5,name+' reached the bottom '+s.x);assert.ok(air>2,name+' got air on the way down '+air);}
// v2.1-11: small hits soak up through tyre + suspension + rider instead of launching the bike
{const P=bikes.emoto,log=PLAYGROUND_PROPS.find(p=>p.m==='log'&&p.x<0&&p.x>-30);for(const v of [6,11]){const s=fresh(P,{x:log.x-15,z:log.z,vx:v});let maxVy=0;run(P,s,s=>({throttle:s.vx<v?.6:0}),3,s=>{maxVy=Math.max(maxVy,s.vy)});assert.equal(s.crashed,null,'logs at '+v);assert.ok(maxVy<2.3,'a 30 cm log at '+v+' m/s only lightens the bike, vy '+maxVy);}}
// in the air steering only twists the bike a little; the direction of travel holds
{const P=bikes.emoto,r=PLAYGROUND_RAMPS[2],s=fresh(P,{x:r.x-25,z:r.z});let z0=null,twist=0;run(P,s,s=>{const air=!s.ground[0]&&!s.ground[1];if(air&&z0==null)z0=s.z;return {throttle:s.vx<8.3?1:0,steer:air?1:0}},6,s=>{if(!s.ground[0]&&!s.ground[1])twist=Math.max(twist,Math.abs(s.yaw||0))});assert.ok(twist<.45,'air twist is small '+twist);assert.equal(s.crashed,null,'lands the twist');}
// v2.1-16: no mono from a standstill; you need to be rolling
for(const [name,P] of Object.entries(bikes)){const s=fresh(P);let mx=0;run(P,s,{lean:1},2,s=>{mx=Math.max(mx,s.pitch)});assert.ok(mx<.2,name+' no wheelie at a standstill '+mx);}
// v2.1-20: no vertical edges: ride across the side track's features and onto a ramp's side without stopping
{const P=bikes.emoto;for(const u of [13,42,78,88]){const s=fresh(P,{x:SIDE_TRACK.x0+u,z:SIDE_TRACK.z-8,yaw:Math.PI/2,vx:6});let minV=9;run(P,s,s=>({throttle:s.vx<6?.7:0}),2.5,s=>{minV=Math.min(minV,s.vx)});assert.equal(s.crashed,null,'cross the side track at '+u);assert.ok(minV>3,'crossing at '+u+' keeps rolling '+minV);}
 const r=PLAYGROUND_RAMPS[2],s=fresh(P,{x:r.x+5,z:r.z-6,yaw:Math.PI/2,vx:6});let minV=9;run(P,s,s=>({throttle:s.vx<6?.7:0}),2,s=>{minV=Math.min(minV,s.vx)});assert.equal(s.crashed,null,'ride onto a ramp from the side');assert.ok(minV>3,'ramp side is rideable '+minV);}
// v2.1-21: square steps: a curb rolls up with a jolt, a step about the tyre's radius needs speed, a tall one is a wall; drops never stop you
{const E=.12,mk=hf=>{const height=(x,z=0)=>hf(x,z);return {...ter,height,slopeAt:(x,z=0,yaw=0)=>{const c=Math.cos(yaw),n=Math.sin(yaw);return Math.atan2(height(x+c*E,z+n*E)-height(x-c*E,z-n*E),2*E)},h:x=>height(x,0),loops:[],posts:[]}};
 const P=bikes.emoto,go=(H,v)=>{const T2=mk(x=>H>0?(x>5?H:0):(x>5?0:-H));const s=makeState(P,0,T2),y0=s.y;s.y=T2.height(0,0)+y0;s.vx=v;let minV=v;for(let i=0;i<150&&!s.crashed;i++){for(let k=0;k<8;k++)step(s,P,{...D,throttle:s.vx<v?.5:0},1/480,T2);minV=Math.min(minV,s.vx)}return {minV,x:s.x,crashed:s.crashed}};
 assert.ok(go(.15,3).minV>2,'15 cm curb at walking pace rolls up');assert.ok(go(.35,8).x>10,'tyre-height step at speed climbs');assert.ok(go(.5,8).x<6,'50 cm step is a wall');
 for(const H of [.25,.5]){const r=go(-H,8);assert.ok(r.minV>7&&!r.crashed,'drop of '+H+' m keeps speed');}}
console.log('playground-classic: ok');
