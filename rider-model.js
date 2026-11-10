import {RIDER_SPEC} from './rider-spec.js';
import {outfit} from './gear-state.js';
import {gearModel} from './gear-models.js';
// Reusable articulated rider. Named pieces work from side and future chase cameras.
export function makeRider(T,body,bike,A,mechanical){
 const rider=new T.Group();rider.name='wk:rider';body.add(rider);
 const material=(color,roughness=.85)=>new T.MeshStandardMaterial({color,roughness});
 const blue=material('#1676d8'),cuff=material('#095295'),pants=material('#252a31'),black=material('#131b20'),sole=material('#d6dedb'),skin=material('#c9916c'),lime=material('#71df21',.3),gloveMat=material('#d52d37',.55),shoeMat=material('#171c25');
 const mesh=(name,geometry,mat,parent=rider)=>{const m=new T.Mesh(geometry,mat);m.name='rider:'+name;m.castShadow=true;parent.add(m);return m};
 const off=p=>new T.Vector3(p[0]+bike.position.x,p[1]+bike.position.y,0);
 const hip=off(A.riderHip||[A.seatTop[0],A.seatTop[1]+.085]),hand=off(A.hand||[A.headTop[0]-.04,A.headTop[1]+.2]),foot=off(A.feet||A.bb),shoulder=new T.Vector3(...(A.shoulder||[.20,.43,0]));
 const ridingPose=A.vehicleClass?A.vehicleClass!=='escooter':!A.riderHip;
 if(ridingPose){hip.x-=.02}
 const torso=new T.Group();torso.name='rider:torso';torso.position.copy(hip);rider.add(torso);
 // Shaped shoulders, waist and hem instead of a single capsule body.
 const vertices=[],indices=[],rings=[[0,.085,.095],[.06,.095,.11],[.22,.105,.135],[.37,.09,.155],[.43,.075,.145],[.46,.06,.105]],segments=24;
 for(const [y,depth,width]of rings)for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;vertices.push(y/shoulder.y*shoulder.x+Math.cos(a)*depth,y,Math.sin(a)*width)}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c)}
 for(let i=1;i<segments-1;i++){indices.push(0,i+1,i);const n=(rings.length-1)*segments;indices.push(n,n+i,n+i+1)}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();mesh('hoodie',geo,blue,torso);
 const box=(name,size,mat,position,parent=torso)=>{const m=mesh(name,new T.BoxGeometry(...size),mat,parent);m.position.set(...position);return m};
 box('hoodie-hem',[.15,.035,.21],cuff,[.025,.018,0]);
 for(const side of [-1,1]){const seam=box('pocket-seam'+side,[.008,.08,.006],cuff,[shoulder.x*.4+.075,.17,side*.07]);seam.rotation.z=-.7;const cord=box('hood-cord'+side,[.006,.095,.006],sole,[shoulder.x*.8+.075,.34,side*.035]);cord.rotation.z=.3}
 const hood=mesh('hood',new T.SphereGeometry(.105,16,10),cuff,torso);hood.scale.set(.75,.65,1.05);hood.position.copy(shoulder).add(new T.Vector3(-.025,.035,0));
 const neck=mesh('neck',new T.CylinderGeometry(.042,.045,.08,12),skin,torso);neck.position.copy(shoulder).add(new T.Vector3(.03,.065,0));
 const collar=mesh('jersey-collar',new T.TorusGeometry(.05,.011,8,20),cuff,torso);collar.position.copy(shoulder).add(new T.Vector3(.03,.09,0));collar.rotation.set(Math.PI/2,0,.18);collar.visible=false;
 const headCenter=shoulder.clone().add(new T.Vector3(.04,.17,0)),head=mesh('face',new T.SphereGeometry(RIDER_SPEC.headRadius,24,20),skin,torso);head.scale.set(.88,1,.86);head.position.copy(headCenter);
 const headGroup=new T.Group();headGroup.name='rider:head';headGroup.userData.wearable='helmet';torso.add(headGroup);torso.remove(head);headGroup.add(head);
 const nose=mesh('nose',new T.SphereGeometry(.023,12,8),skin,headGroup);nose.position.copy(headCenter).add(new T.Vector3(.083,-.015,0));nose.scale.set(1,.8,.65);
 for(const side of [-1,1]){const eye=mesh('eye'+side,new T.SphereGeometry(.010,16,12),black,headGroup);eye.position.copy(headCenter).add(new T.Vector3(.086,.025,side*.039));const ear=mesh('ear'+side,new T.SphereGeometry(.020,16,12),skin,headGroup);ear.position.copy(headCenter).add(new T.Vector3(-.005,-.006,side*.087));ear.scale.set(.65,1,.45);}
 let wornHelmet,wornPack;

 function segment(name,r1,r2,mat,parent=rider){const points=[[-.5,.86],[-.46,.98],[-.25,1.04],[0,1],[.22,1.03],[.42,.97],[.5,.86]].map(([y,k])=>new T.Vector2((r2+(r1-r2)*(y+.5))*k,y));return mesh(name,new T.LatheGeometry(points,24),mat,parent)}
 const _pd=new T.Vector3(),_pu=new T.Vector3(0,1,0);function pose(m,a,b){const d=_pd.copy(b).sub(a);m.position.copy(a).addScaledVector(d,.5);m.scale.y=d.length();m.quaternion.setFromUnitVectors(_pu,d.normalize())}
 const arms=[],legs=[];
 for(const side of [-1,1]){
  const upper=segment('sleeve-upper'+side,.061,.05,blue,torso),lower=segment('sleeve-lower'+side,.049,.034,blue,torso),elbow=mesh('elbow'+side,new T.SphereGeometry(.049,10,8),blue,torso),glove=new T.Group();glove.name='rider:glove'+side;glove.userData.wearable='gloves';torso.add(glove);arms.push({side,upper,lower,elbow,glove});
  const thigh=segment('trousers-thigh'+side,.065,.051,pants),shin=segment('trousers-shin'+side,.05,.033,pants),knee=mesh('knee'+side,new T.SphereGeometry(.052,10,8),pants),shoe=new T.Group();shoe.name='rider:shoe'+side;rider.add(shoe);
  legs.push({side,thigh,shin,knee,shoe});
 }
 const dispose=g=>g?.traverse(o=>{o.geometry?.dispose();if(o.material)[].concat(o.material).forEach(m=>m.dispose())});
 function wear(look=outfit()){
  if(wornHelmet){wornHelmet.parent?.remove(wornHelmet);dispose(wornHelmet)}wornHelmet=gearModel(T,look.helmet);wornHelmet.position.copy(headCenter);if(look.helmet?.style!=='open')wornHelmet.position.y-=.025;headGroup.add(wornHelmet);neck.visible=look.helmet?.style==='open';
  blue.color.set(look.top.primary);cuff.color.copy(blue.color).multiplyScalar(.65);pants.color.set(look.pants.primary);shoeMat.color.set(look.shoes.primary);gloveMat.color.set(look.gloves.primary);
  const hoodie=look.top.style==='hoodie',openFace=look.helmet?.style==='open';
  hood.visible=hoodie;if(!hoodie&&hood.parent)hood.parent.remove(hood);else if(hoodie&&!hood.parent)torso.add(hood);
  collar.visible=look.top.style==='jersey';
  torso.children.filter(o=>/hood-cord|pocket-seam|hoodie-hem/.test(o.name)).forEach(o=>o.visible=hoodie);
  // Gear helmet stays in the graph for outfit ids, but it does not reliably
  // draw in the ride framebuffer. Build a head-sized full-face (chin bar +
  // visor, not a sphere) with the same mesh() path as the jersey collar.
  wornHelmet.visible=false;
  lime.color.set(look.helmet?.theme==='lime'?'#8cff00':(look.helmet?.primary||'#8cff00'));
  lime.emissive.copy(lime.color);lime.emissiveIntensity=.9;lime.roughness=.4;lime.side=T.DoubleSide;
  let vis=torso.getObjectByName('rider:helmet');
  if(!vis){
    vis=new T.Group();vis.name='rider:helmet';torso.add(vis);
    const shell=mesh('helmet-shell',new T.SphereGeometry(.088,24,16,0,Math.PI*2,0,Math.PI*.7),lime,vis);
    shell.scale.set(1.26,1.04,.94);shell.position.set(.012,.02,0);shell.frustumCulled=false;
    const chin=mesh('helmet-chinbar',new T.TorusGeometry(.052,.017,10,20,Math.PI),lime,vis);
    chin.rotation.set(Math.PI/2,Math.PI/2,0);chin.position.set(.05,-.058,0);chin.frustumCulled=false;
    for(const side of [-1,1]){const cheek=mesh('helmet-cheek',new T.SphereGeometry(.03,12,8),lime,vis);cheek.scale.set(1.15,.85,.8);cheek.position.set(.035,-.035,side*.06);cheek.frustumCulled=false;}
    const visorMat=material('#101820',.22);visorMat.metalness=.45;visorMat.transparent=true;visorMat.opacity=.88;visorMat.emissive.set('#152030');visorMat.emissiveIntensity=.25;
    const visor=mesh('helmet-visor',new T.BoxGeometry(.045,.048,.13),visorMat,vis);visor.position.set(.095,.01,0);visor.rotation.z=-.12;visor.frustumCulled=false;
    const frame=mesh('helmet-goggles',new T.BoxGeometry(.02,.056,.14),material('#0a0c10',.4),vis);frame.position.set(.078,.01,0);frame.frustumCulled=false;
  }
  vis.visible=!openFace;vis.position.copy(headCenter);
  headGroup.children.forEach(o=>{if(/face|nose|eye|ear/.test(o.name))o.visible=openFace});
  for(const a of arms){a.lower.material=look.top.style==='tee'?skin:blue;for(const child of [...a.glove.children]){a.glove.remove(child);dispose(child)}a.glove.add(gearModel(T,look.gloves));}
  for(const l of legs){l.shin.material=look.pants.style==='shorts'?skin:pants;l.knee.material=look.pants.style==='shorts'?skin:pants;for(const child of [...l.shoe.children]){l.shoe.remove(child);dispose(child)}l.shoe.add(gearModel(T,look.shoes,{single:true}));}
  if(wornPack){torso.remove(wornPack);dispose(wornPack);wornPack=null}if(look.accessory){wornPack=gearModel(T,look.accessory);wornPack.position.set(-.105,.26,0);torso.add(wornPack);}
  rider.userData.gearIds=Object.fromEntries(Object.entries(look).map(([s,p])=>[s,p.id]));
 }
 wear();
 let count=0;rider.traverse(o=>{if(o.isMesh)count++});
 return {root:rider,update({lean=0,crashed=false,superman=0}={}){
  const rideCrouch=ridingPose?-.16:0;
  torso.position.copy(hip);torso.rotation.set(0,0,lean*.23+(crashed?.6:0)-superman*.9+(A.vehicleClass==='escooter'?-.15:0)+rideCrouch);const nod=ridingPose?-.18:0;headGroup.rotation.set(0,0,nod);headGroup.position.copy(headCenter).sub(headCenter.clone().applyAxisAngle(new T.Vector3(0,0,1),nod));const vis=torso.getObjectByName('rider:helmet');if(vis){vis.position.copy(headCenter);vis.rotation.set(0,0,nod);}
  const localHand=hand.clone().sub(torso.position).applyAxisAngle(new T.Vector3(0,0,1),-torso.rotation.z);
  for(const a of arms){const sh=shoulder.clone().setZ(a.side*RIDER_SPEC.shoulderHalfSpan),h=localHand.clone().setZ(a.side*(A.handWidth||.18)),el=sh.clone().lerp(h,.5).add(new T.Vector3(-.08,-.01,a.side*.09));pose(a.upper,sh,el);pose(a.lower,el,h);a.elbow.position.copy(el);a.glove.position.copy(h);a.glove.rotation.set(0,0,0)}
  const pedal=!!bike.getObjectByName('cranks:rotor'),angle=mechanical?.state.crankPhase||0;
  for(const l of legs){const h=hip.clone().setZ(l.side*.075),f=pedal?off([A.bb[0]+Math.cos(angle)*l.side*.14,A.bb[1]+Math.sin(angle)*l.side*.14]).setZ(l.side*.12):A.footTargets?new T.Vector3(...A.footTargets[l.side<0?0:1]).add(bike.position):foot.clone().add(new T.Vector3(-.03,-.025,l.side*.145));f.lerp(new T.Vector3(hip.x-.55,hip.y+.03,l.side*.12),superman);const d=f.clone().sub(h),distance=d.length(),u=d.normalize(),k=h.clone().addScaledVector(u,(RIDER_SPEC.thigh**2-RIDER_SPEC.shin**2+distance**2)/(2*distance)).addScaledVector(new T.Vector3(-u.y,u.x,0),Math.sqrt(Math.max(.001,RIDER_SPEC.thigh**2-((RIDER_SPEC.thigh**2-RIDER_SPEC.shin**2+distance**2)/(2*distance))**2))*(1-superman*.85));pose(l.thigh,h,k);pose(l.shin,k,f);l.knee.position.copy(k);l.shoe.position.copy(f);l.shoe.rotation.set(0,0,-superman*.35)}
 },joints(){rider.updateWorldMatrix(true,true);const point=(parent,p,radius,mass)=>({position:parent.localToWorld(p.clone()).toArray(),radius,mass}),j={pelvis:point(rider,hip,.10,12),chest:point(torso,shoulder,.11,15),head:point(torso,headCenter,.12,4)};for(const a of arms){const key=a.side<0?'L':'R';j['shoulder'+key]=point(torso,shoulder.clone().setZ(a.side*RIDER_SPEC.shoulderHalfSpan),.065,2);j['elbow'+key]=point(torso,a.elbow.position,.05,2);j['hand'+key]=point(torso,a.glove.position,.04,1)}for(const l of legs){const key=l.side<0?'L':'R';j['hip'+key]=point(rider,hip.clone().setZ(l.side*.075),.065,4);j['knee'+key]=point(rider,l.knee.position,.052,3);j['foot'+key]=point(rider,l.shoe.position,.05,1.5)}return j;
 },ragdoll(scene,positions){if(rider.parent!==scene)scene.add(rider);rider.position.set(0,0,0);rider.quaternion.identity();rider.scale.setScalar(1);const v=k=>new T.Vector3(...positions[k]),y=v('chest').sub(v('pelvis')).normalize(),z=v('shoulderR').sub(v('shoulderL')).normalize(),x=new T.Vector3().crossVectors(y,z).normalize();z.crossVectors(x,y).normalize();const restY=shoulder.clone().normalize(),restZ=new T.Vector3(0,0,1),restX=new T.Vector3().crossVectors(restY,restZ).normalize(),basis=new T.Matrix4().makeBasis(x,y,z).multiply(new T.Matrix4().makeBasis(restX,restY,restZ).invert());torso.position.copy(v('pelvis'));torso.quaternion.setFromRotationMatrix(basis);rider.updateWorldMatrix(true,true);const local=k=>torso.worldToLocal(v(k));headGroup.position.copy(local('head').sub(headCenter));for(const a of arms){const key=a.side<0?'L':'R',sh=local('shoulder'+key),el=local('elbow'+key),h=local('hand'+key);pose(a.upper,sh,el);pose(a.lower,el,h);a.elbow.position.copy(el);a.glove.position.copy(h);a.glove.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),h.clone().sub(el).normalize())}for(const l of legs){const key=l.side<0?'L':'R',h=v('hip'+key),k=v('knee'+key),f=v('foot'+key);pose(l.thigh,h,k);pose(l.shin,k,f);l.knee.position.copy(k);l.shoe.position.copy(f);l.shoe.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),k.clone().sub(f).normalize())}
 },setOutfit:wear,attach(){body.add(rider);rider.position.set(0,0,0);rider.quaternion.identity();rider.scale.setScalar(1);this.update()},appearance(colors){for(const [slot,mat]of Object.entries({helmet:lime,gloves:gloveMat,top:blue,jacket:blue,pants,shoes:shoeMat}))if(colors[slot])mat.color.set(colors[slot])},state:()=>({reference:RIDER_SPEC.reference,gearIds:rider.userData.gearIds,meshes:count,wearableSlots:['helmet','gloves','pants','top','jacket','shoes'],geometryCount:new Set([...arms.flatMap(a=>[a.upper.geometry,a.lower.geometry]),...legs.flatMap(l=>[l.thigh.geometry,l.shin.geometry])]).size,style:'jersey-helmet-boots',pose:{pitch:torso.rotation.z,headNod:headGroup.rotation.z,spineDeg:(()=>{const hipW=torso.localToWorld(new T.Vector3(0,0,0)),shW=torso.localToWorld(shoulder.clone().setZ(0));const dx=shW.x-hipW.x,dy=shW.y-hipW.y;return Math.atan2(Math.abs(dx),Math.max(.001,dy))*180/Math.PI})()}})};
}
