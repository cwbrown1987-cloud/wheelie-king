// v32e: world-locked ground, burnout creep + donut, tight follow shadows.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {makeArenaTerrain,bikeParams,makeState,step} from '../ride-physics.js';
import {STEER_BURNOUT} from '../ride-freeroam.js';

const ter=makeArenaTerrain();
const P=bikeParams({P:4000,kg:40,driveAxle:'rear',powertrain:'electric',batteryWh:1000,wb:1.34,wheelR:.33,comH:.9,comBack:.42});

// Burnout creep: brake+throttle holds a slow forward speed, not a dead stop.
const creep=makeState(P,0,ter);creep.vx=0;creep.ground=[true,true];
for(let i=0;i<90;i++)step(creep,P,{throttle:1,brake:1,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
assert(creep.burnout,'brake+throttle should light a burnout');
assert(creep.vx>0.3&&creep.vx<0.6,'burnout should creep at 0.3–0.6 m/s, vx='+creep.vx);
assert(Math.abs(creep.slip[0])>1.5,'rear should still spin vs ground, slip='+creep.slip[0]);

// Without the brake, no burnout slide.
const grip=makeState(P,0,ter);grip.vx=2;grip.yaw=0;grip.z=0;grip.ground=[true,true];
const z0=grip.z,y0=grip.yaw;
for(let i=0;i<30;i++)step(grip,P,{throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
assert(!grip.burnout,'no burnout without the brake');
assert(Math.abs(grip.z-z0)<1e-4&&Math.abs((grip.yaw||0)-y0)<1e-4,'no sideways slide off the brake, z='+grip.z+' yaw='+grip.yaw);

// Donut: front axle is the pivot, rear swings around it at ~wheelbase radius.
const donut=makeState(P,0,ter);donut.vx=.4;donut.x=0;donut.z=0;donut.yaw=0;donut.ground=[true,true];
for(let i=0;i<30;i++)step(donut,P,{throttle:1,brake:1,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
const front0=P.wb*(1-P.comBack);
const fx0=donut.x+Math.cos(donut.yaw||0)*front0,fz0=(donut.z||0)+Math.sin(donut.yaw||0)*front0;
const yawB=donut.yaw||0;
const rearSamples=[];
for(let i=0;i<180;i++){
  step(donut,P,{throttle:1,brake:1,lean:0,hop:0,trick:0,whip:0,steer:1},1/60,ter);
  const yaw=donut.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw);
  const fx=donut.x+c*front0,fz=(donut.z||0)+n*front0;
  const rx=donut.x+c*(-P.wb*P.comBack),rz=(donut.z||0)+n*(-P.wb*P.comBack);
  rearSamples.push({r:Math.hypot(rx-fx,rz-fz),frontMove:Math.hypot(fx-fx0,fz-fz0),yaw});
}
const dYaw=(donut.yaw||0)-yawB;
assert(dYaw>0.8,'donut should swing the rear, dYaw='+dYaw);
assert(dYaw<STEER_BURNOUT*3.2,'donut should not snap-spin, dYaw='+dYaw);
const meanR=rearSamples.reduce((s,p)=>s+p.r,0)/rearSamples.length;
assert(Math.abs(meanR-P.wb)<0.08,'donut radius should match wheelbase, R='+meanR+' wb='+P.wb);
// Front creeps but must not orbit a wide circle like the rear.
const frontMove=rearSamples[rearSamples.length-1].frontMove;
const rearTravel=Math.hypot(
  (donut.x+Math.cos(donut.yaw||0)*(-P.wb*P.comBack))- (0+1*(-P.wb*P.comBack)),
  ((donut.z||0)+Math.sin(donut.yaw||0)*(-P.wb*P.comBack))
);
assert(frontMove<creep.vx*4+0.5,'front should creep, not orbit, frontMove='+frontMove+' creep='+creep.vx);

const unit={creep:creep.vx,slip:creep.slip[0],donutR:meanR,dYaw,frontMove};

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

  const env=await p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    let floor=null;
    __WK_RIDE_SCENE__().scene.traverse(o=>{if(o.name==='environment:arena-floor')floor={x:o.position.x,y:o.position.y,z:o.position.z,ox:o.material?.map?.offset?.x,oy:o.material?.map?.offset?.y};});
    return {ground:st.environment?.ground,uvWorld:st.environment?.uvWorld,floor:st.environment?.floor,grassOffset:st.environment?.grassOffset,worldSky:st.quality?.worldSky,shadows:st.quality?.shadows,mesh:floor};
  });
  assert.equal(env.ground,'grass-dirt');
  assert(env.uvWorld,'floor UVs should be world-locked');
  assert.equal(env.floor?.x,0);assert.equal(env.floor?.z,0);
  assert.equal(env.grassOffset?.[0],0);assert.equal(env.grassOffset?.[1],0);
  assert.equal(env.mesh?.ox,0);assert.equal(env.mesh?.oy,0);
  assert(env.worldSky,'arena should use a world-fixed sky cylinder');

  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:15000});

  // FPS before/after shadows, then world-lock pixel check with the camera held.
  const fps=await p.evaluate(async()=>{
    const {renderer,scene}=__WK_RIDE_SCENE__();
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const measure=async()=>{
      const t0=performance.now();
      let n=0,last=__WK_RIDE_STATE__().quality.fps;
      while(performance.now()-t0<1800){await wait(80);n++;last=__WK_RIDE_STATE__().quality.fps||last;}
      return last;
    };
    renderer.shadowMap.enabled=false;
    scene.traverse(o=>{if(o.material)for(const m of [].concat(o.material))m.needsUpdate=true});
    await wait(400);
    const before=await measure();
    renderer.shadowMap.enabled=true;
    scene.traverse(o=>{if(o.material)for(const m of [].concat(o.material))m.needsUpdate=true});
    await wait(400);
    const after=await measure();
    return {before,after,shadows:__WK_RIDE_STATE__().quality.shadows};
  });
  assert(fps.after>20,'shadows should stay playable, fps='+JSON.stringify(fps));
  assert(fps.shadows,'sun shadows should be on after the after-pass');

  // Hold the camera and the bike: ground / sky / props must not crawl.
  await p.evaluate(()=>{
    const {s,ter,P}=__WK_RIDE_STATE__();
    Object.assign(s,{x:-70,z:8,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true],steer:0,thr:0});
    s.y=ter.height(-70,8)+(P.comH||.9);
    globalThis.__WK_CAM_HOLD__=false;
  });
  await p.waitForTimeout(700);
  const lock=await p.evaluate(async()=>{
    const {cam,renderer}=__WK_RIDE_SCENE__();
    const hold={x:cam.position.x,y:cam.position.y,z:cam.position.z};
    globalThis.__WK_CAM_HOLD__=true;
    cam.position.set(hold.x,hold.y,hold.z);
    const grab=()=>{
      const st=__WK_RIDE_STATE__();
      let sky=null,cone=null,floor=null;
      __WK_RIDE_SCENE__().scene.traverse(o=>{
        if(o.name==='wk:world-sky')sky={x:o.position.x,y:o.position.y,z:o.position.z};
        if(!cone&&o.name&&/cone/.test(o.name))cone={x:o.position.x,y:o.position.y,z:o.position.z};
        if(o.name==='environment:arena-floor')floor={x:o.position.x,z:o.position.z,ox:o.material?.map?.offset?.x||0,oy:o.material?.map?.offset?.y||0};
      });
      const c=renderer.domElement,g=c.getContext('webgl2')||c.getContext('webgl');
      // Sample a mid-ground strip in front of the HUD buttons (avoid the bike).
      const x=Math.floor(c.width*.62),y=Math.floor(c.height*.58),w=16,h=16;
      const buf=new Uint8Array(w*h*4);
      g.readPixels(x,c.height-y-h,w,h,g.RGBA,g.UNSIGNED_BYTE,buf);
      let hash=0;for(let i=0;i<buf.length;i++)hash=(hash*33+buf[i])>>>0;
      return {sky,cone,floor,hash,grass:st.environment.grassOffset,cam:{x:cam.position.x,y:cam.position.y,z:cam.position.z}};
    };
    const a=grab();
    await new Promise(r=>setTimeout(r,400));
    const b=grab();
    globalThis.__WK_CAM_HOLD__=false;
    return {a,b,sameHash:a.hash===b.hash};
  });
  assert.deepEqual(lock.a.floor,lock.b.floor,'floor mesh / UV offset must not move');
  assert.deepEqual(lock.a.grass,lock.b.grass,'grass texture offset must stay at 0');
  assert.deepEqual(lock.a.sky,lock.b.sky,'world sky must stay fixed');
  assert.deepEqual(lock.a.cone,lock.b.cone,'props must stay put');
  assert(lock.sameHash,'held-camera ground pixels must not shift between frames, '+JSON.stringify({a:lock.a.hash,b:lock.b.hash}));

  // Live burnout creep + donut marks under the rear axle.
  await p.evaluate(()=>{const {s,ter,P}=__WK_RIDE_STATE__();Object.assign(s,{x:-70,z:8,yaw:0,vx:.3,vy:0,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true],steer:0});s.y=ter.height(-70,8)+(P.comH||.9);});
  await p.keyboard.down('KeyW');await p.keyboard.down('KeyS');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().s.burnout,null,{timeout:4000});
  await p.waitForTimeout(500);
  const liveCreep=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {vx:st.s.vx,burnout:!!st.s.burnout,slip:st.visual.slip,smoke:st.visual.smoke,skid:st.environment.skid};});
  assert(liveCreep.burnout&&liveCreep.vx>0.25&&liveCreep.vx<0.7,'live creep '+JSON.stringify(liveCreep));
  assert(liveCreep.smoke>8,'smoke should still spawn at the rear patch');
  if(liveCreep.skid){
    const st=await p.evaluate(()=>{const st=__WK_RIDE_STATE__(),P=st.P,s=st.s,yaw=s.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw),rear=-P.wb*P.comBack;return {axle:{x:s.x+c*rear,z:(s.z||0)+n*rear},skid:st.environment.skid,wb:P.wb};});
    const d=Math.hypot(st.skid.x-st.axle.x,st.skid.z-st.axle.z);
    assert(d<0.2,'tyre mark must sit under the rear axle, d='+d);
    assert(Math.abs((st.skid.width||0)-0.1)<0.02,'tyre mark width should be ~0.1 m, '+st.skid.width);
  }
  await p.keyboard.down('ArrowRight');
  await p.waitForTimeout(1200);
  const liveDonut=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {yaw:st.s.yaw||0,vx:st.s.vx,burnout:!!st.s.burnout,bar:st.visual.bar,steer:st.s.steer};});
  await p.keyboard.up('ArrowRight');await p.keyboard.up('KeyW');await p.keyboard.up('KeyS');
  assert(liveDonut.burnout&&Math.abs(liveDonut.yaw)>0.3,'live donut should swing the rear, '+JSON.stringify(liveDonut));

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({v32e:true,unit,fps,env:{uvWorld:env.uvWorld,worldSky:env.worldSky,shadows:env.shadows},liveCreep,liveDonut,lock:{sameHash:lock.sameHash}}));
  await p.close();
}finally{await browser.close()}
