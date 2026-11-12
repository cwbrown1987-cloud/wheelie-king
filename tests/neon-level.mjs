// Neon Canal: the locked-track level. An e-moto held near 60 km/h rides it start to finish in 1.5-2 min,
// clears every gap (no splash), goes round the loop, and the lock keeps it on the line through every bend.
import assert from 'node:assert/strict';
import {NEON,NEON_PATH,NEON_GAPS,NEON_COINS,makeNeonTerrain,neonLock,neonProfile,neonInGap,neonSafeS,neonAt} from '../ride-neon.js';
import {makeState,step,bikeParams} from '../ride-physics.js';
const ter=makeNeonTerrain();
assert.ok(NEON.len>1600&&NEON.finish<NEON.len,'about 1.7 km');
assert.ok(NEON_COINS.length>150,'coin trails');
assert.equal(neonSafeS(365),330,'recover before the canal gap');
const P=bikeParams({kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15,batteryWh:1500});
const s=makeState(P,0,ter),y0=s.y;Object.assign(s,{x:2,z:0,yaw:0,vx:3});s.moveYaw=0;s.y=ter.height(2,0)+y0;
let t=0,maxLat=0,loops=0,splash=false,minV=99,airs=0,air=0;const vT=60/3.6;
for(;t<200&&!s.crashed&&(s.trackS||0)<NEON.finish;t+=1/60){
  for(let k=0;k<8;k++){step(s,P,{throttle:s.vx<vT?.8:0,brake:s.vx>vT+2?.3:0,lean:0,steer:0,hop:0,trick:0},1/480,ter);neonLock(s,1/480);}
  if(s.loopRide)loops=1;if(neonInGap(s.trackS)&&s.y<1)splash=true;const g=s.ground[0]||s.ground[1];if(!g)air+=1/60;else{if(air>.5)airs++;air=0;}
  if(t>5)minV=Math.min(minV,s.vx);
}
console.log('t',t.toFixed(1),'s',(s.trackS||0).toFixed(0),'crash',s.crashed,'loop',loops,'airs',airs,'minV',minV.toFixed(1));
assert.equal(s.crashed,null,'rides Neon Canal without crashing (at s '+(s.trackS||0).toFixed(0)+')');
assert.ok(s.trackS>=NEON.finish,'reaches the finish');
assert.ok(t>80&&t<130,'about 1.5-2 minutes at 60 km/h: '+t.toFixed(0)+' s');
assert.ok(loops,'went round the loop');assert.ok(!splash,'cleared the canal gaps');assert.ok(airs>=8,'big airs '+airs);
console.log('neon-level: ok');
