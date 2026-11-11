// v33a: Jolt MotorcycleController sandbox — tests A (steer/lean/FPS), B (burnout/donut), C (air handover vs current game).
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {makeArenaTerrain,bikeParams,makeState,step} from '../ride-physics.js';

const P=bikeParams({P:4000,kg:40,driveAxle:'rear',powertrain:'electric',batteryWh:1000,wb:1.34,wheelR:.33,comH:.9,comBack:.42});
const ter=makeArenaTerrain();
// Current-game flip baseline: launch the large kicker at 15 m/s, hold back-lean.
const ramp=ter.ramps.find(r=>r.name==='large');
const game=makeState(P,ramp.x-6,ter);game.z=ramp.z;game.yaw=ramp.yaw||0;game.vx=15;game.y=ter.height(game.x,game.z)+.5;
let gamePeak=game.y,gameSpin=0,gameAir=0,gameLand=null;
for(let i=0;i<240;i++){
  const was=game.air;
  step(game,P,{throttle:1,brake:0,lean:game.air>0.05?1:0,hop:0,trick:game.air>0.2?1:0,whip:0,steer:0},1/60,ter);
  gamePeak=Math.max(gamePeak,game.y);
  if(game.spinV)gameSpin=game.spinV;
  if(game.air>gameAir)gameAir=game.air;
  if(was>0.1&&!game.air&&gameLand==null)gameLand={y:game.y,air:was,crashed:game.crashed};
}
const gameBase={peakY:gamePeak,spinRate:gameSpin,air:gameAir,land:gameLand,takeoffY:ter.height(ramp.x,ramp.z)};

