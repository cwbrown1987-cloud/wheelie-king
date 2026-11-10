// Workshop inspect camera: far tap eases home (default zoom unchanged), close tap opens
// inspect orbit with ROTATION / TEST MOTION in the dock, RESET VIEW is gone, X returns home.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8931/',shots=process.env.WK_EDIT_SHOTS;
const camOf=()=>{const v=__WK_VIEW__;return {c:[...v.camera.position.toArray(),...v.controls.target.toArray()],fov:v.camera.fov,min:v.controls.minDistance,max:v.controls.maxDistance,d:v.camera.position.distanceTo(v.controls.target)}};
const chrome=()=>{
  const vis=el=>{if(!el)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0';};
  const text=(sel,name)=>[...document.querySelectorAll(sel)].some(el=>vis(el)&&el.textContent.includes(name));
  return {
    inspect:!!__WK_WORKSHOP_CAM__?.state()?.inspect,
    tweening:!!__WK_WORKSHOP_CAM__?.state()?.tweening,
    far:!!__WK_WORKSHOP_CAM__?.state()?.far,
    dist:__WK_WORKSHOP_CAM__?.state()?.dist,
    dock:vis(document.getElementById('wk-inspect-dock')),
    rotate:vis(document.querySelector('[data-wk-rotate]')),
    bench:vis(document.querySelector('[data-wk-bench]')),
    reset:vis(document.querySelector('[data-wk-reset]')),
    edit:text('#wk-room-dock, [data-wk-place], button','EDIT ROOM')||vis(document.querySelector('#wk-room-dock')),
    ride:text('#wk-room-dock, button','TEST RIDE')||vis(document.querySelector('[data-wk-ride], #wk-room-dock [data-wk-test-ride], #wk-room-dock')),
    rotateInDock:!!document.querySelector('#wk-inspect-dock [data-wk-rotate]'),
    benchInDock:!!document.querySelector('#wk-inspect-dock [data-wk-bench]'),
  };
};
const bikeScreen=()=>{
  const v=__WK_VIEW__;let root;v.scene.traverse(o=>{if(!root&&o.name==='wk:frame')root=o.parent});
  const c=root.position.clone();root.getWorldPosition(c);c.y+=.35;
  const ndc=c.project(v.camera),r=v.renderer.domElement.getBoundingClientRect();
  return {x:r.left+(ndc.x+1)*r.width/2,y:r.top+(1-ndc.y)*r.height/2,ok:Math.abs(ndc.x)<.95&&Math.abs(ndc.y)<.95};
};
try{
 for(const vp of [{width:1024,height:658},{width:844,height:390,mobile:true}]){
  const p=await browser.newPage(pageOptions({viewport:{width:vp.width,height:vp.height},isMobile:!!vp.mobile,hasTouch:!!vp.mobile,deviceScaleFactor:1,serviceWorkers:'block'})),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const tag=vp.width+'x'+vp.height;
  await p.goto(URL0);await p.evaluate(()=>localStorage.removeItem('wk-room-layout-v1'));await p.reload();
  await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&globalThis.__WK_VIEW__?.wkOpeningFramed&&globalThis.__WK_WORKSHOP_CAM__&&__WK_WORKSHOP_PLACE__?.ready(),null,{timeout:180000});
  await p.evaluate(()=>{__WK_VIEW__.controls.autoRotate=false});await p.waitForTimeout(700);
  await p.evaluate(()=>__WK_WORKSHOP_CAM__.home({immediate:true}));
  const cam0=await p.evaluate(camOf);
  const ui0=await p.evaluate(chrome);
  assert.equal(ui0.reset,false,`${tag} RESET VIEW gone `+JSON.stringify(ui0));
  assert.equal(ui0.inspect,false,`${tag} starts at home`);
  assert.equal(ui0.rotate,false,`${tag} ROTATION hidden in normal view`);
  assert.equal(ui0.bench,false,`${tag} TEST MOTION hidden in normal view`);
  assert(ui0.edit,`${tag} EDIT ROOM visible `+JSON.stringify(ui0));
  assert(ui0.ride,`${tag} TEST RIDE visible `+JSON.stringify(ui0));
  if(shots&&!vp.mobile)await p.screenshot({path:shots+'/edit-1-normal.png'});
  if(shots&&vp.mobile)await p.screenshot({path:shots+'/edit-5-phone-normal.png'});

  // orbit far, then tap the bike: eases home, default zoom unchanged
  await p.evaluate(()=>{const v=__WK_VIEW__,dir=v.camera.position.clone().sub(v.controls.target).normalize();v.camera.position.copy(v.controls.target).addScaledVector(dir,v.camera.position.distanceTo(v.controls.target)+1.5);v.controls.update();});
  const far=await p.evaluate(chrome);
  assert(far.far&&far.dist>0.55,`${tag} camera is far `+JSON.stringify(far));
  const hit=await p.evaluate(bikeScreen);
  assert(hit.ok,`${tag} bike on screen `+JSON.stringify(hit));
  await p.mouse.click(hit.x,hit.y);
  await p.waitForFunction(()=>__WK_WORKSHOP_CAM__.state().tweening,null,{timeout:4000}).catch(()=>{});
  await p.waitForFunction(()=>!__WK_WORKSHOP_CAM__.state().tweening&&!__WK_WORKSHOP_CAM__.state().inspect,null,{timeout:8000});
  const home=await p.evaluate(camOf);
  assert.equal(home.fov,cam0.fov,`${tag} fov unchanged after home`);
  assert.equal(home.min,cam0.min,`${tag} min zoom unchanged after home`);
  assert.equal(home.max,cam0.max,`${tag} max zoom unchanged after home`);
  assert(!await p.evaluate(()=>__WK_WORKSHOP_CAM__.state().far),`${tag} snapped home `+JSON.stringify({cam0,home}));
  assert(Math.abs(home.d-cam0.d)<.15,`${tag} home distance `+JSON.stringify({cam0,home}));

  // tap again when close: inspect orbit + dock
  const hit2=await p.evaluate(bikeScreen);
  await p.mouse.click(hit2.x,hit2.y);
  await p.waitForFunction(()=>__WK_WORKSHOP_CAM__.state().inspect&&!__WK_WORKSHOP_CAM__.state().tweening,null,{timeout:8000});
  const ins=await p.evaluate(camOf),ui1=await p.evaluate(chrome);
  assert(ui1.dock&&ui1.rotate&&ui1.bench&&ui1.rotateInDock&&ui1.benchInDock,`${tag} inspect dock has ROTATION + TEST MOTION `+JSON.stringify(ui1));
  assert.equal(ui1.reset,false,`${tag} RESET VIEW still gone in inspect`);
  assert(ins.d<cam0.d*.9,`${tag} inspect is closer `+JSON.stringify({cam0,ins}));
  assert(ins.min>cam0.min||ins.max<cam0.max,`${tag} inspect uses tighter zoom `+JSON.stringify({cam0,ins}));
  assert.equal(ins.fov,cam0.fov,`${tag} fov unchanged in inspect`);
  if(shots&&!vp.mobile)await p.screenshot({path:shots+'/edit-2-inspect.png'});
  if(shots&&vp.mobile)await p.screenshot({path:shots+'/edit-6-phone-inspect.png'});

  // X leaves inspect, camera + zoom back
  await p.locator('[data-wk-inspect-exit]').click();
  await p.waitForFunction(()=>!__WK_WORKSHOP_CAM__.state().inspect&&!__WK_WORKSHOP_CAM__.state().tweening,null,{timeout:8000});
  const back=await p.evaluate(camOf),ui2=await p.evaluate(chrome);
  assert.equal(ui2.inspect,false);assert.equal(ui2.dock,false);assert.equal(ui2.rotate,false);assert.equal(ui2.bench,false);
  assert.equal(back.fov,cam0.fov);assert.equal(back.min,cam0.min);assert.equal(back.max,cam0.max);
  assert(Math.abs(back.d-cam0.d)<.15,`${tag} exit restores home `+JSON.stringify({cam0,back}));
  assert(ui2.edit&&ui2.ride,`${tag} room dock back `+JSON.stringify(ui2));
  if(shots&&!vp.mobile)await p.screenshot({path:shots+'/edit-3-exit.png'});

  // place-mode Done still eases home without changing zoom (hook + existing place-mode test)
  await p.locator('[data-wk-place]').click();
  await p.waitForFunction(()=>__WK_WORKSHOP_PLACE__.placeMode.state().on&&!__WK_WORKSHOP_PLACE__.placeMode.state().tweening,null,{timeout:10000});
  await p.locator('#wk-place-mode [data-wk-place-exit]').click();
  await p.waitForFunction(()=>!__WK_WORKSHOP_PLACE__.placeMode.state().on,null,{timeout:10000});
  const afterPlace=await p.evaluate(camOf);
  assert.equal(afterPlace.fov,cam0.fov);assert.equal(afterPlace.min,cam0.min);assert.equal(afterPlace.max,cam0.max);
  assert.deepEqual(errors,[]);await p.close();console.log('edit-camera',tag,'ok',JSON.stringify({home: +home.d.toFixed(2),inspect:+ins.d.toFixed(2)}));
 }
}finally{await browser.close()}
