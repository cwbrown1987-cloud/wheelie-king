import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 for(const touch of [false,true]) {
  const ctx=await browser.newContext({viewport:touch?{width:900,height:420}:{width:1200,height:780},hasTouch:touch,serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/wk (frame|spokes|detail|trax|hook)/.test(m.text()))errors.push(m.text())});
  await p.goto('http://127.0.0.1:8931/');await p.waitForFunction(()=>globalThis.__WK_VIEW__);
  const click=async selector=>{const el=p.locator(selector);await el.scrollIntoViewIfNeeded();if(touch)await el.tap();else await el.click()};
  await click('[data-cat="bars"]');await p.waitForFunction(()=>globalThis.__WK_EQUIP__);
  await click('[data-wk-part="bar_riser"]');await p.waitForFunction(()=>__WK_BUILD__.bars==='bar_riser');
  const first=await p.evaluate(()=>{let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});return root.getObjectByName('wk:model:bars').uuid});
  await click('[data-wk-part="bar_moto"]');await p.waitForFunction(()=>__WK_BUILD__.bars==='bar_moto');
  const swapped=await p.evaluate(()=>{let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});let count=0;root.traverse(o=>{if(o.name==='wk:model:bars')count++});return {count,uuid:root.getObjectByName('wk:model:bars').uuid}});
  assert.equal(swapped.count,1);assert.notEqual(swapped.uuid,first);assert.equal(await p.getByText('PART SHEET',{exact:true}).count(),0);
  await click('[data-wk-info="bar_riser"]');await p.getByText('PART SHEET',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>__WK_BUILD__.bars),'bar_moto');
  mkdirSync('wk-shots/part-click',{recursive:true});await p.screenshot({path:`wk-shots/part-click/${touch?'touch':'desktop'}-info.png`});
  await p.getByRole('button',{name:'‹',exact:true}).click();
  if(!touch){await p.locator('[data-wk-part="bar_riser"]').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>__WK_BUILD__.bars==='bar_riser');}
  await p.locator('[data-catpanel="1"]').getByRole('button',{name:/BACK/}).click();
  await click('[data-cat="frame"]');await click('[data-wk-part="mtb_fs"]');await p.waitForFunction(()=>__WK_BUILD__.frame==='mtb_fs');
  await p.locator('[data-catpanel="1"]').getByRole('button',{name:/BACK/}).click();await click('[data-cat="shock"]');
  for(const id of ['shk_coil150','shk_air180']) {await click(`[data-wk-part="${id}"]`);await p.waitForFunction(id=>__WK_BUILD__.shock===id,id);}
  const shocks=await p.evaluate(()=>{let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});let spring=0;root.getObjectByName('wk:part:shock').traverse(o=>{if(o.name==='shock:spring')spring++});return {groups:root.children.filter(o=>o.name==='wk:part:shock').length,spring}});
  assert.deepEqual(shocks,{groups:1,spring:0});
  await click('[data-wk-part="trax_coil"]');assert.equal(await p.evaluate(()=>__WK_BUILD__.shock),'shk_air180');
  await click('[data-wk-info="shk_coil150"]');await p.getByText('PART SHEET',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>__WK_BUILD__.shock),'shk_air180');
  await p.getByRole('button',{name:'‹',exact:true}).click();
  await p.waitForTimeout(2300);await p.screenshot({path:`wk-shots/part-click/${touch?'touch':'desktop'}-cards.png`});
  // REMOVE is still a separate action; it must not bubble into the card and re-fit.
  await p.locator('[data-wk-part="shk_air180"]').getByRole('button',{name:'REMOVE',exact:true}).click();
  await p.waitForFunction(()=>!__WK_BUILD__.shock);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({touch,directFit:true,replacement:true,infoOnly:true,incompatibleRejected:true,remove:true,errors}));
  await ctx.close();
 }
} finally {await browser.close();}
