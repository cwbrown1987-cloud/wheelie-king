import {furnitureModel} from './garage-furniture.js';
import {RIDER_SPEC} from './rider-spec.js';
// Shared shop and worn geometry. All helmets face +X, centered on the head.
export function gearModel(T,p,{single=false}={}){
 if(['shelf','toolbox'].includes(p.style))return furnitureModel(T,p.style);
 const g=new T.Group();g.name='gear:'+p.id;g.userData.gearId=p.id;
 const material=(c,metal=.12,rough=.55)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
 const primary=material(p.primary),accent=material(p.accent),dark=material('#14202a'),silver=material('#9daeb8',.8,.25);
 const fabric=()=>material('#d7dfe2',.02,.85);
 const mesh=(name,geo,mat,pos=[0,0,0],parent=g)=>{const m=new T.Mesh(geo,mat);m.name='gear:'+name;m.position.set(...pos);m.castShadow=m.receiveShadow=true;parent.add(m);return m};
 const box=(name,size,mat,pos=[0,0,0],parent=g)=>{const [w,h,d]=size,b=Math.min(w,h,d)*.17,s=new T.Shape();s.moveTo(-w/2+b,-h/2);s.lineTo(w/2-b,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+b);s.lineTo(w/2,h/2-b);s.quadraticCurveTo(w/2,h/2,w/2-b,h/2);s.lineTo(-w/2+b,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-b);s.lineTo(-w/2,-h/2+b);s.quadraticCurveTo(-w/2,-h/2,-w/2+b,-h/2);const geo=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:b*.3,bevelThickness:b*.3,bevelSegments:3,curveSegments:6});geo.translate(0,0,-d/2);return mesh(name,geo,mat,pos,parent)};
 const tube=(name,points,r,mat,parent=g)=>mesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(a=>new T.Vector3(...a))),32,r,10,false),mat,[0,0,0],parent);
 const cylinder=(name,r,h,mat,pos=[0,0,0],parent=g)=>mesh(name,new T.CylinderGeometry(r,r,h,24),mat,pos,parent);
 if(p.slot==='helmet'){
  const open=p.style==='open',mx=p.style==='mx',street=p.style==='street';
  const cut=y=>open?1.08*Math.sqrt(Math.max(0,1-((y+.035)/.12)**2)):y>-.055&&y<.075?.98*Math.pow(Math.max(0,1-((y-.01)/.065)**4),.25):0;
  const surface=(lens=false)=>{const vertices=[],indices=[],rows=64,cols=64,low=lens?-.055:(open?-.080:-.113),high=.132;for(let j=0;j<=rows;j++){const y=lens?-.055+j/rows*.13:low+j/rows*(high-low),r=Math.sqrt(Math.max(0,1-(y/.132)**2)),c=cut(y);for(let i=0;i<=cols;i++){const angle=lens?-c+i/cols*c*2:c+i/cols*(Math.PI*2-c*2);vertices.push(Math.cos(angle)*r*RIDER_SPEC.helmet.x*(lens?.986:1),y,Math.sin(angle)*r*RIDER_SPEC.helmet.z*(lens?.986:1));}}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;indices.push(a,b,c,b,d,c)}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;};
  let paint=primary;
  if(p.theme==='lime')paint=new T.MeshBasicMaterial({color:'#8cff00',side:T.DoubleSide});
  else{primary.emissive.set(p.primary);primary.emissiveIntensity=.55;primary.roughness=.4;primary.side=T.DoubleSide}
  const shell=mesh('helmet:shell',new T.SphereGeometry(.13,32,24),paint);shell.scale.set(1.15,1.08,1.12);
  const liner=new T.SphereGeometry(.112,32,20,0,Math.PI*2,0,Math.PI*(open?.60:.88));liner.scale(.98,1.09,.96);const linerMat=material('#111a20');linerMat.side=T.BackSide;mesh('helmet:liner',liner,linerMat);
  if(!open){
   const lens=material('#152b3c',.5,.16);lens.side=T.DoubleSide;mesh('helmet:visor',surface(true),lens);
   const gogFrame=material('#07090c',.12,.42),gogLens=material('#2a5570',.75,.1),gogStrap=material('#0d1014',.05,.75);
   gogLens.transparent=true;gogLens.opacity=.9;gogLens.emissive.set('#163044');gogLens.emissiveIntensity=.4;
   for(const side of [-1,1]){
    box('helmet:goggleFrame',[.07,.06,.072],gogFrame,[.10,.02,side*.05]);
    box('helmet:goggleLens',[.052,.044,.058],gogLens,[.136,.02,side*.05]);
   }
   box('helmet:goggleBridge',[.042,.024,.042],gogFrame,[.112,.022,0]);
   for(const side of [-1,1])tube('helmet:goggleStrap',[[.05,.032,side*.11],[-.02,.05,side*.125],[-.10,.045,side*.10],[-.12,.02,0]],.012,gogStrap);
   tube('helmet:chinbar',[[.005,-.065,-.091],[.10,-.074,-.069],[.139,-.064,0],[.10,-.074,.069],[.005,-.065,.091]],.016,paint);
   for(const side of [-1,1]){tube('helmet:cheekTrim',[[.01,-.08,side*.087],[.075,-.02,side*.089],[.064,.065,side*.087]],.004,accent);box('helmet:chinVent',[.026,.013,.035],dark,[.138,-.06,side*.027]);}
  }
  if(!street){const shape=new T.Shape();shape.moveTo(0,-.095);shape.quadraticCurveTo(.15,-.12,.22,-.07);shape.quadraticCurveTo(.25,0,.22,.07);shape.quadraticCurveTo(.15,.12,0,.095);shape.quadraticCurveTo(.045,0,0,-.095);const geo=new T.ExtrudeGeometry(shape,{depth:.005,bevelEnabled:true,bevelSize:.002,bevelThickness:.001,bevelSegments:3,curveSegments:18});const attr=geo.attributes.position;for(let i=0;i<attr.count;i++)attr.setZ(i,attr.getZ(i)+Math.max(0,attr.getX(i)-.07)*.08);geo.computeVertexNormals();const peak=mesh('helmet:peak',geo,paint,[0,.09,0]);peak.rotation.x=Math.PI/2;peak.scale.x=(mx||p.style==='mtb')?1.15:.9;peak.scale.y=1.15;}

  for(const side of [-1,1]){const bolt=cylinder('helmet:visorBolt',.006,.006,silver,[.018,.027,side*.115]);bolt.rotation.x=Math.PI/2;box('helmet:vent',[.047,.009,.015],dark,[-.014,.120,side*.038]);tube('helmet:themeStripe',[[-.065,.06,side*.082],[-.014,.102,side*.067],[.041,.095,side*.070]],.005,accent);tube('helmet:strap',[[.01,-.045,side*.10],[.015,-.13,side*.04],[.08,-.10,side*.04]],.004,dark);}
   g.scale.setScalar(1.16);
 }else if(p.slot==='gloves'){
  box('glove:palm',[.065,.025,.067],primary);
  for(let i=0;i<4;i++){const z=(i-1.5)*.016;tube('glove:finger',[[.024,0,z],[.044,-.006,z],[.047,-.021,z],[.033,-.027,z]],.007,primary);mesh('glove:knuckle',new T.SphereGeometry(.010,12,8),p.style==='armoured'?dark:accent,[.022,.015,z]).scale.y=.45;}
  tube('glove:thumb',[[-.015,-.005,.027],[.006,-.012,.047],[.026,-.02,.036]],.010,primary);box('glove:wrist',[.025,.027,.061],dark,[-.043,0,0]);box('glove:strap',[.014,.006,.064],accent,[-.043,.018,0]);
 }else if(p.slot==='shoes'){
  for(const side of single?[0]:[-1,1]){const shoe=new T.Group();shoe.position.set(single?0:side*.035,0,side*.075);g.add(shoe);const boot=p.style==='boot';
   box('shoe:sole',[.175,.017,.082],material('#d7dfe2'),[.035,-.044,0],shoe);box('shoe:tread',[.171,.007,.079],dark,[.035,-.055,0],shoe);
   const upper=mesh('shoe:upper',new T.CapsuleGeometry(.033,.094,6,20),primary,[.035,-.013,0],shoe);upper.rotation.z=Math.PI/2;upper.scale.z=1.05;
   box('shoe:tongue',[.072,.009,.043],primary,[.013,.016,0],shoe);box('shoe:heel',[.012,.035,.066],accent,[-.045,-.020,0],shoe);
   if(boot){
    box('shoe:ankle',[.07,.12,.08],primary,[-.018,.04,0],shoe);
    box('shoe:shin',[.06,.07,.078],primary,[-.02,.11,0],shoe);
    for(const y of [.02,.055,.09])box('shoe:buckle',[.04,.01,.086],accent,[-.01,y,0],shoe);
   }
   box('shoe:toe',[.035,.026,.074],dark,[.107,-.026,0],shoe);
   if(!boot){const lace=fabric();for(let i=0;i<5;i++){const x=-.018+i*.017;tube('shoe:lace',[[x,.024+i*.001,-.022],[x+.012,.026+i*.001,.022]],.002,lace,shoe);}}
   for(const z of [-.037,.037])tube('shoe:soleSeam',[[-.037,-.036,z],[.02,-.034,z],[.10,-.036,z]],.0015,accent,shoe);
   for(const z of [-.037,.037]){const stripe=box('shoe:stripe',[.056,.012,.004],accent,[.025,-.004,z],shoe);stripe.rotation.z=.45;}
  }
 }else if(p.slot==='top'){
  const torso=new T.CapsuleGeometry(.135,.22,8,28);torso.scale(.75,1,1);mesh('top:body',torso,primary,[0,.25,0]);
  for(const side of [-1,1]){const sleeve=mesh('top:sleeve',new T.CapsuleGeometry(.05,p.style==='tee'?.07:.27,6,20),primary,[.015,.26,side*.20]);sleeve.rotation.x=side*.20;box('top:cuff',[.07,.04,.07],accent,[.015,.08,side*.23]);}
  if(p.style==='hoodie'){
   mesh('top:hood',new T.TorusGeometry(.082,.035,12,32),primary,[0,.46,0]).rotation.x=Math.PI/2;
   box('top:kangarooPocket',[.014,.075,.15],primary,[.101,.17,0]);
   for(const side of [-1,1]){tube('top:pocketOpening',[[.111,.195,side*.065],[.114,.17,side*.043]],.0025,accent);const cord=fabric();tube('top:drawcord',[[.065,.44,side*.035],[.103,.37,side*.028],[.108,.32,side*.033]],.0025,cord);}
  }
  box('top:chest',[.006,.06,.08],accent,[.106,.28,0]);
  const hem=mesh('top:hem',new T.TorusGeometry(.106,.009,8,28),accent,[0,.10,0]);hem.rotation.x=Math.PI/2;hem.scale.x=.84;
 }else if(p.slot==='pants'){
  box('pants:waist',[.17,.12,.22],primary,[0,.57,0]);for(const side of [-1,1]){const leg=mesh('pants:leg',new T.CapsuleGeometry(.061,p.style==='shorts'?.16:.43,8,24),primary,[0,p.style==='shorts'?.42:.28,side*.073]);if(p.style==='cargo')box('pants:pocket',[.035,.10,.075],accent,[.047,.43,side*.099]);}
 }else if(p.slot==='accessory'){
  box('pack:body',[.14,.29,.22],primary);box('pack:pocket',[.035,.12,.18],accent,[-.08,-.055,0]);for(const side of [-1,1])tube('pack:strap',[[.04,.12,side*.065],[.12,.1,side*.085],[.12,-.10,side*.085],[.04,-.12,side*.065]],.011,dark);
 }else if(p.slot==='display'){
  const podium=p.style==='podium',lift=p.style==='lift',wall=p.style==='wall';
  if(podium){cylinder('display:podium',.7,.08,dark,[0,.04,0]);const ring=mesh('display:light',new T.TorusGeometry(.7,.014,10,64),accent,[0,.08,0]);ring.rotation.x=Math.PI/2;ring.material.emissive.set(p.accent);ring.material.emissiveIntensity=.9;}
  else if(lift){box('display:base',[.7,.04,.5],dark,[0,.02,0]);box('display:top',[.75,.05,.53],primary,[0,.36,0]);for(const side of [-1,1]){const beam=box('display:scissor',[.60,.035,.025],silver,[0,.19,side*.19]);beam.rotation.z=side*.55;}}
  else if(wall){box('display:wallPlate',[.03,.28,.2],dark);box('display:arm',[.28,.03,.08],primary,[.14,0,0]);}
  else{box('display:base',[.7,.035,p.style==='rack'?.6:.23],dark,[0,.02,0]);for(const z of p.style==='rack'?[-.2,.2]:[0]){const loop=mesh('display:cradle',new T.TorusGeometry(.14,.014,10,32,Math.PI),primary,[.03,.12,z]);loop.rotation.y=Math.PI/2;}if(p.style==='deck')box('display:deckPad',[.36,.035,.17],accent,[0,.18,0]);}
 }
 return g;
}
