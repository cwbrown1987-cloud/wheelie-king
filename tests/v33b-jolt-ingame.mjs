// v33b: Jolt as a switchable arena backend — upright, standstill bars, burnout/donut, large-jump flip, FPS.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const browser=await launchBrowser();

async function waitReady(p){
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_emoto'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});
  await p.waitForFunction(()=>__WK_RIDE_STATE__().physics==='jolt'&&__WK_RIDE_STATE__().physicsReady,null,{timeout:90000});
  await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
  await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraView==='chase'&&__WK_RIDE_STATE__().cameraBlend===1,null,{timeout:15000});
  await p.mouse.click(420,200);
  await p.waitForTimeout(400);
}

async function releaseKeys(p){
  for (const k of ['KeyW','KeyA','KeyD','KeyS','KeyQ','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Space']) {
    await p.keyboard.up(k).catch(()=>{});
  }
}

async function reset(p, pose){
  await p.evaluate((pose)=>__WK_JOLT_RESET__(pose), pose);
  await p.waitForTimeout(500);
}

function sample(p){
  return p.evaluate(()=>{
    const st=__WK_RIDE_STATE__();
    const s=st.s;
    return {
      x:s.x,y:s.y,z:s.z||0,yaw:s.yaw||0,pitch:s.pitch||0,vx:s.vx,vy:s.vy||0,
      air:s.air||0,crashed:!!s.crashed,ground:s.ground,steer:s.steer||0,bar:st.visual?.bar||0,
      burnout:!!s.burnout,slip:s.slip?s.slip[0]:0,omega:s.wheelOmega?s.wheelOmega.slice():null,smoke:st.visual?.smoke||0,skid:st.environment?.skid||null,
      roll:st.visual?.roll||0,joltRoll:s.joltRoll,fps:st.quality?.fps||0,
      physics:st.physics,ready:st.physicsReady,handBrake:!!(st.jolt?.driver?.handBrake),handBrakeWorkaround:!!st.jolt?.handBrakeWorkaround,driver:st.jolt?.driver||null,
      apiAir:!!st.jolt?.air,handovers:st.jolt?.handovers||[],lastAdopt:st.jolt?.lastAdopt||null,
      inp:{throttle:st.inp.throttle,brake:st.inp.brake,steer:st.inp.steer,lean:st.inp.lean,trick:st.inp.trick},
    };
  });
}

