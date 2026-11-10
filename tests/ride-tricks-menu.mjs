// TRICKS is a single style-B button on the right; tap opens a fan of tricks that fire
// (including mid-air), a second tap or a timeout closes it, and the fan stays clear of throttle and brake.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const shots=process.env.WK_TRICKS_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const overlap=(a,b)=>!(a.right<=b.left+1||a.left>=b.right-1||a.bottom<=b.top+1||a.top>=b.bottom-1);
const browser=await launchBrowser();
try{
 const results=[];
 for(const [name,vp] of [['phone',{width:844,height:390,hasTouch:true,isMobile:true}],['desktop',{width:1280,height:720}]]){
  const p=await browser.newPage(pageOptions({viewport:{width:vp.width,height:vp.height},hasTouch:!!vp.hasTouch,isMobile:!!vp.isMobile,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
  await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded,null,{timeout:90000});
  const closed=await p.evaluate(()=>{
   const toggle=document.querySelector('[data-r=tricks]');
   const fan=document.querySelector('.ride-tricks-fan');
   const hop=document.querySelector('[data-t=hop]');
   const fanBtns=[...document.querySelectorAll('.ride-tricks-fan [data-t]')].map(b=>({t:b.dataset.t,label:b.textContent.trim()}));
   return {
    toggle:toggle?.textContent.trim(),
    toggleBox:toggle?.getBoundingClientRect().toJSON(),
    open:document.querySelector('.ride-tricks.is-open')!=null||toggle?.getAttribute('aria-expanded')==='true',
    fanHidden:fan&&(getComputedStyle(fan).visibility==='hidden'||getComputedStyle(fan).pointerEvents==='none'),
    hopLeft:hop?hop.getBoundingClientRect().left:null,
    fanBtns
   };
  });
  assert.equal(closed.toggle,'TRICKS',name+' has a TRICKS button');
  assert.equal(closed.open,false,name+' starts collapsed');
  assert(closed.fanHidden,name+' fan is hidden until opened');
  assert.deepEqual(closed.fanBtns.map(b=>b.t),['tailwhip','barspin','superman','trick'],name+' fan set '+JSON.stringify(closed.fanBtns));
  assert(!closed.fanBtns.some(b=>b.t==='hop'),name+' HOP stays out of the fan');
  assert(closed.hopLeft!=null&&closed.hopLeft<closed.toggleBox.left,name+' HOP stays on the left');
  if(shots)await p.screenshot({path:`${shots}/after-${name}-closed.png`});

  await p.locator('[data-r=tricks]').click();
  await p.waitForFunction(()=>__WK_RIDE_STATE__().tricksOpen,null,{timeout:3000});
  const opened=await p.evaluate(()=>{
   const fan=document.querySelector('.ride-tricks-fan');
   const throttle=document.querySelector('.ride-drive.throttle');
   const brake=document.querySelector('.ride-drive.brake');
   const boxes=[...fan.querySelectorAll('button')].map(b=>b.getBoundingClientRect().toJSON());
   return {
    open:true,
    fan:fan.getBoundingClientRect().toJSON(),
    boxes,
    throttle:throttle?.getBoundingClientRect().toJSON()||null,
    brake:brake?.getBoundingClientRect().toJSON()||null,
    vh:innerHeight,vw:innerWidth,
    vis:getComputedStyle(fan).visibility
   };
  });
  assert.equal(opened.vis,'visible',name+' fan is visible after a tap');
  assert(opened.boxes.length===4,name+' four trick buttons fan out');
  const hit=el=>opened.boxes.some(b=>overlap(b,el));
  assert(opened.throttle&&!overlap(opened.fan,opened.throttle)&&!hit(opened.throttle),name+' fan does not cover the throttle '+JSON.stringify({fan:opened.fan,throttle:opened.throttle}));
  assert(opened.brake&&!overlap(opened.fan,opened.brake)&&!hit(opened.brake),name+' fan does not cover the brake '+JSON.stringify({fan:opened.fan,brake:opened.brake}));
  if(shots)await p.screenshot({path:`${shots}/after-${name}-open.png`});

  await p.locator('.ride-tricks-fan [data-t=tailwhip]').click();
  const fired=await p.evaluate(()=>{
   const s=__WK_RIDE_STATE__();
   return {open:s.tricksOpen,request:s.s.stuntRequest||null,stunt:s.stunt,tailwhip:s.inp?.tailwhip};
  });
  assert(fired.open,name+' fan stays open after a trick so it can be used mid-air');
  assert(fired.request?.name==='tailwhip'||fired.stunt?.name==='tailwhip'||fired.tailwhip,name+' tap fires the trick '+JSON.stringify(fired));

  await p.locator('[data-r=tricks]').click();
  await p.waitForFunction(()=>__WK_RIDE_STATE__().tricksOpen===false,null,{timeout:3000});

  // Mid-air: hop, then open and fire a barspin while off the ground.
  await p.locator('[data-t=hop]').click();
  await p.locator('[data-r=tricks]').click();
  await p.waitForFunction(()=>__WK_RIDE_STATE__().tricksOpen,null,{timeout:3000});
  await p.locator('.ride-tricks-fan [data-t=barspin]').click();
  const air=await p.evaluate(()=>{
   const s=__WK_RIDE_STATE__();
   return {open:s.tricksOpen,request:s.s.stuntRequest||null,stunt:s.stunt,barspin:s.inp?.barspin};
  });
  assert(air.open,name+' fan stays usable mid-air');
  assert(air.request?.name==='barspin'||air.stunt?.name==='barspin'||air.barspin,name+' mid-air trick fires '+JSON.stringify(air));

  // Timeout collapses the fan.
  await p.waitForTimeout(2300);
  const timed=await p.evaluate(()=>__WK_RIDE_STATE__().tricksOpen);
  assert.equal(timed,false,name+' timeout collapses the fan');

  assert.deepEqual(errors,[],'page errors '+errors.join(' | '));
  results.push({name,openClear:true});
  await p.close();
 }
 console.log(JSON.stringify({tricksMenu:true,results}));
}finally{await browser.close()}
