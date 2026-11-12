// __WK_JOLT_RESET__ must clear a crashed bike's visuals the same way RECOVER does:
// move the pose, put the rider back on the bike, and hide RECOVER / REWIND.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();
try{
 const p=await browser.newPage(pageOptions({viewport:{width:1024,height:460},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('wk-level','arena'));
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
 await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
 await p.waitForFunction(()=>{const t=globalThis.__WK_TELEMETRY__?.();return t&&t.ready&&typeof globalThis.__WK_JOLT_RESET__==='function';},null,{timeout:120000});
 await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;s.crashed='TEST IMPACT';s.events.push({type:'crash',why:'TEST IMPACT'});});
 await p.waitForFunction(()=>{
  const bar=document.querySelector('.ride-crash-actions');
  const crash=__WK_RIDE_STATE__().crash;
  return document.querySelector('[data-wk-crashed]')&&bar&&!bar.hidden&&crash&&crash.separated;
 },null,{timeout:10000});
 await p.evaluate(()=>__WK_JOLT_RESET__({x:8,z:-4,yaw:0.3,vx:0,vy:0,pitch:0,w:0}));
 const after=await p.evaluate(()=>{
  const r=__WK_RIDE_STATE__(),t=__WK_TELEMETRY__();
  const bar=document.querySelector('.ride-crash-actions');
  const recover=document.querySelector('[data-r=recover]');
  const rewind=document.querySelector('[data-r=rewind]');
  return {
   crashed:r.s.crashed,
   telCrashed:t.trick.crashed,
   wkCrashed:!!document.querySelector('[data-wk-crashed]'),
   barHidden:!!bar?.hidden,
   recoverHidden:!recover||recover.hidden||getComputedStyle(recover).display==='none',
   rewindHidden:!rewind||rewind.hidden||getComputedStyle(rewind).display==='none',
   crash:r.crash,
   x:t.x,z:t.z,yawDeg:t.yawDeg,
   physics:t.physics||r.physics
  };
 });
 assert.equal(after.physics,'classic','default Playground physics is classic');
 assert.equal(after.crashed,null,'reset clears crash state '+JSON.stringify(after));
 assert.equal(after.telCrashed,null,'telemetry not crashed');
 assert.equal(after.wkCrashed,false,'data-wk-crashed removed');
 assert.equal(after.barHidden&&after.recoverHidden&&after.rewindHidden,true,'RECOVER and REWIND hidden after reset '+JSON.stringify(after));
 assert.equal(after.crash,null,'crash rig restored (rider back on the bike)');
 assert.ok(Math.abs(after.x-8)<.25&&Math.abs(after.z+4)<.25,'bike moved to the reset pose '+JSON.stringify(after));
 assert.deepEqual(errors,[],'page errors '+errors.join(' | '));
 console.log('jolt-reset-crash: ok',after);
}finally{await browser.close()}
