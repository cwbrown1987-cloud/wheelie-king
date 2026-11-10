// Built-in shelves and tool chests become movable items. Remove sends them to a
// Storage section in the place picker; they can be placed again and persist in the save.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();
const URL0=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const shots=process.env.WK_STORAGE_SHOTS;
try{
 const run=async vp=>{
  const p=await browser.newPage(pageOptions({viewport:{width:vp.width,height:vp.height},isMobile:!!vp.mobile,hasTouch:!!vp.mobile,deviceScaleFactor:1,serviceWorkers:'block'})),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const tag=vp.width+'x'+vp.height;
  await p.goto(URL0);
  await p.evaluate(()=>localStorage.removeItem('wk-room-layout-v1'));
  await p.reload();
  await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&__WK_WORKSHOP_PLACE__?.ready(),null,{timeout:180000});
  await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});
  await p.evaluate(()=>{__WK_VIEW__.controls.autoRotate=false});
  const boot=await p.evaluate(()=>{const P=__WK_WORKSHOP_PLACE__,c=__WK_VIEW__.controls,fx=P.fixtures(),list=P.list();
   return {chests:fx.filter(f=>f.type==='toolChest').length,shelves:fx.filter(f=>f.type==='shelving').length,n:fx.length,listed:list.filter(i=>i.fixture).length,storage:P.storage().length,min:c.minDistance,max:c.maxDistance,fov:__WK_VIEW__.camera.fov,ids:fx.map(f=>f.id)};});
  assert.equal(boot.chests,7,JSON.stringify(boot));
  assert.equal(boot.shelves,6,JSON.stringify(boot));
  assert.equal(boot.n,13);assert.equal(boot.listed,13);assert.equal(boot.storage,0);
  assert.equal(boot.min,.12);assert.equal(boot.max,4.2);assert.equal(boot.fov,32);
  // a leftover baked collider would block a tiny nudge off the default pose
  const nudge=await p.evaluate(()=>{const P=__WK_WORKSHOP_PLACE__,it=P.list().find(i=>i.item==='fixture:toolChest:0'),ox=it.x,oz=it.z;
   const dirs=[{x:ox+.05,z:oz},{x:ox-.05,z:oz},{x:ox,z:oz+.05},{x:ox,z:oz-.05}];
   let v=null,now=null;for(const pos of dirs){v=P.move(it.uid,pos);now=P.list().find(i=>i.uid===it.uid);if(v.ok){P.move(it.uid,{x:ox,z:oz});break;}}
   return {ok:!!v?.ok,reason:v?.reason,hit:v?.hit,uid:it.uid,from:[ox,oz],to:now?[now.x,now.z]:null};});
  assert(nudge.ok,'chest moves off its default pose without clipping '+JSON.stringify(nudge));
  // move a shelf to a free floor spot (no leftover bake, no overlap)
  const moved=await p.evaluate(()=>{const P=__WK_WORKSHOP_PLACE__,sh=P.list().find(i=>i.item.startsWith('fixture:shelving:')),prev={uid:sh.uid,item:sh.item,x:sh.x,z:sh.z,yaw:sh.yaw};
   const spots=[{x:-4.15,z:2.3},{x:2.6,z:1.6},{x:4.05,z:3.9},{x:-3.0,z:4.6}];
   let hit=null;for(const pos of spots){const v=P.move(sh.uid,pos);if(v.ok){hit={ok:true,pos,now:P.list().find(i=>i.uid===sh.uid)};break;}}
   return {prev,hit};});
  assert(moved.hit?.ok,'shelf moves to a free spot without clipping '+JSON.stringify(moved));
  if(shots)await p.screenshot({path:shots+'/storage-'+tag+'-moved-shelf.png'});
  // remove -> storage
  const gone=await p.evaluate(uid=>{const P=__WK_WORKSHOP_PLACE__;P.remove(uid);
   const store=JSON.parse(localStorage.getItem('wk-room-layout-v1')).rooms.workshop;
   return {listed:P.list().some(i=>i.uid===uid),storage:P.storage(),fixtures:P.list().filter(i=>i.fixture).length,saved:store.storage,savedItems:store.items.some(i=>i.uid===uid)};},moved.prev.uid);
  assert(!gone.listed&&!gone.savedItems&&gone.storage.some(s=>s.uid===moved.prev.uid)&&gone.saved.some(s=>s.uid===moved.prev.uid),JSON.stringify(gone));
  assert.equal(gone.fixtures,12);
  // picker shows a Storage section and the removed shelf
  await p.locator('[data-wk-place]').click();
  await p.waitForSelector('#wk-place-panel .sheet');
  const panel=await p.evaluate(()=>{const secs=[...document.querySelectorAll('#wk-place-panel .sec')].map(e=>e.textContent.trim());
   const stored=[...document.querySelectorAll('#wk-place-panel [data-stored]')].map(e=>({id:e.dataset.placeItem,label:e.querySelector('strong')?.textContent,note:e.querySelector('small')?.textContent}));
   return {secs,stored,visible:!!document.querySelector('#wk-place-panel')&&!document.getElementById('wk-place-panel').hidden};});
  assert(panel.visible&&panel.secs[0]==='Storage'&&panel.secs.includes('Place'),JSON.stringify(panel));
  assert(panel.stored.some(c=>c.id===moved.prev.item),'stored card '+JSON.stringify(panel));
  if(shots)await p.screenshot({path:shots+'/storage-'+tag+'-picker.png'});
  // re-place from the Storage card, then confirm
  await p.locator('#wk-place-panel [data-stored]').first().click();
  await p.waitForFunction(()=>__WK_WORKSHOP_PLACE__.state().arrange&&__WK_WORKSHOP_PLACE__.state().pending,null,{timeout:8000});
  await p.evaluate((pos,uid)=>{const P=__WK_WORKSHOP_PLACE__;P.dragTo(pos.x,pos.z);},moved.hit.pos,moved.prev.uid);
  await p.waitForTimeout(200);
  assert(!(await p.locator('[data-wk-place-confirm]').isDisabled()),'re-place confirm enabled');
  await p.locator('[data-wk-place-confirm]').click();
  const back=await p.evaluate(uid=>{const P=__WK_WORKSHOP_PLACE__,it=P.list().find(i=>i.uid===uid);
   return {it,storage:P.storage(),saved:JSON.parse(localStorage.getItem('wk-room-layout-v1')).rooms.workshop};},moved.prev.uid);
  assert(back.it&&Math.hypot(back.it.x-moved.hit.pos.x,back.it.z-moved.hit.pos.z)<.2&&!back.storage.length&&!back.saved.storage.length&&back.saved.items.some(i=>i.uid===moved.prev.uid),JSON.stringify(back));
  if(shots)await p.screenshot({path:shots+'/storage-'+tag+'-replaced.png'});
  // persist the new pose across reload; also a removed catalog item stays in storage
  const extra=await p.evaluate(uid=>{const P=__WK_WORKSHOP_PLACE__,spots=[{x:2.6,z:1.6},{x:4.05,z:3.9},{x:-3.0,z:4.6}];
   let a=null;for(const pos of spots){a=P.add('red-chest',pos);if(a)break;}P.remove(uid);
   return {a,storage:P.storage(),shelfGone:!P.list().some(i=>i.uid===uid),chest:P.list().find(i=>i.uid===a)};},moved.prev.uid);
  assert(extra.a&&extra.shelfGone&&extra.chest&&extra.storage.some(s=>s.uid===moved.prev.uid),JSON.stringify(extra));
  await p.reload();
  await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&__WK_WORKSHOP_PLACE__?.ready(),null,{timeout:180000});
  const after=await p.evaluate((shelf,chest)=>{const P=__WK_WORKSHOP_PLACE__;
   return {shelf:P.list().find(i=>i.uid===shelf),chest:P.list().find(i=>i.uid===chest),storage:P.storage(),fixtures:P.list().filter(i=>i.fixture).length,min:__WK_VIEW__.controls.minDistance,max:__WK_VIEW__.controls.maxDistance,fov:__WK_VIEW__.camera.fov};},moved.prev.uid,extra.a);
  assert(!after.shelf&&after.chest&&after.storage.some(s=>s.uid===moved.prev.uid)&&after.storage.every(s=>s.uid!==extra.a),JSON.stringify(after));
  assert.equal(after.fixtures,12);
  assert.equal(after.min,.12);assert.equal(after.max,4.2);assert.equal(after.fov,32);
  // cancel of a storage re-place returns the item to Storage
  await p.locator('[data-wk-place]').click();
  await p.locator('#wk-place-panel [data-stored]').first().click();
  await p.waitForFunction(()=>__WK_WORKSHOP_PLACE__.state().pending,null,{timeout:8000});
  await p.locator('#wk-place-bar [aria-label="Cancel placing"]').click();
  const cancelled=await p.evaluate(uid=>({listed:__WK_WORKSHOP_PLACE__.list().some(i=>i.uid===uid),storage:__WK_WORKSHOP_PLACE__.storage().some(s=>s.uid===uid)}),moved.prev.uid);
  assert(!cancelled.listed&&cancelled.storage,'cancel keeps the item in storage '+JSON.stringify(cancelled));
  assert.deepEqual(errors,[]);
  await p.close();
  console.log('PASS workshop-storage',tag,JSON.stringify({movedTo:moved.hit.pos,uid:moved.prev.uid}));
 };
 await run({width:1024,height:658});
 await run({width:844,height:390,mobile:true});
}finally{await browser.close();}
