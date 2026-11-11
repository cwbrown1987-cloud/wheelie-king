// Free-roam heading + (x,z) helpers around the classic pitch/wheelie step (Playground fallback when Jolt is off).

export function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a))}

// Handlebar steering (kinematic bicycle). LEFT/RIGHT set a target bar angle;
// yaw comes from v*tan(δ)/wheelbase. At a standstill the bars turn and the
// bike does not spin. Burnout is the exception: a slower rear-tyre slide.
export const STEER_MAX_LOW=33*Math.PI/180,STEER_MAX_HIGH=7*Math.PI/180,STEER_TAU=.15,STEER_BURNOUT=.7;
export function maxSteerAngle(speed,vmax=12){
  const t=Math.min(1,Math.abs(speed||0)/Math.max(8,vmax));
  return STEER_MAX_LOW+(STEER_MAX_HIGH-STEER_MAX_LOW)*t;
}
export function stepHeading(s,inp,dt,p){
  const onG=!!(s.ground[0]||s.ground[1]);
  const v=s.vx||0,wb=Math.max(.9,p?.wb||1.25),vmax=p?.vmax||12;
  const maxA=maxSteerAngle(v,vmax);
  const target=Math.max(-1,Math.min(1,inp.steer||0))*maxA;
  s.steerTarget=target;
  const k=1-Math.exp(-Math.max(0,dt)/STEER_TAU);
  s.steer=(s.steer||0)+(target-(s.steer||0))*k;
  if(Math.abs(s.steer)<1e-5)s.steer=0;
  s.curvature=Math.tan(s.steer)/wb;
  if(s.burnout&&onG){
    // Slow rear-slide around the parked front tyre: full lock ≈ 0.7 rad/s.
    // The front axle is the pivot; the rear swings out into a donut.
    const front=wb*(1-(p?.comBack??.42));
    const yaw0=s.yaw||0,c0=Math.cos(yaw0),n0=Math.sin(yaw0);
    const fx=s.x+c0*front,fz=(s.z||0)+n0*front;
    s.yaw=yaw0+(s.steer/STEER_MAX_LOW)*STEER_BURNOUT*dt;
    const c=Math.cos(s.yaw),n=Math.sin(s.yaw);
    s.x=fx-c*front;s.z=fz-n*front;
    return s;
  }
  const airScale=onG?1:.2;
  s.yaw=(s.yaw||0)+v*Math.tan(s.steer)/wb*airScale*dt;
  return s;
}

export function collideFreeRoam(s,p,ter){
  if(!ter?.freeRoam)return s;
  const r=(p.R||.3)+.28;
  const b=ter.bounds;
  const reject=(nx,nz)=>{
    const c=Math.cos(s.yaw||0),n=Math.sin(s.yaw||0);
    let wx=(s.vx||0)*c,wz=(s.vx||0)*n;
    const d=wx*nx+wz*nz;
    if(d<0){wx-=d*nx;wz-=d*nz;s.vx=wx*c+wz*n;}
  };
  if(s.x<b.xmin+r){s.x=b.xmin+r;reject(1,0)}
  else if(s.x>b.xmax-r){s.x=b.xmax-r;reject(-1,0)}
  if((s.z||0)<b.zmin+r){s.z=b.zmin+r;reject(0,1)}
  else if((s.z||0)>b.zmax-r){s.z=b.zmax-r;reject(0,-1)}
  const z=s.z||0;
  for(const box of ter.boxes){
    const minx=box.x-box.hx-r,maxx=box.x+box.hx+r,minz=box.z-box.hz-r,maxz=box.z+box.hz+r;
    if(s.x<=minx||s.x>=maxx||z<=minz||z>=maxz)continue;
    const left=s.x-minx,right=maxx-s.x,down=z-minz,up=maxz-z;
    const m=Math.min(left,right,down,up);
    if(m===left){s.x=minx;reject(-1,0)}
    else if(m===right){s.x=maxx;reject(1,0)}
    else if(m===down){s.z=minz;reject(0,-1)}
    else {s.z=maxz;reject(0,1)}
  }
  return s;
}

