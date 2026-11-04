// Photo-derived single-pivot TRAX rear assembly. Coordinates are metres.
import * as PM from './partmodels.js';
const material=(T,name,color,metalness=.55)=>Object.assign(new T.MeshStandardMaterial({color,metalness,roughness:.35}),{name});
export function rearFrameModel(T,A,color='#d2ed21') {
 const G=new T.Group();G.name='wk:model:rearFrame';
 const P=A.swingPivot, R=A.rearAxle, E=A.shockArm, width=.074;
 G.position.set(P[0],P[1],0);G.userData.pivot=[...P,0];G.userData.shockEye=[...E,0];
 G.userData.jockeys=true;
 const add=(name,geo,p,c=color)=>{const o=new T.Mesh(geo,material(T,name,c));o.name=name;if(p)o.position.set(p[0]-P[0],p[1]-P[1],p[2]||0);o.castShadow=o.receiveShadow=true;G.add(o);return o};
 const tube=(name,pts,r=.014)=>{
  const path=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0]-P[0],p[1]-P[1],p[2]||0)));
  return add(name,new T.TubeGeometry(path,40,r,16),null);
 };
 const pin=(name,p,r,length,c)=>{const o=add(name,new T.CylinderGeometry(r,r,length,24),p,c);o.rotation.x=Math.PI/2;return o};
 for(const s of [-1,1]) {
  const z=s*width;
  // Paired stays pass either side of the stationary seat tube and rear tyre.
  tube('rearFrame:chainstay'+s,[[R[0],R[1],z],[R[0]+.07,R[1]+.012,z],[P[0]-.05,P[1]-.018,z],[P[0],P[1],z]],.0145);
  tube('rearFrame:seatstay'+s,[[R[0],R[1],z],[R[0]+.045,R[1]+.085,z],[E[0]-.07,E[1]-.035,z],[E[0]+.015,E[1]-.026,z]],.0125);
  tube('rearFrame:frontUpright'+s,[[P[0],P[1],z],[P[0]-.002,P[1]+.035,z],[E[0]+.03,E[1]-.03,z],[E[0]+.015,E[1]-.026,z]],.016);
  // Clevis plates surround the shock eye; their through-bore is on its bolt axis.
  const sh=new T.Shape();sh.moveTo(E[0]-.02,E[1]-.033);sh.lineTo(E[0]+.035,E[1]-.037);sh.lineTo(E[0]+.025,E[1]+.013);sh.lineTo(E[0]-.014,E[1]+.013);sh.closePath();
  const hole=new T.Path();hole.absarc(E[0],E[1],.0045,0,Math.PI*2,true);sh.holes.push(hole);
  const geo=new T.ExtrudeGeometry(sh,{depth:.006,bevelEnabled:true,bevelSize:.001,bevelThickness:.001,bevelSegments:2});geo.translate(-P[0],-P[1],-.003);
  const plate=add('rearFrame:shockClevis'+s,geo,null);plate.position.z=s*.018;
  const drop=new T.Shape();drop.moveTo(-.025,-.018);drop.lineTo(.025,-.018);drop.lineTo(.03,.024);drop.lineTo(-.02,.024);drop.closePath();
  const axleHole=new T.Path();axleHole.absarc(0,0,.005,0,Math.PI*2,true);drop.holes.push(axleHole);
  add('rearFrame:dropout'+s,new T.ExtrudeGeometry(drop,{depth:.006,bevelEnabled:false}),[R[0],R[1],z-.003]);
  pin('rearFrame:pivotBearing'+s,[P[0],P[1],s*.058],.02,.009,'#3b4146');
  pin('rearFrame:pivotWasher'+s,[P[0],P[1],s*.067],.012,.004,'#c6cccf');
 }
 pin('rearFrame:shockPin',[...E,0],.0045,.056,'#c4c9cc');
 const braceX=E[0]+.018,braceY=E[1]-.035;
 pin('rearFrame:crossBrace',[braceX,braceY,0],.012,width*2,color);
 PM.useThree(T);
 const jockeys=[[R[0]-.018,R[1]-.05],[R[0]+.028,R[1]-.12]];
 jockeys.forEach((p,i)=>{const cog=PM.sprocket(8,'bicycle','#222629','derailleur:jockey'+i);cog.position.set(p[0]-P[0],p[1]-P[1],.055);G.add(cog);});
 tube('derailleur:cage',[[R[0],R[1],.065],[...jockeys[0],.065],[...jockeys[1],.065]],.0055).material.color.set('#23272b');
 // Mark exact mechanical anchors independently of visible cosmetic geometry.
 for(const [name,p] of [['rearFrame:pivot',P],['rearFrame:axle',R],['rearFrame:shockEye',E]]){const anchor=new T.Object3D();anchor.name=name;anchor.position.set(p[0]-P[0],p[1]-P[1],0);G.add(anchor);}
 return G;
}

