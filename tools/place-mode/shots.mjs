// Concept prototype only: place mode (wide camera, bike hidden, new items drop into the room centre with the 3D gizmo).
// Injected via page.evaluate; no game files change. Usage: WK_TEST_URL=http://127.0.0.1:8962/ node tools/place-mode/shots.mjs
import {launchBrowser,pageOptions} from '../../tests/_browser.mjs';
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8962/',OUT=process.env.OUT||'/workspace/wk-placemode';
const b=await launchBrowser();
const PROTO=`(()=>{if(globalThis.__PM__)return;const v=__WK_VIEW__,P=__WK_WORKSHOP_PLACE__;let bike=null;v.scene.traverse(o=>{if(!bike&&o.userData?.wkWorkstand)bike=o});
 const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
 const V3=v.camera.position.constructor,WIDE={pos:new V3(3.9,3.3,5.6),tgt:new V3(-.6,.15,-1.2),fov:52};
 const shadows=v.scene.children.filter(o=>o.isMesh&&Math.hypot(o.position.x,o.position.z)<1.2&&o.position.y<.06&&o.material?.transparent);
 const tween=(cam,ctl,pos,tgt,ms=700,on)=>new Promise(r=>{const p0=cam.position.clone(),t0=ctl.target.clone(),s=performance.now();const f=()=>{const k=ease(Math.min(1,(performance.now()-s)/ms));cam.position.lerpVectors(p0,pos,k);ctl.target.lerpVectors(t0,tgt,k);ctl.update();on?.(k);k<1?requestAnimationFrame(f):r()};f();});
 const pill=(on)=>{let el=document.getElementById('pm-pill');if(!on){el?.remove();return}if(!el){el=document.createElement('div');el.id='pm-pill';el.innerHTML='<span style="width:8px;height:8px;border-radius:50%;background:#35e07a;box-shadow:0 0 8px #35e07a;display:inline-block;margin-right:8px"></span>PLACE MODE<span style="margin-left:14px;padding:5px 12px;border-radius:999px;background:#35e07a;color:#07120b">✓ Done</span>';
  el.style.cssText='position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;font:800 13px/1 system-ui,sans-serif;letter-spacing:.1em;color:#e8fff1;background:rgba(10,16,22,.72);backdrop-filter:blur(6px);border:1px solid rgba(53,224,122,.55);padding:6px 6px 6px 14px;border-radius:999px';document.body.appendChild(el)}};
 let saved=null;
 globalThis.__PM__={
  async enter(){saved={pos:v.camera.position.clone(),tgt:v.controls.target.clone(),max:v.controls.maxDistance,ar:v.controls.autoRotate};v.controls.autoRotate=false;v.controls.enableDamping=false;
   saved.fov=v.camera.fov;bike.visible=false;for(const m of shadows)m.visible=false;v.controls.maxDistance=14;pill(true);
   const f0=v.camera.fov;await tween(v.camera,v.controls,WIDE.pos,WIDE.tgt,700,k=>{v.camera.fov=f0+(WIDE.fov-f0)*k;v.camera.updateProjectionMatrix()});},
  wide(){v.camera.position.copy(WIDE.pos);v.controls.target.copy(WIDE.tgt);v.camera.fov=WIDE.fov;v.camera.updateProjectionMatrix();v.controls.update();},
  async exit(){pill(false);P.select?.(null,false);const f1=v.camera.fov;await tween(v.camera,v.controls,saved.pos,saved.tgt,700,k=>{v.camera.fov=f1+(saved.fov-f1)*k;v.camera.updateProjectionMatrix()});for(const m of shadows)m.visible=true;v.controls.maxDistance=saved.max;bike.visible=true;},
  // new item: try the room centre, then rings outward until a free spot (bike's spot stays reserved)
  drop(id,cx=-.3,cz=-.2){for(let r=0;r<=3;r+=.15){const n=r?Math.max(8,Math.round(r*14)):1;for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(z>.2&&Math.abs(x)<1.5)continue;const u=P.add(id,{x,z,yaw:0});if(u){P.select(u,true);this.wide();return {u,x,z,r,shadows:shadows.length}}}}return null},
 };})()`;
