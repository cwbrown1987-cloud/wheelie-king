// Node check: both real profiles ride over each playground table-top at a steady speed and land upright.
import {createJoltRide} from '../ride-jolt.js';import {PLAYGROUND_RAMPS} from '../ride-playground.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync(process.env.WK_PROF||'/tmp/wk-profiles.json','utf8'));const dt=1/60,D=180/Math.PI;let bad=0;
for(const [name,{profile,P}] of Object.entries(PROF))for(const r of PLAYGROUND_RAMPS)for(const kmh of name==='bike_bmx'?[15,18]:[25,40]){
  const j=createJoltRide({P,profile});await j.start();const s={x:r.x-14,z:r.z,yaw:0,vx:0,events:[]};j.adopt(s);
  if(j.place)j.place(s);for(let i=0;i<30;i++)j.step(s,P,{},dt);
  let air=0,maxAir=0,maxY=0,minP=0,maxP=0,t=0;const end=r.x+r.up+r.top+r.down+12;
  for(;t<20&&s.x<end&&!s.crashed;t+=dt){const v=s.vx*3.6;j.step(s,P,{throttle:v<kmh?Math.min(1,(kmh-v)*.15):0},dt);
    const inAir=!s.ground[0]&&!s.ground[1];air=inAir?air+dt:0;maxAir=Math.max(maxAir,air);if(s.x>r.x){maxY=Math.max(maxY,s.y);minP=Math.min(minP,s.pitch*D);maxP=Math.max(maxP,s.pitch*D);}}
  const ok=!s.crashed&&s.x>=end&&Math.abs(s.z-r.z)<1.5;if(!ok)bad++;
  console.log(ok?'ok ':'BAD',name,r.id,kmh+'km/h',JSON.stringify({air:+maxAir.toFixed(2),maxY:+maxY.toFixed(2),pitch:[+minP.toFixed(0),+maxP.toFixed(0)],crashed:s.crashed||null,x:+s.x.toFixed(1),dz:+(s.z-r.z).toFixed(2)}));}
process.exit(bad?1:0);
