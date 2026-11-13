// Arcade Physics V3: browser smoke check against a STAGED (never production) build.
// WK_TEST_URL must point at a locally served dist-beta directory.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {launchBrowser,pageOptions} from './_browser.mjs';

const root=process.env.WK_TEST_URL;
if(!root||!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(root)){
  throw new Error('arcade-browser requires WK_TEST_URL on localhost/127.0.0.1; refusing a live site');
}
const dir='test-results';mkdirSync(dir,{recursive:true});
const browser=await launchBrowser();
try{
  const p=await browser.newPage(pageOptions({
    viewport:{width:1024,height:600},deviceScaleFactor:1,
    hasTouch:true,isMobile:true,serviceWorkers:'block'
  }));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
    localStorage.setItem('wk-level','arena');
    localStorage.removeItem('wk-classic-arcade-mode');
    localStorage.removeItem('wk-classic-arcade-custom');
  });
  await p.goto(new URL('?physicslab=1',root).toString(),{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:150000});
  await p.locator('[data-destination="race"]').first().click();
  await p.waitForFunction(()=>globalThis.__WK_CLASSIC_ASSIST__ && globalThis.__WK_TELEMETRY__?.()?.ready,
    null,{timeout:150000});
  const initial=await p.evaluate(()=>({
    engine:__WK_TELEMETRY__().physics,mode:__WK_TELEMETRY__().arcade?.mode,
    lab:!!document.querySelector('[data-wk-lab-toggle]')
  }));
  assert.equal(initial.engine,'classic','the Arcade Lab must not replace our motorcycle controller with Jolt');
  assert.equal(initial.mode,'original','fresh profile must preserve Original handling');
  assert(initial.lab,'missing arcade panel');

  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase',null,{timeout:7000});
  await p.locator('[data-wk-lab-toggle]').tap();
  const panel=p.locator('[data-wk-physics-lab]');
  const mode=panel.locator('select[aria-label="Handling mode"]');
  await mode.selectOption('balanced');
  assert.equal(await p.evaluate(()=>__WK_CLASSIC_ASSIST__?.getMode()),'balanced');
  await mode.selectOption('arcade');
  assert.equal(await p.evaluate(()=>__WK_CLASSIC_ASSIST__?.getMode()),'arcade');

  await p.evaluate(()=>{
    const el=document.querySelector('input[aria-label="Air trick control"]');
    el.value='75';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const custom=await p.evaluate(()=>({
    mode:__WK_CLASSIC_ASSIST__?.getMode(),
    air:__WK_CLASSIC_ASSIST__?.getSettings().air,
    stored:localStorage.getItem('wk-classic-arcade-mode'),
    camera:__WK_RIDE_STATE__().cameraView
  }));
  assert.equal(custom.mode,'custom');
  assert.equal(custom.stored,'custom');
  assert.equal(custom.air,.75);
  assert.equal(custom.camera,'chase');

  await p.screenshot({path:dir+'/arcade-lab-chase.png',animations:'disabled'});
  await p.locator('[data-wk-physics-lab] button').filter({hasText:'Original'}).click();
  assert.equal(await p.evaluate(()=>__WK_CLASSIC_ASSIST__?.getMode()),'original');
  const t=await p.evaluate(()=>__WK_TELEMETRY__());
  assert(Number.isFinite(t.x)&&Number.isFinite(t.y)&&Number.isFinite(t.pitchDeg),'finite bike state');
  assert.deepEqual(errors,[],'JavaScript page errors: '+errors.join(' | '));
  console.log(JSON.stringify({result:'PASS',initial,custom,reset:'original',screen:dir+'/arcade-lab-chase.png'}));
  await p.close();
}finally{await browser.close()}
