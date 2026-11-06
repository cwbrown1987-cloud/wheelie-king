import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {bikeParams,makeState,step,makeFlatTerrain} from '../ride-physics.js';
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
const curb={h:x=>x<3?0:.12,slope:()=>0},curbBike=makeState(p,1,curb);for(let i=0;i<500;i++)step(curbBike,p,input,1/480,curb);curbBike.vx=6;for(let i=0;i<1000&&!curbBike.crashed;i++)step(curbBike,p,input,1/480,curb);assert.equal(curbBike.crashed,null);assert(curbBike.x>4,'round tyre should roll across a modest sharp join');
for(const type of ['inverted','midspin']){const s=makeState(p,2,flat);s.y+=1;s.vy=-4;s.pitch=type==='inverted'?Math.PI:0;s.spinV=type==='midspin'?1:0;for(let i=0;i<1200&&!s.crashed;i++)step(s,p,input,1/480,flat);assert(s.crashed,`${type} must still crash`);}
const flip=makeState(p,2,flat);Object.assign(flip,{y:2,vy:-4,pitch:2*Math.PI+.05,airRot:2*Math.PI,air:.5,wasAir:true});for(let i=0;i<1200&&!flip.crashed;i++)step(flip,p,input,1/480,flat);assert.equal(flip.crashed,null);assert(Math.abs(flip.pitch)<.1);assert(flip.events.some(e=>e.t?.includes('BACKFLIP')));
const endless=makeFlatTerrain(),monoP=bikeParams({travel:.06,shock:0}),mono=makeState(monoP,5000,endless);mono.pitch=1.56;mono.y=monoP.R+monoP.wb*monoP.comBack*Math.sin(mono.pitch)+(monoP.comH-monoP.R)*Math.cos(mono.pitch)-.003;mono.vx=3;
for(let i=0;i<960&&!mono.crashed;i++)step(mono,monoP,{throttle:1,lean:1,brake:0},1/480,endless);assert.equal(mono.crashed,null);assert(mono.pitch>1.4&&mono.pitch<1.8);assert.equal(endless.h(1e9),0);assert.equal(endless.finish,Infinity);
// The fender is a geometry contact, not a locked balance angle: counterlean
// must bring the front down while holding back reaches an actual scrape.
const balance=[];for(const lean of [-1,1]){const bs=makeState(monoP,2,endless);bs.pitch=1.3;bs.y=monoP.R+monoP.wb*monoP.comBack*Math.sin(bs.pitch)+(monoP.comH-monoP.R)*Math.cos(bs.pitch)-.003;bs.vx=3;for(let i=0;i<600&&!bs.crashed;i++)step(bs,monoP,{throttle:1,lean,brake:0},1/480,endless);assert.equal(bs.crashed,null);balance.push(bs.pitch);if(lean===1)assert(bs.events.some(e=>e.type==='scrape'));}assert(balance[1]-balance[0]>1);
// From the scrape/balance area, release, forward lean and rear brake all return to two wheels.
for(const power of [0,8000])for(const action of ['release','forward','brake']){const p=bikeParams({P:power,travel:.06}),s=makeState(p,2,endless);s.pitch=1.56;s.y=p.R+p.wb*p.comBack*Math.sin(s.pitch)+(p.comH-p.R)*Math.cos(s.pitch)-.003;s.vx=3;s.thr=1;for(let i=0;i<1440&&!s.crashed;i++)step(s,p,{throttle:action==='release'?0:1,brake:action==='brake'?1:0,lean:action==='forward'?-1:0},1/480,endless);assert.equal(s.crashed,null,action+' should recover without pitching over');assert(Math.abs(s.pitch)<.1,action+' must lower the front');assert(s.ground.every(Boolean));}
for(const [power,driveAxle]of [[250,'rear'],[8000,'rear'],[350,'front']]){const ep=bikeParams({P:power,kg:30,travel:.15,shock:.06,driveAxle}),es=makeState(ep,2,endless);for(let i=0;i<600;i++)step(es,ep,input,1/480,endless);for(let i=0;i<1200;i++)step(es,ep,{...input,throttle:1,brake:1},1/480,endless);assert(es.burnout);assert(Math.abs(es.vx)<1);assert.equal(es.crashed,null);const driven=driveAxle==='front'?1:0;assert(es.wheelSpin[driven]-es.wheelSpin[1-driven]>10);}
const reverseP=bikeParams({P:8000,kg:30,travel:.15,shock:.06}),reverse=makeState(reverseP,2,endless);for(let i=0;i<600;i++)step(reverse,reverseP,input,1/480,endless);for(let i=0;i<1600;i++)step(reverse,reverseP,{...input,brake:1},1/480,endless);assert(reverse.vx<-.5&&reverse.vx>-3.5);assert.equal(reverse.crashed,null);
const pedal=makeState(monoP,2,endless);for(let i=0;i<600;i++)step(pedal,monoP,{...input,throttle:1,brake:1},1/480,endless);assert(!pedal.burnout);
for(const kind of ['mono','stoppie']){const ep=bikeParams({P:8000,kg:30,travel:.15,shock:.06}),es=makeState(ep,2,endless);for(let i=0;i<600;i++)step(es,ep,input,1/480,endless);es.vx=6;for(let i=0;i<1440&&!es.crashed;i++)step(es,ep,{throttle:kind==='mono'?1:0,brake:kind==='stoppie'?1:0,lean:kind==='mono'?1:-1},1/480,endless);assert.equal(es.crashed,null);assert(kind==='mono'?es.wheelieT>1:es.stoppieT>1);}
for(const action of ['tailwhip','barspin','superman']){const es=makeState(p,2,endless);Object.assign(es,{y:3,vy:1,air:.2,wasAir:true});for(let i=0;i<1800&&!es.crashed;i++)step(es,p,{...input,[action]:i<10?1:0},1/480,endless);assert.equal(es.crashed,null);assert(es.events.some(e=>e.type==='trick'&&e.t.includes(action.toUpperCase())));}
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/ride-landings.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({landings:report.length,flatAndSloped:true,noFalseCrashes:true,travelStops:true,settles:true,genuineCrashes:true,fullFlip:true,uprightMono:true,flatEndless:true,electricBurnouts:3,drivenAxleOnly:true,brakeToReverse:true,pedalBikeNoBurnout:true}));
