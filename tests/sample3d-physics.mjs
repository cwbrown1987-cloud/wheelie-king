// Sample 3D uses the same bike/physics code as Trials, but a shorter new profile.
// Visual skate/dirt pieces are scenery only and are not in the collision mesh.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {bikeParams,makeState,step,makeTerrain,makeSampleTerrain,makeFlatTerrain} from '../ride-physics.js';

const trials=makeTerrain(24),sample=makeSampleTerrain(),flat=makeFlatTerrain();
assert.equal(sample.finish,196,'sample is a short finite course');
assert.equal(sample.loop,undefined,'sample has no trials loop');
assert.deepEqual(sample.checkpoints,[0,64,128]);
assert.deepEqual(sample.kickers,[48,108,154]);
assert(trials.finish>250,'trials course stays long');
assert(trials.loop,'trials still has its loop');
assert.equal(flat.finish,Infinity);

const P=bikeParams({powertrain:'human'});
function run(ter,x,seconds=1){
  const s=makeState(P,x,ter);
  const inp={throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0};
  for(let i=0;i<Math.round(seconds*60);i++)step(s,P,inp,1/60,ter);
  return {x:s.x,y:s.y,vx:s.vx,vy:s.vy,pitch:s.pitch,crashed:s.crashed};
}
const onSampleFlat=run(sample,8,1),onEndless=run(flat,8,1);
assert(Math.abs(onSampleFlat.vx-onEndless.vx)<0.15,'same stepper on flat ground '+JSON.stringify({onSampleFlat,onEndless}));
assert(Math.abs(onSampleFlat.x-onEndless.x)<0.2,'same travel on flat ground');
const onRamp=run(sample,50,0.8),onFlatSameX=run(flat,50,0.8);
assert(sample.h(56)>0.8,'sample kicker is in the ridden profile');
assert(Math.abs(flat.h(56))<1e-9,'endless stays flat');
assert(onRamp.y>onFlatSameX.y+0.3,'the sample kicker changes the bike path');
assert(Math.abs(sample.h(68))<0.05,'road under the skate lot is flat — the bowl is not in the profile');
assert(Math.abs(sample.h(70))<0.05);

const browser=await launchBrowser();
try{
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{});
  await p.goto((process.env.WK_TEST_URL||'http://127.0.0.1:8931/').replace(/\/?$/,'/')+'?track=sample3d');
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded&&globalThis.__WK_RIDE_SCENE__,null,{timeout:90000});

  const world=await p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const names=[];const props=[];
    __WK_RIDE_SCENE__().scene.traverse(o=>{
      if(!o.name)return;
      if(o.name.startsWith('environment:'))names.push(o.name);
      if(/quarter-pipe|bowl|dirt-jump/.test(o.name)&&o.isMesh){
        o.updateWorldMatrix(true,false);const e=o.matrixWorld.elements;
        props.push({name:o.name,x:+e[12].toFixed(2),y:+e[13].toFixed(2),z:+e[14].toFixed(2)});
      }
    });
    const xs=[50,56,68,70,86,108,116,154];
    return {
      level:st.level,finish:st.ter.finish,hasLoop:!!st.ter.loop,
      checkpoints:st.ter.checkpoints,kickers:st.ter.kickers,
      heights:Object.fromEntries(xs.map(x=>[x,+st.ter.h(x).toFixed(3)])),
      props,hasTricks:!!document.querySelector('[data-t="hop"],[data-r="tricks"],.ride-tricks,button[aria-label*="Tricks"],[data-t]'),
      hasRewind:!!document.querySelector('[data-r="rewind"]'),
      hasReplay:!!document.querySelector('[data-r="menu-replay"]'),
      finishTitle:document.querySelector('.ride-finish strong')?.textContent||null
    };
  });
  assert.equal(world.level,'sample3d');
  assert.equal(world.finish,196);
  assert.equal(world.hasLoop,false);
  assert(world.props.some(o=>o.name.includes('bowl')&&Math.abs(o.z)>2),'bowl is off the ride strip');
  assert(world.props.some(o=>o.name.includes('quarter-pipe')&&Math.abs(o.z)>2),'quarter pipe is off the ride strip');
  assert(world.props.some(o=>o.name.includes('dirt-jump')&&Math.abs(o.z)>2),'dirt mounds are off the ride strip');
  assert(world.heights[68]<0.1&&world.heights[70]<0.1,'ridden height under the bowl is the road, not the scenery');
  assert(world.heights[56]>0.8,'kicker in the terrain is ridden');
  assert.equal(world.hasRewind,true,'rewind control is mounted');
  assert.equal(world.hasReplay,true,'replay is in the pause menu');
  assert.match(world.finishTitle||'',/SAMPLE 3D COMPLETE/);

  // Checkpoint 1 fires when the bike passes x=64.
  await p.evaluate(async()=>{
    const {makeState}=await import('/ride-physics.js');
    const {s,P,ter}=__WK_RIDE_STATE__();
    Object.assign(s,makeState(P,66,ter),{vx:6});
  });
  await p.waitForFunction(()=>/CHECKPOINT 1/.test(document.querySelector('[data-hud="msg"],.ride-hud,body')?.innerText||document.body.innerText),null,{timeout:8000});

  // Tricks request is accepted on this course.
  await p.evaluate(()=>{__WK_RIDE_STATE__().s.stuntRequest={name:'barspin',expires:.7};});
  await p.waitForFunction(()=>{const st=__WK_RIDE_STATE__();return st.s.stuntRequest?.name==='barspin'||st.stunt?.name==='barspin'||st.stuntVisual;},null,{timeout:4000});

  // Replay buffer records motion.
  const buf0=await p.evaluate(()=>__WK_RIDE_STATE__().bufferLength);
  await p.waitForTimeout(400);
  const buf1=await p.evaluate(()=>__WK_RIDE_STATE__().bufferLength);
  assert(buf1>buf0,'replay buffer records on sample3d');

  // Finish panel.
  await p.evaluate(async()=>{
    const {makeState}=await import('/ride-physics.js');
    const {s,P,ter}=__WK_RIDE_STATE__();
    Object.assign(s,makeState(P,ter.finish+.1,ter),{vx:9,score:500});
  });
  await p.getByText('SAMPLE 3D COMPLETE').waitFor({timeout:8000});

  // Restart, then crash + rewind hook.
  await p.getByRole('button',{name:'Reset ride'}).click();
  await p.waitForFunction(()=>{const st=__WK_RIDE_STATE__();return st&&!st.finished&&st.s.x<3},null,{timeout:8000});
  await p.evaluate(()=>{__WK_RIDE_STATE__().s.crashed='test impact'});
  await p.waitForFunction(()=>__WK_RIDE_STATE__().crash&&!document.querySelector('[data-r="rewind"]')?.hidden,null,{timeout:8000});
  await p.evaluate(()=>{
    const b=document.querySelector('[data-r="rewind"]');
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'touch'}));
  });
  await p.waitForFunction(()=>__WK_RIDE_STATE__().rewinding===true,null,{timeout:4000});
  await p.evaluate(()=>{
    const b=document.querySelector('[data-r="rewind"]');
    b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,pointerType:'touch'}));
  });

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({sample3dPhysics:true,world,buf0,buf1,flatMatch:{dx:onSampleFlat.vx-onEndless.vx}}));
  await p.close();
}finally{await browser.close()}
