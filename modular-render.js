import * as PM from './partmodels.js';
import {part,baseId,canonicalBuild,STOCK_BUILDS} from './modular-catalogue.js';
export function modularAnchors(A,b) {
 if(!['mtb_fs','moto','emoto'].includes(b.frame))return A;
 const moto=b.frame!=='mtb_fs',p=[A.bb[0]+.025,A.bb[1]+.085];
 return {...A,swingPivot:p,shockFrame:[A.seatTop[0]+.04,A.seatTop[1]-.14],shockArm:[p[0]-.10,p[1]+(moto?.025:.12)]};
}
function helpers(T) {
 const mesh=(G,name,geo,color,p)=>{const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,metalness:.55,roughness:.4}));m.name=name;if(p)m.position.set(...p);m.castShadow=m.receiveShadow=true;G.add(m);return m;};
 const rod=(G,name,a,b,r,color)=>{const av=new T.Vector3(...a),d=new T.Vector3(...b).sub(av),m=mesh(G,name,new T.CylinderGeometry(r,r,d.length(),20),color,av.addScaledVector(d,.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;};
 return {mesh,rod};
}
export function componentModel(T,p,A={bb:[0,0],headTop:[0,0],seatTop:[0,0],rearAxle:[-.4,0],swingPivot:[0,0],shockArm:[-.1,.18]}) {
 PM.useThree(T);const G=new T.Group();G.name='wk:model:'+p.slot;const {mesh,rod}=helpers(T),c=p.color||'#3e494f';
 if(p.slot==='stem') {
  const h=A.headTop,top=[h[0]+.025,h[1]+(p.id==='stem_trax'?.17:.06),0];
  rod(G,'stem:body',[h[0],h[1],0],[top[0],top[1]-.014,0],.013,c);
  const profile=new T.Shape();profile.absarc(0,0,.022,0,Math.PI*2,false);const bore=new T.Path();bore.absarc(0,0,.0113,0,Math.PI*2,true);profile.holes.push(bore);
  const clampGeo=new T.ExtrudeGeometry(profile,{depth:.05,bevelEnabled:true,bevelSize:.001,bevelThickness:.001,bevelSegments:2,curveSegments:16});clampGeo.translate(0,0,-.025);mesh(G,'stem:clamp',clampGeo,c,top);
  for(const side of [-1,1])for(const height of [-1,1]){const bolt=mesh(G,'stem:faceBolt'+side+height,new T.CylinderGeometry(.0035,.0035,.005,6),'#bdc6cb',[top[0]+.019,top[1]+height*.012,side*.016]);bolt.rotation.z=Math.PI/2;}
  G.userData.clamp=top;
 } else if(p.slot==='seatpost')rod(G,'seatpost:post',[...A.seatTop,0],[A.seatTop[0]-.016,A.seatTop[1]+.075,0],.013,c);
 else if(p.slot==='headset')for(const [i,y] of [[0,-.015],[1,.015]]){const m=mesh(G,'headset:cup'+i,new T.CylinderGeometry(.029,.029,.015,24),c,[0,y,0]);}
 else if(p.slot==='hubs'){for(const z of [-.035,.035]){const hub=PM.hubFlange(.034,.03,z>0?1:-1,c);hub.position.z=z;G.add(hub);}const barrel=mesh(G,'hub:shell',new T.CylinderGeometry(.022,.022,.07,24),c);barrel.rotation.x=Math.PI/2;}
 else if(p.slot==='pedals'){const assembly=PM.crankset([0,0],c,!!p.pegs);if(p.pegs)G.add(assembly);else{const rotor=assembly.getObjectByName('cranks:rotor');rotor.children.filter(o=>o.userData.wkPedal).forEach(o=>{rotor.remove(o);G.add(o);});}}
 else if(p.slot==='grips')for(const side of [-1,1]){const o=mesh(G,'grips:'+side,new T.CylinderGeometry(.016,.016,.11,24),c,[0,0,side*.09]);o.rotation.x=Math.PI/2;}
 else if(p.slot==='rims')for(const side of [-1,1])mesh(G,'rims:hoop'+side,new T.TorusGeometry(.21,.009,12,64),c,[side*.24,0,0]);
 else if(p.slot==='tyres')mesh(G,'tyre:tread',new T.TorusGeometry(.22,.028,16,64),'#171a1c');
 else if(p.slot==='seat'){const o=mesh(G,'seat:upholstery',new T.SphereGeometry(.1,24,16),c);o.scale.set(p.sx||1.3,.32,.65);}
 else if(p.slot==='number_plate')mesh(G,'numberPlate:panel',new T.BoxGeometry(.008,.14,.17),c,[A.headTop[0]+.055,A.headTop[1]+.07,0]);
 else if(p.slot==='body_panels')mesh(G,'bodyPanel:cover',new T.BoxGeometry(.3,.32,.12),c,[.15,.35,0]);
 else if(p.slot==='rear_frame') {
  const P=A.swingPivot,R=A.rearAxle,E=A.shockArm;G.name='wk:model:rearFrame';G.position.set(...P,0);
  const local=p=>[p[0]-P[0],p[1]-P[1],p[2]||0],moto=p.family!=='mtb_fs';
  for(const side of [-1,1]){
   const z=side*(moto?.075:.061);
   if(p.family==='emoto'){const d=new T.Vector3(R[0]-P[0],R[1]-P[1],0),m=mesh(G,'rearFrame:boxArm'+side,new T.BoxGeometry(d.length(),.05,.035),c,[d.x/2,d.y/2,z]);m.rotation.z=Math.atan2(d.y,d.x);}
   else rod(G,'rearFrame:lowerStay'+side,[0,0,z],local([...R,z]),moto?.023:.014,c);
   if(!moto){rod(G,'rearFrame:upperStay'+side,local([...R,z]),local([...E,z]),.012,c);rod(G,'rearFrame:upright'+side,[0,0,z],local([...E,z]),.015,c);}
   else rod(G,'rearFrame:shockStrut'+side,[0,0,z],local([...E,side*.025]),.014,c);
   mesh(G,'rearFrame:dropout'+side,new T.BoxGeometry(.045,.045,.009),c,local([...R,z]));
   const bolt=mesh(G,'rearFrame:pivotBolt'+side,new T.CylinderGeometry(.013,.013,.012,6),'#a4afb4',[0,0,side*(moto?.10:.08)]);bolt.rotation.x=Math.PI/2;
  }
  for(const [name,point] of [['pivot',P],['axle',R],['shockEye',E]]){const o=new T.Object3D();o.name='rearFrame:'+name;o.position.set(...local(point));G.add(o);}
 }
 return G;
}

export function finishModular(root,A,b,selected,T,slotGroup,g) {
 PM.useThree(T);const {mesh,rod}=helpers(T),find=slot=>part(b[slot]);
 // Suspended rear assemblies and shocks are never hidden in the main-frame purchase.
 if(['mtb_fs','moto','emoto'].includes(b.frame)) {
  const fr=g('frame');fr?.children.slice().forEach(o=>{if(/frame:(chainstay|seatstay|swingarm|swingPivot|dropout|bridge|stockShock)/.test(o.name))fr.remove(o)});
  if(!fr?.getObjectByName('frame:swingPivot'))rod(fr,'frame:swingPivot',[...A.swingPivot,-.08],[...A.swingPivot,.08],.023,'#333b40');
  if(find('rear_frame')){const G=slotGroup('rear_frame');G.userData.mount='swingPivot';G.add(componentModel(T,find('rear_frame'),A));}
 }
 // Enduro cosmetic/electrical pieces leave the structural frame and enter real slots.
 const em=root.getObjectByName('wk:emoto');if(em){
  for(const [slot,test] of [
   ['body_panels',o=>/emoto:(enclosure|sidePanel|panelBolts|batteryLid)/.test(o.name)],
   ['seat',o=>o.name==='emoto:seat'],['controller',o=>/emoto:(controller|motorCable)/.test(o.name)],
   ['lights',o=>o.name==='emoto:headlight'],['number_plate',o=>/emoto:(numberPlate|plateBolts)/.test(o.name)],
  ]){const pieces=em.children.filter(test);const G=b[slot]?(g(slot)||slotGroup(slot)):null;if(G&&['seat','controller','lights','number_plate'].includes(slot))G.clear();for(const o of pieces){em.remove(o);if(G)G.add(o);}}
  em.children.slice().forEach(o=>{em.remove(o);if(!/^swingarm:/.test(o.name))g('frame').add(o)});root.remove(em);
 }
 // Remove the extra controller bundled into the old motor model.
 const bundledControllers=[];root.traverse(o=>{if(o.name==='motoMid:controller'||o.name==='motoMid:ctlFins')bundledControllers.push(o)});for(const o of bundledControllers)o.removeFromParent();
 for(const slot of ['stem','seatpost'])if(find(slot)){const G=slotGroup(slot);G.add(componentModel(T,find(slot),A));}
 // Original anonymous quill and seatpost meshes are replaced, not layered over.
 g('cockpit')?.children.slice().forEach(o=>{if(o.name==='trax:quillStem'||!o.name&&o.geometry&&(o.geometry.type==='CylinderGeometry'&&Math.abs(o.geometry.parameters.radiusTop-.016)<.001||o.geometry.type==='BoxGeometry'&&Math.abs(o.geometry.parameters.width-.07)<.001))g('cockpit').remove(o)});
 g('seat')?.children.slice().forEach(o=>{if(o.geometry?.type==='CylinderGeometry')g('seat').remove(o)});
 if(b.stem){const clamp=root.getObjectByName('wk:model:stem')?.userData.clamp;const bars=g('cockpit')?.getObjectByName('wk:model:bars');if(clamp&&bars){bars.getObjectByName('bars:clamp')?.removeFromParent();const delta=clamp[1]-(A.headTop[1]+(b.frame==='trax_lime'&&b.bars==='trax_bars'?.17:.06));bars.position.y+=delta;}}
 // Headset cups retain the actual frame-axis transforms when moved into their slot.
 const cups=[];g('frame')?.traverse(o=>{if(['frame:lowerCup','frame:upperCup'].includes(o.name))cups.push(o)});
 if(b.headset){const G=slotGroup('headset');for(const o of cups){o.parent.remove(o);G.add(o);}}
 else for(const o of cups)o.parent.remove(o);
 if(b.number_plate&&!root.getObjectByName('wk:part:number_plate'))slotGroup('number_plate').add(componentModel(T,find('number_plate'),A));
 // Pedal platforms orbit the crank axle as a separate purchased pair.
 const cr=g('drive')?.getObjectByName('wk:model:cranks'),rotor=cr?.getObjectByName('cranks:rotor'),pedalMeshes=[];rotor?.traverse(o=>{if(o.userData.wkPedal)pedalMeshes.push(o)});
 if(!b.cranks||part(b.motor)?.nopedal||part(b.cranks)?.pegs){cr?.parent.remove(cr);}
 if(b.pedals){const G=slotGroup('pedals');if(find('pedals')?.pegs)G.add(PM.crankset(A.bb,find('pedals').color,true));else if(b.cranks&&rotor){root.updateMatrixWorld(true);for(const o of pedalMeshes)G.attach(o);}}
 else for(const o of pedalMeshes)o.parent?.remove(o);
 // Remove absent stock pieces: there is no implicit free fork/seat/chain/etc.
 if(!b.grips){const grips=[];root.traverse(o=>{if(o.name.startsWith('grips:'))grips.push(o)});for(const o of grips)o.removeFromParent();}
 for(const slot of ['suspension','seat','bars','brakes','motor','battery','controller','throttle'])if(!b[slot]){
  if(slot==='bars')g('cockpit')?.children.slice().forEach(o=>{if(o.name==='wk:model:bars'||/brakeLever|brakeCable|quillStem/.test(o.name))g('cockpit').remove(o)});
  else g(slot)?.clear();
 }
 if(!b.chain)root.getObjectByName('wk:model:chain')?.removeFromParent();
 if(!b.sprocket_f)for(const name of ['sprocketF','mid:chainring','motoMid:sprocket','trax:chainGuard'])root.getObjectByName(name)?.removeFromParent();
 if(!b.sprocket_r)root.getObjectByName('sprocketR')?.removeFromParent();
 if(!b.seatpost&&!['moto','emoto'].includes(b.frame)&&g('seat'))g('seat').visible=false;
 if(!b.stem&&g('cockpit'))g('cockpit').visible=false;
 for(const group of [g('tyres'),g('motor')])group?.traverse(w=>{
  if(!w.isGroup||!w.children.some(o=>o.name==='wheel:spokes'))return;
  for(const o of w.children.slice()){
   const gp=o.geometry?.parameters;
   const tyre=gp&&(o.geometry.type==='TorusGeometry'&&gp.tube>.015||o.isInstancedMesh&&[64,96].includes(o.count));
   const rim=gp&&(o.geometry.type==='TorusGeometry'&&Math.abs(gp.tube-.009)<1e-5||o.geometry.type==='CylinderGeometry'&&gp.openEnded)||['wheel:spokes','wheel:nipples'].includes(o.name)||o.name.startsWith('trax:spokeReflector');
   const plainHub=o.name.startsWith('hub:flange')||gp&&o.geometry.type==='CylinderGeometry'&&!gp.openEnded&&gp.radiusTop<.035;
   if(!b.tyres&&tyre||!b.rims&&rim||!b.hubs&&plainHub)w.remove(o);
  }
 });
 // Consistent assembly groups for in-place wheel components, used by inspectors/tests.
 for(const slot of ['hubs','rims','tyres'])if(b[slot]){root.userData.wkWheelParts={...(root.userData.wkWheelParts||{}),[slot]:b[slot]};}
 paintBuild(root,selected,T);
}

const patterns={frame:/frame:(?!.*(?:Bolt|bolt|Cup|Collar|collar))|emoto:(castRail|headMount|seatSubframe)/,rear_frame:/rearFrame:(chainstay|seatstay|lowerStay|upperStay|upright|frontUpright|boxArm|shockStrut|crossBrace|shockClevis|dropout)/,suspension:/fork:(lower|upperTube|arch|crown)/,shock:/shock:(spring|airCan)/,bars:/bars:(bar|crossbar|clamp)/,grips:/grips:/,seat:/emoto:seat|^$|seat:/,cranks:/cranks:arm/,pedals:/pedal:cage|pegs:pad/,stem:/stem:(body|clamp)/,seatpost:/seatpost:post/,headset:/headset:|frame:(lowerCup|upperCup)/,motor:/hub:(shell|cover)|mid:(motor|gearHousing|cover)|motoMid:(motor|cover)/,body_panels:/emoto:(enclosure|sidePanel|batteryLid)/,number_plate:/numberPlate|numberPlate:panel/,controller:/controller:(case|fins)|^$/,battery:/battery:(case|body)|^$/};
export function paintBuild(root,build,T) {
 const plainWheel=o=>{for(let p=o;p&&p!==root;p=p.parent){if(p.name==='wk:model:hub')return false;if(p.userData.wkWheel)return true;}return false;};
 for(const [slot,id] of Object.entries(build)){
  const p=part(id);if(!p?.color&&!p?.variantOf)continue;const color=p.color;if(!color)continue;
  if(slot==='tyres'){
   root.traverse(w=>{if(!w.isGroup)return;const tyre=w.children.find(o=>o.geometry?.type==='TorusGeometry'&&o.geometry.parameters.tube>.02);if(!tyre)return;
    for(const side of [-1,1]){let band=w.children.find(o=>o.name==='tyre:sidewall'+side);if(!band){const gp=tyre.geometry.parameters;band=new T.Mesh(new T.TorusGeometry(gp.radius,.008,8,64),new T.MeshStandardMaterial({color,roughness:.8}));band.name='tyre:sidewall'+side;band.position.z=side*gp.tube*.82;band.scale.z=.22;w.add(band);}else band.material.color.set(color);}
   });continue;
  }
  let targets=[];
  if(slot==='rims'||slot==='hubs'||slot==='grips')root.traverse(o=>{if(o.isMesh)targets.push(o)});
  else {const g=root.getObjectByName('wk:part:'+slot)||root.getObjectByName('wk:'+slot)||(slot==='bars'?root.getObjectByName('wk:cockpit'):null);g?.traverse(o=>{if(o.isMesh)targets.push(o)});}
  for(const o of targets){const gp=o.geometry?.parameters;
   const match=slot==='rims'?gp&&(o.geometry.type==='TorusGeometry'&&Math.abs(gp.tube-.009)<1e-5||o.geometry.type==='CylinderGeometry'&&gp.openEnded):slot==='hubs'?plainWheel(o)&&(o.name.startsWith('hub:flange')||o.geometry?.type==='CylinderGeometry'&&Math.abs(gp.radiusTop-.022)<1e-5):patterns[slot]?patterns[slot].test(o.name):true;
   if(!match)continue;
   const tint=m=>{m=m.clone();if(m.color)m.color.set(color);if(p.variantOf)m.map=null;if(p.finish==='chrome'){m.metalness=1;m.roughness=.17;}return m;};
   o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);
  }
 }
}

