// Short sample city track: unique 3D world, no repeating mid-ground/wall, painted sky only as the far backdrop.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const shots=process.env.WK_SAMPLE3D_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});

async function openRide(browser, {level, track}={}){
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(lv=>{
    if(lv)localStorage.setItem('wk-level',lv);
    else localStorage.removeItem('wk-level');
  }, level||null);
  const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
  const url=track?base+(base.includes('?')?'&':'?')+'track='+track:base;
  await p.goto(url);
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded&&globalThis.__WK_RIDE_SCENE__,null,{timeout:90000});
  await p.waitForTimeout(400);
  return {p,errors};
}

async function teleport(p,x){
  await p.evaluate(x=>{
    const st=__WK_RIDE_STATE__();
    const {s,P,ter}=st;
    const rear=-P.wb*P.comBack,front=P.wb*(1-P.comBack);
    const pitch=Math.atan2(ter.h(x+front)-ter.h(x+rear),P.wb);
    Object.assign(s,{x,y:ter.h(x)+P.comH,vx:0,vy:0,w:0,pitch,crashed:null,air:0,ground:[true,true]});
  },x);
  await p.waitForFunction(x=>{
    const st=__WK_RIDE_STATE__();
    return Math.abs((st.s?.x??0)-x)<3 && Math.abs((st.cameraX??0)-x)<10;
  },x,{timeout:8000});
  await p.waitForTimeout(300);
}

async function shot(p,name){
  if(!shots)return;
  await p.screenshot({path:shots+'/'+name+'.png'});
}

const browser=await launchBrowser();
try{
  // Before: current Trials side view, for comparison.
  const before=await openRide(browser,{level:'trials'});
  const beforeLook=await before.p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const names=[];
    __WK_RIDE_SCENE__().scene.traverse(o=>{if(o.name?.startsWith('environment:'))names.push(o.name)});
    return {
      level:st.level||((localStorage.getItem('wk-level')||'trials')),
      midground:st.environment?.midground===true,
      hasStrip:names.includes('environment:midground-strip'),
      finish:st.ter.finish
    };
  });
  assert.equal(beforeLook.midground,true,'trials should still have mid-ground');
  assert.equal(beforeLook.hasStrip,true,'trials mid-ground strip missing');
  assert(beforeLook.finish>100,'trials finish should stay long');
  await shot(before.p,'before-current-side');
  assert.deepEqual(before.errors,[]);
  await before.p.close();

  const {p,errors}=await openRide(browser,{track:'sample3d'});
  const startLook=await p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const names=[];
    __WK_RIDE_SCENE__().scene.traverse(o=>{if(o.name?.startsWith('environment:'))names.push(o.name)});
    const buildings=names.filter(n=>n.startsWith('environment:building:')).length;
    return {
      level:st.level,
      sample3d:st.sample3d===true && st.environment?.sample3d===true,
      midground:st.environment?.midground===true,
      hasStrip:names.includes('environment:midground-strip'),
      hasWall:names.includes('environment:graffiti-wall'),
      hasStreet:names.includes('environment:street'),
      hasKerb:names.includes('environment:kerb'),
      hasQp:names.includes('environment:quarter-pipe'),
      hasBowl:names.includes('environment:bowl'),
      hasJump:names.includes('environment:dirt-jump'),
      buildings,
      uniqueBuildings:buildings,
      finish:st.ter.finish,
      backdrop:st.backdropLoaded===true,
      hasSampleBtn:!!document.querySelector('[data-r="mode-sample3d"]'),
      hasTrialsBtn:!!document.querySelector('[data-r="mode-trials"]'),
      hasEndlessBtn:!!document.querySelector('[data-r="mode-endless"]')
    };
  });
  assert.equal(startLook.level,'sample3d','?track=sample3d should select the sample');
  assert.equal(startLook.sample3d,true,'sample world not mounted '+JSON.stringify(startLook));
  assert.equal(startLook.midground,false,'sample must not use painted mid-ground');
  assert.equal(startLook.hasStrip,false,'sample must not include the mid-ground strip');
  assert.equal(startLook.hasWall,false,'sample must not include the repeating graffiti wall');
  assert.equal(startLook.hasStreet,true,'sample street missing');
  assert.equal(startLook.hasKerb,true,'sample kerb missing');
  assert.equal(startLook.hasQp,true,'sample quarter pipe missing');
  assert.equal(startLook.hasBowl,true,'sample bowl missing');
  assert.equal(startLook.hasJump,true,'sample dirt jump missing');
  assert(startLook.buildings>=12,'expected a unique building row, got '+startLook.buildings);
  assert(startLook.finish>=160 && startLook.finish<=230,'sample finish should be a short ~20s course, got '+startLook.finish);
  assert.equal(startLook.backdrop,true,'painted skyline backdrop should stay');
  assert.equal(startLook.hasSampleBtn,true,'SAMPLE 3D pause button missing');
  assert.equal(startLook.hasTrialsBtn,true,'Trials mode should remain');
  assert.equal(startLook.hasEndlessBtn,true,'Endless mode should remain');
  await shot(p,'sample-side-start');

  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===1);
  await p.waitForTimeout(250);
  await shot(p,'sample-chase-start');
  await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===0);

  await teleport(p,70);
  await shot(p,'sample-side-mid');
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===1);
  await p.waitForTimeout(250);
  await shot(p,'sample-chase-mid');
  await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===0);

  await teleport(p,185);
  await shot(p,'sample-side-end');
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===1);
  await p.waitForTimeout(250);
  await shot(p,'sample-chase-end');

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({sample3d:true,startLook,shots:!!shots}));
  await p.close();
}finally{await browser.close()}
