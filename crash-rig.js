import {constrainedBody,riderConstraints} from './crash-physics.js';
function constrainPoint(p,terrain,colliders){
 let hit=false;
 const b=terrain?.bounds;
 if(b){
  const pad=p.radius||.05,x=Math.min(b.xmax-pad,Math.max(b.xmin+pad,p.position[0])),z=Math.min(b.zmax-pad,Math.max(b.zmin+pad,p.position[2]));
  if(x!==p.position[0]||z!==p.position[2]){p.position[0]=x;p.position[2]=z;hit=true;}
 }
 for(const c of colliders||[]){
  const y0=c.y0??0,y1=c.y1??2,py=p.position[1],r=p.radius||.05;
  if(py>y1+r||py<y0-r)continue;
  if(c.kind==='cyl'){
   const dx=p.position[0]-c.x,dz=p.position[2]-c.z,d=Math.hypot(dx,dz),min=(c.r||.15)+r;
   if(d<min){
    if(d>1e-6){p.position[0]=c.x+dx*min/d;p.position[2]=c.z+dz*min/d;}
    else{p.position[0]+=min;}
    hit=true;
   }
  }else if(c.kind==='box'){
   const hx=c.hx+r,hz=c.hz+r,dx=p.position[0]-c.x,dz=p.position[2]-c.z;
   if(Math.abs(dx)<hx&&Math.abs(dz)<hz){
    const ax=hx-Math.abs(dx),az=hz-Math.abs(dz);
    if(ax<az)p.position[0]=c.x+Math.sign(dx||1)*hx;else p.position[2]=c.z+Math.sign(dz||1)*hz;
    hit=true;
   }
  }
 }
 return hit;
}
export function makeCrashRig(T,scene,body,pivot,bike,A,rider,P,terrain,s,colliders=[]){
 const free=!!terrain.freeRoam;
 const ground=(x,z)=>free&&typeof terrain.height==='function'?terrain.height(x,z||0):terrain.h(x)-(Math.abs(z)>1.2?.38:0);
 const yaw=s.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw);
 const origin=[s.x,s.y,free?(s.z||0):0],velocity=[(s.vx||0)*c,s.vy||0,free?(s.vx||0)*n:0],angular=Math.max(-7,Math.min(7,s.w));
 const constrain=p=>constrainPoint(p,terrain,colliders);
 body.updateWorldMatrix(true,true);const joints=rider.joints(),human=constrainedBody(joints,riderConstraints(joints),{velocity,angular,origin,ground,eject:true,constrain});
 const local=p=>new T.Vector3(...p,0).add(bike.position),rest={rear:local(A.rearAxle),front:local(A.frontAxle),head:local(A.headTop),seat:local(A.seatTop),bb:local(A.bb)},j={};
 for(const [key,p]of Object.entries(rest))j[key]={position:body.localToWorld(p.clone()).toArray(),radius:['rear','front'].includes(key)?P.R:key==='bb'?.08:.05,mass:['rear','front'].includes(key)?5:3};
 const links=[],keys=Object.keys(j);for(let a=0;a<keys.length;a++)for(let b=a+1;b<keys.length;b++)links.push([keys[a],keys[b],['rear','front'].includes(keys[a])&&['rear','front'].includes(keys[b])?0:.025]);
 const wreck=constrainedBody(j,links,{velocity,angular,origin,ground,constrain});
 const basis=(rear,front,head)=>{const x=front.clone().sub(rear).normalize(),y=head.clone().sub(rear),z=new T.Vector3().crossVectors(x,y).normalize();y.crossVectors(z,x).normalize();return new T.Matrix4().makeBasis(x,y,z)};
 const inverseRest=basis(rest.rear,rest.front,rest.head).invert();scene.add(body);
 function pose(){const hp=human.state().positions;rider.ragdoll(scene,hp);const p=wreck.state().positions,v=k=>new T.Vector3(...p[k]),q=new T.Quaternion().setFromRotationMatrix(basis(v('rear'),v('front'),v('head')).multiply(inverseRest));body.quaternion.copy(q);body.position.copy(v('rear').sub(rest.rear.clone().applyQuaternion(q)));body.scale.setScalar(1)}
 pose();
 return {step(dt){human.step(dt);wreck.step(dt);if(dt>0)for(let i=0;i<6;i++){human.collide(wreck);human.relax();wreck.relax()}pose()},focus(){const a=human.center(),b=wreck.center();const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,z=(a[2]+b[2])/2;const g=ground(x,z);const wp=wreck.state().positions,rear=wp.rear,front=wp.front;const hy=Math.atan2((front[2]-rear[2]),(front[0]-rear[0]));return {x,y:Math.max(g+.65,y),z,yaw:hy,separation:Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),speed:Math.sqrt(human.state().energy/Object.keys(joints).length)}},state(){return {separated:rider.root.parent===scene&&body.parent===scene,rider:human.state(),bike:wreck.state()}},restore(){pivot.add(body);body.position.set(0,0,0);body.quaternion.identity();body.scale.setScalar(1);rider.attach()}};
}