export function traxShockModel(T,frameEye,armEye,color='#d2ed21') {
 const G=new T.Group();G.name='wk:model:shock';
 const add=(name,geo,c,p)=>{const o=new T.Mesh(geo,material(T,name,c));o.name=name;if(p)o.position.set(...p);o.castShadow=true;G.add(o);return o};
 const cyl=(name,r,len,c,y)=>add(name,new T.CylinderGeometry(r,r,len,24),c,[0,y,0]);
 const eye=(name)=>{const geo=new T.CylinderGeometry(.0105,.0105,.026,24);geo.rotateX(Math.PI/2);return add(name,geo,'#8c9398',[0,0,0]);};
 eye('shock:eyeletTop');eye('shock:eyeletBottom');
 cyl('shock:body',.0125,.043,'#929ba0',.028);
 for(let i=0;i<4;i++)cyl('shock:adjuster'+i,.016,.003,'#c6ced2',.024+i*.005);
 cyl('shock:shaft',.0055,1,'#d7dfe3',0);
 const geo=new T.BufferGeometry(),indices=[];
 geo.setAttribute('position',new T.BufferAttribute(new Float32Array(181*9*3),3));geo.setAttribute('normal',new T.BufferAttribute(new Float32Array(181*9*3),3));
 for(let i=0;i<180;i++)for(let j=0;j<8;j++){const a=i*9+j,b=a+9;indices.push(a,a+1,b,b,a+1,b+1);}geo.setIndex(indices);
 add('shock:spring',geo,color,[0,.046,0]);
 setTraxShockPose(T,G,frameEye,armEye);return G;
}
export function setTraxShockPose(T,G,frameEye,armEye) {
 const a=new T.Vector3(...frameEye,0),b=new T.Vector3(...armEye,0),d=b.sub(a),L=d.length();
 G.position.copy(a);G.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());
 G.getObjectByName('shock:eyeletBottom').position.y=L;
 const shaft=G.getObjectByName('shock:shaft');shaft.position.y=(L+.04)/2;shaft.scale.y=Math.max(.001,L-.04);
 const spring=G.getObjectByName('shock:spring'),length=Math.max(.001,L-.07),positions=spring.geometry.attributes.position,normals=spring.geometry.attributes.normal;
 // Change coil pitch without squashing the circular wire cross section.
 const r=.0205,omega=Math.PI*2*8.5,hyp=Math.hypot(r*omega,length),wire=.0032;
 for(let i=0;i<=180;i++){const t=i/180,a=omega*t,ca=Math.cos(a),sa=Math.sin(a);
  for(let j=0;j<=8;j++){const q=j/8*Math.PI*2,c=Math.cos(q),s=Math.sin(q),nx=ca*c+length*sa/hyp*s,ny=r*omega/hyp*s,nz=sa*c-length*ca/hyp*s,k=i*9+j;
   positions.setXYZ(k,r*ca+wire*nx,length*t+wire*ny,r*sa+wire*nz);normals.setXYZ(k,nx,ny,nz);}
 }positions.needsUpdate=normals.needsUpdate=true;spring.geometry.computeBoundingSphere();
 G.userData.eyeDistance=L;
}
