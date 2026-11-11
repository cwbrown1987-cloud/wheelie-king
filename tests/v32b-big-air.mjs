// v32b: taller kickers with landing ramps, jump-framing camera, scale audit.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {makeArenaTerrain,rampLength,rampLipX,rampHeightAt,bikeParams,makeState,step} from '../ride-physics.js';

const ter=makeArenaTerrain();
assert.equal(ter.track.width,6,'track width should be ~6 m, got '+ter.track.width);
const motor=bikeParams({P:4000,kg:40,driveAxle:'rear',powertrain:'electric',batteryWh:1000,wb:1.34,wheelR:.33,comH:.9});

function apex(name,vx=14){
  const r=ter.ramps.find(x=>x.name===name);
  const yaw=r.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw),back=8;
  const s=makeState(motor,r.x-c*back,ter);
  Object.assign(s,{x:r.x-c*back,z:r.z-n*back,yaw,vx,vy:0,pitch:0,w:0,air:0,ground:[true,true],steer:0});
  s.y=ter.height(s.x,s.z)+.5;
  let maxY=s.y;
  for(let i=0;i<260;i++){
    step(s,motor,{throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
    s.yaw=yaw;
    maxY=Math.max(maxY,s.y);
  }
  return {name,lip:rampHeightAt(r,rampLipX(r)),len:rampLength(r),maxY};
}

const small=apex('small',14),medium=apex('medium',14),large14=apex('large',14),large16=apex('large',16);
assert(small.maxY>2.2&&small.maxY<4.4,'small apex should be roughly 2.5 m, '+JSON.stringify(small));
assert(medium.maxY>3.4&&medium.maxY<5.6,'medium apex should be roughly 4 m, '+JSON.stringify(medium));
assert(Math.max(large14.maxY,large16.maxY)>=6,'large apex should be 6+ m at a typical approach, '+JSON.stringify({large14,large16}));

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

  async function peakInView(view){
    if(await p.locator('[data-r=recover]').isVisible().catch(()=>false)){
      await p.locator('[data-r=recover]').click();
      await p.waitForFunction(()=>!__WK_RIDE_STATE__().s.crashed,null,{timeout:8000});
    }
    // Park on the +X straight, grounded, so a side-view switch is not held for landing/return.
    await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:90,z:0,yaw:0,vx:8,vy:0,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true],steer:0,stunt:null,spinV:0,whip:0});s.y=ter.height(90,0)+.5;});
    if(view==='chase'){
      await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
      await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:15000});
    }else{
      await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
      await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='side'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:15000});
    }
    const result=await p.evaluate(async()=>{
      const T=await import('/vendor/three.module.js');
      const {s,ter,P}=__WK_RIDE_STATE__();
      const r=ter.ramps.find(x=>x.name==='large');
      const yaw=r.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw);
      Object.assign(s,{x:r.x-c*10,z:r.z-n*10,yaw,vx:16,vy:0,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true],steer:0,stunt:null,spinV:0,whip:0});
      s.y=ter.height(s.x,s.z)+.5;
      return new Promise(resolve=>{
        let maxY=-1,best=null,frames=0;
        const tick=()=>{
          frames++;
          const st=__WK_RIDE_STATE__();
          const {cam,pivot,body}=__WK_RIDE_SCENE__();
          cam.updateMatrixWorld(true);pivot.updateMatrixWorld(true);
          const box=new T.Box3().setFromObject(pivot);
          const corners=[
            new T.Vector3(box.min.x,box.min.y,box.min.z),
            new T.Vector3(box.min.x,box.min.y,box.max.z),
            new T.Vector3(box.min.x,box.max.y,box.min.z),
            new T.Vector3(box.min.x,box.max.y,box.max.z),
            new T.Vector3(box.max.x,box.min.y,box.min.z),
            new T.Vector3(box.max.x,box.min.y,box.max.z),
            new T.Vector3(box.max.x,box.max.y,box.min.z),
            new T.Vector3(box.max.x,box.max.y,box.max.z)
          ].map(v=>v.project(cam));
          const ndc={
            minX:Math.min(...corners.map(v=>v.x)),maxX:Math.max(...corners.map(v=>v.x)),
            minY:Math.min(...corners.map(v=>v.y)),maxY:Math.max(...corners.map(v=>v.y))
          };
          const inside=ndc.minX>=-1&&ndc.maxX<=1&&ndc.minY>=-1&&ndc.maxY<=1;
          const finite=Number.isFinite(ndc.minX)&&Number.isFinite(ndc.maxX)&&Number.isFinite(ndc.minY)&&Number.isFinite(ndc.maxY);
          if(finite && st.s.y>maxY){maxY=st.s.y;best={y:st.s.y,air:st.s.air,x:st.s.x,fov:cam.fov,r:st.chaseCam?.radius,airClose:st.chaseCam?.airClose,ndc,inside,camY:cam.position.y,crashed:!!st.s.crashed};}
          const pastPeak=best&&((st.s.vy||0)<0)&&(st.s.y<maxY-0.08)&&(best.air>0.15);
          if(!pastPeak && frames<280 && !st.s.crashed) requestAnimationFrame(tick);
          else resolve(best);
        };
        requestAnimationFrame(tick);
      });
    });
    return result;
  }

  const chase=await peakInView('chase');
  const side=await peakInView('side');
  assert(chase && chase.y>5.4,'chase should catch the large-jump apex, '+JSON.stringify(chase));
  assert(side && side.y>5.4,'side should catch the large-jump apex, '+JSON.stringify(side));
  assert(chase.inside,'whole bike must stay on screen at the large-jump peak in chase, '+JSON.stringify(chase.ndc));
  assert(side.inside,'whole bike must stay on screen at the large-jump peak in side, '+JSON.stringify(side.ndc));
  assert(chase.fov<=74,'chase must not punch FOV wider in the air, fov='+chase.fov);
  assert(side.fov<=56,'side must not punch FOV wider in the air, fov='+side.fov);

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({v32b:true,small,medium,large14,large16,chase,side,trackWidth:ter.track.width}));
  await p.close();
}finally{await browser.close()}
