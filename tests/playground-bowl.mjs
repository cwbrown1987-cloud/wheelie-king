// Bowl + vert airs (Riders Republic style): drop in from the deck and ride the bowl without crashing; air out of a
// quarter pipe and the bike turns round in the air and lands back in going forwards; steering spins it further;
// riding across a steep wall the bike carves down it.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BOWL,BOWL_ENTRY,BOWL_TOP,bowlHeight} from '../ride-bowl.js';
import {loadPark,PARK} from '../ride-skatepark.js';
import {makePlaygroundTerrain,makeState,step,bikeParams} from '../ride-physics.js';
import {PLAYGROUND_PADS} from '../ride-playground.js';
await loadPark(async(f,bin)=>{const b=await readFile(new URL('../assets/kenney/mini-skate/'+f,import.meta.url));return bin?b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength):JSON.parse(b)});
const ter=makePlaygroundTerrain();
assert.ok(PLAYGROUND_PADS.some(p=>p.id==='bowl'),'bowl ring');
assert.ok(BOWL_TOP>3&&Math.abs(ter.height(BOWL.x,BOWL.z))<.01&&Math.abs(ter.height(BOWL.x,BOWL.z+BOWL.az+4.5)-BOWL_TOP)<.05,'flat bottom, deck at the top');
const bikes={emoto:bikeParams({kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15}),bmx:bikeParams({kg:11,powertrain:'human',wb:1.0,wheelR:.25})};
const go=(P,pose,sec,input)=>{const s=makeState(P,0,ter),y0=s.y;Object.assign(s,pose);s.moveYaw=s.yaw;s.y=ter.height(s.x,s.z)+y0;const r={airs:0,maxSpun:0};let air=0;
  for(let t=0;t<sec&&!s.crashed;t+=1/60){const g=s.ground[0]||s.ground[1];for(let k=0;k<8;k++)step(s,P,{throttle:0,brake:0,lean:0,steer:0,hop:0,trick:0,...input(s,g,t)},1/480,ter);if(!g)air+=1/60;else{if(air>.4)r.airs++;air=0;}r.maxSpun=Math.max(r.maxSpun,Math.abs(s.spun||0));}
  return Object.assign(r,{s});};
for(const [n,P] of Object.entries(bikes)){
  // drop in and pump the bowl for 12 s
  {const r=go(P,BOWL_ENTRY,12,(s,g)=>({throttle:g&&Math.abs(s.vx)<9?.8:0}));assert.equal(r.s.crashed,null,n+' rides the bowl');assert.ok(Math.abs(r.s.x-BOWL.x)<BOWL.ax+6&&Math.abs(r.s.z-BOWL.z)<BOWL.az+6,n+' stays in the bowl');}
  // quarter pipe air at 13 m/s: turns itself round, lands back in the park going forwards
  {const r=go(P,{x:PARK.x-12,z:PARK.z,yaw:Math.PI,vx:13},5,()=>({}));assert.equal(r.s.crashed,null,n+' vert air: no crash');assert.ok(r.maxSpun>2.8,n+' turned ~180 in the air '+r.maxSpun.toFixed(2));
   assert.ok(Math.abs(Math.cos(r.s.yaw))>.9&&Math.cos(r.s.yaw)>0&&r.s.vx>2,n+' rolling back into the park forwards (yaw '+(r.s.yaw*57.3).toFixed(0)+', v '+r.s.vx.toFixed(1)+')');assert.ok(r.s.x-PARK.x>-PARK.hx+3,n+' back in the park');}
}
// steering in the air spins it further (BMX, 11 m/s)
{const r=go(bikes.bmx,{x:PARK.x-12,z:PARK.z,yaw:Math.PI,vx:11},5,(s,g,t)=>({steer:!g&&t>0?1:0}));assert.ok(r.maxSpun>4,'steer spins past 180: '+r.maxSpun.toFixed(2));}
// carving: across the bowl wall the bike turns downhill
{const P=bikes.bmx,c=makeState(P,0,ter);Object.assign(c,{x:BOWL.x,z:BOWL.z-BOWL.az-1.8,yaw:0,vx:5});c.moveYaw=0;c.y=ter.height(c.x,c.z)+makeState(P,0,ter).y;
 for(let t=0;t<1.2;t+=1/60)for(let k=0;k<8;k++)step(c,P,{throttle:0,brake:0,lean:0,steer:0,hop:0,trick:0},1/480,ter);assert.ok(c.yaw>.3&&c.z>BOWL.z-BOWL.az-1.8,'carves down the wall '+c.yaw.toFixed(2));}
console.log('playground-bowl: ok');
