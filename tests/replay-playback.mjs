import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';

// Real recording -> Replay playback: no black screen, plays smoothly, scrub/theatre work, saved clips play.
const browser = await launchBrowser({extraArgs:['--autoplay-policy=no-user-gesture-required']});
const shot = process.env.WK_REPLAY_SHOT;
const T0=Date.now(),step=m=>process.env.WK_DEBUG&&console.log('['+((Date.now()-T0)/1000).toFixed(1)+'s] '+m);
try {
  const page = await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'}));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('wk-level','trials'));
  await page.goto(withLegacy(process.env.WK_TEST_URL || 'http://127.0.0.1:8931/'));
  await page.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),{timeout:90000});
  await page.locator('[data-destination="race"]').first().click();
  await page.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_REPLAY__,null,{timeout:60000});
  // Short blocks so the ring evicts the first block (the one holding the container header) during the test.
  if(!process.env.WK_NO_EVICT)await page.evaluate(()=>{__WK_REPLAY__.ring.blockMs=1500;});
  await page.evaluate(()=>{globalThis.__wkFrames=0;const f=()=>{__wkFrames++;requestAnimationFrame(f)};requestAnimationFrame(f);globalThis.__wkT0=performance.now();});
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(7000);await page.keyboard.up('ArrowUp');
  // Headless software GL renders the game slowly; the clip can only hold as many frames as the game drew.
  const gameFps = await page.evaluate(()=>__wkFrames/((performance.now()-__wkT0)/1000));step('game fps '+gameFps.toFixed(1));
  const probe = async (label) => page.evaluate(async (label) => {
    const v=document.querySelector('.ride-replay video');
    const wait=(ok,ms)=>new Promise(r=>{const t0=performance.now();const f=()=>ok()||performance.now()-t0>ms?r(ok()):setTimeout(f,50);f();});
    const loaded=await wait(()=>v.readyState>=2,8000);
    v.muted=true;await Promise.race([v.play().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);
    let frames=0,gaps=[],last=0;const cb=(now)=>{frames++;if(last)gaps.push(now-last);last=now;if(frames<400)v.requestVideoFrameCallback(cb)};v.requestVideoFrameCallback(cb);
    const t0=v.currentTime;await new Promise(r=>setTimeout(r,2000));const extra={paused:v.paused,ct:v.currentTime,net:v.networkState,seekable:v.seekable.length?[v.seekable.start(0),v.seekable.end(0)]:null,buffered:v.buffered.length?[v.buffered.start(0),v.buffered.end(v.buffered.length-1)]:null,min:document.querySelector('.ride-replay input[type=range]').min,max:document.querySelector('.ride-replay input[type=range]').max};
    const c=document.createElement('canvas');c.width=64;c.height=36;const g=c.getContext('2d');g.drawImage(v,0,0,64,36);const d=g.getImageData(0,0,64,36).data;let lum=0;for(let i=0;i<d.length;i+=4)lum+=d[i]+d[i+1]+d[i+2];lum/=d.length/4*3;
    gaps.sort((a,b)=>a-b);
    const q=v.getVideoPlaybackQuality?.()||{};return {...extra,decoded:q.totalVideoFrames,dropped:q.droppedVideoFrames,label,loaded,readyState:v.readyState,duration:v.duration,advanced:+(v.currentTime-t0).toFixed(2),frames,p90gap:Math.round(gaps[Math.floor(gaps.length*.9)]||0),lum:Math.round(lum),w:v.videoWidth,err:v.error?.code||0,src:!!v.currentSrc};
  }, label);
  step('rode');await page.keyboard.press('Escape');
  await page.locator('[data-r="menu-replay"]').click({timeout:15000});step('replay opened');
  const fromPause = await probe('pause');
  step('probed');console.log(JSON.stringify(await page.evaluate(()=>({...__WK_REPLAY__._debug(),fps:__WK_RIDE_STATE__?.().render}))));console.log(JSON.stringify(fromPause));
  // Scrub + theatre controls
  const ctl = await page.evaluate(async()=>{
    const v=document.querySelector('.ride-replay video'),p=document.querySelector('.ride-replay');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    v.pause();const s=p.querySelector('input[type=range]');s.value=String(Math.min(+s.max,1));s.dispatchEvent(new Event('input'));await sleep(500);const afterScrub=v.currentTime;
    const tPlay=v.currentTime;const btn=p.querySelector('[data-r="overlay-play"]');btn.hidden=false;btn.click();await sleep(600);
    const played=!v.paused&&btn.hidden&&!p.classList.contains('is-theatre')&&v.currentTime>tPlay+0.12;
    return {afterScrub,played,ct:v.currentTime,tPlay,hidden:btn.hidden,paused:v.paused,theatre:p.classList.contains('is-theatre'),max:+s.max};
  });
  console.log(JSON.stringify(ctl));
  if (shot) await page.screenshot({path:shot});
  // Save to library, then play it back from the side thumbnail.
  await page.evaluate(async()=>{const p=document.querySelector('.ride-replay');p.querySelector('[data-r="theatre-close"]')?.click();await __WK_REPLAY__._saveToLibrary();});
  step('saved');await page.locator('.ride-replay-item').first().click({timeout:15000});
  const saved = await probe('saved');
  console.log(JSON.stringify(saved));
  // Crash-screen replay path
  step('saved probed');await page.locator('[data-r="replay-close"]').click({timeout:15000});
  await page.keyboard.press('Escape').catch(()=>{});
  const dropReady = await page.evaluate(()=>!!__WK_REPLAY__.buffer.at(.5));
  for (const r of [fromPause, saved]) {
    assert(r.loaded && r.src && !r.err, 'video loads: '+JSON.stringify(r));
    assert(Number.isFinite(r.duration) && r.duration > 1, 'finite duration (seekable): '+JSON.stringify(r));
    assert(r.lum > 8, 'not a black frame: '+JSON.stringify(r));
    // rVFC is unreliable headless; the decoder's own counters show real frames played and dropped.
    assert(r.advanced > 0.8 && r.decoded >= Math.max(3, Math.min(30, gameFps) * 2 * .5) && r.dropped <= r.decoded * .1, 'plays frames smoothly: '+JSON.stringify(r));
  }
  assert(Math.abs(ctl.afterScrub - Math.min(ctl.max,1)) < .3 && ctl.played, JSON.stringify(ctl));
  assert(dropReady);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({replayPlayback:true}));
} finally { await browser.close(); }
