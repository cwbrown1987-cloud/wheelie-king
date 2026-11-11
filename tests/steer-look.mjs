// Prove LEFT/RIGHT and A/D yaw the bike mesh and change travel direction.
// Swipe/mouse looks around; HUD buttons and keys never orbit the camera; look springs back.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {wrapAngle} from '../ride-freeroam.js';

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';

function wrap(a){return wrapAngle(a)}

async function openRide(browser,track){
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(lv=>localStorage.setItem('wk-level',lv),track);
  await p.goto(base.replace(/\/?$/,'/')+'?track='+track,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_emoto'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:8000});
  return {p,errors};
}

async function settle(p){
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();s.y=ter.height(s.x,s.z||0)+.42;});
  await p.waitForTimeout(200);
}

function read(p){
  return p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const {cam}=__WK_RIDE_SCENE__();
    const dx=st.s.x-cam.position.x, dz=(st.s.z||0)-cam.position.z;
    const bearing=Math.atan2(dz,dx);
    return {
      yaw:st.s.yaw||0, meshYaw:st.visual.meshYaw, look:st.visual.lookYaw||0, pitchLook:st.visual.lookPitch||0,
      steer:st.inp.steer, roll:st.visual.roll, x:st.s.x, z:st.s.z||0, vx:st.s.vx,
      camX:cam.position.x, camY:cam.position.y, camZ:cam.position.z,
      behind:Math.atan2(Math.sin(bearing-(st.s.yaw||0)), Math.cos(bearing-(st.s.yaw||0))),
      view:st.cameraView, dist:st.trackLock?.dist, mode:st.trackLock?.mode
    };
  });
}

