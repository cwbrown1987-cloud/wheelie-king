import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
mkdirSync('wk-shots/vehicle-prototypes',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:1400,height:820},serviceWorkers:'block'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/^wk (hook|frame|modular)/.test(m.text()))errors.push(m.text())});
 await p.goto('http://127.0.0.1:8931/');await p.waitForFunction(()=>globalThis.__WK_EQUIP__&&document.querySelector('[data-simple-category="escooters"] img'));
 for(const [id,section]of [['pit125','motorbikes'],['kaiji_test','escooters']]){
  await p.locator(`[data-simple-category="${section}"]`).click();assert.equal(await p.locator('#wk-builder [data-simple-part]').count(),1);
  await p.locator(`[data-simple-part="bike_${id}"]`).click();await p.getByRole('button',{name:'Apply preview',exact:true}).click();await p.waitForFunction(id=>__WK_BUILD__.frame===id,id);
  const r=await p.evaluate(async id=>{
   const {createBikeMotion}=await import('/bike-motion.js'),{cloneForRide}=await import('/ride.js');let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});
   const b=__WK_BUILD__,ready=__WK_BUILD_READY__(b),variants=Object.values(b).flatMap(id=>__WK_VARIANTS__(id));
   const clone=cloneForRide(root),motion=createBikeMotion(clone,b,__WK_PART__),before=clone.getObjectByName('fork:lower-1').position.clone();
   motion.update({distance:2,frontCompression:.7,rearCompression:.7,travelF:__WK_PART__(b.suspension).travel,travelR:__WK_PART__(b.shock).travel});
   const after=clone.getObjectByName('fork:lower-1').position,other=id==='pit125'?'kaiji_test_motor':'pit125_motor';
   return {ready,variants:variants.every(v=>__WK_FIT__({...b,[v.slot]:v.id},v.id).status==='ok'),cross:__WK_FIT__(b,other).status,bicycle:__WK_FIT__(b,'kenda').status,phase:motion.state.wheelPhase,rearAngle:motion.state.rearAngle,forkTravel:after.distanceTo(before),cranks:!!root.getObjectByName('cranks:rotor'),engine:!!root.getObjectByName('engine:crankcase'),deck:!!root.getObjectByName('scooter:deck'),chain:!!root.getObjectByName('wk:model:chain'),battery:!!b.battery,stats:__WK_VEHICLE_STATS__(b),anchors:root.userData.wkAnchors};
  },id);
  assert(r.ready.ready&&r.variants);assert.equal(r.cross,'no');assert.equal(r.bicycle,'no');assert(!r.cranks);assert(r.phase<0&&Math.abs(r.rearAngle)>.001&&r.forkTravel>.01);assert(r.stats.P>0&&r.stats.warn.length===0);
  if(id==='pit125')assert(r.engine&&r.chain&&!r.battery&&r.stats.powertrain==='petrol');else assert(r.deck&&r.battery&&!r.chain&&!r.engine);
  await p.locator('#wk-builder').getByRole('button',{name:'‹ Back',exact:true}).click();await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click().catch(()=>{});
  await p.waitForTimeout(500);await p.screenshot({path:`wk-shots/vehicle-prototypes/${id}-workshop.png`});
  await p.locator(`[data-simple-category="${section}"]`).click();await p.getByRole('button',{name:'Matching vehicle parts',exact:true}).click();assert(await p.locator('#wk-builder [data-simple-part]').count()>15);await p.locator('#wk-builder').getByRole('button',{name:'‹ Back',exact:true}).click();await p.locator('#wk-builder').getByRole('button',{name:'‹ Back',exact:true}).click();
  // Cancel and apply use the same preview flow and family-preserving variants.
  await p.locator('[data-simple-category="style"]').click();await p.getByRole('button',{name:'Frame colour',exact:true}).click();await p.locator(`[data-simple-part="${id}__blue"]`).click();await p.getByRole('button',{name:'Cancel preview',exact:true}).click();assert.equal(await p.evaluate(()=>__WK_BUILD__.frame),id);await p.locator(`[data-simple-part="${id}__blue"]`).click();await p.getByRole('button',{name:'Apply preview',exact:true}).click();await p.locator('#wk-builder').getByRole('button',{name:'‹ Back',exact:true}).click();await p.locator('#wk-builder').getByRole('button',{name:'‹ Back',exact:true}).click();
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();await p.waitForFunction(()=>globalThis.__WK_RIDE_SCENE__&&globalThis.__WK_RIDE_STATE__?.().backdropLoaded);
  const feet=await p.evaluate(async()=>{const T=await import('/vendor/three.module.js'),scene=__WK_RIDE_SCENE__().scene;scene.updateMatrixWorld(true);let bike;scene.traverse(o=>{if(o.name==='wk:frame')bike=o.parent});return [-1,1].map((side,i)=>{const pos=bike.worldToLocal(scene.getObjectByName('rider:shoe'+side).getWorldPosition(new T.Vector3())),target=new T.Vector3(...bike.userData.wkAnchors.footTargets[i]);return pos.distanceTo(target)})});assert(feet.every(d=>d<1e-5),'feet must stay on their deck/peg anchors');
  await p.keyboard.down('ArrowUp');await p.waitForFunction(()=>__WK_RIDE_STATE__().s.x>3,{},{timeout:15000});await p.keyboard.up('ArrowUp');
  assert(await p.evaluate(()=>{const r=__WK_RIDE_STATE__();return !r.s.crashed&&Number.isFinite(r.s.y)&&Math.abs(r.mechanical.wheelPhase)>.01}));
  await p.getByRole('button',{name:'Pause ride',exact:true}).click();await p.screenshot({path:`wk-shots/vehicle-prototypes/${id}-ride.png`});
  await p.evaluate(()=>{const s=__WK_RIDE_STATE__().s;s.crashed='TEST IMPACT';s.events.push({type:'crash',why:'TEST IMPACT'})});await p.getByRole('button',{name:'Resume ride',exact:true}).click();await p.waitForFunction(()=>__WK_RIDE_STATE__().crash?.separated);await p.getByRole('button',{name:'Instant recover',exact:true}).click();await p.waitForFunction(()=>!__WK_RIDE_STATE__().s.crashed&&!__WK_RIDE_STATE__().crash);
  await p.locator('[data-r="back"]').click();await p.locator('[data-ride="portal"]').waitFor({state:'detached'});await p.waitForTimeout(350);
  console.log(`PASS ${id}: fitment, variants, preview, suspension, drivetrain and ride`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
