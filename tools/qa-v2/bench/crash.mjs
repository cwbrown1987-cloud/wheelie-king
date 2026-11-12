import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;
const tests={
 swerve:{pose:{x:0,z:-60},pre:50,f:()=>({steer:1,brake:1})},
 kickFwd:{pose:{x:70,z:14},pre:99,until:90,f:()=>({throttle:1,lean:-1})},
 kickBack:{pose:{x:70,z:14},pre:99,until:90,f:()=>({throttle:1,lean:1})},
 kickBackOff:{pose:{x:70,z:14},pre:99,until:90,f:()=>({lean:1})},
 wheelieIn:{pose:{x:66,z:14},pre:99,until:80,f:()=>({throttle:1,lean:1})},
 wheelieIn2:{pose:{x:76,z:14},pre:99,until:84,f:()=>({throttle:1,lean:1})},
 steerFull30:{pose:{x:0,z:-60},pre:30,f:()=>({throttle:1,steer:1})},
};
for(const [name,{profile,P}] of Object.entries(PROF))for(const [tn,t] of Object.entries(tests)){
 const j=createJoltRide({P,profile});await j.start();const s={x:0,z:0,yaw:0,vx:0,events:[],...t.pose};j.adopt(s);
 for(let i=0;i<1200&&s.vx<t.pre/3.6&&(!t.until||s.x<t.until-1);i++)j.step(s,P,{throttle:1},dt);const v=s.vx*3.6;let mp=-99,mn=99;
 for(let i=0;i<300&&!s.crashed;i++){j.step(s,P,t.f(i),dt);mp=Math.max(mp,s.pitch*D);mn=Math.min(mn,s.pitch*D);}
 console.log(name,tn,'x',s.x.toFixed(0),'atKmh',v.toFixed(0),'crash',s.crashed||'-','pitch',mn.toFixed(0),mp.toFixed(0));}
