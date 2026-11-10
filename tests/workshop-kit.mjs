// 360° kit workshop: room loads, original camera limits, no turntable, placement
// collision (walls / props / items / zones / ceiling), move + rotate, persistence,
// garage saves untouched.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const GARAGE='{"$items":[{"uid":"garage:shelf","itemId":"display_shelf","x":-2.25,"z":-1.3,"y":0,"yaw":0.18}],"$furniture":1}';
try{
 const p=await browser.newPage(pageOptions({viewport:{width:1024,height:658},serviceWorkers:'block'})),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(URL0);
 await p.evaluate(g=>{localStorage.setItem('wk-garage-layout-v1',g);localStorage.removeItem('wk-room-layout-v1');},GARAGE);
 await p.reload();
 const ready=()=>p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&globalThis.__WK_WORKSHOP_PLACE__?.ready(),null,{timeout:120000});
 await ready();
 await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});
 const room=await p.evaluate(()=>{const v=__WK_VIEW__,c=v.controls,s=v.scene;let turntable=false,oldBoard=false;s.traverse(o=>{if(/turntable|turn-base/i.test(o.name))turntable=true;if(o.name==='garage:tool-board')oldBoard=true;});
  return {state:v.worldRoom.state(),min:c.minDistance,max:c.maxDistance,pol:c.maxPolarAngle,fov:v.camera.fov,turntable,oldBoard,active:__WK_SHARED_WORLD__.getActive()};});
 assert.equal(room.active,'workshop');
 assert(room.state.kit&&room.state.worldRoom&&room.state.props>50&&room.state.art==='art-room',JSON.stringify(room.state));
 assert.equal(room.min,.12);assert.equal(room.max,4.2);assert(Math.abs(room.pol-Math.PI*.53)<1e-9);assert.equal(room.fov,32);
 assert(!room.turntable,'no turntable');assert(!room.oldBoard,'old procedural tool board replaced');
 assert(room.state.propDrawCalls<=25,'prop draw calls '+room.state.propDrawCalls);
 // collision probes
 const probes=await p.evaluate(()=>{const P=__WK_WORKSHOP_PLACE__;return {
  wall:P.check('red-chest',{x:5.3,z:1.5,yaw:0}),
  prop:P.check('red-chest',{x:1.5,z:-3.0,yaw:0}),
  bike:P.check('red-chest',{x:0,z:.3,yaw:0}),
  door:P.check('red-chest',{x:0,z:6.2,yaw:0}),
  ceiling:P.check('neon-purple',{x:5.38,y:3.55,z:4.3,yaw:-Math.PI/2}),
  free:P.check('red-chest',{x:-4.15,z:2.3,yaw:0}),
  freeWall:P.check('tool-wall',{x:5.383,y:1.6,z:4.3,yaw:-Math.PI/2}),
 }});
 assert.equal(probes.wall.reason,'wall',JSON.stringify(probes));
 assert.equal(probes.prop.reason,'item',JSON.stringify(probes));
 assert.equal(probes.bike.reason,'zone',JSON.stringify(probes));
 assert.equal(probes.door.reason,'zone',JSON.stringify(probes));
 assert.equal(probes.ceiling.reason,'ceiling',JSON.stringify(probes));
 assert(probes.free.ok&&probes.freeWall.ok,JSON.stringify(probes));
 // place, overlap other item, move, rotate
 const act=await p.evaluate(()=>{const P=__WK_WORKSHOP_PLACE__;const a=P.add('red-chest',{x:-4.15,z:2.3,yaw:0});const over=P.check('blue-chest',{x:-4.0,z:2.35,yaw:.3});const b=P.add('trolley',{x:-3.0,z:4.6,yaw:0});
  const badMove=P.move(a,{x:5.2,z:1.5});const afterBad=P.list().find(i=>i.uid===a);const goodMove=P.move(a,{x:-3.9,z:2.0});const rot=P.rotate(a,.6);const rotBad=P.rotate(b,0);
  return {a,b,over,badMove,afterBad,goodMove,rot,list:P.list()};});
 assert(act.a&&act.b,JSON.stringify(act));
 assert.equal(act.over.reason,'item',JSON.stringify(act.over));
 assert(!act.badMove.ok&&Math.abs(act.afterBad.x+4.15)<1e-6,'blocked move leaves item in place');
 assert(act.goodMove.ok&&act.rot.ok,JSON.stringify(act));
 const A=act.list.find(i=>i.uid===act.a);assert(Math.abs(A.yaw-.6)<1e-6&&Math.hypot(A.x+3.9,A.z-2.0)<.35&&Math.abs(A.z-2.3)>.01,JSON.stringify(A));
 // UI flow: place button -> panel -> card -> preview -> blocked/valid -> confirm
 await p.locator('[data-wk-place]').click();
 await p.locator('[data-place-item="trolley"]').click();
 const pend=await p.evaluate(()=>__WK_WORKSHOP_PLACE__.state());assert(pend.pending&&pend.arrange,JSON.stringify(pend));
 await p.evaluate(()=>__WK_WORKSHOP_PLACE__.dragTo(1.5,-2.95));
 await p.waitForTimeout(200);
 assert(await p.locator('[data-wk-place-confirm]').isDisabled(),'confirm disabled when blocked');
 await p.evaluate(()=>__WK_WORKSHOP_PLACE__.dragTo(2.6,1.6));
 await p.waitForTimeout(200);
 assert(!(await p.locator('[data-wk-place-confirm]').isDisabled()),'confirm enabled when free');
 await p.getByRole('button',{name:'Rotate left',exact:true}).click();
 await p.locator('[data-wk-place-confirm]').click();
 const placed=await p.evaluate(()=>__WK_WORKSHOP_PLACE__.list());const player=l=>l.filter(i=>!String(i.item).startsWith('fixture:'));assert.equal(player(placed).length,3,JSON.stringify(player(placed)));assert.equal(placed.filter(i=>i.fixture).length,13);
 // persistence + garage untouched
 const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('wk-room-layout-v1')).rooms.workshop.items);
 assert.equal(player(stored).length,3);assert.equal(stored.length,16);
 await p.reload();await ready();
 const after=await p.evaluate(()=>({list:__WK_WORKSHOP_PLACE__.list(),garage:localStorage.getItem('wk-garage-layout-v1'),meshes:__WK_VIEW__.scene.getObjectByName('workshop:placed').children.length}));
 assert.equal(player(after.list).length,3);assert.equal(after.list.length,16);assert.equal(after.meshes,16);
 assert.deepEqual(after.list.map(i=>[i.item,+i.x.toFixed(3),+i.z.toFixed(3),+i.yaw.toFixed(3)]).sort(),placed.map(i=>[i.item,+i.x.toFixed(3),+i.z.toFixed(3),+i.yaw.toFixed(3)]).sort());
 assert.equal(after.garage,GARAGE,'garage save untouched');
 assert.deepEqual(errors,[]);
 console.log('PASS workshop-kit',JSON.stringify({state:room.state,probes:Object.fromEntries(Object.entries(probes).map(([k,v])=>[k,v.reason||'ok'])),items:after.list.length}));
}finally{await browser.close();}
