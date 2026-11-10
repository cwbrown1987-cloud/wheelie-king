// Menus opened over a ride (More / Settings, Shop / Garage views) must not record: the replay video, the Drop In
// buffer and its capture clock hold live riding only, so a clip never shows the bike sitting still for the menu time.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser({extraArgs:['--autoplay-policy=no-user-gesture-required']});
const MENU_MS=+(process.env.WK_MENU_MS||10000);
try{
 const p=await browser.newPage(pageOptions({viewport:{width:1024,height:460},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
 await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.evaluate(()=>document.querySelector('[data-destination=race]').click());
 await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_REPLAY__,null,{timeout:90000});
 const st=()=>p.evaluate(()=>{const R=__WK_REPLAY__,r=R.ring;return {wall:R.buffer.wall,len:R.buffer.length,lastW:R.buffer.length?R.buffer.atWall(1e9).w:0,rec:(()=>{try{return R._recState?.()}catch{return null}})(),now:performance.now()}});
 const ride=async ms=>{await p.keyboard.down('ArrowUp');await p.waitForTimeout(ms);await p.keyboard.up('ArrowUp');};
 const tStart=Date.now();await ride(3000);
 // 1) the More menu (role=menu) for MENU_MS: capture clock and buffer stand still
 const a0=await st();await p.evaluate(()=>document.querySelector('[data-destination=more]').click());
 await p.waitForFunction(()=>{const m=document.querySelector('.wk-more');return m&&m.getClientRects().length},null,{timeout:5000});
 const tm0=Date.now();await p.waitForTimeout(MENU_MS);const a1=await st();
 await p.evaluate(()=>document.querySelector('[data-destination=more]').click());await p.waitForTimeout(400);
 const menuOpen=await p.evaluate(()=>{const m=document.querySelector('.wk-more');return !!(m&&m.getClientRects().length)});
 if(menuOpen)await p.mouse.click(600,250);const menuReal=Date.now()-tm0;
 assert(a1.wall-a0.wall<.6,'capture clock paused while the More menu is open '+JSON.stringify([a0,a1]));
 assert(a1.len-a0.len<300,'no ride-buffer frames while the More menu is open '+JSON.stringify([a0.len,a1.len]));
 // 2) a lounge view (Shop / Garage sets body[data-player-view]) behaves the same
 await ride(1500);const b0=await st();
 const ts0=Date.now();await p.evaluate(()=>{document.body.dataset.playerView='shop'});await p.waitForTimeout(+(process.env.WK_SHOP_MS||3000));const b1=await st();await p.evaluate(()=>{delete document.body.dataset.playerView});const shopReal=Date.now()-ts0;
 assert(b1.wall-b0.wall<.6&&b1.len-b0.len<300,'no capture while a Shop/Garage view is open '+JSON.stringify([b0,b1]));
 // 3) ride again, open Replay: the clip length ~ live riding time, no MENU_MS static stretch
 await ride(3000);const c=await st();
 assert(c.wall-b1.wall>.3,'capture resumes when riding resumes '+JSON.stringify([b1.wall,c.wall]));
 const tOpen=Date.now();await p.locator('[data-r="pause"]').tap();await p.waitForTimeout(250);await p.locator('[data-r="menu-replay"]').tap();
 await p.waitForFunction(()=>!document.querySelector('.ride-replay').hidden&&+document.querySelector('.ride-replay input[type=range]').max>0,null,{timeout:15000});
 await p.waitForTimeout(800);
 const clip=await p.evaluate(()=>{const r=document.querySelector('.ride-replay input[type=range]'),v=document.querySelector('.ride-replay video');return {max:+r.max,min:+r.min,dur:v.duration}});
 const b=await p.evaluate(()=>{const B=__WK_REPLAY__.buffer,ws=[];for(let i=0;i<B.length;i+=1)ws.push(B.at(i/Math.max(1,B.length-1)).w);let gap=0;for(let i=1;i<ws.length;i++)gap=Math.max(gap,ws[i]-ws[i-1]);return {gap,span:B.wall-B.wallStart}});
 // real seconds spent riding (menus excluded); the capture clock clamps slow frames so it can read a little low on software GL
 const live=(tOpen-tStart-menuReal-shopReal)/1000,len=clip.max-clip.min;
 assert(len<live+1.5,`clip is live riding only (${len.toFixed(2)} s vs ${live.toFixed(2)} s riding; menus ${((menuReal+shopReal)/1000).toFixed(1)} s) `+JSON.stringify(clip));
 assert(b.gap<1&&b.span<live+.5&&b.span<c.wall+.5,'Drop In buffer has no static gap '+JSON.stringify(b));
 assert.deepEqual(errors,[]);
 console.log('replay-menu-gap: ok',JSON.stringify({live:+live.toFixed(2),clip:+(clip.max-clip.min).toFixed(2),bufGap:+b.gap.toFixed(3),menuWall:+(a1.wall-a0.wall).toFixed(3)}));
}finally{await browser.close();}
