// Photo-based TRAX bike. Proportions/specifications are visual estimates, not a manufacturer drawing.
import * as PM from './partmodels.js';
export const TRAX_ID = 'trax_lime';
export const TRAX_STOCK = {suspension:'trax_fork',shock:'trax_coil',bars:'trax_bars',grips:'grip_std',seat:'trax_saddle',rims:'trax_rims',tyres:'trax_tyres',brakes:'rim',cranks:'crank_steel',chain:'chain_std',sprocket_f:'trax_38',sprocket_r:'trax_16'};
const lime='#d2ed21';
const liveryCache=new Map();
export const TRAX_RADIUS=.255;
const SCALE=TRAX_RADIUS/.315;
export const traxGeometry=(R=TRAX_RADIUS)=>({rear:[-.41*SCALE,R],bb:[0,R+.025*SCALE],seat:[-.16*SCALE,.73*SCALE],htT:[.47*SCALE,.77*SCALE],htB:[.51*SCALE,.63*SCALE],front:[.67*SCALE,R],tr:.022*SCALE});
export const TRAX_PARTS = [
 {id:TRAX_ID,slot:'frame',name:'TRAX Lime Dual-Suspension Bike',real:false,kg:5.8,price:1200,maxW:500,fc:0xd2ed21,stock:TRAX_STOCK,note:'Your lime/black bike: Y-frame, pivoting rear triangle, near-horizontal coil shock, lime fork/rims and tall quill bars. Selecting it installs the matching stock build. Dimensions, weight and fitment are photo-based estimates.'},
 {id:'trax_fork',slot:'suspension',name:'TRAX Lime Suspension Fork',real:false,travel:.06,damp:.25,kg:1.8,price:0,color:lime,note:'Matching single-crown fork with lime lowers and silver stanchions. Estimated 60mm travel.'},
 {id:'trax_coil',slot:'shock',name:'TRAX Lime Coil Shock',real:false,travel:.06,kg:.65,price:0,color:lime,note:'Matching short coil-over with lime spring, mounted under the top tube. Travel estimated from the photo.'},
 {id:'trax_bars',slot:'bars',name:'TRAX Tall Quill Bars',real:false,rise:.055,kg:.75,price:0,color:'#17191b',note:'High chrome quill stem, swept black bars, black grips and brake levers.'},
 {id:'trax_saddle',slot:'seat',name:'TRAX Black Saddle',real:false,sx:1.12,kg:.42,price:0,color:'#151719',note:'Rounded black saddle on a black seatpost.'},
 {id:'trax_rims',slot:'rims',name:'TRAX Lime Rims',real:false,kg:1.9,price:0,color:lime,note:'Lime painted hoops, black spokes and amber spoke reflectors.'},
 {id:'trax_tyres',slot:'tyres',name:'TRAX Knobbly Tyres 20-inch',real:false,size:'20',grip:1,kg:1.4,price:0,note:'Black knobbly 20-inch tyres, wheel size confirmed by Chris.'},
 {id:'trax_38',slot:'sprocket_f',name:'TRAX Black 38T Chainwheel',real:false,teeth:38,std:'bicycle',kg:.4,price:0,color:'#202225',note:'Photo-matched black single chainwheel and outer chainguard. Tooth count estimated.'},
 {id:'trax_16',slot:'sprocket_r',name:'TRAX 16T Freewheel',real:false,teeth:16,std:'bicycle',kg:.18,price:0,color:'#333333',note:'Single rear bicycle sprocket; estimated tooth count.'},
];
globalThis.__WK_EXTRA_CATALOG__ = TRAX_PARTS;
// Minimal stock skeleton passed through the same garage build hook for shop previews.
export function traxPreview(T) {
 const root=new T.Group(),x=traxGeometry(),R=TRAX_RADIUS;
 const groups={};for(const name of ['frame','tyres','motor','drive','suspension','cockpit','seat','brakes']){const g=new T.Group();g.name='wk:'+name;groups[name]=g;root.add(g)}
 const material=c=>new T.MeshStandardMaterial({color:c,roughness:.5});
 groups.frame.add(new T.Mesh(new T.BoxGeometry(.01,.01,.01),material(lime)));
 for(const axle of [x.rear,x.front]) {
  const w=new T.Group();w.position.set(...axle,0);groups.tyres.add(w);
  w.add(new T.Mesh(new T.TorusGeometry(R-.028,.028,16,72),material('#191b1d')));
  w.add(new T.Mesh(new T.TorusGeometry(R-.060,.009,8,72),material(lime)));
  w.add(new T.InstancedMesh(new T.CylinderGeometry(.0013,.0013,1,5),material('#27292b'),36));
  const knobs=new T.InstancedMesh(new T.BoxGeometry(.014,.012,.04),material('#191b1d'),64),ob=new T.Object3D();
  for(let i=0;i<64;i++){const a=i/64*Math.PI*2;ob.position.set(Math.cos(a)*R,Math.sin(a)*R,i%2?.006:-.006);ob.rotation.z=a;ob.updateMatrix();knobs.setMatrixAt(i,ob.matrix)}w.add(knobs);
 }
 const saddle=new T.Mesh(new T.SphereGeometry(.1,24,12),material('#151719'));saddle.scale.set(1.5,.32,.65);saddle.position.set(x.seat[0]-.02,x.seat[1]+.09,0);groups.seat.add(saddle);
 const post=new T.Mesh(new T.CylinderGeometry(.0135,.0135,.1,20),material('#151719'));post.position.set(x.seat[0],x.seat[1]+.04,0);groups.seat.add(post);
 for(const s of [-1,1]){const crank=new T.Mesh(new T.BoxGeometry(.02,.15,.016),material('#26282a'));crank.position.set(x.bb[0],x.bb[1]+s*.065,s*.065);groups.drive.add(crank)}
 globalThis.__WK_BUILD_HOOK__?.(root,{x,R,b:{frame:TRAX_ID,...TRAX_STOCK}},T);
 return root;
}
export function traxAnchors(x) {
 return {shockFrame:[x.htT[0]-.23*SCALE,x.htT[1]-.065*SCALE],shockArm:[x.seat[0]+.04*SCALE,x.seat[1]-.09*SCALE]};
}

