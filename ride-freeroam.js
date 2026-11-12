// Free-roam heading + (x,z) helpers around the classic pitch/wheelie step (Playground fallback when Jolt is off).

export function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a))}

// Handlebar steering (kinematic bicycle). LEFT/RIGHT set a target bar angle;
// yaw comes from v*tan(δ)/wheelbase. At a standstill the bars turn and the
// bike does not spin. Burnout is the exception: a slower rear-tyre slide.
export const STEER_MAX_LOW=33*Math.PI/180,STEER_MAX_HIGH=10*Math.PI/180,STEER_TAU=.15,STEER_BURNOUT=.7;
// Tyre grip limit for open-world turning (~0.9 g on dry ground): at speed the bars only go as far as
// the tyres can carry, so a full-lock tap is a fast, leaned turn instead of an on-rails pivot.
export const STEER_GRIP_G=1.3,WALL_STEP=.28,LEAN_TAU=.16,AIR_YAW=1.4; // arcade grip: tighter than a real 0.9 g so turns feel like a game, still no on-rails pivot
export function maxSteerAngle(speed,vmax=12){
  const t=Math.min(1,Math.abs(speed||0)/Math.max(8,vmax));
  return STEER_MAX_LOW+(STEER_MAX_HIGH-STEER_MAX_LOW)*t;
}
export function stepHeading(s,inp,dt,p){
  const onG=!!(s.ground[0]||s.ground[1]);
  const v=s.vx||0,wb=Math.max(.9,p?.wb||1.25),vmax=p?.vmax||12;
  const aLat=STEER_GRIP_G*9.8*Math.min(1.2,p?.grip||1),gripA=Math.abs(v)>.5?Math.atan(aLat*wb/(v*v)):Infinity;
  const maxA=Math.min(maxSteerAngle(v,vmax),gripA);
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
  // Lean-led turning, like a ridden bike: the bars set the lean the rider wants, the bike rolls into it
  // (LEAN_TAU), and the turn comes from the lean (yaw rate = g tan(lean) / v). At walking pace the bars
  // steer directly. So turns build up and unwind instead of the bike pivoting under the rider.
  const vAbs=Math.abs(v),leanMax=Math.atan(STEER_GRIP_G*Math.min(1.2,p?.grip||1));
  const leanWant=onG?Math.max(-leanMax,Math.min(leanMax,Math.atan(v*v*Math.tan(s.steer)/wb/9.8))):0;
  s.lean=(s.lean||0)+(leanWant-(s.lean||0))*(1-Math.exp(-Math.max(0,dt)/(onG?LEAN_TAU:.5)));
  const kin=v*Math.tan(s.steer)/wb,fromLean=vAbs>.5?9.8*Math.tan(s.lean)/v:0,mix=Math.max(0,Math.min(1,(vAbs-2)/3));
  // In the air the rider can aim the bike a little (body/hip turn), like Descenders: steer = yaw, any speed.
  const yawRate=onG?kin*(1-mix)+fromLean*mix:Math.max(-1,Math.min(1,inp.steer||0))*AIR_YAW;
  s.curvature=vAbs>.1?yawRate/v:Math.tan(s.steer)/wb;
  s.yaw=(s.yaw||0)+yawRate*dt;
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
  // Solid steep faces (ramp sides, walls): a tyre can't climb a near-vertical step. Riding into one
  // stops the bike against it (velocity into the face removed) instead of launching up it.
  if(ter.height&&(s.ground?.[0]||s.ground?.[1])&&Math.abs(s.vx||0)>.05){
    const dir=Math.sign(s.vx),c=Math.cos(s.yaw||0),n=Math.sin(s.yaw||0),cb=p.comBack??.42;
    const reach=dir>0?p.wb*(1-cb)+(p.R||.3)*.95:-(p.wb*cb+(p.R||.3)*.95),back=reach-dir*.3;
    const ax=s.x+c*reach,az=(s.z||0)+n*reach,here=ter.height(s.x+c*back,(s.z||0)+n*back),ahead=ter.height(ax,az);
    if(ahead-here>WALL_STEP){
      const e=.08,gx=ter.height(ax+e,az)-ter.height(ax-e,az),gz=ter.height(ax,az+e)-ter.height(ax,az-e),gl=Math.hypot(gx,gz)||1;
      reject(-gx/gl,-gz/gl);s.x-=c*dir*.02;s.z=(s.z||0)-n*dir*.02;s.wallHit=(s.wallHit||0)+1;
    }
  }
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

