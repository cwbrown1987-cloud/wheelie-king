// Orbit sweep of the live workshop (no swaps). PHONE=1 → 844x390 touch, mobile path. Writes OUT/TAG-<angle>.png + contact sheet list
import {chromium} from '../../node_modules/playwright/index.mjs';import fs from 'node:fs';
const URL0=process.env.URL||'http://127.0.0.1:8962/',OUT=process.env.OUT||'/workspace/wk-wsbug',TAG=process.env.TAG||'before',phone=process.env.PHONE==='1';fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext(phone?{viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'}:{viewport:{width:1024,height:658},serviceWorkers:'block'});
if(process.env.SIMROOM)await ctx.route(/workshop-room\.js(\?.*)?$/,r=>r.fulfill({path:process.env.SIMROOM,contentType:'text/javascript'}));
const p=await ctx.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto(URL0);await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&document.querySelector('[data-wk-room-ready]'),null,{timeout:240000});
await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});await p.waitForTimeout(2500);
if(process.env.NEAR)await p.evaluate(n=>{const c=__WK_VIEW__.camera;c.near=n;c.updateProjectionMatrix();},+process.env.NEAR);
const info=await p.evaluate(()=>{const v=__WK_VIEW__;v.controls.enableDamping=false;return {pos:v.camera.position.toArray(),t:v.controls.target.toArray(),min:v.controls.minDistance,max:v.controls.maxDistance,polar:v.controls.maxPolarAngle}});console.log(JSON.stringify(info));
const angles=(process.env.ANGLES||'0,-40,-80,-120,-160,160,120,80,40').split(',').map(Number),zoom=+(process.env.ZOOM||1),lift=+(process.env.LIFT||0);
for(const d of angles){await p.evaluate(([d,h,zoom,lift])=>{const v=__WK_VIEW__,c=v.camera;c.position.fromArray(h.pos);v.controls.target.fromArray(h.t);const T=c.position.clone().sub(v.controls.target).multiplyScalar(zoom);const a=d*Math.PI/180,co=Math.cos(a),s=Math.sin(a);c.position.set(v.controls.target.x+T.x*co+T.z*s,v.controls.target.y+T.y+lift,v.controls.target.z-T.x*s+T.z*co);v.controls.update();},[d,info,zoom,lift]);
 await p.waitForTimeout(900);await p.screenshot({path:`${OUT}/${TAG}-${phone?'phone-':''}${d}${zoom!==1?'-z'+zoom:''}.png`,timeout:90000});console.log(d);}
await b.close();