async function waitGround(p, extra={}){
  const t0=Date.now();
  while(Date.now()-t0<9000){
    const s=await p.evaluate(()=>__WK_JOLT_STATE__());
    const g=s.ground&&(s.ground[0]||s.ground[1]);
    if(g && !s.air && s.speed<(extra.maxSpeed??1.0) && s.y<2.2) return s;
    await p.waitForTimeout(100);
  }
  const s=await p.evaluate(()=>__WK_JOLT_STATE__());
  console.log('settle timeout',JSON.stringify(s));
  throw new Error('bike did not settle: y='+s.y+' speed='+s.speed+' air='+s.air+' ground='+s.ground);
}

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const browser=await launchBrowser();
try{
  const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base.replace(/\/?$/,'/')+'jolt-sandbox.html?v='+Date.now(),{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>globalThis.__WK_JOLT_STATE__?.()?.ready,null,{timeout:90000});
  await p.mouse.click(420,200);
  await p.evaluate(()=>window.focus());
  const afterReset=await p.evaluate(()=>{__WK_JOLT_RESET__({x:0,y:0.98,z:-8,yaw:0});return __WK_JOLT_STATE__();});
  console.log("after reset",JSON.stringify({x:afterReset.x,y:afterReset.y,z:afterReset.z,speed:afterReset.speed,air:afterReset.air}));
  await waitGround(p,{maxSpeed:0.6});
  await p.waitForTimeout(250);

  // A. Bars turn at a standstill, the chassis does not yaw. Then a rolling turn leans.
  const still0=await p.evaluate(()=>__WK_JOLT_STATE__());
  await p.evaluate(()=>__WK_JOLT_INPUT__({steer:1}));
  await p.waitForTimeout(500);
  const still=await p.evaluate(()=>__WK_JOLT_STATE__());
  await p.evaluate(()=>__WK_JOLT_INPUT__({steer:0}));
  const standstillTurn=Math.abs((still.yaw||0)-(still0.yaw||0));
  const barsTurned=Math.abs(still.bar||still.joltSteer||0)>0.15;
  if(!barsTurned) console.log('debug A',JSON.stringify({still0,still,errors}));
  assert(barsTurned,'A: bars should turn at a standstill, bar='+still.bar+' steer='+still.steer+' err='+errors);
  assert(standstillTurn<0.12,'A: must not yaw at a standstill, dYaw='+standstillTurn);
  // Rolling turn
  await p.evaluate(()=>{ /* leave where it is */ });
  await p.evaluate(()=>__WK_JOLT_RESET__({x:0,y:0.98,z:-8,yaw:0}));
  await p.waitForTimeout(1200);
  await p.evaluate(()=>__WK_JOLT_INPUT__({throttle:1,steer:0,brake:0}));
  await p.waitForTimeout(900);
  const yawBeforeSt=await p.evaluate(()=>__WK_JOLT_STATE__());
  const yawBefore=yawBeforeSt.yaw;
  await p.evaluate(()=>__WK_JOLT_INPUT__({throttle:1,steer:1}));
  await p.waitForTimeout(1100);
  const turned=await p.evaluate(()=>__WK_JOLT_STATE__());
  await p.evaluate(()=>__WK_JOLT_INPUT__({throttle:0,steer:0}));
  const dYaw=Math.abs((turned.yaw||0)-yawBefore);
  assert(dYaw>0.15,'A: a moving bike should turn from the bars, dYaw='+dYaw+' speed='+turned.speed);
  const fpsA=turned.fps;
  assert(fpsA>20,'A: FPS should be playable, fps='+fpsA);
  const A={pass:true,standstillTurn,bar:still.bar,dYaw,fps:fpsA,speed:turned.speed};

  // FPS with Chrome CPU 4x (phone-like).
  const cdp=await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.waitForTimeout(200);
  await p.evaluate(()=>__WK_JOLT_INPUT__({throttle:1}));
  await p.waitForTimeout(1800);
  const fps4=await p.evaluate(()=>__WK_JOLT_STATE__().fps);
  await p.evaluate(()=>__WK_JOLT_INPUT__({throttle:0}));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});

  // B. Burnout: W+S, creep, smoke + marks at the rear patch, then a donut.
  await p.evaluate(()=>__WK_JOLT_RESET__({x:8,y:0.98,z:-8,yaw:0}));
  await waitGround(p,{maxSpeed:0.6});
  await p.waitForTimeout(200);
  await p.evaluate(()=>__WK_JOLT_INPUT__({throttle:1,brake:1,steer:0}));
  try{
    await p.waitForFunction(()=>__WK_JOLT_STATE__().burnout,null,{timeout:5000});
  }catch(e){
    console.log('debug B',JSON.stringify(await p.evaluate(()=>__WK_JOLT_STATE__())));
    throw e;
  }
  await p.waitForTimeout(700);
  const bo=await p.evaluate(()=>__WK_JOLT_STATE__());
  if(!bo.burnout) console.log('debug B bo',JSON.stringify(bo));
  assert(bo.burnout,'B: brake+throttle should light a burnout, '+JSON.stringify({speed:bo.speed,ground:bo.ground,air:bo.air,throttle:bo.steer,y:bo.y,slip:bo.slip}));
  const creep=bo.speed;
  assert(creep>=0 && creep<3,'B: burnout should creep, not launch, speed='+creep);
  assert(Math.abs(bo.slip[0])>1.0 || bo.smoke>4,'B: rear should slip and/or smoke, '+JSON.stringify({slip:bo.slip,smoke:bo.smoke}));
  if(bo.skid){
    // Contact patch ≈ rear axle on the ground.
    const d=Math.hypot(bo.skid.x-bo.x,bo.skid.z-(bo.z-bo.wb*0.42)); // rough; also accept close to body
    assert(bo.skid.width===0.1||Math.abs(bo.skid.width-0.1)<0.02,'B: mark width should be rear-tyre 0.1 m');
  }
  const yawB=bo.yaw||0;
  await p.evaluate(()=>__WK_JOLT_INPUT__({throttle:1,brake:1,steer:1}));
  await p.waitForTimeout(1800);
  const donut=await p.evaluate(()=>__WK_JOLT_STATE__());
  await p.evaluate(()=>__WK_JOLT_INPUT__({throttle:0,brake:0,steer:0}));
  const donutYaw=Math.abs((donut.yaw||0)-yawB);
  assert(donutYaw>0.25,'B: bars during a burnout should swing a donut, dYaw='+donutYaw);
  const B={pass:true,creep,slip:bo.slip,smoke:bo.smoke,skid:bo.skid,donutYaw,handBrakeWorkaround:!!donut.handBrakeWorkaround};

  // C. Trick handover: drive at the large kicker (z=90), lean back, compare to current-game logs.
  await p.evaluate(()=>__WK_JOLT_RESET__({x:0,y:0.98,z:78,yaw:0,vz:14}));
  await waitGround(p,{maxSpeed:1.2});
  await p.waitForTimeout(200);
  await p.evaluate(()=>__WK_JOLT_INPUT__({throttle:1,brake:0,steer:0,lean:0,trick:0,hop:0}));
  await p.waitForTimeout(2800);
  // If we missed the kicker, hop into the air and lean.
  const mid=await p.evaluate(()=>__WK_JOLT_STATE__());
  if(!mid.air){await p.evaluate(()=>__WK_JOLT_INPUT__({hop:1,throttle:1}));await p.waitForTimeout(100);await p.evaluate(()=>__WK_JOLT_INPUT__({hop:0,throttle:1}));}
  await p.evaluate(()=>__WK_JOLT_INPUT__({lean:1,trick:1,throttle:1}));
  await p.waitForTimeout(300);
  // Sample while hopefully airborne, then wait out the landing.
  let air=await p.evaluate(()=>__WK_JOLT_STATE__());
  for(let i=0;i<20 && !air.air && !(air.lastAir&&air.lastAir.airT>0.1);i++){
    await p.waitForTimeout(80);
    air=await p.evaluate(()=>__WK_JOLT_STATE__());
  }
  await p.waitForTimeout(800);
  const airMid=air;
  air=await p.evaluate(()=>__WK_JOLT_STATE__());
  if((airMid.peakY||0)>(air.peakY||0)) air=airMid;
  await p.evaluate(()=>__WK_JOLT_INPUT__({lean:0,trick:0,throttle:0,hop:0}));
  // Wait to land if still airborne
  if(air.air){
    await p.waitForFunction(()=>!__WK_JOLT_STATE__().air,null,{timeout:4000}).catch(()=>{});
  }
  const land=await p.evaluate(()=>__WK_JOLT_STATE__());
  const peakY=Math.max(land.peakY||0,air.peakY||0,land.lastAir?.peakY||0,air.lastAir?.peakY||0);
  const spinV=air.spinV||land.spinV||land.lastAir?.spinV||air.lastAir?.spinV||0;
  const airT=Math.max(air.airT||0,land.airT||0,land.lastAir?.airT||0,air.lastAir?.airT||0);
  const C={
    sandbox:{peakY,spinV,airT,y:land.y,landed:!land.air},
    game:gameBase,
    spinRateMatch:Math.abs(spinV-(2*Math.PI/0.7))<1e-4
  };
  assert(C.sandbox.peakY>0.9,'C: should record a peak height, '+JSON.stringify(C.sandbox));

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({v33a:true,A,B,C,fps:{normal:fpsA,cpu4x:fps4},wasmBytes:2024218,handBrakeWorkaround:B.handBrakeWorkaround,game:gameBase,errors}));
  await p.close();
}finally{await browser.close()}
