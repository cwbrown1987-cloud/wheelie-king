import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {bikeParams,makeState,step} from '../ride-physics.js';
const flat={h:()=>0,slope:()=>0},input={throttle:0,brake:0,lean:0};
const report=[];
for(const slope of [0,.2,-.2])for(const travel of [0,.06,.15,.23])for(const pitch of [0,.65,-.55]){
 const terrain={h:x=>x*Math.tan(slope),slope:()=>slope};
 const p=bikeParams({travel,shock:travel}),s=makeState(p,2,terrain);s.y+=1;s.vx=5;s.vy=-4;s.pitch=pitch+slope;
 let landings=0,maxSpeed=0,maxDepth=0;
 for(let i=0;i<2400&&!s.crashed;i++){
  step(s,p,input,1/480,terrain);
  for(const e of s.events.splice(0))if(e.type==='land')landings++;
  maxSpeed=Math.max(maxSpeed,Math.hypot(s.vx,s.vy));
  const h=p.comH-p.R;for(const x of [-p.wb*p.comBack,p.wb*(1-p.comBack)]){const ox=Math.cos(s.pitch)*x+Math.sin(s.pitch)*h;maxDepth=Math.max(maxDepth,terrain.h(s.x+ox)+p.R-(s.y+Math.sin(s.pitch)*x-Math.cos(s.pitch)*h));}
 }
 report.push({slope,travel,pitch,crash:s.crashed,landings,maxSpeed,maxDepth,finalVy:s.vy});
}
for(const r of report){assert.equal(r.crash,null,JSON.stringify(r));assert(r.landings>=1);assert(r.maxSpeed<15,'landing must not launch the bike');assert(r.maxDepth<=Math.max(.004,r.travel*.8)+.002,JSON.stringify(r));if(!r.slope)assert(Math.abs(r.finalVy)<.15,'bike should settle');}
const p=bikeParams({travel:.06,shock:.06});
for(const type of ['inverted','midspin']){const s=makeState(p,2,flat);s.y+=1;s.vy=-4;s.pitch=type==='inverted'?Math.PI:0;s.spinV=type==='midspin'?1:0;for(let i=0;i<1200&&!s.crashed;i++)step(s,p,input,1/480,flat);assert(s.crashed,`${type} must still crash`);}
const flip=makeState(p,2,flat);Object.assign(flip,{y:2,vy:-4,pitch:2*Math.PI+.05,airRot:2*Math.PI,air:.5,wasAir:true});for(let i=0;i<1200&&!flip.crashed;i++)step(flip,p,input,1/480,flat);assert.equal(flip.crashed,null);assert(Math.abs(flip.pitch)<.1);assert(flip.events.some(e=>e.t?.includes('BACKFLIP')));
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/ride-landings.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({landings:report.length,flatAndSloped:true,noFalseCrashes:true,travelStops:true,settles:true,genuineCrashes:true,fullFlip:true}));