export function buildTraxFrame(fr,x,T,paint,sweep) {
 fr.clear();
 const mat=(c,metalness=.4)=>new T.MeshStandardMaterial({color:c,metalness,roughness:.38});
 const black=mat('#171b1e'), green=mat(lime), metal=mat('#93999b',.9);
 const mesh=(name,geo,p,m=green)=>{const o=new T.Mesh(geo,m.clone());o.name=name;if(p)o.position.set(...p);o.castShadow=o.receiveShadow=true;fr.add(o);return o};
 const v=p=>new T.Vector3(p[0],p[1],p[2]||0);
 const tube=(name,pts,r,m=green,start,end)=>{const a=sweep(T,pts,r*SCALE,m,name,start,end);fr.add(a);return a.getObjectByName(name)};
 const shell=(name,a,b,r,m=green)=>{const d=v(b).sub(v(a));const o=mesh(name,new T.CylinderGeometry(r*SCALE,r*SCALE,d.length(),32),v(a).add(v(b)).multiplyScalar(.5).toArray(),m);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o};
 const {bb,seat,htT,htB,rear}=x, A=traxAnchors(x), pivot=[bb[0]+.01*SCALE,bb[1]+.095*SCALE];
 const head={point:[...htB,0],axis:v(htT).sub(v(htB)).toArray(),radius:.029*SCALE};
 const bottom={point:[...bb,0],axis:[0,0,1],radius:.033*SCALE};
 const seatReceiver={point:[...bb,0],axis:v(seat).sub(v(bb)).toArray(),radius:.028*SCALE};
 shell('frame:headTube',htB,htT,.029);
 const headDir=v(htT).sub(v(htB)).normalize();
 for(const [p,s] of [[htB,-1],[htT,1]])shell(s<0?'frame:lowerCup':'frame:upperCup',v(p).addScaledVector(headDir,s*.002).toArray(),v(p).addScaledVector(headDir,s*.012).toArray(),.033,black);
 shell('frame:bbShell',[bb[0],bb[1],-.05*SCALE],[bb[0],bb[1],.05*SCALE],.033,black);
 tube('frame:seatTube',[bb,v(bb).lerp(v(seat),.5).toArray(),seat],.028,black,bottom);
 shell('frame:seatCollar',v(seat).lerp(v(bb),.05).toArray(),seat,.031,black);
 const topStart=v(htT).lerp(v(htB),.18).toArray(),topEnd=v(seat).lerp(v(bb),.05).toArray();
 const top=tube('frame:topTube',[topStart,[(topStart[0]+seat[0])/2,seat[1]+.005],topEnd],.025,green,head,seatReceiver);
 const down=tube('frame:downTube',[v(htB).lerp(v(htT),.25).toArray(),[.22*SCALE,bb[1]+.17*SCALE],bb],.027,green,head,bottom);
 if(typeof document!=='undefined') {
   // Original lettering only; no traced brand logo. Speckled fade is generated deterministically.
   for(const [o,label] of [[top,'DUAL SUSPENSION'],[down,'TRAX']]) {
    if(liveryCache.has(label)){o.material.map=liveryCache.get(label);o.material.needsUpdate=true;continue;}
    const c=document.createElement('canvas');c.width=1024;c.height=256;const cx=c.getContext('2d');cx.fillStyle=lime;cx.fillRect(0,0,1024,256);
    let seed=731;const rnd=()=>((seed=seed*16807%2147483647)/2147483647);
    cx.fillStyle='#171b1e';cx.fillRect(760,0,264,256);
    for(let i=0;i<10000;i++){const px=rnd()*1024,py=rnd()*256;if(rnd()<Math.max(0,(px/1024-.42)*2)){cx.fillStyle='#171b1e';cx.fillRect(px,py,2+rnd()*6,1+rnd()*4)}}
    cx.fillStyle='#14181a';cx.font=label==='TRAX'?'bold italic 72px Arial':'bold 22px Arial';cx.textAlign='center';cx.textBaseline='middle';
    const path=new T.CatmullRomCurve3(o.geometry.userData.wkTube.points.map(p=>new T.Vector3(...p))),frames=path.computeFrenetFrames(48,false);
    for(const side of [-1,1]) {
      const angle=Math.atan2(frames.binormals[24].z*side,frames.normals[24].z*side),v=((angle/(Math.PI*2))%1+1)%1,cy=(1-v)*256;
      for(const offset of [-256,0,256]) {cx.save();cx.translate(410,cy+offset);if(label==='TRAX'){cx.scale(-1,1);if(side<0)cx.rotate(Math.PI);}else if(side>0)cx.rotate(Math.PI);cx.fillText(label,0,0);cx.restore();}
    }
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;liveryCache.set(label,tex);o.material.map=tex;o.material.needsUpdate=true;
   }
 }
 // The photograph's defining Y rear triangle: a floating seat tower above the swing pivot.
 shell('frame:swingPivot',[pivot[0],pivot[1],-.075*SCALE],[pivot[0],pivot[1],.075*SCALE],.022,black);
 for(const s of [-1,1]) {
  const z=s*.065*SCALE;
  tube('frame:swingLower'+s,[[pivot[0],pivot[1],z],[rear[0]+.14*SCALE,rear[1]-.015*SCALE,z],[rear[0],rear[1],z]],.018);
  const tower=[A.shockArm[0],A.shockArm[1]-.025*SCALE,z];
  tube('frame:swingUpper'+s,[[rear[0],rear[1],z],[rear[0]+.1*SCALE,rear[1]+.09*SCALE,z],tower,[pivot[0],pivot[1],z]],.017);
  mesh('frame:dropout'+(s<0?'L':'R'),new T.BoxGeometry(.045*SCALE,.04*SCALE,.009*SCALE),[rear[0],rear[1],z],green);
  const bolt=mesh('frame:pivotBolt'+s,new T.CylinderGeometry(.012*SCALE,.012*SCALE,.01*SCALE,6),[pivot[0],pivot[1],s*.079*SCALE],metal);bolt.rotation.x=Math.PI/2;
  shell('frame:shockMount'+s,[A.shockFrame[0],A.shockFrame[1]+.04*SCALE,s*.015],[A.shockFrame[0],A.shockFrame[1],s*.015],.009,black);
  shell('frame:rearShockMount'+s,[...A.shockArm,s*.015],[tower[0],tower[1],s*.015],.009,black);
 }
}

