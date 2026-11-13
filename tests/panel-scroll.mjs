import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';

// Every menu/panel must fit the phone screen and scroll by touch when its content is taller.
const browser = await launchBrowser();
const shot = process.env.WK_SCROLL_SHOT;
// Panels taller than the screen that cannot scroll (overflow visible/hidden) = bug.
const audit = () => [...document.querySelectorAll('body *')].filter(e => {
  if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return false;
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  if (r.width < 120 || r.height < 60 || cs.visibility === 'hidden' || cs.display === 'none') return false;
  const glass = cs.backdropFilter.includes('blur') || /dialog|menu/.test(e.getAttribute('role') || '');
  if (!glass) return false;
  const tooTall = e.scrollHeight > e.clientHeight + 4 || r.bottom > innerHeight + 2 || r.top < -2;
  const scrolls = /(auto|scroll)/.test(cs.overflowY) && cs.touchAction !== 'none';
  return tooTall && !scrolls;
}).map(e => (e.className || e.id || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height));
async function swipe(page, sel) {
  const box = await page.locator(sel).boundingBox(), cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2, y0 = Math.min(box.y + box.height - 20, 380), y1 = Math.max(box.y + 20, y0 - 160);
  const before = await page.locator(sel).evaluate(e => e.scrollTop);
  // A real touch drag (finger moves up) through Chrome's gesture pipeline.
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x, y:y0}]});
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x, y:y0 + (y1 - y0) * i / 10}]});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await page.waitForTimeout(400);
  return { before, after: await page.locator(sel).evaluate(e => e.scrollTop), max: await page.locator(sel).evaluate(e => e.scrollHeight - e.clientHeight) };
}
const results = {};
try {
  for (const [name, vp] of [['landscape', {width:844,height:390}]]) {
    const page = await browser.newPage(pageOptions({viewport:vp,hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'}));
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('wk-level', 'trials'));
    await page.goto(withLegacy(process.env.WK_TEST_URL || 'http://127.0.0.1:8931/'));
    await page.waitForFunction(() => document.querySelector('[data-wk-room-ready]'), {timeout:90000});
    const workshop = await page.evaluate(audit);
    await page.locator('[data-destination="race"]').first().evaluate(b => b.click());
    await page.waitForFunction(() => globalThis.__WK_RIDE_STATE__?.().backdropLoaded, null, {timeout:60000});
    await page.waitForTimeout(1500);
    await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})));
    await page.locator('.ride-pause-menu').waitFor({state:'visible'});
    const pause = await page.evaluate(audit);
    const pauseStyle = await page.locator('.ride-pause-menu').evaluate(e => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return {oy:cs.overflowY, ta:cs.touchAction, top:Math.round(r.top), bottom:Math.round(r.bottom), vh:innerHeight}; });
    const pauseSwipe = await swipe(page, '.ride-pause-menu');
    if (shot && name === 'landscape') await page.screenshot({path:shot});
    await page.locator('[data-r="menu-replay"]').click();
    await page.locator('.ride-replay').waitFor({state:'visible'});
    await page.waitForTimeout(800);
    const replay = await page.evaluate(audit);
    const replaySwipe = await swipe(page, '.ride-replay');
    results[name] = {workshop, pause, pauseStyle, pauseSwipe, replay, replaySwipe, errors};
    await page.close();
  }
  console.log(JSON.stringify(results));
  for (const [name, r] of Object.entries(results)) {
    assert.deepEqual([...r.workshop, ...r.pause, ...r.replay], [], name + ' panels that overflow without scrolling');
    assert(r.pauseStyle.top >= 0 && r.pauseStyle.bottom <= r.pauseStyle.vh + 1 && r.pauseStyle.oy === 'auto', name + ' pause menu fits: ' + JSON.stringify(r.pauseStyle));
    for (const sw of [r.pauseSwipe, r.replaySwipe]) if (sw.max > 4) assert(sw.after > sw.before, name + ' touch swipe scrolls panel: ' + JSON.stringify(sw));
    assert.deepEqual(r.errors, []);
  }
  console.log(JSON.stringify({panelScroll:true}));
} finally { await browser.close(); }
