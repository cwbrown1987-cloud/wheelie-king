// Experimental independent 3D motorcycle dynamics (no Jolt motorcycle controller).
// One authoritative state: chassis translational velocities in X/Y/Z plus yaw,
// pitch and roll inertias. Tyres/suspension derive their contacts from the same
// world height function as the render mesh. Vehicle parameters come from garage.
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(v)?v:a));
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
const G=9.81;
const surfaceGrip=(ter,x,z)=>({dirt:.84,grass:.63,sand:.57,rock:.95,asphalt:1.08})[ter.surfaceAt?.(x,z)]??.87;
export function makeV3BikeState(p,ter,x=-600,z=0,yaw=0){
  const ground=ter.height(x,z),y=ground+(p.comH||.9)+.12;
  return {
    x,y,z,yaw,pitch:ter.slopeAt?.(x,z,yaw)||0,roll:0,w:0,wYaw:0,wRoll:0,
    wx:0,wz:0,vx:0,vy:0,vz:0,moveYaw:yaw,visRoll:0,steer:0,
    ground:[false,false],comp:[0,0],wheelSpin:[0,0],wheelOmega:[0,0],slip:[0,0],
    score:0,odo:0,air:0,airRot:0,wasAir:false,events:[],wear:{},battery:1,
    wheelieT:0,stoppieT:0,bestWheelie:0,crashed:null,stunt:null,stuntButtons:{}
  };
}
export function createV3Motorcycle({P,profile}={}){
  const mass=Math.max(20,Number(profile?.mass||P?.mass||100));
  const wb=Math.max(.7,P?.wb||profile?.wheelbase||1.25);
  const back=clamp(P?.comBack??.42,.2,.8),comH=P?.comH||.9,R=P?.R||.32;
  const travel=[Math.max(.04,P?.travelR||.04),Math.max(.04,P?.travelF||.04)];
  const offsets=[-wb*back,wb*(1-back)];
  const I={pitch:mass*(.16+wb*wb*.22),yaw:mass*(.16+wb*wb*.24),roll:mass*(.10+comH*comH*.48)};
  const handle={step,reset,stats:()=>({mass,wb,comH,R,travel:[...travel],inertia:{...I}})};
  function reset(s,ter,x=s.x,z=s.z||0,yaw=s.yaw||0){Object.assign(s,makeV3BikeState(P,ter,x,z,yaw));return s;}
  function step(s,p,inp,dt,ter){
    dt=clamp(dt,0,1/60);if(!dt||s.crashed)return s;
    if(!Number.isFinite(s.wx))s.wx=Math.cos(s.yaw||0)*(s.vx||0);
    if(!Number.isFinite(s.wz))s.wz=Math.sin(s.yaw||0)*(s.vx||0);
    const cy=Math.cos(s.yaw),sy=Math.sin(s.yaw),cp=Math.cos(s.pitch),sp=Math.sin(s.pitch);
    const speed=s.wx*cy+s.wz*sy,lateral=-s.wx*sy+s.wz*cy;
    const steerMax=(31-21*clamp(Math.abs(speed)/22,0,1))*Math.PI/180;
    const targetSteer=clamp(inp.steer||0,-1,1)*steerMax;
    const steerTau=inp.arcade?.steerTau??.10;
    s.steer+=(targetSteer-(s.steer||0))*(1-Math.exp(-dt/Math.max(.035,steerTau)));
    const fX=cy,fZ=sy,lX=-sy,lZ=cy;
    let fx=0,fy=-mass*G,fz=0,pitchTorque=0,contacts=0;
    const compression=[0,0],loaded=[0,0],grip=surfaceGrip(ter,s.x,s.z)*(P?.grip||1)*(1+(inp.arcade?.gripG??1.6)/1.6*.06-.06);
    for(let i=0;i<2;i++){
      const localX=offsets[i],wheelX=s.x+fX*localX*cp,wheelZ=s.z+fZ*localX*cp;
      const wheelY=s.y+(-comH+R)*cp+localX*sp;
      const groundY=ter.height(wheelX,wheelZ),depth=groundY+R+travel[i]*.18-wheelY;
      const compress=clamp(depth,0,travel[i]),rate=s.vy+(s.w||0)*localX*cp;
      const k=mass*G/(2*Math.max(.018,travel[i]*.27));
      const damper=2*.68*Math.sqrt(k*mass/2);
      const normal=clamp(k*compress-damper*rate,0,mass*G*7);
      compression[i]=compress/Math.max(.01,travel[i]);
      if(depth>-.012&&normal>1){loaded[i]=normal;contacts++;}
      const e=.4,dhx=(ter.height(wheelX+e,wheelZ)-ter.height(wheelX-e,wheelZ))/(2*e);
      const dhz=(ter.height(wheelX,wheelZ+e)-ter.height(wheelX,wheelZ-e))/(2*e);
      const mag=Math.hypot(dhx,1,dhz),nx=-dhx/mag,ny=1/mag,nz=-dhz/mag;
      fx+=normal*nx;fy+=normal*ny;fz+=normal*nz;
      pitchTorque+=localX*normal*ny;
    }
    s.comp=compression;s.ground=loaded.map(v=>v>1);
    const grounded=contacts>0,vabs=Math.abs(speed);
    const maxGrip=grip*mass*G*(contacts===2?1:.72);
    const powered=(P?.pedal||s.battery>0) && (s.ground[P?.driveAxle==='front'?1:0]);
    const rawDrive=powered?Math.min(
      (P?.torque||55)/Math.max(.15,R)*2.4,
      (P?.power||250)/Math.max(1.4,vabs),
      maxGrip*.92)*clamp(inp.throttle||0,0,1):0;
    const speedLimit=P?.vmax||18;
    const drive=rawDrive*clamp((speedLimit+1-vabs)/2,0,1);
    const brake=Math.sign(speed)*Math.min(maxGrip*.90,mass*G*1.1)*clamp(inp.brake||0,0,1);
    const resistance=.32*speed*vabs+mass*.18*Math.sign(speed||1)*(vabs>.08?1:0);
    const longForce=grounded?drive-brake-resistance:0;
    const sideForce=grounded?clamp(-lateral*mass*10,-maxGrip,maxGrip):0;
    fx+=longForce*fX+sideForce*lX;
    fz+=longForce*fZ+sideForce*lZ;
    // Steering inertia and lean work together, not as two competing yaw engines.
    const turnTarget=grounded?speed*Math.tan(s.steer)/wb:(inp.steer||0)*.95;
    const yawResponse=grounded?7:1.6;
    const yawAccel=clamp((turnTarget-(s.wYaw||0))*yawResponse,-15,15);
    s.wYaw=(s.wYaw||0)+yawAccel*dt;
    const leanWant=grounded?clamp(Math.atan(speed*(s.wYaw||0)/G),-1.05,1.05):0;
    // Inertia-based roll with an active rider controller. Without it, a real
    // two-wheeler falls over at walking speed and cannot be played on touch.
    const riderRoll=grounded?(leanWant-(s.roll||0))*17-(s.wRoll||0)*8:(inp.steer||0)*2.4-(s.wRoll||0)*.7;
    const destabilize=grounded?G*Math.sin(s.roll||0)/Math.max(.45,comH)*.1:0;
    s.wRoll=clamp((s.wRoll||0)+(riderRoll+destabilize)*dt,-5,5);
    s.roll=clamp((s.roll||0)+s.wRoll*dt,-Math.PI,Math.PI);
    const slope=ter.slopeAt?.(s.x,s.z||0,s.yaw)||0;
    const lean=clamp(inp.lean||0,-1,1);
    // Suspension pitch torque plus controllable rider-weight torque.
    const pitchHelp=grounded?(lean*mass*G*.24 - (s.w||0)*I.pitch*.45):
      lean*I.pitch*(7.8*(inp.arcade?.airPitchFactor??1));
    pitchTorque+=pitchHelp;
    if(grounded&&contacts===2) pitchTorque+=(wrap(slope-s.pitch)*15-(s.w||0)*7)*I.pitch*.65;
    if(!grounded&&Math.abs(lean)<.1){
      const predicted=inp.arcade?.landingTargetPitch;
      const target=predicted!=null?slope+clamp(wrap(predicted-slope),-.35,.35)*(inp.arcade?.landingStrength||0):Math.atan2(s.vy,Math.max(1,vabs))*.35;
      pitchTorque+=(wrap(target-s.pitch)*2.5-(s.w||0)*1.4)*I.pitch;
    }
    s.w=clamp((s.w||0)+clamp(pitchTorque/I.pitch,-90,90)*dt,-12,12);
    // Semi-implicit 3D integration.
    s.wx=clamp(s.wx+fx/mass*dt,-90,90);s.wz=clamp(s.wz+fz/mass*dt,-90,90);
    s.vy=clamp((s.vy||0)+fy/mass*dt,-70,70);
    s.x+=s.wx*dt;s.z=(s.z||0)+s.wz*dt;s.y+=s.vy*dt;
    s.yaw=wrap(s.yaw+s.wYaw*dt);s.pitch+=s.w*dt;
    const c=Math.cos(s.yaw),n=Math.sin(s.yaw);
    s.vx=s.wx*c+s.wz*n;s.vz=-s.wx*n+s.wz*c;
    s.moveYaw=Math.atan2(s.wz,s.wx);s.visRoll=s.roll;s.joltRoll=null;
    s.curvature=Math.abs(s.vx)>.2?s.wYaw/s.vx:0;s.sliding=grounded&&Math.abs(s.vz)>1.4;
    s.drift=s.sliding?Math.sign(s.vz):0;s.slipAngle=Math.atan2(s.vz,Math.max(.1,Math.abs(s.vx)));
    s.odo+=Math.hypot(s.wx,s.wz)*dt;
    for(let i=0;i<2;i++){
      s.wheelOmega[i]=s.vx/Math.max(.1,R);s.wheelSpin[i]+=s.wheelOmega[i]*dt;
      s.slip[i]=s.sliding?s.vz:0;
    }
    if(!grounded){s.air+=dt;s.airRot+=s.w*dt;}else if(s.air>.1){
      s.events?.push({type:'land',v:Math.abs(s.vy),air:s.air});s.air=0;s.airRot=0;
    }else s.air=0;
    s.wasAir=!grounded;
    if(s.ground[0]&&!s.ground[1]&&s.pitch>.12){s.wheelieT+=dt;s.score+=dt*70;}
    else if(s.ground[1]&&!s.ground[0]&&s.pitch<-.12){s.stoppieT+=dt;s.score+=dt*85;}
    else if(grounded){s.bestWheelie=Math.max(s.bestWheelie||0,s.wheelieT||0);s.wheelieT=0;s.stoppieT=0;}
    if(powered&&inp.throttle>0&&P?.power>0&&P?.batteryWh>0)s.battery=clamp(s.battery-P.power*inp.throttle*dt/(3600*P.batteryWh),0,1);
    if(grounded&&(Math.abs(s.roll)>1.2||Math.abs(s.pitch)>2.25)){
      s.crashed=Math.abs(s.roll)>1.2?'LOST BALANCE':'LOOPED OUT';
      s.events?.push({type:'crash',why:s.crashed,part:'frame'});
    }
    // Terrain bounds are solid; props and trees have their own collision handling.
    const b=ter.bounds;
    if(b){s.x=clamp(s.x,b.xmin+1,b.xmax-1);s.z=clamp(s.z,b.zmin+1,b.zmax-1);}
    return s;
  }
  return handle;
}
