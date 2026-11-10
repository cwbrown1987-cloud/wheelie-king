import * as T from './vendor/three.module.js';
import { makeGizmo, gizmoHitFloor, makeLiftArrows } from './src/props/gizmo3d.js';
import { dockButton, ensureDockStyle } from './src/ui/object-dock.js';
// Selected-object controls shared by the garage and the workshop. HTML handles: edit / remove
// (laid out as a spaced row above the item so they never pile up on a small prop).
// 3D floor gizmo: drag a curved blue arrow (or the ring) to rotate, a green arrow to move.
// 3D green up/down arrows above the item: drag up/down to lift/lower (replaces the old tall lift pill).
// Dragging the object itself is still handled by the room. Gizmo drags never reach the orbit controls.
export function garageGizmo(host,getRig,onRemove,onEdit){
 ensureDockStyle();const root=document.createElement('div');root.className='garage-gizmo';root.hidden=true;host.append(root);let drag,raf,g3=null,local=null;
 const handle=(label,icon)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;dockButton(b,icon);root.append(b);return b};
 const edit=handle('Edit object','edit');edit.className='object-edit';edit.onclick=()=>onEdit(!getRig().state().arrange);
 const remove=handle('Remove placed item','bin');remove.onclick=onRemove;
 const object=()=>{const r=getRig();return r?.objects.find(o=>o.key===r.state().selected)};
 // ---- 3D gizmo: rotation-invariant footprint of the selected object (holder space), ring sized from it
 const footprint=o=>{o.holder.updateMatrixWorld(true);const inv=o.holder.matrixWorld.clone().invert(),box=new T.Box3(),b=new T.Box3();
  o.holder.traverse(m=>{if(!m.isMesh||!m.geometry||m.userData.gizmo)return;let p=m;while(p&&p!==o.holder){if(p.name==='workshop:placement-preview'||p.visible===false)return;p=p.parent}m.geometry.boundingBox||m.geometry.computeBoundingBox();b.copy(m.geometry.boundingBox).applyMatrix4(new T.Matrix4().multiplyMatrices(inv,m.matrixWorld));box.union(b)});
  if(box.isEmpty())box.set(new T.Vector3(-.3,0,-.3),new T.Vector3(.3,.5,.3));const c=box.getCenter(new T.Vector3()),s=box.getSize(new T.Vector3());
  const wall=isWall(o),radius=Math.min(1.8,Math.max(.42,(wall?Math.hypot(s.x,s.y):Math.hypot(s.x,s.z))/2+.08));
  return {key:o.key,centre:new T.Vector3(c.x,wall?c.y:0,c.z),radius,top:s.y/2+c.y,midY:c.y}};
 const sceneOf=o=>{let s=o;while(s.parent)s=s.parent;return s.isScene?s:null};
 const dropGizmo=()=>{if(!g3)return;g3.group.removeFromParent();g3.group.userData.dispose();g3=null};
 const isWall=o=>o?.mount==='wall';
 const canSpin=o=>o?.spin==='wall-90';
 const centreOf=o=>{
  if(!isWall(o))return o.holder.localToWorld(local.centre.clone()).setY(0);
  const c=local.centre.clone();c.y=local.midY??local.top/2;return o.holder.localToWorld(c);
 };
 const rayOf=(e,r)=>{const rect=r.controls.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),r.camera);return ray};
 const floorAt=(ray)=>ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());
 const wallAt=ray=>{if(!g3)return null;const n=new T.Vector3(0,1,0).applyQuaternion(g3.group.quaternion);return ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(n,g3.group.position),new T.Vector3());};
 const toGizmo=(p)=>{if(!g3||!p)return null;const l=g3.group.worldToLocal(p.clone());return {x:l.x,z:l.z};};
 const planeAt=ray=>g3?.wall?wallAt(ray):floorAt(ray);
 const handleAt=e=>{const r=getRig(),o=object();if(!r||!o||!r.state().arrange||!g3?.group.visible||e.target!==r.controls.domElement)return null;
  const ray=rayOf(e,r),onObject=ray.intersectObject(o.holder,true).find(h=>{if(!h.object.isMesh||h.object.userData.gizmo)return false;for(let q=h.object;q&&q!==o.holder;q=q.parent)if(!q.visible||q.name==='workshop:placement-preview')return false;return true}),hit=ray.intersectObject(g3.group,true).find(h=>h.object.visible!==false);
  if(hit&&(!onObject||hit.distance<onObject.distance)&&hit.object.visible!==false)return hit.object.userData.gizmo;if(onObject)return null;
  const p=planeAt(ray);if(!p)return null;const c=g3.group.position,camD=r.camera.position.distanceTo(c),tol=Math.max(.05,camD*.02)*(e.pointerType==='touch'?2:1);
  const loc=g3.wall?toGizmo(p):{x:p.x-c.x,z:p.z-c.z};return gizmoHitFloor(g3.r,loc.x,loc.z,tol)};
 const angleAt=(ray,c)=>{const p=planeAt(ray);if(!p)return null;if(g3?.wall){const loc=toGizmo(p);return loc?Math.atan2(loc.x,loc.z):null;}return Math.atan2(p.x-c.x,p.z-c.z);};
 const down=e=>{if(drag||!e.isPrimary&&e.pointerType!=='mouse')return;const kind=handleAt(e);if(!kind)return;const r=getRig(),o=object(),ray=rayOf(e,r),c=g3.group.position.clone();
  e.stopImmediatePropagation();e.preventDefault();r.controls.enabled=false;try{e.target.setPointerCapture(e.pointerId)}catch{}
  drag={kind,id:e.pointerId,target:e.target,start:planeAt(ray),origin:o.holder.position.clone(),angle:angleAt(ray,c),centre:c,y:e.clientY,acc:0,flipped:false,wall:!!g3?.wall};host.dataset.wkGizmoDrag=kind;};
 const move=e=>{if(!drag?.kind||e.pointerId!==drag.id)return;e.stopImmediatePropagation();e.preventDefault();const r=getRig(),o=object();if(!r||!o)return;const ray=rayOf(e,r);
  if(drag.kind==='lift'){const rect=r.controls.domElement.getBoundingClientRect(),distance=r.camera.position.distanceTo(o.holder.position),scale=2*distance*Math.tan(r.camera.fov*Math.PI/360)/rect.height;r.move(0,0,(drag.y-e.clientY)*scale);drag.y=e.clientY;return;}
  if(drag.kind==='move'){const p=planeAt(ray);if(!p||!drag.start)return;const want=drag.origin.clone().add(p.sub(drag.start));r.move(want.x-o.holder.position.x,want.z-o.holder.position.z,isWall(o)?want.y-o.holder.position.y:0);}
  else{const a=angleAt(ray,drag.centre);if(a!=null&&drag.angle!=null){const da=Math.atan2(Math.sin(a-drag.angle),Math.cos(a-drag.angle));if(drag.wall&&canSpin(o)){drag.acc=(drag.acc||0)+da;if(Math.abs(drag.acc)>Math.PI/4){r.rotate(Math.sign(drag.acc)*Math.PI/2);drag.acc=0;drag.flipped=true;}}else r.rotate(da);}drag.angle=a;}};
 const up=e=>{if(!drag?.kind||e.pointerId!==drag.id)return;e.stopImmediatePropagation();const r=getRig(),o=object();if(drag.kind==='rotate'&&drag.wall&&canSpin(o)&&!drag.flipped)r.rotate(Math.PI/2);try{drag.target.releasePointerCapture(e.pointerId)}catch{}drag=null;delete host.dataset.wkGizmoDrag;if(r)r.controls.enabled=true;};
 const hover=e=>{if(drag||e.pointerType!=='mouse')return;const r=getRig();if(!r||e.target!==r.controls.domElement)return;const k=g3?.group.visible?handleAt(e):null;r.controls.domElement.style.cursor=k?(k==='lift'?'ns-resize':k==='move'?'move':'grab'):''};
 host.addEventListener('pointerdown',down,true);host.addEventListener('pointermove',move,true);host.addEventListener('pointermove',hover);host.addEventListener('pointerup',up,true);host.addEventListener('pointercancel',up,true);
 // HTML edit/remove: a neat row above the item, generous min gap in screen px, clamped on screen (any size / camera distance)
 const BTN=44,GAP=56,SPREAD=BTN+GAP,MARGIN=10;
 const toHost=p=>{const r=getRig(),v=p.clone().project(r.camera),canvas=r.controls.domElement.getBoundingClientRect(),frame=host.getBoundingClientRect(),sx=host.clientWidth/frame.width,sy=host.clientHeight/frame.height;
  return {x:(canvas.left-frame.left+(v.x+1)*canvas.width/2)*sx,y:(canvas.top-frame.top+(-v.y+1)*canvas.height/2)*sy,w:host.clientWidth,h:host.clientHeight};};
 const minTop=()=>{const half=BTN/2+6,tools=host.querySelector('.room-tools');let min=half;
  if(tools&&tools.getClientRects().length){const t=tools.getBoundingClientRect(),frame=host.getBoundingClientRect();if(t.top-frame.top<frame.height/2)min=Math.max(min,(t.bottom-frame.top)*host.clientHeight/frame.height+half)}
  return min;};
 const placeAt=(b,x,y,clampX=true)=>{const hw=(b.offsetWidth||BTN)/2,hh=(b.offsetHeight||BTN)/2+6,maxX=(host.clientWidth||1)-hw-MARGIN,maxY=(host.clientHeight||1)-hh-MARGIN;
  b.style.left=(clampX?Math.max(hw+MARGIN,Math.min(maxX,x)):x)+'px';b.style.top=Math.max(minTop(),Math.min(maxY,y))+'px';};
 const placeRow=(anchor,pair)=>{const mid=toHost(anchor);const minY=minTop(),hw=BTN/2,minX=hw+MARGIN,maxX=mid.w-hw-MARGIN,maxY=mid.h-hw-MARGIN;
  const cy=Math.max(minY,Math.min(maxY,mid.y-52));
  if(!pair){placeAt(edit,mid.x,cy);return;}
  // keep a rigid generous gap: shift the pair to stay on screen, never shrink the spacing
  let left=mid.x-SPREAD/2,right=mid.x+SPREAD/2,dx=0;
  if(SPREAD<=maxX-minX){if(left<minX)dx=minX-left;else if(right>maxX)dx=maxX-right;}
  else{dx=(minX+maxX)/2-(left+right)/2;}
  left+=dx;right+=dx;
  placeAt(remove,left,cy,false);placeAt(edit,right,cy,false);
  const a=remove.getBoundingClientRect(),b=edit.getBoundingClientRect();
  if(a.width&&b.width&&b.left-a.right<GAP-0.5){const push=(GAP-(b.left-a.right))/2,sx=host.clientWidth/(host.getBoundingClientRect().width||1);
   placeAt(remove,left-push*sx,cy,false);placeAt(edit,right+push*sx,cy,false);}
 };
 const update=()=>{raf=requestAnimationFrame(update);const r=getRig(),o=object();root.hidden=!o;if(!o){if(g3)g3.group.visible=false;return;}const bounds=new T.Box3().setFromObject(o.holder),center=bounds.getCenter(new T.Vector3()),editing=r.state().arrange;
  (edit.dataset.icon!==(editing?'check':'edit')&&dockButton(edit,editing?'check':'edit'));edit.setAttribute('aria-label',editing?'Finish editing object':'Edit object');
  remove.hidden=!editing;remove.setAttribute('aria-label',o.ride?'Remove displayed ride':'Remove placed item');
  const top=new T.Vector3(center.x,bounds.max.y+.08,center.z);
  placeRow(top,editing);
  if(!editing){if(g3)g3.group.visible=false;return;}
  if(local?.key!==o.key)local=footprint(o);const scene=sceneOf(o.holder);if(!scene)return;
  const wall=isWall(o);
  if(!g3||g3.scene!==scene||Math.abs(g3.r-local.radius)>.01||g3.wall!==wall){dropGizmo();g3={group:makeGizmo(T,local.radius),r:local.radius,scene,wall};scene.add(g3.group);const lift=makeLiftArrows(T);g3.group.add(lift);}
  g3.group.visible=true;g3.group.position.copy(centreOf(o));
  if(wall){g3.group.quaternion.copy(o.holder.quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));}
  else g3.group.quaternion.identity();
  g3.group.traverse(m=>{if(!m.userData.gizmo)return;if(m.userData.gizmo==='move')m.visible=!wall;if(m.userData.gizmo==='rotate')m.visible=!wall||canSpin(o);});
  const lift=g3.group.getObjectByName('wk:gizmo-lift');
  if(lift){lift.visible=true;const cam=r.camera.position,c=g3.group.position,dist=cam.distanceTo(new T.Vector3(c.x,bounds.max.y,c.z)),s=Math.min(1.15,Math.max(.7,dist*.06));lift.scale.setScalar(s);
   if(wall){lift.quaternion.copy(g3.group.quaternion).invert();const world=new T.Vector3(c.x,bounds.max.y+.28*s+.08,c.z);lift.position.copy(g3.group.worldToLocal(world));}
   else{lift.quaternion.identity();lift.rotation.y=Math.atan2(cam.x-c.x,cam.z-c.z);lift.position.set(0,bounds.max.y-g3.group.position.y+.28*s+.08,0);}
  }
  g3.group.userData.tick?.(performance.now(),!!drag);
 };
 update();
 const handleRects=()=>{const box=b=>b.hidden||root.hidden?null:b.getBoundingClientRect();return {edit:box(edit),remove:box(remove)};};
 const state=()=>({visible:!!g3?.group.visible,radius:g3?.r||0,centre:g3?g3.group.position.toArray():null,drag:drag?.kind||null,lift:!!g3?.group.getObjectByName('wk:gizmo-lift')?.visible,wall:!!g3?.wall,spin:canSpin(object()),handles:handleRects()});
 const project=(kind,i=0,da=0)=>{const r=getRig();if(!g3||!r)return null;const c=g3.group.position,R=g3.r,rect=r.controls.domElement.getBoundingClientRect(),toScreen=v=>{const p=v.project(r.camera);return [rect.left+(p.x+1)/2*rect.width,rect.top+(1-p.y)/2*rect.height];};
  if(kind==='lift'){const lift=g3.group.getObjectByName('wk:gizmo-lift-up')||g3.group.getObjectByName('wk:gizmo-lift');if(!lift)return null;return toScreen(lift.getWorldPosition(new T.Vector3()));}
  const a=kind==='move'?i*Math.PI/2:([Math.PI*.78,-Math.PI*.22][i]||0)+da,d=kind==='move'?R+.22:R;
  const local=new T.Vector3(Math.cos(a)*d,0,-Math.sin(a)*d);if(!g3.wall)local.y=.02;
  return toScreen(g3.group.localToWorld(local));};
 host.wkGizmo={state,project,handles:handleRects};
 return ()=>{cancelAnimationFrame(raf);host.removeEventListener('pointerdown',down,true);host.removeEventListener('pointermove',move,true);host.removeEventListener('pointermove',hover);host.removeEventListener('pointerup',up,true);host.removeEventListener('pointercancel',up,true);dropGizmo();delete host.wkGizmo;root.remove()};
}
