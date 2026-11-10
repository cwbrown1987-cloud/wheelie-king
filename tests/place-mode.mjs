// Place mode: PLACE eases the camera out to a wide room view and hides the bike + workstand; a picked item
// drops into the middle of the room (or the nearest free spot) already selected with the 3D gizmo; ✓ Done
// eases back to the exact normal camera and zoom and brings the bike back. Workshop and garage.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8931/',shots=process.env.WK_PLACE_SHOTS;
const camOf=()=>{const v=__WK_VIEW__;return {c:[...v.camera.position.toArray(),...v.controls.target.toArray()],fov:v.camera.fov,min:v.controls.minDistance,max:v.controls.maxDistance,d:v.camera.position.distanceTo(v.controls.target)}};
const near=(a,b,e=1e-3)=>a.every((v,i)=>Math.abs(v-b[i])<e);
const gizmoOn=()=>{for(const el of document.querySelectorAll('*'))if(el.wkGizmo?.state().visible)return true;return false};
const bikeVis=()=>{let root=null;__WK_VIEW__.scene.traverse(o=>{if(!root&&o.userData?.wkWorkstand)root=o});const st=root?.getObjectByName('wk:workstand');let vis=!!root;for(let q=st;q;q=q.parent)if(!q.visible)vis=false;return {bike:!!root?.visible,stand:vis}};
try{
 for(const vp of [{width:1024,height:658},{width:844,height:390,mobile:true}]){
  const p=await browser.newPage(pageOptions({viewport:{width:vp.width,height:vp.height},isMobile:!!vp.mobile,hasTouch:!!vp.mobile,deviceScaleFactor:1,serviceWorkers:'block'})),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const tag=vp.width+'x'+vp.height;
  await p.goto(URL0);await p.evaluate(()=>localStorage.removeItem('wk-room-layout-v1'));await p.reload();
  await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&__WK_WORKSHOP_PLACE__?.ready()&&__WK_WORKSTAND__?.state().mounted,null,{timeout:180000});
  await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});await p.waitForTimeout(800);
  await p.evaluate(()=>{__WK_VIEW__.controls.autoRotate=false});await p.waitForTimeout(500);
  const cam0=await p.evaluate(camOf);assert.deepEqual(bikeVis&&await p.evaluate(bikeVis),{bike:true,stand:true});
  if(shots&&!vp.mobile)await p.screenshot({path:shots+'/place-1-workshop-normal.png'});
  // enter
  await p.locator('[data-wk-place]').click();
  await p.waitForFunction(()=>{const s=__WK_WORKSHOP_PLACE__.placeMode.state();return s.on&&!s.tweening},null,{timeout:10000});
  const wide=await p.evaluate(camOf);
  assert(wide.fov>cam0.fov+10&&wide.d>cam0.d*1.8,`${tag} wide camera on enter `+JSON.stringify([cam0,wide]));
  assert.deepEqual(await p.evaluate(bikeVis),{bike:false,stand:false},'bike + workstand hidden');
  assert(await p.locator('#wk-place-mode').isVisible(),'place-mode pill');assert(await p.locator('#wk-place-panel').isVisible(),'catalogue open');
  if(shots&&!vp.mobile){await p.locator('#wk-place-panel').evaluate(e=>e.hidden=true);await p.screenshot({path:shots+'/place-2-workshop-wide.png'});await p.locator('[data-wk-place]').click();}
  // the room centre is the bike's spot (kept clear), so a picked chest drops to the nearest free spot, selected with the gizmo
  assert(!(await p.evaluate(()=>__WK_WORKSHOP_PLACE__.check('red-chest',{x:-.3,z:-.2,yaw:0}).ok)),'centre is the reserved bike spot');
  // watch the holder height every frame from the pick: it starts above the floor and lands
  await p.evaluate(()=>{globalThis.__wkDropY=[];const f=()=>{const h=__WK_VIEW__.scene.getObjectByName('workshop:placed:red-chest');if(h)__wkDropY.push(h.position.y);if(__wkDropY.length<120)requestAnimationFrame(f)};requestAnimationFrame(f);});
  await p.locator('[data-place-item="red-chest"]').click();
  await p.waitForFunction(()=>__WK_WORKSHOP_PLACE__.state().arrange,null,{timeout:5000});
  await p.waitForTimeout(900);const dropping=await p.evaluate(()=>Math.max(...__wkDropY));await p.waitForFunction(gizmoOn,null,{timeout:10000});
  const got=await p.evaluate(()=>{const P=__WK_WORKSHOP_PLACE__,s=P.state(),h=__WK_VIEW__.scene.getObjectByName('workshop:placed:red-chest');return {s,x:h.position.x,y:h.position.y,z:h.position.z}});
  assert(got.s.selected&&got.s.arrange&&got.s.valid?.ok,`${tag} new item selected + valid `+JSON.stringify(got));
  const dc=Math.hypot(got.x+.3,got.z+.2);assert(dc>.25&&dc<1.6,`${tag} centre blocked -> nearest free spot `+dc);
  assert(dropping>got.y+.3&&got.y<.1,`${tag} drops in from above `+JSON.stringify([dropping,got.y]));
  if(shots&&!vp.mobile)await p.screenshot({path:shots+'/place-3-workshop-drop.png'});
  if(shots&&vp.mobile)await p.screenshot({path:shots+'/place-5-phone.png'});
  await p.locator('#wk-place-bar [data-wk-place-confirm]').click();
  assert(await p.evaluate(()=>__WK_WORKSHOP_PLACE__.placeMode.state().on),'still in place mode after placing');
  await p.locator('[data-wk-place]').click();await p.locator('[data-place-item="blue-chest"]').click();await p.waitForTimeout(600);
  const c2=await p.evaluate(()=>{const s=__WK_WORKSHOP_PLACE__.state(),h=__WK_VIEW__.scene.getObjectByName('workshop:placed:blue-chest');return {ok:s.valid?.ok,x:h.position.x,z:h.position.z}});
  const d2=Math.hypot(c2.x+.3,c2.z+.2);assert(c2.ok&&d2>=dc-.05&&d2<2.4&&Math.hypot(c2.x-got.x,c2.z-got.z)>.3,`${tag} spot taken -> next nearest free spot `+JSON.stringify({c2,d2,dc}));
  // exit with ✓ Done: pending chest is placed, camera + zoom exactly restored, bike back
  await p.locator('#wk-place-mode [data-wk-place-exit]').click();
  await p.waitForFunction(()=>!__WK_WORKSHOP_PLACE__.placeMode.state().on,null,{timeout:10000});
  const back=await p.evaluate(camOf);// the workshop's idle camera sway keeps moving the eye a few mm, so the eye gets a small tolerance; target, distance, FOV and zoom limits are exact
  assert(near(back.c,cam0.c,.05)&&near(back.c.slice(3),cam0.c.slice(3),1e-3)&&Math.abs(back.d-cam0.d)<1e-3&&back.fov===cam0.fov&&back.min===cam0.min&&back.max===cam0.max,`${tag} camera + zoom restored `+JSON.stringify([cam0,back]));
  assert.deepEqual(await p.evaluate(bikeVis),{bike:true,stand:true},'bike + workstand back');
  const saved=await p.evaluate(()=>__WK_WORKSHOP_PLACE__.list().map(i=>i.item).filter(id=>!String(id).startsWith('fixture:')).sort());assert.deepEqual(saved,['blue-chest','red-chest'],'both items kept');
  assert(!(await p.locator('#wk-place-mode').isVisible()),'pill gone');
  if(shots&&!vp.mobile)await p.screenshot({path:shots+'/place-6-workshop-exit.png'});
  assert.deepEqual(errors,[]);await p.close();console.log('place-mode workshop',tag,'ok',JSON.stringify({dc:+dc.toFixed(2),fov:wide.fov,d:+wide.d.toFixed(2)}));
 }
 // ---------------- garage ----------------
 const g=await browser.newPage(pageOptions({viewport:{width:1024,height:658},serviceWorkers:'block'})),gerr=[];g.on('pageerror',e=>gerr.push(e.message));
 await g.goto(URL0);await g.evaluate(()=>localStorage.removeItem('wk-garage-layout-v1'));await g.reload();
 await g.waitForFunction(()=>globalThis.__WK_ROOM__&&globalThis.__WK_SAVED_BUILDS__,null,{timeout:180000});
 await g.getByRole('button',{name:'⌂ Garage',exact:true}).click();await g.waitForFunction(()=>__WK_ROOM__.renderer?.objects?.some(o=>o.key==='garage:toolbox'),null,{timeout:120000});await g.waitForTimeout(1500);
 const gc=()=>g.evaluate(()=>{const r=__WK_ROOM__.renderer;return {c:[...r.camera.position.toArray(),...r.controls.target.toArray()],s:r.state(),rides:r.objects.filter(o=>o.ride).map(o=>o.holder.visible),n:r.objects.length}});
 const g0=await gc();assert(g0.rides.length&&g0.rides.every(Boolean),'garage rides visible '+JSON.stringify(g0.rides));
 await g.getByRole('button',{name:'Place owned item',exact:true}).click();
 await g.waitForFunction(()=>{const s=__WK_ROOM__.renderer.state();return s.placing&&!s.transition},null,{timeout:40000});
 const g1=await gc();assert(g1.rides.every(v=>!v),'garage bikes hidden in place mode');assert(Math.hypot(g1.c[0]-g1.c[3],g1.c[1]-g1.c[4],g1.c[2]-g1.c[5])>Math.hypot(g0.c[0]-g0.c[3],g0.c[1]-g0.c[4],g0.c[2]-g0.c[5])*1.5,'garage wide camera '+JSON.stringify([g0.c,g1.c]));
 assert(await g.locator('[data-garage-place]').isVisible(),'garage place pill');
 await g.locator('.garage-items button:not([aria-label^="Display "]):not([aria-label="Close owned items"])').first().click();
 await g.waitForFunction(()=>{const s=__WK_ROOM__.renderer?.state();return s?.placing&&s.arrange&&!s.dropping&&!s.transition},null,{timeout:15000});
 await g.waitForFunction(gizmoOn,null,{timeout:10000});
 const g2=await g.evaluate(()=>{const r=__WK_ROOM__.renderer,s=r.state(),o=r.objects.find(o=>o.key===s.selected),T=o.holder.position;return {key:s.selected,x:T.x,y:T.y,z:T.z,others:r.objects.filter(q=>q!==o).map(q=>Math.hypot(q.holder.position.x-T.x,q.holder.position.z-T.z)),n:r.objects.length}});
 assert(g2.n===g0.n+1&&Math.abs(g2.y)<1e-6&&Math.hypot(g2.x,g2.z+.2)<2.5&&g2.others.every(d=>d>.4),'garage item dropped near the centre, clear of others '+JSON.stringify(g2));
 if(shots)await g.screenshot({path:shots+'/place-4-garage.png'});
 await g.locator('[data-garage-place] button').click();

 await g.waitForFunction(()=>{const s=__WK_ROOM__.renderer.state();return !s.placing&&!s.transition},null,{timeout:40000});
 const g3=await gc();assert(g3.rides.every(Boolean)&&near(g3.c,g0.c,.02)&&!g3.s.arrange,'garage exit: bikes back, camera to the normal view '+JSON.stringify([g0.c,g3.c]));
 const saved=await g.evaluate(k=>JSON.parse(localStorage.getItem('wk-garage-layout-v1')||'{}').$items?.find(i=>i.uid===k),g2.key);assert(saved&&Math.abs(saved.x-g2.x)<1e-3&&Math.abs(saved.z-g2.z)<1e-3,'garage drop saved '+JSON.stringify(saved));
 assert.deepEqual(gerr,[]);console.log('place-mode garage ok');await g.close();
}finally{await browser.close();}
