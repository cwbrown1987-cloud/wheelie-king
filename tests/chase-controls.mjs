// Chase-cam HUD on the Legacy Trials ride (?legacy=1): throttle, hop, d-pad, classic keys. SAMPLE 3D sections removed in v2.0.
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

const shots=process.env.WK_V27_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';

async function openRide(browser,{width,height,track}){
  const p=await browser.newPage(pageOptions({viewport:{width,height},hasTouch:true,isMobile:width<=900,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const url=withLegacy(base,track||'trials');
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
    const cs=n=>{const e=document.querySelector(n);return e?getComputedStyle(e):{display:'none'}};
    const vis=s=>[...document.querySelectorAll(s)].find(e=>{const r=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&r.width>0&&r.height>0;});
    const box=s=>{const e=vis(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,display:getComputedStyle(e).display};};
    return {
      view:st.cameraView,cam:document.querySelector('[data-wk-ride-surface]')?.dataset.wkCam,
      steerDisplay:cs('.ride-steer').display,dpadDisplay:cs('.ride-dpad').display,stickDisplay:cs('.ride-stick').display,
      leanButtons:cs('.ride-lean-buttons').display,
      tiltCopy:cs('.ride-tilt-copy').display,driveLabel:cs('.ride-drive-label').display,
      hop:box('[data-t=hop]'),throttle:box('[data-t=throttle]'),brake:box('[data-t=brake]'),
      leanBack:box('.ride-dpad [data-t=leanBack]'),leanSide:box('.ride-lean-buttons [data-t=leanBack]'),
      left:box('.ride-dpad [data-t=steerLeft]'),right:box('.ride-dpad [data-t=steerRight]'),
      up:box('.ride-dpad [data-t=leanForward]'),down:box('.ride-dpad [data-t=leanBack]'),
      rewindHidden:!!document.querySelector('[data-r=rewind]')?.hidden,
      tricks:!!document.querySelector('.ride-tricks-toggle'),
      inp:{...st.inp},vx:st.s.vx,x:st.s.x,y:st.s.y,pitch:st.s.pitch,w:st.s.w,
      visual:st.visual,crashed:!!st.s.crashed
    };
  });
}


const browser=await launchBrowser();
try{
  const report={};

  // --- Trials gets the chase HUD ---
  {
    const {p,errors}=await openRide(browser,{width:844,height:390,track:null});
    const side=await hud(p);
    assert.equal(side.stickDisplay,'none','Trials side view keeps the old lean buttons, not the thumb stick');
    assert(side.leanButtons!=='none');
    await p.locator('[data-r=view]').tap();
    await waitChase(p);
    const chase=await hud(p);
    assert.notEqual(chase.stickDisplay,'none','chase HUD (thumb stick) must apply on Trials too');assert.equal(chase.dpadDisplay,'none','v2.1-30: the d-pad is replaced by the thumb stick');
    assert(chase.hop.x>500);

    // Trials / Endless keep the old keys: arrows + WASD still drive and lean
    await p.keyboard.down('ArrowUp');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1,null,{timeout:3000});
    await p.keyboard.up('ArrowUp');
    await p.keyboard.down('KeyA');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.lean===1&&__WK_RIDE_STATE__().inp.steer===0,null,{timeout:3000});
    await p.keyboard.up('KeyA');
    await p.keyboard.down('KeyW');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1,null,{timeout:3000});
    await p.keyboard.up('KeyW');
    const prevented=await p.evaluate(()=>{
      const ev=k=>{const e=new KeyboardEvent('keydown',{key:k,cancelable:true,bubbles:true});window.dispatchEvent(e);return e.defaultPrevented;};
      return {w:ev('w'),arrow:ev('ArrowDown'),space:ev(' ')};
    });
    assert.equal(prevented.w,true);
    assert.equal(prevented.arrow,true);
    assert.equal(prevented.space,true);
    assert.deepEqual(errors,[]);
    report.trials={chaseHud:true,legacyKeys:true,prevented};
    await p.close();
  }

  console.log(JSON.stringify({chaseControls:true,...report}));
}finally{await browser.close()}
