// Clothing store + 3D rider clothes: catalogue/base-model integrity (node), then in the browser: the Clothing
// category lists every item, buy & equip saves to the rider gear save, the Playground rider wears it (skinned
// garments on his skeleton, covered skin hidden), hood up/down toggles, and Legacy still boots.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {CLOTHING,CLOTHING_BASES,CLOTHING_ITEMS} from '../clothing-catalogue.js';
import {GEAR,GEAR_CATEGORIES,item} from '../gear-catalogue.js';
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
const root=new URL('../',import.meta.url);
assert.equal(new Set(CLOTHING.map(c=>c.id)).size,CLOTHING.length,'unique clothing ids');
assert.ok(GEAR_CATEGORIES.some(([k])=>k==='clothing'),'Clothing category');
for(const c of CLOTHING_ITEMS){assert.ok(item(c.id)&&GEAR.includes(item(c.id)),c.id+' in the shop items');assert.ok(c.price>0&&['top','pants','shoes'].includes(c.slot),c.id);}
const glbExtras=f=>{const b=readFileSync(f),l=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+l));return j.nodes.filter(n=>n.extras?.wkClothing).map(n=>n.extras.wkClothing)};
for(const [name,b] of Object.entries({...CLOTHING_BASES,hood_up:{file:'hood_up.glb'}})){const f=new URL('assets/clothing/base/'+b.file,root);assert.ok(existsSync(f),b.file);const ex=glbExtras(f);assert.ok(ex.length,b.file+' has wkClothing meshes');
 if(name!=='hood_up'){assert.ok(existsSync(new URL('assets/clothing/base/'+name+'-uv-template.png',root)),name+' template');assert.ok(ex.find(e=>e.role==='body').covers.length>200,name+' hides covered skin');}}
for(const base of ['tshirt','jumper'])assert.ok(CLOTHING.some(c=>c.base===base&&!c.look.marks),'plain '+base+' in the store');
const browser=await launchBrowser();
try{
 const p=await browser.newPage(pageOptions({viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block'}));const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{if(!sessionStorage.getItem('wk-clothes-test')){sessionStorage.setItem('wk-clothes-test','1');localStorage.removeItem('wk-rider-gear-v1');localStorage.setItem('wk-level','arena')}});
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.evaluate(()=>globalThis.__WK_ROOM__.open('shop'));await p.click('[data-shop-category="clothing"]');
 assert.equal(await p.locator('[data-gear-item]').count(),CLOTHING.length,'every clothing item listed');
 await p.click('[data-gear-item="hr_hoodie_black"]');await p.waitForSelector('[data-gear-buy="hr_hoodie_black"]');
 await p.waitForFunction(()=>document.querySelector('[data-gear-product] canvas'),null,{timeout:60000});
 await p.click('[data-gear-buy="hr_hoodie_black"]');
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('wk-rider-gear-v1')));
 assert.ok(saved.owned.includes('hr_hoodie_black')&&saved.equipped.top==='hr_hoodie_black','bought + equipped + saved '+JSON.stringify(saved.equipped));
 await p.click('[data-hood-toggle]');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('wk-rider-gear-v1')).style.hoodUp),true,'hood up saved');
 await p.evaluate(()=>{globalThis.__WK_ROOM__.close()});
 await p.reload();await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
 await p.waitForFunction(()=>{const c=globalThis.__WK_TELEMETRY__?.()?.rider?.clothes;return c&&!c.loading&&c.slots?.length},null,{timeout:120000});
 const c=await p.evaluate(()=>__WK_TELEMETRY__().rider.clothes);
 assert.deepEqual(c.ids,['hr_hoodie_black'],'rider wears the hoodie');assert.ok(c.meshes.includes('clothes:hood_up:hood')&&!c.meshes.includes('clothes:hoodie:hood'),'hood up on the rider '+c.meshes);
 assert.ok(c.bodyTris<c.bodyTrisFull-2000,'skin under the hoodie hidden');assert.equal(c.error,null);
 assert.deepEqual(errors,[],'page errors');await p.close();
 // Legacy still boots with clothing in the catalogue
 const q=await browser.newPage(pageOptions({viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block'}));const e2=[];q.on('pageerror',e=>e2.push(e.message));
 await q.goto(withLegacy(process.env.WK_TEST_URL||'http://127.0.0.1:8931/'));await q.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});assert.deepEqual(e2,[],'legacy page errors');await q.close();
 console.log('rider-clothes ok',JSON.stringify({ids:c.ids,meshes:c.meshes,bodyTris:c.bodyTris,clothTris:c.clothTris}));
}finally{await browser.close()}
