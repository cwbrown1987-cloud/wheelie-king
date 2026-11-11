// Arena side-view rail: path math, lock, no-steer, camera swing, and a natural glide return.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {makeArenaTerrain,bikeParams,makeState,step} from '../ride-physics.js';
import {makeArenaTrack,easeInOut,startTrackReturn,stepTrackLock,canStartTrackReturn,snapToTrack} from '../ride-track.js';
import {wrapAngle} from '../ride-freeroam.js';

const track=makeArenaTrack();
assert(track.length>280,'track should span the arena, length='+track.length);
assert.equal(track.width,6);
for(const [x,z,name] of [[28,0,'small'],[70,22,'medium'],[115,0,'large']]){
  const n=track.nearest(x,z);
  assert(n.onTrack&&n.dist<1.2,name+' kicker should sit on the track '+JSON.stringify(n));
}
assert(!track.onTrack(0,40),'z=40 is off the strip');
const near=track.nearest(0,40);
assert(near.dist>30,'nearest to (0,40) should be around z=0, dist='+near.dist);
assert(Math.abs(near.x)<8&&Math.abs(near.z)<4,'projects to the centre line '+JSON.stringify(near));

const ter=makeArenaTerrain();
assert(ter.track,'terrain exposes the track');
const motor=bikeParams({P:4000,kg:40,driveAxle:'rear',powertrain:'electric',batteryWh:1000});

