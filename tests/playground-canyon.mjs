// Desert canyon bike track: ride it end to end along the track line, clear the tables/doubles/step-up without
// crashing, stay inside the canyon (walls hold you in), and the rings connect it to the playground.
import assert from 'node:assert/strict';
import {CANYON,canyonPathZ,canyonHeight,canyonInfo,CANYON_START,CANYON_POSTS,inCanyon} from '../ride-canyon.js';
import {makePlaygroundTerrain,makeState,step,bikeParams} from '../ride-physics.js';
import {PLAYGROUND_PADS} from '../ride-playground.js';
const ter=makePlaygroundTerrain();
assert.ok(PLAYGROUND_PADS.some(p=>p.id==='canyon')&&PLAYGROUND_PADS.some(p=>p.id==='canyon-back'),'rings in and out');
assert.ok(Math.abs(ter.height(CANYON_START.x,CANYON_START.z)-canyonHeight(CANYON_START.x,CANYON_START.z))<.6,'playground ground uses the canyon');
// walls: high either side of the floor, low on the track
for(const u of [20,90,160,220]){const z=canyonPathZ(u);assert.ok(canyonHeight(CANYON.x0+u,z+25)>6&&canyonHeight(CANYON.x0+u,z-25)>6,'walls at u '+u);}
assert.ok(!inCanyon(0,0)&&!inCanyon(150,85),'canyon clear of the start area and skate park');
// no posts on the track
for(const p of CANYON_POSTS){const d=canyonInfo(p.x,p.z);assert.ok(d.dz>CANYON.tw+.5||d.u<0||d.u>CANYON.len,'post off the track '+p.x.toFixed(1)+','+p.z.toFixed(1));}
const bikes={emoto:bikeParams({kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15}),bmx:bikeParams({kg:11,powertrain:'human',wb:1.0,wheelR:.25})};
for(const [n,P] of Object.entries(bikes)){
  const s=makeState(P,0,ter),y0=s.y;Object.assign(s,CANYON_START);s.moveYaw=s.yaw;s.y=ter.height(s.x,s.z)+y0;let t=0,maxDz=0,air=0,airs=0;const dt=1/60,N=8,vT=n==='emoto'?11:9;
  for(;t<80&&!s.crashed&&s.x<CANYON.x0+232;t+=dt){
    const L=3+s.vx*.5,u=s.x+L-CANYON.x0,want=Math.atan2(canyonPathZ(u)-s.z,L),err=Math.atan2(Math.sin(want-s.yaw),Math.cos(want-s.yaw)),g=s.ground[0]||s.ground[1];
    for(let k=0;k<N;k++)step(s,P,{throttle:s.vx<vT?.7:0,brake:s.vx>vT+2?.4:0,lean:0,steer:g?Math.max(-1,Math.min(1,err*3)):0,hop:0,trick:0},dt/N,ter);
    {const o=canyonInfo(s.x,s.z).dz;if(o>maxDz){maxDz=o;globalThis.at=(s.x-CANYON.x0).toFixed(0)+(g?"g":"air");}}if(!g)air+=dt;else{if(air>.35)airs++;air=0;}
  }
  console.log(n,"maxAt",globalThis.at,"t",t.toFixed(1),'reached u',(s.x-CANYON.x0).toFixed(0),'maxOff',maxDz.toFixed(1),'jumps',airs,s.crashed||'');
  assert.equal(s.crashed,null,n+' rides the canyon without crashing');
  assert.ok(s.x>CANYON.x0+230,n+' reaches the finish');
  assert.ok(maxDz<CANYON.tw+2,n+' stays on the track line');
  if(n==='emoto')assert.ok(airs>=3,'gets air off the jumps '+airs);
}
console.log('playground-canyon: ok');
