import * as T from './vendor/three.module.js';
// Screen-space handles follow the selected world object, never the camera target.
export function garageGizmo(host,getRig,onRemove){
 const root=document.createElement('div');root.className='garage-gizmo';root.hidden=true;host.append(root);
 let drag=null,raf;
 const handle=(label,glyph,x,y,action)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.textContent=glyph;b.style.cssText=`left:${x}px;top:${y}px`;b.onclick=action;root.append(b);return b};
 const move=(side,forward)=>{const r=getRig(),d=r.camera.getWorldDirection(new T.Vector3());d.y=0;d.normalize();r.move((-d.z*side+d.x*forward)*.25,(d.x*side+d.z*forward)*.25)};
 handle('Move left','←',-100,0,()=>move(-1,0));handle('Move right','→',100,0,()=>move(1,0));
 handle('Move forward','↑',0,-85,()=>move(0,1));handle('Move backwards','↓',0,85,()=>move(0,-1));
 const rotate=handle('Rotate object','↻',75,-75,()=>{if(!rotate.dataset.dragged)getRig().rotate(Math.PI/12);delete rotate.dataset.dragged});
 rotate.onpointerdown=e=>{e.preventDefault();rotate.setPointerCapture(e.pointerId);drag={x:e.clientX}};
 rotate.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>1){getRig().rotate(dx*.012);drag.x=e.clientX;rotate.dataset.dragged='true'}};
 rotate.onpointerup=rotate.onpointercancel=()=>{drag=null};
 handle('Raise object','⇡',-60,70,()=>getRig().move(0,0,.1));handle('Lower object','⇣',60,70,()=>getRig().move(0,0,-.1));
 const remove=handle('Remove placed item','⌫',-75,-75,onRemove);
 const update=()=>{raf=requestAnimationFrame(update);const r=getRig(),state=r?.state(),object=r?.objects.find(o=>o.key===state.selected);root.hidden=!state?.arrange||!object;if(root.hidden)return;const center=new T.Box3().setFromObject(object.holder).getCenter(new T.Vector3()).project(r.camera),w=host.clientWidth,h=host.clientHeight;
  root.style.left=Math.max(122,Math.min(w-122,(center.x+1)*w/2))+'px';root.style.top=Math.max(128,Math.min(h-112,(-center.y+1)*h/2))+'px';remove.hidden=!object.item;
 };update();return ()=>{cancelAnimationFrame(raf);root.remove()};
}
