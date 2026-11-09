import {launchBrowser} from './_browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const label = process.argv[2] || 'after';
const out = `wk-shots/${label}`;
mkdirSync(out, {recursive:true});
const browser = await launchBrowser();
try {
 const ctx=await browser.newContext({viewport:{width:1200,height:780},serviceWorkers:'block'});
 const p=await ctx.newPage();
 const errors=[]; p.on('pageerror',e=>errors.push(e.message));
 p.on('console',m=>{if(/wk (frame|spokes|detail|hook)/.test(m.text())) errors.push(m.text())});
 await p.goto(process.argv[3] || 'http://127.0.0.1:8931/');
 await p.waitForFunction(()=>globalThis.__WK_VIEW__);
 await p.click('[data-cat="bars"]',{force:true});
 await p.waitForFunction(()=>globalThis.__WK_SETBUILD__);
 await p.evaluate(()=>{const back=[...document.querySelectorAll('button')].find(e=>/BACK/.test(e.textContent));back?.click()});
 const report=[];
 for(const frame of ['bmx','rbmx','mtb_rigid','mtb_ht','mtb_fs','fat','moto','emoto']) {
  await p.evaluate(frame=>__WK_SETBUILD__({frame}),frame);
  await p.waitForTimeout(350);
  const info=await p.evaluate(()=>{
   const v=__WK_VIEW__; v.controls.autoRotate=false;
   let root; v.scene.traverse(o=>{if(o.name==='wk:frame') root=o.parent});
   const A=root.userData.wkAnchors;
   v.controls.target.set((A.headBottom[0]+A.rearAxle[0])/2,.55,0);
   v.camera.position.set(.8,.9,2.8); v.controls.update();
   const frame=root.getObjectByName('wk:frame');
   return {anchors:A,frameChildren:frame.children.map(o=>({name:o.name,type:o.geometry?.type,position:o.position.toArray()})),environment:!!v.scene.environment};
  });
  await p.waitForTimeout(300);
  await p.screenshot({path:`${out}/${frame}-full.png`});
  for(const [joint,key] of [['seat','seatTop'],['head','headBottom'],['bb','bb']]) {
   await p.evaluate(([key])=>{let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});const a=root.userData.wkAnchors[key]; const v=__WK_VIEW__;v.controls.target.set(a[0],a[1],0);v.camera.position.set(a[0]+.12,a[1]+.1,.4);v.controls.update()},[key]);
   await p.waitForTimeout(270);
   await p.screenshot({path:`${out}/${frame}-${joint}.png`});
  }
  report.push({frame,...info});
 }
 writeFileSync(`${out}/scene-report.json`,JSON.stringify({report,errors},null,2));
 console.log(JSON.stringify({out,frames:report.length,errors}));
 if(errors.length) process.exitCode=1;
} finally {await browser.close();}