function place(x,z,yaw,vx){
  return Object.assign(makeState(motor,0,ter),{x,z,y:ter.height(x,z)+.45,yaw,vx,vy:0,pitch:0,w:0,ground:[true,true],air:0,crashed:null});
}
function runWhip(s){
  const lock={mode:'free'};
  const s0=ter.track.nearest(s.x,s.z,s.yaw).s;
  const startZ=s.z,startX=s.x,vx0=s.vx;
  startTrackReturn(s,ter.track,lock);
  const before={mode:lock.mode,x:s.x,z:s.z,yaw:s.yaw,snapped:!!lock.snapped};
  const path=[];
  for(let i=0;i<Math.round((lock.dur||.42)*60)+4;i++){
    step(s,motor,{throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
    stepTrackLock(s,ter,lock,1/60);
    path.push({t:(i+1)/60,x:s.x,z:s.z,yaw:s.yaw,vx:s.vx,mode:lock.mode,snapped:!!lock.snapped,s:ter.track.nearest(s.x,s.z).s});
  }
  const n=ter.track.nearest(s.x,s.z);
  return {s,lock,s0,startX,startZ,vx0,before,path,n};
}

// A heading more than 90° off used to be treated as "facing backward", which
// spun the bike around and ran it the wrong way along the rail.
const wrong=runWhip(place(0,40,2.5,6));
assert.equal(wrong.before.mode,'whipping','off-track return waits for the camera whip');
assert(Math.abs(wrong.before.z-40)<1,'must not teleport at the start of the whip, z='+wrong.before.z);
const midW=wrong.path.find(p=>p.t>0.08&&p.t<0.16);
assert(midW&&Math.abs(midW.z-40)<8,'bike stays put until the hidden snap, '+JSON.stringify(midW));
assert.equal(wrong.lock.mode,'locked');
assert(wrong.n.dist<0.6,'arrives on the track, dist='+wrong.n.dist);
assert(Math.abs(wrapAngle(wrong.s.yaw-wrong.n.heading))<0.2,'must face forward along the track, yaw='+wrong.s.yaw+' heading='+wrong.n.heading);
const snapAt=wrong.path.find(p=>p.snapped);assert(snapAt,'snap should happen mid-whip');assert(wrong.n.s+0.05>=snapAt.s,'arc position must not go backwards after the snap, snapS='+snapAt.s+' s='+wrong.n.s);
assert(wrong.s.vx>4,'speed is kept, vx='+wrong.s.vx);

const cases=[
  {name:'north side',x:0,z:40,yaw:.4,vx:5},
  {name:'south side',x:0,z:-40,yaw:-.4,vx:5},
  {name:'ahead of the S curve',x:40,z:30,yaw:.2,vx:5},
  {name:'behind the S curve',x:95,z:25,yaw:-.2,vx:5},
  {name:'wide yaw on the south',x:20,z:-35,yaw:3.0,vx:6}
];
for(const c of cases){
  const r=runWhip(place(c.x,c.z,c.yaw,c.vx));
  const turn=Math.atan2(Math.sin(r.s.yaw-r.n.heading),Math.cos(r.s.yaw-r.n.heading));
  assert.equal(r.lock.mode,'locked',c.name+' should finish locked');
  assert(r.n.dist<0.8,c.name+' should finish on the track '+JSON.stringify({dist:r.n.dist,yaw:r.s.yaw,h:r.n.heading}));
  assert(Math.abs(turn)<0.25,c.name+' heading must point forward along the track, dYaw='+turn);
  const snapC=r.path.find(p=>p.snapped);assert(snapC,c.name+' should snap');assert(r.n.s+0.08>=snapC.s,c.name+' must not travel backward along the path, snapS='+snapC.s+' s='+r.n.s);
  assert(r.s.vx>3,c.name+' keeps forward speed, vx='+r.s.vx);
}

const air=Object.assign(makeState(motor,0,ter),{ground:[false,false],air:.3,z:30,vy:2,spinV:0});
assert.equal(canStartTrackReturn(air),false,'must wait until landing');
const trick=Object.assign(makeState(motor,0,ter),{ground:[true,true],air:0,stunt:{name:'superman'}});
assert.equal(canStartTrackReturn(trick),false,'must wait out a mid-trick');

assert(easeInOut(0)===0&&easeInOut(1)===1);

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const browser=await launchBrowser();
try{
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('wk-level','arena'));
  await p.goto(base.replace(/\/?$/,'/')+'?track=arena',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_emoto'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});

  const start=await p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const left=document.querySelector('.ride-dpad [data-t=steerLeft]');
    return {
      view:st.cameraView,blend:st.cameraBlend,mode:st.trackLock?.mode,dist:st.trackLock?.dist,
      z:st.s.z||0,left:getComputedStyle(left).display,track:st.environment?.track,
      cam:{x:st.chaseCam?undefined:0}
    };
  });
  assert.equal(start.view,'side');
  assert.equal(start.mode,'locked');
  assert(start.dist<1.2,'spawn is on the rail');
  assert.equal(start.left,'none');
  assert.equal(start.track,true);

  // Side-view lock: z stays on the path, A/D do nothing, tilt still works.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:-40,z:0,yaw:0,vx:3,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(-40,0)+.45;});
  await p.keyboard.down('KeyA');
  await p.waitForTimeout(500);
  const noSteer=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {steer:st.inp.steer,z:st.s.z,yaw:st.s.yaw,mode:st.trackLock?.mode,dist:st.trackLock?.dist};});
  await p.keyboard.up('KeyA');
  assert.equal(noSteer.steer,0,'A does nothing in side view');
  assert.equal(noSteer.mode,'locked');
  assert(noSteer.dist<1.5,'z stays on the track '+JSON.stringify(noSteer));
  await p.keyboard.down('ArrowUp');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.lean===-1,null,{timeout:3000});
  await p.keyboard.up('ArrowUp');

  // Chase unlocks steering and you can drive off the track. Camera swings ~0.7s.
  const t0=Date.now();
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  const midSwing=await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r({blend:__WK_RIDE_STATE__().cameraBlend,view:__WK_RIDE_STATE__().cameraView,mode:__WK_RIDE_STATE__().trackLock?.mode})))));
  assert.equal(midSwing.view,'chase');
  assert.equal(midSwing.mode,'free');
  assert(midSwing.blend>0&&midSwing.blend<1,'camera should be mid-swing toward chase '+JSON.stringify(midSwing));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:8000});
  const swung=Date.now()-t0;
  assert(swung>=500&&swung<=1600,'chase swing should take ~0.7s, took '+swung+'ms');
  const leftOn=await p.evaluate(()=>getComputedStyle(document.querySelector('.ride-dpad [data-t=steerLeft]')).display);
  assert.notEqual(leftOn,'none','LEFT appears in chase');
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:-20,z:0,yaw:0.6,vx:5,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(-20,0)+.45;});
  await p.locator('canvas').first().click({position:{x:400,y:180}}).catch(()=>{});
  await p.keyboard.down('KeyD');
  await p.keyboard.down('KeyW');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer===1&&__WK_RIDE_STATE__().inp.throttle===1,null,{timeout:3000});
  await p.waitForFunction(()=>Math.abs(__WK_RIDE_STATE__().s.z||0)>8,null,{timeout:8000});
  const off=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {z:st.s.z,steer:st.inp.steer,mode:st.trackLock?.mode,dist:st.trackLock?.dist,vx:st.s.vx};});
  await p.keyboard.up('KeyD');
  await p.keyboard.up('KeyW');
  assert.equal(off.mode,'free');
  assert(off.z>8,'can drive off the track, z='+off.z);
  assert(off.dist>5);

  // Return from well off-track: the bike stays put, then a hidden snap at mid-whip.
  const returns=[];
  for(const pos of [
    {name:'north',x:0,z:50,yaw:0.5,vx:5},
    {name:'south',x:0,z:-50,yaw:-0.5,vx:5},
    {name:'ahead-of-curve',x:36,z:30,yaw:0.3,vx:5},
    {name:'behind-curve',x:95,z:28,yaw:2.6,vx:6}
  ]){
    await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
    await p.waitForFunction(()=>__WK_RIDE_STATE__().trackLock?.mode==='free'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:8000});
    await p.evaluate((o)=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:o.x,z:o.z,yaw:o.yaw,vx:o.vx,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(o.x,o.z)+.45;},pos);
    await p.waitForTimeout(60);
    const before=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {x:st.s.x,z:st.s.z,yaw:st.s.yaw,vx:st.s.vx,s:st.trackLock?.s,heading:st.trackLock?.heading};});
    await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
    const first=await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r((()=>{const st=__WK_RIDE_STATE__();return {z:st.s.z,mode:st.trackLock?.mode,t:st.trackLock?.t,blend:st.cameraBlend,vx:st.s.vx,dist:st.trackLock?.dist};})())))));
    assert.equal(first.mode,'whipping',pos.name+' should start a camera whip, '+JSON.stringify(first));
    assert(Math.abs(first.z-before.z)<6,pos.name+' must not drag on the first frames '+JSON.stringify({before,first}));
    await p.waitForFunction(()=>__WK_RIDE_STATE__().trackLock?.mode==='locked'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});
    const home=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();const {cam}=__WK_RIDE_SCENE__();
      const h=st.trackLock?.heading||0,yaw=st.s.yaw||0;
      return {z:st.s.z,dist:st.trackLock?.dist,yaw,vx:st.s.vx,s:st.trackLock?.s,heading:h,
        dYaw:Math.atan2(Math.sin(yaw-h),Math.cos(yaw-h)),mode:st.trackLock?.mode,
        left:getComputedStyle(document.querySelector('.ride-dpad [data-t=steerLeft]')).display,camZ:cam.position.z,radius:st.chaseCam?.radius};
    });
    assert.equal(home.mode,'locked',pos.name);
    assert(home.dist<1.2,pos.name+' should finish on the track '+JSON.stringify(home));
    assert(Math.abs(home.dYaw)<0.25,pos.name+' must face forward along the track '+JSON.stringify(home));
    assert(home.vx>2,pos.name+' still carries speed');
    assert.equal(home.left,'none',pos.name);
    returns.push({pos:pos.name,before,first,home});
  }
  const home=returns[0].home;

  // In the air, the return waits until landing, then whips.
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().trackLock?.mode==='free'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:8000});
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:0,z:45,yaw:0,vx:4,vy:3,y:ter.height(0,45)+3.2,pitch:0,w:0,air:.25,wasAir:true,crashed:null,ground:[false,false],spinV:0,stunt:null,whip:0});});
  await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
  const hung=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {mode:st.trackLock?.mode,view:st.cameraView,blend:st.cameraBlend,z:st.s.z,air:st.s.air,visual:document.querySelector('[data-wk-ride-surface]')?.dataset.wkCam};});
  assert.equal(hung.mode,'pending','airborne return is deferred');
  assert.equal(hung.visual,'chase','camera stays in chase until landing');
  assert(Math.abs(hung.z-45)<6,'does not pull in mid-air '+JSON.stringify(hung));
  // Land them and let the glide start.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{vy:0,air:0,wasAir:false,ground:[true,true],stunt:null,spinV:0,whip:0});s.y=ter.height(s.x,s.z||0)+.45;});
  await p.waitForFunction(()=>['whipping','locked'].includes(__WK_RIDE_STATE__().trackLock?.mode),null,{timeout:4000});
  const afterLand=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {mode:st.trackLock?.mode,blend:st.cameraBlend,z:st.s.z};});
  assert(['whipping','locked'].includes(afterLand.mode),'whip starts after landing '+JSON.stringify(afterLand));
  if(afterLand.mode==='whipping'&&!(afterLand.t>0.2))assert(afterLand.z>8,'still off-track until the hidden snap, z='+afterLand.z);
  await p.waitForFunction(()=>__WK_RIDE_STATE__().trackLock?.mode==='locked'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});

  // Airborne chase eases back and up to frame the jump, then eases back in on landing, with no pop.
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:8000});
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:-40,z:0,yaw:0,vx:6,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(-40,0)+.45;});
  await p.waitForTimeout(400);
  const grounded=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {r:st.chaseCam?.radius,y:st.chaseCam?.camY,air:st.chaseCam?.airClose||0};});
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{vy:4,y:ter.height(s.x,s.z||0)+3.4,air:.3,ground:[false,false],wasAir:true,crashed:null});});
  await p.waitForFunction(()=>(__WK_RIDE_STATE__().chaseCam?.airClose||0)>0.55,null,{timeout:4000});
  const flown=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {r:st.chaseCam?.radius,y:st.chaseCam?.camY,air:st.chaseCam?.airClose||0,clear:st.chaseCam?.clearance};});
  assert(flown.air>0.55,'air camera should ease into jump framing, '+JSON.stringify({grounded,flown}));
  assert(flown.r>grounded.r+0.4,'chase should sit further back in the air, '+JSON.stringify({grounded,flown}));
  assert(flown.y>grounded.y+0.2,'chase should sit higher in the air, '+JSON.stringify({grounded,flown}));
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{vy:0,air:0,wasAir:false,ground:[true,true]});s.y=ter.height(s.x,s.z||0)+.45;});
  await p.waitForFunction(()=>(__WK_RIDE_STATE__().chaseCam?.airClose||0)<0.12,null,{timeout:4000});
  const landed=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {r:st.chaseCam?.radius,air:st.chaseCam?.airClose||0};});
  assert(landed.air<0.12,'air camera should ease back in after landing, '+JSON.stringify(landed));
  assert(Math.abs(landed.r-grounded.r)<0.45,'landing must not pop the camera, '+JSON.stringify({grounded,landed}));

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({arenaTrack:true,start,noSteer,midSwing,swung,off,returns,home,hung,afterLand,grounded,flown,landed}));
}finally{await browser.close()}
