import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';

import {mkdirSync} from 'node:fs';
const browser=await launchBrowser();
mkdirSync('wk-shots/workshop-mobile',{recursive:true});
try{
 for(const viewport of [{width:1280,height:576},{width:844,height:390},{width:667,height:375},{width:390,height:844}]){
  const p=await browser.newPage(pageOptions({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'})),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
  await p.waitForFunction(()=>document.querySelector('[data-wk-sticker-dock] img')?.complete&&document.querySelector('[data-simple-category="style"] img')?.complete);
  assert(await p.evaluate(()=>__WK_VIEW__.worldRoom.state().quality==='mobile'&&!__WK_VIEW__.worldRoom.state().reflection),'touch room uses mobile floor');
  const mode=p.getByRole('button',{name:'Simple / Advanced',exact:true}),sticker=p.getByRole('button',{name:'Stickers',exact:true});
  assert(await mode.isVisible());assert(await sticker.isVisible());assert.equal(await p.locator('[data-rail="right"]>[aria-label="Test ride"]').isVisible(),false);assert.equal(await p.locator('[data-wk-workshop-title]').isVisible(),false);
  const m=await mode.boundingBox(),s=await sticker.boundingBox();assert(m.y>=s.y+s.height);assert(m.x>=0&&m.x+m.width<=viewport.width&&m.y+m.height<=viewport.height);
  if(viewport.width>viewport.height){const b=await p.locator('[data-simple-category="bikes"]').boundingBox();assert(b.height>=44,JSON.stringify(b));assert.equal(await p.locator('#wk-simple-rail .wk-category-picture').count(),9);assert(await p.locator('[data-rail="left"]').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'all nine basic categories should fit without scrolling');}
  await p.screenshot({path:`wk-shots/workshop-mobile/${viewport.width}.png`});
  if(viewport.width===1280){
   const result=await p.evaluate(async()=>{
    const T=await import('/vendor/three.module.js'),{cloneForRide}=await import('/ride.js');let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});
    const decal=new T.Mesh(new T.BoxGeometry(.04,.04,.002),new T.MeshStandardMaterial({color:'#ffffff'}));decal.name='test:cycle-decal';const record={id:'fixture',mesh:decal};decal.userData.wkDecal=record;decal.userData.link={};decal.userData.link.self=decal.userData.link;root.getObjectByName('wk:frame').add(decal);const original=decal.userData,copy=cloneForRide(root),d=copy.getObjectByName(decal.name);
    globalThis.__TEST_DECAL__=decal;return {sourcePreserved:decal.userData===original&&decal.userData.wkDecal.mesh===decal,visualPreserved:d.geometry===decal.geometry&&d.material===decal.material,editorLinkRemoved:!d.userData.wkDecal,anchors:!!copy.userData.wkAnchors};
   });assert.deepEqual(result,{sourcePreserved:true,visualPreserved:true,editorLinkRemoved:true,anchors:true});
   for(let n=0;n<2;n++){
    await p.evaluate(()=>globalThis.__OLD_MOBILE_RIDE__=globalThis.__WK_RIDE_STATE__);await p.getByRole('button',{name:'⚑ Race',exact:true}).click();await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__!==globalThis.__OLD_MOBILE_RIDE__&&globalThis.__WK_RIDE_STATE__?.().backdropLoaded);
    assert(await p.evaluate(()=>!!__WK_RIDE_SCENE__().scene.getObjectByName('test:cycle-decal')));assert.equal(await p.getByText('Race could not start',{exact:true}).count(),0);
    await p.locator('[data-r="back"]').click();await p.locator('[data-ride="portal"]').waitFor({state:'detached'});assert(await p.evaluate(()=>__TEST_DECAL__.userData.wkDecal.mesh===__TEST_DECAL__));
   }
  }
  assert.deepEqual(errors,[]);await p.close();console.log(`PASS mobile ${viewport.width}x${viewport.height}`);
 }
 console.log('PASS circular sticker clone, visual preservation and two Race launches');
}finally{await browser.close()}

