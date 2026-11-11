// Free-roam side view: A/D tilt like UP/DOWN. Chase keeps A/D as steering. Arrows still tilt.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const browser=await launchBrowser();

async function open(track){
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(lv=>localStorage.setItem('wk-level',lv),track);
  await p.goto(base.replace(/\/?$/,'/')+'?track='+track,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_emoto'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});
  return {p,errors};
}

function plant(p,x,z){
  return p.evaluate((o)=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:o.x,z:o.z,yaw:0,vx:2,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true],steer:0,steerTarget:0});s.y=ter.height(o.x,o.z)+.45;}, {x,z});
}

const report={};
try{
  for(const track of ['arena','sample3d']){
    const {p,errors}=await open(track);
    const spawn=track==='arena'?{x:0,z:0}:{x:8,z:0};

    await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='side'&&__WK_RIDE_STATE__().cameraBlend===0,null,{timeout:8000});
    await plant(p,spawn.x,spawn.z);
    await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();s.y=ter.height(s.x,s.z||0)+1.6;s.vy=0;s.ground=[false,false];s.air=.15;s.w=0;s.pitch=0;});

    await p.keyboard.down('KeyD');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.lean===-1&&__WK_RIDE_STATE__().inp.steer===0,null,{timeout:3000});
    await p.waitForTimeout(350);
    const dSide=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {lean:st.inp.lean,steer:st.inp.steer,pitch:st.s.pitch,w:st.s.w,view:st.cameraView,bar:st.s.steer||0};});
    await p.keyboard.up('KeyD');
    assert.equal(dSide.lean,-1,'D in side view must be tilt forward (same as UP)');
    assert.equal(dSide.steer,0,'D must not steer in side view');
    assert(dSide.pitch< -0.02||dSide.w< -0.05,'D should pitch the nose down '+JSON.stringify(dSide));

    await plant(p,spawn.x,spawn.z);
    await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();s.y=ter.height(s.x,s.z||0)+1.6;s.vy=0;s.ground=[false,false];s.air=.15;s.w=0;s.pitch=0;});
    await p.keyboard.down('KeyA');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.lean===1&&__WK_RIDE_STATE__().inp.steer===0,null,{timeout:3000});
    await p.waitForTimeout(350);
    const aSide=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {lean:st.inp.lean,steer:st.inp.steer,pitch:st.s.pitch,w:st.s.w,view:st.cameraView};});
    await p.keyboard.up('KeyA');
    assert.equal(aSide.lean,1,'A in side view must be tilt back (same as DOWN)');
    assert.equal(aSide.steer,0,'A must not steer in side view');
    assert(aSide.pitch>0.02||aSide.w>0.05,'A should pitch the nose up '+JSON.stringify(aSide));

    await p.keyboard.down('ArrowUp');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.lean===-1,null,{timeout:3000});
    await p.keyboard.up('ArrowUp');
    await p.keyboard.down('ArrowDown');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.lean===1,null,{timeout:3000});
    await p.keyboard.up('ArrowDown');

    await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:8000});
    await plant(p,track==='arena'?0:8, track==='arena'?20:0);

    await p.keyboard.down('KeyD');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer===1,null,{timeout:3000});
    const dChase=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {lean:st.inp.lean,steer:st.inp.steer,view:st.cameraView};});
    await p.keyboard.up('KeyD');
    assert.equal(dChase.steer,1,'D still steers right in chase');
    assert(Math.abs(dChase.lean)<1e-9,'D must not tilt in chase '+JSON.stringify(dChase));

    await p.keyboard.down('KeyA');
    await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.steer===-1,null,{timeout:3000});
    const aChase=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();return {lean:st.inp.lean,steer:st.inp.steer};});
    await p.keyboard.up('KeyA');
    assert.equal(aChase.steer,-1,'A still steers left in chase');
    assert(Math.abs(aChase.lean)<1e-9,'A must not tilt in chase '+JSON.stringify(aChase));

    assert.deepEqual(errors,[]);
    report[track]={dSide,aSide,dChase,aChase};
    await p.close();
  }
  console.log(JSON.stringify({adTiltSide:true,...report}));
}finally{await browser.close()}
