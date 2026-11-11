// TEST ARENA: free-ride square, free-roam controls, jumps, soft wall, burnout pivot.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {bikeParams,makeState,step,makeArenaTerrain} from '../ride-physics.js';

const ter=makeArenaTerrain();
assert.equal(ter.arena,true);
assert.equal(ter.freeRoam,true);
assert.equal(ter.freeRide,true);
assert.equal(ter.finish,Infinity);
assert.deepEqual(ter.checkpoints,[0]);
assert.equal(ter.bounds.xmax-ter.bounds.xmin,300,'arena is 300 m across');
assert.equal(ter.bounds.zmax-ter.bounds.zmin,300);
assert.equal(ter.height(0,0),0,'spawn is flat');
assert(ter.height(29,0)>0.8,'small kicker lip is in the height field');
assert(ter.height(54+6.8*Math.cos(ter.ramps.find(r=>r.name==='medium').yaw),12+6.8*Math.sin(ter.ramps.find(r=>r.name==='medium').yaw))>1.0,'medium kicker lip is in the height field');
assert(ter.height(77.5,-28)>1.5,'big kicker lip is in the height field');
assert(ter.height(120.5,0)>2.8,'large ramp lip is in the height field');
assert(ter.ramps.length===5,'expected table + 4 kickers, got '+ter.ramps.length);
assert(ter.track,'arena terrain exposes a side-view track');
assert(ter.track.onTrack(-48,0),'tabletop sits on the track');
assert(ter.height(-40,0)>1.1,'tabletop has a flat deck');
assert(ter.track.onTrack(28,0),'small kicker sits on the track');
assert(ter.track.onTrack(70,22),'medium kicker sits on the track');
assert(ter.track.onTrack(115,0),'large kicker sits on the track');
assert(!ter.track.onTrack(0,40),'z=40 is off the track');

const motor=bikeParams({P:4000,kg:40,driveAxle:'rear',powertrain:'electric',batteryWh:1000});
const pedal=bikeParams({powertrain:'human'});
function run(p,seconds,inp,start={}){
  const s=Object.assign(makeState(p,0,ter),start);
  for(let i=0;i<Math.round(seconds*60);i++)step(s,p,inp,1/60,ter);
  return s;
}
const top=run(motor,8,{throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},{x:-110,z:80,y:1});
assert(top.vx>10,'should get up to speed on the open square, vx='+top.vx);
assert(!top.crashed,'top-speed run should stay upright');
assert(Math.abs((top.z||80)-80)<2,'straight run holds a clear lane');

const wh=makeState(pedal,0,ter);wh.vx=4;
for(let i=0;i<90;i++)step(wh,pedal,{throttle:1,brake:0,lean:1,hop:0,trick:0,whip:0,steer:0},1/60,ter);
assert(wh.pitch>0.4||wh.wheelieT>0.2,'wheelie should lift the nose '+JSON.stringify({pitch:wh.pitch,t:wh.wheelieT,balance:wh.balance}));

