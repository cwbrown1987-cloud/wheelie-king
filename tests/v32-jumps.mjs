// v32: smooth visible jumps, wheel spin, mesh follow, camera lag, coast, dive.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {makeArenaTerrain,rampProfile,rampLength,rampLipX,rampHeightAt,bikeParams,makeState,step} from '../ride-physics.js';

const ter=makeArenaTerrain();
assert.equal(ter.ramps.length,5);
const dLx=1e-4;
for(const r of ter.ramps){
  const len=rampLength(r);
  const slope=(lx,h=1e-4)=>(rampHeightAt(r,lx+h)-rampHeightAt(r,lx-h))/(2*h);
  assert(Math.abs(slope(dLx))<0.5,'zero-ish slope at the base '+r.name+' '+slope(dLx));
  if(r.kind==='table'){
    const lip=rampLipX(r);
    assert(Math.abs(slope(lip-dLx))<0.6&&Math.abs(slope(lip+dLx))<0.6,'table lip rounded '+r.name);
  }else{
    // Takeoff face is C1; the lip itself is a launch edge (steep, then a backside drop).
    const mid=r.takeoff*0.5, land0=r.takeoff+r.back+r.gap, land1=len-dLx;
    const midL=slope(mid-0.05),midR=slope(mid+0.05);
    assert(Math.abs(midL-midR)<0.15,'takeoff face C1 '+r.name+' '+JSON.stringify({midL,midR}));
    assert(slope(r.takeoff-dLx)>0.2,'kicker has a real launch slope '+r.name+' '+slope(r.takeoff-dLx));
    assert(Math.abs(slope(land0+0.05))<0.5,'landing starts rounded '+r.name+' '+slope(land0+0.05));
    assert(Math.abs(slope(land1))<0.4,'landing ends rounded '+r.name+' '+slope(land1));
  }
}
const motor=bikeParams({P:4000,kg:40,driveAxle:'rear',powertrain:'electric',batteryWh:1000});
const jump=makeState(motor,24,ter);jump.z=0;jump.vx=8;jump.y=ter.height(24,0)+.5;
let air=0;
for(let i=0;i<120;i++){step(jump,motor,{throttle:1,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);air=Math.max(air,jump.air||0)}
assert(air>0.05||jump.y>1.6,'small kicker should still launch, air='+air+' y='+jump.y);

const coast=makeState(motor,0,ter);Object.assign(coast,{x:-80,z:80,vx:10,y:1,ground:[true,true]});
for(let i=0;i<60;i++){coast.thr=0;step(coast,motor,{throttle:0,brake:0,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter)}
assert(coast.vx<9.2&&coast.vx>6,'sensible off-throttle decel, vx='+coast.vx);

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const browser=await launchBrowser();
try{
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base.replace(/\/?$/,'/')+'?track=arena',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_emoto'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:8000});

  const jumps=await p.evaluate(()=>{
    const {scene}=__WK_RIDE_SCENE__();
    const names=[];scene.traverse(o=>{if(/^environment:jump:/.test(o.name))names.push(o.name)});
    const st=__WK_RIDE_STATE__();
    return {names,n:st.environment?.jumps,ramps:st.ter.ramps?.map(r=>r.name)};
  });
  assert(jumps.names.length>=5,'visible jump meshes '+JSON.stringify(jumps));

  // (a) wheel spin matches v/R; (b) mesh yaw follows physics with no lag
  const spin=await p.evaluate(()=>{
    const {s,P,mechanical}=__WK_RIDE_STATE__();
    Object.assign(s,{x:-80,z:80,yaw:0,vx:8,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true],steer:0,burnout:false});
    s.y=__WK_RIDE_STATE__().ter.height(-80,80)+.45;
    return new Promise(r=>{
      const t0=performance.now(),ph0=mechanical?.wheelPhase||0,x0=s.x;
      requestAnimationFrame(function tick(){
        const t=(performance.now()-t0)/1000;
        if(t<0.4){requestAnimationFrame(tick);return}
        const st=__WK_RIDE_STATE__();
        const dt=t, dist=Math.abs(st.s.x-x0);
        const dPhase=Math.abs((st.mechanical?.wheelPhase||0)-ph0);
        const expect=dist/(st.P.R||.3);
        r({dt,dist,dPhase,expect,R:st.P.R,ratio:dPhase/Math.max(1e-6,expect),yaw:st.s.yaw,meshYaw:st.visual.meshYaw,dYaw:Math.abs(st.visual.meshYaw-(st.s.yaw||0))});
      });
    });
  });
  assert(Math.abs(spin.ratio-1)<0.12,'wheel spin should match v/R '+JSON.stringify(spin));
  assert(spin.dYaw<0.05,'mesh yaw must follow physics with no lag '+JSON.stringify(spin));

  // (e) fork dive on the brake, squat on throttle
  await p.evaluate(()=>{const {s,ter}=__WK_RIDE_STATE__();Object.assign(s,{x:-80,z:80,yaw:0,vx:6,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});s.y=ter.height(-80,80)+.45;});
  await p.keyboard.down('KeyS');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.brake===1,null,{timeout:3000});
  await p.waitForTimeout(250);
  const dive=await p.evaluate(()=>__WK_RIDE_STATE__().visual.dive);
  await p.keyboard.up('KeyS');
  assert(dive>0.15,'front fork should dive under braking, dive='+dive);
  await p.keyboard.down('KeyW');
  await p.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1,null,{timeout:3000});
  await p.waitForTimeout(250);
  const squat=await p.evaluate(()=>__WK_RIDE_STATE__().visual.squat);
  await p.keyboard.up('KeyW');
  assert(squat>0.1,'rear should squat under throttle, squat='+squat);

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({v32jumps:true,jumps,spin,dive,squat,coast:coast.vx,air}));
  await p.close();
}finally{await browser.close()}
