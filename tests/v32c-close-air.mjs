// v32c: chase stays close behind the bike in the air so it stays large on screen.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';

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

  if(await p.locator('[data-r=recover]').isVisible().catch(()=>false)){
    await p.locator('[data-r=recover]').click();
    await p.waitForFunction(()=>!__WK_RIDE_STATE__().s.crashed,null,{timeout:8000});
  }
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:90,z:0,yaw:0,vx:8,vy:0,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true],steer:0,stunt:null,spinV:0,whip:0});s.y=ter.height(90,0)+.5;});
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:15000});

  const peak=await p.evaluate(async()=>{
    const T=await import('/vendor/three.module.js');
    const {s,ter}=__WK_RIDE_STATE__();
    const r=ter.ramps.find(x=>x.name==='large');
    const yaw=r.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw);
    Object.assign(s,{x:r.x-c*10,z:r.z-n*10,yaw,vx:16,vy:0,pitch:0,w:0,air:0,wasAir:false,crashed:null,ground:[true,true],steer:0,stunt:null,spinV:0,whip:0});
    s.y=ter.height(s.x,s.z)+.5;
    return new Promise(resolve=>{
      let maxY=-1,best=null,frames=0;
      const tick=()=>{
        frames++;
        const st=__WK_RIDE_STATE__();
        const {cam,pivot}=__WK_RIDE_SCENE__();
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
        const xs=corners.map(v=>v.x),ys=corners.map(v=>v.y);
        const ndc={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
        const finite=[ndc.minX,ndc.maxX,ndc.minY,ndc.maxY].every(Number.isFinite);
        const hPct=(ndc.maxY-ndc.minY)/2*100;
        const inside=ndc.minX>=-1&&ndc.maxX<=1&&ndc.minY>=-1&&ndc.maxY<=1;
        if(finite && st.s.y>maxY){maxY=st.s.y;best={y:st.s.y,air:st.s.air,x:st.s.x,fov:cam.fov,r:st.chaseCam?.radius,airClose:st.chaseCam?.airClose,camY:cam.position.y,hPct,ndc,inside,crashed:!!st.s.crashed};}
        const past=best&&((st.s.vy||0)<0)&&(st.s.y<maxY-0.08)&&(best.air>0.15);
        if(!past && frames<280 && !st.s.crashed) requestAnimationFrame(tick);
        else resolve(best);
      };
      requestAnimationFrame(tick);
    });
  });

  assert(peak && peak.y>5.4,'should catch the large-jump apex, '+JSON.stringify(peak));
  assert(peak.r>=3.8&&peak.r<=5.5,'chase should stay about 4–5 m behind, '+JSON.stringify(peak));
  assert(Math.abs(peak.camY-peak.y)>0.4&&peak.camY>peak.y,'camera should sit slightly above the bike, '+JSON.stringify(peak));
  assert(peak.inside,'bike must stay on screen, '+JSON.stringify(peak.ndc));
  assert(peak.hPct>=28&&peak.hPct<=50,'bike should fill about 30–40% of screen height, hPct='+peak.hPct.toFixed(1)+' '+JSON.stringify(peak));
  assert(peak.fov<=74,'must not punch FOV wider in the air, fov='+peak.fov);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({v32c:true,peak}));
  await p.close();
}finally{await browser.close()}