const bo=makeState(motor,0,ter);bo.vx=.4;
for(let i=0;i<30;i++)step(bo,motor,{throttle:1,brake:1,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
assert(bo.burnout,'emoto brake+throttle at low speed should burnout');
assert(Math.abs(bo.vx)<1,'burnout holds the bike in place, vx='+bo.vx);
const yaw0=bo.yaw||0;
for(let i=0;i<60;i++)step(bo,motor,{throttle:1,brake:1,lean:0,hop:0,trick:0,whip:0,steer:1},1/60,ter);
assert((bo.yaw||0)-yaw0>0.25,'burnout + steer should slide the rear around, yaw='+bo.yaw);
assert((bo.yaw||0)-yaw0<0.9,'burnout slide should be slower than a snap-spin, yaw='+bo.yaw);
assert(bo.burnout&&Math.abs(bo.vx)<1.2,'pivot stays a burnout, vx='+bo.vx);

const jump=makeState(motor,24,ter);jump.z=0;jump.vx=8;jump.y=ter.height(24,0)+.5;
for(let i=0;i<90;i++)step(jump,motor,{throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
assert(jump.air>0||jump.y>1.6||jump.vy>1,'small kicker should launch the bike '+JSON.stringify({y:jump.y,vy:jump.vy,air:jump.air,x:jump.x}));

const wall=makeState(motor,0,ter);wall.x=ter.bounds.xmax-0.2;wall.vx=8;
for(let i=0;i<20;i++)step(wall,motor,{throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
assert(wall.x<=ter.bounds.xmax+1e-6,'wall holds x='+wall.x);
assert(!wall.crashed,'wall is a soft stop');

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
    return {
      level:st.level,arena:st.arena,freeRoam:st.freeRoam,sample3d:st.sample3d,
      finish:st.ter.finish,size:st.ter.bounds.xmax-st.ter.bounds.xmin,
      hasArenaBtn:!!document.querySelector('[data-r="mode-arena"]'),
      hasSampleBtn:!!document.querySelector('[data-r="mode-sample3d"]'),
      label:document.querySelector('[data-r="level"]')?.textContent,
      dpadOn:getComputedStyle(document.querySelector('.ride-dpad')).display,
      leftOn:getComputedStyle(document.querySelector('.ride-dpad [data-t=steerLeft]')).display,
      rightOn:getComputedStyle(document.querySelector('.ride-dpad [data-t=steerRight]')).display,
      view:st.cameraView, lock:st.trackLock, z:st.s.z||0,
      env:st.environment
    };
  });
  assert.equal(start.level,'arena');
  assert.equal(start.arena,true);
  assert.equal(start.freeRoam,true);
  assert.equal(start.sample3d,false);
  assert.equal(start.finish,Infinity);
  assert.equal(start.size,300);
  assert.equal(start.hasArenaBtn,true,'pause Mode should include PLAYGROUND');
  assert.equal(start.hasSampleBtn,true);
  assert.match(start.label||'',/PLAYGROUND/);
  assert.notEqual(start.dpadOn,'none','arena keeps the free-roam d-pad');
  assert.equal(start.view,'side','arena opens in side view');
  assert.equal(start.lock?.mode,'locked','spawn is locked to the track');
  assert(start.lock?.onTrack,'spawn should be on the track '+JSON.stringify(start.lock));
  assert.equal(start.leftOn,'none','LEFT is hidden in side view');
  assert.equal(start.rightOn,'none','RIGHT is hidden in side view');
  assert.equal(start.env?.arena,true);
  assert.equal(start.env?.midground,false);
  assert(start.env?.landmarks===true,'arena should report landmarks');
  assert.equal(start.env?.buildings,0,'Playground skyline is silhouettes only, not a city-block ring');
  assert((start.env?.skyline||0)>=16,'horizon silhouettes should sit on the horizon, n='+start.env?.skyline);
  assert((start.env?.poles||0)>=20,'light poles along the walls');


  // Off-track tests run in chase so the rail does not pull the bike back.
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1&&__WK_RIDE_STATE__().trackLock?.mode==='free',null,{timeout:8000});

  // Top speed on the flat.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:-110,z:80,yaw:0,vx:0,vy:0,pitch:0,w:0,crashed:null,ground:[true,true],air:0});s.y=ter.height(-110,80)+.45;});
  const gas=await p.locator('[data-t=throttle]').boundingBox();
  const cdp=await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:71,x:gas.x+gas.width/2,y:gas.y+gas.height/2}]});
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1,null,{timeout:3000});
  await p.waitForTimeout(4500);
  const sped=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {vx:st.s.vx,vmax:st.P.vmax,z:st.s.z||0,x:st.s.x};});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(sped.vx>8,'should get up to speed on the open square, '+JSON.stringify(sped));

  // Wheelie with tilt back + throttle.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:0,z:8,yaw:0,vx:5,vy:0,pitch:0,w:0,crashed:null,ground:[true,true],air:0,wheelieT:0});s.y=ter.height(0,8)+.45;});
  const tilt=await p.locator('.ride-dpad [data-t=leanBack]').boundingBox();
  const gas2=await p.locator('[data-t=throttle]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[
    {id:72,x:gas2.x+gas2.width/2,y:gas2.y+gas2.height/2},
    {id:73,x:tilt.x+tilt.width/2,y:tilt.y+tilt.height/2}
  ]});
  await p.waitForTimeout(700);
  const wheel=await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;return {pitch:s.pitch,t:s.wheelieT,balance:s.balance,lean:__WK_RIDE_STATE__().inp.lean};});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(wheel.lean>0.4,'tilt back should lean');
  assert(wheel.pitch>0.25||wheel.t>0.15,'wheelie should work in the arena '+JSON.stringify(wheel));

  // Burnout pivot: brake + accelerate at low speed, then steer.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:-10,z:8,yaw:0,vx:.3,vy:0,pitch:0,w:0,crashed:null,ground:[true,true],air:0});s.y=ter.height(-10,8)+.45;});
  const brake=await p.locator('[data-t=brake]').boundingBox();
  const gas3=await p.locator('[data-t=throttle]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[
    {id:74,x:gas3.x+gas3.width/2,y:gas3.y+gas3.height/2},
    {id:75,x:brake.x+brake.width/2,y:brake.y+brake.height/2}
  ]});
  await p.waitForFunction(()=>__WK_RIDE_STATE__().s.burnout,null,{timeout:4000});
  const rightBox=await p.locator('.ride-dpad [data-t=steerRight]').boundingBox();
  const right={id:76,x:rightBox.x+rightBox.width/2,y:rightBox.y+rightBox.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[
    {id:74,x:gas3.x+gas3.width/2,y:gas3.y+gas3.height/2},
    {id:75,x:brake.x+brake.width/2,y:brake.y+brake.height/2},
    right
  ]});
  await p.waitForTimeout(500);
  const piv=await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;return {burnout:s.burnout,yaw:s.yaw||0,vx:s.vx,steer:__WK_RIDE_STATE__().inp.steer};});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(piv.burnout,'burnout should stay lit');
  assert.equal(piv.steer,1,'RIGHT should be steering during the burnout');
  assert(piv.yaw>0.15,'burnout should pivot with steer '+JSON.stringify(piv));
  assert(Math.abs(piv.vx)<1.5,'bike should stay nearly in place');

  // Jump launch from the small kicker.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:24,z:0,yaw:0,vx:8,vy:0,pitch:0,w:0,crashed:null,ground:[true,true],air:0,steer:0,steerTarget:0});s.y=ter.height(24,0)+.45;});
  await p.waitForFunction(()=>{const s=__WK_RIDE_STATE__().s;return s.air>0.05||s.y>1.5||s.vy>1;},null,{timeout:4000});
  const air=await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;return {y:s.y,vy:s.vy,air:s.air,x:s.x};});

  // Soft wall.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:ter.bounds.xmax-0.4,z:0,yaw:0,vx:9,vy:0,pitch:0,w:0,crashed:null,ground:[true,true]});s.y=ter.height(s.x,0)+.45;});
  await p.waitForTimeout(300);
  const held=await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();return {x:s.x,max:ter.bounds.xmax,crashed:s.crashed};});
  assert(held.x<=held.max+0.05,'wall should hold, '+JSON.stringify(held));
  assert(!held.crashed);

  // Side view from off-track glides the bike onto the rail; no snap on the first frames.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:0,z:40,yaw:0.3,vx:4,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(0,40)+.45;__WK_SCENE_VIEW__('side');});
  const mid=await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r((()=>{const st=__WK_RIDE_STATE__();return {z:st.s.z,mode:st.trackLock?.mode,dist:st.trackLock?.dist,vx:st.s.vx,t:st.trackLock?.t,blend:st.cameraBlend};})())))));
  assert.equal(mid.mode,'whipping','return should start as a camera whip '+JSON.stringify(mid));
  assert(mid.z>20,'must not teleport on the first frames, z='+mid.z);
  assert(mid.vx>2,'forward speed is kept, vx='+mid.vx);
  await p.waitForFunction(()=>__WK_RIDE_STATE__().trackLock?.mode==='locked'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});
  const swap=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();const {cam}=__WK_RIDE_SCENE__();const h=st.trackLock?.heading||0,yaw=st.s.yaw||0;return {z:st.s.z,dist:st.trackLock?.dist,mode:st.trackLock?.mode,view:st.cameraView,camZ:cam.position.z,vx:st.s.vx,dYaw:Math.atan2(Math.sin(yaw-h),Math.cos(yaw-h)),dpadOn:getComputedStyle(document.querySelector('.ride-dpad')).display,leftOn:getComputedStyle(document.querySelector('.ride-dpad [data-t=steerLeft]')).display};});
  assert.equal(swap.view,'side');
  assert.equal(swap.mode,'locked');
  assert(swap.dist<1.2,'should finish on the track '+JSON.stringify(swap));
  assert(Math.abs(swap.dYaw)<0.25,'must face forward along the track '+JSON.stringify(swap));
  assert.notEqual(swap.dpadOn,'none');
  assert.equal(swap.leftOn,'none','LEFT stays hidden once locked');

  // Free-roam keys in chase: W/S throttle-brake, A/D steer, arrows tilt, Space hop. No page scroll.
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().trackLock?.mode==='free',null,{timeout:8000});
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:-40,z:80,yaw:0,vx:0,vy:0,pitch:0,w:0,crashed:null,ground:[true,true],air:0});s.y=ter.height(-40,80)+.45;window.scrollTo(0,0);});
  await p.keyboard.down('KeyW');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1,null,{timeout:3000});
  await p.keyboard.up('KeyW');
  await p.keyboard.down('KeyS');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.brake===1&&__WK_RIDE_STATE__().inp.throttle===0,null,{timeout:3000});
  await p.keyboard.up('KeyS');
  await p.keyboard.down('KeyA');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer===-1,null,{timeout:3000});
  await p.keyboard.up('KeyA');
  await p.keyboard.down('KeyD');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer===1,null,{timeout:3000});
  await p.keyboard.up('KeyD');
  await p.keyboard.down('ArrowUp');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.lean===-1&&__WK_RIDE_STATE__().inp.throttle===0,null,{timeout:3000});
  await p.keyboard.up('ArrowUp');
  await p.keyboard.down('ArrowDown');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.lean===1,null,{timeout:3000});
  await p.keyboard.up('ArrowDown');
  const y0=await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;Object.assign(s,{y:__WK_RIDE_STATE__().ter.height(s.x,s.z||0)+.35,vy:0,vx:3,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true]});return s.y;});
  await p.keyboard.down('Space');
  await p.waitForFunction(y=>__WK_RIDE_STATE__().s.y>y+0.05||__WK_RIDE_STATE__().s.vy>0.5||__WK_RIDE_STATE__().s.air>0,y0,{timeout:3000});
  await p.keyboard.up('Space');
  const keyGuard=await p.evaluate(()=>{
    const ev=k=>{const e=new KeyboardEvent('keydown',{key:k,cancelable:true,bubbles:true});window.dispatchEvent(e);return e.defaultPrevented;};
    const out={w:ev('w'),a:ev('a'),s:ev('s'),d:ev('d'),up:ev('ArrowUp'),scroll:window.scrollY};
    for(const k of ['w','a','s','d','ArrowUp']) window.dispatchEvent(new KeyboardEvent('keyup',{key:k,bubbles:true}));
    return out;
  });
  assert.equal(keyGuard.w&&keyGuard.a&&keyGuard.s&&keyGuard.d&&keyGuard.up,true,'WASD and arrows must not scroll the page');
  assert.equal(keyGuard.scroll,0);

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({arena:true,start,sped,wheel,piv,air,held,swap,keys:true,keyGuard}));
  await p.close();
}finally{await browser.close()}
