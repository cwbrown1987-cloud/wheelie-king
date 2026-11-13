// Browser acceptance test for optional V3 world, independent motorcycle engine,
// live Arcade Lab and props-only Jolt rigid-body simulation.
// Run only against a local staged build, never against production.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {launchBrowser,pageOptions} from './_browser.mjs';

const url=process.env.WK_TEST_URL||'';
if(!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url))
  throw new Error('WK_TEST_URL must be a locally served staged build');
mkdirSync('test-results',{recursive:true});
const browser=await launchBrowser();
try{
  const page=await browser.newPage(pageOptions({
    viewport:{width:1136,height:640},hasTouch:true,isMobile:false,
    deviceScaleFactor:1,serviceWorkers:'block'
  }));
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('wk-level','arena');
    localStorage.removeItem('wk-classic-arcade-mode');
  });
  const target=new URL(url);
  target.searchParams.set('world','v3');
  target.searchParams.set('physics','v3');
  target.searchParams.set('physicslab','1');
  target.searchParams.set('sky','ldr');
  await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await page.locator('[data-destination="race"]').first().click();
  await page.waitForFunction(()=>globalThis.__WK_TELEMETRY__?.()?.world==='v3',null,{timeout:180000});
  const first=await page.evaluate(()=>({
    engine:__WK_TELEMETRY__().physics,world:__WK_TELEMETRY__().world,
    mode:__WK_TELEMETRY__().arcade?.mode,terrain:__WK_RIDE_STATE__().environment,
    position:{x:__WK_TELEMETRY__().x,z:__WK_TELEMETRY__().z}
  }));
  assert.equal(first.engine,'v3');
  assert.equal(first.world,'v3');
  assert.equal(first.mode,'original','first-time user retains Original assistance');
  assert(first.terrain.chunks>=9,'streamed terrain chunks must be present');

  await page.waitForFunction(()=>{
    const p=__WK_TELEMETRY__?.().props;
    return p?.ready||p?.error;
  },null,{timeout:45000});
  const props=await page.evaluate(()=>__WK_TELEMETRY__().props);
  assert.equal(props.error,null,'props-only Jolt initialization: '+props.error);
  assert.equal(props.ready,true,'props-only Jolt should run without motorcycle controller');
  assert(props.count>3,'Jolt should own several movable props');

  await page.locator('[data-wk-lab-toggle]').click();
  const lab=page.locator('[data-wk-physics-lab]');
  assert.equal(await lab.locator('select[aria-label="Bike physics engine"]').inputValue(),'v3');
  const modes=lab.locator('select[aria-label="Handling mode"]');
  await modes.selectOption('arcade');
  assert.equal(await page.evaluate(()=>__WK_CLASSIC_ASSIST__?.getMode()),'arcade');
  await page.keyboard.down('w');
  await page.waitForTimeout(1100);
  await page.keyboard.up('w');
  const after=await page.evaluate(()=>({
    state:__WK_TELEMETRY__(),props:__WK_RIDE_STATE__().props,
    chunks:__WK_RIDE_STATE__().environment.chunks,
  }));
  assert(Number.isFinite(after.state.x)&&Number.isFinite(after.state.y)&&Number.isFinite(after.state.z));
  assert(Number.isFinite(after.state.rollDeg)&&Number.isFinite(after.state.pitchDeg));
  assert.equal(after.state.physics,'v3');
  assert(after.chunks>=9);
  await page.screenshot({path:'test-results/v3-world-arcade.png',animations:'disabled'});

  await modes.selectOption('original');
  assert.equal(await page.evaluate(()=>__WK_CLASSIC_ASSIST__?.getMode()),'original');
  assert.deepEqual(errors,[],'unexpected page errors: '+errors.join(' | '));
  console.log(JSON.stringify({pass:true,first,props:{ready:props.ready,count:props.count},after:{
    speedKmh:after.state.speedKmh,chunks:after.chunks,rollDeg:after.state.rollDeg,pitchDeg:after.state.pitchDeg
  }}));
  await page.close();
}finally{await browser.close()}
