// Object handles: style B edit/remove sit in a generous, non-overlapping row above a small item;
// the tall lift pill is gone, replaced by 3D up/down arrows; kit items spin about their bbox
// centre (ring stays on the item); auto-rotation is off by default in place / edit mode.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const browser=await launchBrowser();
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const shots=process.env.WK_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const host=()=>{let first=null;for(const el of document.querySelectorAll('*'))if(el.wkGizmo){first??=el;if(el.wkGizmo.state().visible)return el;}return first};
const gizmo=()=>eval(`(${host})`)();
const overlap=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
const edgeGap=(a,b)=>Math.max(0,b.left-a.right,a.left-b.right);
const near=(a,b,e=1e-3)=>a.every((v,i)=>Math.abs(v-b[i])<e);
async function drag(p,[x0,y0],[x1,y1]){await p.mouse.move(x0,y0);await p.mouse.down();await p.mouse.move(x1,y1,{steps:10});await p.mouse.up();}
async function boot(p){
 await p.goto(URL0);await p.evaluate(()=>localStorage.removeItem('wk-room-layout-v1'));await p.reload();
 await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&__WK_WORKSHOP_PLACE__?.ready(),null,{timeout:180000});
 await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});
}
async function placeCarton(p,cam=true){
 return p.evaluate(look=>{const P=__WK_WORKSHOP_PLACE__,v=__WK_VIEW__;
  const u=P.add('carton',{x:1.6,z:-1.1,yaw:0});P.select(u,true);
  v.controls.autoRotate=false;v.controls.enableDamping=false;
  if(look){v.camera.position.set(2.3,1.8,1.4);v.controls.target.set(1.6,.2,-1.1);v.controls.update();}
  return u;},cam);
}
async function waitGizmo(p){
 await p.waitForFunction(()=>{for(const el of document.querySelectorAll('*'))if(el.wkGizmo?.state().visible&&el.wkGizmo.state().handles?.edit)return true;return false;},null,{timeout:20000});
 await p.waitForTimeout(200);
}
try{
 for(const vp of [{width:1024,height:658,tag:'desktop'},{width:844,height:390,mobile:true,tag:'phone'}]){
  const p=await browser.newPage(pageOptions({viewport:{width:vp.width,height:vp.height},isMobile:!!vp.mobile,hasTouch:!!vp.mobile,deviceScaleFactor:1,serviceWorkers:'block'})),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await boot(p);
  const uid=await placeCarton(p);assert(uid,'carton placed');
  await waitGizmo(p);
  const h=await p.evaluate(()=>{let el=null;for(const n of document.querySelectorAll('*'))if(n.wkGizmo?.state().visible)el=n;const s=el.wkGizmo.state(),hs=s.handles;
   return {liftPill:!!document.querySelector('.garage-gizmo .object-lift'),lift3d:!!s.lift,edit:hs.edit&&{x:hs.edit.x,y:hs.edit.y,w:hs.edit.width,h:hs.edit.height,left:hs.edit.left,right:hs.edit.right,top:hs.edit.top,bottom:hs.edit.bottom},remove:hs.remove&&{x:hs.remove.x,y:hs.remove.y,w:hs.remove.width,h:hs.remove.height,left:hs.remove.left,right:hs.remove.right,top:hs.remove.top,bottom:hs.remove.bottom},centre:s.centre,onScreen:true};});
  assert(!h.liftPill,`${vp.tag} lift pill gone`);
  assert(h.lift3d,`${vp.tag} 3D lift arrows`);
  assert(h.edit&&h.remove,`${vp.tag} edit+remove `+JSON.stringify(h));
  assert(!overlap(h.edit,h.remove),`${vp.tag} handles overlap `+JSON.stringify(h));
  const gap=edgeGap(h.edit,h.remove);
  assert(gap>=48,`${vp.tag} remove/done gap ${gap}px, want >=48`);
  const frame=await p.evaluate(()=>{const r=document.querySelector('.garage-gizmo')?.getBoundingClientRect()||document.body.getBoundingClientRect();return {w:innerWidth,h:innerHeight};});
  for(const b of [h.edit,h.remove])assert(b.left>=0&&b.top>=0&&b.right<=frame.w+1&&b.bottom<=frame.h+1,`${vp.tag} handle off screen `+JSON.stringify(b));
  // spin in place: 90° then 45°, bbox centre stays, ring stays on the item
  const c0=await p.evaluate(u=>__WK_WORKSHOP_PLACE__.bboxCentre(u),uid);
  const r0=await p.evaluate(u=>{const P=__WK_WORKSHOP_PLACE__;P.rotate(u,Math.PI/2);return {c:P.bboxCentre(u),g:(()=>{for(const el of document.querySelectorAll('*'))if(el.wkGizmo?.state().visible)return el.wkGizmo.state().centre;return null})(),yaw:P.list().find(i=>i.uid===u).yaw};},uid);
  await p.waitForTimeout(80);
  assert(Math.abs(Math.abs(r0.yaw)-Math.PI/2)<1e-3||Math.abs(Math.abs(r0.yaw)-3*Math.PI/2)<1e-3,`${vp.tag} 90 spin `+r0.yaw);
  assert(near(r0.c,c0,.02),`${vp.tag} bbox centre moved after 90° `+JSON.stringify([c0,r0.c]));
  assert(r0.g&&Math.hypot(r0.g[0]-r0.c[0],r0.g[2]-r0.c[2])<.05,`${vp.tag} ring off item after 90° `+JSON.stringify([r0.g,r0.c]));
  const r1=await p.evaluate(u=>{const P=__WK_WORKSHOP_PLACE__;P.rotate(u,Math.PI/4);return {c:P.bboxCentre(u),g:(()=>{for(const el of document.querySelectorAll('*'))if(el.wkGizmo?.state().visible)return el.wkGizmo.state().centre;return null})()};},uid);
  await p.waitForTimeout(80);
  assert(near(r1.c,c0,.02),`${vp.tag} bbox centre moved after 45° `+JSON.stringify([c0,r1.c]));
  assert(r1.g&&Math.hypot(r1.g[0]-r1.c[0],r1.g[2]-r1.c[2])<.05,`${vp.tag} ring off item after 45° `+JSON.stringify([r1.g,r1.c]));
  if(shots)await p.screenshot({path:shots+'/handles-'+vp.tag+'.png'});
  assert.deepEqual(errors,[]);await p.close();
  console.log('object-handles',vp.tag,'ok',JSON.stringify({gap:+gap.toFixed(1),c0,c90:r0.c,c45:r1.c}));
 }
 // auto-rotation off by default in place mode; the 5s resume must not turn it back on; ROTATION toggle still works
 const p=await browser.newPage(pageOptions({viewport:{width:1024,height:658},serviceWorkers:'block'}));
 await p.goto(URL0);await p.evaluate(()=>{localStorage.removeItem('wk-room-layout-v1');localStorage.removeItem('wk-rotation-paused');});await p.reload();
 await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&__WK_WORKSHOP_PLACE__?.ready(),null,{timeout:180000});
 await p.waitForTimeout(400);
 await p.evaluate(()=>{const v=__WK_VIEW__;v.controls.autoRotate=true;localStorage.setItem('wk-rotation-paused','0');});
 await p.locator('[data-wk-place]').click();
 await p.waitForFunction(()=>{const s=__WK_WORKSHOP_PLACE__.placeMode.state();return s.on&&!s.tweening},null,{timeout:10000});
 assert.equal(await p.evaluate(()=>__WK_VIEW__.controls.autoRotate),false,'place mode starts with rotation off');
 await p.waitForTimeout(5500);
 assert.equal(await p.evaluate(()=>__WK_VIEW__.controls.autoRotate),false,'place mode stays off after 5s resume window');
 await p.evaluate(()=>{const pan=document.getElementById('wk-place-panel');if(pan)pan.hidden=true;});
 await p.evaluate(()=>document.querySelector('[data-wk-rotate]')?.click());
 assert.equal(await p.evaluate(()=>__WK_VIEW__.controls.autoRotate),true,'ROTATION toggle can turn it on');
 await p.close();
 console.log('object-handles place-mode rotation lock ok');
}finally{await browser.close();}
