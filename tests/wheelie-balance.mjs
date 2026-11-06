import assert from 'node:assert/strict';
import {bikeParams,makeState,step,makeFlatTerrain} from '../ride-physics.js';
import {VEHICLES} from '../vehicle-platforms.js';
const terrain=makeFlatTerrain(),v=VEHICLES.pit125;
const params=bikeParams({P:v.power,nm:v.torque,kg:v.kg,wb:v.wb,wheelR:v.wheelR,comH:v.comH,comBack:v.comBack,travel:v.forkTravel,shock:.06});
function simulate(fps,action){
 const s=makeState(params,2,terrain);s.pitch=1.56;s.y=params.R+params.wb*params.comBack*Math.sin(s.pitch)+(params.comH-params.R)*Math.cos(s.pitch)-.003;s.vx=4;s.thr=1;
 let scrape=false;
 for(let frame=0;frame<fps*3&&!s.crashed;frame++){
  const count=Math.ceil(480/fps),dt=1/fps/count;
  const lean=action==='balance'?Math.max(-1,Math.min(1,.007+(1.3-s.pitch)*2-s.w*.45)):action==='forward'?-1:action==='back'?1:0;
  for(let i=0;i<count&&!s.crashed;i++){step(s,params,{throttle:action==='release'?0:1,brake:action==='brake'?1:0,lean},dt,terrain);scrape ||=s.events.some(e=>e.type==='scrape');s.events.length=0;}
 }
 return {crash:s.crashed,pitch:s.pitch,ground:s.ground,scrape};
}
for(const fps of [30,60,90,120,144])for(const action of ['release','forward','brake','back','balance']){
 const r=simulate(fps,action);
 if(action==='back'){assert.equal(r.crash,'LOOPED OUT');assert(r.scrape);}
 else {assert.equal(r.crash,null,`${fps} ${action}`);if(action==='balance')assert(Math.abs(r.pitch-1.3)<.15);else{assert(Math.abs(r.pitch)<.1);assert(r.ground.every(Boolean));}}
}
console.log('PASS: 25 moto balance/recovery/scrape scenarios at 30–144 Hz; existing adaptive stepping unchanged.');
