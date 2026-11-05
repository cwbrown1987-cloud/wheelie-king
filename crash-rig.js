import {constrainedBody,riderConstraints} from './crash-physics.js';
export function makeCrashRig(T,scene,body,pivot,bike,A,rider,P,terrain,s){
 const ground=(x,z)=>terrain.h(x)-(Math.abs(z)>1.2?.38:0),origin=[s.x,s.y,0],velocity=[s.vx,s.vy,0],angular=Math.max(-7,Math.min(7,s.w));
 body.updateWorldMatrix(true,true);const joints=rider.joints(),human=constrainedBody(joints,riderConstraints(joints),{velocity,angular,origin,ground,eject:true});
 const local=p=>new T.Vector3(...p,0).add(bike.position),rest={rear:local(A.rearAxle),front:local(A.frontAxle),head:local(A.headTop),seat:local(A.seatTop),bb:local(A.bb)},j={};
 for(const [key,p]of Object.entries(rest))j[key]={position:body.localToWorld(p.clone()).toArray(),radius:['rear','front'].includes(key)?P.R:key==='bb'?.08:.05,mass:['rear','front'].includes(key)?5:3};
 const links=[],keys=Object.keys(j);for(let a=0;a<keys.length;a++)for(let b=a+1;b<keys.length;b++)links.push([keys[a],keys[b],['rear','front'].includes(keys[a])&&['rear','front'].includes(keys[b])?0:.025]);
 const wreck=constrainedBody(j,links,{velocity,angular,origin,ground});
 const basis=(rear,front,head)=>{const x=front.clone().sub(rear).normalize(),y=head.clone().sub(rear),z=new T.Vector3().crossVectors(x,y).normalize();y.crossVectors(z,x).normalize();return new T.Matrix4().makeBasis(x,y,z)};
 const inverseRest=basis(rest.rear,rest.front,rest.head).invert();scene.add(body);
 function pose(){const hp=human.state().positions;rider.ragdoll(scene,hp);const p=wreck.state().positions,v=k=>new T.Vector3(...p[k]),q=new T.Quaternion().setFromRotationMatrix(basis(v('rear'),v('front'),v('head')).multiply(inverseRest));body.quaternion.copy(q);body.position.copy(v('rear').sub(rest.rear.clone().applyQuaternion(q)));body.scale.setScalar(1)}
 pose();
 return {step(dt){human.step(dt);wreck.step(dt);if(dt>0)for(let i=0;i<6;i++){human.collide(wreck);human.relax();wreck.relax()}pose()},focus(){const a=human.center(),b=wreck.center();return {x:(a[0]+b[0])/2,y:Math.max(terrain.h(a[0])+.65,(a[1]+b[1])/2),separation:Math.hypot(a[0]-b[0],a[1]-b[1]),speed:Math.sqrt(human.state().energy/Object.keys(joints).length)}},state(){return {separated:rider.root.parent===scene&&body.parent===scene,rider:human.state(),bike:wreck.state()}},restore(){pivot.add(body);body.position.set(0,0,0);body.quaternion.identity();body.scale.setScalar(1);rider.attach()}};
}
