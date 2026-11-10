import {launchBrowser} from './_browser.mjs';
import assert from 'node:assert/strict';

import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await launchBrowser();
try {
 const ctx=await browser.newContext({viewport:{width:1200,height:780},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/wk (frame|spokes|detail|trax|hook)/.test(m.text()))errors.push(m.text())});
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');await p.waitForFunction(()=>globalThis.__WK_VIEW__);
 await p.click('[data-cat="frame"]',{force:true});await p.waitForFunction(()=>globalThis.__WK_EQUIP__);
 const preview=await p.evaluate(()=>{const item=__WK_CAT__().items.find(i=>i.id==='trax_lime');return {rotatable:__WK_PREVIEW__.has(item),thumb:__WK_THUMB__(item)?.startsWith('data:image/png')}});
 assert.deepEqual(preview,{rotatable:true,thumb:true});
 // Use the normal equip operation so catalog/preset ownership and fitment are exercised.
 await p.evaluate(()=>__WK_EQUIP__('trax_lime'));await p.waitForFunction(()=>__WK_BUILD__.frame==='trax_lime');
 await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/BACK/.test(b.textContent))?.click());
 const report=await p.evaluate(()=>{
  const b=__WK_BUILD__,v=__WK_VIEW__;v.controls.autoRotate=false;v.controls.target.set(.1,.54,0);v.camera.position.set(.35,.75,2.6);v.controls.update();
  let root;v.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});
  let reflectors=0;root.traverse(o=>{if(o.name.startsWith('trax:spokeReflector'))reflectors++});
  return {build:b,fit:Object.entries(b).map(([s,id])=>[s,__WK_FIT__(b,id)]),reflectors,shockGroups:root.children.filter(o=>o.name==='wk:part:shock').length,anchors:root.userData.wkAnchors,swing:!!root.getObjectByName('rearFrame:seatstay1'),lettering:!!root.getObjectByName('frame:downTube').material.map};
 });
 assert.equal(report.reflectors,4);assert.equal(report.shockGroups,1);assert(report.swing&&report.lettering);assert(report.fit.every(([s,f])=>f.status==='ok'),JSON.stringify(report.fit));
 assert.equal(report.build.motor,undefined);assert.equal(report.build.rims,'trax_rims');
 assert.equal(report.anchors.wheelR,.255);
 // Selection glow decays by rendered frames; SwiftShader can take longer than real time.
 await p.waitForFunction(()=>{let f;__WK_VIEW__.scene.traverse(o=>{if(o.name==='frame:headTube')f=o});return f&&f.material.emissiveIntensity<.01},{},{timeout:40000});
 mkdirSync('wk-shots/trax',{recursive:true});await p.waitForTimeout(2300);await p.screenshot({path:'wk-shots/trax/01-stock-side.png'});
 for(const [name,target,camera] of [
  ['02-three-quarter',[.1,.54,0],[-1,.88,2.25]],
  ['03-shock-linkage',[-.08,.61,0],[.03,.71,.65]],
  ['04-frame-lettering',[.26,.51,0],[.3,.54,.7]],
  ['05-front-wheel',[.65,.315,0],[.85,.5,1.05]]
 ]) {await p.evaluate(([t,c])=>{const v=__WK_VIEW__;v.controls.target.set(...t);v.camera.position.set(...c);v.controls.update()},[target,camera]);await p.waitForTimeout(350);await p.screenshot({path:`wk-shots/trax/${name}.png`});}
 // Compatible swaps must remove stock decorations, not stack a second stock part.
 for(const id of ['rim_gold','bar_riser','suntour','hub1500']) {assert.equal(await p.evaluate(id=>__WK_EQUIP__(id),id),true);await p.waitForTimeout(150);}
 const swapped=await p.evaluate(()=>{
  let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});let reflectors=0,bars=0,hubs=0;
  root.traverse(o=>{if(o.name.startsWith('trax:spokeReflector'))reflectors++;if(o.name==='wk:model:bars')bars++;if(o.name==='wk:model:hub')hubs++});
  return {reflectors,bars,hubs,shockGroups:root.children.filter(o=>o.name==='wk:part:shock').length,badShock:__WK_FIT__(__WK_BUILD__,'shk_air180').status,badFork:__WK_FIT__(__WK_BUILD__,'fox40').status};
 });
 assert.deepEqual(swapped,{reflectors:0,bars:1,hubs:1,shockGroups:1,badShock:'no',badFork:'no'});
 await p.evaluate(()=>__WK_EQUIP__('trax_lime'));await p.waitForTimeout(150);
 assert.equal(await p.evaluate(()=>__WK_BUILD__.motor),'hub1500');
 await p.evaluate(()=>__WK_EQUIP__('bmx'));await p.waitForTimeout(150);await p.evaluate(()=>__WK_EQUIP__('trax_lime'));await p.waitForTimeout(150);
 assert.equal(await p.evaluate(()=>{const b=document.querySelector('[data-wk="add-adapter"]');return !b||getComputedStyle(b.parentElement).display==='none'}),true);
 const cloneCheck=await p.evaluate(async()=>{const {cloneForRide}=await import('/ride.js');let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});let ok=true,restored=0;cloneForRide(root).traverse(o=>{if(o.isMesh&&o.name==='frame:headTube'){restored++;ok=ok&&o.material.emissive.getHex()===0&&o.material.emissiveIntensity===1}});return {ok,restored}});
 assert.deepEqual(cloneCheck,{ok:true,restored:1});
 await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/RIDE/.test(b.textContent))?.click());
 await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__);
 await p.keyboard.down('ArrowRight');await p.waitForTimeout(1000);await p.keyboard.up('ArrowRight');
 const ride=await p.evaluate(()=>{const {s,P,mechanical}=__WK_RIDE_STATE__();return {x:s.x,y:s.y,pitch:s.pitch,pedal:P.pedal,wheelPhase:mechanical.wheelPhase,crankPhase:mechanical.crankPhase}});
 assert([ride.x,ride.y,ride.pitch].every(Number.isFinite));assert(ride.pedal);
 assert(ride.wheelPhase<0&&ride.crankPhase<0);
 await p.screenshot({path:'wk-shots/trax/06-ride.png'});
 assert.deepEqual(errors,[]);writeFileSync('wk-shots/trax/validation.json',JSON.stringify({report,preview,swapped,ride,errors},null,2));console.log(JSON.stringify({stock:true,preview,swaps:true,ride,errors}));
} finally {await browser.close();}
