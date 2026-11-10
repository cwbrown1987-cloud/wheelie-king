// Landscape only: the manifest is landscape, and a touch device in portrait gets a style-B
// "rotate your phone" overlay that pauses the ride. Desktop portrait does not show it.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const man=JSON.parse(readFileSync(join(root,'manifest.webmanifest'),'utf8'));
assert.equal(man.orientation,'landscape','manifest locks to landscape');

const shots=process.env.WK_REWIND_SHOTS||process.env.WK_ROTATE_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const browser=await launchBrowser();
try{
 const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
 await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 const landscape=await p.evaluate(()=>{
  const el=document.querySelector('.wk-rotate-lock');
  return {active:!!document.body.classList.contains('wk-portrait-lock'),hidden:!el||el.hidden||!el.classList.contains('is-on')};
 });
 assert.equal(landscape.active,false,'no lock in landscape '+JSON.stringify(landscape));
 assert(landscape.hidden,'overlay hidden in landscape');
 await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
 await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded,null,{timeout:90000});
 await p.keyboard.down('ArrowUp');
 await p.waitForFunction(()=>Math.abs(__WK_RIDE_STATE__().s.vx)>1,null,{timeout:15000});
 const x0=await p.evaluate(()=>__WK_RIDE_STATE__().s.x);
 await p.waitForTimeout(300);
 const moving=await p.evaluate(x=>__WK_RIDE_STATE__().s.x-x,x0);
 assert(Math.abs(moving)>0.05,'ride is running in landscape '+moving);

 await p.setViewportSize({width:390,height:844});
 await p.waitForFunction(()=>{
  const el=document.querySelector('.wk-rotate-lock');
  return document.body.classList.contains('wk-portrait-lock')&&el&&!el.hidden&&el.classList.contains('is-on');
 },null,{timeout:8000});
 const locked=await p.evaluate(()=>{
  const el=document.querySelector('.wk-rotate-lock'),card=el?.querySelector('.wk-rotate-lock-card');
  const cs=card?getComputedStyle(card):{};
  return {
    text:el?.innerText||'',
    x:__WK_RIDE_STATE__().s.x,
    vx:__WK_RIDE_STATE__().s.vx,
    z:el?+getComputedStyle(el).zIndex:0,
    bg:cs.backgroundImage||cs.backgroundColor||''
  };
 });
 assert(/ROTATE YOUR PHONE/i.test(locked.text),'overlay copy '+locked.text);
 assert(locked.z>=20000,'overlay covers the game');
 if(shots)await p.screenshot({path:`${shots}/rotate-lock.png`});
 await p.waitForTimeout(400);
 const held=await p.evaluate(x=>__WK_RIDE_STATE__().s.x-x,locked.x);
 assert(Math.abs(held)<0.02,'ride is paused in portrait '+JSON.stringify({held,locked}));

 await p.setViewportSize({width:844,height:390});
 await p.waitForFunction(()=>!document.body.classList.contains('wk-portrait-lock')&&document.querySelector('.wk-rotate-lock')?.hidden,null,{timeout:8000});
 const x1=await p.evaluate(()=>__WK_RIDE_STATE__().s.x);
 await p.waitForTimeout(400);
 const resumed=await p.evaluate(x=>__WK_RIDE_STATE__().s.x-x,x1);
 assert(Math.abs(resumed)>0.05,'ride resumes in landscape '+resumed);
 await p.keyboard.up('ArrowUp');
 await p.close();

 const desk=await browser.newPage(pageOptions({viewport:{width:900,height:1200},deviceScaleFactor:1,serviceWorkers:'block'}));
 desk.on('pageerror',e=>errors.push(e.message));
 await desk.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
 await desk.waitForFunction(()=>document.querySelector('[data-wk-room-ready]')||document.querySelector('.wk-rotate-lock'),null,{timeout:180000});
 const desktop=await desk.evaluate(()=>{
  const el=document.querySelector('.wk-rotate-lock');
  return {active:!!document.body.classList.contains('wk-portrait-lock'),on:!!el?.classList.contains('is-on'),touch:navigator.maxTouchPoints||0};
 });
 assert.equal(desktop.active,false,'desktop tall window is not locked '+JSON.stringify(desktop));
 assert.equal(desktop.on,false,'desktop does not show the overlay');
 await desk.close();
 assert.deepEqual(errors,[],'page errors '+errors.join(' | '));
 console.log(JSON.stringify({manifestLandscape:true,touchPortraitPauses:true,landscapeResumes:true,desktopIgnored:true,errors}));
}finally{await browser.close()}
