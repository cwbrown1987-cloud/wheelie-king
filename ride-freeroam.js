// Free-roam heading + (x,z) helpers around the classic pitch/wheelie step (Playground fallback when Jolt is off).

export function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a))}

// Handlebar steering (kinematic bicycle). LEFT/RIGHT set a target bar angle;
// yaw comes from v*tan(δ)/wheelbase. At a standstill the bars turn and the
// bike does not spin. Burnout is the exception: a slower rear-tyre slide.
export const STEER_MAX_LOW=33*Math.PI/180,STEER_MAX_HIGH=10*Math.PI/180,STEER_TAU=.15,STEER_BURNOUT=.7;
// Tyre grip limit for open-world turning (~0.9 g on dry ground): at speed the bars only go as far as
// the tyres can carry, so a full-lock tap is a fast, leaned turn instead of an on-rails pivot.
// AIR_YAW / AIR_TWIST (v2.1-11): in the air the rider can only twist the bike a little with body weight;
// the direction of travel doesn't change until the tyres touch down again.
export const STEER_GRIP_G=1.6,WALL_STEP=.28,LEAN_TAU=.16,AIR_YAW=.6,AIR_TWIST=.35;
// Brake slides. The bike body (yaw) and its direction of travel (moveYaw) split apart:
// - tap the brake while turning at speed -> the rear steps out and the bike swings round, up to ~180 deg
//   at full speed, then grips up (facing back if it went all the way round);
// - HOLD the brake while turning -> power slide that keeps rotating as long as you hold it.
// Throttle during a slide keeps the speed up (power slide). The tyres scrub speed while sideways.
export const SLIDE={minSpeed:6,rate:3.0,tapBudget:Math.PI,grip:.55,scrub:.55,powerScrub:.15,lean:.3,powerAngle:.95}; // arcade grip: tighter than a real 0.9 g so turns feel like a game, still no on-rails pivot
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
  const st=Math.max(-1,Math.min(1,inp.steer||0)),brk=Math.max(0,Math.min(1,inp.brake||0)),thr=Math.max(0,Math.min(1,inp.throttle||0));
  if(s.moveYaw==null||!s.sliding)s.moveYaw=s.yaw||0;
  // start a slide: brake + steer at speed (not leaning forward, which is a stoppie)
  if(!s.sliding&&onG&&v>SLIDE.minSpeed&&brk>.2&&Math.abs(st)>.3&&!(inp.lean<-.3)){
    s.sliding=true;s.slideHeld=0;s.slideDir=Math.sign(st);s.slideBudget=SLIDE.tapBudget*Math.min(1,(v-SLIDE.minSpeed*.5)/14);s.moveYaw=s.yaw||0;
  }
  if(onG&&s.sliding&&s.airTwist){
    s.airTwist=false;const g=wrapAngle((s.yaw||0)-s.moveYaw);
    if(Math.abs(g)<.12||v<SLIDE.minSpeed*.5){s.sliding=false;s.moveYaw=s.yaw||0;}else{s.slideDir=Math.sign(g);s.slideBudget=0;s.slideHeld=0;}
  }
  let yawRate;
  if(s.sliding&&onG){
    const holding=brk>.2,steering=Math.sign(st)===s.slideDir&&Math.abs(st)>.2;
    const travelRate=SLIDE.grip*9.8/Math.max(1.5,vAbs),slip=wrapAngle((s.yaw||0)-s.moveYaw)*s.slideDir;
    let rot;
    s.slideHeld=holding?(s.slideHeld||0)+dt:0;
    if(holding&&steering&&s.slideHeld>.3){
      // power slide: swing out to ~55 deg sideways and hold that angle while the slide carves round
      rot=Math.max(travelRate,SLIDE.rate*Math.min(1,v/6)*Math.max(0,Math.min(1,(SLIDE.powerAngle-slip)/.35)));
      s.slideBudget=0; // letting go of the brake ends the rotation and hooks up
    }else rot=steering&&s.slideBudget>0?SLIDE.rate*Math.min(1,v/6):0;
    yawRate=s.slideDir*rot;s.slideBudget-=rot*dt;
    // travel direction follows the body only as fast as sliding tyres allow
    const gap=wrapAngle((s.yaw||0)-s.moveYaw),turn=SLIDE.grip*9.8/Math.max(1.5,vAbs)*dt;
    s.moveYaw+=Math.max(-turn,Math.min(turn,gap));
    const side=Math.abs(Math.sin(gap));
    s.vx=Math.max(0,v-(thr>.5?SLIDE.powerScrub:SLIDE.scrub)*9.8*(.25+.75*side)*dt);
    s.lean+=(s.slideDir*SLIDE.lean-s.lean)*(1-Math.exp(-dt/.12));
    // grip back up: slowed right down, or rotation finished and travel has caught up
    const g2=wrapAngle((s.yaw||0)-s.moveYaw);
    if(s.vx<2.5||(rot===0&&Math.abs(g2)<.12)){
      if(Math.abs(g2)>Math.PI/2){s.vx=-s.vx*Math.abs(Math.cos(g2))*.3;} // ended facing back: roll a little backwards
      else s.vx*=Math.cos(g2);
      s.sliding=false;s.moveYaw=s.yaw||0;
    }
  }else if(!onG&&(s.airT=(s.airT||0)+dt)<.08){
    yawRate=onG?0:kin*(1-mix)+fromLean*mix; // a skip off a bump: carry on turning as on the ground, no slide
  }else if(!onG){
    // Airborne: travel direction is locked (moveYaw); steering twists the bike body a little, then it settles back.
    if(!s.sliding){s.sliding=true;s.slideDir=0;s.slideBudget=0;s.slideHeld=0;s.airTwist=true;s.moveYaw=s.yaw||0;}
    const twist=wrapAngle((s.yaw||0)-s.moveYaw);
    yawRate=st*AIR_YAW*Math.max(0,1-Math.max(0,Math.sign(st)*twist)/AIR_TWIST)-(st?0:twist*2);
  }else{
    s.airT=0;yawRate=kin*(1-mix)+fromLean*mix;
  }
  s.slipAngle=s.sliding?wrapAngle((s.yaw||0)-s.moveYaw):0;
  s.drift=s.sliding?s.slideDir:0;
  s.curvature=vAbs>.1?yawRate/v:Math.tan(s.steer)/wb;
  s.yaw=(s.yaw||0)+yawRate*dt;
  if(!s.sliding)s.moveYaw=s.yaw;
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
    const here=ter.height(s.x+c*back,(s.z||0)+n*back);let ax=0,az=0,ahead=-Infinity;
    // Sample the tyre's leading edge and both sides of it, so a diagonal approach meets the face too.
    for(const side of [0,-.22,.22])for(const f of [reach,reach-dir*.15]){const px=s.x+c*f-n*side,pz=(s.z||0)+n*f+c*side,h=ter.height(px,pz);if(h>ahead){ahead=h;ax=px;az=pz}}
    if(ahead-here>WALL_STEP){
      const e=.08,gx=ter.height(ax+e,az)-ter.height(ax-e,az),gz=ter.height(ax,az+e)-ter.height(ax,az-e),gl=Math.hypot(gx,gz)||1;
      const nx=-gx/gl,nz=-gz/gl,into=(c*nx+n*nz)*dir;
      if(into>-.6&&dir>0){
        // Glancing hit: slide along the face (turn to the tangent, lose a little speed) instead of stopping dead.
        let tx=c-into*nx,tz=n-into*nz;const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
        s.yaw=Math.atan2(tz,tx);s.vx*=1-.5*Math.abs(into);s.x+=nx*.05;s.z=(s.z||0)+nz*.05;
      }else{reject(nx,nz);s.x-=c*dir*.02;s.z=(s.z||0)-n*dir*.02;}
      s.wallHit=(s.wallHit||0)+1;
    }
  }
  // Round solid obstacles (trees, stumps, boulders): checked at the rear tyre, middle and front tyre so the
  // whole bike meets them, on the ground or in the air. A glancing hit turns the bike along the obstacle
  // and scrubs speed; riding straight into one fast is a crash.
  if(ter.posts?.length&&!s.crashed){
    const yaw=s.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw),cb=p.comBack??.42,front=p.wb*(1-cb)+(p.R||.3)*.8,rear=-(p.wb*cb+(p.R||.3)*.8);
    const my=s.sliding&&s.moveYaw!=null?s.moveYaw:yaw,mc=Math.cos(my),mn=Math.sin(my);
    for(const q of ter.posts){
      const dx0=s.x-q.x,dz0=(s.z||0)-q.z;if(dx0*dx0+dz0*dz0>(q.r+3)**2)continue;
      if(s.y-(p.comH||.95)>(q.h??9))continue; // jumped clean over it
      for(const f of [front,0,rear]){
        const px=s.x+c*f,pz=(s.z||0)+n*f,dx=px-q.x,dz=pz-q.z,d=Math.hypot(dx,dz),rr=q.r+.18;
        if(d>=rr)continue;
        const nx=d>1e-6?dx/d:-c,nz=d>1e-6?dz/d:-n,push=rr-d;
        s.x+=nx*push;s.z=(s.z||0)+nz*push;
        const v=s.vx||0,into=-(mc*nx+mn*nz)*Math.sign(v||1),vin=Math.abs(v)*into;
        if(vin>7&&into>.75){
          s.crashed=q.kind==='tree'?'HIT A TREE':q.kind==='boulder'?'HIT A ROCK':'HIT A STUMP';
          s.events.push({type:'crash',why:s.crashed,part:'bars'});s.wear&&(s.wear.bars=(s.wear.bars||0)+.45);
          s.vx*=.2;return s;
        }
        if(into>0){
          if(f!==0&&into<.9&&Math.abs(v)>1.5){
            // glance: turn toward the tangent, keep most of the speed
            let tx=mc+into*nx*Math.sign(v||1),tz=mn+into*nz*Math.sign(v||1);const tl=Math.hypot(tx,tz)||1;
            const ny=Math.atan2(tz/tl,tx/tl);s.yaw=v>=0?ny:ny+Math.PI;if(!s.sliding)s.moveYaw=s.yaw;s.vx=v*(1-.45*into);
          }else{s.vx=v*(1-into)*.5;}
        }
        s.postHit=(s.postHit||0)+1;
        break;
      }
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

