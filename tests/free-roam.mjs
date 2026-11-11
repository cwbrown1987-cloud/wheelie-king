// SAMPLE 3D free-roam: heading + (x,z), speed-scaled steer, bounds, rewind, side camera swap.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {bikeParams,makeState,step,makeSampleTerrain,makeFlatTerrain} from '../ride-physics.js';
import {stepHeading,collideFreeRoam} from '../ride-freeroam.js';

const sample=makeSampleTerrain(),flat=makeFlatTerrain(),P=bikeParams({powertrain:'human'});
assert.equal(sample.freeRoam,true);
assert(Math.abs(sample.height(8,0)-sample.h(8))<1e-9,'height(x,0) matches the 1D profile');
assert(sample.height(56,0)>0.8,'kicker still on the street');
assert(sample.height(56,8)<0.05,'kicker does not extend into the dirt');
assert(sample.height(108,-6.8)>0.4,'dirt mound is rideable');

function run(ter,x,seconds=1,inpExtra={}){
  const s=makeState(P,x,ter);
  const inp={throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0,...inpExtra};
  for(let i=0;i<Math.round(seconds*60);i++)step(s,P,inp,1/60,ter);
  return s;
}
const onRoad=run(sample,8,1),onFlat=run(flat,8,1);
assert(Math.abs(onRoad.vx-onFlat.vx)<0.15,'forward speed on the road is unchanged');
assert(Math.abs(onRoad.x-onFlat.x)<0.2,'forward travel on the road is unchanged');
assert(Math.abs(onRoad.z||0)<1e-6,'yaw 0 stays on z=0');

const still=makeState(P,8,sample);still.vx=0;still.ground=[true,true];
stepHeading(still,{steer:1},1/30);
assert((still.yaw||0)>0.02,'walking-pace pivot at a standstill, yaw='+(still.yaw||0));

const roll=makeState(P,8,sample);roll.vx=3;const yaw0=roll.yaw||0;
stepHeading(roll,{steer:1},1/30);
assert((roll.yaw||0)>yaw0,'moving bike turns with steer');

const wall=makeState(P,4,sample);wall.z=-8.5;wall.yaw=Math.PI/2;wall.vx=4;
collideFreeRoam(wall,P,sample);
assert(Math.abs(wall.z+8.5)>0.2||wall.x!==4,'building push-out moves the bike '+JSON.stringify({x:wall.x,z:wall.z,vx:wall.vx}));
assert(!wall.crashed,'walls do not crash the bike');

