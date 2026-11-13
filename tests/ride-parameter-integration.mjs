import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();
try{
 const page=await browser.newPage(pageOptions({viewport:{width:1280,height:720},serviceWorkers:'block'})),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');await page.waitForFunction(()=>globalThis.__WK_EQUIP__&&document.querySelector('#wk-summary dd'));
 const runs=[];
 for(const id of ['bmx','emoto','pit125','kaiji_test']){
  await page.evaluate(id=>__WK_EQUIP__('bike_'+id),id);await page.waitForFunction(id=>__WK_BUILD__.frame===id,id);
  await page.waitForFunction(()=>document.querySelector('#wk-summary .name')?.textContent===__WK_PART__(__WK_BUILD__.frame).name||document.querySelector('#wk-summary .name')?.textContent.includes('Test'));
  // Summary updates on its own timer; wait for actual power display to agree.
  await page.waitForFunction(()=>{const b=__WK_BUILD__,motor=__WK_PART__(b.motor);const rows=[...document.querySelectorAll('#wk-summary dl>div')];return Number.parseFloat(rows.find(r=>r.querySelector('dt')?.textContent==='Power')?.querySelector('dd')?.textContent)===(motor?.w||0);});
  const expected=await page.evaluate(()=>{const b={...__WK_BUILD__},motor=__WK_PART__(b.motor),battery=__WK_PART__(b.battery),tank=__WK_PART__(b.fuel_tank),rows=Object.fromEntries([...document.querySelectorAll('#wk-summary dl>div')].map(r=>[r.querySelector('dt').textContent,r.querySelector('dd').textContent]));let anchors;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')anchors=o.parent.userData.wkAnchors});return {b,power:motor?.w||250,energy:motor?.powertrain==='petrol'?tank.litres*8900*.2:battery?battery.v*battery.ah:0,speed:Number.parseFloat(rows['Top speed']),anchors};});
  await page.evaluate(()=>globalThis.__QA_OLD_RIDE__=globalThis.__WK_RIDE_STATE__);await page.locator('[data-destination="race"]').first().click();await page.waitForFunction(()=>globalThis.__WK_RIDE_STATE__!==globalThis.__QA_OLD_RIDE__&&globalThis.__WK_RIDE_STATE__?.().backdropLoaded);
  const actual=await page.evaluate(()=>({...__WK_RIDE_STATE__().P}));assert.equal(actual.power,expected.power,id+' power');assert.equal(actual.batteryWh,expected.energy,id+' energy');assert(Math.abs(actual.vmax*3.6-expected.speed)<=.51,id+' nominal speed matches rounded Workshop');assert.equal(actual.wb,Math.max(.6,expected.anchors.frontAxle[0]-expected.anchors.rearAxle[0]));assert.equal(actual.R,expected.anchors.wheelR);assert.equal(actual.pedal,id==='bmx');if(id==='pit125')assert.equal(actual.powertrain,'petrol');
  runs.push({id,power:actual.power,speed:actual.vmax*3.6,energyWh:actual.batteryWh});await page.locator('[data-r=back]').click();await page.locator('[data-ride=portal]').waitFor({state:'detached'});
 }
 // Verify UI gearing and physics torque use the same installed sprockets.
 await page.evaluate(()=>__WK_EQUIP__('bike_emoto'));await page.waitForFunction(()=>__WK_BUILD__.frame==='emoto');
 const gear=await page.evaluate(()=>{const before=__WK_GEAR__(__WK_BUILD__),part=__WK_CAT__().items.find(p=>p.slot==='sprocket_r'&&p.std==='428'&&p.teeth>48&&!p.hidden);if(!part)throw Error('No alternate rear sprocket');const build={...__WK_BUILD__,sprocket_r:part.id};__WK_SETBUILD__(build);return {before,after:__WK_GEAR__(build),motor:__WK_PART__(build.motor)};});
 await page.waitForTimeout(350);await page.evaluate(()=>globalThis.__QA_OLD_RIDE__=globalThis.__WK_RIDE_STATE__);await page.locator('[data-destination="race"]').first().click();await page.waitForFunction(()=>globalThis.__WK_RIDE_STATE__!==globalThis.__QA_OLD_RIDE__&&globalThis.__WK_RIDE_STATE__?.().backdropLoaded);const torque=await page.evaluate(()=>__WK_RIDE_STATE__().P.torque);assert(Math.abs(torque-gear.motor.nm*1.15*gear.after.g)<1e-6);assert(gear.after.speedF<gear.before.speedF);assert.deepEqual(errors,[]);
 console.log('PASS four actual Workshop-to-Ride builds and installed mid-drive gearing:',JSON.stringify(runs));
}finally{await browser.close();}
