import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';

const browser=await launchBrowser();
try{
 const page=await browser.newPage(pageOptions({viewport:{width:1280,height:720},serviceWorkers:'block'})),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');await page.waitForFunction(()=>globalThis.__WK_ROOM__&&globalThis.__WK_SAVED_BUILDS__);
 await page.getByRole('button',{name:'⌂ Garage',exact:true}).click();await page.getByRole('button',{name:'Stock BMX',exact:true}).click();await page.getByRole('button',{name:'Ride options',exact:true}).click();
 await page.getByRole('textbox',{name:'Ride name',exact:true}).fill('Jaxon’s BMX');await page.getByRole('button',{name:'Rename',exact:true}).click();
 await page.getByRole('button',{name:'Jaxon’s BMX',exact:true}).waitFor();assert.equal(await page.evaluate(()=>__WK_SAVED_BUILDS__[0].name),'Jaxon’s BMX');assert(await page.evaluate(()=>!!__WK_SAVED_BUILDS__[0].id));
 await page.reload();await page.waitForFunction(()=>globalThis.__WK_ROOM__&&globalThis.__WK_SAVED_BUILDS__);await page.getByRole('button',{name:'⌂ Garage',exact:true}).click();await page.getByRole('button',{name:'Jaxon’s BMX',exact:true}).click();
 await page.getByRole('button',{name:'Ride options',exact:true}).click();await page.getByRole('button',{name:'Delete ride',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.evaluate(()=>__WK_SAVED_BUILDS__.length),1);
 await page.getByRole('button',{name:'Ride options',exact:true}).click();await page.getByRole('button',{name:'Delete ride',exact:true}).click();await page.getByRole('button',{name:'Confirm delete',exact:true}).click();assert.equal(await page.evaluate(()=>__WK_SAVED_BUILDS__.length),0);assert.equal(await page.locator('.room-rides button').count(),0);
 await page.locator('[data-wk-nav=garage]').click();await page.getByRole('button',{name:'⌂ Garage',exact:true}).click();assert.equal(await page.evaluate(()=>__WK_SAVED_BUILDS__.length),0,'unchanged draft must not recreate deleted ride');
 await page.reload();await page.waitForFunction(()=>globalThis.__WK_ROOM__&&globalThis.__WK_SAVED_BUILDS__);await page.getByRole('button',{name:'⌂ Garage',exact:true}).click();assert.equal(await page.evaluate(()=>__WK_SAVED_BUILDS__.length),0,'deletion persists after reload');
 // Legacy identity migration keeps other rides and their placements attached.
 const legacy=await page.evaluate(async()=>{const m=await import('/garage-state.js');globalThis.__WK_SAVED_BUILDS__=[{name:'First',b:{frame:'bmx'}},{name:'Second',b:{frame:'trax_lime'}}];m.saveLayout({'saved:0:First':{x:1,z:2},'saved:1:Second':{x:3,z:4},$items:[{uid:'shelf',itemId:'display_shelf'}]});const renamed=m.renameRide('saved:0:First','Renamed');const second=__WK_SAVED_BUILDS__[1].id;const before=m.layout();m.deleteRide(renamed);return {before,second,after:m.layout(),saved:m.savedRides()};});
 assert.equal(legacy.before[legacy.second].x,3);assert.equal(legacy.after[legacy.second].z,4);assert.equal(legacy.saved.length,1);assert.equal(legacy.saved[0].name,'Second');assert.equal(legacy.after.$items.length,1);assert.deepEqual(errors,[]);
 console.log('PASS rename persistence, delete/cancel, no autosave resurrection, stable legacy placements and retained furniture');
}finally{await browser.close();}
