// Garage art-room tooling: loads the real game with /garage-room3d.js and /assets/garage/* served from
// this folder (PROTO=0: game files as-is). Modes: mask (prop silhouettes from the picture's camera -> sil.raw) | shots
import {chromium} from '../../node_modules/playwright/index.mjs';
import fs from 'node:fs';import path from 'node:path';
const here=path.dirname(new URL(import.meta.url).pathname),mode=process.argv[2]||'shots',URL0=process.env.URL||'http://127.0.0.1:8962/',OUT=process.env.OUT||'/workspace/wk-garage-art',TAG=process.env.TAG||'proposed';
fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1024,height:658},deviceScaleFactor:1,serviceWorkers:'block'});
if(process.env.PROTO!=='0')await ctx.route(/\/(garage-room3d\.js|assets\/garage\/[^?]*)(\?.*)?$/,async r=>{const u=new URL(r.request().url()).pathname,f=path.join(here,path.basename(u));if(!fs.existsSync(f))return r.continue();await r.fulfill({path:f,contentType:f.endsWith('.js')?'text/javascript':'image/jpeg'});});
const p=await ctx.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('console:',m.text().slice(0,200))});
await p.goto(URL0);await p.evaluate(()=>localStorage.removeItem('wk-garage-layout-v1'));await p.reload();
await p.waitForFunction(()=>globalThis.__WK_ROOM__&&globalThis.__WK_SAVED_BUILDS__,null,{timeout:180000});
await p.getByRole('button',{name:'⌂ Garage',exact:true}).click();
await p.waitForFunction(()=>__WK_ROOM__.renderer?.objects?.length>0,null,{timeout:120000});await p.waitForTimeout(3000);
if(mode==='mask'){
 const px=await p.evaluate(async()=>{const T=await import('/vendor/three.module.js'),A=__WK_GARAGE_ART__,r=A.renderer;
  const W=1672,H=941,rt=new T.WebGLRenderTarget(W,H),s=new T.Scene();s.background=new T.Color(0);s.overrideMaterial=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});
  const c=A.shell.props.clone();c.position.set(0,0,0);c.rotation.set(0,0,0);c.traverse(o=>{o.frustumCulled=false;if(o.isMesh&&o.material.transparent)o.visible=false;});s.add(c);
  const cam=new T.Camera();cam.projectionMatrix.copy(A.shell.projVP);cam.projectionMatrixInverse.copy(A.shell.projVP).invert();
  const prev=r.getRenderTarget();r.setRenderTarget(rt);r.render(s,cam);const buf=new Uint8Array(W*H*4);r.readRenderTargetPixels(rt,0,0,W,H,buf);r.setRenderTarget(prev);
  let o='';const g=new Uint8Array(W*H);for(let i=0;i<W*H;i++)g[i]=buf[i*4];for(let i=0;i<g.length;i+=8192)o+=String.fromCharCode(...g.subarray(i,i+8192));return btoa(o);});
 fs.writeFileSync(OUT+'/sil.raw',Buffer.from(px,'base64'));console.log('mask written');
}else{
 const shot=async n=>{await p.waitForTimeout(1200);await p.screenshot({path:`${OUT}/${TAG}-${n}.png`,timeout:90000});console.log(n);};
 const home=await p.evaluate(()=>{const r=__WK_ROOM__.renderer;r.controls.enableDamping=false;return [r.camera.position.toArray(),r.controls.target.toArray(),r.camera.fov]});
 const orbit=d=>p.evaluate(([d,h])=>{const r=__WK_ROOM__.renderer,v=r.camera;v.clearViewOffset();v.fov=h[2];v.updateProjectionMatrix();v.position.fromArray(h[0]);r.controls.target.fromArray(h[1]);const T=v.position.clone().sub(r.controls.target);const a=d*Math.PI/180,c=Math.cos(a),s=Math.sin(a);v.position.set(r.controls.target.x+T.x*c+T.z*s,v.position.y,r.controls.target.z-T.x*s+T.z*c);r.controls.update();},[d,home]);
 await shot('default');
 await orbit(-50);await shot('orbit-left');await orbit(48);await shot('orbit-right');await orbit(180);await shot('back');
 if(process.env.ARTVIEW!=='0')await p.evaluate(()=>{const r=__WK_ROOM__.renderer,v=r.camera,S={W:1672,H:941,F:752.5,CX:836,CY:401,X0:-.6,H0:.94,ZP:5.5},fh=2*Math.max(S.CY,S.H-S.CY);
  v.position.set(S.X0,S.H0,S.ZP);r.controls.target.set(S.X0,S.H0,S.ZP-3);r.controls.update();v.fov=2*Math.atan(fh/2/S.F)*180/Math.PI;v.setViewOffset(S.W,fh,0,fh/2-S.CY,S.W,S.H);v.updateProjectionMatrix();});
 if(process.env.ARTVIEW!=='0')await shot('art-viewpoint');
 await orbit(0);
 // existing furniture item moved with the normal garage arrange flow (garage-gizmo + furniture state)
 const mv=await p.evaluate(()=>{const r=__WK_ROOM__.renderer,o=r.objects.find(o=>/shelf/.test(o.key))||r.objects[0];r.select(o.key);const before=o.holder.position.toArray();r.arrange(true);r.move(.9,.5);return {key:o.key,before,after:o.holder.position.toArray(),keys:r.objects.map(o=>o.key)};});
 console.log(JSON.stringify(mv));
 const edit=p.getByRole('button',{name:'Edit object',exact:true});if(await edit.count())await edit.first().click().catch(()=>{});
 await p.evaluate(()=>{const r=__WK_ROOM__.renderer;r.arrange(true);});await shot('move-item');
}
await b.close();
