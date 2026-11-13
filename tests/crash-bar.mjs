// After a crash, REWIND / RECOVER / REPLAY are one style-B neon-dock row, low on the
// screen, clear of the bike and the CRASH title, and they fit on 844×390.
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const shots=process.env.WK_CRASHBAR_SHOTS||process.env.WK_REWIND_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const browser=await launchBrowser();
const parseColor=s=>{const m=String(s||'').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?m.slice(1,4).map(Number):null};
const isDark=rgb=>rgb&&(rgb[0]+rgb[1]+rgb[2])/3<80;
const isCyanOrMint=rgb=>rgb&&rgb[2]>=rgb[0]&&rgb[1]>=80&&rgb[0]<200;
try{
 const results=[];
 for(const [name,vp] of [['phone',{width:844,height:390,hasTouch:true,isMobile:true}],['desktop',{width:1280,height:720}]]){
  const p=await browser.newPage(pageOptions({viewport:{width:vp.width,height:vp.height},hasTouch:!!vp.hasTouch,isMobile:!!vp.isMobile,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('wk-level','trials'));
  await p.goto(withLegacy(process.env.WK_TEST_URL||'http://127.0.0.1:8931/'));
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.locator('[data-destination="race"]').first().click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded,null,{timeout:90000});
  await p.evaluate(()=>{
   const s=__WK_RIDE_STATE__().s;
   Object.assign(s,{crashed:'TEST IMPACT',vy:-2,w:2});
   s.events.push({type:'crash',why:'TEST IMPACT'});
  });
  await p.waitForFunction(()=>{
   const bar=document.querySelector('.ride-crash-actions');
   return bar&&!bar.hidden&&document.querySelector('[data-r=rewind]')&&getComputedStyle(bar).display!=='none';
  },null,{timeout:10000});
  const lay=await p.evaluate(()=>{
   const bar=document.querySelector('.ride-crash-actions');
   const btns=[...bar.querySelectorAll('button')];
   const msg=document.querySelector('[data-h=msg]');
   const styleOf=e=>{const c=getComputedStyle(e);return {font:c.font,fontFamily:c.fontFamily,fontSize:c.fontSize,fontWeight:c.fontWeight,height:c.height,color:c.color,bg:c.backgroundColor,bgImage:c.backgroundImage,box:e.getBoundingClientRect()}};
   const boxes=btns.map(b=>b.getBoundingClientRect());
   const barBox=bar.getBoundingClientRect();
   const msgBox=msg?.getBoundingClientRect()||{top:0,bottom:0,height:0};
   const tops=boxes.map(b=>Math.round(b.top)),bottoms=boxes.map(b=>Math.round(b.bottom));
   return {
    labels:btns.map(b=>b.textContent.trim()),
    styles:btns.map(styleOf),
    bar:barBox,msg:msgBox,vh:innerHeight,vw:innerWidth,
    oneRow:Math.max(...tops)-Math.min(...tops)<=2&&Math.max(...bottoms)-Math.min(...bottoms)<=2,
    gapTitle:barBox.top-msgBox.bottom,
    fromBottom:innerHeight-barBox.bottom,
    overflowX:barBox.right>innerWidth+1||barBox.left<-1||boxes.some(b=>b.right>innerWidth+1||b.left<-1),
    wrap:getComputedStyle(bar).flexWrap,
    rewind:(()=>{const e=document.querySelector('[data-r=rewind]');if(!e)return null;const c=getComputedStyle(e),b=e.getBoundingClientRect();return {font:c.font,fontFamily:c.fontFamily,fontSize:c.fontSize,color:c.color,bg:c.backgroundColor,bgImage:c.backgroundImage,radius:c.borderRadius,box:b,hidden:e.hidden||c.display==='none'}})(),
    throttle:document.querySelector('.ride-drive.throttle')?.getBoundingClientRect()||null,
    brake:document.querySelector('.ride-drive.brake')?.getBoundingClientRect()||null
   };
  });
  assert.deepEqual(lay.labels.map(s=>s.replace(/^[^\w]*/,'').trim()),['RECOVER','REPLAY'],name+' bottom labels '+JSON.stringify(lay.labels));
  assert.equal(lay.wrap,'nowrap',name+' recover/replay stay on one row (no wrap)');
  assert(lay.oneRow,name+' recover/replay share one row '+JSON.stringify(lay));
  assert(!lay.overflowX,name+' bottom bar fits the viewport '+JSON.stringify({bar:lay.bar,vw:lay.vw}));
  assert(lay.gapTitle>8,name+' bottom bar sits clear of the CRASH title '+JSON.stringify({gap:lay.gapTitle,msg:lay.msg,bar:lay.bar}));
  assert(lay.fromBottom<=24,name+' recover/replay sit low on the screen '+JSON.stringify({fromBottom:lay.fromBottom,vh:lay.vh,bar:lay.bar}));
  assert(lay.bar.top>lay.vh*0.55,name+' recover/replay are below mid-screen '+JSON.stringify(lay.bar));
  const fonts=new Set(lay.styles.map(s=>`${s.fontFamily}|${s.fontSize}|${s.fontWeight}`));
  assert.equal(fonts.size,1,name+' recover/replay same font and size '+JSON.stringify(lay.styles.map(s=>({font:s.font,h:s.height}))));
  const styleB=s=>{
   const bg=parseColor(s.bg);
   const col=parseColor(s.color);
   const brightGreen=/#3cf08a|#65ee6b|#13b45c|#6edc84/i.test((s.bgImage||'')+' '+(s.bg||''));
   assert(!brightGreen,name+' is not a filled green block '+JSON.stringify(s));
   if(bg)assert(isDark(bg),name+' dark dock fill '+JSON.stringify(s));
   if(col)assert(isCyanOrMint(col),name+' style B text '+JSON.stringify(s));
   assert(/system-ui/i.test(s.fontFamily),name+' system-ui font '+s.fontFamily);
  };
  for(const s of lay.styles)styleB(s);
  assert(lay.rewind&&!lay.rewind.hidden,name+' REWIND is visible after a crash');
  styleB(lay.rewind);
  const rb=lay.rewind.box,tb=lay.throttle,bb=lay.brake;
  const radius=parseFloat(lay.rewind.radius);
  assert(radius>=rb.width*0.45,name+' REWIND is round '+JSON.stringify({radius:lay.rewind.radius,box:rb}));
  assert(rb.left>lay.vw*0.55,name+' REWIND sits on the right '+JSON.stringify(rb));
  assert(rb.bottom<lay.bar.top-4,name+' REWIND sits above recover/replay '+JSON.stringify({rewind:rb,bar:lay.bar}));
  if(tb){
   assert(rb.bottom<=tb.top+4,name+' REWIND sits just above the throttle '+JSON.stringify({rewind:rb,throttle:tb}));
   const overlap=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);
   assert(!overlap(rb,tb),name+' REWIND does not cover the throttle '+JSON.stringify({rewind:rb,throttle:tb}));
   if(bb)assert(!overlap(rb,bb),name+' REWIND does not cover the brake '+JSON.stringify({rewind:rb,brake:bb}));
  }
  if(shots)await p.screenshot({path:`${shots}/after-${name}-crash.png`});
  assert.deepEqual(errors,[],'page errors '+errors.join(' | '));
  results.push({name,oneRow:true,fromBottom:lay.fromBottom,gapTitle:+lay.gapTitle.toFixed(1)});
  await p.close();
 }
 console.log(JSON.stringify({crashBarStyleB:true,results}));
}finally{await browser.close()}
