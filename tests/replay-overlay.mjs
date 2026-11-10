// Replay overlay: all controls on the video, no scrolling at phone landscape (1024x460, 844x390) and portrait
// (390x844); every control visible and hit-testable; a touch drag on the tall seek bar moves the playhead.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8931/',shots=process.env.WK_REPLAY_SHOTS;
const browser=await launchBrowser({extraArgs:['--autoplay-policy=no-user-gesture-required']});
try{
 for(const [w,h] of [[1024,460],[844,390],[390,844]]){
  const p=await browser.newPage(pageOptions({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
  await p.goto(URL0);await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>document.querySelector('[data-destination=race]').click());
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_REPLAY__,null,{timeout:90000});
  await p.keyboard.down('ArrowUp');await p.waitForTimeout(4500);await p.keyboard.up('ArrowUp');
  await p.locator('[data-r="pause"]').tap();await p.waitForTimeout(250);await p.locator('[data-r="menu-replay"]').tap();
  await p.waitForFunction(()=>{const v=document.querySelector('.ride-replay video');return !document.querySelector('.ride-replay').hidden&&v.readyState>=2&&+document.querySelector('.ride-replay input[type=range]').max>0},null,{timeout:15000});
  await p.waitForTimeout(700);
  const lay=await p.evaluate(()=>{const s=document.querySelector('.ride-replay'),R=s.getBoundingClientRect(),v=s.querySelector('video').getBoundingClientRect();
   const ctl=['[data-r=replay-close]','[data-r=latest-run]','[data-r=replay-play]','[data-r=drop-in]','[data-r=save-shot-gallery]','[data-r=save-video-gallery]','[data-r=save-video-device]','[data-r=replay-seek]','input[type=range]'];
   const out={scroll:s.scrollHeight>s.clientHeight+1||s.scrollWidth>s.clientWidth+1,docScroll:document.scrollingElement.scrollHeight>innerHeight+1,panel:[R.left,R.top,R.width,R.height],videoFill:Math.min(v.width/R.width,v.height/R.height),bad:[]};
   for(const q of ctl){const e=s.querySelector(q);if(!e){out.bad.push(q+' missing');continue}const b=e.getBoundingClientRect();
    const inside=b.width>0&&b.height>0&&b.left>=R.left-1&&b.right<=R.right+1&&b.top>=R.top-1&&b.bottom<=R.bottom+1&&b.bottom<=innerHeight&&b.right<=innerWidth;
    const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2),reach=q==='input[type=range]'?!!hit?.closest('[data-r=replay-seek]'):(hit===e||e.contains(hit));
    if(!inside||!reach)out.bad.push(q+(inside?' covered by '+(hit?.className||hit?.tagName):' outside '+JSON.stringify([b.left,b.top,b.width,b.height])));
    if(q==='[data-r=replay-seek]'&&b.height<44)out.bad.push('seek touch area '+b.height+'px');
    if(['[data-r=replay-play]','[data-r=drop-in]','[data-r=save-shot-gallery]'].includes(q)&&b.height<40)out.bad.push(q+' short '+b.height);}
   // evenly sized secondary buttons
   const sec=['[data-r=save-shot-gallery]','[data-r=save-video-gallery]','[data-r=save-video-device]'].map(q=>s.querySelector(q).getBoundingClientRect());
   out.rowY=sec.map(b=>Math.round(b.top));out.widths=sec.map(b=>Math.round(b.width));return out;});
  assert(!lay.scroll&&!lay.docScroll,`${w}x${h} no scrolling `+JSON.stringify(lay));
  assert.deepEqual(lay.bad,[],`${w}x${h} controls visible + clickable`);
  assert(lay.videoFill>.97,`${w}x${h} video fills the panel `+lay.videoFill);
  assert(new Set(lay.rowY).size===1&&Math.max(...lay.widths)-Math.min(...lay.widths)<=2,`${w}x${h} save buttons on one row, evenly sized `+JSON.stringify(lay));
  // touch drag along the seek bar (CDP touch, like a finger): playhead follows, panel stays, page doesn't scroll
  const bb=await p.locator('[data-r=replay-seek]').boundingBox(),inp=await p.locator('[data-r=replay-seek] input').boundingBox(),cdp=await p.context().newCDPSession(p),y=bb.y+bb.height*.15;
  const t0=await p.evaluate(()=>document.querySelector('.ride-replay video').currentTime);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:inp.x+inp.width*.15,y}]});
  for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:inp.x+inp.width*(.15+i*.05),y:y+(i%3)}]});await p.waitForTimeout(20);}
  const mid=await p.evaluate(()=>{const r=document.querySelector('.ride-replay input[type=range]');return (+r.value-+r.min)/(+r.max-+r.min)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(400);
  const after=await p.evaluate(()=>{const r=document.querySelector('.ride-replay input[type=range]'),v=document.querySelector('.ride-replay video'),e=document.querySelector('[data-wk-ride-surface]');return {k:(+r.value-+r.min)/(+r.max-+r.min),ct:v.currentTime,val:+r.value,panel:!document.querySelector('.ride-replay').hidden,reviewing:e.hasAttribute('data-wk-reviewing'),sy:scrollY}});
  assert(Math.abs(after.k-.75)<.06&&mid>.3,`${w}x${h} touch drag moved the playhead to the finger `+JSON.stringify({mid,after}));
  assert(Math.abs(after.ct-after.val)<.35&&after.ct!==t0,`${w}x${h} video follows the seek `+JSON.stringify({t0,after}));
  assert(after.panel&&after.reviewing&&after.sy===0,`${w}x${h} still in replay, no page scroll `+JSON.stringify(after));
  // Drop In is still a working primary button from the overlay (pause first: emulated Chrome eats a tap that lands <1 s after a touch drag)
  await p.waitForTimeout(1200);
  await p.locator('.ride-replay [data-r="drop-in"]').tap();await p.waitForTimeout(800);
  const back=await p.evaluate(()=>({panel:!document.querySelector('.ride-replay').hidden,reviewing:document.querySelector('[data-wk-ride-surface]').hasAttribute('data-wk-reviewing')}));
  assert(!back.panel&&!back.reviewing,`${w}x${h} Drop In from the overlay `+JSON.stringify(back));
  if(shots){await p.locator('[data-r="pause"]').tap();await p.waitForTimeout(250);await p.locator('[data-r="menu-replay"]').tap();await p.waitForTimeout(1500);await p.screenshot({path:`${shots}/replay-${w}x${h}.png`});}
  assert.deepEqual(errors,[]);console.log('replay-overlay',w+'x'+h,'ok',JSON.stringify({widths:lay.widths,panel:lay.panel.map(Math.round)}));
  await p.close();
 }
}finally{await browser.close();}
