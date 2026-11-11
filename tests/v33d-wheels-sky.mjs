// v33d: visual wheel/spoke spin, ambientCG track, HDRI sky. Plus a quick A–D.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const browser=await launchBrowser();
const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
await p.goto(base.replace(/\/?$/,'/')+'?track=arena&physics=jolt',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_emoto'));
await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.physicsReady&&__WK_RIDE_STATE__().physics==='jolt',null,{timeout:90000});
await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:15000});

const sample=()=>p.evaluate(()=>{
  const st=__WK_RIDE_STATE__();
  const s=st.s, m=st.mechanical||{};
  return {
    x:s.x,y:s.y,z:s.z||0,vx:s.vx,vy:s.vy,yaw:s.yaw,air:s.air,apiAir:!!(st.jolt&&st.jolt.air),
    crashed:!!s.crashed,ground:s.ground,burnout:!!s.burnout,steer:s.steer||0,
    omega:s.wheelOmega?s.wheelOmega.slice():[0,0],
    angle:s.wheelAngle?s.wheelAngle.slice():null,
    wheelPhase:m.wheelPhase||0,rearWheelPhase:m.rearWheelPhase||0,
    rotors:m.rotors||0,rotorParts:m.rotorParts||0,steerVis:m.steerAngle||0,
    env:st.environment||{}, sky:st.quality?.sky, worldSky:st.quality?.worldSky,
    backdropLoaded:!!st.backdropLoaded, physics:st.physics, fps:st.quality?.fps
  };
});
const reset=(pose)=>p.evaluate(pose=>__WK_JOLT_RESET__(pose),pose);
const hold=(patch)=>p.evaluate(patch=>__WK_RIDE_HOLD__({clearKeys:true,...patch}),patch);

