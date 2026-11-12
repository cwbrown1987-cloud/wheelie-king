import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;
for(const tu of JSON.parse(process.env.T||'[{}]')){globalThis.__WK_TUNE__=tu;const o=[];
for(const [name,{profile,P}] of Object.entries(PROF)){const j=createJoltRide({P,profile});await j.start();const s={x:0,z:60,yaw:0,vx:0,events:[]};j.adopt(s);
 for(let i=0;i<900&&s.vx<25/3.6;i++)j.step(s,P,{throttle:1},dt);let mr=0,df=0;
 for(let i=0;i<120&&!s.crashed;i++){j.step(s,P,{throttle:1,brake:1,steer:1,lean:-1},dt);mr=Math.max(mr,Math.abs(s.joltRoll*D));if(s.drift)df++;}
 for(let i=0;i<120&&!s.crashed;i++){j.step(s,P,{},dt);mr=Math.max(mr,Math.abs(s.joltRoll*D));}
 o.push(`${name} driftFrac ${(df/120).toFixed(2)} maxRoll ${mr.toFixed(0)} ${s.crashed||'ok'}`);}
console.log(JSON.stringify(tu),o.join(' | '));}
