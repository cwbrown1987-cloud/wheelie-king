import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;
for(const [name,{profile,P}] of Object.entries(PROF)){for(const kmh of [20,30,40]){
 const j=createJoltRide({P,profile});await j.start();const s={x:0,z:14,yaw:0,vx:0,events:[]};j.adopt(s);
 let air=0,maxAir=0,cur=0,maxY=0,log=[];
 for(let i=0;i<60*20&&s.x<115;i++){const thr=s.vx*3.6<kmh?1:0;j.step(s,P,{throttle:thr},dt);const a=!s.ground[0]&&!s.ground[1];cur=a?cur+dt:0;if(a)air+=dt;maxAir=Math.max(maxAir,cur);maxY=Math.max(maxY,s.y);if(i%30==0)log.push([s.x.toFixed(1),(s.vx*3.6).toFixed(0),s.y.toFixed(2)].join('/'));if(s.crashed)break;}
 console.log(name,kmh,'x',s.x.toFixed(1),'totAir',air.toFixed(2),'maxAir',maxAir.toFixed(2),'maxY',maxY.toFixed(2),'crash',s.crashed||'', 'pitch',(s.pitch*D).toFixed(0));
 if(kmh==20)console.log(log.join(' '));}}
