// Handlebar steering: no yaw at a standstill, kinematic bicycle radius, tyre grip, slower burnout.
import assert from 'node:assert/strict';
import {bikeParams,makeState,step,makePlaygroundTerrain} from '../ride-physics.js';
import {stepHeading,maxSteerAngle,STEER_MAX_LOW,STEER_MAX_HIGH,STEER_BURNOUT} from '../ride-freeroam.js';

const ter=makePlaygroundTerrain(),P=bikeParams({powertrain:'electric',P:4000,nm:80,wb:1.3,grip:1});
assert.equal(P.wb,1.3);

const still=makeState(P,0,ter);still.vx=0;still.ground=[true,true];
for(let i=0;i<45;i++)stepHeading(still,{steer:1},1/60,P);
assert.equal(still.yaw||0,0,'standstill must not yaw, yaw='+(still.yaw||0));
assert(still.steer>STEER_MAX_LOW*.9,'bars should ease to near full lock, steer='+still.steer);
const released={...still};
for(let i=0;i<45;i++)stepHeading(released,{steer:0},1/60,P);
assert(Math.abs(released.steer)<0.02,'bars spring back on release, steer='+released.steer);
assert.equal(released.yaw||0,0);

// Reverse: negative v yaws the opposite way.
const fwd=makeState(P,0,ter);fwd.vx=4;fwd.ground=[true,true];
const rev=makeState(P,0,ter);rev.vx=-4;rev.ground=[true,true];
for(let i=0;i<30;i++){stepHeading(fwd,{steer:1},1/60,P);stepHeading(rev,{steer:1},1/60,P);}
assert(fwd.yaw>0.05&&rev.yaw< -0.05,'reverse turns the opposite way '+JSON.stringify({fwd:fwd.yaw,rev:rev.yaw}));

// Turn radius matches R = wb / tan(δ) at a few speeds. Hold vx fixed after the bars settle.
const radii=[];
for(const v of [3,6,10]){
  const s=makeState(P,0,ter);s.vx=v;s.ground=[true,true];
  for(let i=0;i<40;i++){stepHeading(s,{steer:1},1/60,P);s.vx=v;}
  const bar=s.steer,expectRate=v*Math.tan(bar)/P.wb;
  const yaw0=s.yaw,x0=s.x,z0=s.z||0;
  const dt=1/60;
  for(let i=0;i<60;i++){
    const x=s.x,z=s.z||0;
    step(s,P,{throttle:0,brake:0,lean:0,hop:0,trick:0,whip:0,steer:1},dt,ter);
    s.vx=v;
    // stepHeading runs before advance, so travel is along the post-step heading.
    const yaw=s.yaw,dx=s.x-x,dz=(s.z||0)-z;
    const along=dx*Math.cos(yaw)+dz*Math.sin(yaw);
    const lat=-dx*Math.sin(yaw)+dz*Math.cos(yaw);
    assert(Math.abs(lat)<1e-5,'no lateral slip at v='+v+' lat='+lat);
    assert(along>0,'must advance along heading');
  }
  const dYaw=s.yaw-yaw0,rate=dYaw/1,R=Math.abs(v/rate),Rexp=P.wb/Math.tan(bar);
  assert(Math.abs(rate-expectRate)/expectRate<0.08,'yaw rate should match v tan(δ)/wb at v='+v+' got '+rate+' expect '+expectRate);
  assert(Math.abs(R-Rexp)/Rexp<0.12,'turn radius should match wb/tan(δ) at v='+v+' R='+R+' expect '+Rexp+' bar='+bar);
  assert(maxSteerAngle(v,P.vmax)<maxSteerAngle(0,P.vmax)-.02,'lock should tighten with speed');
  radii.push({v,bar,R,Rexp,rate,expectRate});
}
assert(radii[2].bar<radii[0].bar,'high speed has less lock');

// Burnout still pivots, but slower than the old 1.65 rad/s spin.
const bo=makeState(P,0,ter);bo.vx=.4;bo.ground=[true,true];
for(let i=0;i<30;i++)step(bo,P,{throttle:1,brake:1,lean:0,hop:0,trick:0,whip:0,steer:0},1/60,ter);
assert(bo.burnout,'burnout should light');
const yawB=bo.yaw||0;
for(let i=0;i<60;i++)step(bo,P,{throttle:1,brake:1,lean:0,hop:0,trick:0,whip:0,steer:1},1/60,ter);
const dB=(bo.yaw||0)-yawB;
assert(bo.burnout&&Math.abs(bo.vx)<1.2,'still a burnout, vx='+bo.vx);
assert(dB>0.25,'burnout still swings the rear, dYaw='+dB);
assert(dB<STEER_BURNOUT*1.15,'burnout slide is slower than a snap-spin, dYaw='+dB);

console.log(JSON.stringify({handlebarSteer:true,standstill:{yaw:still.yaw,bar:still.steer},radii,burnout:dB}));
