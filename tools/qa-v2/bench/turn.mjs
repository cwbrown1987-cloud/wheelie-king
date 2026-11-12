import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;
for(const tu of JSON.parse(process.env.T||'[{}]')){globalThis.__WK_TUNE__=tu;const o=[];
for(const [name,{profile,P}] of Object.entries(PROF))for(const kmh of [20,30,40])for(const dir of [1,-1])for(const thr of [1,0.4]){
 const j=createJoltRide({P,profile});await j.start();const s={x:0,z:60,yaw:0,vx:0,events:[]};j.adopt(s);
 for(let i=0;i<900&&s.vx<kmh/3.6;i++)j.step(s,P,{throttle:1},dt);const v0=s.vx*3.6;let mr=0,fu=0,ru=0,y0=s.y,my=0,side=0;
 for(let i=0;i<240&&!s.crashed;i++){j.step(s,P,{throttle:thr,steer:dir},dt);const r=Math.abs(s.joltRoll*D);mr=Math.max(mr,r);const g=s.ground||[1,1];if(!g[0]&&g[1])fu++;if(r>60)side++;my=Math.max(my,s.y-y0);}
 o.push(`${name} ${kmh}(${v0.toFixed(0)}) ${dir>0?'R':'L'} thr${thr} maxRoll ${mr.toFixed(0)} frontUp ${(fu/60).toFixed(2)} onSide ${(side/60).toFixed(2)} rise ${my.toFixed(2)} ${s.crashed||'ok'}`);}
console.log(JSON.stringify(tu)+'\n'+o.join('\n'));}
