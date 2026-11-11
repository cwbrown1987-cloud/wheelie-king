// Mechanical display rig shared by the garage test bench and ride renderer.
import * as T from './vendor/three.module.js';
import * as PM from './partmodels.js';
import {setTraxShockPose} from './trax-suspension.js';
import {canonicalBuild} from './modular-catalogue.js';
const springOwners=new WeakMap();

// Outer tangents of a closed, counter-clockwise sequence of sprockets/pulleys.
export function chainRoute(circles) {
 const normals=circles.map((c,i)=>{const n=circles[(i+1)%circles.length],dx=n.x-c.x,dy=n.y-c.y,L=Math.hypot(dx,dy);return Math.atan2(dy,dx)-Math.acos(Math.max(-.999,Math.min(.999,(c.r-n.r)/L)));});
 const points=[];
 circles.forEach((c,i)=>{const a=normals[(i+circles.length-1)%circles.length],b=normals[i],sweep=((b-a)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
  for(let j=0;j<=18;j++){const angle=a+sweep*j/18;points.push([c.x+Math.cos(angle)*c.r,c.y+Math.sin(angle)*c.r]);}
 });return points;
}

export function createBikeMotion(root,build={},find=()=>null) {
 build=canonicalBuild(build);
 const A=root.userData.wkAnchors;if(!A)return null;
 PM.useThree(T);
 const wheels=[],seen=new Set();
 const still=/hub:(axle|axleNut|endCap|cable)|fork:|swingarm:|caliper|fender|mudguard|hose/i;
 const isWheel=w=>{
  if(!w?.isGroup||seen.has(w.uuid))return false;
  if(w.userData?.wkWheel)return true;
  if(w.children.some(o=>o.name==='wheel:spokes'))return true;
  if(!/wk:(tyres|motor)/.test(w.parent?.name||''))return false;
  let torus=false;w.traverse(o=>{if(o.geometry?.type==='TorusGeometry'&&(o.geometry.parameters?.tube||0)>.006)torus=true});
  return torus;
 };
 root.traverse(w=>{
  if(!isWheel(w))return;
  let p=w.parent;while(p){if(seen.has(p.uuid))return;p=p.parent;}
  seen.add(w.uuid);wheels.push(w);
 });
 const rotors=[];
 for(const w of wheels) {
  const meshParts=[];
  const take=o=>{if(!o||meshParts.includes(o)||still.test(o.name||''))return;if(o.geometry||o.isInstancedMesh)meshParts.push(o)};
  for(const o of w.children){
   const gp=o.geometry?.parameters;
   // Axles, axle nuts and motor exit cable remain stationary within the moving wheel.
   if(o.name==='wk:model:hub') o.traverse(child=>{if(child!==o)take(child)});
   else if(!(gp&&o.geometry?.type==='CylinderGeometry'&&gp.radiusTop<=.012&&!o.isInstancedMesh)){
    if(o.isGroup)o.traverse(child=>take(child));
    else take(o);
   }
  }
  w.traverse(o=>{if(o!==w&&(o.name==='wheel:spokes'||o.isInstancedMesh||(o.geometry?.type==='TorusGeometry'&&(o.geometry.parameters?.tube||0)>.006)))take(o)});
  rotors.push({wheel:w,front:Math.abs(w.position.x-A.frontAxle[0])<.05,base:w.position.clone(),parts:meshParts.map(o=>{o.updateMatrix();return {o,base:o.matrix.clone()}})});
 }
 const rear=root.getObjectByName('wk:model:rearFrame'),shock=root.getObjectByName('wk:model:shock');
 const spring=shock?.getObjectByName('shock:spring');
 if(build.shock==='trax_coil'&&spring){const owner=springOwners.get(spring.geometry);if(owner&&owner!==spring)spring.geometry=spring.geometry.clone();springOwners.set(spring.geometry,spring);}
 const crank=root.getObjectByName('cranks:rotor'),pedals=[];root.traverse(o=>{if(o.userData.wkPedal)pedals.push(o)});
 const front=root.getObjectByName('sprocketF')||root.getObjectByName('mid:chainring')||root.getObjectByName('motoMid:sprocket'),back=root.getObjectByName('sprocketR'),chain=root.getObjectByName('wk:model:chain'),guard=root.getObjectByName('trax:chainGuard');
 const motor=find(build.motor),fp=find(build.sprocket_f),rp=find(build.sprocket_r),frontN=fp?.teeth||(motor?.nopedal?14:motor?.kind==='mid'?44:25),rearN=rp?.teeth||(motor?.nopedal?48:motor?.kind==='mid'?18:9),rF=PM.sprocketR(frontN)+.004,rR=PM.sprocketR(rearN)+.004;
 const fork=root.getObjectByName('wk:model:fork'),lowers=[];
 fork?.traverse(o=>{if(o.userData.wkForkMoving??/fork:(lower|arch|dropout)/.test(o.name)){o.userData.wkForkRestPosition??=o.position.toArray();lowers.push({o,base:new T.Vector3(...o.userData.wkForkRestPosition)})}});
 const forkDirection=fork?.userData.wkFork?new T.Vector3(...fork.userData.wkFork.axis):new T.Vector3(A.headBottom[0]-A.frontAxle[0],A.headBottom[1]-A.frontAxle[1],0).normalize();
 // Capture mount transforms once. Wheel-mounted discs turn; calipers and
 // axle hardware follow their fork/swingarm without turning with the wheel.
 root.updateMatrixWorld(true);
 const attachments=[];
 const capture=(o,mount,spin=false)=>{o.updateMatrix();attachments.push({o,mount,spin,base:o.matrix.clone()})};
 for(const o of root.getObjectByName('wk:brakes')?.children||[]){
  const center=o.parent.worldToLocal(new T.Box3().setFromObject(o).getCenter(new T.Vector3()));
  capture(o,Math.abs(center.x-A.frontAxle[0])<Math.abs(center.x-A.rearAxle[0])?'front':'rear',/^brake:rotor(?:Bolts)?$/.test(o.name));
 }
 const frontFender=root.getObjectByName('wk:part:fender_f');
 if(frontFender?.userData.mount==='frontAxle')capture(frontFender,'front');
 const rearFender=root.getObjectByName('wk:part:fender_r');
 if(rearFender)capture(rearFender,'rear');
 const axleBolts=root.getObjectByName('frame:rearAxleBolts');
 if(axleBolts)capture(axleBolts,'rear');
 const bars=root.getObjectByName('wk:model:bars'),stem=root.getObjectByName('wk:model:stem');
 const steerParts=[fork,bars,stem].filter(Boolean);
 for(const o of steerParts){o.updateMatrix();o.userData.wkSteerBase??=o.matrix.clone();}
 const steerAxis=new T.Vector3(),steerPivot=new T.Vector3(),steerM=new T.Matrix4(),steerQ=new T.Quaternion();
 const forkTravel=Math.max(0,find(build.suspension)?.travel||0);
 let wheelPhase=0,rearWheelPhase=0,crankPhase=0,chainPhase=0,lastKey='',route=null;
 const matrix=new T.Matrix4(),p=A.swingPivot,_s=new T.Vector3(),_b=new T.Vector3(),_c=new T.Vector3(),_n=new T.Vector3(),_up=new T.Vector3(0,1,0),_shift=new T.Vector3(),_q0=new T.Quaternion(),_q1=new T.Quaternion(),_m1=new T.Matrix4(),_m2=new T.Matrix4(),_m3=new T.Matrix4(),_m4=new T.Matrix4(),_t=new T.Matrix4();let jockeyNodes=null;
 const rotate=(point,angle)=>{const dx=point[0]-p[0],dy=point[1]-p[1];return [p[0]+Math.cos(angle)*dx-Math.sin(angle)*dy,p[1]+Math.sin(angle)*dx+Math.cos(angle)*dy]};
 const state={wheelPhase:0,rearWheelPhase:0,crankPhase:0,chainPhase:0,rearAngle:0,rearAxle:[...A.rearAxle],shockArm:[...A.shockArm],frontAxle:[...A.frontAxle],rotors:rotors.length,rotorParts:rotors.reduce((n,e)=>n+e.parts.length,0)};
 const update=({distance=0,frontDistance=distance,rearDistance=distance,driveDistance=distance,rearCompression=0,frontCompression=0,travelR=.045,travelF=.06,steerAngle=0,frontAngle,rearAngle}={})=>{
  wheelPhase=(frontAngle!=null&&Number.isFinite(frontAngle))?frontAngle:(wheelPhase-frontDistance/A.wheelR);
  rearWheelPhase=(rearAngle!=null&&Number.isFinite(rearAngle))?rearAngle:(rearWheelPhase-rearDistance/A.wheelR);
  const angular=-driveDistance/A.wheelR*(rearN/frontN);crankPhase+=angular;chainPhase+=angular*rF;
  let ra=[...A.rearAxle],sa=[...A.shockArm],angle=0;
  if(rear&&p){
   const dx=A.rearAxle[0]-p[0],dy=A.rearAxle[1]-p[1],L=Math.hypot(dx,dy),targetY=A.rearAxle[1]+Math.min(.06,travelR)*.8*Math.max(0,Math.min(1,rearCompression));
   const goal=Math.PI-Math.asin(Math.max(-.99,Math.min(.99,(targetY-p[1])/L))),base=Math.atan2(dy,dx);
   angle=Math.atan2(Math.sin(goal-base),Math.cos(goal-base));rear.rotation.z=angle;ra=rotate(A.rearAxle,angle);sa=rotate(A.shockArm,angle);
   if(build.shock==='trax_coil'&&shock)setTraxShockPose(T,shock,A.shockFrame,sa);
   else if(shock&&build.shock){const start=_s.set(A.shockFrame[0],A.shockFrame[1],0),base=_b.set(A.shockArm[0],A.shockArm[1],0).sub(start),current=_c.set(sa[0],sa[1],0).sub(start),q0=_q0.setFromUnitVectors(_up,_n.copy(base).normalize()),q1=_q1.setFromUnitVectors(_up,_n.copy(current).normalize());shock.matrixAutoUpdate=false;shock.matrix.makeTranslation(start.x,start.y,start.z).multiply(_m1.makeRotationFromQuaternion(q1)).multiply(_m2.makeScale(1,current.length()/base.length(),1)).multiply(_m3.makeRotationFromQuaternion(q0.invert())).multiply(_m4.makeTranslation(-start.x,-start.y,-start.z));shock.matrixWorldNeedsUpdate=true;}
  }
  const shift=_shift.copy(forkDirection).multiplyScalar(Math.max(0,Math.min(1,frontCompression))*Math.min(forkTravel,Math.max(0,travelF))*.8),fa=[A.frontAxle[0]+shift.x,A.frontAxle[1]+shift.y];
  for(const entry of rotors){entry.wheel.position.set(...(entry.front?fa:ra),entry.base.z);matrix.makeRotationZ(entry.front?wheelPhase:rearWheelPhase);for(const {o,base} of entry.parts){o.matrixAutoUpdate=false;o.matrix.copy(matrix).multiply(base);o.matrixWorldNeedsUpdate=true;}}
  for(const {o,base} of lowers)o.position.copy(base).add(shift);
  for(const {o,mount,spin,base} of attachments){
   const axle=mount==='front'?A.frontAxle:A.rearAxle,target=mount==='front'?fa:ra;
   const transform=_t;
   if(spin)transform.makeTranslation(target[0],target[1],0).multiply(_m1.makeRotationZ(mount==='front'?wheelPhase:rearWheelPhase)).multiply(_m2.makeTranslation(-axle[0],-axle[1],0));
   else if(mount==='rear'&&rear&&p)transform.makeTranslation(p[0],p[1],0).multiply(_m1.makeRotationZ(angle)).multiply(_m2.makeTranslation(-p[0],-p[1],0));
   else transform.makeTranslation(target[0]-axle[0],target[1]-axle[1],0);
   o.matrixAutoUpdate=false;o.matrix.copy(transform).multiply(base);o.matrixWorldNeedsUpdate=true;
  }
  if(crank)crank.rotation.z=crankPhase;for(const pedal of pedals){if(pedal.parent===crank)pedal.rotation.z=-crankPhase;else{const side=pedal.userData.wkPedalSide;pedal.position.set(A.bb[0]+Math.cos(crankPhase)*side*.14,A.bb[1]+Math.sin(crankPhase)*side*.14,side*.12);pedal.rotation.z=0;}}
  if(front)front.rotation.z=crankPhase;
  if(guard)guard.rotation.z=crankPhase;
  if(back){back.position.set(ra[0],ra[1],back.position.z);back.rotation.z=crankPhase*frontN/rearN;}
  const jockeys=rear?.userData.jockeys?[rotate([A.rearAxle[0]-.018,A.rearAxle[1]-.05],angle),rotate([A.rearAxle[0]+.028,A.rearAxle[1]-.12],angle)]:[];
  if(chain){const key=ra.map(v=>v.toFixed(5)).join(',')+':'+angle.toFixed(5);if(key!==lastKey||!route){route=chainRoute([{x:ra[0],y:ra[1],r:rR},...jockeys.map(c=>({x:c[0],y:c[1],r:PM.sprocketR(8)+.004})),{x:A.bb[0],y:A.bb[1],r:rF}]);lastKey=key;}PM.animateChain(chain,route,chainPhase);}
  if(rear){if(!jockeyNodes){jockeyNodes=[];rear.traverse(o=>{if(/^derailleur:jockey\d$/.test(o.name))jockeyNodes.push(o)})}const jr=chainPhase/(PM.sprocketR(8)+.004);for(const o of jockeyNodes)o.rotation.z=jr}
  const ht=A.headTop,hb=A.headBottom||ht;
  if(ht){steerPivot.set(hb[0],hb[1],0);steerAxis.set(ht[0]-hb[0],ht[1]-hb[1],0);if(steerAxis.lengthSq()<1e-8)steerAxis.copy(forkDirection);else steerAxis.normalize();}
  else{steerAxis.copy(forkDirection);steerPivot.set(A.frontAxle[0],A.frontAxle[1],0);}
  // Right-hand rotation around an upward steerer would swing the wheel left, so flip the visual angle.
  const steer=-(steerAngle||0);
  steerQ.setFromAxisAngle(steerAxis,steer);
  steerM.makeTranslation(steerPivot.x,steerPivot.y,steerPivot.z).multiply(_m1.makeRotationFromQuaternion(steerQ)).multiply(_m2.makeTranslation(-steerPivot.x,-steerPivot.y,-steerPivot.z));
  for(const o of steerParts){o.matrixAutoUpdate=false;o.matrix.copy(steerM).multiply(o.userData.wkSteerBase);o.matrixWorldNeedsUpdate=true;}
  for(const entry of rotors){if(!entry.front){entry.wheel.quaternion.identity();continue;}entry.wheel.position.applyMatrix4(steerM);entry.wheel.quaternion.copy(steerQ);}
  for(const att of attachments){if(att.mount==='front'){att.o.matrix.premultiply(steerM);}}
  Object.assign(state,{wheelPhase,rearWheelPhase,crankPhase,chainPhase,rearAngle:angle,rearAxle:ra,shockArm:sa,frontAxle:fa,steerAngle:steerAngle||0,rotors:rotors.length,rotorParts:rotors.reduce((n,e)=>n+e.parts.length,0)});return state;
 };
 return {update,state};
}

// Local test bench: stationary by default; explicit controls demonstrate the mechanics.
let panel,active=false,compression=0,lastRoot,rig,lastTime=0;
function bench() {
 const v=globalThis.__WK_VIEW__,canvas=v?.renderer?.domElement,garage=canvas?.isConnected&&!document.querySelector('[data-ride]');
 if(!garage){if(panel)panel.style.display='none';return;}
 if(!panel){panel=document.createElement('div');panel.dataset.wkBench='';panel.style.cssText='position:absolute;right:12px;bottom:58px;z-index:5;background:#101b16ed;border:1px solid #587264;border-radius:9px;padding:7px;color:#e7f4ed;font:12px sans-serif;display:grid;gap:5px';
  panel.innerHTML='<button type="button" data-bench-toggle style="background:#183e28;color:#b8ffcf;border:1px solid #527960;border-radius:6px;padding:7px;cursor:pointer">▶ TEST MOTION</button><label>Suspension <input aria-label="Test suspension compression" type="range" min="0" max="1" step=".01" value="0" style="width:90px;vertical-align:middle"></label>';
  panel.querySelector('button').onclick=()=>{active=!active;panel.querySelector('button').textContent=active?'■ STOP MOTION':'▶ TEST MOTION';};panel.querySelector('input').oninput=e=>compression=+e.target.value;
 }
 const benchHost=document.querySelector('#wk-inspect-dock .wk-inspect-tools')||canvas.parentElement;if(panel.parentElement!==benchHost)benchHost.append(panel);panel.style.display='grid';
 let root;v.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});if(!root)return;
 if(lastRoot!==root){lastRoot=root;rig=createBikeMotion(root,root.userData.wkBuild||{},id=>globalThis.__WK_CAT__?.().items.find(p=>p.id===id));}
 const now=performance.now(),dt=Math.min(.08,(now-lastTime)/1000||0);lastTime=now;
 // Avoid rewriting an idle scene unless its suspension control changed.
 if(rig&&(active||root.userData.wkBenchCompression!==compression)){rig.update({distance:active?dt*1.3:0,rearCompression:compression,frontCompression:compression,travelR:.045});root.userData.wkBenchCompression=compression;}
 globalThis.__WK_BENCH__={state:rig?.state,active};
}
if(typeof document!=='undefined')setInterval(bench,50);
