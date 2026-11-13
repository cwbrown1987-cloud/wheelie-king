// Pause → Replay → scrub stays in Replay; Drop In restores the exact frame (mid-trick); 3 Drop Ins in a row keep
// the game running (regression: .is-dropping left the next replay panel invisible and the game frozen).
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser({extraArgs:['--autoplay-policy=no-user-gesture-required']});
const shots=process.env.WK_REPLAY_SHOTS;
try{
 const p=await browser.newPage(pageOptions({viewport:{width:1024,height:460},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
 await p.goto(withLegacy(process.env.WK_TEST_URL||'http://127.0.0.1:8931/'));
 await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.locator('[data-destination="race"]').first().click();
 await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_REPLAY__,null,{timeout:90000});
 await p.evaluate(()=>{globalThis.__wkFrames=0;const f=()=>{__wkFrames++;requestAnimationFrame(f)};requestAnimationFrame(f);});
 const ui=()=>p.evaluate(()=>{const e=document.querySelector('[data-wk-ride-surface]'),panel=document.querySelector('.ride-replay');return {reviewing:e.hasAttribute('data-wk-reviewing'),paused:e.hasAttribute('data-wk-paused'),panel:!panel.hidden,dropping:panel.classList.contains('is-dropping'),opacity:+getComputedStyle(panel).opacity,frames:__wkFrames,x:__WK_RIDE_STATE__().s.x}});
 const openReplay=async()=>{await p.locator('[data-r="pause"]').tap();await p.waitForTimeout(250);await p.locator('[data-r="menu-replay"]').tap();await p.waitForFunction(()=>!document.querySelector('.ride-replay').hidden,null,{timeout:10000});await p.waitForTimeout(900);};
 const ride=async ms=>{await p.keyboard.down('ArrowUp');await p.waitForTimeout(ms);await p.keyboard.up('ArrowUp');};
 // a real trick: launch into the air and press barspin (x) so the physics starts the stunt
 await ride(2500);
 await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;s.y+=.6;s.vy=5.5;s.ground=[false,false];s.wasAir=true;});
 await p.keyboard.down('x');await p.waitForTimeout(120);await p.keyboard.up('x');
 await p.waitForFunction(()=>__WK_REPLAY__.buffer.length&&(()=>{const b=__WK_REPLAY__.buffer;for(let i=0;i<b.length;i+=8){const f=b.at(i/b.length);if(f?.s.stunt&&f.s.stunt.elapsed>.2)return true;}return false})(),null,{timeout:20000});
 await ride(800);

 // ---- 1) pause → replay → scrub (touch): still in replay, even when a slow-mo clip timer fires
 await p.evaluate(()=>__WK_REPLAY__.start());await p.waitForTimeout(300);
 await openReplay();
 let u=await ui();assert(u.reviewing&&u.panel&&u.paused,'replay open from pause '+JSON.stringify(u));
 const bb=await p.locator('.ride-replay input[type=range]').first().boundingBox();const cdp=await p.context().newCDPSession(p);const y=bb.y+bb.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bb.x+bb.width*.85,y}]});
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:bb.x+bb.width*(.85-i*.04),y}]});await p.waitForTimeout(25);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await p.evaluate(()=>__WK_REPLAY__.finish()); // the slow-mo clip stops while Replay is open
 await p.waitForTimeout(1500);u=await ui();assert(u.reviewing&&u.panel&&!u.dropping,'scrub stays in replay '+JSON.stringify(u));
 if(process.env.WK_REPLAY_LONG){await p.waitForTimeout(16000);u=await ui();assert(u.reviewing&&u.panel,'replay not auto-closed '+JSON.stringify(u));}
 if(shots)await p.screenshot({path:shots+'/replay-scrub.png'});

 // ---- 2) scrub to mid-trick → Drop In → state equals that frame
 const target=await p.evaluate(()=>{const b=__WK_REPLAY__.buffer,a=__WK_REPLAY__._anchor();let best=null;for(let i=0;i<b.length;i++){const f=b.at(i/(b.length-1));if(f?.s.stunt&&Math.abs(f.s.stunt.elapsed/f.s.stunt.duration-.5)<.12){best=f;break;}}
  if(!best)return null;const r=document.querySelector('.ride-replay input[type=range]');const v=a.mode==='end'?a.scrubMax-(a.wall-best.w):(a.novideo?0:a.start0)+(best.w-a.wall);
  r.value=String(v);r.dispatchEvent(new Event('input',{bubbles:true}));const dv=document.querySelector('.ride-replay video');if(dv)dv.ontimeupdate=null;
  const exp=__WK_REPLAY__.buffer.atWall(a.mode==='end'?a.wall-(+r.max-+r.value):a.wall+(+r.value-(a.novideo?0:a.start0)));return {w:exp.w,s:exp.s,value:+r.value,a}});
 assert(target&&target.s.stunt,'found a mid-trick frame '+JSON.stringify(target?.a));
 await p.evaluate(()=>{globalThis.__WK_LAST_DROP__=null});
 await p.locator('.ride-replay [data-r="drop-in"]').tap();
 await p.waitForFunction(()=>globalThis.__WK_LAST_DROP__,null,{timeout:5000});
 const got=await p.evaluate(()=>__WK_LAST_DROP__);
 assert.equal(got.frame.w,target.w,'dropped at the scrubbed frame');
 for(const k of ['x','y','vx','vy','pitch','w','air','airRot','spin','spinV','trick','trickT','score'])assert.deepEqual(got.restored[k],target.s[k],'restored '+k);
 assert.deepEqual(got.restored.stunt,target.s.stunt,'mid-trick stunt restored');assert.deepEqual(got.restored.ground,target.s.ground);assert.deepEqual(got.restored.pendingStunts,target.s.pendingStunts);
 await p.waitForTimeout(800);u=await ui();assert(!u.reviewing&&!u.panel&&!u.paused,'back in the ride after Drop In '+JSON.stringify(u));

 // ---- 3) three Drop Ins in a row: no hang, frame loop and physics keep running
 for(let n=0;n<3;n++){
  await ride(900);await openReplay();u=await ui();
  assert(u.panel&&u.reviewing&&!u.dropping&&u.opacity>.9,`replay ${n+1} visible and interactive `+JSON.stringify(u));
  await p.evaluate(()=>{const r=document.querySelector('.ride-replay input[type=range]');r.value=String(+r.min+(+r.max-+r.min)*.7);r.dispatchEvent(new Event('input',{bubbles:true}))});
  await p.locator('.ride-replay [data-r="drop-in"]').tap({timeout:5000});
  await p.waitForTimeout(700);
  const f0=await Promise.race([ui(),new Promise(r=>setTimeout(()=>r(null),10000))]);assert(f0,'page responsive after Drop In '+(n+1));
  assert(!f0.reviewing&&!f0.panel&&!f0.dropping&&!f0.paused,`Drop In ${n+1} returned to the ride `+JSON.stringify(f0));
  await ride(600);const f1=await ui();assert(f1.frames>f0.frames+5,`frame loop running after Drop In ${n+1}`);assert(f1.x!==f0.x,`physics running after Drop In ${n+1} `+JSON.stringify([f0.x,f1.x]));
 }
 if(shots)await p.screenshot({path:shots+'/after-3-dropins.png'});
 assert.deepEqual(errors,[]);
 console.log('replay-dropin: ok',JSON.stringify({mode:target.a.mode,frameW:+target.w.toFixed(3),stunt:target.s.stunt}));
}finally{await browser.close();}
