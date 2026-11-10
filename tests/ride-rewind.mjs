// After a crash, hold REWIND walks the ride-buffer backward at 2x; release restores that state's velocity.
// Repeated rewind-and-resume cycles keep the buffer inside its 20s cap.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const shots=process.env.WK_REWIND_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const browser=await launchBrowser();
try{
 const p=await browser.newPage(pageOptions({viewport:{width:1280,height:720},serviceWorkers:'block'}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
 await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
 await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
 await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_REPLAY__,null,{timeout:90000});
 await p.keyboard.down('ArrowUp');
 await p.waitForFunction(()=>{
  const r=__WK_RIDE_STATE__(),b=__WK_REPLAY__.buffer;
  return r.s.x>10&&b.length>40&&Math.abs(r.s.vx)>2;
 },null,{timeout:20000});
 await p.keyboard.up('ArrowUp');
 const before=await p.evaluate(()=>{
  const b=__WK_REPLAY__.buffer,last=b.at(1);
  return {x:last.s.x,vx:last.s.vx,t:last.t,n:b.length,seconds:b.seconds};
 });
 await p.evaluate(()=>{
  const s=__WK_RIDE_STATE__().s;
  Object.assign(s,{crashed:'TEST IMPACT',vy:-2,w:2});
  s.events.push({type:'crash',why:'TEST IMPACT'});
 });
 await p.waitForFunction(()=>{
  const bar=document.querySelector('.ride-crash-actions');
  const btn=document.querySelector('[data-r="rewind"]');
  return btn&&bar&&!bar.hidden&&getComputedStyle(bar).display!=='none';
 },null,{timeout:10000});
 const rewind=p.locator('[data-r="rewind"]');
 assert(await rewind.isVisible(),'REWIND button shows after crash');
 assert(await p.getByRole('button',{name:'Instant recover'}).isVisible(),'RECOVER stays available');
 if(shots)await p.screenshot({path:shots+'/desktop-crash.png'});

 const hold=async(ms)=>{
  const box=await rewind.boundingBox();
  assert(box,'REWIND box');
  await p.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await p.mouse.down();
  await p.waitForFunction(()=>__WK_RIDE_STATE__().rewinding,null,{timeout:5000});
  if(ms)await p.waitForTimeout(ms);
 };
 const release=async()=>{
  await p.mouse.up();
  await p.waitForFunction(()=>!__WK_RIDE_STATE__().rewinding,null,{timeout:5000});
 };

 await hold();
 await p.waitForFunction(t0=>{
  const r=__WK_RIDE_STATE__();
  return r.rewinding&&r.rewindT<t0-0.25&&r.s.x>0;
 },before.t,{timeout:8000});
 const mid=await p.evaluate(()=>{
  const r=__WK_RIDE_STATE__(),frame=__WK_REPLAY__.buffer.at(r.rewindT,true);
  const btn=document.querySelector('[data-r="rewind"]');
  return {x:r.s.x,vx:r.s.vx,t:r.rewindT,frameVx:frame.s.vx,frameX:frame.s.x,crashed:r.s.crashed,held:btn.classList.contains('is-held')};
 });
 assert(mid.held,'hold shows pressed state');
 assert(mid.t<before.t-0.2,'hold rewinds time '+JSON.stringify({mid,before}));
 assert(mid.x<before.x-0.2,'hold moves the bike back '+JSON.stringify({mid,before}));
 if(shots)await p.screenshot({path:shots+'/desktop-rewinding.png'});
 await release();
 const after=await p.evaluate(()=>{
  const r=__WK_RIDE_STATE__(),b=__WK_REPLAY__.buffer,last=b.at(1);
  return {x:r.s.x,vx:r.s.vx,crashed:r.s.crashed,n:b.length,t:last.t,barHidden:document.querySelector('.ride-crash-actions').hidden};
 });
 assert.ok(Math.abs(after.vx-mid.frameVx)<0.08,'release restores velocity '+JSON.stringify({after,mid}));
 assert.ok(Math.abs(after.x-mid.frameX)<0.08,'release restores position '+JSON.stringify({after,mid}));
 assert.ok(!after.crashed,'crash clears when rewound to before it '+JSON.stringify(after));
 assert(after.barHidden,'crash bar hides after a pre-crash restore');
 assert(Math.abs(after.t-mid.t)<0.08,'buffer is trimmed to the playhead '+JSON.stringify({after,mid}));
 await p.waitForTimeout(250);
 const later=await p.evaluate(()=>({x:__WK_RIDE_STATE__().s.x,vx:__WK_RIDE_STATE__().s.vx,crashed:__WK_RIDE_STATE__().s.crashed}));
 assert(!later.crashed,'stays un-crashed after release');
 assert(Math.abs(later.x-after.x)>0.05,'play continues from the restored velocity '+JSON.stringify({later,after}));
 if(shots)await p.screenshot({path:shots+'/desktop-released.png'});

 for(let i=0;i<8;i++){
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(400);
  await p.keyboard.up('ArrowUp');
  await p.evaluate(()=>{
   const s=__WK_RIDE_STATE__().s;
   Object.assign(s,{crashed:'TEST IMPACT'});
   s.events.push({type:'crash',why:'TEST IMPACT'});
  });
  await p.waitForFunction(()=>!document.querySelector('.ride-crash-actions').hidden,null,{timeout:8000});
  await hold(350);
  await release();
 }
 const bound=await p.evaluate(()=>{
  const b=__WK_REPLAY__.buffer,first=b.at(0),last=b.at(1);
  return {n:b.length,span:last.t-first.t,seconds:b.seconds};
 });
 assert(bound.span<=bound.seconds+0.08,'buffer stays inside the 20s cap '+JSON.stringify(bound));
 assert(bound.n<=20*480+50,'frame count stays bounded '+JSON.stringify(bound));

 if(shots){
  const phone=await browser.newPage(pageOptions({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'}));
  phone.on('pageerror',e=>errors.push(e.message));
  await phone.addInitScript(()=>localStorage.setItem('wk-level','trials'));
  await phone.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
  await phone.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await phone.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await phone.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await phone.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_REPLAY__,null,{timeout:90000});
  await phone.evaluate(()=>{const s=__WK_RIDE_STATE__().s;s.vx=8;s.x=Math.max(s.x,6)});
  await phone.waitForTimeout(600);
  await phone.evaluate(()=>{
   const s=__WK_RIDE_STATE__().s;
   Object.assign(s,{crashed:'TEST IMPACT',vy:-2,w:2});
   s.events.push({type:'crash',why:'TEST IMPACT'});
  });
  await phone.waitForFunction(()=>{
   const bar=document.querySelector('.ride-crash-actions');
   return document.querySelector('[data-r="rewind"]')&&bar&&!bar.hidden;
  },null,{timeout:10000});
  await phone.screenshot({path:shots+'/phone-crash.png'});
  const box=await phone.locator('[data-r="rewind"]').boundingBox();
  await phone.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  // tap is down+up; for a hold use CDP if needed — just confirm the button is on-screen on a phone
  await phone.close();
 }
 assert.deepEqual(errors,[],'page errors '+errors.join(' | '));
 console.log(JSON.stringify({holdRewinds:true,releaseRestoresVelocity:true,memoryBounded:bound,errors}));
}finally{await browser.close()}
