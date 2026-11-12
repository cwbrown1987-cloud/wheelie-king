// Korumburra: real elevation and buildings load, the main street is rideable on its real slopes, walls stop
// the bike (glance or crash-free stop), and the teleport rings go there and back.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadTown,townHeight,townGround,townArrival,TOWN,townData} from '../ride-town.js';
import {makePlaygroundTerrain,makeState,step,bikeParams} from '../ride-physics.js';
import {PLAYGROUND_PADS} from '../ride-playground.js';
await loadTown(async(f,bin)=>{const b=await readFile(new URL('../assets/towns/korumburra/'+f,import.meta.url));return bin?b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength):JSON.parse(b.toString())});
const D=townData();assert.ok(D.buildings.length>300&&D.roads.length>80,'town data');assert.ok(D.roads.some(r=>r.n==='Commercial Street')&&D.roads.some(r=>r.n==='Mine Road')&&D.roads.some(r=>r.n==='Station Street')&&D.roads.some(r=>r.n==='Bridge Street'),'the named streets are in');
let lo=1e9,hi=-1e9;for(let x=-400;x<=400;x+=20)for(let z=-600;z<=600;z+=20){const h=townGround(TOWN.x+x,TOWN.z+z);lo=Math.min(lo,h);hi=Math.max(hi,h);}
assert.ok(hi-lo>25,'real hills: relief '+(hi-lo).toFixed(1)+' m');
assert.equal(townGround(TOWN.x+TOWN.halfX+5,TOWN.z),0,'fades to the playground floor');
const b=D.buildings.find(b=>b.h>=4.4&&b.p.length>=4);const cx=b.p.reduce((s,p)=>s+p[0],0)/b.p.length,cz=b.p.reduce((s,p)=>s+p[1],0)/b.p.length;
assert.ok(townHeight(TOWN.x+cx,TOWN.z+cz)-townGround(TOWN.x+cx,TOWN.z+cz)>3,'buildings stand up in the physics ground');
const ter=makePlaygroundTerrain(),P=bikeParams({kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15});
const a=townArrival();const s=makeState(P,0,ter);const y0=s.y;Object.assign(s,{x:a.x,z:a.z,yaw:a.yaw,vx:3});s.y=ter.height(s.x,s.z)+y0;
let dist=0,px=s.x,pz=s.z;for(let i=0;i<60*12&&!s.crashed;i++){for(let k=0;k<8;k++)step(s,P,{throttle:s.vx<7?.6:0,brake:0,lean:0,steer:0},1/480,ter);dist+=Math.hypot(s.x-px,s.z-pz);px=s.x;pz=s.z;}
assert.ok(dist>20&&s.y>0,'rode along the main street '+dist.toFixed(0)+' m, crashed: '+s.crashed);
// ride into a building wall: stopped or turned, never through it
const w=D.buildings.find(b=>b.h>=4.4&&b.p.length===4);const [x0,z0]=w.p[0],[x1,z1]=w.p[1];const mx=(x0+x1)/2,mz=(z0+z1)/2;let nx=-(z1-z0),nz=x1-x0;const nl=Math.hypot(nx,nz);nx/=nl;nz/=nl;
const wc=[w.p.reduce((s,p)=>s+p[0],0)/4,w.p.reduce((s,p)=>s+p[1],0)/4];if((wc[0]-mx)*nx+(wc[1]-mz)*nz>0){nx=-nx;nz=-nz;}
const s2=makeState(P,0,ter);Object.assign(s2,{x:TOWN.x+mx+nx*6,z:TOWN.z+mz+nz*6,yaw:Math.atan2(-nz,-nx),vx:5});s2.y=ter.height(s2.x,s2.z)+y0;
let inside=false;for(let i=0;i<60*3;i++){for(let k=0;k<8;k++)step(s2,P,{throttle:s2.vx<5?.6:0,brake:0,lean:0,steer:0},1/480,ter);if(townHeight(s2.x,s2.z)-townGround(s2.x,s2.z)>2&&s2.y<townHeight(s2.x,s2.z))inside=true;}
assert.ok(!inside,'the bike does not drive through a building');
assert.ok(PLAYGROUND_PADS.some(p=>p.id==='town')&&Math.hypot(PLAYGROUND_PADS.find(p=>p.id==='town').to.x-a.x,0)<1,'ring goes to the main street');
console.log('playground-town: ok',JSON.stringify({buildings:D.buildings.length,roads:D.roads.length,relief:+(hi-lo).toFixed(1),rode:+dist.toFixed(0)}));
