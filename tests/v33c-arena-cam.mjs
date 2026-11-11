// v33c: cone knock-over, dirt drag, no sinking, arena chase cam. Plus a quick A–D.
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
  const s=st.s, j=st.jolt||{};
  const gy=st.ter?.height?st.ter.height(s.x,s.z||0):null;
  return {
    x:s.x,y:s.y,z:s.z||0,vx:s.vx,vy:s.vy,yaw:s.yaw,pitch:s.pitch,air:s.air,apiAir:!!j.air,
    crashed:!!s.crashed,ground:s.ground,comp:s.comp,roll:s.joltRoll,fps:st.quality?.fps,
    cam:st.chaseCam, cones:j.cones||[], gy, clearance:s.y-(gy||0), physics:st.physics,
    contact:j.contact, driver:j.driver, engine:j.engine, inp:st.inp
  };
});
const reset=(pose)=>p.evaluate(pose=>__WK_JOLT_RESET__(pose),pose);
const hold=(patch)=>p.evaluate(patch=>__WK_RIDE_HOLD__({clearKeys:true,...patch}),patch);

// 1. Hitting a cone must knock the cone, not launch the bike.
await hold({throttle:0,brake:0,steer:0});
await reset({x:2.5,z:2.3,yaw:0,vx:12,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
const gateAt=(a)=> (a.cones||[]).find(c=>c&&Math.abs((c.z||0)-2.3)<0.6&&Math.abs((c.x||0)-8)<1.2);
const first=await sample();
const gate0=gateAt(first);
await hold({throttle:0.5,brake:0,steer:0});
let coneMoved=false, maxVy=0, minVx=99, launched=false, buried=false, moving=false;
let beforeCone=null, afterHit=null, gate1=null;
for(let i=0;i<50;i++){
  const a=await sample();
  maxVy=Math.max(maxVy, a.vy||0);
  if(a.x>3.2){moving=true;minVx=Math.min(minVx, a.vx||0);}
  if(a.y>3.2||a.apiAir) launched=true;
  if(a.clearance<0.45) buried=true;
  const g=gateAt(a);
  if(g&&gate0&&Math.hypot(g.x-gate0.x,g.y-gate0.y,g.z-gate0.z)>0.2){coneMoved=true;gate1=g;afterHit=a;if(a.x>8.4)break;}
  if(a.x>16){afterHit=a;gate1=g;break;}
  if(a.x>6&&!beforeCone) beforeCone=a;
  if(a.crashed){afterHit=a;break;}
  await p.waitForTimeout(50);
}
afterHit=afterHit||await sample();
if(!coneMoved&&afterHit.x>10&&gate0&&!(afterHit.cones||[]).some(c=>c&&Math.abs(c.x-gate0.x)<0.4&&Math.abs(c.z-gate0.z)<0.4)) coneMoved=true;
console.log('cone',JSON.stringify({coneMoved,maxVy,minVx,launched,buried,crashed:afterHit.crashed,gate0,gate1,after:afterHit,beforeCone}));
assert(coneMoved||afterHit.x>8,'cone: should reach the gate cone, x='+afterHit.x);
assert(!afterHit.crashed,'cone: must not crash');
assert(!launched,'cone: must not launch the bike into a jump, vy='+maxVy+' y='+afterHit.y);
assert(maxVy<6.5,'cone: must not fling the bike up, maxVy='+maxVy);
assert(minVx>5,'cone: must not kill speed, minVx='+minVx);
assert(!buried,'cone: must not bury the bike, clearance='+afterHit.clearance);
assert(!afterHit.apiAir,'cone: must not get stuck in air handover');

// 2. Dirt only drags a little. Update the cruise every tick (a rider holding
// 14–16 m/s), then also check that a closed throttle eases off rather than slams.
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
for(let i=0;i<18;i++){await cruise();await p.waitForTimeout(80);}
const dirt=await sample();
console.log('dirt',JSON.stringify({vx:dirt.vx,x:dirt.x,y:dirt.y,clearance:dirt.clearance,comp:dirt.comp,contact:dirt.contact,driver:dirt.driver,engine:dirt.engine,inp:dirt.inp,pitch:dirt.pitch}));
assert(dirt.vx>=13.8,'dirt: cruise should only drag a little, vx='+dirt.vx);
assert(dirt.clearance>0.65,'dirt: should not sink, clearance='+dirt.clearance);
assert(!dirt.crashed&&!dirt.apiAir,'dirt: should stay planted');
await hold({throttle:0,brake:0,steer:0});
await reset({x:70,z:0,yaw:0,vx:15.5,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await hold({throttle:0,brake:0,steer:0});
await p.waitForTimeout(800);
const coast=await sample();
console.log('coast',JSON.stringify({vx:coast.vx,comp:coast.comp,contact:coast.contact,driver:coast.driver,engine:coast.engine,pitch:coast.pitch}));
assert(coast.vx>=12.5,'dirt: a closed throttle should only drag a little, vx='+coast.vx);

// 3. Standstill and a short hop-less ride: wheels stay above the floor.
await hold({throttle:0,brake:0,steer:0});
await reset({x:0,z:30,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await p.waitForTimeout(400);
const still=await sample();
console.log('sink-still',JSON.stringify({y:still.y,gy:still.gy,clearance:still.clearance,comp:still.comp}));
assert(still.clearance>0.7,'sink: standstill COM should sit above the floor, clearance='+still.clearance);
assert((still.comp||[0,0])[0]>=0&&(still.comp||[0,0])[0]<=1,'sink: rear compression should be live');

// 4. Chase cam at the lip: follow stays with the bike (no 2–3 m lag, camera rises with the face).
await hold({throttle:0,brake:0,steer:0});
await reset({x:100,z:0,yaw:0,vx:15.5,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
let lip=null, lags=[];
for(let i=0;i<50;i++){
  await cruise();
  const a=await sample();
  if(a.x>112&&a.x<122){
    const lag=Math.hypot(a.x-(a.cam?.followX??a.x), a.z-(a.cam?.followZ??a.z));
    lags.push({x:a.x,y:a.y,lag,camY:a.cam?.camY,followY:a.cam?.followY,airClose:a.cam?.airClose,lookAhead:a.cam?.lookAhead,apiAir:a.apiAir});
    lip=a;
  }
  if(a.apiAir||a.air>0.12||a.y>4||a.crashed){lip=lip||a;break;}
  await p.waitForTimeout(70);
}
console.log('lip-cam',JSON.stringify({lip:{x:lip?.x,y:lip?.y,cam:lip?.cam},lags}));
assert(lip,'cam: should reach the large kicker');
if(lip.cam){
  // Camera height should have climbed with the bike, not stayed on the flat (~2.15).
  assert(lip.cam.camY>lip.y-0.2,'cam: chase should rise with the lip, camY='+lip.cam.camY+' y='+lip.y);
  assert(lip.cam.followY>3.0||lip.y<2.5,'cam: followY should track the takeoff, followY='+lip.cam.followY+' y='+lip.y);
  const lag=Math.hypot(lip.x-(lip.cam.followX??lip.x), lip.z-(lip.cam.followZ??lip.z));
  // Look-ahead is ~0.1 s * 11 m/s ≈ 1.1 m in front, not a 2–3 m lag behind.
  assert(lag<2.4,'cam: follow should stay with the bike at the lip, lag='+lag);
}


assert.deepEqual(errors.filter(e=>!/AbortError/.test(e)),[], 'page errors '+errors.join('; '));
console.log(JSON.stringify({v33c:true,cone:{coneMoved,maxVy,minVx},dirt:{vx:dirt.vx,clearance:dirt.clearance},still:{clearance:still.clearance,comp:still.comp},lip:{x:lip.x,y:lip.y,camY:lip.cam?.camY,followY:lip.cam?.followY,airClose:lip.cam?.airClose},errors:[]}));
await p.close();
await browser.close();
