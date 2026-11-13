// Slow-mo: locked until the first Trials finish, hidden until then, works on the ground,
// and flashes a one-time style-B "SLOW MO UNLOCKED" toast on first unlock.
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';

const browser=await launchBrowser();
try{
  const page=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block'}));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('wk-level','trials');localStorage.removeItem('wk-trials-completed');});
  await page.goto(withLegacy(process.env.WK_TEST_URL||'http://127.0.0.1:8931/'));
  await page.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),{timeout:60000});
  await page.locator('[data-destination="race"]').first().click();
  await page.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded);
  const slow=page.locator('[data-r=slow]');
  assert(await slow.isHidden(),'slow-mo stays hidden before a Trials finish');
  assert.equal(await page.evaluate(()=>__WK_RIDE_STATE__().slowUnlocked),false);

  // Guards still apply once unlocked: paused / finished / crashed / loopRide should refuse.
  // First, unlock by completing Trials (and expect the toast only this first time).
  await page.evaluate(()=>{
    Math.random=()=>.25;
    __WK_RIDE_STATE__().s.events.push({type:'trick',t:'TAILWHIP + BARSPIN',pts:700});
  });
  await page.waitForFunction(()=>document.querySelector('.ride-finish-photos canvas'));
  await page.evaluate(async()=>{
    const {makeState}=await import('/ride-physics.js');
    const {s,P,ter}=__WK_RIDE_STATE__();
    Math.random=()=>.25;
    Object.assign(s,makeState(P,ter.finish+.1,ter),{vx:9,score:1200});
  });
  await page.getByText('TRIALS COMPLETE').waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-wk-slow-toast]'));
  const toast=await page.evaluate(()=>{
    const el=document.querySelector('[data-wk-slow-toast]');
    const cs=getComputedStyle(el);
    return {text:el.textContent.trim(),role:el.getAttribute('role'),bg:cs.backgroundImage||cs.backgroundColor,color:cs.color,radius:cs.borderRadius};
  });
  assert.equal(toast.text,'SLOW MO UNLOCKED');
  assert.equal(toast.role,'status');
  assert(toast.radius==='999px'||Number.parseFloat(toast.radius)>=16,'style B pill toast');
  assert.equal(await page.evaluate(()=>localStorage.getItem('wk-trials-completed')),'1');
  assert.equal(await page.evaluate(()=>__WK_RIDE_STATE__().slowUnlocked),true);

  // Second finish in the same session must not flash the toast again.
  await page.evaluate(()=>document.querySelector('[data-wk-slow-toast]')?.remove());
  await page.getByRole('button',{name:'Reset ride'}).click();
  await page.waitForFunction(()=>{const r=__WK_RIDE_STATE__();return r.s.x<3&&!r.finished;});
  assert(await slow.isVisible(),'button stays visible after the first unlock');
  await page.evaluate(async()=>{
    const {makeState}=await import('/ride-physics.js');
    const {s,P,ter}=__WK_RIDE_STATE__();
    Math.random=()=>.25;
    Object.assign(s,makeState(P,ter.finish+.1,ter),{vx:9,score:800});
  });
  await page.getByText('TRIALS COMPLETE').waitFor();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>!!document.querySelector('[data-wk-slow-toast]')),false,'toast only on first unlock');

  await page.getByRole('button',{name:'Reset ride'}).click();
  await page.waitForFunction(()=>{const r=__WK_RIDE_STATE__();return r.s.x<3&&!r.finished;});

  // Works on the ground.
  await page.evaluate(()=>document.querySelector('[data-r=slow]').click());
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>document.querySelector('[data-r=slow]').getAttribute('aria-pressed')),'true');
  assert.equal(await page.evaluate(()=>__WK_RIDE_STATE__().slowMo),true);

  // Still refused when paused (turn it off first, then pause and try).
  await page.evaluate(()=>document.querySelector('[data-r=slow]').click());
  assert.equal(await page.evaluate(()=>__WK_RIDE_STATE__().slowMo),false);
  const blocked=await page.evaluate(()=>{
    const click=()=>document.querySelector('[data-r=slow]').click();
    const r=__WK_RIDE_STATE__();
    const pauseBtn=document.querySelector('[data-r=pause]');
    pauseBtn.click();
    click();
    const paused=r.slowMo;
    document.querySelector('[data-r=menu-resume]')?.click();
    r.s.loopRide=true;
    click();
    const looped=r.slowMo;
    r.s.loopRide=false;
    r.s.crashed='test';
    click();
    const crashed=r.slowMo;
    r.s.crashed=false;
    return {paused,looped,crashed,unlocked:r.slowUnlocked};
  });
  assert.equal(blocked.paused,false,'paused blocks slow-mo');
  assert.equal(blocked.looped,false,'loopRide blocks slow-mo');
  assert.equal(blocked.crashed,false,'crashed blocks slow-mo');

  assert.deepEqual(errors,[]);
  console.log('PASS slow-mo ground use, first-unlock toast, and remaining guards');
}finally{await browser.close();}
