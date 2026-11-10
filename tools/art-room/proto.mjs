// Art-room tooling: loads the real game (PROTO=0 uses src/ as-is; otherwise swaps in tools/art-room/*
// modules via request routing). mask = render modelled-prop silhouettes from the art's camera -> sil.raw
import {chromium} from '../../node_modules/playwright/index.mjs';
import fs from 'node:fs';import path from 'node:path';
const here=path.dirname(new URL(import.meta.url).pathname),mode=process.argv[2]||'shots',URL0=process.env.URL||'http://127.0.0.1:8962/',OUT=process.env.OUT||'/workspace/wk-art-room';
fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1024,height:658},deviceScaleFactor:1,serviceWorkers:'block'});
const swap={'/src/rooms/workshop-props.js':'workshop-props.js','/src/rooms/workshop-shell.js':'workshop-shell.js','/src/rooms/workshop-room.js':'workshop-room.js'};
if(process.env.PROTO!=='0')await ctx.route(/\/(src\/rooms\/workshop-(props|shell|room)\.js|assets\/workshop\/art-room[^?]*)(\?.*)?$/,async r=>{const u=new globalThis.URL(r.request().url()).pathname;const f=swap[u]?path.join(here,swap[u]):path.join(here,path.basename(u));
 if(!fs.existsSync(f))return r.continue();await r.fulfill({path:f,contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'image/jpeg'});});
const p=await ctx.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('console:',m.text().slice(0,200))});
await p.goto(URL0);await p.evaluate(()=>localStorage.removeItem('wk-room-layout-v1'));await p.reload();
await p.waitForFunction(()=>globalThis.__WK_VIEW__?.worldRoom&&document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
await p.getByRole('button',{name:'Pause workshop rotation',exact:true}).click({timeout:5000}).catch(()=>{});await p.waitForTimeout(2500);
if(mode==='mask'){
 const px=await p.evaluate(async()=>{const T=await import('/vendor/three.module.js');const v=__WK_VIEW__,inst=__WK_SHARED_WORLD__.getInstance('workshop');
  const W=1672,H=941,rt=new T.WebGLRenderTarget(W,H),s=new T.Scene();s.background=new T.Color(0);s.overrideMaterial=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});
  const props=v.scene.getObjectByName('workshop:props');const c=props.clone();props.updateMatrixWorld(true);c.matrixAutoUpdate=false;c.matrix.copy(props.matrixWorld);s.add(c);
  const cam=new T.Camera();cam.projectionMatrix.copy(inst.shell.projVP);cam.projectionMatrixInverse.copy(inst.shell.projVP).invert();
  c.traverse(o=>{o.frustumCulled=false;if(o.isMesh&&o.material.transparent)o.visible=false;});
  const r=v.renderer,prev=r.getRenderTarget();r.setRenderTarget(rt);r.render(s,cam);const buf=new Uint8Array(W*H*4);r.readRenderTargetPixels(rt,0,0,W,H,buf);r.setRenderTarget(prev);
  let o='';const g=new Uint8Array(W*H);for(let i=0;i<W*H;i++)g[i]=buf[i*4];for(let i=0;i<g.length;i+=8192)o+=String.fromCharCode(...g.subarray(i,i+8192));return btoa(o);});
 fs.writeFileSync(OUT+'/sil.raw',Buffer.from(px,'base64'));console.log('mask written');
}else{
 const home=await p.evaluate(()=>{const v=__WK_VIEW__;return [v.camera.position.toArray(),v.controls.target.toArray()]});
 const orbit=d=>p.evaluate(([d,h])=>{const v=__WK_VIEW__;v.camera.position.fromArray(h[0]);v.controls.target.fromArray(h[1]);const T=v.camera.position.clone().sub(v.controls.target);const a=d*Math.PI/180,c=Math.cos(a),s=Math.sin(a);v.camera.position.set(v.controls.target.x+T.x*c+T.z*s,v.camera.position.y,v.controls.target.z-T.x*s+T.z*c);v.controls.update();},[d,home]);
 const tag=process.env.TAG||'proposed';
 for(const [n,d] of [['default',0],['orbit-left',-50],['orbit-right',48],['back',180]]){await orbit(d);await p.waitForTimeout(900);await p.screenshot({path:`${OUT}/${tag}-${n}.png`,timeout:90000});console.log(n);}
 if(process.env.PROJ){await p.evaluate(()=>{const v=__WK_VIEW__,inst=__WK_SHARED_WORLD__.getInstance('workshop'),pp=inst.shell.room.projPos;v.camera.position.copy(pp);v.controls.target.set(pp.x,pp.y,pp.z-3);v.camera.fov=46.3;v.camera.updateProjectionMatrix();v.controls.update();});await p.waitForTimeout(900);await p.screenshot({path:`${OUT}/${tag}-projector.png`});}
}
await b.close();
