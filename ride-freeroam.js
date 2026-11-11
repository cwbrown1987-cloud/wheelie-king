// SAMPLE 3D free-roam: heading + (x,z) around the existing pitch/wheelie step.
// Other tracks do not use this module.

const ROAD=2.55, ROAD_FADE=.9;
const BOUNDS={xmin:-20,xmax:232,zmin:-32,zmax:28};
// Building footprints copied from ride-sample3d.js (x,z,w,d).
const BUILDINGS=[
  [4,-8.5,8,5.5],[14,-9.2,6,6],[22,-11,5,5.5],[30,-8.8,7,6.2],[40,-13,9,7],
  [52,-16,8,6],[68,-17,6,5],[84,-15.5,7,6],[104,-14,10,7],[120,-16,7,6],
  [136,-15,8,6.5],[152,-13,6,5.5],[168,-9.5,6,5.8],[176,-11,8,6.5],[186,-9,5,5],
  [196,-12,9,7],[208,-10,7,6],[218,-11.5,6,5.5]
];
// Dirt mounds (visual spheres) as rideable bumps: x,z,rx,rz,peak.
const MOUNDS=[
  [108,-6.8,2.0,1.45,1.15],[116,-7.2,2.35,1.6,.85],[126,-6.5,1.85,1.45,.95],
  [154,-6.6,2.25,1.5,1.25],[162,-7.0,2.55,1.65,.95]
];
// Quarter-pipes, bowl and bank stay solid obstacles for this prototype.
const OBSTACLES=[
  [50,-8.2,1.8,1.8],[86,-8.6,1.8,1.8],[68,-11.2,2.3,2.3],[74,-7.2,1.3,.8],
  [11,-5.4,1.1,.55],[26,-5.6,1.1,.55],[182,-5.5,1.1,.55]
];

function bump(x,z,mx,mz,rx,rz,peak){
  const dx=(x-mx)/rx, dz=(z-mz)/rz, r2=dx*dx+dz*dz;
  if(r2>=1)return 0;
  const t=1-r2;return peak*t*t;
}

export function attachFreeRoam(ter){
  const profileH=ter.h, profileSlope=ter.slope;
  const boxes=[
    ...BUILDINGS.map(([x,z,w,d])=>({x,z,hx:w/2+.08,hz:d/2+.08})),
    ...OBSTACLES.map(([x,z,hx,hz])=>({x,z,hx,hz}))
  ];
  function height(x,z){
    const az=Math.abs(z);
    let y=0;
    if(az<ROAD+ROAD_FADE){
      const k=az<=ROAD?1:Math.max(0,1-(az-ROAD)/ROAD_FADE);
      y=profileH(x)*k;
    }
    for(const [mx,mz,rx,rz,peak] of MOUNDS)y=Math.max(y,bump(x,z,mx,mz,rx,rz,peak));
    return y;
  }
  function slopeAt(x,z,yaw){
    const d=.3,c=Math.cos(yaw||0),n=Math.sin(yaw||0);
    return Math.atan2(height(x+c*d,z+n*d)-height(x-c*d,z-n*d),2*d);
  }
  ter.freeRoam=true;
  ter.height=height;
  ter.slopeAt=slopeAt;
  ter.h=x=>height(x,0);
  ter.slope=x=>slopeAt(x,0,0);
  ter.boxes=boxes;
  ter.bounds=BOUNDS;
  ter.gates={checkpoints:ter.checkpoints||[],finish:ter.finish,halfWidth:6.5};
  ter._profileH=profileH;
  ter._profileSlope=profileSlope;
  return ter;
}

export function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a))}

// Speed-scaled heading. No turn at a standstill; light air control.
// Turn rate builds from a creep (so you can turn around when rolling) up to a mid-speed peak.
export function stepHeading(s,inp,dt){
  const onG=!!(s.ground[0]||s.ground[1]);
  const speed=s.vx||0, abs=Math.abs(speed);
  // Existing burnout already holds you in place and spins the driven wheel.
  // While it is lit, steer pivots the bike on the spot (no forward speed needed).
  if(s.burnout&&onG){s.yaw=(s.yaw||0)+(inp.steer||0)*1.65*dt;return s}
  if(abs<.32)return s;
  const groundScale=Math.max(0,Math.min(1,(abs-.32)/3.1));
  const airScale=onG?1:.2;
  const rate=1.85*groundScale*airScale;
  s.yaw=(s.yaw||0)+(inp.steer||0)*Math.sign(speed)*rate*dt;
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

export function crossedGate(prevX,prevZ,x,z,gateX,halfWidth){
  if(Math.abs(z)>halfWidth&&Math.abs(prevZ)>halfWidth)return false;
  return (prevX-gateX)*(x-gateX)<=0&&(prevX!==x||Math.abs(x-gateX)<.4);
}
