// Shared side-view rail: a polyline path the rider locks to in side view,
// and eases back onto when returning from free roam. Arena first; sample3d later.
import {wrapAngle} from './ride-freeroam.js';

export const ARENA_TRACK_WIDTH=10;
// Gentle S through the small, medium and large kickers. The big kicker at
// (70,-28) stays a 3D off-track hit. Points are [x,z] in metres.
export const ARENA_TRACK_POINTS=[
  [-148,0],[-80,0],[-20,0],[28,0],[48,8],[70,22],[92,12],[115,0],[148,0]
];

export function easeInOut(t){
  // Smoothstep: zero slope at both ends, mid slope 1.5 (cubic was 3 and felt like a whip).
  t=Math.max(0,Math.min(1,t));
  return t*t*(3-2*t);
}

export function lerpAngle(a,b,t){return a+wrapAngle(b-a)*t}

function cr(p0,p1,p2,p3,t){
  const t2=t*t,t3=t2*t;
  return {
    x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    z:.5*((2*p1.z)+(-p0.z+p2.z)*t+(2*p0.z-5*p1.z+4*p2.z-p3.z)*t2+(-p0.z+3*p1.z-3*p2.z+p3.z)*t3)
  };
}

export function makeTrack(points,{width=ARENA_TRACK_WIDTH,spacing=.75}={}){
  const pts=points.map(p=>Array.isArray(p)?{x:p[0],z:p[1]}:p);
  const n=pts.length,samples=[];
  for(let i=0;i<n-1;i++){
    const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(n-1,i+2)];
    const seg=Math.hypot(p2.x-p1.x,p2.z-p1.z);
    const steps=Math.max(4,Math.round(seg/spacing));
    for(let k=0;k<steps;k++){
      if(i>0&&k===0)continue;
      samples.push(cr(p0,p1,p2,p3,k/steps));
    }
  }
  samples.push({...pts[n-1]});
  const cum=[0];
  let length=0;
  for(let i=1;i<samples.length;i++){
    length+=Math.hypot(samples[i].x-samples[i-1].x,samples[i].z-samples[i-1].z);
    cum.push(length);
  }
  for(let i=0;i<samples.length;i++){
    const a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)];
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz)||1;
    const tx=dx/d,tz=dz/d;
    samples[i].tx=tx;samples[i].tz=tz;samples[i].nx=-tz;samples[i].nz=tx;
    samples[i].heading=Math.atan2(tz,tx);samples[i].s=cum[i];
  }
  function interp(i,t){
    const a=samples[i],b=samples[Math.min(samples.length-1,i+1)],u=Math.max(0,Math.min(1,t));
    const x=a.x+(b.x-a.x)*u,z=a.z+(b.z-a.z)*u;
    const heading=lerpAngle(a.heading,b.heading,u);
    const tx=Math.cos(heading),tz=Math.sin(heading);
    return {x,z,s:a.s+(b.s-a.s)*u,heading,tx,tz,nx:-tz,nz:tx};
  }
  function pointAt(s){
    s=Math.max(0,Math.min(length,s));
    let lo=0,hi=cum.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(cum[mid]<s)lo=mid+1;else hi=mid;}
    const i=Math.max(0,lo-1);
    const span=(cum[i+1]??cum[i])-cum[i]||1;
    return interp(i,(s-cum[i])/span);
  }
  function nearest(x,z){
    let best=0,bestD=Infinity,bestT=0;
    for(let i=0;i<samples.length-1;i++){
      const ax=samples[i].x,az=samples[i].z,bx=samples[i+1].x-ax,bz=samples[i+1].z-az;
      const denom=bx*bx+bz*bz||1;
      const t=Math.max(0,Math.min(1,((x-ax)*bx+(z-az)*bz)/denom));
      const px=ax+bx*t,pz=az+bz*t,d=(x-px)*(x-px)+(z-pz)*(z-pz);
      if(d<bestD){bestD=d;best=i;bestT=t;}
    }
    const p=interp(best,bestT);
    const dist=Math.sqrt(bestD);
    const lat=(x-p.x)*p.nx+(z-p.z)*p.nz;
    return {...p,lat,dist,onTrack:dist<=width*.5};
  }
  return {width,length,samples,points:pts,pointAt,nearest,onTrack:(x,z)=>nearest(x,z).onTrack};
}

export function makeArenaTrack(){return makeTrack(ARENA_TRACK_POINTS,{width:ARENA_TRACK_WIDTH})}

export function canStartTrackReturn(s){
  if(s?.crashed)return false;
  if(!(s.ground?.[0]||s.ground?.[1]))return false;
  if((s.air||0)>.08)return false;
  if(s.spinV||s.whip||s.stunt)return false;
  return true;
}

export function startTrackReturn(s,track,lock){
  const n=track.nearest(s.x,s.z||0);
  const align=Math.abs(wrapAngle((s.yaw||0)-n.heading))<=Math.PI/2;
  lock.t=0;lock.dur=Math.max(.9,Math.min(2.4,.8+n.dist*.028));lock.lat0=n.lat;lock.s0=n.s;lock.s=n.s;
  lock.startYaw=s.yaw||0;lock.align=align?1:-1;lock.startX=s.x;lock.startZ=s.z||0;
  lock.mode=n.dist<.45?'locked':'gliding';
  if(lock.mode==='locked'){
    s.x=n.x;s.z=n.z;
    s.yaw=align?n.heading:n.heading+Math.PI;
  }
  return lock;
}

function stickGround(s,ter,oldX,oldZ){
  if(!(s.ground?.[0]||s.ground?.[1])||!ter?.height)return;
  s.y+=(ter.height(s.x,s.z||0)-ter.height(oldX,oldZ));
}

export function stepTrackLock(s,ter,lock,dt){
  const track=ter?.track;
  if(!track||!lock||lock.mode==='free'||lock.mode==='pending')return lock;
  const oldX=s.x,oldZ=s.z||0;
  if(lock.mode==='gliding'){
    lock.t=(lock.t||0)+dt;
    const u=easeInOut(lock.t/Math.max(.001,lock.dur||.9));
    lock.s=Math.max(0,Math.min(track.length,(lock.s??lock.s0)+(s.vx||0)*dt*(lock.align||1)));
    const p=track.pointAt(lock.s);
    const lat=(lock.lat0||0)*(1-u);
    s.x=p.x+p.nx*lat;s.z=p.z+p.nz*lat;
    const target=lock.align>0?p.heading:p.heading+Math.PI;
    s.yaw=lerpAngle(lock.startYaw,target,u);
    stickGround(s,ter,oldX,oldZ);
    if(lock.t>=lock.dur){
      lock.mode='locked';
      const n=track.nearest(s.x,s.z);
      const ox=s.x,oz=s.z;
      s.x=n.x;s.z=n.z;
      s.yaw=lock.align>0?n.heading:n.heading+Math.PI;
      stickGround(s,ter,ox,oz);
    }
  }else if(lock.mode==='locked'){
    const n=track.nearest(s.x,s.z||0);
    s.x=n.x;s.z=n.z;
    const align=Math.abs(wrapAngle((s.yaw||0)-n.heading))<=Math.PI/2;
    s.yaw=align?n.heading:n.heading+Math.PI;
    stickGround(s,ter,oldX,oldZ);
  }
  return lock;
}
