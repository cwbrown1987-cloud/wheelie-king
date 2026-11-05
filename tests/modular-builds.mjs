import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const p=await browser.newPage({viewport:{width:1200,height:780},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/wk (modular|frame|hook|trax|detail)/.test(m.text()))errors.push(m.text())});
 await p.addInitScript(()=>localStorage.setItem('wk-builder-mode','advanced'));await p.goto('http://127.0.0.1:8931/');await p.waitForFunction(()=>globalThis.__WK_VIEW__);await p.locator('[data-cat="bars"]').click();await p.waitForFunction(()=>globalThis.__WK_EQUIP__);
 const kits=await p.evaluate(()=>__WK_CAT__().items.filter(p=>p.id.startsWith('bike_')).map(p=>p.id)),report=[];
 mkdirSync('wk-shots/modular',{recursive:true});
 for(const id of kits) {
  assert.equal(await p.evaluate(id=>__WK_EQUIP__(id),id),true,id);await p.waitForTimeout(200);
  const r=await p.evaluate(()=>{let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});const b={...__WK_BUILD__},bad=Object.entries(b).filter(([s,id])=>__WK_FIT__(b,id).status!=='ok');let duplicates=0;const groups=root.children.map(o=>o.name);for(const name of new Set(groups))if(name.startsWith('wk:part:')&&groups.filter(n=>n===name).length>1)duplicates++;
   const variants=Object.entries(b).flatMap(([s,id])=>__WK_VARIANTS__(id).map(v=>({slot:s,id:v.id,fit:__WK_FIT__({...b,[s]:v.id},v.id).status})));return {frame:b.frame,build:b,bad,duplicates,variantsBad:variants.filter(v=>v.fit!=='ok'),ready:__WK_BUILD_READY__(b).ready,rear:!!root.getObjectByName('wk:part:rear_frame'),stem:!!root.getObjectByName('wk:part:stem'),pedals:!!root.getObjectByName('wk:part:pedals')};});
  assert.deepEqual(r.bad,[]);assert.deepEqual(r.variantsBad,[]);assert.equal(r.duplicates,0);assert(r.ready&&r.stem&&(r.frame==='kaiji_test'||r.pedals),JSON.stringify(r));if(['trax_lime','mtb_fs','moto','emoto'].includes(r.frame))assert(r.rear);
  report.push(r);
 }
 // Bare frames really have no hidden handlebars, fork, shock or drivetrain.
 await p.evaluate(()=>__WK_SETBUILD__({frame:'emoto'}));await p.waitForTimeout(200);
 const bare=await p.evaluate(()=>{let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});return {ready:__WK_BUILD_READY__(__WK_BUILD__).ready,shock:!!root.getObjectByName('wk:model:shock'),rear:!!root.getObjectByName('wk:model:rearFrame'),bars:!!root.getObjectByName('wk:model:bars'),panels:!!root.getObjectByName('emoto:sidePanelR'),motor:root.getObjectByName('wk:motor')?.children.length,seat:root.getObjectByName('wk:seat')?.children.length};});
 assert.deepEqual(bare,{ready:false,shock:false,rear:false,bars:false,panels:false,motor:0,seat:0});
 await p.evaluate(()=>__WK_EQUIP__('bike_trax_lime'));await p.waitForTimeout(200);
 // Removing a purchased grip pair must expose the bare bars, not leave stock grips.
 await p.evaluate(()=>__WK_SETBUILD__({...__WK_BUILD__,grips:undefined}));await p.waitForTimeout(200);
 const gripCount=()=>p.evaluate(()=>{let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});let n=0;root.traverse(o=>{if(o.isMesh&&o.name.startsWith('grips:'))n++});return n});
 assert.equal(await gripCount(),0,'removed grips must leave the bike');
 assert(await p.evaluate(()=>__WK_EQUIP__('grip_std__blue')));await p.waitForTimeout(200);assert.equal(await gripCount(),2,'refitted grips must replace the pair');
 // Real UI swatch clicks must fit and colour the selected part, retaining the TRAX interfaces.
 await p.locator('[data-catpanel="1"]').getByRole('button',{name:/BACK/}).click();await p.locator('[data-cat="rear_frame"]').click();
 await p.locator('[data-wk-swatch="trax_rear_lime__blue"]').click();await p.getByRole('button',{name:'Apply preview',exact:true}).click();await p.waitForFunction(()=>__WK_BUILD__.rear_frame==='trax_rear_lime__blue');
 const color=await p.evaluate(()=>{let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});return root.getObjectByName('rearFrame:chainstay1').material.color.getHexString()});assert.equal(color,'287bc4');
 await p.locator('[data-wk-info="trax_rear_lime"]').click();await p.getByText('PART SHEET',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>__WK_BUILD__.rear_frame),'trax_rear_lime__blue');await p.getByRole('button',{name:'‹',exact:true}).click();
 // Compatibility is unchanged by colour selection; physically mismatched interfaces stay rejected.
 const rejected=await p.evaluate(()=>({rear:__WK_FIT__({frame:'bmx'},'rear_emoto__red').status,rim:__WK_FIT__({frame:'bmx'},'rim_29__red').status,post:__WK_FIT__({frame:'trax_lime'},'post_316__red').status,stem:__WK_FIT__({frame:'bmx',bars:'bar_bmx'},'stem_moto__red').status,shock:__WK_FIT__({frame:'trax_lime'},'shk_moto230__blue').status,hub:__WK_FIT__({frame:'mtb_ht'},'hubs_135qr__red').status}));
 assert(Object.values(rejected).every(v=>v==='no'));
 await p.locator('[data-catpanel="1"]').getByRole('button',{name:/BACK/}).click();await p.evaluate(()=>{const v=__WK_VIEW__;v.controls.autoRotate=false;v.controls.target.set(.12,.52,0);v.camera.position.set(.5,.8,2.6);v.controls.update()});await p.waitForTimeout(2000);await p.screenshot({path:'wk-shots/modular/trax-blue-rear.png'});
 await p.getByRole('button',{name:'⚑ Race',exact:true}).click();await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__);
 await p.keyboard.down('ArrowUp');await p.waitForFunction(()=>{const r=__WK_RIDE_STATE__();if(r.s.crashed)throw Error(r.s.crashed);return r.mechanical.wheelPhase<-.02&&r.mechanical.crankPhase<-.02},null,{timeout:15000});await p.keyboard.up('ArrowUp');
 const ride=await p.evaluate(()=>{const {s,mechanical}=__WK_RIDE_STATE__();return {x:s.x,y:s.y,pitch:s.pitch,wheel:mechanical.wheelPhase,crank:mechanical.crankPhase}});assert(Object.values(ride).every(Number.isFinite));assert(ride.wheel<0&&ride.crank<0,JSON.stringify(ride));
 assert.deepEqual(errors,[]);writeFileSync('wk-shots/modular/validation.json',JSON.stringify({report,bare,rejected,ride,errors},null,2));console.log(JSON.stringify({bikes:report.length,stockAndColoursFit:true,barePartsRemoved:true,uiColour:true,incompatibleRejected:true,ride:true,errors}));
} finally {await browser.close();}
