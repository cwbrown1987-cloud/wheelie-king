// The side/chase pill must toggle on a real phone tap on the Legacy Trials ride (?legacy=1). SAMPLE 3D was removed in v2.0.
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const shots=process.env.WK_VIEW_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});

async function openRide(browser, track){
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
  const url=withLegacy(base,track||'trials');
  await p.addInitScript(lv=>{if(lv)localStorage.setItem('wk-level',lv);else localStorage.setItem('wk-level','trials');}, track||'trials');
  await p.goto(url);
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});
  await p.waitForTimeout(200);
  return {p,errors,name:track||'trials'};
}

async function tapPill(p){
  const pill=p.locator('[data-r="view"], .ride-view-label');
  await pill.tap();
}

const browser=await launchBrowser();
try{
  const results=[];
  for(const track of [null]){
    const {p,errors,name}=await openRide(browser,track);
    const start=await p.evaluate(()=>{
      const st=__WK_RIDE_STATE__();
      const el=document.querySelector('[data-r="view"], .ride-view-label');
      return {view:st.cameraView,blend:st.cameraBlend,tag:el?.tagName,text:el?.textContent,pe:el?getComputedStyle(el).pointerEvents:null,pressed:el?.getAttribute('aria-pressed')};
    });
    assert.equal(start.view,'side',name+' starts in side view');
    assert.equal(start.tag,'BUTTON',name+' view control should be a button, got '+start.tag);
    assert.equal(start.pe,'auto',name+' pill must receive taps, pointer-events='+start.pe);
    if(shots)await p.screenshot({path:shots+'/'+name+'-side.png'});

    await tapPill(p);
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:8000});
    const mid=await p.evaluate(()=>{
      const st=__WK_RIDE_STATE__();
      const el=document.querySelector('[data-r="view"]');
      return {view:st.cameraView,blend:st.cameraBlend,text:el?.textContent,pressed:el?.getAttribute('aria-pressed')};
    });
    assert.equal(mid.view,'chase',name+' tap did not switch to chase '+JSON.stringify(mid));
    assert.match(mid.text||'',/CHASE/);
    assert.equal(mid.pressed,'true');
    if(shots)await p.screenshot({path:shots+'/'+name+'-chase.png'});

    await tapPill(p);
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='side'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});
    const end=await p.evaluate(()=>__WK_RIDE_STATE__().cameraView);
    assert.equal(end,'side',name+' second tap should return to side view');
    assert.deepEqual(errors,[]);
    results.push({name,start,mid});
    await p.close();
  }
  console.log(JSON.stringify({rideViewToggle:true,results}));
}finally{await browser.close()}
