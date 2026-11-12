import {createJoltRide} from '../../../ride-jolt.js';import {readFileSync} from 'node:fs';
const PROF=JSON.parse(readFileSync('new URL("./prof.json", import.meta.url)','utf8'));const dt=1/60,D=180/Math.PI;
const TUNES=JSON.parse(process.env.T||'[{}]');
for(const tu of TUNES){globalThis.__WK_TUNE__=tu;let out=[];
for(const [name,{profile,P}] of Object.entries(PROF))for(const kmh of [15,22,30])for(const pat of ['w1.1','w1.6','w2.1','h.2','h.3','h.35']){
 const j=createJoltRide({P,profile});await j.start();const s={x:5,z:-30,yaw:0,vx:kmh/3.6,events:[]};j.adopt(s);let t=0,mr=0,air=0,one=0,log=[];
 for(let i=0;i<60*25&&s.x<170&&!s.crashed;i++){t+=dt;const v=s.vx*3.6;const steer=s.x<18?0:pat[0]==='w'?0.45*Math.sin(t*+pat.slice(1)):+pat.slice(1)*Math.sign(Math.sin(t*0.5)) ;
  // keep in lane: steer toward z=-30 heading
  const zc=-(s.z+30)*0.08-(Math.sin(s.yaw))*0.0;
  j.step(s,P,{throttle:v<kmh?1:0.15,brake:v>kmh+4?0.3:0,steer:Math.max(-1,Math.min(1,steer+zc))},dt);mr=Math.max(mr,Math.abs(s.joltRoll||0)*D);
  const g=s.ground||[1,1];if(!g[0]&&!g[1])air++;else if(!g[0]||!g[1])one++;if(i%6==0)log.push([s.x.toFixed(1),(s.joltRoll*D).toFixed(0),(s.pitch*D).toFixed(0),+!g[0]+''+ +!g[1]].join('/'));}
 out.push(`${name} ${kmh} ${pat} x${s.x.toFixed(0)} crash:${s.crashed||'-'} maxRoll ${mr.toFixed(0)} air ${(air/60).toFixed(2)} oneWheel ${(one/60).toFixed(2)}`+(s.crashed&&process.env.V?'\n  '+log.slice(-15).join(' '):''));}
console.log(JSON.stringify(tu),'crashes',out.filter(x=>!x.includes('crash:-')).length,'/',out.length,out.filter(x=>!x.includes('crash:-')).map(x=>x.split(' x')[0]).join('|'));}
