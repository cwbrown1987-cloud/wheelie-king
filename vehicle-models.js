import {prototypeFor} from './vehicle-platforms.js';
import * as PM from './partmodels.js';
import {chainRoute} from './bike-motion.js';
// All assemblies use the same axle/pivot/fork names as the existing motion rig.
export function buildVehicle(root,build,T,find){
 const v=prototypeFor(build.frame);if(!v)return false;PM.useThree(T);
 const stand=root.getObjectByName('wk:stand');if(stand)stand.removeFromParent();
 root.traverse(o=>{o.geometry?.dispose()});root.clear();if(stand)root.add(stand);
 const scooter=v.vehicleClass==='escooter',R=v.wheelR,x=v.geometry(R),A={frontAxle:x.front,rearAxle:x.rear,bb:x.bb,headTop:x.htT,headBottom:x.htB,seatTop:x.seat,wheelR:R,swingPivot:v.pivot,shockFrame:v.shockFrame,shockArm:v.shockArm,feet:v.feet,vehicleClass:v.vehicleClass,hand:[x.htT[0],x.htT[1]+(scooter?.075:.14)],handWidth:scooter?.29:.36,footTargets:scooter?[[-.18,.31,-.04],[.06,.31,.04]]:[[-.135,.381,-.14],[-.135,.381,.14]]};
 const groups=new Map(),p=slot=>find(build[slot]),color=slot=>p(slot)?.color||v.colour;
 const group=slot=>{if(groups.has(slot))return groups.get(slot);const g=new T.Group();g.name=['frame','tyres','motor','suspension','brakes','seat','battery','controller','throttle'].includes(slot)?'wk:'+slot:'wk:part:'+slot;g.userData.slot=slot;root.add(g);groups.set(slot,g);return g};
 const mat=(c,metal=.3)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:.42});
 const mesh=(g,name,geometry,c,position=[0,0,0])=>{const m=new T.Mesh(geometry,mat(c));m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;g.add(m);return m};
 const rod=(g,name,a,b,r,c)=>{const d=new T.Vector3(...b).sub(new T.Vector3(...a)),m=mesh(g,name,new T.CylinderGeometry(r,r,d.length(),16),c);m.position.copy(new T.Vector3(...a).addScaledVector(d,.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m};
 const rounded=(g,name,w,h,d,c,pos,bevel=.012)=>{const s=new T.Shape(),a=w/2-bevel,b=h/2-bevel;s.moveTo(-a,-h/2);s.lineTo(a,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-b);s.lineTo(w/2,b);s.quadraticCurveTo(w/2,h/2,a,h/2);s.lineTo(-a,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,b);s.lineTo(-w/2,-b);s.quadraticCurveTo(-w/2,-h/2,-a,-h/2);const geo=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:bevel/3,bevelThickness:bevel/3,bevelSegments:3,curveSegments:8,steps:1});geo.translate(0,0,-d/2);return mesh(g,name,geo,c,pos)};
 const fr=group('frame'),fc=color('frame');
 if(scooter){
  rounded(fr,'scooter:deck',.65,.085,.19,fc,[-.04,.205,0]);
  rod(fr,'scooter:neck',[.22,.23,0],[.43,.43,0],.033,fc);rod(fr,'frame:headTube',[.43,.43,0],[.35,1.06,0],.024,fc);
  rounded(fr,'scooter:foldingLatch',.06,.08,.075,'#454f5d',[.42,.46,0]);
  for(const px of [-.31,.23])for(const side of [-1,1])mesh(fr,'scooter:deckBolt',new T.CylinderGeometry(.004,.004,.003,6),'#aab8c2',[px,.261,side*.073]);
  rounded(fr,'scooter:chargePort',.035,.025,.008,'#111c29',[.19,.207,.101],.005);
 }else{
  for(const side of [-1,1]){const z=side*.065;rod(fr,'pit:topRail',[-.42,.68,z],[.48,.78,z],.018,fc);rod(fr,'pit:downTube',[.48,.74,z],[.15,.27,z],.023,fc);rod(fr,'pit:engineCradle',[.15,.27,z],[-.25,.29,z],.019,fc);rod(fr,'pit:seatStrut',[-.25,.29,z],[-.27,.69,z],.02,fc);}
  rod(fr,'frame:headTube',[...x.htB,0],[...x.htT,0],.035,fc);
 }
 // Separate purchased swingarm rotates about the named frame pivot.
 if(p('rear_frame')){const outer=group('rear_frame'),rear=new T.Group();rear.name='wk:model:rearFrame';rear.position.set(...A.swingPivot,0);outer.add(rear);for(const [name,point]of [['pivot',A.swingPivot],['axle',A.rearAxle],['shockEye',A.shockArm]]){const marker=new T.Object3D();marker.name='rearFrame:'+name;marker.position.set(point[0]-A.swingPivot[0],point[1]-A.swingPivot[1],0);rear.add(marker)}for(const side of [-1,1]){const z=side*(scooter?.058:.077);rod(rear,'rearFrame:arm'+side,[0,0,z],[A.rearAxle[0]-A.swingPivot[0],A.rearAxle[1]-A.swingPivot[1],z],scooter?.018:.022,color('rear_frame'));rod(rear,'rearFrame:shockStrut'+side,[0,0,z],[A.shockArm[0]-A.swingPivot[0],A.shockArm[1]-A.swingPivot[1],side*.024],.013,color('rear_frame'));}rod(fr,'frame:swingPivot',[...A.swingPivot,-.09],[...A.swingPivot,.09],.021,'#a5afb7');}
 const bolts=new T.Group();bolts.name='frame:rearAxleBolts';fr.add(bolts);for(const side of [-1,1])rod(bolts,'rearAxle:nut',[...A.rearAxle,side*.07],[...A.rearAxle,side*.09],.012,'#a7b5bf');
 if(p('shock')){const shock=PM.shock(p('shock'),A.shockFrame,A.shockArm);shock.name='wk:model:shock';group('shock').add(shock)}
 if(p('suspension')){
  const fork=new T.Group();fork.name='wk:model:fork';const direction=new T.Vector3(x.htB[0]-x.front[0],x.htB[1]-x.front[1],0).normalize();fork.userData.wkFork={axis:direction.toArray()};group('suspension').add(fork);
  for(const side of [-1,1]){const z=side*(scooter?.065:.082),middle=[x.front[0]+direction.x*(scooter?.14:.26),x.front[1]+direction.y*(scooter?.14:.26),z];rod(fork,'fork:stanchion'+side,[x.htB[0],x.htB[1],z],middle,.014,'#c7d5dd');const lower=rod(fork,'fork:lower'+side,[x.front[0],x.front[1],z],middle,.022,color('suspension'));lower.userData.wkForkMoving=true;}
  rod(fork,'fork:crown',[x.htB[0],x.htB[1],-.1],[x.htB[0],x.htB[1],.1],.022,fc);
  const axle=new T.Group();axle.name='fork:frontAxle';axle.userData.wkForkMoving=true;fork.add(axle);for(const side of [-1,1])rod(axle,'frontAxle:nut',[...A.frontAxle,side*.075],[...A.frontAxle,side*.095],.011,'#a7b5bf');
 }
 if(p('bars')){const cg=group('bars');cg.name='wk:cockpit';const clamp=[x.htT[0]+.025,x.htT[1]+.06];if(p('stem'))rod(group('stem'),'stem:body',[...x.htT,0],[...clamp,0],.015,color('stem'));const bar=PM.bars({width:scooter?.29:.36,rise:scooter?.015:.08,sweep:.025,crossbar:!scooter,color:color('bars'),gripColor:color('grips')},clamp);bar.name='wk:model:bars';cg.add(bar);}
 if(p('throttle')){const g=group('throttle'),h=A.hand;rounded(g,'throttle:paddle',.035,.018,.025,color('throttle'),[h[0],h[1]-.025,A.handWidth-.025],.004);for(const side of [-1,1])rod(g,'brake:lever',[h[0],h[1],side*(A.handWidth-.07)],[h[0]+.06,h[1]-.015,side*(A.handWidth-.04)],.005,'#8d9ca7');const pts=[[h[0],h[1],.1],[h[0]+.05,h[1]-.1,.10],[x.htB[0]+.04,x.htB[1]-.06,.09],[x.front[0]+.025,x.front[1]+.04,.08]].map(a=>new T.Vector3(...a));mesh(g,'brake:frontHose',new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.003,6,false),'#17202b');}
 if(p('headset')){const axis=new T.Vector3(x.htT[0]-x.htB[0],x.htT[1]-x.htB[1],0).normalize();for(const point of [x.htT,x.htB]){const a=new T.Vector3(...point,0);rod(group('headset'),'headset:cup',a.clone().addScaledVector(axis,-.007).toArray(),a.clone().addScaledVector(axis,.007).toArray(),.038,color('headset'));}}
 if(p('seat')&&!scooter){const seat=rounded(group('seat'),'pit:benchSeat',.49,.075,.17,color('seat'),[-.24,.76,0],.025);seat.rotation.z=.04;}
 if(p('body_panels')){
  if(scooter){rounded(group('body_panels'),'scooter:gripMat',.57,.006,.167,'#171c24',[-.055,.252,0],.01);for(let i=0;i<9;i++)rounded(group('body_panels'),'scooter:gripStripe',.008,.002,.14,color('body_panels'),[-.30+i*.062,.257,0],.001);}
  else for(const side of [-1,1]){rounded(group('body_panels'),'pit:sidePanel',.26,.16,.014,color('body_panels'),[-.26,.62,side*.095],.025);rounded(group('body_panels'),'pit:forkPlate',.015,.19,.18,color('body_panels'),[.51,.78,0]);}
 }
 if(p('fuel_tank')){const shape=new T.Shape();shape.moveTo(-.14,-.065);shape.lineTo(.13,-.055);shape.quadraticCurveTo(.17,0,.13,.065);shape.lineTo(.045,.12);shape.lineTo(-.09,.12);shape.quadraticCurveTo(-.16,.07,-.14,-.065);const geo=new T.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:3,curveSegments:12});geo.translate(0,0,-.09);mesh(group('fuel_tank'),'pit:fuelTank',geo,color('fuel_tank'),[.10,.64,0]);mesh(group('fuel_tank'),'pit:fuelCap',new T.CylinderGeometry(.023,.023,.015,20),'#111b25',[.08,.77,0]);}
 for(const [slot,axle]of [['fender_f',x.front],['fender_r',x.rear]])if(p(slot)){const shape=new T.Shape(),r=R+(scooter?.035:.065);shape.absarc(0,0,r,.15,Math.PI-.15,false);shape.absarc(0,0,r-.009,Math.PI-.15,.15,true);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:scooter?.075:.11,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:2,curveSegments:32});geo.translate(0,0,-(scooter?.075:.11)/2);mesh(group(slot),'fender:panel',geo,color(slot),[...axle,0]);group(slot).userData.mount=slot==='fender_f'?'frontAxle':'rearAxle';}

 if(p('motor')&&!scooter){const g=group('motor');rounded(g,'engine:crankcase',.19,.15,.19,color('motor'),[-.03,.38,0],.035);const cylinder=rounded(g,'engine:cylinder',.12,.17,.14,'#687784',[.07,.49,0],.012);cylinder.rotation.z=-.3;for(let i=0;i<6;i++)rounded(g,'engine:coolingFin',.145,.008,.17,'#a9b3bb',[.075-i*.004,.43+i*.022,0],.002);mesh(g,'engine:clutchCover',new T.SphereGeometry(.075,24,16),'#aebbc3',[-.06,.38,.10]).scale.set(1,.85,.25);}
 if(p('battery'))rounded(group('battery'),'scooter:deckBattery',.47,.055,.14,'#253c57',[-.04,.206,0],.008);
 if(p('controller'))rounded(group('controller'),'scooter:controller',.10,.04,.12,'#9baab1',[.25,.21,0],.005);
 if(p('exhaust')){const g=group('exhaust'),pts=[[.13,.46,.085],[.23,.39,.12],[.09,.30,.14],[-.18,.39,.14],[-.40,.63,.12]].map(a=>new T.Vector3(...a));mesh(g,'engine:exhaustHeader',new T.TubeGeometry(new T.CatmullRomCurve3(pts),40,.016,10,false),'#7d7772');rod(g,'engine:silencer',[-.43,.62,.12],[-.61,.66,.12],.035,'#b5bac0');}
 // Both tyres use the same physical radius as contacts; hubs/rims replace in place.
 if(p('tyres'))for(const [index,a]of [x.rear,x.front].entries()){
  const w=new T.Group();w.name=index?'wheel:front':'wheel:rear';w.userData.wkWheel=true;w.position.set(...a,0);group('tyres').add(w);const tube=scooter?.025:.036;
  mesh(w,'wheel:tyre',new T.TorusGeometry(R-tube,tube,16,64),'#161b20');if(p('tyres').finish)for(const side of [-1,1])mesh(w,'wheel:sidewall',new T.TorusGeometry(R-tube,.003,8,64),color('tyres'),[0,0,side*tube*.92]);
  if(p('rims'))mesh(w,'wheel:rim',new T.TorusGeometry(R-tube*2,.009,12,64),color('rims'));
  if(p('hubs')){rod(w,'hub:shell',[0,0,-.05],[0,0,.05],scooter?.024:.03,color('hubs'));}
  if(scooter){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod(w,'wheel:castSpoke',[0,0,0],[Math.cos(a)*(R-.05),Math.sin(a)*(R-.05),0],.009,color('rims'));}if(index===0&&p('motor'))rod(w,'scooter:hubMotor',[0,0,-.035],[0,0,.035],.07,color('motor'));}
  else{for(let i=0;i<28;i++){const a=i/28*Math.PI*2;rod(w,'wheel:spoke',[Math.cos(a)*.028,Math.sin(a)*.028,i%2?.025:-.025],[Math.cos(a+.2)*(R-.071),Math.sin(a+.2)*(R-.071),0],.0014,'#a1aab0');}for(let i=0;i<36;i++){const a=i/36*Math.PI*2,m=rounded(w,'wheel:tread',.035,.016,.065,'#20252b',[Math.cos(a)*(R-.006),Math.sin(a)*(R-.006),0],.003);m.rotation.z=a-Math.PI/2;}}
 }
 if(p('brakes'))for(const [i,a]of [x.rear,x.front].entries()){
  const rotor=mesh(group('brakes'),'brake:rotor',new T.TorusGeometry(scooter?.055:.085,.008,8,40),'#bec6cb',[...a,.065]);for(let k=0;k<5;k++){const ang=k/5*Math.PI*2;rod(group('brakes'),'brake:rotorBolts',[a[0],a[1],.065],[a[0]+Math.cos(ang)*(scooter?.05:.08),a[1]+Math.sin(ang)*(scooter?.05:.08),.065],.003,'#b8c3cb');}rounded(group('brakes'),'brake:caliper',.04,.045,.03,'#384f58',[a[0]+.045,a[1]+.035,.075],.008);
 }
 if(p('pedals'))for(const side of [-1,1])rounded(group('pedals'),'pit:footpeg',.065,.018,.09,'#a4afb6',[...v.feet,side*.14],.004);
 if(p('chain')&&p('sprocket_f')&&p('sprocket_r')){const g=group('drive'),front=PM.sprocket(p('sprocket_f').teeth,'428','#77848e','sprocketF'),back=PM.sprocket(p('sprocket_r').teeth,'428','#77848e','sprocketR');front.position.set(...A.bb,.10);back.position.set(...A.rearAxle,.10);g.add(front,back);const chain=PM.chainAlong(chainRoute([{x:A.rearAxle[0],y:A.rearAxle[1],r:PM.sprocketR(p('sprocket_r').teeth)+.004},{x:A.bb[0],y:A.bb[1],r:PM.sprocketR(p('sprocket_f').teeth)+.004}]),'428','#53595c',.10);chain.name='wk:model:chain';g.add(chain);}
 if(p('lights')){rounded(group('lights'),'scooter:headlight',.025,.035,.055,'#e9f6ff',[.385,1.05,0],.006);rounded(group('lights'),'scooter:tailLight',.02,.025,.06,'#ed493e',[-.37,.26,0],.004);}
 if(scooter)A.riderHip=[-.20,1.04];
 root.userData.wkAnchors=A;root.userData.wkBuild={...build};root.userData.vehicleClass=v.vehicleClass;
 return true;
}
