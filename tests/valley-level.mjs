// The Valley: the locked forest-trail race. An e-moto near 60 km/h and a pedal BMX both ride it start to finish,
// clear both creek gaps (no splash), and the world builds without throwing (node smoke with a stub canvas).
import assert from 'node:assert/strict';
import {NEON,NEON_COINS,makeNeonTerrain,neonLock,neonInGap,neonSafeS} from '../ride-valley.js';
import {makeState,step,bikeParams} from '../ride-physics.js';
const ter=makeNeonTerrain();assert.ok(NEON.len>1200,'about 1.3 km');assert.ok(NEON_COINS.length>150,'coin trails');assert.equal(neonSafeS(625),585,'recover before the creek');
for(const [name,bike] of [['e-moto',{kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15,batteryWh:1500}],['bmx',{kg:11,P:250,nm:40,wb:1.0,wheelR:.25,travel:.02,shock:.02}]]){
  const P=bikeParams(bike),s=makeState(P,0,ter),y0=s.y;Object.assign(s,{x:2,z:0,yaw:0,vx:3});s.moveYaw=0;s.y=ter.height(2,0)+y0;let t=0,splash=false;const vT=60/3.6;
  for(;t<240&&!s.crashed&&(s.trackS||0)<NEON.finish;t+=1/60){for(let k=0;k<8;k++){step(s,P,{throttle:s.vx<vT?.8:0,brake:s.vx>vT+2?.3:0,lean:0,steer:0,hop:0,trick:0},1/480,ter);neonLock(s,1/480);}if(neonInGap(s.trackS)&&s.y<.5)splash=true;}
  assert.equal(s.crashed,null,name+' rides The Valley without crashing (at s '+(s.trackS||0).toFixed(0)+')');assert.ok(s.trackS>=NEON.finish,name+' reaches the finish');assert.ok(!splash,name+' clears the creeks');
  if(name==='e-moto')assert.ok(t>70&&t<120,'about 1.5 min at 60 km/h: '+t.toFixed(0));}
const ctx=new Proxy({},{get:(t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:10}):k==='getImageData'||k==='createImageData'?(a,b,c,d)=>({data:new Uint8ClampedArray(4*(c??a)*(d??b))}):()=>{},set:()=>true});
const el=()=>({width:0,height:0,style:{},getContext:()=>ctx,addEventListener(){},removeEventListener(){},setAttribute(){}});
globalThis.document={createElement:el,createElementNS:el};globalThis.self=globalThis;
const T=await import('../vendor/three.module.js');const {makeValleyWorld}=await import('../ride-valley-world.js');
for(const lowDetail of [false,true]){const root=new T.Group(),w=makeValleyWorld(T,root,{lowDetail,quality:lowDetail?'low':'high',GLTFLoader:null});let meshes=0;root.traverse(o=>{if(o.isMesh)meshes++;});assert.ok(meshes>30,'valley world has its meshes ('+meshes+')');
  w.update(.016);w.updateRider(2,0,.3,.016);w.setView(1);w.setView(0);assert.equal(w.takeCoin(0),true);assert.equal(w.takeCoin(0),false);w.resetCoins();w.dispose();}
console.log('valley-level: ok');