const ready=p=>p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&__WK_WORKSHOP_PLACE__?.ready()&&__WK_WORKSTAND__?.state().mounted,null,{timeout:180000});
const prep=async p=>{await p.evaluate(()=>localStorage.removeItem('wk-room-layout-v1'));await p.reload();await ready(p);await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});await p.waitForTimeout(1200);await p.evaluate(PROTO);};
const gizmoVisible=p=>p.waitForFunction(()=>{for(const el of document.querySelectorAll('*'))if(el.wkGizmo?.state().visible)return true;return false},null,{timeout:20000}).catch(()=>{});
try{
 const p=await b.newPage(pageOptions({viewport:{width:1024,height:658},serviceWorkers:'block'}));await p.goto(URL0);await prep(p);
 await p.screenshot({path:OUT+'/1-normal.png'});
 await p.evaluate(()=>__PM__.enter());await p.waitForTimeout(600);await p.screenshot({path:OUT+'/2-place.png'});
 const d=await p.evaluate(()=>__PM__.drop('red-chest'));console.log('drop',JSON.stringify(d));await gizmoVisible(p);
 // mid-drop frame: lift the new chest, then let it land
 await p.evaluate(()=>{const h=__WK_VIEW__.scene.getObjectByName('workshop:placed:red-chest');h.userData.y0=h.position.y;h.position.y+=.75});await p.waitForTimeout(300);await p.screenshot({path:OUT+'/3a-dropping.png'});
 await p.evaluate(()=>{const h=__WK_VIEW__.scene.getObjectByName('workshop:placed:red-chest');h.position.y=h.userData.y0});await p.waitForTimeout(400);await p.screenshot({path:OUT+'/3-dropped.png'});
 await p.evaluate(()=>__WK_WORKSHOP_PLACE__.confirm());await p.evaluate(()=>__PM__.exit());await p.waitForTimeout(700);await p.screenshot({path:OUT+'/6-exit.png'});
 await p.close();
 // phone landscape
 const q=await b.newPage(pageOptions({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'}));await q.goto(URL0);await prep(q);
 await q.evaluate(()=>__PM__.enter());await q.evaluate(()=>__PM__.drop('blue-chest'));await gizmoVisible(q);await q.waitForTimeout(500);await q.screenshot({path:OUT+'/5-phone.png'});await q.close();
 // garage
 const g=await b.newPage(pageOptions({viewport:{width:1024,height:658},serviceWorkers:'block'}));await g.goto(URL0);await g.evaluate(()=>localStorage.removeItem('wk-garage-layout-v1'));await g.reload();
 await g.waitForFunction(()=>globalThis.__WK_ROOM__&&globalThis.__WK_SAVED_BUILDS__,null,{timeout:180000});
 await g.getByRole('button',{name:'⌂ Garage',exact:true}).click();await g.waitForFunction(()=>__WK_ROOM__.renderer?.objects?.some(o=>o.key==='garage:toolbox'),null,{timeout:120000});await g.waitForTimeout(1500);
 await g.screenshot({path:OUT+'/4a-garage-normal.png'});
 await g.evaluate(PROTO.replace('if(globalThis.__PM__)return;','return;'));
 await g.evaluate(async()=>{const r=__WK_ROOM__.renderer,V=r.camera.position.constructor;r.controls.enableDamping=false;r.controls.autoRotate=false;for(const o of r.objects)if(o.key.startsWith('saved:'))o.holder.visible=false;
  const tb=r.objects.find(o=>o.key==='garage:toolbox');tb.holder.position.set(0,tb.holder.position.y,.2);r.select('garage:toolbox');r.arrange(true);
  const p0=r.camera.position.clone(),t0=r.controls.target.clone(),P1=new V(3.4,4.1,6.6),T1=new V(0,.2,-.4),s=performance.now();
  await new Promise(res=>{const f=()=>{const k=Math.min(1,(performance.now()-s)/700),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;r.camera.position.lerpVectors(p0,P1,e);r.controls.target.lerpVectors(t0,T1,e);r.controls.update();k<1?requestAnimationFrame(f):res()};f();});
  const el=document.createElement('div');el.innerHTML='<span style="width:8px;height:8px;border-radius:50%;background:#35e07a;box-shadow:0 0 8px #35e07a;display:inline-block;margin-right:8px"></span>PLACE MODE<span style="margin-left:14px;padding:5px 12px;border-radius:999px;background:#35e07a;color:#07120b">✓ Done</span>';
  el.style.cssText='position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;font:800 13px/1 system-ui,sans-serif;letter-spacing:.1em;color:#e8fff1;background:rgba(10,16,22,.72);border:1px solid rgba(53,224,122,.55);padding:6px 6px 6px 14px;border-radius:999px';document.body.appendChild(el);});
 await gizmoVisible(g);await g.waitForTimeout(600);await g.screenshot({path:OUT+'/4-garage-place.png'});await g.close();
}finally{await b.close();}
