import * as T from './vendor/three.module.js';
export function garageGizmo(host,getRig,onRemove,onEdit){
 const root=document.createElement('div');root.className='garage-gizmo';root.hidden=true;host.append(root);let drag,raf;
 const handle=(label,glyph)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.textContent=glyph;root.append(b);return b};
 const edit=handle('Edit object','✎');edit.className='object-edit';edit.onclick=()=>onEdit(!getRig().state().arrange);
 const remove=handle('Remove placed item','⌫');remove.onclick=onRemove;
 const lift=handle('Lift or lower object','↕');lift.className='object-lift';
 const left=handle('Rotate object left','↺'),right=handle('Rotate object right','↻');left.className=right.className='floor-rotate';
 const object=()=>{const r=getRig();return r?.objects.find(o=>o.key===r.state().selected)};
 const floorAngle=e=>{const r=getRig(),o=object(),rect=r.controls.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),r.camera);const p=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());return p?Math.atan2(p.x-o.holder.position.x,p.z-o.holder.position.z):null};
 for(const b of [left,right,lift]){b.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const o=object();if(!o)return;b.setPointerCapture(e.pointerId);drag={button:b,y:e.clientY,angle:floorAngle(e)};};b.onpointermove=e=>{if(drag?.button!==b)return;const r=getRig();if(b===lift){const rect=r.controls.domElement.getBoundingClientRect(),distance=r.camera.position.distanceTo(object().holder.position),scale=2*distance*Math.tan(r.camera.fov*Math.PI/360)/rect.height;r.move(0,0,(drag.y-e.clientY)*scale);drag.y=e.clientY;}else{const angle=floorAngle(e);if(angle!=null&&drag.angle!=null)r.rotate(Math.atan2(Math.sin(angle-drag.angle),Math.cos(angle-drag.angle)));drag.angle=angle;}};b.onpointerup=b.onpointercancel=()=>{drag=null};}
 const place=(b,p)=>{const r=getRig(),v=p.clone().project(r.camera);b.style.left=(v.x+1)*host.clientWidth/2+'px';b.style.top=(-v.y+1)*host.clientHeight/2+'px';};
 const update=()=>{raf=requestAnimationFrame(update);const r=getRig(),o=object();root.hidden=!o;if(!o)return;const bounds=new T.Box3().setFromObject(o.holder),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),editing=r.state().arrange,radius=Math.max(.46,Math.min(1.05,Math.max(size.x,size.z)*.58));
  place(edit,new T.Vector3(center.x+.22,bounds.max.y+.05,center.z));edit.textContent=editing?'✓':'✎';edit.setAttribute('aria-label',editing?'Finish editing object':'Edit object');
  for(const b of [left,right,lift,remove])b.hidden=!editing;
  place(left,new T.Vector3(o.holder.position.x-radius,.025,o.holder.position.z));place(right,new T.Vector3(o.holder.position.x+radius,.025,o.holder.position.z));place(lift,new T.Vector3(center.x,bounds.max.y+.35,center.z));place(remove,new T.Vector3(center.x-.22,bounds.max.y+.05,center.z));remove.setAttribute('aria-label',o.ride?'Remove displayed ride':'Remove placed item');
 };update();return ()=>{cancelAnimationFrame(raf);root.remove()};
}
