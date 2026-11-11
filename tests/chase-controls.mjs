// Chase-cam HUD: throttle, brake, hop, air tilt, spring-back steer. SAMPLE 3D keeps this HUD in both views.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

const shots=process.env.WK_V27_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';

async function openRide(browser,{width,height,track}){
  const p=await browser.newPage(pageOptions({viewport:{width,height},hasTouch:true,isMobile:width<=900,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const url=track?base.replace(/\/?$/,'/')+'?track='+track:base;
  await p.addInitScript(lv=>localStorage.setItem('wk-level',lv), track||'trials');
  await p.goto(url,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});
  return {p,errors};
}

async function waitChase(p){
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1&&document.querySelector('[data-wk-ride-surface]')?.dataset.wkCam==='chase',null,{timeout:8000});
}

function hud(p){
  return p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const cs=n=>getComputedStyle(document.querySelector(n));
    const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,display:getComputedStyle(e).display};};
    return {
      view:st.cameraView,cam:document.querySelector('[data-wk-ride-surface]')?.dataset.wkCam,
      steerDisplay:cs('.ride-steer').display,leanGlyph:cs('.ride-lean-glyph').fontSize,
      tiltCopy:cs('.ride-tilt-copy').display,driveLabel:cs('.ride-drive-label').display,
      hop:box('[data-t=hop]'),throttle:box('[data-t=throttle]'),brake:box('[data-t=brake]'),
      leanBack:box('[data-t=leanBack]'),steer:box('.ride-steer-pill'),
      rewindHidden:!!document.querySelector('[data-r=rewind]')?.hidden,
      tricks:!!document.querySelector('.ride-tricks-toggle'),
      inp:{...st.inp},vx:st.s.vx,x:st.s.x,y:st.s.y,pitch:st.s.pitch,w:st.s.w,
      visual:st.visual,crashed:!!st.s.crashed
    };
  });
}

async function hold(p,selector,ms){
  const box=await p.locator(selector).boundingBox();
  assert(box,selector+' missing');
  const cdp=await p.context().newCDPSession(p);
  const pt={id:31,x:box.x+box.width/2,y:box.y+box.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});
  await p.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  return cdp;
}