export function finishTrax(root,A,b,T,g,slotGroup) {
 if(b.frame!==TRAX_ID)return;
 PM.useThree(T);
 const add=(G,name,geo,mat,p)=>{const o=new T.Mesh(geo,mat);o.name=name;if(p)o.position.set(...p);o.castShadow=true;G.add(o);return o};
 const mat=(color,metalness=.5)=>new T.MeshStandardMaterial({color,metalness,roughness:.4});
 const line=(G,name,pts,r,color)=>add(G,name,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),32,r,8),mat(color),null);
 // Every matching part remains in its normal slot; swapping it removes this decoration.
 if(b.rims==='trax_rims')for(const slot of ['tyres','motor'])g(slot)?.traverse(w=>{
  if(!w.isGroup)return;const rim=w.children.find(o=>o.geometry?.type==='TorusGeometry'&&Math.abs(o.geometry.parameters.tube-.009)<1e-5);if(!rim)return;
  const hoop=new T.MeshStandardMaterial({color:lime,metalness:.55,roughness:.32});rim.material=hoop;
  w.children.filter(o=>o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.openEnded).forEach(o=>o.material=hoop.clone());
  const spokes=w.getObjectByName('wheel:spokes');if(spokes)spokes.material=mat('#202326',.8);
  for(const side of [-1,1]){const a=-.95,r=rim.geometry.parameters.radius*.70;const refl=add(w,'trax:spokeReflector'+side,new T.BoxGeometry(.075,.014,.006),new T.MeshPhysicalMaterial({color:'#ff9f12',roughness:.25,clearcoat:1,emissive:'#7e3800',emissiveIntensity:.15}),[Math.cos(a)*r,Math.sin(a)*r,side*.014]);refl.rotation.z=a+Math.PI/2;}
 });
 if(!b.shock) {const group=slotGroup('shock');group.userData.mount='trax:stockShock';group.add(PM.shock(TRAX_PARTS.find(p=>p.id==='trax_coil'),A.shockFrame,A.shockArm));}
 if(b.suspension==='trax_fork'||!b.suspension)g('suspension')?.traverse(o=>{if(o.isMesh&&/fork:lower/.test(o.name)){o.material=o.material.clone();o.material.color.set(lime)}});
 if(b.seat==='trax_saddle'||!b.seat)g('seat')?.traverse(o=>{if(o.isMesh&&o.geometry?.type==='CylinderGeometry'){o.material=o.material.clone();o.material.color.set('#151719')}});
 if(b.bars==='trax_bars'||!b.bars) {
  const cp=g('cockpit');if(cp){
   const clamp=[A.headTop[0]+.025,A.headTop[1]+.17];
   cp.clear();const bars=PM.bars({rise:.055,sweep:.045,width:.28,color:'#181b1d',gripColor:'#181818'},clamp);bars.name='wk:model:bars';cp.add(bars);
   line(cp,'trax:quillStem',[[A.headTop[0],A.headTop[1],0],[A.headTop[0]-.02,A.headTop[1]+.145,0],[clamp[0],clamp[1],0]],.013,'#aeb6bd');
   for(const s of [-1,1]){
    line(cp,'trax:brakeLever'+s,[[clamp[0]-.02,clamp[1]+.055,s*.21],[clamp[0]+.06,clamp[1]+.035,s*.23]],.005,'#121517');
    line(cp,'trax:brakeCable'+s,[[clamp[0]+.04,clamp[1]+.04,s*.22],[A.headTop[0]+.12,A.headTop[1]+.03,s*.13],[A.headBottom[0]+.08,A.headBottom[1]-.08,s*.07],[A.frontAxle[0],A.frontAxle[1]+A.wheelR-.03,s*.05]],.0025,'#121517');
   }
  }
 }
 if(b.sprocket_f==='trax_38'||!b.sprocket_f) {
  const guard=add(g('drive'),'trax:chainGuard',new T.RingGeometry(PM.sprocketR(38)-.008,PM.sprocketR(38)+.008,64),mat('#171a1d',.1),[A.bb[0],A.bb[1],.066]);guard.material.side=T.DoubleSide;
 }
}
