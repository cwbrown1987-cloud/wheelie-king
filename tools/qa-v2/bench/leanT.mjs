import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;
for(const tu of JSON.parse(process.env.T||'[{}]')){globalThis.__WK_TUNE__=tu;const o=[];
for(const [name,{profile,P}] of Object.entries(PROF)){const j=createJoltRide({P,profile});await j.start();const s={x:0,z:60,yaw:0,vx:0,events:[]};j.adopt(s);
 for(let i=0;i<600&&s.vx<21/3.6;i++)j.step(s,P,{throttle:1},dt);const r=[];
 for(let i=0;i<180;i++){j.step(s,P,{throttle:s.vx<21/3.6?1:0.3,steer:1},dt);r.push(Math.abs(s.joltRoll*D));}
 const ss=r.slice(-30).reduce((a,b)=>a+b)/30,k=r.findIndex(x=>x>=.9*ss);o.push(`${name} t90 ${(k/60).toFixed(2)} roll ${ss.toFixed(0)} ${s.crashed||''}`);}
console.log(JSON.stringify(tu),o.join(' | '));}
