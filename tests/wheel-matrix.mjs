import {launchBrowser} from './_browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser=await launchBrowser();
const errors=[],results=[];
try {
 const ctx=await browser.newContext({viewport:{width:1100,height:750},serviceWorkers:'block'}), p=await ctx.newPage();
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/wk (frame|spokes|detail|hook)/.test(m.text()))errors.push(m.text())});
 await p.goto(process.argv[2]||'http://127.0.0.1:8931/');await p.waitForFunction(()=>globalThis.__WK_VIEW__);
 await p.click('[data-cat="bars"]',{force:true});await p.waitForFunction(()=>globalThis.__WK_SETBUILD__);
 await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/BACK/.test(b.textContent))?.click());
 const cases=await p.evaluate(()=>{
  const cat=__WK_CAT__().items, cases=[];
  for(const f of cat.filter(i=>i.slot==='frame')) {
   const base={frame:f.id};
   cases.push(base);
   for(const m of cat.filter(i=>i.slot==='motor'&&['rear','front'].includes(i.kind))) if(__WK_FIT__(base,m.id).status!=='no') cases.push({...base,motor:m.id});
   for(const t of cat.filter(i=>i.slot==='tyres'))if(__WK_FIT__(base,t.id).status!=='no')cases.push({...base,tyres:t.id});
  }
  return cases;
 });
 for(const build of cases) {
  await p.evaluate(b=>__WK_SETBUILD__(b),build);
  await p.waitForFunction(b=>Object.entries(b).every(([k,v])=>__WK_BUILD__[k]===v),build);
  const result=await p.evaluate(async()=>{
   const T=await import('/vendor/three.module.js');
   let root;__WK_VIEW__.scene.traverse(o=>{if(o.name==='wk:frame')root=o.parent});root.updateMatrixWorld(true);
   const fail=[],wheels=[];
   root.traverse(w=>{
    const spokes=w.children.find(o=>o.name==='wheel:spokes');if(!spokes)return;
    const nipples=w.children.find(o=>o.name==='wheel:nipples');
    const bores=[];
    w.traverse(f=>{if(!f.userData.spokeBores)return;const holes=f.geometry.parameters.shapes.holes.slice(1);for(const path of holes){const c=path.curves[0],v=new T.Vector3(c.aX,c.aY,0);f.localToWorld(v);w.worldToLocal(v);bores.push(v)}});
    const rim=w.children.find(o=>o.geometry?.type==='TorusGeometry'&&Math.abs(o.geometry.parameters.tube-.009)<1e-5);
    let maxBoreError=0,maxNippleError=0,maxRimError=0,maxAngleError=0,maxAxisError=0;
    const sockets=new Set();
    for(let i=0;i<36;i++) {
     const m=new T.Matrix4();spokes.getMatrixAt(i,m);
     const a=new T.Vector3(0,-.5,0).applyMatrix4(m),b=new T.Vector3(0,.5,0).applyMatrix4(m);
     maxBoreError=Math.max(maxBoreError,Math.min(...bores.map(h=>h.distanceTo(a))));
     nipples.getMatrixAt(i,m);const n=new T.Vector3().setFromMatrixPosition(m);
     maxNippleError=Math.max(maxNippleError,b.distanceTo(n));
     const direction=new T.Vector3(0,1,0).transformDirection(m),spokeDirection=b.clone().sub(a).normalize();
     maxAxisError=Math.max(maxAxisError,1-Math.abs(direction.dot(spokeDirection)));
     const angle=(Math.atan2(n.y,n.x)+Math.PI*2)%(Math.PI*2),slot=Math.round(angle/(Math.PI*2)*36)%36;
     sockets.add(slot);maxAngleError=Math.max(maxAngleError,Math.abs(Math.atan2(Math.sin(angle-slot/36*Math.PI*2),Math.cos(angle-slot/36*Math.PI*2))));
     const wall=Math.hypot(Math.hypot(n.x,n.y)-rim.geometry.parameters.radius,n.z);
     maxRimError=Math.max(maxRimError,Math.abs(wall-rim.geometry.parameters.tube));
    }
    const check={bores:bores.length,sockets:sockets.size,maxBoreError,maxNippleError,maxRimError,maxAngleError,maxAxisError};wheels.push(check);
    if(bores.length!==36||sockets.size!==36||Math.max(maxBoreError,maxNippleError,maxRimError,maxAngleError,maxAxisError)>2e-6)fail.push(check);
   });
   if(wheels.length!==2)fail.push({wheelCount:wheels.length});
   return {wheels,fail};
  });
  results.push({build,...result});
 }
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/wheel-matrix.json',JSON.stringify({results,errors},null,2));
 const failures=results.filter(r=>r.fail.length);console.log(JSON.stringify({builds:results.length,wheels:results.reduce((s,r)=>s+r.wheels.length,0),failures:failures.length,errors,examples:failures.slice(0,2)}));
 if(failures.length||errors.length)process.exitCode=1;
} finally {await browser.close();}