const edge=makeState(P,8,sample);edge.z=-40;edge.vx=2;
collideFreeRoam(edge,P,sample);
assert(edge.z>=sample.bounds.zmin-1e-6,'world bound clamps z');

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const browser=await launchBrowser();
try{
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base.replace(/\/?$/,'/')+'?track=sample3d',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});

  // RIGHT yaws the bike itself, even at a walking pace; it does not orbit the camera.
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:8,vx:0,vy:0,yaw:0,z:0,pitch:0,w:0,crashed:null,ground:[true,true]});s.y=ter.height(8,0)+.42;});
  const rightBox=await p.locator('.ride-dpad [data-t=steerRight]').boundingBox();
  assert(rightBox,'steer RIGHT missing');
  const cdp=await p.context().newCDPSession(p);
  const right={id:41,x:rightBox.x+rightBox.width/2,y:rightBox.y+rightBox.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[right]});
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer===1,null,{timeout:3000});
  await p.waitForTimeout(400);
  const stopped=await p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    return {yaw:st.s.yaw||0,meshYaw:st.visual.meshYaw,steer:st.inp.steer,z:st.s.z||0,look:st.visual.lookYaw||0,roll:st.visual.roll};
  });
  assert.equal(stopped.steer,1);
  assert(stopped.yaw>0.15,'walking-pace steer must yaw the bike '+JSON.stringify(stopped));
  assert(Math.abs(stopped.meshYaw-stopped.yaw)<0.35,'bike mesh must follow heading '+JSON.stringify(stopped));
  assert(Math.abs(stopped.look)<0.05,'a HUD hold must not start a camera look '+JSON.stringify(stopped));
  assert(stopped.roll< -0.05,'bike should lean into the turn');

  await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;s.vx=4;s.yaw=0;s.z=0;});
  await p.waitForTimeout(400);
  const turning=await p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    return {yaw:st.s.yaw||0,z:st.s.z||0,steer:st.inp.steer,roll:st.visual.roll,meshYaw:st.visual.meshYaw,look:st.visual.lookYaw||0};
  });
  assert(turning.yaw>0.08,'RIGHT should yaw the bike while moving '+JSON.stringify(turning));
  assert(turning.z>0.05,'heading should take the bike off the centreline');
  assert(Math.abs(turning.meshYaw-turning.yaw)<0.35,'moving mesh must follow heading');
  assert(Math.abs(turning.look)<0.05,'steer must not orbit the camera');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});

  // Buildings / world bounds are a soft stop, no crash.
  const bump=await p.evaluate(()=>{
    const {s,P,ter}=__WK_RIDE_STATE__();
    Object.assign(s,{x:14,z:-9.2,yaw:Math.PI/2,vx:5,vy:0,crashed:null,pitch:0,w:0,ground:[true,true]});
    const z0=s.z;
    return {z0,z:s.z,vx:s.vx,crashed:s.crashed,boxes:ter.boxes.length};
  });
  await p.waitForTimeout(300);
  const afterBump=await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;return {z:s.z,x:s.x,vx:s.vx,crashed:s.crashed};});
  assert(!afterBump.crashed,'building hit must not crash '+JSON.stringify(afterBump));
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:10,z:ter.bounds.zmin-8,yaw:0,vx:3,crashed:null});});
  await p.waitForTimeout(200);
  const bound=await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();return {z:s.z,min:ter.bounds.zmin,crashed:s.crashed};});
  assert(bound.z>=bound.min-0.01,'world bound should clamp '+JSON.stringify(bound));
  assert(!bound.crashed);

  // Rewind restores z + yaw.
  await p.evaluate(()=>{
    const {s}=__WK_RIDE_STATE__();
    Object.assign(s,{x:20,y:1,z:-4.5,yaw:0.7,vx:0,vy:0,pitch:0,w:0,crashed:null,ground:[true,true]});
  });
  await p.waitForTimeout(800);
  const before=await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;return {x:s.x,z:s.z,yaw:s.yaw,len:__WK_RIDE_STATE__().bufferLength};});
  assert(Math.abs(before.z+4.5)<0.3&&Math.abs(before.yaw-0.7)<0.05,'pose should hold still for the buffer '+JSON.stringify(before));
  await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;Object.assign(s,{z:8,yaw:-1.1,x:40});});
  const midPose=await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;return {z:s.z,yaw:s.yaw};});
  assert(Math.abs(midPose.z-8)<0.2);
  await p.evaluate(()=>{__WK_RIDE_STATE__().s.crashed='test impact';});
  await p.waitForFunction(()=>__WK_RIDE_STATE__().crash&&!document.querySelector('[data-r="rewind"]')?.hidden,null,{timeout:8000});
  await p.evaluate(()=>{
    const b=document.querySelector('[data-r="rewind"]');
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7,pointerType:'touch'}));
  });
  await p.waitForFunction(()=>__WK_RIDE_STATE__().rewinding===true,null,{timeout:4000});
  // Hold briefly so we stay inside the just-recorded z/yaw block, not all the way back to spawn.
  await p.waitForTimeout(250);
  const rew=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {z:st.s.z,yaw:st.s.yaw,x:st.s.x,rewinding:st.rewinding};});
  await p.evaluate(()=>{
    const b=document.querySelector('[data-r="rewind"]');
    b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7,pointerType:'touch'}));
  });
  assert(Math.abs(rew.z+4.5)<0.6,'rewind should restore z, got '+JSON.stringify({before,rew}));
  assert(Math.abs(rew.yaw-0.7)<0.25,'rewind should restore heading, got '+JSON.stringify({before,rew}));

  // Side view is a camera swap of the same world (bike still has z, camera is off to the side).
  await p.evaluate(()=>{
    const s=__WK_RIDE_STATE__().s;
    Object.assign(s,{crashed:null,x:16,z:5,yaw:0.4,vx:0,vy:0,pitch:0,w:0,ground:[true,true]});
    s.y=__WK_RIDE_STATE__().ter.height(s.x,s.z)+.42;
    __WK_SCENE_VIEW__('side');
  });
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='side'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});
  await p.waitForTimeout(200);
  const swap=await p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const {cam}=__WK_RIDE_SCENE__();
    return {z:st.s.z,yaw:st.s.yaw,view:st.cameraView,camZ:cam.position.z,camX:cam.position.x,fov:cam.fov,dpadOn:getComputedStyle(document.querySelector('.ride-dpad')).display,pivotZ:st.visual.z};
  });
  assert.equal(swap.view,'side');
  assert(Math.abs(swap.z-5)<0.8,'side view must not reset world z '+JSON.stringify(swap));
  assert(Math.abs(swap.pivotZ-swap.z)<0.2,'pivot follows z in side view '+JSON.stringify(swap));
  assert(Math.abs(swap.camZ-swap.z)>2,'side camera sits off to the side of the bike');
  assert.notEqual(swap.dpadOn,'none','d-pad stays up in sample3d side view');

  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:8000});
  const chase=await p.evaluate(()=>{const {cam}=__WK_RIDE_SCENE__();const st=__WK_RIDE_STATE__();return {fov:cam.fov,z:st.s.z,radius:st.chaseCam.radius};});
  assert(chase.fov>=59,'chase FOV stays around 60 at low speed, got '+chase.fov);
  assert(chase.radius>=4.3&&chase.radius<=6.2,'chase radius should be the halfway distance, got '+chase.radius);

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({freeRoam:true,stopped,turning,afterBump,bound,before,rew,swap,chase}));
  await p.close();
}finally{await browser.close()}
