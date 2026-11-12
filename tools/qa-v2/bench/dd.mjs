import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;
const cfgs=JSON.parse(process.env.T||'[{}]');
for(const cfg of cfgs){globalThis.__WK_TUNE__=cfg;const res=[];
for(const [name,{profile,P}] of Object.entries(PROF)){
 const run=async(pre,sec,f)=>{const j=createJoltRide({P,profile});await j.start();const s={x:0,z:0,yaw:0,vx:0,events:[]};j.adopt(s);
   for(let i=0;i<900&&s.vx<pre/3.6;i++)j.step(s,P,{throttle:1},dt);let yaw=0,py=s.yaw,mr=0,x0=s.x,z0=s.z,modes={};
   for(let i=0;i<sec*60&&!s.crashed;i++){j.step(s,P,f(i),dt);let d=s.yaw-py;d=Math.atan2(Math.sin(d),Math.cos(d));yaw+=d;py=s.yaw;mr=Math.max(mr,Math.abs(s.joltRoll*D));modes[j.dump().driver.mode]=1;}
   return {yaw:+(yaw*D).toFixed(0),maxRoll:+mr.toFixed(0),disp:+Math.hypot(s.x-x0,s.z-z0).toFixed(1),crash:s.crashed||0,modes:Object.keys(modes).join('/')};};
 res.push(name,'burn',JSON.stringify(await run(0,3,()=>({throttle:1,brake:1}))));
 res.push('donut0',JSON.stringify(await run(0,4,i=>({throttle:1,brake:1,steer:i>20?1:0}))));
 res.push('donut6',JSON.stringify(await run(6,4,()=>({throttle:1,brake:1,steer:1}))));
 res.push('drift25',JSON.stringify(await run(25,3,()=>({throttle:1,brake:1,steer:.6}))));
}
console.log(JSON.stringify(cfg),'\n  '+res.join(' '));}
