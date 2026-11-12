import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
import {playgroundHeight as H} from '../../../ride-playground.js';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;globalThis.__WK_DBG__={};globalThis.__WK_TUNE__=JSON.parse(process.env.T||'{}');
const [name,kmh,pat]=(process.env.C||'emoto,22,hold').split(',');const {profile,P}=PROF[name];
const j=createJoltRide({P,profile});await j.start();const s={x:5,z:-30,yaw:0,vx:kmh/3.6,events:[]};j.adopt(s);let t=0,L=[];
for(let i=0;i<60*25&&s.x<170&&!s.crashed;i++){t+=dt;const v=s.vx*3.6;const steer=s.x<18?0:pat[0]==='w'?0.45*Math.sin(t*+pat.slice(1)):+pat.slice(1)*Math.sign(Math.sin(t*0.5));const zc=-(s.z+30)*0.08;
 const inp={throttle:v<kmh?1:0.15,brake:v>kmh+4?0.3:0,steer:Math.max(-1,Math.min(1,steer+zc))};j.step(s,P,inp,dt);const g=s.ground||[1,1];
 L.push(`${s.x.toFixed(1)} z${s.z.toFixed(1)} y${s.y.toFixed(2)} h${H(s.x,s.z).toFixed(2)} r${(s.joltRoll*D).toFixed(0)} p${(s.pitch*D).toFixed(0)} g${+g[0]}${+g[1]} v${v.toFixed(0)} st${inp.steer.toFixed(2)} th${inp.throttle} lam${(globalThis.__WK_DBG__.lam||[]).map(x=>x.toFixed(2)).join(',')} ${s.drift?'D':''}${s.burnout?'B':''}${s.mono?'M':''}`);}
console.log(s.crashed,'\n'+L.slice(-45).join('\n'));
