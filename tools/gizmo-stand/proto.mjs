// Concept shots for the 3D gizmo + raised workstand. Injects tools/gizmo-stand/gizmo3d.js into the running game.
// MODE=workshop|garage, PHONE=1 for 844x390 touch. No game files changed.
import {chromium} from '../../node_modules/playwright/index.mjs';import fs from 'node:fs';
const URL0=process.env.URL||'http://127.0.0.1:8962/',OUT=process.env.OUT||'/workspace/wk-gizmo',phone=process.env.PHONE==='1',MODE=process.env.MODE||'workshop',tag=phone?'phone-':'';fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext(phone?{viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'}:{viewport:{width:1024,height:658},serviceWorkers:'block'});
const p=await ctx.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(/^GZ/.test(m.text()))console.log(m.text())});
await p.goto(URL0);await p.evaluate(()=>{localStorage.removeItem('wk-room-layout-v1');localStorage.removeItem('wk-garage-layout-v1')});await p.reload();
await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&document.querySelector('[data-wk-room-ready]'),null,{timeout:240000});
await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});await p.waitForTimeout(2000);
await p.addStyleTag({content:'.garage-gizmo .floor-rotate{display:none!important}'});
const shot=async n=>{await p.waitForTimeout(1200);await p.screenshot({path:`${OUT}/${MODE}-${tag}${n}.png`,timeout:90000});console.log(n);};
const close=()=>p.evaluate((k)=>{const s=globalThis.__GZ__;const c=s.cam,t=s.ctrl;const o=s.at;const d=c.position.clone().sub(o).setY(0).normalize();c.position.set(o.x+d.x*2.3*k,o.y+1.55*k,o.z+d.z*2.3*k);t.target.set(o.x,o.y+.35,o.z);t.update();},MODE==='workshop'?1.3:1);
if(MODE==='workshop'){
 // 1) raised workstand at the default workshop camera
 const st=await p.evaluate(async()=>{const T=await import('/vendor/three.module.js'),{makeWorkstand}=await import('/tools/gizmo-stand/gizmo3d.js');const v=__WK_VIEW__,stand=v.scene.getObjectByName('wk:stand');if(!stand)return 'no stand';
  const bike=stand.parent;let seat=null,best=-1;bike.traverse(o=>{if(o.isMesh&&/seat|saddle/i.test(o.name+(o.parent?.name||''))){const bb=new T.Box3().setFromObject(o);if(bb.max.y>best){best=bb.max.y;seat=bb;}}});
  const before=new T.Box3().setFromObject(bike);stand.visible=false;const LIFT=.18;bike.position.y+=LIFT;bike.updateMatrixWorld(true);
  const sb=seat?seat:before,ctr=sb.getCenter(new T.Vector3());const clamp=new T.Vector3(ctr.x,(seat?seat.min.y:before.max.y-.2)+LIFT-.1,ctr.z);
  const ws=makeWorkstand(T,{seat:clamp,groundY:0,standZ:clamp.z-.42});v.scene.add(ws);
  return {seat:!!seat,clamp:clamp.toArray(),bike:[before.min.toArray(),before.max.toArray()]};});
 console.log('GZ stand',JSON.stringify(st));await shot('stand-default');
 // 2) gizmo on a placed chest
 const at=await p.evaluate(async()=>{const T=await import('/vendor/three.module.js'),{makeGizmo}=await import('/tools/gizmo-stand/gizmo3d.js');const P=__WK_WORKSHOP_PLACE__,v=__WK_VIEW__;
  let uid=null,pos=null;for(const c of [{x:1.8,z:-1.25},{x:1.9,z:-1.0},{x:1.75,z:1.15}]){if(P.check('red-chest',{...c,yaw:-.35}).ok){uid=P.add('red-chest',{...c,yaw:-.35});pos=c;break;}}
  if(!uid)return null;P.select(uid,true);const holder=v.scene.getObjectByName('workshop:placed:red-chest');const bb=new T.Box3().setFromObject(holder),s=bb.getSize(new T.Vector3());
  const r=Math.max(s.x,s.z)*.62+.08,gz=makeGizmo(T,r),cc=bb.getCenter(new T.Vector3());gz.position.set(cc.x,0,cc.z);v.scene.add(gz);
  globalThis.__GZ__={cam:v.camera,ctrl:v.controls,at:new T.Vector3(cc.x,0,cc.z),home:[v.camera.position.clone(),v.controls.target.clone()]};return pos;});
 console.log('GZ chest',JSON.stringify(at));await p.evaluate(()=>{const v=__WK_VIEW__,c=v.camera,t=v.controls.target,d=c.position.clone().sub(t).normalize();t.x+=.9;c.position.copy(t).addScaledVector(d,4.0);c.position.x+=.5;v.controls.update();});await shot('gizmo-default');await close();await shot('gizmo-close');
}else{
 await p.getByRole('button',{name:'⌂ Garage',exact:true}).click();await p.waitForFunction(()=>__WK_ROOM__.renderer?.objects?.length>0,null,{timeout:120000});await p.waitForTimeout(2500);
 const at=await p.evaluate(async()=>{const T=await import('/vendor/three.module.js'),{makeGizmo}=await import('/tools/gizmo-stand/gizmo3d.js');const r=__WK_ROOM__.renderer;r.controls.enableDamping=false;
  const o=r.objects.find(o=>o.key==='garage:toolbox');r.select(o.key);r.arrange(true);const bb=new T.Box3().setFromObject(o.holder),s=bb.getSize(new T.Vector3());
  const gz=makeGizmo(T,Math.max(s.x,s.z)*.62+.08);const cc=bb.getCenter(new T.Vector3());gz.position.set(cc.x,0,cc.z);r.scene.add(gz);
  globalThis.__GZ__={cam:r.camera,ctrl:r.controls,at:new T.Vector3(cc.x,0,cc.z)};return o.holder.position.toArray();});
 console.log('GZ toolbox',JSON.stringify(at));
 const edit=p.getByRole('button',{name:'Edit object',exact:true});if(await edit.count())await edit.first().click().catch(()=>{});
 await p.evaluate(()=>__WK_ROOM__.renderer.arrange(true));await shot('gizmo-default');await close();await shot('gizmo-close');
}
await b.close();