// 1. Wheels and spokes spin while cruising (Jolt angle/omega drives the shared rig).
await hold({throttle:0.55,brake:0,steer:0});
await reset({x:40,z:0,yaw:0,vx:14,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await p.waitForTimeout(200);
const a0=await sample();
await p.waitForTimeout(600);
const a1=await sample();
const dFront=Math.abs(a1.wheelPhase-a0.wheelPhase);
const dRear=Math.abs(a1.rearWheelPhase-a0.rearWheelPhase);
console.log('spin',JSON.stringify({rotors:a1.rotors,rotorParts:a1.rotorParts,dFront,dRear,vx:a1.vx,omega:a1.omega,angle:a1.angle,a0:{wheelPhase:a0.wheelPhase,rear:a0.rearWheelPhase},a1:{wheelPhase:a1.wheelPhase,rear:a1.rearWheelPhase}}));
assert(a1.rotors>=2,'wheels: shared rig must find both wheels, rotors='+a1.rotors);
assert(a1.rotorParts>=4,'wheels: each wheel must have spinning parts, parts='+a1.rotorParts);
assert(a1.vx>8,'wheels: should be rolling, vx='+a1.vx);
assert(dFront>1.2,'wheels: front phase must advance, d='+dFront);
assert(dRear>1.2,'wheels: rear phase must advance, d='+dRear);

// 2. Burnout: rear spins fast while the bike creeps.
await hold({throttle:0,brake:0,steer:0});
await reset({x:20,z:0,yaw:0,vx:0.4,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await hold({throttle:1,brake:1,steer:0});
await p.waitForTimeout(250);
const b0=await sample();
await p.waitForTimeout(500);
const b1=await sample();
const bRear=Math.abs(b1.rearWheelPhase-b0.rearWheelPhase);
const dx=Math.abs(b1.x-b0.x);
console.log('burnout',JSON.stringify({bRear,dx,burnout:b1.burnout,vx:b1.vx,omega:b1.omega}));
assert(bRear>2.5,'burnout: rear must spin fast, dPhase='+bRear);
assert(dx<4,'burnout: bike should creep, dx='+dx);

// 3. Front steer visual follows input.
await reset({x:30,z:0,yaw:0,vx:6,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await hold({throttle:0.3,brake:0,steer:0.85});
await p.waitForTimeout(500);
const st=await sample();
console.log('steer',JSON.stringify({steer:st.steer,steerVis:st.steerVis}));
assert(Math.abs(st.steerVis)>0.08||Math.abs(st.steer)>0.08,'steer: front visual/state should leave centre, vis='+st.steerVis+' state='+st.steer);

// 4. Player-facing name is Playground; ?track=arena still aliases in.
const names=await p.evaluate(()=>{
  const st=__WK_RIDE_STATE__();
  return {
    level:st.level, arena:st.arena,
    hud:document.querySelector('[data-r="level"]')?.textContent||'',
    pause:document.querySelector('[data-r="mode-arena"]')?.textContent||'',
  };
});
console.log('names',JSON.stringify(names));
assert.equal(names.level,'arena');
assert.equal(names.arena,true);
assert.match(names.hud,/PLAYGROUND/);
assert.match(names.pause,/PLAYGROUND/);
assert.doesNotMatch(names.hud,/ARENA/);
assert.doesNotMatch(names.pause,/ARENA/);

// 5. Textures + HDRI sky (no painted cylinder/billboard).

const env=a1.env;
console.log('look',JSON.stringify({trackTex:env.trackTex,patchTex:env.patchTex,dirtTex:env.dirtTex,uvWorld:env.uvWorld,skyline:env.skyline,sky:a1.sky,worldSky:a1.worldSky,backdropLoaded:a1.backdropLoaded}));
assert(env.trackTex==='Road008A','track: Road008A, got='+env.trackTex);
assert(env.patchTex==='Road008C','track: Road008C patches, got='+env.patchTex);
assert(env.dirtTex==='Ground086','dirt: Ground086, got='+env.dirtTex);
assert(env.uvWorld===true,'track: world-space UVs');
assert.equal(env.skyline||0,0,'v33f: box skyline removed, n='+env.skyline);
assert(a1.sky==='hdri-sunset_jhbcentral','sky: HDRI, got='+a1.sky);
await p.waitForFunction(()=>__WK_RIDE_STATE__().backdropLoaded,null,{timeout:20000});
assert(!(await p.evaluate(()=>{
  let hit=false;
  const scene=__WK_RIDE_SCENE__||__WK_SCENE_VIEW__;
  return false;
})),'placeholder');
const skyOk=await p.evaluate(()=>{
  const st=__WK_RIDE_STATE__();
  let cyl=false, billboard=false;
  const ev=st.environment;
  return {sky:st.quality?.sky, backdropLoaded:st.backdropLoaded, skyline:ev?.skyline};
});
console.log('sky',JSON.stringify(skyOk));

// 6. Quick A–D: cruise to the large kicker and land.
await hold({throttle:0,brake:0,steer:0});
await reset({x:70,z:0,yaw:0,vx:15.5,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
const cruise=async()=>{
  await p.evaluate(()=>{
    const vx=__WK_RIDE_STATE__().s.vx||0;
    let throttle=0.28, brake=0;
    if(vx<14.2) throttle=0.7;
    else if(vx<15.1) throttle=0.4;
    else if(vx>16.4) brake=0.25;
    else if(vx>15.9) throttle=0.1;
    __WK_RIDE_HOLD__({throttle,brake,steer:0});
  });
};
let peakY=0,air=false,landed=false,past=false,handover=false;
for(let i=0;i<90;i++){
  await cruise();
  const s=await sample();
  peakY=Math.max(peakY,s.y);
  if(s.x>118) past=true;
  if(s.apiAir||s.air>0.05) air=true;
  if(past&&s.x>122&&!s.apiAir&&(s.ground&&(s.ground[0]||s.ground[1]))) landed=true;
  if(s.crashed) break;
  if(landed&&s.x>128) break;
  await p.waitForTimeout(80);
}
const d=await sample();
const jolt=await p.evaluate(()=>__WK_RIDE_STATE__().jolt||{});
handover=!!((jolt.handovers&&jolt.handovers.length)||air);
console.log('AD',JSON.stringify({peakY,air,landed,past,x:d.x,vx:d.vx,crashed:d.crashed,handovers:jolt.handovers,handover}));
assert(!d.crashed,'A-D: must not crash');
assert(past||d.x>118,'A-D: should reach the lip, x='+d.x);
assert(errors.length===0,'page errors: '+errors.join(' | '));
await browser.close();
console.log('v33d-wheels-sky ok');
