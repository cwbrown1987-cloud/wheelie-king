import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const p=await browser.newPage({viewport:{width:1200,height:780},serviceWorkers:'block'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/wk (hook|frame|trax|spokes|detail)/.test(m.text()))errors.push(m.text())});
 await p.addInitScript(()=>localStorage.setItem('wk-builder-mode','advanced'));await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');await p.waitForFunction(()=>globalThis.__WK_VIEW__);
 await p.locator('[data-cat="frame"]').click();await p.waitForFunction(()=>globalThis.__WK_EQUIP__);
 await p.evaluate(()=>__WK_EQUIP__('bike_trax_lime'));await p.waitForFunction(()=>__WK_BUILD__.frame==='trax_lime');
 await p.locator('[data-catpanel="1"]').getByRole('button',{name:/BACK/}).click();
 await p.locator('[data-cat="rear_frame"]').click();await p.locator('[data-wk-part="trax_rear_black"]').click();await p.getByRole('button',{name:'Apply preview',exact:true}).click();await p.waitForFunction(()=>__WK_BUILD__.rear_frame==='trax_rear_black');
 await p.locator('[data-wk-info="trax_rear_lime"]').click();await p.getByText('PART SHEET',{exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>__WK_BUILD__.rear_frame),'trax_rear_black');await p.getByRole('button',{name:'‹',exact:true}).click();
 await p.locator('[data-wk-part="trax_rear_lime"]').click();await p.getByRole('button',{name:'Apply preview',exact:true}).click();await p.waitForFunction(()=>__WK_BUILD__.rear_frame==='trax_rear_lime');
 const report=await p.evaluate(async()=>{
  const T=await import('/vendor/three.module.js'),{createBikeMotion}=await import('/bike-motion.js');
  let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});const A=root.userData.wkAnchors;
  const find=id=>__WK_CAT__().items.find(i=>i.id===id),rig=createBikeMotion(root,__WK_BUILD__,find),world=o=>o.getWorldPosition(new T.Vector3()),point=p=>root.localToWorld(new T.Vector3(...p,0));
  root.updateMatrixWorld(true);const pivot=world(root.getObjectByName('rearFrame:pivot')),head=world(root.getObjectByName('frame:headTube'));
  const chain=root.getObjectByName('wk:model:chain'),plates=chain.children[0],before=new T.Matrix4();plates.getMatrixAt(0,before);
  const samples=[];
  for(const compression of [0,.25,.5,.75,1]) {
   const state=rig.update({distance:.13,driveDistance:.13,rearCompression:compression,frontCompression:compression,travelR:.045,travelF:.06});root.updateMatrixWorld(true);
   const axle=world(root.getObjectByName('rearFrame:axle')),rearEye=world(root.getObjectByName('rearFrame:shockEye')),fixedEye=world(root.getObjectByName('shock:eyeletTop')),movingEye=world(root.getObjectByName('shock:eyeletBottom'));
   let rearWheel;root.traverse(o=>{if(o.isGroup&&/wk:(tyres|motor)/.test(o.parent?.name||'')&&o.children.some(m=>m.name==='wheel:spokes')&&Math.abs(o.position.x-state.rearAxle[0])<.001)rearWheel=o});
   let pedalError=0,pedalCount=0;root.traverse(o=>{if(o.userData.wkPedal){pedalCount++;pedalError=Math.max(pedalError,Math.abs(o.rotation.z),Math.abs(o.position.x-(A.bb[0]+Math.cos(state.crankPhase)*o.userData.wkPedalSide*.14)),Math.abs(o.position.y-(A.bb[1]+Math.sin(state.crankPhase)*o.userData.wkPedalSide*.14)))}});if(pedalCount!==2)throw Error('Expected two separately fitted pedal platforms');
   const crown=world(root.getObjectByName('fork:crown')),frontClearance=crown.distanceTo(point(state.frontAxle))-A.wheelR;
   samples.push({compression,frontClearance,pivotError:world(root.getObjectByName('rearFrame:pivot')).distanceTo(pivot),headError:world(root.getObjectByName('frame:headTube')).distanceTo(head),axleError:axle.distanceTo(world(rearWheel)),radiusError:Math.abs(axle.distanceTo(pivot)-point(A.rearAxle).distanceTo(pivot)),fixedEyeError:fixedEye.distanceTo(point(A.shockFrame)),movingEyeError:movingEye.distanceTo(rearEye),length:fixedEye.distanceTo(movingEye),pedalError,state:{...state}});
  }
  const after=new T.Matrix4();plates.getMatrixAt(0,after);
  return {samples,chainMoved:before.elements.some((v,i)=>Math.abs(v-after.elements[i])>1e-6),rearGroups:root.children.filter(o=>o.name==='wk:part:rear_frame').length,shockGroups:root.children.filter(o=>o.name==='wk:part:shock').length,partPreview:__WK_PREVIEW__.has(find('trax_rear_lime')),badFrame:__WK_FIT__({frame:'bmx'},'trax_rear_lime').status};
 });
 for(const s of report.samples)for(const k of ['pivotError','headError','axleError','radiusError','fixedEyeError','movingEyeError','pedalError'])assert(s[k]<1e-6,`${k}: ${s[k]}`);
 for(const s of report.samples)assert(s.frontClearance>.034,'front tyre must clear fixed fork crown at full compression');
 assert(report.samples.at(-1).length<report.samples[0].length);assert(report.samples.at(-1).state.wheelPhase!==0);assert(report.samples.at(-1).state.crankPhase!==0);assert(report.chainMoved);assert.equal(report.rearGroups,1);assert.equal(report.shockGroups,1);assert(report.partPreview);assert.equal(report.badFrame,'no');
 // Test bench controls are real controls, separate from orbit/pan.
 await p.locator('[data-catpanel="1"]').getByRole('button',{name:/BACK/}).click();
 await p.evaluate(()=>__WK_SETBUILD__({...__WK_BUILD__}));await p.waitForTimeout(250);
 await p.evaluate(()=>{const v=__WK_VIEW__;v.controls.autoRotate=false;v.controls.target.set(-.04,.44,0);v.camera.position.set(.07,.6,1.65);v.controls.update()});
 const slider=p.getByRole('slider',{name:'Test suspension compression'});await slider.fill('0');await slider.dispatchEvent('input');
 mkdirSync('wk-shots/trax-mechanics',{recursive:true});await p.waitForTimeout(2000);await p.screenshot({path:'wk-shots/trax-mechanics/01-rest.png'});
 await slider.fill('1');await slider.dispatchEvent('input');await p.waitForTimeout(350);await p.screenshot({path:'wk-shots/trax-mechanics/02-compressed.png'});
 await p.locator('[data-bench-toggle]').click();await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>__WK_BENCH__.active),true);await p.locator('[data-bench-toggle]').click();
 // No built-in fallback shock may reappear after REMOVE.
 await p.evaluate(()=>__WK_SETBUILD__({...__WK_BUILD__,shock:undefined}));await p.waitForTimeout(200);
 assert.equal(await p.evaluate(()=>{let r;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')r=o.parent});return !!r.getObjectByName('wk:part:shock')}),false);
 await p.evaluate(()=>__WK_EQUIP__('bike_moto'));await p.waitForTimeout(250);
 const noPedals=await p.evaluate(async()=>{const {createBikeMotion}=await import('/bike-motion.js');let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});const rig=createBikeMotion(root,__WK_BUILD__,id=>__WK_CAT__().items.find(p=>p.id===id));rig.update({distance:.2,driveDistance:.2});return {cranks:!!root.getObjectByName('cranks:rotor'),front:root.getObjectByName('motoMid:sprocket').rotation.z}});
 assert.equal(noPedals.cranks,false);assert.notEqual(noPedals.front,0);
 assert.deepEqual(errors,[]);writeFileSync('wk-shots/trax-mechanics/validation.json',JSON.stringify({report,noPedals,errors},null,2));console.log(JSON.stringify({samples:report.samples.length,mountsAligned:true,chainMoved:report.chainMoved,onePartPerSlot:true,bench:true,noPedals,errors}));
} finally {await browser.close();}