export function previewBuild(T,frame) {
 const b={...STOCK_BUILDS[baseId(frame)],frame},base=baseId(frame),R=globalThis.__WK_WHEELR__?.(base,part(b.tyres))||(['moto','emoto'].includes(base)?.33:.255),x=globalThis.__WK_FRAMEGEO__?.(base,R,b)||(['moto','emoto'].includes(base)?{rear:[-.52,R],bb:[0,.36],seat:[-.14,.86],htT:[.6,.93],htB:[.66,.7],front:[.82,R],tr:.03}:{rear:[-.37,R],bb:[0,R+.035],seat:[-.1,.7],htT:[.5,.74],htB:[.545,.58],front:[.63,R],tr:.017});
 const root=new T.Group(),groups={};for(const name of ['frame','tyres','motor','drive','suspension','cockpit','seat','brakes','controller','battery','throttle']){const g=new T.Group();g.name='wk:'+name;root.add(g);groups[name]=g;}
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.5});groups.frame.add(new T.Mesh(new T.BoxGeometry(.01,.01,.01),mat(part(frame)?.color||part(frame)?.fc||'#586b72')));
 for(const a of [x.rear,x.front]){const w=new T.Group();w.position.set(...a,0);groups.tyres.add(w);w.add(new T.Mesh(new T.TorusGeometry(R-.028,.028,12,48),mat('#171b1d')));w.add(new T.Mesh(new T.TorusGeometry(R-.060,.009,8,48),mat('#8e999e')));w.add(new T.InstancedMesh(new T.CylinderGeometry(.0013,.0013,1,5),mat('#555'),36));}
 const saddle=new T.Mesh(new T.SphereGeometry(.1,20,12),mat('#20272c'));saddle.scale.set(1.3,.32,.65);saddle.position.set(x.seat[0],x.seat[1]+.09,0);groups.seat.add(saddle);
 globalThis.__WK_BUILD_HOOK__?.(root,{x,R,b},T);return root;
}
