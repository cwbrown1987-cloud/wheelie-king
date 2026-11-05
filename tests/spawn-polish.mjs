import assert from 'node:assert/strict';
import {bikeParams,makeState,step,makeFlatTerrain} from '../ride-physics.js';
const rows=[];
for(const R of [.14,.265,.375])for(const slope of [-.25,0,.25]){
 const terrain={h:x=>x*Math.tan(slope),slope:()=>slope},p=bikeParams({P:1200,kg:30,wheelR:R,comH:.8,wb:1.1,travel:.06,shock:.04}),s=makeState(p,2,terrain),h=p.comH-p.R;
 for(const dx of [-p.wb*p.comBack,p.wb*(1-p.comBack)]){const wx=s.x+dx*Math.cos(s.pitch)+h*Math.sin(s.pitch),wy=s.y+dx*Math.sin(s.pitch)-h*Math.cos(s.pitch);assert(wy-p.R>=terrain.h(wx)-1e-6,'spawn tyre must be above road');}
 assert(Math.abs(s.pitch-slope)<1e-6);
 for(let i=0;i<720&&!s.crashed;i++)step(s,p,{throttle:0,brake:0,lean:0},1/480,terrain);
 assert.equal(s.crashed,null);assert(Number.isFinite(s.y)&&Math.hypot(s.vx,s.vy)<5);rows.push({R,slope,vy:s.vy});
}
console.log('PASS nine wheel-size/slope spawn and settling cases');
