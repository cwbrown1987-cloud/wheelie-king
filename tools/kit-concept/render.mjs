import {chromium} from '/workspace/wheelie-king-repo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const port=process.env.PORT||8957;
const b=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const job of process.argv.slice(2)){const [q,out]=job.split('=>');const pg=await b.newPage({viewport:{width:1280,height:720}});
 pg.on('console',m=>{const t=m.text();if(!/favicon|404/.test(t))console.log('console:',t)});pg.on('pageerror',e=>console.log('PAGEERR',e.message));
 const t0=Date.now();await pg.goto(`http://127.0.0.1:${port}/wk-kit-concept/index.html?${q}`);await pg.waitForFunction('window.__done',null,{timeout:240000});
 const d=await pg.evaluate(()=>document.querySelector('canvas').toDataURL('image/png'));fs.writeFileSync(out,Buffer.from(d.split(',')[1],'base64'));
 const info=await pg.evaluate(()=>window.__info);fs.writeFileSync(out+'.json',JSON.stringify(info));console.log(out,((Date.now()-t0)/1000).toFixed(1)+'s',JSON.stringify({...info,labels:undefined}));await pg.close();}
await b.close();
