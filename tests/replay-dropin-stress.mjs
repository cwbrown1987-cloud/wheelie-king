// Stress: ~20 chained Drop Ins (ride → pause → Replay → scrub → Drop In). No hang, frame loop and physics keep
// running, the ride buffer stays capped at its 20 s window, the video block ring stays at <= 2, and JS heap growth
// stays bounded (measured after a forced GC).
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';
const N=+(process.env.WK_DROPINS||20);
const browser=await launchBrowser({extraArgs:['--autoplay-policy=no-user-gesture-required','--js-flags=--expose-gc']});
try{
 const p=await browser.newPage(pageOptions({viewport:{width:1024,height:460},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
 await p.goto(withLegacy(process.env.WK_TEST_URL||'http://127.0.0.1:8931/'));
 await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.locator('[data-destination="race"]').first().click();
 await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_REPLAY__,null,{timeout:90000});
 // short video blocks so the ring rotates (and must evict) many times during the run
 await p.evaluate(()=>{__WK_REPLAY__.ring.blockMs=1500;globalThis.__wkFrames=0;const f=()=>{__wkFrames++;requestAnimationFrame(f)};requestAnimationFrame(f);});
 const cdp=await p.context().newCDPSession(p);await cdp.send('HeapProfiler.enable');
 const heap=async()=>{await cdp.send('HeapProfiler.collectGarbage');await p.waitForTimeout(150);await cdp.send('HeapProfiler.collectGarbage');return (await cdp.send('Runtime.getHeapUsage')).usedSize;};
 const ui=()=>p.evaluate(()=>{const e=document.querySelector('[data-wk-ride-surface]'),panel=document.querySelector('.ride-replay'),R=__WK_REPLAY__;
  return {reviewing:e.hasAttribute('data-wk-reviewing'),paused:e.hasAttribute('data-wk-paused'),panel:!panel.hidden,dropping:panel.classList.contains('is-dropping'),
   frames:__wkFrames,x:__WK_RIDE_STATE__().s.x,bufDur:R.buffer.duration,bufSec:R.buffer.seconds,ring:R.ring.length,maxBlocks:R.ring.maxBlocks}});
 const timed=(pr,ms,what)=>Promise.race([pr,new Promise((_,r)=>setTimeout(()=>r(new Error('hang: '+what)),ms))]);
 const ride=async ms=>{await p.keyboard.down('ArrowUp');await p.waitForTimeout(ms);await p.keyboard.up('ArrowUp');};
 await ride(4000);
 const h0=await heap();let maxBuf=0,maxRing=0;const log=[],fps=[];
 for(let n=1;n<=N;n++){
  await ride(1200);
  await timed(p.locator('[data-r="pause"]').tap(),10000,'pause '+n);await p.waitForTimeout(200);
  await timed(p.locator('[data-r="menu-replay"]').tap(),10000,'open replay '+n);
  await timed(p.waitForFunction(()=>!document.querySelector('.ride-replay').hidden,null,{timeout:10000}),12000,'replay panel '+n);await p.waitForTimeout(600);
  let u=await ui();assert(u.panel&&u.reviewing&&!u.dropping,`replay ${n} open `+JSON.stringify(u));
  const frac=.2+.7*((n*37)%10)/10;
  await p.evaluate(f=>{const r=document.querySelector('.ride-replay input[type=range]');r.value=String(+r.min+(+r.max-+r.min)*f);r.dispatchEvent(new Event('input',{bubbles:true}))},frac);
  await p.waitForTimeout(250);u=await ui();assert(u.panel&&u.reviewing,`scrub ${n} stays in replay `+JSON.stringify(u));
  await timed(p.locator('.ride-replay [data-r="drop-in"]').tap({timeout:5000}),10000,'drop in '+n);
  await p.waitForTimeout(600);
  const f0=await timed(ui(),10000,'responsive after drop in '+n);
  assert(!f0.reviewing&&!f0.panel&&!f0.dropping&&!f0.paused,`Drop In ${n} back in the ride `+JSON.stringify(f0));
  const t1=Date.now();await ride(500);const f1=await timed(ui(),10000,'ui '+n);fps.push(+((f1.frames-f0.frames)/((Date.now()-t1)/1000)).toFixed(1));console.log('dropin',n,'fps',fps.at(-1),'buf',f1.bufDur.toFixed(2),'ring',f1.ring);
  // a one-off GC/compositor hitch on software GL is not a hang: the loop must advance within 5 s
  const adv=await p.waitForFunction(f=>__wkFrames>f+5,f0.frames,{timeout:5000}).then(()=>true,()=>false);
  assert(adv,`frame loop running after Drop In ${n} `+JSON.stringify([f0.frames,f1.frames]));
  assert(f1.x!==f0.x,`physics running after Drop In ${n}`);
  assert(f1.bufDur<=f1.bufSec+.1,`ride buffer capped at ${f1.bufSec}s: ${f1.bufDur}`);
  assert(f1.ring<=2&&f1.maxBlocks===2,`block ring <= 2: ${f1.ring}`);
  maxBuf=Math.max(maxBuf,f1.bufDur);maxRing=Math.max(maxRing,f1.ring);
  if(n%5===0)log.push({n,heapMB:+((await heap())/1048576).toFixed(1)});
 }
 const h1=await heap(),growMB=(h1-h0)/1048576;
 assert(growMB<40,`JS heap growth bounded over ${N} Drop Ins: ${growMB.toFixed(1)} MB`);
 assert.deepEqual(errors,[]);
 console.log('replay-dropin-stress: ok',JSON.stringify({dropIns:N,maxBufferS:+maxBuf.toFixed(2),maxRing,heap0MB:+(h0/1048576).toFixed(1),heap1MB:+(h1/1048576).toFixed(1),growMB:+growMB.toFixed(1),log}));
}finally{await browser.close();}
