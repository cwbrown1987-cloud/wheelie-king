// v2.0 Playground: one collapsible TRICKS button holds only moves that work on Jolt
// (WHEELIE, STAND toggles; BURNOUT hold). HOP and air tricks are hidden. Tap again collapses (no timeout).
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const shots=process.env.WK_TRICKS_SHOTS;
const browser=await launchBrowser();
try{
 const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('wk-level','arena'));
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
 await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
 await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
 await p.waitForFunction(()=>{const r=globalThis.__WK_RIDE_STATE__?.();return r&&r.physics==='jolt'&&r.physicsReady;},null,{timeout:120000});
 const closed=await p.evaluate(()=>({fan:[...document.querySelectorAll('.ride-tricks-fan [data-t]')].map(b=>b.dataset.t),
   hopHidden:document.querySelector('.ride-hop')?.hidden,version:document.querySelector('[data-wk-version]')?.textContent}));
 assert.deepEqual(closed.fan,['mono','stand','burnout'],'fan holds only working moves '+JSON.stringify(closed));
 assert.equal(closed.hopHidden,true,'HOP hidden in Playground');
 assert.equal(closed.version,'v2.0','pause menu shows v2.0');
 const st=()=>p.evaluate(()=>{const r=__WK_RIDE_STATE__();return {open:r.tricksOpen,toggles:r.toggles,inp:{mono:r.inp.mono,stand:r.inp.stand,throttle:r.inp.throttle,brake:r.inp.brake},s:{mono:r.s.mono,standing:r.s.standing,burnout:r.s.burnout}}});
 const tel=await p.evaluate(()=>__WK_TELEMETRY__());
 for(const k of ['speedKmh','pitchDeg','rollDeg'])assert(Number.isFinite(tel[k]),'telemetry '+k);
 assert(tel.version==='2.0'&&tel.physics==='jolt'&&tel.wheelSlipRatio.length===2&&tel.suspensionComp.length===2&&'wheelie' in tel.trick,'telemetry shape '+JSON.stringify(tel));
 await p.locator('[data-r=tricks]').click();
 await p.waitForFunction(()=>__WK_RIDE_STATE__().tricksOpen,null,{timeout:3000});
 if(shots)await p.screenshot({path:`${shots}/tricks-open.png`});
 await p.waitForTimeout(2500);
 assert((await st()).open,'fan stays open until tapped again');
 const R={};
 await p.locator('.ride-tricks-fan [data-t=mono]').click();await p.waitForTimeout(300);R.monoOn=await st();
 await p.locator('.ride-tricks-fan [data-t=mono]').click();await p.waitForTimeout(300);R.monoOff=await st();
 await p.locator('.ride-tricks-fan [data-t=stand]').click();await p.waitForTimeout(400);R.standOn=await st();
 await p.locator('.ride-tricks-fan [data-t=stand]').click();await p.waitForTimeout(300);
 const b=await p.locator('.ride-tricks-fan [data-t=burnout]').boundingBox();
 await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.waitForTimeout(600);R.burnout=await st();await p.mouse.up();
 await p.waitForTimeout(200);R.burnoutUp=await st();
 await p.keyboard.press('Control');await p.waitForTimeout(200);R.ctrl=await st();await p.keyboard.press('Control');
 await p.keyboard.press('Shift');await p.waitForTimeout(300);R.shift=await st();await p.keyboard.press('Shift');
 assert(R.monoOn.toggles.mono&&R.monoOn.inp.mono&&R.monoOn.s.mono,'WHEELIE tap turns the wheelie toggle on '+JSON.stringify(R.monoOn));
 assert(!R.monoOff.toggles.mono&&!R.monoOff.s.mono,'second tap turns it off');
 assert(R.standOn.s.standing,'STAND tap stands the rider');
 assert(R.burnout.inp.throttle===1&&R.burnout.inp.brake===1&&R.burnout.s.burnout,'BURNOUT hold = throttle+brake burnout '+JSON.stringify(R.burnout));
 assert(!R.burnoutUp.s.burnout,'release ends the burnout');
 assert(R.ctrl.s.mono,'Ctrl toggles wheelie');assert(R.shift.s.standing,'Shift toggles stand');
 await p.locator('[data-r=tricks]').click();
 await p.waitForFunction(()=>__WK_RIDE_STATE__().tricksOpen===false,null,{timeout:3000});
 assert.deepEqual(errors,[],'page errors '+errors.join(' | '));
 console.log(JSON.stringify(R));console.log('v34-tricks-ui ok');
}finally{await browser.close()}
