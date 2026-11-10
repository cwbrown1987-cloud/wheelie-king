// A short, unique 3D sample city laid out along the race path. Not a repeating
// tile and not a painted mid-ground: discrete street, skate and dirt pieces,
// with the painted skyline kept only as the far backdrop in ride.js.
export function makeSampleWorld(T,scene,terrain,{lowDetail=false}={}){
 const root=new T.Group();root.name='wk:environment';root.userData.sample3d=true;scene.add(root);
 const sharedTex=[],sharedMat=[],sharedGeo=[],nearSide=[];
 const mat=(color,more={})=>{const m=new T.MeshStandardMaterial({color,roughness:.88,...more});sharedMat.push(m);return m};
 const canvasTex=(draw,w=512,h=256)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;sharedTex.push(t);return t};
 const paving=canvasTex((x,w,h)=>{x.fillStyle='#3a3b4c';x.fillRect(0,0,w,h);x.strokeStyle='#1a1c28';x.lineWidth=3;for(let y=0;y<h;y+=64){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke()}for(let a=0;a<w;a+=128){x.beginPath();x.moveTo(a,0);x.lineTo(a,h);x.stroke()}x.fillStyle='#d2c27a33';x.fillRect(0,h/2-3,w,6)},512,512);
 paving.wrapS=paving.wrapT=T.RepeatWrapping;
 const walk=canvasTex((x,w,h)=>{x.fillStyle='#8b8490';x.fillRect(0,0,w,h);x.strokeStyle='#5e5864';x.lineWidth=2;for(let a=0;a<w;a+=48){x.beginPath();x.moveTo(a,0);x.lineTo(a,h);x.stroke()}for(let y=0;y<h;y+=48){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke()}},256,256);
 walk.wrapS=walk.wrapT=T.RepeatWrapping;
 const facade=canvasTex((x,w,h)=>{x.fillStyle='#4a4e62';x.fillRect(0,0,w,h);for(let a=10;a<w;a+=18)for(let y=12;y<h;y+=24){x.fillStyle=(a+y)%36<18?'#e8c48a':'#6e88aa';x.globalAlpha=.45;x.fillRect(a,y,8,12)}x.globalAlpha=1},256,512);
 const asphalt=mat('#3c3c48',{map:paving,roughness:.7}),sidewalk=mat('#8a8490',{map:walk,roughness:.92}),kerb=mat('#c5c0c8',{roughness:.85});
 const dirt=mat('#7a5a3a',{roughness:.97}),sand=mat('#c4a06a',{roughness:.96}),concrete=mat('#8a8492',{roughness:.9});
 const wood=mat('#6b4a32',{roughness:.92}),metal=mat('#465564',{metalness:.7,roughness:.5}),dark=mat('#262e41',{metalness:.5,roughness:.6});
 const glass=mat('#8fb4d8',{metalness:.55,roughness:.22,emissive:'#3a5878',emissiveIntensity:.2});
 const carPaint=mat('#c44c4c',{metalness:.28,roughness:.42}),carDark=mat('#1a1a1e'),binMat=mat('#3e4650',{metalness:.35,roughness:.55});
 const cyan=mat('#6ee8ff',{emissive:'#20b9ff',emissiveIntensity:2}),violet=mat('#d59aff',{emissive:'#9850ff',emissiveIntensity:1.4}),warm=mat('#ffdf9d',{emissive:'#ffac4c',emissiveIntensity:2.2});
 const boxGeo=new T.BoxGeometry(1,1,1),cylY=new T.CylinderGeometry(1,1,1,12),cylX=new T.CylinderGeometry(1,1,1,10);cylX.rotateZ(Math.PI/2);
 sharedGeo.push(boxGeo,cylY,cylX);
 const add=(parent,geo,m,x,y,z,sx=1,sy=1,sz=1,rotY=0)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.y=rotY;o.castShadow=o.receiveShadow=true;parent.add(o);return o};
 const h=x=>terrain.h(x);
 const end=Math.max(220,(terrain.finish||200)+40),start=-16;

 // Street floor + kerbs + sidewalks following the track (one unique strip, not a tiled wall).
 const strip=(z0,z1,yOff,mat,name)=>{
  const v=[],uv=[],idx=[];let i=0;
  for(let x=start;x<=end;x+=.6,i++){const y=h(x)+yOff;v.push(x,y,z0,x,y,z1);uv.push(x/8,0,x/8,(z1-z0)/8);if(x<end){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();sharedGeo.push(g);
  const m=new T.Mesh(g,mat);m.name=name;m.receiveShadow=true;root.add(m);return m;
 };
 strip(-28,1.55,-.38,asphalt,'environment:street');
 strip(1.55,22,-.38,asphalt,'environment:street-near');
 strip(-4.2,-2.15,-.355,sidewalk,'environment:sidewalk');
 const kerbL=strip(-2.2,-1.55,-.34,kerb,'environment:kerb');
 const nearWalk=strip(2.15,4.1,-.355,sidewalk,'environment:sidewalk-near');nearSide.push(nearWalk);
 const kerbR=strip(1.55,2.2,-.34,kerb,'environment:kerb-near');nearSide.push(kerbR);

 const windowMat=mat('#d1c8e0',{map:facade,emissive:'#8e6875',emissiveMap:facade,emissiveIntensity:.18});
 const builds=new T.Group();builds.name='environment:buildings';root.add(builds);
 // Hand-placed, all different — no repeating block. z is behind the track for side view.
 const rows=[
  [4,-8.5,8,6.2,5.5,'#4a4e68'],[14,-9.2,6,9.5,6,'#5c4a62'],[22,-11,5,14,5.5,'#3e4a58'],
  [30,-8.8,7,7.4,6.2,'#55506a'],[40,-13,9,11,7,'#4a3e52'],
  // skate lot: lower sheds, more open so ramps read
  [52,-16,8,5.2,6,'#5a5a52'],[68,-17,6,6.5,5,'#4a5258'],[84,-15.5,7,4.8,6,'#3a3a42'],
  // dirt area: fences later, a couple of barns
  [104,-14,10,5.5,7,'#6a4a32'],[120,-16,7,6.2,6,'#4a3a28'],[136,-15,8,4.6,6.5,'#5a4030'],
  [152,-13,6,7.8,5.5,'#4a4e58'],
  // finish street, taller mix
  [168,-9.5,6,10,5.8,'#4e3e58'],[176,-11,8,13.5,6.5,'#3a4860'],[186,-9,5,8.4,5,'#5a4a48'],
  [196,-12,9,15,7,'#42465c'],[208,-10,7,9.2,6,'#4a3a4a'],[218,-11.5,6,11,5.5,'#3e4e4a']
 ];
 let bi=0;
 for(const [x,z,w,ht,d,col] of rows){
  const foot=h(x)-.38,m=mat(col,{map:facade,roughness:.86});sharedMat.pop();sharedMat.push(m);
  const b=add(builds,boxGeo,m,x,foot+ht/2,z,w,ht,d);b.name='environment:building:'+(bi++);
  add(builds,boxGeo,windowMat,x,foot+ht*.55,z+d/2+.03,w*.86,ht*.62,.06);
  if(ht>8){const n=ht>12?cyan:violet;add(builds,boxGeo,n,x,foot+ht+.04,z,w*.7,.05,.2);}
 }

 // Street furniture, unique spacing
 const lamps=[[6,-3.3],[19,-3.4],[33,-3.25],[90,-3.5],[148,-3.3],[174,-3.35],[198,-3.4]];
 const lampPole=new T.CylinderGeometry(.04,.055,3.6,6),lampHead=new T.BoxGeometry(.32,.1,.22);sharedGeo.push(lampPole,lampHead);
 for(const [x,z] of lamps){const y=h(x)-.38;add(root,lampPole,dark,x,y+1.8,z,1,1,1);add(root,lampHead,warm,x,y+3.62,z);}
 const nearLamps=[[12,3.3],[28,3.25],[160,3.35],[190,3.3]];
 for(const [x,z] of nearLamps){const y=h(x)-.38,p=add(root,lampPole,dark,x,y+1.8,z,1,1,1),hd=add(root,lampHead,warm,x,y+3.62,z);nearSide.push(p,hd);}
 const benchGeo=(()=>{const g=new T.BoxGeometry(1.15,.06,.32);g.translate(0,.28,0);return g})();sharedGeo.push(benchGeo);
 for(const [x,z] of [[10,-3.5],[176,-3.55]]){const y=h(x)-.38;add(root,benchGeo,wood,x,y,z);add(root,boxGeo,wood,x-.48,y+.14,z,.06,.28,.28);add(root,boxGeo,wood,x+.48,y+.14,z,.06,.28,.28);}
 const binGeo=new T.CylinderGeometry(.16,.18,.42,10);sharedGeo.push(binGeo);
 for(const [x,z] of [[16,-3.2],[172,-3.25]])add(root,binGeo,binMat,x,h(x)-.16,z);
 // parked cars (simple body + cabin + wheels)
 const carBody=new T.BoxGeometry(2.05,.48,.95),carCabin=new T.BoxGeometry(1.0,.34,.86),wheel=new T.CylinderGeometry(.2,.2,.16,10);wheel.rotateZ(Math.PI/2);sharedGeo.push(carBody,carCabin,wheel);
 function car(x,z,yaw,col){
  const y=h(x)-.12,g=new T.Group();g.position.set(x,y,z);g.rotation.y=yaw;g.name='environment:car';
  add(g,carBody,col||carPaint,0,.14,0);add(g,carCabin,glass,-.08,.62,0);
  for(const [wx,wz] of [[-.65,.42],[-.65,-.42],[.7,.42],[.7,-.42]])add(g,wheel,carDark,wx,.08,wz);
  root.add(g);return g;
 }
 car(11,-5.4,0.05);car(26,-5.6,-0.08,mat('#3d6cb0',{metalness:.28,roughness:.42}));car(182,-5.5,0.1,mat('#d2a84a',{metalness:.28,roughness:.42}));

 // Skate park (behind the lane, unique pieces)
 const skate=new T.Group();skate.name='environment:skate';root.add(skate);
 const qpShape=new T.Shape();qpShape.moveTo(0,0);qpShape.lineTo(.2,0);qpShape.absarc(.2,1.7,1.7,-Math.PI/2,0,true);qpShape.lineTo(0,1.9);qpShape.closePath();
 const qpGeo=new T.ExtrudeGeometry(qpShape,{depth:3.4,bevelEnabled:false,steps:1,curveSegments:10});qpGeo.translate(0,0,-1.7);qpGeo.computeVertexNormals();sharedGeo.push(qpGeo);
 const qp=add(skate,qpGeo,concrete,50,h(50)-.38,-8.2,1,1,1,Math.PI/2);qp.name='environment:quarter-pipe';
 const qp2=add(skate,qpGeo,concrete,86,h(86)-.38,-8.6,1,1,1,-Math.PI/2);qp2.name='environment:quarter-pipe-2';
 const bowlPts=[new T.Vector2(2.2,0),new T.Vector2(2.2,.08),new T.Vector2(2.0,.1)];for(let i=0;i<=8;i++){const a=i/8*Math.PI/2;bowlPts.push(new T.Vector2(2.0*Math.cos(a),.1+1.5*Math.sin(a)))}
 const bowlGeo=new T.LatheGeometry(bowlPts,16);bowlGeo.computeVertexNormals();sharedGeo.push(bowlGeo);
 const bowl=add(skate,bowlGeo,concrete,68,h(68)-.38,-11.2);bowl.name='environment:bowl';
 const rail=new T.CylinderGeometry(.045,.045,2.6,8);rail.rotateZ(Math.PI/2);sharedGeo.push(rail);
 add(skate,rail,metal,62,h(62)+.18,-6.4);add(skate,boxGeo,concrete,60.8,h(60.8)+.04,-6.4,.2,.2,.2);add(skate,boxGeo,concrete,63.2,h(63.2)+.04,-6.4,.2,.2,.2);
 add(skate,boxGeo,concrete,74,h(74)+.35,-7.2,2.4,.7,1.4); // bank

 // BMX dirt (visual mounds beside the physical jumps)
 const dirtG=new T.Group();dirtG.name='environment:dirt';root.add(dirtG);
 const mound=new T.SphereGeometry(1.15,10,7);mound.scale(1.6,1.05,1.25);sharedGeo.push(mound);
 const jumps=[[108,-6.8,1.1,1.0,1.0],[116,-7.2,1.3,0.7,1.1],[126,-6.5,1.0,.85,1.0],[154,-6.6,1.25,1.15,1.05],[162,-7.0,1.4,0.8,1.15]];
 for(const [x,z,sx,sy,sz] of jumps){const o=add(dirtG,mound,dirt,x,h(x)-.38+sy*.55,z,sx,sy,sz);o.name='environment:dirt-jump';}
 add(dirtG,boxGeo,wood,100,h(100)+.45,-7.8,3.2,.2,1.6);add(dirtG,boxGeo,wood,100,h(100)+.2,-8.5,.15,.5,1.6);add(dirtG,boxGeo,wood,100,h(100)+.2,-7.1,.15,.5,1.6);
 // rough fence line along the dirt lot
 const post=new T.BoxGeometry(.08,1.1,.08),rail2=new T.BoxGeometry(3.2,.06,.05);sharedGeo.push(post,rail2);
 for(let x=98;x<=164;x+=3.4){const z=-9.6,y=h(x)-.38;add(dirtG,post,wood,x,y+.55,z);add(dirtG,rail2,wood,x+1.6,y+.7,z);}

 // Neon edge rails on the ride surface (same idea as the current track, but only this short course)
 for(const [z,m] of [[-1.19,violet],[1.19,cyan]]){
  const p=[];for(let x=start;x<=end;x+=.4)p.push(new T.Vector3(x,h(x)+.025,z));
  const geo=new T.TubeGeometry(new T.CatmullRomCurve3(p),Math.ceil((end-start)*2),.014,6,false);sharedGeo.push(geo);
  add(root,geo,m,0,0,0);
 }

 // Near-side extras only in chase (hidden in side view so they don't sit in front of the bike).
 for(const o of nearSide)o.visible=false;

 function view(blend){
  const show=blend>.05;
  for(const o of nearSide){o.visible=show;if(o.material&&o.material.transparent!=null&&'opacity' in o.material){/* opaque kerbs just hide */}}
 }
 const state=()=>({
  sample3d:true,near:true,middle:true,far:true,midground:false,
  buildings:builds.children.filter(o=>String(o.name).startsWith('environment:building:')).length,
  worldStart:start,worldEnd:end,finish:terrain.finish
 });
 return {
  roadMap:paving,
  update(){},
  view,
  state,
  dispose(){root.removeFromParent();root.traverse(o=>{if(o.isInstancedMesh)o.dispose()});sharedGeo.forEach(g=>g.dispose());sharedMat.forEach(m=>m.dispose());sharedTex.forEach(t=>t.dispose());}
 };
}