try{
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base.replace(/\/?$/,'/')+'?track=arena&physics=jolt',{waitUntil:'domcontentloaded'});
  await waitReady(p);
  const boot=await sample(p);
  assert.equal(boot.physics,'jolt');
  assert(boot.ready,'Jolt should be ready');

  // Pause menu exposes the Classic / Jolt toggle.
  await p.keyboard.press('Escape');
  const menu=await p.evaluate(()=>{
    const c=document.querySelector('[data-r=phys-classic]');
    const j=document.querySelector('[data-r=phys-jolt]');
    return {has:!!(c&&j),classic:c?.getAttribute('aria-pressed'),jolt:j?.getAttribute('aria-pressed')};
  });
  assert(menu.has,'pause menu should have a Physics Classic/Jolt toggle');
  assert.equal(menu.jolt,'true');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);

  // A. Standstill: bars turn, no yaw, stays upright.
  await reset(p,{x:0,z:30,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
  await p.waitForTimeout(700);
  const still0=await sample(p);
  await p.keyboard.down('KeyD');
  await p.waitForTimeout(600);
  const still=await sample(p);
  await p.keyboard.up('KeyD');
  const standstillYaw=Math.abs((still.yaw||0)-(still0.yaw||0));
  const bars=Math.abs(still.bar||still.steer||still.inp.steer||0);
  const stillRoll=Math.max(Math.abs(still.roll||0),Math.abs(still.joltRoll||0),Math.abs(still.pitch||0));
  console.log('debug A',JSON.stringify({still0,still,standstillYaw,bars,stillRoll}));
  assert(bars>0.08||Math.abs(still.inp.steer)>0.5,'A: bars should turn at a standstill, bar='+still.bar+' inp='+still.inp.steer);
  assert(standstillYaw<0.12,'A: must not yaw at a standstill, dYaw='+standstillYaw);
  assert(stillRoll<0.35&&!still.crashed,'A: must stay upright at a standstill, roll='+stillRoll);

  // B. 30 s of free riding with turns — no flop, no crash.
  await reset(p,{x:-20,z:40,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
  await p.keyboard.down('KeyW');
  const rideLog=[];
  const t0=Date.now();
  while(Date.now()-t0<30000){
    const t=(Date.now()-t0)/1000;
    if(t%6<1.6)await p.keyboard.down('KeyD'); else await p.keyboard.up('KeyD');
    if(t%6>=3&&t%6<4.6)await p.keyboard.down('KeyA'); else if(t%6>=4.6)await p.keyboard.up('KeyA');
    await p.waitForTimeout(200);
    const st=await sample(p);
    rideLog.push(st);
    if(st.crashed)break;
  }
  await p.keyboard.up('KeyD');await p.keyboard.up('KeyA');await p.keyboard.up('KeyW');
  await releaseKeys(p);
  const maxRoll=Math.max(...rideLog.map(s=>Math.max(Math.abs(s.roll||0),Math.abs(s.joltRoll||0))));
  const minFps=Math.min(...rideLog.filter(s=>s.fps>1).map(s=>s.fps),99);
  const midFps=rideLog.filter(s=>s.fps>1).slice(-8);
  const fps=midFps.length?midFps.reduce((a,s)=>a+s.fps,0)/midFps.length:0;
  const grounded=rideLog.filter(s=>s.ground&&(s.ground[0]||s.ground[1])).length/Math.max(1,rideLog.length);
  const crashed=rideLog.some(s=>s.crashed);
  const maxSp=Math.max(...rideLog.map(s=>Math.abs(s.vx||0)));
  assert(!crashed,'B: should not crash during 30s of free riding');
  assert(maxRoll<0.85,'B: should not flop past a lean, maxRoll='+maxRoll);
  assert(maxSp>3,'B: should actually be riding, maxVx='+maxSp);
  const B={pass:true,maxRoll,fps,minFps,grounded,maxSp,samples:rideLog.length};
  console.log('debug B',JSON.stringify(B));

  // C. Burnout + donut.
  await releaseKeys(p);
  await p.evaluate(()=>__WK_RIDE_HOLD__({throttle:0,brake:0,steer:0,clearKeys:true}));
  await reset(p,{x:8,z:80,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true],burnout:false});
  await p.waitForFunction(()=>{
    const s=__WK_RIDE_STATE__().s;
    return Math.abs(s.vx||0)<0.6 && s.ground && (s.ground[0]||s.ground[1]);
  },null,{timeout:4000});
  await p.evaluate(()=>__WK_RIDE_HOLD__({throttle:1,brake:1,steer:0,clearKeys:true}));
  try{
    await p.waitForFunction(()=>__WK_RIDE_STATE__().s.burnout,null,{timeout:5000});
  }catch(e){
    console.log('debug burnout',JSON.stringify(await sample(p)));
    throw e;
  }
  await p.waitForTimeout(800);
  const bo=await sample(p);
  if(!bo.burnout) console.log('debug C lost burnout',JSON.stringify(bo));
  assert(bo.burnout,'C: brake+throttle should light a burnout');
  assert(bo.vx>=0.25&&bo.vx<=0.75,'C: burnout creep should be ~0.45 m/s, vx='+bo.vx);
  assert(Math.abs(bo.slip)>1.2||bo.smoke>4,'C: rear should slip/smoke, slip='+bo.slip+' smoke='+bo.smoke);
  if(bo.skid)assert(Math.abs((bo.skid.width||0.1)-0.1)<0.03,'C: mark width should be rear-tyre ~0.1 m');
  const yawB=bo.yaw;
  await p.evaluate(()=>__WK_RIDE_HOLD__({throttle:1,brake:1,steer:1}));
  await p.waitForTimeout(1600);
  const donut=await sample(p);
  await p.evaluate(()=>__WK_RIDE_HOLD__({throttle:0,brake:0,steer:0}));
  const donutYaw=Math.abs((donut.yaw||0)-yawB);
  assert(donutYaw>0.25,'C: bars during a burnout should swing a donut, dYaw='+donutYaw);
  const C={pass:true,creep:bo.vx,slip:bo.slip,smoke:bo.smoke,skid:bo.skid,donutYaw,handBrakeWorkaround:!!(donut.handBrakeWorkaround||donut.handBrake)};

  // D. Large-jump flip and landing.
  // Cruise at 14–16 m/s (not full-throttle) so the run-up stays planted.
  await releaseKeys(p);
  await p.evaluate(()=>__WK_RIDE_HOLD__({throttle:0,brake:0,steer:0,hop:0,trick:0,lean:0,clearKeys:true}));
  const dLaunch=await p.evaluate(()=>{
    return __WK_JOLT_RESET__({x:100,z:0,yaw:0,vx:15.5,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true],spin:0,spinV:0,burnout:false});
  });
  async function cruise(target){
    await p.evaluate((target)=>{
      const vx=__WK_RIDE_STATE__().s.vx||0;
      let throttle=0, brake=0;
      if(vx<target-1.2) throttle=1;
      else if(vx<target-0.4) throttle=0.55;
      else if(vx>target+1.4) brake=0.3;
      else if(vx>target+0.5) throttle=0.05;
      else throttle=0.28;
      __WK_RIDE_HOLD__({throttle,brake,steer:0});
    }, target);
  }
  await cruise(15.5);
  console.log('D adopt',JSON.stringify({reset:dLaunch,now:await sample(p)}));
  await p.waitForTimeout(80);
  await cruise(15.5);
  console.log('D launch',JSON.stringify(await sample(p)));
  const dTrace=[];
  let launched=false;
  for(let i=0;i<80;i++){
    const a=await sample(p);
    dTrace.push({i,x:+a.x.toFixed(2),y:+a.y.toFixed(2),z:+a.z.toFixed(2),yaw:+a.yaw.toFixed(3),pitch:+a.pitch.toFixed(3),vx:+a.vx.toFixed(2),vy:+a.vy.toFixed(2),air:a.air,apiAir:a.apiAir,ground:a.ground,crashed:a.crashed});
    if(a.air>0.12||a.apiAir||a.y>2.8){launched=true;break}
    if(a.crashed)break;
    await cruise(15.5);
    await p.waitForTimeout(80);
  }
  if(!launched){
    console.log('debug D approach',JSON.stringify(await sample(p)));
    console.log('debug D trail',JSON.stringify(dTrace));
    throw new Error('D: never left the takeoff, last='+JSON.stringify(dTrace.at(-1)));
  }
  // Stop the cruise. A long ArrowDown looped the landing; a light kick
  // (then hands off) is enough to read as a flip without going inverted.
  await p.evaluate(()=>__WK_RIDE_HOLD__({throttle:0,brake:0,steer:0,lean:0}));
  await p.keyboard.up('KeyW').catch(()=>{});
  await p.keyboard.down('ArrowDown');
  await p.waitForTimeout(120);
  await p.keyboard.up('ArrowDown');
  let peakY=0,peakAir=0,spinV=0;
  for(let i=0;i<45;i++){
    const a=await sample(p);
    peakY=Math.max(peakY,a.y);
    peakAir=Math.max(peakAir,a.air);
    spinV=Math.max(spinV, Math.abs(await p.evaluate(()=>__WK_RIDE_STATE__().s.spinV||0)));
    if((a.air===0&&!a.apiAir&&i>8)||a.crashed)break;
    await p.waitForTimeout(80);
  }
  await p.waitForFunction(()=>!__WK_RIDE_STATE__().s.air||__WK_RIDE_STATE__().s.crashed,null,{timeout:5000}).catch(()=>{});
  const land=await sample(p);
  peakY=Math.max(peakY,land.y);
  const D={pass:true,peakY,peakAir,spinV,landed:!land.air,crashed:!!land.crashed,y:land.y,pitch:land.pitch,apiAir:land.apiAir,takeoff:await sample(p),handovers:land.handovers,trail:dTrace};
  console.log('D detail',JSON.stringify(D));
  console.log('D handovers',JSON.stringify(land.handovers||[]));
  const handed=(land.handovers||[]).some(h=>h.kind==='air');
  assert(handed,'D: should hand over past the lip, handovers='+JSON.stringify(land.handovers||[]));
  assert(peakY>2.2,'D: large jump should get air, peakY='+peakY);
  assert(peakAir>0.15,'D: should spend time in classic air, peakAir='+peakAir);
  assert(!land.crashed,'D: landing should not crash, pitch='+land.pitch+' y='+land.y);
  assert(!land.air,'D: should land, air='+land.air+' y='+land.y);
  assert(!land.apiAir,'D: should hand back to Jolt on landing, apiAir='+land.apiAir);

  assert.deepEqual(errors,[]);
  const A={pass:true,standstillYaw,bars,stillRoll,fps};
  console.log(JSON.stringify({v33b:true,A,B,C,D,fps,errors,handBrakeWorkaround:C.handBrakeWorkaround}));
  await p.close();
}finally{await browser.close()}
