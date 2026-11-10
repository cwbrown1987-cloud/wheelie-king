// 3D floor gizmo (rotate-drag / move-drag, collision, saves, no orbit fight, touch) in the workshop and
// garage, and the workshop bike raised on the kit workstand with camera + zoom unchanged.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const host=()=>{let first=null;for(const el of document.querySelectorAll('*'))if(el.wkGizmo){first??=el;if(el.wkGizmo.state().visible)return el;}return first};
const camOf=()=>{const v=__WK_VIEW__;return [...v.camera.position.toArray(),...v.controls.target.toArray()]};
const same=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-6);
async function drag(p,[x0,y0],[x1,y1],touch=false){
 if(!touch){await p.mouse.move(x0,y0);await p.mouse.down();await p.mouse.move(x1,y1,{steps:10});await p.mouse.up();return;}
 await p.evaluate(([x0,y0,x1,y1])=>{const c=document.elementFromPoint(x0,y0),ev=(t,x,y)=>c.dispatchEvent(new PointerEvent(t,{pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true,buttons:t==='pointerup'?0:1}));
  ev('pointerdown',x0,y0);for(let i=1;i<=10;i++)ev('pointermove',x0+(x1-x0)*i/10,y0+(y1-y0)*i/10);ev('pointerup',x1,y1);},[x0,y0,x1,y1]);
}
try{
 // ---------------- workshop: workstand + gizmo (desktop mouse) ----------------
 const p=await browser.newPage(pageOptions({viewport:{width:1024,height:658},serviceWorkers:'block'})),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(URL0);await p.evaluate(()=>localStorage.removeItem('wk-room-layout-v1'));await p.reload();
 await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&globalThis.__WK_WORKSHOP_PLACE__?.ready()&&globalThis.__WK_WORKSTAND__?.state().mounted,null,{timeout:180000});
 await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});await p.waitForTimeout(800);
 const stand=await p.evaluate(async()=>{const T=await import('/vendor/three.module.js'),v=__WK_VIEW__,s=__WK_WORKSTAND__.state();let root=null;v.scene.traverse(o=>{if(!root&&o.userData?.wkWorkstand)root=o;});
  v.camera.updateMatrixWorld();const b=new T.Box3();root.traverse(o=>{if(o.isMesh){let q=o,vis=true;while(q){if(!q.visible)vis=false;q=q.parent}if(vis)b.expandByObject(o)}});
  let fits=true;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const n=new T.Vector3(x,y,z).project(v.camera);if(Math.abs(n.x)>1.02||Math.abs(n.y)>1.02)fits=false;}
  const parts=[];root.getObjectByName('wk:workstand').traverse(o=>{const t=o.userData?.kit?.type;if(t)parts.push(t)});
  return {...s,parts,fits,min:v.controls.minDistance,max:v.controls.maxDistance,fov:v.camera.fov,frame:!!root.getObjectByName('wk:frame'),wheels:!!root.getObjectByName('wk:tyres')};});
 assert(stand.mounted&&stand.standVisible,JSON.stringify(stand));
 assert(Math.abs(stand.rootY-.22)<1e-6,'bike raised 18 cm: '+stand.rootY);
 assert(stand.bikeMinY>.15,'wheels off the floor: '+stand.bikeMinY);
 for(const t of ['workstand','standTripod','standMast','standCollar','standTray','standHead','seatClamp'])assert(stand.parts.includes(t),'kit part '+t+' '+stand.parts);
 assert.equal(stand.min,.12);assert.equal(stand.max,4.2);assert.equal(stand.fov,32);assert(stand.fits,'raised bike fits the default frame');assert(stand.frame&&stand.wheels,'bike parts render');
 // place a chest and edit it
 const uid=await p.evaluate(()=>{const P=__WK_WORKSHOP_PLACE__,v=__WK_VIEW__;const u=P.add('red-chest',{x:1.8,z:-1.25,yaw:0});P.select(u,true);v.controls.autoRotate=false;v.controls.enableDamping=false;v.camera.position.set(2.6,2.2,1.6);v.controls.target.set(1.8,.3,-1.25);v.controls.update();return u;});
 assert(uid,'chest placed');
 await p.waitForFunction(()=>{for(const el of document.querySelectorAll('*'))if(el.wkGizmo?.state().visible)return true;return false},null,{timeout:20000});
 const g0=await p.evaluate(`(${host})().wkGizmo.state()`);assert(g0.radius>.45&&g0.radius<1.2,JSON.stringify(g0));
 assert.equal(await p.locator('.garage-gizmo .floor-rotate').count(),0,'old flat rotate buttons gone');
 for(const name of ['Finish editing object','Remove placed item','Lift or lower object'])assert.equal(await p.getByRole('button',{name,exact:true}).count(),1,name+' kept');
 const pt=(kind,i)=>p.evaluate(([k,i,h])=>eval(h)().wkGizmo.project(k,i),[kind,i,`(${host})`]);
 const listed=()=>p.evaluate(u=>__WK_WORKSHOP_PLACE__.list().find(i=>i.uid===u)||null,uid);
 const item=()=>p.evaluate(u=>{const P=__WK_WORKSHOP_PLACE__,h=__WK_VIEW__.scene.getObjectByName('workshop:placed:red-chest');return {x:h.position.x,z:h.position.z,yaw:h.rotation.y,valid:P.state().valid}},uid);
 // move-drag the +x arrow
 let cam=await p.evaluate(camOf),before=await item();const a=await pt('move',0);await drag(p,a,[a[0]+70,a[1]+30]);
 let after=await item();assert(Math.hypot(after.x-before.x,after.z-before.z)>.08,'move-drag moved '+JSON.stringify([before,after]));{const c2=await p.evaluate(camOf);assert(same(cam,c2),'camera did not orbit during move-drag '+JSON.stringify([cam,c2]))};
 // rotate-drag a curved arrow
 before=after;const r0=await pt('rotate',1),r1=await p.evaluate(h=>eval(h)().wkGizmo.project('rotate',1,.45),`(${host})`),c=await p.evaluate(`(()=>{const s=(${host})().wkGizmo.state(),v=__WK_VIEW__;return s.centre})()`);
 await drag(p,r0,r1);after=await item();assert(Math.abs(after.yaw-before.yaw)>.1,'rotate-drag rotated '+JSON.stringify([before,after]));assert(same(cam,await p.evaluate(camOf)),'camera did not orbit during rotate-drag');
 // save: confirm and check storage
 await p.evaluate(()=>__WK_WORKSHOP_PLACE__.confirm());const saved=await p.evaluate(u=>JSON.parse(localStorage.getItem('wk-room-layout-v1')).rooms.workshop.items.find(i=>i.uid===u),uid);
 assert(Math.abs(saved.x-after.x)<1e-3&&Math.abs(saved.yaw-after.yaw)<1e-3,'saved '+JSON.stringify([saved,after]));
 // collision: drag into the bike / workstand area -> blocked, and confirming keeps the last valid spot
 await p.evaluate(u=>__WK_WORKSHOP_PLACE__.select(u,true),uid);await p.waitForTimeout(300);before=await item();
 const into=await p.evaluate(async()=>{const T=await import('/vendor/three.module.js'),v=__WK_VIEW__,n=new T.Vector3(0,0,-.55).project(v.camera),r=v.renderer.domElement.getBoundingClientRect();return [r.left+(n.x+1)/2*r.width,r.top+(1-n.y)/2*r.height]});
 const m0=await pt('move',2);const st=await p.evaluate(`(${host})().wkGizmo.state()`);await drag(p,m0,[into[0]-(st.radius?0:0),into[1]]);
 const blocked=await item();assert(blocked.valid&&!blocked.valid.ok,'bad move flagged '+JSON.stringify(blocked));
 await p.evaluate(()=>__WK_WORKSHOP_PLACE__.confirm());const kept=await listed();assert(Math.abs(kept.x-before.x)<1e-3&&Math.abs(kept.z-before.z)<1e-3,'blocked move not saved '+JSON.stringify([kept,before]));
 // orbit still works when dragging empty floor
 await p.evaluate(u=>__WK_WORKSHOP_PLACE__.select(u,true),uid);cam=await p.evaluate(camOf);await drag(p,[290,470],[220,500]);assert(!same(cam,await p.evaluate(camOf)),'orbit still works away from the gizmo');
 assert.deepEqual(errors,[]);await p.close();

 // ---------------- phone landscape touch, workshop ----------------
 const q=await browser.newPage(pageOptions({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'}));
 await q.goto(URL0);await q.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&globalThis.__WK_WORKSHOP_PLACE__?.ready()&&globalThis.__WK_WORKSTAND__?.state().mounted,null,{timeout:180000});
 await q.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});
 const ok=await q.evaluate(()=>{const P=__WK_WORKSHOP_PLACE__,v=__WK_VIEW__,u=P.add("red-chest",{x:1.8,z:-1.25,yaw:0});P.select(u,true);v.controls.autoRotate=false;v.controls.enableDamping=false;v.camera.position.set(2.6,2.2,1.6);v.controls.target.set(1.8,.3,-1.25);v.controls.update();return u});
 await q.waitForFunction(h=>eval(h)()?.wkGizmo.state().visible,`(${host})`,{timeout:20000});
 const tb=await q.evaluate(()=>{const h=__WK_VIEW__.scene.getObjectByName('workshop:placed:red-chest');return [h.position.x,h.position.z]});
 const ta=await q.evaluate(h=>eval(h)().wkGizmo.project('move',1),`(${host})`);await drag(q,ta,[ta[0]-20,ta[1]-45],true);
 const tc=await q.evaluate(()=>{const h=__WK_VIEW__.scene.getObjectByName('workshop:placed:red-chest');return [h.position.x,h.position.z]});
 assert(Math.hypot(tc[0]-tb[0],tc[1]-tb[1])>.05,'touch move-drag moved '+JSON.stringify([tb,tc]));await q.close();

 // ---------------- garage: same controls on the toolbox ----------------
 const g=await browser.newPage(pageOptions({viewport:{width:1024,height:658},serviceWorkers:'block'}));
 await g.goto(URL0);await g.evaluate(()=>localStorage.removeItem('wk-garage-layout-v1'));await g.reload();
 await g.waitForFunction(()=>globalThis.__WK_ROOM__&&globalThis.__WK_SAVED_BUILDS__,null,{timeout:180000});
 await g.getByRole('button',{name:'⌂ Garage',exact:true}).click();await g.waitForFunction(()=>__WK_ROOM__.renderer?.objects?.some(o=>o.key==='garage:toolbox'),null,{timeout:120000});
 await g.evaluate(()=>{const r=__WK_ROOM__.renderer;r.controls.enableDamping=false;r.select('garage:toolbox');r.arrange(true);const o=r.objects.find(o=>o.key==='garage:toolbox');r.camera.position.set(o.holder.position.x-1.2,2.2,o.holder.position.z+2.4);r.controls.target.copy(o.holder.position);r.controls.update();});
 await g.waitForFunction(h=>eval(h)()?.wkGizmo.state().visible,`(${host})`,{timeout:20000});await g.waitForTimeout(300);
 const gcam=()=>g.evaluate(()=>{const r=__WK_ROOM__.renderer;return [...r.camera.position.toArray(),...r.controls.target.toArray()]});
 const gi=()=>g.evaluate(()=>{const h=__WK_ROOM__.renderer.objects.find(o=>o.key==='garage:toolbox').holder;return {x:h.position.x,z:h.position.z,yaw:h.rotation.y}});
 let c0=await gcam(),b0=await gi();const gm=await g.evaluate(h=>eval(h)().wkGizmo.project('move',2),`(${host})`);await drag(g,gm,[gm[0]-80,gm[1]+10]);
 let b1=await gi();assert(Math.hypot(b1.x-b0.x,b1.z-b0.z)>.08,'garage move-drag '+JSON.stringify([b0,b1]));assert(same(c0,await gcam()),'garage camera still during move-drag');
 const gr=await g.evaluate(h=>eval(h)().wkGizmo.project('rotate',0),`(${host})`);await drag(g,gr,[gr[0]+50,gr[1]+60]);const b2=await gi();assert(Math.abs(b2.yaw-b1.yaw)>.1,'garage rotate-drag '+JSON.stringify([b1,b2]));
 // garage bounds: a huge drag stays inside the room
 const gm2=await g.evaluate(h=>eval(h)().wkGizmo.project('move',0),`(${host})`);await drag(g,gm2,[1020,gm2[1]]);for(let i=0;i<4;i++){const z=await g.evaluate(h=>eval(h)().wkGizmo.project('move',0),`(${host})`);if(z)await drag(g,z,[1020,z[1]]);}
 const b3=await gi();assert(b3.x<=4.5+1e-6&&Math.abs(b3.z)<=3.2+1e-6,'garage clamp '+JSON.stringify(b3));
 await g.waitForTimeout(500);const lay=await g.evaluate(()=>localStorage.getItem('wk-garage-layout-v1')||'');assert(lay.includes('garage:toolbox'),'garage layout saved');
 await g.close();
 console.log('gizmo-stand: ok',JSON.stringify({rootY:stand.rootY,bikeMinY:+stand.bikeMinY.toFixed(3),radius:+g0.radius.toFixed(2)}));
}finally{await browser.close();}
