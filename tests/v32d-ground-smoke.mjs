// v32d: grass/dirt ground, per-wheel slip smoke, crash stays on the rider and off the mesh.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {makeArenaTerrain,bikeParams,makeState,step} from '../ride-physics.js';
import {constrainedBody} from '../crash-physics.js';

const ter=makeArenaTerrain();
const motor=bikeParams({P:4000,kg:40,driveAxle:'rear',powertrain:'electric',batteryWh:1000,wb:1.34,wheelR:.33,comH:.9});

// In-place burnout: driven wheel must slip vs ground speed.
const bo=makeState(motor,0,ter);Object.assign(bo,{x:-80,z:80,vx:.4,y:1,ground:[true,true]});
for(let i=0;i<40;i++)step(bo,motor,{throttle:1,brake:1,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
assert(bo.burnout,'emoto brake+throttle should still burnout');
assert(Math.abs(bo.slip[0])>1.5,'rear tyre should slip during a burnout, slip='+bo.slip);
assert(Math.abs(bo.wheelOmega[0]*motor.R - bo.vx)>1.5,'omega should lead ground speed while slipping');

// Hard launch: some rear slip at low speed, no change to being able to take off.
const go=makeState(motor,0,ter);Object.assign(go,{x:-80,z:80,vx:0.2,y:1,ground:[true,true]});
let launchSlip=0;
for(let i=0;i<60;i++){step(go,motor,{throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);launchSlip=Math.max(launchSlip,Math.abs(go.slip[0]||0));}
assert(go.vx>1,'throttle still launches the bike, vx='+go.vx);
assert(launchSlip>1.2,'hard launch should slip the driven tyre, slip='+launchSlip);

// Ragdoll must rest on a kicker, not fall through it.
const ramp=ter.ramps.find(r=>r.name==='large');
const lx=ramp.x+(ramp.takeoff||8),lz=ramp.z,lipY=ter.height(lx,lz);
assert(lipY>2,'large lip should be raised, h='+lipY);
const drop=constrainedBody({p:{position:[lx,lipY+2.2,lz],radius:.1,mass:2}},[],{velocity:[0,0,0],origin:[lx,lipY+2.2,lz],ground:(x,z)=>ter.height(x,z||0)});
for(let i=0;i<240;i++)drop.step(1/60);
assert(drop.points.p.position[1]>=lipY+0.1-1e-3,'must not fall through the jump, y='+drop.points.p.position[1]+' lip='+lipY);

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const browser=await launchBrowser();
try{
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base.replace(/\/?$/,'/')+'?track=arena',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_emoto'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});

  const ground=await p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const names=[];__WK_RIDE_SCENE__().scene.traverse(o=>{if(o.name==='environment:arena-floor')names.push(o.name)});
    return {ground:st.environment?.ground,colliders:st.environment?.colliders,floor:names.length,trackWidth:st.environment?.trackWidth};
  });
  assert.equal(ground.ground,'grass-dirt','arena floor should be grass and dirt, '+JSON.stringify(ground));
  assert(ground.colliders>20,'props should register as crash colliders, '+JSON.stringify(ground));
  assert(ground.floor>=1,'arena floor mesh is present');

  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:15000});
  // Burnout smoke at the contact patch
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:-80,z:80,yaw:0,vx:.3,vy:0,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true],steer:0});s.y=ter.height(-80,80)+.45;});
  await p.keyboard.down('KeyW');await p.keyboard.down('KeyS');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().s.burnout,null,{timeout:4000});
  await p.waitForTimeout(350);
  const smoke=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {burnout:!!st.s.burnout,slip:st.visual.slip,smoke:st.visual.smoke,vx:st.s.vx};});
  await p.keyboard.up('KeyW');await p.keyboard.up('KeyS');
  assert(smoke.burnout&&Math.abs(smoke.slip[0])>1.5,'burnout should report rear slip, '+JSON.stringify(smoke));
  assert(smoke.smoke>8,'smoke should spawn at a slipping contact patch, '+JSON.stringify(smoke));

  // Crash on the large kicker and keep the camera on the rider, off the mesh.
  if(await p.locator('[data-r=recover]').isVisible().catch(()=>false)){
    await p.locator('[data-r=recover]').click();
    await p.waitForFunction(()=>!__WK_RIDE_STATE__().s.crashed,null,{timeout:8000});
  }
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();const r=ter.ramps.find(x=>x.name==='large');Object.assign(s,{x:r.x+2,z:r.z,yaw:r.yaw||0,vx:10,vy:4,pitch:1.4,w:2,air:.4,wasAir:true,ground:[false,false],steer:0,stunt:null,crashed:null});s.y=ter.height(s.x,s.z)+2.2;});
  await p.waitForFunction(()=>__WK_RIDE_STATE__().s.crashed||__WK_RIDE_STATE__().crash,null,{timeout:4000});
  await p.waitForTimeout(500);
  const crashed=await p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const {cam}=__WK_RIDE_SCENE__();
    const focus=st.crash?{x:(()=>{const r=st.crash.rider.positions,keys=Object.keys(r);const n=keys.length;return keys.reduce((s,k)=>s+r[k][0],0)/n})(),y:(()=>{const r=st.crash.rider.positions,keys=Object.keys(r);const n=keys.length;return keys.reduce((s,k)=>s+r[k][1],0)/n})(),z:(()=>{const r=st.crash.rider.positions,keys=Object.keys(r);const n=keys.length;return keys.reduce((s,k)=>s+r[k][2],0)/n})()}:null;
    let minClear=Infinity;
    if(st.crash){
      for(const part of [st.crash.rider.positions,st.crash.bike.positions]){
        for(const k of Object.keys(part)){
          const p=part[k],g=st.ter.height(p[0],p[2]||0);
          minClear=Math.min(minClear,p[1]-g);
        }
      }
    }
    const d=focus?Math.hypot(cam.position.x-focus.x,cam.position.z-focus.z):null;
    return {why:st.s.crashed,cam:{x:cam.position.x,y:cam.position.y,z:cam.position.z},focus,d,minClear,crashCam:!!st.chaseCam?.crash,fov:cam.fov};
  });
  assert(crashed.why,'expected a crash, '+JSON.stringify(crashed));
  assert(crashed.minClear>-0.05,'ragdoll must not clip through the ground or jumps, clear='+crashed.minClear);
  assert(crashed.d!=null&&crashed.d<9,'camera should stay on the rider, dist='+crashed.d);
  assert(crashed.crashCam,'chase camera should be in crash-follow mode');

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({v32d:true,bo:{slip:bo.slip,vx:bo.vx},launch:{slip:launchSlip,vx:go.vx},drop:drop.points.p.position[1],lipY,ground,smoke,crashed}));
  await p.close();
}finally{await browser.close()}
