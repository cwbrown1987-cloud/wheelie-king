import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';

import {mkdirSync} from 'node:fs';
const browser=await launchBrowser();
mkdirSync('wk-shots/shared-world',{recursive:true});
try{
 const p=await browser.newPage(pageOptions({viewport:{width:1280,height:720},serviceWorkers:'block'})),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
 await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&globalThis.__WK_SHARED_WORLD__);
 await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click().catch(()=>{});

 // Registry + door links
 const registry=await p.evaluate(async()=>{
  const {ROOMS,doorLink,listDoors}=await import('/world-rooms.js');
  return {
   ids:Object.keys(ROOMS),
   workshopDoors:ROOMS.workshop.doors.map(d=>d.target),
   garageLink:!!doorLink('workshop','garage'),
   outsideStub:ROOMS.outside.stub&&listDoors().some(d=>d.stub&&d.target==='outside'),
   skateStub:ROOMS.skatepark.stub,
  };
 });
 assert.deepEqual(registry.ids.sort(),['garage','outside','skatepark','workshop'].sort());
 assert(registry.garageLink);
 assert(registry.outsideStub&&registry.skateStub);
 assert(registry.workshopDoors.includes('garage')&&registry.workshopDoors.includes('outside'));

 // Camera lock: maxDistance capped unless unlimited zoom
 const locked=await p.evaluate(()=>{
  const c=__WK_VIEW__.controls;
  return {min:c.minDistance,max:c.maxDistance,unlimited:!!__WK_UNLIMITED_ZOOM__?.enabled,active:__WK_SHARED_WORLD__.getActive()};
 });
 assert.equal(locked.active,'workshop');
 // Chris's original workshop zoom (81b7512 / app.js): exactly 0.12..4.2, polar 0.53π, far 50.
 assert.equal(locked.max,4.2,JSON.stringify(locked));
 assert.equal(locked.min,0.12,JSON.stringify(locked));
 const cam=await p.evaluate(()=>({pol:__WK_VIEW__.controls.maxPolarAngle,far:__WK_VIEW__.camera.far,fov:__WK_VIEW__.camera.fov}));
 assert(Math.abs(cam.pol-Math.PI*.53)<1e-9&&cam.far===50&&cam.fov===32,JSON.stringify(cam));

 // Workshop props present
 const props=await p.evaluate(()=>{
  const s=__WK_VIEW__.scene;
  return {
   shell:!!s.getObjectByName('workshop:shell'),
   props:!!s.getObjectByName('workshop:props'),
   placed:!!s.getObjectByName('workshop:placed'),
   turntable:!!s.getObjectByName('workshop:turntable')||!!s.getObjectByName('workshop:turn-base'),
   oldBoard:!!s.getObjectByName('garage:tool-board'),
   kit:__WK_VIEW__.worldRoom.state().kit,
   theme:__WK_VIEW__.worldRoom.state().theme,
  };
 });
 // 360° kit workshop: art shell + modelled kit props + placement layer, no turntable circle.
 assert(props.shell&&props.props&&props.placed&&props.kit&&!props.turntable&&!props.oldBoard,JSON.stringify(props));
 assert.equal(props.theme,'workshop');

 // Warm garage lazily, then transition workshop -> garage
 await p.evaluate(()=>__WK_SHARED_WORLD__.state());
 await p.waitForTimeout(1500); // allow lazy garage load
 const before=Date.now();
 await p.evaluate(()=>__WK_SHARED_WORLD__.transitionTo('garage'));
 await p.waitForFunction(()=>__WK_SHARED_WORLD__.getActive()==='garage'&&!__WK_SHARED_WORLD__.state().transitioning,{timeout:12000});
 const elapsed=Date.now()-before;
 assert(elapsed>=800&&elapsed<=12000,`transition ${elapsed}ms`);
 const after=await p.evaluate(()=>({active:__WK_SHARED_WORLD__.getActive(),rooms:__WK_SHARED_WORLD__.state().rooms,max:__WK_VIEW__.controls.maxDistance}));
 assert.equal(after.active,'garage');
 assert(after.rooms.includes('garage'));
 assert(after.max<=8+1e-6);

 // Door go-through back to workshop
 await p.evaluate(()=>__WK_SHARED_WORLD__.goThroughDoor('garage-to-workshop'));
 await p.waitForFunction(()=>__WK_SHARED_WORLD__.getActive()==='workshop'&&!__WK_SHARED_WORLD__.state().transitioning,{timeout:5000});

 // Unlimited zoom unlocks distance
 await p.evaluate(()=>__WK_UNLIMITED_ZOOM__.set(true));
 await p.waitForTimeout(400);
 const open=await p.evaluate(()=>({max:__WK_VIEW__.controls.maxDistance,unlimited:__WK_UNLIMITED_ZOOM__.enabled}));
 assert(open.unlimited&&open.max>1000);

 // Draw call / FPS sample
 const perf=await p.evaluate(async()=>{
  const v=__WK_VIEW__,r=v.renderer;
  r.info.reset();
  const t0=performance.now();
  for(let i=0;i<30;i++){r.render(v.scene,v.camera);}
  const ms=performance.now()-t0;
  return {calls:r.info.render.calls,tris:r.info.render.triangles,ms,fps:Math.round(30000/ms)};
 });

 await p.screenshot({path:'wk-shots/shared-world/workshop.png',timeout:10000,animations:'disabled'}).catch(()=>{});
 assert.deepEqual(errors,[]);
 console.log('PASS shared-world registry/doors/transition/camera-lock',JSON.stringify({registry,locked,props,after,open,perf,elapsed}));
}finally{await browser.close();}
