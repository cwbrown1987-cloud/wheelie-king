// Concept prototype: all replay controls as an overlay on the video (injected CSS over the real replay DOM; no game files change).
import {launchBrowser,pageOptions} from '/workspace/wheelie-king-repo/tests/_browser.mjs';
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8962/',OUT='/workspace/wk-replayov';
const CSS=`
.ride-replay.wkov:not(.is-theatre){padding:0!important;width:min(98vw,calc(94dvh*var(--ar,1.778)))!important;max-width:none!important;max-height:none!important;aspect-ratio:var(--ar,1.778);overflow:hidden!important;border-radius:16px}
.wkov .ride-replay-layout{display:block!important;position:absolute;inset:0}
.wkov .ride-replay-main{position:static}
.wkov .ride-replay-stage{position:absolute!important;inset:0;height:auto!important;aspect-ratio:auto!important;border:0!important;border-radius:0!important}
.wkov .ride-replay-stage video{object-fit:cover}
.wkov .ride-replay-stage::before,.wkov .ride-replay-stage::after{content:'';position:absolute;left:0;right:0;pointer-events:none;z-index:1}
.wkov .ride-replay-stage::before{top:0;height:30%;background:linear-gradient(#000b,#0000)}
.wkov .ride-replay-stage::after{bottom:0;height:42%;background:linear-gradient(#0000,#000d)}
.wkov .ride-replay-head{position:absolute;top:10px;left:12px;right:10px;z-index:4;margin:0!important;pointer-events:none}
.wkov .ride-replay-head strong{font-size:13px!important;padding:6px 11px;border-radius:999px;background:#0b1a13cc;border:1px solid #7dffb066;letter-spacing:.18em!important}
.wkov .ride-replay-head strong::before{content:'● ';color:#ff4d5e}
.wkov .ride-replay-x{pointer-events:auto;border-radius:50%!important;min-width:38px!important;height:38px;background:#0b1a13cc!important}
.wkov .ride-replay-library{position:absolute;z-index:4;top:8px;left:118px;right:60px;max-height:none!important;overflow:visible!important;display:flex;gap:6px;align-items:center;padding:0!important}
.wkov .ride-replay-library h3{display:none}
.wkov .ride-replay-list{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.wkov :is(.ride-replay-latest,.ride-replay-item){width:auto!important;flex:0 0 auto;margin:0!important;padding:4px 10px 4px 4px!important;gap:7px!important;border-radius:999px!important;background:#0b1a13cc!important;max-width:190px}
.wkov .ride-replay-thumb{width:46px!important;height:26px!important;border-radius:999px!important}
.wkov .ride-replay-meta small{display:none}
.wkov .ride-replay-del{display:none!important}
.wkov .ride-replay-overlay-play{z-index:3;width:68px!important;height:68px!important}
.wkov .ride-replay-scrub{position:absolute;z-index:4;left:14px;right:14px;bottom:62px;margin:0!important;color:#e9fff2!important;text-shadow:0 1px 3px #000}
.wkov .ride-replay-scrub label{font-size:0}
.wkov .ride-replay-scrub input{height:22px}
.wkov .ride-replay-actions{position:absolute;z-index:4;left:12px;right:12px;bottom:12px;flex-wrap:nowrap!important;gap:6px!important}
.wkov .ride-replay-actions :is(button,a){padding:8px 11px!important;border-radius:999px!important;background:#0b1a13cc!important;white-space:nowrap;font-size:12px!important;min-height:38px}
.wkov .ride-replay-actions a[data-r=download-video]{display:inline-flex!important;align-items:center;color:#d9ffe8;text-decoration:none;border:1px solid #7dffb066}
.wkov .ride-replay-actions .ride-replay-playbtn{min-width:40px!important;width:40px;padding:0!important;font-size:16px!important}
.wkov .ride-replay-actions .ride-replay-drop{margin-left:auto;order:9;padding:10px 22px!important;font-size:15px!important;background:linear-gradient(180deg,#a6f5b0,#5fd877)!important;color:#0f2416!important;box-shadow:0 0 18px #39ff7a88}
@media(orientation:portrait) and (max-width:520px){
 .wkov .ride-replay-library{left:12px;right:56px;top:46px}
 .wkov .ride-replay-head strong{font-size:11px!important}
 .wkov .ride-replay-meta{display:none}
 .wkov :is(.ride-replay-latest,.ride-replay-item){padding:3px!important}
 .wkov .ride-replay-actions{flex-wrap:wrap!important;bottom:12px}
 .wkov .ride-replay-actions :is(button,a){font-size:11px!important;padding:7px 10px!important;min-height:34px}
 .wkov .ride-replay-actions .ride-replay-drop{order:-1;flex:1 1 100%;margin:0 0 4px!important;font-size:17px!important;padding:12px!important;justify-content:center}
 .wkov .ride-replay-scrub{bottom:150px!important}
 .wkov .ride-replay-overlay-play{width:52px!important;height:52px!important}
}`;
const b=await launchBrowser({extraArgs:['--autoplay-policy=no-user-gesture-required']});
async function shoot(name,vp,overlay){
 const p=await b.newPage(pageOptions({viewport:vp,hasTouch:vp.width<1100,isMobile:vp.width<1100,deviceScaleFactor:1,serviceWorkers:'block'}));
 await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
 await p.goto(URL0);await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.evaluate(()=>document.querySelector('[data-destination=race]').click());
 await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_REPLAY__,null,{timeout:90000});
 await p.keyboard.down('ArrowUp');await p.waitForTimeout(6000);await p.keyboard.up('ArrowUp');
 // one saved run so the library has an entry
 await p.evaluate(()=>document.querySelector('[data-r=pause]').click());await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('[data-r=menu-replay]').click());await p.waitForTimeout(1200);
 await p.evaluate(async()=>{await __WK_REPLAY__._saveToLibrary?.()}).catch(()=>{});await p.waitForTimeout(800);
 await p.locator('[data-r="latest-run"]').click().catch(()=>{});await p.waitForTimeout(800);
 await p.evaluate(()=>{const v=document.querySelector('.ride-replay video');v.pause();const r=document.querySelector('.ride-replay input[type=range]');r.value=String(+r.max*.55);r.dispatchEvent(new Event('input',{bubbles:true}))});
 if(overlay){await p.addStyleTag({content:CSS});await p.evaluate(()=>{const s=document.querySelector('.ride-replay');s.classList.add('wkov');const v=s.querySelector('video');if(v.videoWidth)s.style.setProperty('--ar',(v.videoWidth/v.videoHeight).toFixed(4));const a=s.querySelector('[data-r=download-video]');a.hidden=false;a.textContent='🎬 Save clip';});}
 await p.waitForTimeout(900);await p.screenshot({path:`${OUT}/${name}.png`});
 const sc=await p.evaluate(()=>{const s=document.querySelector('.ride-replay');return {scroll:s.scrollHeight>s.clientHeight+2,h:s.getBoundingClientRect().height,vh:innerHeight}});console.log(name,JSON.stringify(sc));
 await p.close();
}
try{
    await shoot('ov-390x844',{width:390,height:844},true);
 }finally{await b.close();}