const browser=await launchBrowser();
try{
  const report={};
  for(const track of ['arena','sample3d']){
    const {p,errors}=await openRide(browser,track);
    const spawn=track==='arena'?{x:0,z:20}:{x:8,z:0};

    // Keys: D yaws the mesh and, once moving, sends the bike off in the new direction.
    await p.evaluate((o)=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:o.x,z:o.z,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(o.x,o.z)+.42;},spawn);
    await settle(p);
    await p.keyboard.down('KeyD');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer===1,null,{timeout:3000});
    await p.waitForTimeout(450);
    const walk=await read(p);
    const bar=await p.evaluate(()=>__WK_RIDE_STATE__().s.steer||__WK_RIDE_STATE__().visual.bar||0);
    assert(Math.abs(walk.yaw)<0.03,'A/D at a standstill must only turn the bars, not the bike '+JSON.stringify({...walk,bar}));
    assert(bar>0.3,'bars should turn when D is held at a standstill, bar='+bar);
    assert(Math.abs(wrap(walk.meshYaw-walk.yaw))<0.4,'mesh world yaw must follow heading '+JSON.stringify(walk));
    assert(Math.abs(walk.look)<0.05,'keys must never look the camera '+JSON.stringify(walk));
    await p.keyboard.down('KeyW');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().s.vx>2,null,{timeout:4000});
    await p.waitForTimeout(700);
    const travel=await read(p);
    await p.keyboard.up('KeyW');
    await p.keyboard.up('KeyD');
    assert(travel.z>spawn.z+0.4,'bike must ride off in the new heading, z='+travel.z);
    assert(travel.yaw>0.25);
    assert(Math.abs(wrap(travel.meshYaw-travel.yaw))<0.4);
    assert(Math.abs(travel.look)<0.05);
    // After a short settle, chase cam sits behind the rider (bearing ≈ heading).
    await p.waitForTimeout(500);
    const behind=await read(p);
    assert(Math.abs(behind.behind)<0.35,'chase cam should sit behind the rider, behind='+behind.behind+' '+JSON.stringify(behind));

    // Touch LEFT yaws the other way and does not start a look.
    await p.evaluate((o)=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:o.x,z:o.z,yaw:0,vx:3,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(o.x,o.z)+.42;},spawn);
    await settle(p);
    const leftBox=await p.locator('.ride-dpad [data-t=steerLeft]').boundingBox();
    const cdp=await p.context().newCDPSession(p);
    const left={id:81,x:leftBox.x+leftBox.width/2,y:leftBox.y+leftBox.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left]});
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer===-1,null,{timeout:3000});
    await p.waitForTimeout(450);
    const held=await read(p);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert(held.yaw<-0.15,'LEFT must yaw the bike '+JSON.stringify(held));
    assert(Math.abs(wrap(held.meshYaw-held.yaw))<0.4);
    assert(Math.abs(held.look)<0.05,'HUD hold must not orbit the camera');
    assert(held.roll>0.08,'bike should lean into a left turn');

    // Swipe on the empty canvas looks around without changing heading; release springs back.
    await p.evaluate((o)=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:o.x,z:o.z,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(o.x,o.z)+.42;},spawn);
    await settle(p);
    const canvas=await p.locator('canvas').first().boundingBox();
    const mid={id:82,x:canvas.x+canvas.width*0.55,y:canvas.y+canvas.height*0.4};
    const dragged={id:82,x:mid.x+160,y:mid.y};
    const yaw0=(await read(p)).yaw;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[mid]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[dragged]});
    await p.waitForFunction(()=>Math.abs(__WK_RIDE_STATE__().visual.lookYaw||0)>0.2,null,{timeout:3000});
    const peeked=await read(p);
    assert(Math.abs(peeked.look)>0.2,'a swipe on empty screen should look around '+JSON.stringify(peeked));
    assert(Math.abs(peeked.yaw-yaw0)<0.08,'a camera swipe must not steer the bike '+JSON.stringify(peeked));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.waitForFunction(()=>Math.abs(__WK_RIDE_STATE__().visual.lookYaw||0)<0.08,null,{timeout:4000});
    const sprung=await read(p);
    assert(Math.abs(sprung.look)<0.08,'look should spring back behind the rider '+JSON.stringify(sprung));
    assert(Math.abs(sprung.behind)<0.35,'camera should return behind the rider');

    // Side view: arena locks to the track (A/D do nothing). sample3d still yaws on A/D.
    await p.evaluate((o)=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:o.x,z:o.z,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(o.x,o.z)+.42;__WK_SCENE_VIEW__('side');},spawn);
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='side'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});
    await settle(p);
    const side0=await read(p);
    await p.keyboard.down('KeyA');
    let side1;
    if(track==='arena'){
      await p.waitForTimeout(400);
      side1=await read(p);
      await p.keyboard.up('KeyA');
      assert.equal(side1.steer,0,'A/D do nothing in arena side view '+JSON.stringify(side1));
      assert(Math.abs(side1.yaw-side0.yaw)<0.08,'arena side view must not yaw off the track '+JSON.stringify({side0,side1}));
      assert((side1.dist??side1.lockDist??0)<2||Math.abs(side1.z)<3,'arena side view stays on the track '+JSON.stringify(side1));
      assert(side1.camZ>side1.z+3,'side camera stays perpendicular to the track '+JSON.stringify(side1));
      assert(Math.abs(side1.look)<0.05);
    }else{
      await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();s.vx=3;s.y=ter.height(s.x,s.z||0)+.42;});
      await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer===-1,null,{timeout:3000});
      await p.waitForTimeout(600);
      side1=await read(p);
      await p.keyboard.up('KeyA');
      const bar=await p.evaluate(()=>__WK_RIDE_STATE__().s.steer||0);
      assert(side1.yaw<-0.15,'sample3d side view still steers once moving '+JSON.stringify({...side1,bar}));
      assert(Math.abs(wrap(side1.meshYaw-side1.yaw))<0.4,'side view mesh follows heading');
      assert(side1.camZ>side1.z+3,'side camera stays on the world +Z side '+JSON.stringify(side1));
      assert(Math.abs(side1.camZ-side0.camZ)<2.5,'side camera must not orbit around the bike '+JSON.stringify({side0,side1}));
      assert(Math.abs(side1.look)<0.05);
    }

    assert.deepEqual(errors,[]);
    report[track]={walk,travel,held,peeked,sprung,side1};
    await p.close();
  }
  console.log(JSON.stringify({steerLook:true,...report}));
}finally{await browser.close()}
