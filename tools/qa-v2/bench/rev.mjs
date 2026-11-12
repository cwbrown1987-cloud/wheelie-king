import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60;
for(const [name,{profile,P}] of Object.entries(PROF)){const j=createJoltRide({P,profile});await j.start();const s={x:96.5+20-20,z:-25,yaw:0,vx:0,events:[]};s.x=113;j.adopt(s);
 const x0=s.x;for(let i=0;i<200;i++)j.step(s,P,{brake:1},dt);const hold=s.x-x0;
 for(let i=0;i<10;i++)j.step(s,P,{},dt);const x1=s.x;for(let i=0;i<120;i++)j.step(s,P,{brake:1},dt);console.log(name,'holdDrift',hold.toFixed(3),'reverse dx',(s.x-x1).toFixed(2));}
