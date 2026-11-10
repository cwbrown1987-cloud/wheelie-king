import * as T from './vendor/three.module.js';
import { makeGizmo, gizmoHitFloor } from './src/props/gizmo3d.js';
// Selected-object controls shared by the garage and the workshop. HTML handles: edit / remove / lift.
// 3D floor gizmo (src/props/gizmo3d.js): drag a curved blue arrow (or the ring) to rotate, a green arrow to move.
// Dragging the object itself is still handled by the room. Gizmo drags never reach the orbit controls.
export function garageGizmo(host,getRig,onRemove,onEdit){
 const root=document.createElement('div');root.className='garage-gizmo';root.hidden=true;host.append(root);let drag,raf,g3=null,local=null;
 const handle=(label,glyph)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.textContent=glyph;root.append(b);return b};
 const edit=handle('Edit object','✎');edit.className='object-edit';edit.onclick=()=>onEdit(!getRig().state().arrange);
 const remove=handle('Remove placed item','⌫');remove.onclick=onRemove;
 const lift=handle('Lift or lower object','↕');lift.className='object-lift';
 const object=()=>{const r=getRig();return r?.objects.find(o=>o.key===r.state().selected)};
 lift.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(!object())return;lift.setPointerCapture(e.pointerId);drag={button:lift,y:e.clientY};};
 lift.onpointermove=e=>{if(drag?.button!==lift)return;const r=getRig(),rect=r.controls.domElement.getBoundingClientRect(),distance=r.camera.position.distanceTo(object().holder.position),scale=2*distance*Math.tan(r.camera.fov*Math.PI/360)/rect.height;r.move(0,0,(drag.y-e.clientY)*scale);drag.y=e.clientY;};
 lift.onpointerup=lift.onpointercancel=()=>{drag=null};
 // ---- 3D gizmo: rotation-invariant footprint of the selected object (holder space), ring sized from it
 const footprint=o=>{o.holder.updateMatrixWorld(true);const inv=o.holder.matrixWorld.clone().invert(),box=new T.Box3(),b=new T.Box3();
  o.holder.traverse(m=>{if(!m.isMesh||!m.geometry||m.userData.gizmo)return;let p=m;while(p&&p!==o.holder){if(p.name==='workshop:placement-preview'||p.visible===false)return;p=p.parent}m.geometry.boundingBox||m.geometry.computeBoundingBox();b.copy(m.geometry.boundingBox).applyMatrix4(new T.Matrix4().multiplyMatrices(inv,m.matrixWorld));box.union(b)});
  if(box.isEmpty())box.set(new T.Vector3(-.3,0,-.3),new T.Vector3(.3,.5,.3));const c=box.getCenter(new T.Vector3()),s=box.getSize(new T.Vector3());return {key:o.key,centre:new T.Vector3(c.x,0,c.z),radius:Math.min(1.8,Math.max(.42,Math.hypot(s.x,s.z)/2+.08))}};
 const sceneOf=o=>{let s=o;while(s.parent)s=s.parent;return s.isScene?s:null};
 const dropGizmo=()=>{if(!g3)return;g3.group.removeFromParent();g3.group.userData.dispose();g3=null};
 const centreOf=o=>o.holder.localToWorld(local.centre.clone()).setY(0);
 const rayOf=(e,r)=>{const rect=r.controls.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),r.camera);return ray};
 const floorAt=(ray)=>ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());
 const handleAt=e=>{const r=getRig(),o=object();if(!r||!o||!r.state().arrange||!g3?.group.visible||e.target!==r.controls.domElement)return null;
  const ray=rayOf(e,r),onObject=ray.intersectObject(o.holder,true).find(h=>{if(!h.object.isMesh||h.object.userData.gizmo)return false;for(let q=h.object;q&&q!==o.holder;q=q.parent)if(!q.visible||q.name==='workshop:placement-preview')return false;return true}),hit=ray.intersectObject(g3.group,true)[0];
  if(hit&&(!onObject||hit.distance<onObject.distance))return hit.object.userData.gizmo;if(onObject)return null;
  const p=floorAt(ray);if(!p)return null;const c=g3.group.position,camD=r.camera.position.distanceTo(c),tol=Math.max(.05,camD*.02)*(e.pointerType==='touch'?2:1);
  return gizmoHitFloor(g3.r,p.x-c.x,p.z-c.z,tol)};
 const angleAt=(ray,c)=>{const p=floorAt(ray);return p?Math.atan2(p.x-c.x,p.z-c.z):null};
 const down=e=>{if(drag||!e.isPrimary&&e.pointerType!=='mouse')return;const kind=handleAt(e);if(!kind)return;const r=getRig(),o=object(),ray=rayOf(e,r),c=g3.group.position.clone();
  e.stopImmediatePropagation();e.preventDefault();r.controls.enabled=false;try{e.target.setPointerCapture(e.pointerId)}catch{}
  drag={kind,id:e.pointerId,target:e.target,start:floorAt(ray),origin:o.holder.position.clone(),angle:angleAt(ray,c),centre:c};host.dataset.wkGizmoDrag=kind;};
 const move=e=>{if(!drag?.kind||e.pointerId!==drag.id)return;e.stopImmediatePropagation();e.preventDefault();const r=getRig(),o=object();if(!r||!o)return;const ray=rayOf(e,r);
  if(drag.kind==='move'){const p=floorAt(ray);if(!p||!drag.start)return;const want=drag.origin.clone().add(p.sub(drag.start));r.move(want.x-o.holder.position.x,want.z-o.holder.position.z);}
  else{const a=angleAt(ray,drag.centre);if(a!=null&&drag.angle!=null)r.rotate(Math.atan2(Math.sin(a-drag.angle),Math.cos(a-drag.angle)));drag.angle=a;}};
 const up=e=>{if(!drag?.kind||e.pointerId!==drag.id)return;e.stopImmediatePropagation();const r=getRig();try{drag.target.releasePointerCapture(e.pointerId)}catch{}drag=null;delete host.dataset.wkGizmoDrag;if(r)r.controls.enabled=true;};
 const hover=e=>{if(drag||e.pointerType!=='mouse')return;const r=getRig();if(!r||e.target!==r.controls.domElement)return;const k=g3?.group.visible?handleAt(e):null;r.controls.domElement.style.cursor=k?(k==='move'?'move':'grab'):''};
 host.addEventListener('pointerdown',down,true);host.addEventListener('pointermove',move,true);host.addEventListener('pointermove',hover);host.addEventListener('pointerup',up,true);host.addEventListener('pointercancel',up,true);
 const place=(b,p)=>{const r=getRig(),v=p.clone().project(r.camera),canvas=r.controls.domElement.getBoundingClientRect(),frame=host.getBoundingClientRect();b.style.left=((canvas.left-frame.left+(v.x+1)*canvas.width/2)*host.clientWidth/frame.width)+'px';b.style.top=((canvas.top-frame.top+(-v.y+1)*canvas.height/2)*host.clientHeight/frame.height)+'px';};
 const update=()=>{raf=requestAnimationFrame(update);const r=getRig(),o=object();root.hidden=!o;if(!o){if(g3)g3.group.visible=false;return;}const bounds=new T.Box3().setFromObject(o.holder),center=bounds.getCenter(new T.Vector3()),editing=r.state().arrange;
  place(edit,new T.Vector3(center.x+.22,bounds.max.y+.05,center.z));edit.textContent=editing?'✓':'✎';edit.setAttribute('aria-label',editing?'Finish editing object':'Edit object');
  for(const b of [lift,remove])b.hidden=!editing;
  place(lift,new T.Vector3(center.x,bounds.max.y+.35,center.z));place(remove,new T.Vector3(center.x-.22,bounds.max.y+.05,center.z));remove.setAttribute('aria-label',o.ride?'Remove displayed ride':'Remove placed item');
  if(!editing){if(g3)g3.group.visible=false;return;}
  if(local?.key!==o.key)local=footprint(o);const scene=sceneOf(o.holder);if(!scene)return;
  if(!g3||g3.scene!==scene||Math.abs(g3.r-local.radius)>.01){dropGizmo();g3={group:makeGizmo(T,local.radius),r:local.radius,scene};scene.add(g3.group);}
  g3.group.visible=true;g3.group.position.copy(centreOf(o));
 };update();
 const state=()=>({visible:!!g3?.group.visible,radius:g3?.r||0,centre:g3?g3.group.position.toArray():null,drag:drag?.kind||null});
 const project=(kind,i=0,da=0)=>{const r=getRig();if(!g3||!r)return null;const c=g3.group.position,R=g3.r,a=kind==='move'?i*Math.PI/2:([Math.PI*.78,-Math.PI*.22][i]||0)+da,d=kind==='move'?R+.22:R,p=new T.Vector3(c.x+Math.cos(a)*d,.02,c.z-Math.sin(a)*d).project(r.camera),rect=r.controls.domElement.getBoundingClientRect();return [rect.left+(p.x+1)/2*rect.width,rect.top+(1-p.y)/2*rect.height]};
 host.wkGizmo={state,project};
 return ()=>{cancelAnimationFrame(raf);host.removeEventListener('pointerdown',down,true);host.removeEventListener('pointermove',move,true);host.removeEventListener('pointermove',hover);host.removeEventListener('pointerup',up,true);host.removeEventListener('pointercancel',up,true);dropGizmo();delete host.wkGizmo;root.remove()};
}