const browser=await launchBrowser();
try{
  const report={};

  // --- Phone: SAMPLE 3D, side unchanged, then chase behaviour + shots ---
  {
    const {p,errors}=await openRide(browser,{width:844,height:390,track:'sample3d'});
    const side=await hud(p);
    assert.equal(side.view,'side');
    assert.notEqual(side.steerDisplay,'none','sample3d keeps the steer HUD in side view');
    assert.notEqual(side.tiltCopy,'none','sample3d keeps tilt labels in side view');
    assert.notEqual(side.driveLabel,'none');
    assert(side.hop.x>500,'sample3d hop stays on the right in both views');
    assert(side.throttle.x>400,'side throttle stays on the right');
    assert(side.steer.y>side.leanBack.y,'slider sits below the tilt stack');
    assert(side.rewindHidden,'rewind stays hidden until a crash');
    if(shots)await p.screenshot({path:join(shots,'side-phone.png')});

    await p.locator('[data-r=view]').tap();
    await waitChase(p);
    const chase=await hud(p);
    assert.equal(chase.view,'chase');
    assert.notEqual(chase.steerDisplay,'none','steer visible in chase');
    assert.notEqual(chase.tiltCopy,'none','tilt labels visible in chase');
    assert.notEqual(chase.driveLabel,'none');
    assert(chase.hop.x>500,'chase hop moves to the right');
    assert(chase.throttle.x>500);
    assert(chase.brake.x>400);
    assert(chase.leanBack.x<200,'tilt stays on the left edge');
    assert(chase.steer.y>chase.leanBack.y,'slider sits below the tilt stack');
    assert(chase.rewindHidden);
    if(shots)await p.screenshot({path:join(shots,'chase-phone.png')});

    // Accelerate moves the bike
    await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;s.vx=0;s.crashed=null;});
    const cdp=await p.context().newCDPSession(p);
    const gas=await p.locator('[data-t=throttle]').boundingBox();
    const gasPt={id:11,x:gas.x+gas.width/2,y:gas.y+gas.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[gasPt]});
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1,null,{timeout:3000});
    const vx0=await p.evaluate(()=>__WK_RIDE_STATE__().s.vx);
    await p.waitForTimeout(500);
    const vx1=await p.evaluate(()=>__WK_RIDE_STATE__().s.vx);
    assert(vx1>vx0+0.4,`accelerate should raise speed ${vx0} -> ${vx1}`);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===0);

    // Brake slows it
    await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;s.vx=7;s.crashed=null;s.ground=[true,true];});
    const brake=await p.locator('[data-t=brake]').boundingBox();
    const brakePt={id:12,x:brake.x+brake.width/2,y:brake.y+brake.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[brakePt]});
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.brake===1,null,{timeout:3000});
    await p.waitForTimeout(400);
    const vxB=await p.evaluate(()=>__WK_RIDE_STATE__().s.vx);
    assert(vxB<6.2,`brake should slow the bike, vx=${vxB}`);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});

    // Hop
    await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;Object.assign(s,{y:__WK_RIDE_STATE__().ter.h(s.x)+.35,vy:0,vx:3,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true]});});
    const y0=await p.evaluate(()=>__WK_RIDE_STATE__().s.y);
    await p.locator('[data-t=hop]').tap();
    await p.waitForFunction(y=>__WK_RIDE_STATE__().s.y>y+0.05||__WK_RIDE_STATE__().s.vy>0.5||__WK_RIDE_STATE__().s.air>0,y0,{timeout:3000});

    // Tilt back in the air changes pitch (nose up)
    await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;Object.assign(s,{y:6,vy:1,vx:4,pitch:0,w:0,air:.3,wasAir:true,crashed:null,ground:[false,false]});});
    const tilt=await p.getByRole('button',{name:'Lean back',exact:true}).boundingBox();
    const tiltPt={id:13,x:tilt.x+tilt.width/2,y:tilt.y+tilt.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tiltPt]});
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.lean===1,null,{timeout:3000});
    await p.waitForTimeout(350);
    const air=await p.evaluate(()=>({pitch:__WK_RIDE_STATE__().s.pitch,w:__WK_RIDE_STATE__().s.w,lean:__WK_RIDE_STATE__().inp.lean}));
    assert.equal(air.lean,1);
    assert(air.pitch>0.15||air.w>1,`tilt back should raise the nose in the air ${JSON.stringify(air)}`);
    if(shots)await p.screenshot({path:join(shots,'chase-phone-air-tilt.png')});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});

    const hint=await p.locator('.ride-steer-hint').textContent();
    assert.match(hint||'',/STEER/,'slider should be labelled as steer');

    // Whole bike+rider in frame, lower-middle on flat, chase FOV near 60 at low speed
    await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:16,vx:3,vy:0,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true]});s.y=ter.h(16)+.42;});
    await p.waitForTimeout(320);
    const frame=await p.evaluate(async()=>{
      const T=await import('/vendor/three.module.js');
      const {scene,cam}=__WK_RIDE_SCENE__();
      cam.updateMatrixWorld();
      const rider=scene.getObjectByName('wk:rider');
      const root=rider?.parent?.parent||rider;
      const box=new T.Box3().setFromObject(root);
      const c=box.getCenter(new T.Vector3()).project(cam);
      const corners=[];
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new T.Vector3(x,y,z).project(cam));
      const ys=corners.map(v=>v.y),xs=corners.map(v=>v.x);
      return {minY:Math.min(...ys),maxY:Math.max(...ys),midY:c.y,inX:xs.every(x=>x>-1&&x<1),inY:ys.every(y=>y>-1&&y<1),fov:__WK_RIDE_STATE__().chaseCam.fov};
    });
    assert(frame.inX&&frame.inY,'bike+rider should be fully in frame '+JSON.stringify(frame));
    assert(frame.midY<0.1,'bike should sit in the lower half of the chase frame '+JSON.stringify(frame));
    assert(frame.fov>=59&&frame.fov<=64,'low-speed chase FOV should be about 60, got '+frame.fov);

    // Slider is STEER: left is negative heading input, does not change wheelie lean, springs back
    await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;Object.assign(s,{y:6,vy:1,vx:4,pitch:0,w:0,air:.3,wasAir:true,crashed:null,ground:[false,false]});});
    const pill=await p.locator('.ride-steer-pill').boundingBox();
    assert(pill);
    const mid={id:14,x:pill.x+pill.width*0.5,y:pill.y+pill.height/2};
    const left={id:14,x:pill.x+pill.width*0.08,y:pill.y+pill.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[mid]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[left]});
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer<-0.4,null,{timeout:3000});
    await p.waitForTimeout(200);
    const slid=await p.evaluate(()=>({lean:__WK_RIDE_STATE__().inp.lean,pitch:__WK_RIDE_STATE__().s.pitch,w:__WK_RIDE_STATE__().s.w,roll:__WK_RIDE_STATE__().visual.roll,slider:__WK_RIDE_STATE__().visual.steer,steer:__WK_RIDE_STATE__().inp.steer}));
    assert(slid.steer<-0.4,'left on the slider should steer left '+JSON.stringify(slid));
    assert(Math.abs(slid.lean)<0.15,'slider must not steal tilt/lean '+JSON.stringify(slid));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.waitForFunction(()=>Math.abs(__WK_RIDE_STATE__().inp.steer)<0.05&&Math.abs(__WK_RIDE_STATE__().visual.steer)<0.05,null,{timeout:3000});
    const sprung=await p.evaluate(()=>({steer:__WK_RIDE_STATE__().inp.steer,slider:__WK_RIDE_STATE__().visual.steer,lean:__WK_RIDE_STATE__().inp.lean}));
    report.phone={accelerate:true,brake:true,hop:true,airTilt:air,sliderSteer:slid,sprung,frame,errors};

    // View swap back to side keeps the same HUD (camera swap only) on sample3d
    await p.locator('[data-r=view]').tap();
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='side'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});
    const back=await hud(p);
    assert.notEqual(back.steerDisplay,'none','sample3d side view keeps the steer slider');
    assert.notEqual(back.tiltCopy,'none');
    assert(back.hop.x>500,'hop stays on the right in sample3d side view');
    const sideFov=await p.evaluate(()=>__WK_RIDE_SCENE__().cam.fov);
    assert(sideFov>=40&&sideFov<=58,'sample3d side follow FOV should stay mid, got '+sideFov);
    assert.deepEqual(errors,[]);
    await p.close();
  }

  // --- Tablet chase shot + throttle + swap ---
  {
    const {p,errors}=await openRide(browser,{width:1024,height:658,track:'sample3d'});
    await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
    await waitChase(p);
    const chase=await hud(p);
    assert.notEqual(chase.steerDisplay,'none');
    assert(chase.hop.x>600,'tablet hop on the right');
    await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;s.vx=0;});
    const gas=await p.locator('[data-t=throttle]').boundingBox();
    const cdp=await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:21,x:gas.x+gas.width/2,y:gas.y+gas.height/2}]});
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1);
    await p.waitForTimeout(400);
    const vx=await p.evaluate(()=>__WK_RIDE_STATE__().s.vx);
    assert(vx>0.3,`tablet throttle vx=${vx}`);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    if(shots)await p.screenshot({path:join(shots,'chase-tablet.png')});
    assert.deepEqual(errors,[]);
    report.tablet={throttle:vx,hopX:chase.hop.x};
    await p.close();
  }

  // --- Trials (non-sample) also gets the chase HUD ---
  {
    const {p,errors}=await openRide(browser,{width:844,height:390,track:null});
    const side=await hud(p);
    assert.equal(side.steerDisplay,'none');
    await p.locator('[data-r=view]').tap();
    await waitChase(p);
    const chase=await hud(p);
    assert.notEqual(chase.steerDisplay,'none','chase HUD must apply on Trials too');
    assert(chase.hop.x>500);
    assert.deepEqual(errors,[]);
    report.trials={chaseHud:true};
    await p.close();
  }

  console.log(JSON.stringify({chaseControls:true,...report}));
}finally{await browser.close()}
