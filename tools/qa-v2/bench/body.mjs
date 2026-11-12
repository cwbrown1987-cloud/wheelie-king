import {createJoltRide} from '../../../ride-jolt.js';import {terrainHeight,TERRAIN} from '../../../ride-playground.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;
const mk=async(profile,P,pose)=>{const j=createJoltRide({P,profile});await j.start();const s={x:0,z:0,yaw:0,vx:0,events:[],...pose};j.adopt(s);return {j,s};};
for(const [name,{profile,P}] of Object.entries(PROF)){const o={};
 // wheelie: 12 km/h then throttle + lean back L, feathering by holding L
 for(const L of [0.6,1]){const {j,s}=await mk(profile,P);for(let i=0;i<600&&s.vx<12/3.6;i++)j.step(s,P,{throttle:1},dt);let up=0,best=0,mp=0;
  for(let i=0;i<360&&!s.crashed;i++){j.step(s,P,{throttle:0.7,lean:L},dt);const fu=!s.ground[1]&&s.ground[0];up=fu?up+dt:0;best=Math.max(best,up);mp=Math.max(mp,s.pitch*D);}
  o['wheelie'+L]={held:+best.toFixed(2),maxPitch:+mp.toFixed(0),crash:s.crashed||null};}
 {const {j,s}=await mk(profile,P);for(let i=0;i<600&&s.vx<12/3.6;i++)j.step(s,P,{throttle:1},dt);let mp=0;for(let i=0;i<180;i++){j.step(s,P,{throttle:1},dt);mp=Math.max(mp,s.pitch*D);}o.noLean={maxPitch:+mp.toFixed(1)};}
 // stoppie
 {const {j,s}=await mk(profile,P);for(let i=0;i<900&&s.vx<(name=='bmx'?16:25)/3.6;i++)j.step(s,P,{throttle:1},dt);let up=0,best=0,mp=0;
  for(let i=0;i<120&&!s.crashed;i++){j.step(s,P,{brake:1,lean:-1},dt);const ru=!s.ground[0]&&s.ground[1];up=ru?up+dt:0;best=Math.max(best,up);mp=Math.min(mp,s.pitch*D);}
  o.stoppie={rearUp:+best.toFixed(2),minPitch:+mp.toFixed(0),crash:s.crashed||null};}
 // terrain: run lane at z centre from x0-10 holding ~20 km/h
 {const {j,s}=await mk(profile,P,{x:TERRAIN.x0-10,z:TERRAIN.z});let maxX=0,minClear=9,vmin=99,fail=null;const at={};
  for(let i=0;i<60*40&&!s.crashed&&s.x<TERRAIN.x0+TERRAIN.len+5;i++){j.step(s,P,{throttle:s.vx*3.6<20?1:0,steer:Math.max(-1,Math.min(1,-(s.z-TERRAIN.z)*0.15-Math.sin(s.yaw)*1.5))},dt);
   const g=terrainHeight(s.x,s.z);minClear=Math.min(minClear,s.y-g);const u=s.x-TERRAIN.x0;for(const k of [30,70,95,120,145])if(!at[k]&&u>k)at[k]=(s.vx*3.6).toFixed(0)+'kmh/z'+s.z.toFixed(1);}
  o.terrain={endX:+s.x.toFixed(0),crash:s.crashed||null,minClearCom:+minClear.toFixed(2),at};}
 // climb from standstill at foot of hill, descent brake from top
 {const {j,s}=await mk(profile,P,{x:TERRAIN.x0+50,z:TERRAIN.z});for(let i=0;i<60*15&&!s.crashed&&s.x<TERRAIN.x0+86;i++)j.step(s,P,{throttle:1},dt);o.climb={x:+(s.x-TERRAIN.x0).toFixed(0),kmh:+(s.vx*3.6).toFixed(0),crash:s.crashed||null};}
 {const {j,s}=await mk(profile,P,{x:TERRAIN.x0+106,z:TERRAIN.z,vx:3});for(let i=0;i<90;i++)j.step(s,P,{throttle:.4},dt);const v0=s.vx;let t=0;for(;t<5&&Math.abs(s.vx)>0.15&&!s.crashed;t+=dt)j.step(s,P,{brake:1},dt);let x1=s.x;for(let i=0;i<180;i++)j.step(s,P,{},dt);
  o.descend={fromKmh:+(v0*3.6).toFixed(0),stopT:+t.toFixed(2),creepAfter:+(s.x-x1).toFixed(3),crash:s.crashed||null};}
 // side slope hold
 {const {j,s}=await mk(profile,P,{x:TERRAIN.x0+93,z:TERRAIN.z+5,yaw:0});let x0=s.x,z0=s.z,mr=0;for(let i=0;i<240;i++){j.step(s,P,{},dt);mr=Math.max(mr,Math.abs(s.joltRoll*D));}o.sideHold={drift:+Math.hypot(s.x-x0,s.z-z0).toFixed(3),maxRoll:+mr.toFixed(0),crash:s.crashed||null};}
 console.log(name,JSON.stringify(o));}
