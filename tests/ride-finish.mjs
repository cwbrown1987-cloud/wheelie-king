import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';

const browser = await launchBrowser();
try {
  const page = await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block'}));
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('wk-level','trials'));
  await page.goto(withLegacy(process.env.WK_TEST_URL || 'http://127.0.0.1:8931/'));
  await page.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),{timeout:60000});
  await page.locator('[data-destination="race"]').first().click();
  await page.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded);
  const slow = page.locator('[data-r=slow]');
  const replay = page.locator('[data-r=replay]');
  assert(await slow.isHidden());
  await page.evaluate(() => {
    Math.random = () => .25;
    __WK_RIDE_STATE__().s.events.push({type:'trick', t:'TAILWHIP + BARSPIN', pts:700});
  });
  await page.waitForFunction(() => document.querySelector('.ride-finish-photos canvas'));
  await page.evaluate(async () => {
    const {makeState}=await import('/ride-physics.js');
    const {s,P,ter}=__WK_RIDE_STATE__();
    Math.random = () => .25;
    Object.assign(s,makeState(P,ter.finish+.1,ter),{vx:9,score:1200});
  });
  await page.getByText('TRIALS COMPLETE').waitFor();
  assert(await page.getByRole('img',{name:'Race highlight'}).isVisible());
  assert(await page.evaluate(() => {
    const {s,ter}=__WK_RIDE_STATE__();
    return s.x > ter.finish + 1 && !s.crashed && s.score >= 1200;
  }));
  await page.waitForFunction(() => __WK_RIDE_STATE__().crash);
  assert.equal(await page.locator('[data-wk-crashed]').count(),0);
  assert(await page.evaluate(() => !__WK_RIDE_STATE__().s.crashed));
  await page.getByRole('button',{name:'Reset ride'}).click();
  assert(await page.evaluate(() => {
    const {s,finished}=__WK_RIDE_STATE__();
    return s.x < 3 && s.score === 0 && !s.crashed && !finished;
  }));
  assert(await slow.isVisible());
  // Slow-mo now works on the ground as well as in the air.
  await slow.click();
  await page.waitForTimeout(700);
  assert.equal(await slow.getAttribute('aria-pressed'),'true');
  await page.evaluate(() => {__WK_RIDE_STATE__().s.crashed='test impact'});
  await replay.waitFor();
  await page.getByRole('button',{name:'Instant recover'}).click();
  await page.evaluate(() => { __WK_RIDE_STATE__().s.vx = 5; });
  await replay.click();
  const frozen = await page.evaluate(() => {
    const {s} = __WK_RIDE_STATE__();
    return [s.x, s.y, s.vx];
  });
  await page.waitForFunction(() => document.querySelector('.ride-replay video').currentTime > .2);
  await page.evaluate(() => {const video=document.querySelector('.ride-replay video');video.pause();video.currentTime=.1;});
  await page.waitForFunction(() => Math.abs(document.querySelector('.ride-replay video').currentTime-.1)<.07);
  assert(await page.locator('.ride-replay a').getAttribute('download'));
  assert.deepEqual(await page.evaluate(() => {
    const {s} = __WK_RIDE_STATE__();
    return [s.x, s.y, s.vx];
  }), frozen);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  assert(await replay.isHidden());
  await page.waitForFunction(x => __WK_RIDE_STATE__().s.x > x + .1, frozen[0]);
  assert.deepEqual(errors,[]);
  console.log('PASS finish, tumble, restart, slow-mo and replay in landscape touch viewport');
} finally { await browser.close(); }
