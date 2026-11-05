import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:1200,height:780},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8931/');await p.waitForFunction(()=>globalThis.__WK_BUILD__&&document.querySelector('#wk-builder .choices'));
 const panel=p.locator('#wk-builder'),choose=id=>panel.locator(`[data-simple-part="${id}"]`).click(),apply=()=>panel.getByRole('button',{name:'Apply preview',exact:true}).click(),cancel=()=>panel.getByRole('button',{name:'Cancel preview',exact:true}).click();
 assert.equal(await p.evaluate(()=>document.body.dataset.wkMode),'simple');
 await panel.getByRole('button',{name:'Pre-made bikes',exact:true}).click();assert.equal(await panel.locator('[data-simple-part]').count(),9);
 const original=await p.evaluate(()=>__WK_BUILD__.frame);await choose('bike_trax_lime');await p.waitForFunction(()=>__WK_BUILD__.frame==='trax_lime');assert.equal(await panel.locator('button').count(),2);
 await p.reload();await p.waitForFunction(id=>globalThis.__WK_BUILD__?.frame===id&&!sessionStorage.getItem('wk-pending-build'),original);await panel.getByRole('button',{name:'Pre-made bikes',exact:true}).click();await choose('bike_trax_lime');await cancel();await p.waitForFunction(id=>__WK_BUILD__.frame===id,original);
 await choose('bike_trax_lime');await apply();await p.waitForFunction(()=>__WK_BUILD__.frame==='trax_lime');
 await panel.getByRole('button',{name:'‹ Back',exact:true}).click();await panel.getByRole('button',{name:'Styles & colours',exact:true}).click();await panel.getByRole('button',{name:'Frame colour',exact:true}).click();await choose('trax_lime__blue');await cancel();await p.waitForFunction(()=>__WK_BUILD__.frame==='trax_lime');await choose('trax_lime__blue');await apply();await p.waitForFunction(()=>__WK_BUILD__.frame==='trax_lime__blue');
 await panel.getByRole('button',{name:'‹ Back',exact:true}).click();await panel.getByRole('button',{name:'Wheels',exact:true}).click();assert(await panel.locator('[data-simple-part]').count()>5);
 const columns=await panel.locator('.choices').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,2);
 const plans=await p.evaluate(()=>{let n=0;for(const kit of __WK_CAT__().items.filter(p=>p.completeBike)){const b=Object.fromEntries(kit.kit.map(id=>[__WK_PART__(id).slot,id]));for(const m of __WK_CAT__().items.filter(p=>p.slot==='motor'&&!p.hidden)){const plan=__WK_SIMPLE_PLAN__(b,m.id);if(plan){if(!__WK_BUILD_READY__(plan).ready||!plan.controller||!plan.battery||!plan.throttle)throw Error('Incomplete upgrade');n++}}}return n});assert(plans>10);
 await panel.getByRole('button',{name:'‹ Back',exact:true}).click();await panel.getByRole('button',{name:'Motor upgrades · kW',exact:true}).click();const motorId=await panel.locator('[data-simple-part]').first().getAttribute('data-simple-part');await choose(motorId);await apply();await p.waitForFunction(id=>__WK_BUILD__.motor===id,motorId);assert(await p.evaluate(()=>__WK_BUILD_READY__(__WK_BUILD__).ready&&__WK_PART__(__WK_BUILD__.motor).name.includes('kW')));
 await panel.getByRole('button',{name:'Advanced',exact:true}).click();await p.waitForFunction(()=>document.body.dataset.wkMode==='advanced');await p.locator('[data-cat="grips"]').click();await p.locator('[data-wk-swatch="grip_std__red"]').click();await panel.getByRole('button',{name:'Apply preview',exact:true}).waitFor();assert.equal(await p.locator('[data-catpanel]').isVisible(),false);await apply();await p.waitForFunction(()=>__WK_BUILD__.grips==='grip_std__red');
 assert.equal(await p.locator('#wk-cond').count(),0);
 await panel.getByRole('button',{name:'Simple',exact:true}).click();await panel.getByRole('button',{name:'Flat endless',exact:true}).click();
 mkdirSync('wk-shots/simple-builder',{recursive:true});await p.screenshot({path:'wk-shots/simple-builder/menu.png'});
 await p.getByRole('button',{name:'Test ride',exact:true}).click();await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__);assert(await p.evaluate(()=>__WK_RIDE_STATE__().ter.finish===Infinity&&__WK_RIDE_STATE__().ter.h(1e6)===0));
 await p.evaluate(()=>{__WK_RIDE_STATE__().s.x=5000});await p.keyboard.down('ArrowUp');await p.waitForFunction(()=>Math.abs(__WK_RIDE_STATE__().cameraX-__WK_RIDE_STATE__().s.x)<10);await p.waitForTimeout(600);await p.keyboard.up('ArrowUp');assert(await p.evaluate(()=>Number.isFinite(__WK_RIDE_STATE__().s.y)&&!__WK_RIDE_STATE__().finished&&Math.abs(__WK_RIDE_STATE__().groundX-__WK_RIDE_STATE__().s.x)<200));await p.screenshot({path:'wk-shots/simple-builder/flat-endless.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({presets:9,modes:true,twoColumns:true,previewApplyCancel:true,reloadRestoresUnconfirmed:true,colours:true,wheels:true,automaticMotorPlans:plans,repairsHidden:true,flatBeyond5km:true,errors}));
}finally{await browser.close()}
