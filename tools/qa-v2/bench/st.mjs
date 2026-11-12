import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;
for(const cfg of JSON.parse(process.env.T||'[{}]')){globalThis.__WK_TUNE__=cfg;const {profile,P}=PROF[process.env.B||'bmx'];const j=createJoltRide({P,profile});await j.start();const s={x:0,z:0,yaw:0,vx:0,events:[]};j.adopt(s);
for(let i=0;i<900&&s.vx<16/3.6;i++)j.step(s,P,{throttle:1},dt);let up=0,best=0,mp=0,v0=s.vx,out=[];
for(let i=0;i<120&&!s.crashed;i++){const pv=s.vx;j.step(s,P,{brake:1,lean:-1},dt);const ru=!s.ground[0]&&s.ground[1];up=ru?up+dt:0;best=Math.max(best,up);mp=Math.min(mp,s.pitch*D);if(i%10==0){const d=j.dump();out.push(`${i}:a${((pv-s.vx)/dt/9.81).toFixed(2)}g om${(s.wheelOmega[1]*.254).toFixed(1)}/v${s.vx.toFixed(1)} p${(s.pitch*D).toFixed(0)} hb${d.driver.handBrake.toFixed(2)} ${d.driver.mode}`)}}
console.log(JSON.stringify(cfg),'rearUp',best.toFixed(2),'minP',mp.toFixed(0),s.crashed||'');if(process.env.V)console.log(out.join('\n'));}
