import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const ctx=await browser.newContext({viewport:{width:1200,height:780},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');await p.waitForFunction(()=>globalThis.__WK_VIEW__&&globalThis.__WK_STK__);
 await p.click('[data-cat="bars"]',{force:true});await p.waitForFunction(()=>globalThis.__WK_SETBUILD__);
 await p.evaluate(()=>{__WK_SETBUILD__({frame:'bmx'});[...document.querySelectorAll('button')].find(b=>/BACK/.test(b.textContent))?.click()});
 await p.waitForTimeout(300);
 const info=await p.evaluate(async()=>{
  const T=await import('/vendor/three.module.js'),{surf}=await import('/stickers-dd.js');
  let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});
  const tube=root.getObjectByName('frame:topTube'), data=tube.geometry.userData.wkTube;
  const path=new T.CatmullRomCurve3(data.points.map(p=>new T.Vector3(...p))),mid=path.getPointAt(.5);
  const v=__WK_VIEW__;v.controls.autoRotate=false;v.controls.target.copy(mid);v.camera.position.copy(mid).add(new T.Vector3(.04,.04,1));v.controls.update();root.updateMatrixWorld(true);
  const world=tube.localToWorld(mid.clone()),ray=new T.Raycaster(world.clone().add(new T.Vector3(0,0,1)),new T.Vector3(0,0,-1)),hit=ray.intersectObject(tube,false)[0];
  const surface=surf(hit), tangent=path.getTangentAt(hit.uv.x).transformDirection(tube.matrixWorld);tangent.addScaledVector(surface.n,-tangent.dot(surface.n)).normalize();
  const alignment=Math.abs(surface.axis.dot(tangent));
  const projected=world.clone().project(v.camera),rect=v.renderer.domElement.getBoundingClientRect();
  const point={x:rect.left+(projected.x+1)*rect.width/2,y:rect.top+(1-projected.y)*rect.height/2};
  const sticker=__WK_CAT__().items.find(i=>i.slot==='sticker'&&i.img&&i.rating==='all');__WK_STK_PICK__(sticker.id);
  return {point,alignment,radius:surface.r,expectedRadius:data.radius};
 });
 assert(info.alignment>.999);assert(Math.abs(info.radius-info.expectedRadius)<1e-9);
 const img=p.locator('#wkst-big img');await img.waitFor({state:'visible'});
 const box=await img.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();
 await p.mouse.move(info.point.x,info.point.y,{steps:12});await p.mouse.up();
 await p.waitForFunction(()=>__WK_STK__.saved().some(d=>d.mesh));
 const placed=await p.evaluate(()=>{const d=__WK_STK__.saved()[0];return {parent:d.mesh.parent.name,vertices:d.mesh.geometry.attributes.position.count}});
 assert.equal(placed.parent,'frame:topTube');assert(placed.vertices>0);
 await p.evaluate(()=>__WK_SETBUILD__({...__WK_BUILD__,grips:'grip_lock'}));
 await p.waitForFunction(()=>{
  let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});
  return __WK_BUILD__.grips==='grip_lock'&&__WK_STK__.saved().some(d=>d.mesh?.parent?.name==='frame:topTube'&&d.mesh.geometry.attributes.position.count>0&&root.getObjectById(d.mesh.id));
 });
 mkdirSync('test-results',{recursive:true});await p.screenshot({path:'test-results/sticker-frame.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({alignment:info.alignment,placed,rebuildPersistence:true,errors}));
} finally {await browser.close();}
