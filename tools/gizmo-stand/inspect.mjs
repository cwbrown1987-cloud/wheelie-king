import {chromium} from '../../node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1024,height:658},serviceWorkers:'block'});const p=await ctx.newPage();
await p.goto('http://127.0.0.1:8962/');
await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});await p.waitForTimeout(2000);
console.log(await p.evaluate(async()=>{const T=await import('/vendor/three.module.js');const v=__WK_VIEW__,s=v.scene.getObjectByName('wk:stand');const out={cam:v.camera.position.toArray(),tgt:v.controls.target.toArray(),fov:v.camera.fov,min:v.controls.minDistance,max:v.controls.maxDistance,keys:Object.keys(v)};
 if(s){let r=s.parent,chain=[];while(r){chain.push(r.name+'|'+r.type+'|'+r.position.toArray().map(n=>+n.toFixed(3)));r=r.parent;}out.chain=chain;out.standBox=new T.Box3().setFromObject(s);const root=s.parent;out.bikeBox=new T.Box3().setFromObject(root);out.kids=root.children.map(c=>c.name).slice(0,60);
 const names=[];root.traverse(o=>{if(/seat|post|saddle|top|frame/i.test(o.name))names.push(o.name+':'+new T.Box3().setFromObject(o).getCenter(new T.Vector3()).toArray().map(n=>+n.toFixed(3)))});out.names=names.slice(0,30);}
 return JSON.stringify(out,null,0)}));
await b.close();
