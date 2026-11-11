// Arena side-view rail: path math, lock, no-steer, camera swing, and a natural glide return.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {makeArenaTerrain,bikeParams,makeState,step} from '../ride-physics.js';
import {makeArenaTrack,easeInOut,startTrackReturn,stepTrackLock,canStartTrackReturn} from '../ride-track.js';

const track=makeArenaTrack();
assert(track.length>280,'track should span the arena, length='+track.length);
assert.equal(track.width,10);
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
const s=Object.assign(makeState(motor,0,ter),{x:0,z:40,y:ter.height(0,40)+.45,yaw:.4,vx:6,vy:0,pitch:0,w:0,ground:[true,true],air:0,crashed:null});
const lock={mode:'free'};
assert.equal(canStartTrackReturn(s),true);
startTrackReturn(s,ter.track,lock);
assert.equal(lock.mode,'gliding');
assert.equal(s.z,40,'startTrackReturn does not teleport');
assert(lock.dur>=1.6,'a long return should take more than a snap, dur='+lock.dur);
const vx0=s.vx,yaw0=s.yaw,samples=[],dur=lock.dur;
let lastZ=s.z;
for(let i=0;i<Math.round(dur*60)+2;i++){
  step(s,motor,{throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
  stepTrackLock(s,ter,lock,1/60);
  samples.push({t:(i+1)/60,z:s.z,yaw:s.yaw,vx:s.vx,mode:lock.mode,dist:ter.track.nearest(s.x,s.z).dist});
  assert(Math.abs(s.z-lastZ)<3.5,'glide should not pop, i='+i+' dz='+(s.z-lastZ));
  lastZ=s.z;
}
const mid=samples[Math.max(0,Math.round(dur*60*.4)-1)];
assert(mid.mode==='gliding','still gliding mid-way '+JSON.stringify(mid));
assert(mid.dist>8&&mid.dist<near.dist-2,'mid-glide is part-way home, dist='+mid.dist);
assert(Math.abs(mid.vx-vx0)<2.5,'speed is kept mid-glide, vx='+mid.vx);
const end=samples.at(-1);
assert.equal(end.mode,'locked');
assert(end.dist<0.6,'arrives on the track, '+JSON.stringify(end));
assert(Math.abs(end.vx-vx0)<3,'arrives still moving, vx='+end.vx);
assert(Math.abs(s.z)<1.2);
// Heading has blended toward the path (near 0 at x≈0..few metres).
assert(Math.abs(s.yaw)<.35,'heading blends to the track, yaw='+s.yaw+' from '+yaw0);

const air=Object.assign(makeState(motor,0,ter),{ground:[false,false],air:.3,z:30,vy:2,spinV:0});
assert.equal(canStartTrackReturn(air),false,'must wait until landing');
const trick=Object.assign(makeState(motor,0,ter),{ground:[true,true],air:0,stunt:{name:'superman'}});
assert.equal(canStartTrackReturn(trick),false,'must wait out a mid-trick');

assert(easeInOut(.5)-.5<.01);
assert(easeInOut(0)===0&&easeInOut(1)===1);
assert(easeInOut(.2)<.2&&easeInOut(.8)>.8,'ease-in-out is slow at the ends');

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

  // Return from well off-track: no snap, concurrent camera + glide, speed kept, wheels on ground.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:0,z:50,yaw:0.5,vx:5,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(0,50)+.45;});
  await p.waitForTimeout(80);
  const before=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {x:st.s.x,z:st.s.z,yaw:st.s.yaw,vx:st.s.vx,y:st.s.y};});
  await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
  const first=await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r((()=>{const st=__WK_RIDE_STATE__();return {z:st.s.z,mode:st.trackLock?.mode,t:st.trackLock?.t,blend:st.cameraBlend,vx:st.s.vx,yaw:st.s.yaw,y:st.s.y,dist:st.trackLock?.dist};})())))));
  assert.equal(first.mode,'gliding','off-track side view starts a glide');
  assert(Math.abs(first.z-before.z)<3,'no teleport on the first frames '+JSON.stringify({before,first}));
  assert(first.vx>3,'keeps forward speed');
  // Sample the curve: z should ease toward the track, never jump more than a couple of metres in 50ms.
  const curve=[];
  for(let i=0;i<10;i++){
    await p.waitForTimeout(80);
    curve.push(await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {t:st.trackLock?.t,z:st.s.z,yaw:st.s.yaw,vx:st.s.vx,blend:st.cameraBlend,mode:st.trackLock?.mode,dist:st.trackLock?.dist,air:st.s.air,y:st.s.y};}));
  }
  for(let i=1;i<curve.length;i++){
    assert(Math.abs(curve[i].z-curve[i-1].z)<6,'glide should be smooth, no pop '+JSON.stringify(curve.slice(i-1,i+1)));
    assert((curve[i].air||0)<.05,'wheels stay on the ground during the return');
  }
  await p.waitForFunction(()=>__WK_RIDE_STATE__().trackLock?.mode==='locked'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});
  const home=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();const {cam}=__WK_RIDE_SCENE__();return {z:st.s.z,dist:st.trackLock?.dist,yaw:st.s.yaw,vx:st.s.vx,blend:st.cameraBlend,mode:st.trackLock?.mode,left:getComputedStyle(document.querySelector('.ride-dpad [data-t=steerLeft]')).display,camZ:cam.position.z};});
  assert.equal(home.mode,'locked');
  assert(home.dist<1.2,'finishes on the track '+JSON.stringify(home));
  assert(home.vx>2,'still carries speed');
  assert.equal(home.left,'none');
  assert(home.camZ>home.z+3,'side camera sits beside the track');

  // In the air, the return waits until landing, then glides.
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
  await p.waitForFunction(()=>['gliding','locked'].includes(__WK_RIDE_STATE__().trackLock?.mode),null,{timeout:4000});
  const afterLand=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {mode:st.trackLock?.mode,blend:st.cameraBlend,z:st.s.z};});
  assert(['gliding','locked'].includes(afterLand.mode),'glide starts after landing '+JSON.stringify(afterLand));
  if(afterLand.mode==='gliding')assert(afterLand.z>8,'still easing in after landing, z='+afterLand.z);
  await p.waitForFunction(()=>__WK_RIDE_STATE__().trackLock?.mode==='locked'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({arenaTrack:true,start,noSteer,midSwing,swung,off,first,curve,home,hung,afterLand}));
}finally{await browser.close()}
