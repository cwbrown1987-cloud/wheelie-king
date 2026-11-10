// Workshop inspect camera: tap the bike from far to ease home, tap again when
// close to enter a tight inspect orbit. ROTATION / TEST MOTION / Suspension
// live in the inspect dock. RESET VIEW is removed. Default zoom is unchanged.
import * as T from './vendor/three.module.js';

const EASE_MS=700, FAR=0.55, TAP=8;
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
let tween=null,inspecting=false,savedLimits=null,ptr=null,dock=null;

function view(){return globalThis.__WK_VIEW__}
function inRide(){return !!document.querySelector('[data-ride]')}
function placing(){return !!globalThis.__WK_WORKSHOP_PLACE__?.placeMode?.state()?.on||!!globalThis.__WK_WORKSHOP_PLACE__?.state()?.arrange}
function bikeRoot(v){let root;v?.scene?.traverse(o=>{if(!root&&o.name==='wk:frame')root=o.parent});return root||null}

function homePose(v,root){
  root.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());if(bounds.isEmpty())return null;
  center.x=v.orbitAnchor?.x??center.x;center.z=v.orbitAnchor?.z??center.z;
  const direction=new T.Vector3(.16,.12,1).normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right),tanV=Math.tan(v.camera.fov*Math.PI/360)*Math.max(.6,1-72/(v.renderer.domElement.clientHeight||1)),tanH=tanV*v.camera.aspect*Math.max(.55,1-(document.querySelector('[data-rail=left]')?.clientWidth||0)/(v.renderer.domElement.clientWidth||1));
  let distance=.8;for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const q=new T.Vector3(x,y,z).sub(center),depth=q.dot(direction);distance=Math.max(distance,Math.abs(q.dot(right))/(tanH*.89)+depth,Math.abs(q.dot(up))/(tanV*.88)+depth)}
  return {pos:center.clone().addScaledVector(direction,distance),tgt:center.clone(),dist:distance};
}

function applyPose(v,pose){v.camera.position.copy(pose.pos);v.controls.target.copy(pose.tgt);v.camera.updateProjectionMatrix();v.controls.update()}

function tweenTo(v,pose,done){
  tween={from:{pos:v.camera.position.clone(),tgt:v.controls.target.clone()},to:pose,t0:performance.now(),done};
  v.controls.enabled=false;
}
function stepTween(){
  const v=view(),tw=tween;if(!v||!tw)return;
  const k=Math.min(1,(performance.now()-tw.t0)/EASE_MS),e=ease(k);
  v.camera.position.lerpVectors(tw.from.pos,tw.to.pos,e);v.controls.target.lerpVectors(tw.from.tgt,tw.to.tgt,e);v.controls.update();
  if(k>=1){tween=null;v.controls.enabled=true;v.controls.update();tw.done?.()}
}

function ensureDock(){
  if(!dock){dock=document.createElement('div');dock.id='wk-inspect-dock';dock.hidden=true;dock.setAttribute('role','dialog');dock.setAttribute('aria-label','Inspect bike');dock.innerHTML='<header><strong>INSPECT BIKE</strong><button type="button" data-wk-inspect-exit aria-label="Close inspect">✕</button></header><div class="wk-inspect-tools"></div>';dock.querySelector('[data-wk-inspect-exit]').onclick=()=>exitInspect();}
  const host=document.querySelector('[data-scene]')||document.body;if(dock.parentElement!==host)host.append(dock);return dock;
}
function toolsHost(){return ensureDock().querySelector('.wk-inspect-tools')}
function collectTools(){
  const host=toolsHost();
  const rot=document.querySelector('[data-wk-rotate]');
  const bench=document.querySelector('[data-wk-bench]');
  if(rot&&rot.parentElement!==host)host.append(rot);
  if(bench&&bench.parentElement!==host)host.append(bench);
}
function setInspecting(on){
  inspecting=!!on;document.body.classList.toggle('wk-inspect-on',inspecting);
  ensureDock().hidden=!inspecting;
  if(inspecting)collectTools();
}

function restoreLimits(v){
  if(savedLimits&&v){v.controls.minDistance=savedLimits.min;v.controls.maxDistance=savedLimits.max}savedLimits=null;
}

function goHome({immediate=false}={}){
  const v=view(),root=bikeRoot(v),pose=v&&root&&homePose(v,root);if(!pose)return false;
  if(inspecting){setInspecting(false);restoreLimits(v)}
  if(immediate){applyPose(v,pose);tween=null;v.controls.enabled=true;return true}
  tweenTo(v,pose);return true;
}

function enterInspect({immediate=false}={}){
  const v=view(),root=bikeRoot(v),pose=v&&root&&homePose(v,root);if(!pose||inRide()||placing())return false;
  if(!savedLimits)savedLimits={min:v.controls.minDistance,max:v.controls.maxDistance};
  const close=pose.tgt.clone().addScaledVector(pose.pos.clone().sub(pose.tgt).normalize(),pose.dist*.62);
  v.controls.minDistance=Math.max(.28,pose.dist*.38);v.controls.maxDistance=Math.max(v.controls.minDistance+.25,pose.dist*.95);
  setInspecting(true);
  if(immediate){applyPose(v,{pos:close,tgt:pose.tgt});tween=null;v.controls.enabled=true;return true}
  tweenTo(v,{pos:close,tgt:pose.tgt});return true;
}

function exitInspect({immediate=false}={}){
  if(!inspecting&&!savedLimits)return false;
  setInspecting(false);restoreLimits(view());
  return goHome({immediate});
}

function hitBike(e,v){
  const root=bikeRoot(v);if(!root)return false;
  const r=v.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
  ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),v.camera);
  return ray.intersectObject(root,true).length>0;
}

function onDown(e){
  const v=view();if(!v||inRide()||placing()||e.target!==v.renderer.domElement)return;
  ptr={x:e.clientX,y:e.clientY,t:performance.now()};
}
function onUp(e){
  if(!ptr)return;const tap=Math.hypot(e.clientX-ptr.x,e.clientY-ptr.y)<TAP&&(performance.now()-ptr.t)<700;ptr=null;
  if(!tap)return;
  const v=view();if(!v||inRide()||placing()||tween)return;
  if(!hitBike(e,v))return;
  e.stopImmediatePropagation?.();
  if(inspecting){exitInspect();return}
  const root=bikeRoot(v),pose=homePose(v,root);if(!pose)return;
  if(v.camera.position.distanceTo(pose.pos)>FAR)goHome();else enterInspect();
}

function boot(){
  addEventListener('pointerdown',onDown,true);
  addEventListener('pointerup',onUp,true);
  const loop=()=>{stepTween();collectTools();requestAnimationFrame(loop)};requestAnimationFrame(loop);
}

if(typeof document!=='undefined')boot();

globalThis.__WK_WORKSHOP_CAM__={
  home:opts=>goHome(opts||{}),
  inspect:opts=>enterInspect(opts||{}),
  exit:opts=>exitInspect(opts||{}),
  state:()=>{
    const v=view(),root=bikeRoot(v),pose=v&&root&&homePose(v,root);
    return {inspect:inspecting,tweening:!!tween,far:!!(pose&&v.camera.position.distanceTo(pose.pos)>FAR),dist:pose&&v?v.camera.position.distanceTo(pose.pos):null};
  }
};
