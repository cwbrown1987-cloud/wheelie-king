// v2.0 Playground (Jolt): crash for real, hold REWIND, release -> the Jolt body resumes from the restored
// frame (no teleport, jitter or runaway, upright). Then Pause -> Replay -> Drop In lands upright and rides on.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const shots=process.env.WK_REWIND_SHOTS;
const browser=await launchBrowser({extraArgs:['--autoplay-policy=no-user-gesture-required']});
const bikes=(process.env.WK_BIKES||'stock,bike_trax_lime').split(',');
const out={};
try{
 for(const bike of bikes){
 const p=await browser.newPage(pageOptions({viewport:{width:1024,height:460},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('wk-level','arena'));
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
 await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 if(bike!=='stock')await p.evaluate(b=>globalThis.__WK_EQUIP__?.(b),bike);
 await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
 await p.waitForFunction(()=>{const t=globalThis.__WK_TELEMETRY__?.();return t&&t.physics==='jolt'&&t.ready&&globalThis.__WK_REPLAY__;},null,{timeout:120000});
 const tel=()=>p.evaluate(()=>__WK_TELEMETRY__());
 // sample telemetry every rAF for ms
 const watch=ms=>p.evaluate(ms=>new Promise(r=>{const a=[];const t0=performance.now();const f=()=>{const t=__WK_TELEMETRY__();a.push({sp:t.speedKmh,p:t.pitchDeg,r:t.rollDeg,x:t.x,z:t.z,c:t.trick.crashed});if(performance.now()-t0<ms)requestAnimationFrame(f);else r(a)};requestAnimationFrame(f)}),ms);
 await p.keyboard.down('w');await p.waitForTimeout(2500);await p.keyboard.up('w');
 const ridden=await tel();
 assert(ridden.speedKmh>4&&!ridden.trick.crashed,bike+' rides '+JSON.stringify({sp:ridden.speedKmh}));
 // crash for real: wheelie toggle + pinned throttle + lean back
 await p.keyboard.press('Control');await p.keyboard.down('w');await p.keyboard.down('ArrowDown');
 let crashed=null;for(let i=0;i<40&&!crashed;i++){await p.waitForTimeout(150);crashed=(await tel()).trick.crashed;}
 await p.keyboard.up('w');await p.keyboard.up('ArrowDown');await p.keyboard.press('Control');
 let forced=false;
 if(!crashed){forced=true;await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;s.crashed='TEST IMPACT';s.events.push({type:'crash',why:'TEST IMPACT'});});}
 await p.waitForFunction(()=>{const b=document.querySelector('[data-r="rewind"]');return b&&!b.hidden&&getComputedStyle(b).display!=='none'},null,{timeout:10000});
 if(shots)await p.screenshot({path:`${shots}/pg-${bike}-crash.png`});
 const rw=await p.locator('[data-r="rewind"]').boundingBox();
 await p.mouse.move(rw.x+rw.width/2,rw.y+rw.height/2);await p.mouse.down();
 await p.waitForFunction(()=>__WK_RIDE_STATE__().rewinding,null,{timeout:5000});
 const during=await watch(1200);
 await p.mouse.up();
 await p.waitForFunction(()=>!__WK_RIDE_STATE__().rewinding,null,{timeout:5000});
 const atRelease=await p.evaluate(()=>({t:__WK_TELEMETRY__(),drop:__WK_LAST_DROP__?{x:__WK_LAST_DROP__.restored.x,vx:__WK_LAST_DROP__.restored.vx,pitch:__WK_LAST_DROP__.restored.pitch}:null}));
 const after=await watch(2000);
 if(shots)await p.screenshot({path:`${shots}/pg-${bike}-after-rewind.png`});
 const maxJump=a=>a.slice(1).reduce((m,f,i)=>Math.max(m,Math.hypot(f.x-a[i].x,f.z-a[i].z)),0);
 const maxDsp=a=>a.slice(1).reduce((m,f,i)=>Math.max(m,Math.abs(f.sp-a[i].sp)),0);
 const R={forced,crashedHow:crashed,ridden:ridden.speedKmh,release:{sp:atRelease.t.speedKmh,pitch:atRelease.t.pitchDeg,crashed:atRelease.t.trick.crashed,matchX:atRelease.drop?Math.abs(atRelease.t.x-atRelease.drop.x):null},
  after:{maxStepM:maxJump(after),maxDspKmh:maxDsp(after),maxSp:Math.max(...after.map(f=>Math.abs(f.sp))),maxPitch:Math.max(...after.map(f=>Math.abs(f.p))),maxRoll:Math.max(...after.map(f=>Math.abs(f.r))),crashed:after.at(-1).c},rewindFrames:during.length};
 assert(!R.release.crashed&&!R.after.crashed,bike+' not crashed after rewind '+JSON.stringify(R));
 assert(R.release.matchX!=null&&R.release.matchX<.3,bike+' Jolt body at the restored frame '+JSON.stringify(R));
 assert(R.after.maxStepM<1,bike+' no teleport '+JSON.stringify(R));
 assert(R.after.maxDspKmh<4,bike+' no speed jitter '+JSON.stringify(R));
 assert(R.after.maxSp<=Math.max(R.ridden,R.release.sp)+8,bike+' no runaway '+JSON.stringify(R));
 assert(R.after.maxPitch<30&&R.after.maxRoll<35,bike+' upright after rewind '+JSON.stringify(R));
 // Drop In from the replay
 await p.keyboard.down('w');await p.waitForTimeout(1200);await p.keyboard.up('w');
 await p.locator('[data-r="pause"]').tap();await p.waitForTimeout(250);await p.locator('[data-r="menu-replay"]').tap();
 await p.waitForFunction(()=>!document.querySelector('.ride-replay').hidden,null,{timeout:10000});
 await p.evaluate(()=>{const r=document.querySelector('.ride-replay input[type=range]');r.value=String(+r.min+(+r.max-+r.min)*.6);r.dispatchEvent(new Event('input',{bubbles:true}));globalThis.__WK_LAST_DROP__=null;});
 await p.locator('.ride-replay [data-r="drop-in"]').tap({timeout:5000});
 await p.waitForFunction(()=>globalThis.__WK_LAST_DROP__,null,{timeout:5000});
 const d0=await p.evaluate(()=>({t:__WK_TELEMETRY__(),x:__WK_LAST_DROP__.restored.x}));
 await p.waitForTimeout(700);
 const dAfter=await watch(2000);
 const D={matchX:Math.abs(d0.t.x-d0.x),maxStepM:maxJump(dAfter),maxDspKmh:maxDsp(dAfter),maxPitch:Math.max(...dAfter.map(f=>Math.abs(f.p))),maxRoll:Math.max(...dAfter.map(f=>Math.abs(f.r))),crashed:dAfter.at(-1).c};
 assert(D.matchX<.3&&D.maxStepM<1&&D.maxDspKmh<4&&D.maxPitch<30&&D.maxRoll<35&&!D.crashed,bike+' drop-in lands upright '+JSON.stringify(D));
 if(shots)await p.screenshot({path:`${shots}/pg-${bike}-after-dropin.png`});
 assert.deepEqual(errors,[],'page errors '+errors.join(' | '));
 out[bike]={rewind:R,dropIn:D};
 await p.close();
 }
 console.log(JSON.stringify(out));console.log('v2-playground-rewind ok');
}finally{await browser.close()}
