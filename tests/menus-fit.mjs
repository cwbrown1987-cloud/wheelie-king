// Settings fits and scrolls on phones (landscape 1024x460); replay panel's Drop In row fits.
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';const shots=process.env.WK_MENU_SHOTS;
const touchScroll=async(p,box,dy)=>{const c=await p.context().newCDPSession(p);const x=box.x+box.width/2,y=box.y+box.height*.7;await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-dy*i/8}]});await p.waitForTimeout(16);}await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(400);};
try{
 for(const [w,h] of [[1024,460]]){
  const p=await browser.newPage(pageOptions({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(URL0);await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});await p.waitForTimeout(1500);
  const scaled=p.getByRole('button',{name:'PLAY SCALED'});if(await scaled.isVisible().catch(()=>false))await scaled.tap();
  await p.locator('[data-destination="more"]').tap();await p.getByRole('menuitem',{name:'Settings',exact:true}).tap();
  const panel=p.locator('[data-wk-menu-panel]');await panel.waitFor({timeout:10000});await p.waitForTimeout(500);
  const m=await panel.evaluate(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {top:r.top,bottom:r.bottom,sh:e.scrollHeight,ch:e.clientHeight,ov:c.overflowY,vh:innerHeight,vw:innerWidth,right:r.right,left:r.left}});
  assert(['auto','scroll'].includes(m.ov),'settings panel scrolls '+JSON.stringify(m));
  assert(m.bottom<=m.vh+1&&m.top>=0&&m.left>=-1&&m.right<=m.vw+1,`settings panel inside the ${w}x${h} screen `+JSON.stringify(m));
  if(shots)await p.screenshot({path:`${shots}/settings-${w}x${h}.png`});
  const last=p.getByRole('button',{name:'RESET',exact:true});
  if(m.sh>m.ch+2){const box=await panel.boundingBox();for(let i=0;i<6;i++){await touchScroll(p,box,Math.min(220,box.height*.6));if(await last.evaluate(e=>{const r=e.getBoundingClientRect(),q=e.closest('[data-wk-menu-panel]').getBoundingClientRect();return r.bottom<=q.bottom+1&&r.top>=q.top-1}))break;}
   const st=await panel.evaluate(e=>e.scrollTop);assert(st>0,'finger drag scrolled the settings panel');}
  assert(await last.evaluate(e=>{const r=e.getBoundingClientRect(),q=e.closest('[data-wk-menu-panel]').getBoundingClientRect();return r.bottom<=Math.min(q.bottom,innerHeight)+1&&r.top>=q.top-1}),`last setting (Reset progress) reachable at ${w}x${h}`);
  if(shots)await p.screenshot({path:`${shots}/settings-${w}x${h}-scrolled.png`});
  assert.deepEqual(errors,[]);await p.close();
 }
 // replay panel in phone landscape: scrubber and Drop In visible without scrolling
 const p=await browser.newPage(pageOptions({viewport:{width:1024,height:460},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
 await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
 await p.goto(withLegacy(URL0));await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.locator('[data-wk-nav="race"],[data-destination="race"]').first().tap().catch(()=>p.locator('[data-destination="race"]').first().click());
 await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_REPLAY__,null,{timeout:90000});
 await p.keyboard.down('ArrowUp');await p.waitForTimeout(1500);await p.keyboard.up('ArrowUp');
 await p.locator('[data-r="pause"]').tap();await p.waitForTimeout(250);
 const pm=await p.locator('.ride-pause-menu').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,vh:innerHeight}});assert(pm.top>=0&&pm.bottom<=pm.vh+1,'pause menu fits '+JSON.stringify(pm));
 await p.locator('[data-r="menu-replay"]').tap();await p.waitForFunction(()=>!document.querySelector('.ride-replay').hidden,null,{timeout:10000});await p.waitForTimeout(800);
 const fit=await p.evaluate(()=>{const q=s=>document.querySelector(s).getBoundingClientRect();const panel=q('.ride-replay'),drop=q('.ride-replay [data-r="drop-in"]'),scrub=q('.ride-replay input[type=range]');return {panel:[panel.top,panel.bottom],drop:[drop.top,drop.bottom],scrub:[scrub.top,scrub.bottom],vh:innerHeight}});
 assert(fit.panel[0]>=0&&fit.panel[1]<=fit.vh+1,'replay panel fits '+JSON.stringify(fit));assert(fit.drop[1]<=fit.panel[1]&&fit.drop[1]<=fit.vh,'Drop In visible '+JSON.stringify(fit));
 if(shots)await p.screenshot({path:`${shots}/replay-1024x460.png`});
 console.log('menus-fit: ok');
}finally{await browser.close();}
