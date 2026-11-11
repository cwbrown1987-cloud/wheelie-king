// v34: Project-Wheelie style rider controls on the Jolt Playground: wheelie toggle hold,
// loop-out, burnout, drift and stand. Node only.
import assert from 'node:assert/strict';
import {createJoltRide} from '../ride-jolt.js';
const profile={mass:137,comBack:.37,comH:.95,wheelbase:1.36,wheelR:.33,front:{travel:.18,damping:.55},rear:{travel:.23},engine:{torque:250,power:6000,topSpeed:80/3.6,driveAxle:'rear'},friction:1.15,brakeTorque:1};
const P={R:.33,wb:1.36,comBack:.37,comH:.95},dt=1/60,D=180/Math.PI;
async function bike(){const j=createJoltRide({P,profile});await j.start();const s={x:0,z:0,yaw:0,vx:0,events:[]};j.adopt(s);for(let i=0;i<30;i++)j.step(s,P,{},dt);return {j,s};}
const run=(j,s,f,sec)=>{for(let i=0;i<sec/dt;i++)j.step(s,P,f(s,i*dt),dt);};
const toSpeed=(j,s,v)=>{for(let i=0;i<900&&s.vx<v;i++)j.step(s,P,{throttle:.6},dt);};
const R={};
{ // wheelie: toggle on, feather throttle around a 35° balance point
  const target=35/D;
  // rider bot: feather the throttle around the target and cover the rear brake past it (as a real rider does)
  const feather=(s)=>{const e=target-s.pitch-.35*(s.w||0);return e>=0?{mono:true,throttle:Math.min(1,.35+2.5*e)}:{mono:true,throttle:Math.max(0,.35+3*e),brake:e<-.03?Math.min(.8,-3*e):0};};
  let {j,s}=await bike();toSpeed(j,s,15/3.6);
  let up=0,best=0,pmax=0;for(let t=0;t<6&&!s.crashed;t+=dt){j.step(s,P,feather(s),dt);if(!s.ground[1]&&s.pitch>10/D){up+=dt;best=Math.max(best,up);}else up=0;pmax=Math.max(pmax,s.pitch);}
  const held={seconds:best,maxDeg:pmax*D,crashed:s.crashed||null};
  // set down: lift for 1 s, toggle off, front lands and the bike stays up
  ({j,s}=await bike());toSpeed(j,s,15/3.6);run(j,s,feather,1.2);const liftedDeg=s.pitch*D;run(j,s,()=>({mono:false}),2);
  R.wheelie={held,liftedDeg,afterOffPitchDeg:s.pitch*D,frontDown:s.ground[1],crashedAfter:s.crashed||null};
}
{ // overcooked: toggle on and pin it
  const {j,s}=await bike();toSpeed(j,s,12/3.6);let t=0;
  for(;t<5&&!s.crashed;t+=dt)j.step(s,P,{mono:true,throttle:1,lean:1},dt);
  R.loopOut={crashed:s.crashed||null,t};
}
{ // burnout at a standstill
  const {j,s}=await bike();let vmax=0;run(j,s,(s)=>{vmax=Math.max(vmax,Math.abs(s.vx));return {throttle:1,brake:1}},2);
  R.burnout={rearSurface:s.wheelOmega[0]*.33,maxVx:vmax,mode:s.burnout};
}
{ // drift vs plain turn at 30 km/h
  const slipAngle=(s,j)=>{const d=j.dump();return 0;};
  const measure=async(inp)=>{const {j,s}=await bike();toSpeed(j,s,30/3.6);let yawr=0,maxSlide=0;
    let latMin=1;run(j,s,(s)=>{latMin=Math.min(latMin,j.dump().driver.rearLatScale);return inp},1.5);
    // rear slide: lateral speed of the body vs its heading
    const vlat=[];run(j,s,(s)=>{vlat.push(Math.abs(s.curvature*s.vx));yawr=Math.max(yawr,Math.abs(s.wYaw||0));return inp},.01);
    const d=j.dump();return {yawRate:yawr,rearLat:latMin,mode:d.driver.mode,vx:s.vx};};
  R.turn=await measure({throttle:.3,steer:1});
  R.drift=await measure({throttle:1,brake:1,steer:1});
}
{ // stand: COM up, springs softer; same lean input gives more pitch
  const lean=async(stand)=>{const {j,s}=await bike();run(j,s,()=>({stand}),1);const sag=j.dump().contact.rear.susp;toSpeed(j,s,12/3.6);let p=0;run(j,s,(s)=>{p=Math.max(p,s.pitch);return {stand,lean:1,throttle:.5}},1);return {sag,pitchDeg:p*D,standing:s.standing,crashed:s.crashed||null};};
  R.stand={sit:await lean(false),stand:await lean(true)};
}
console.log(JSON.stringify(R,(k,v)=>typeof v==='number'?+v.toFixed(3):v,1));
assert(R.wheelie.held.seconds>=2&&R.wheelie.held.maxDeg<70,'feathered wheelie holds 2 s+');
assert(R.wheelie.liftedDeg>10,'toggle lifts the front');
assert(R.wheelie.frontDown&&Math.abs(R.wheelie.afterOffPitchDeg)<6&&!R.wheelie.crashedAfter,'toggle off sets it down upright');
assert.equal(R.loopOut.crashed,'LOOPED OUT');
assert(R.burnout.rearSurface>5&&R.burnout.maxVx<1.5&&R.burnout.mode,'burnout spins the rear in place');
assert.equal(R.drift.mode,'drift');
assert(R.drift.yawRate>1.5*R.turn.yawRate,'drift rotates much faster than a plain turn');
assert(R.stand.stand.standing&&R.stand.stand.sag!==R.stand.sit.sag,'standing changes the suspension');
assert(R.stand.stand.pitchDeg>R.stand.sit.pitchDeg,'standing gives more lean authority');
{ // stock pedal BMX (250 W, rigid): toggle lifts at walking pace, feathered hold below its ~19° balance point
  const pr={mass:96.4,comBack:.31,comH:.88,wheelbase:1,wheelR:.255,front:{travel:0,damping:.25},rear:{travel:0},engine:{torque:40,power:250,topSpeed:5,driveAxle:'rear'},friction:1,brakeTorque:1};
  const P2={R:.255,wb:1,comBack:.31,comH:.88};const j=createJoltRide({P:P2,profile:pr});await j.start();const s={x:0,z:0,yaw:0,vx:0,events:[]};j.adopt(s);
  for(let i=0;i<300&&s.vx<1.5;i++)j.step(s,P2,{throttle:1},dt);
  const target=15/D;const f=(s)=>{const e=target-s.pitch-.35*(s.w||0);return e>=0?{mono:true,throttle:Math.min(1,.35+2.5*e)}:{mono:true,throttle:Math.max(0,.35+3*e),brake:e<-.03?Math.min(.8,-3*e):0};};
  let up=0,best=0;for(let t=0;t<6&&!s.crashed;t+=dt){j.step(s,P2,f(s),dt);if(!s.ground[1]&&s.pitch>8/D){up+=dt;best=Math.max(best,up)}else up=0;}
  R.bmxWheelie={held:best,crashed:s.crashed||null};assert(best>=3,'stock BMX wheelie holds 3 s+ '+JSON.stringify(R.bmxWheelie));
}
console.log(JSON.stringify({bmxWheelie:R.bmxWheelie}));
console.log('v34-controls ok');
