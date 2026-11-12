// node tools/clothes-lab/bake.mjs  (needs scripts/static-server.mjs on WK_SERVE_PORT=8931) -> assets/clothing/base/
import {chromium} from 'playwright';
import {writeFileSync,mkdirSync} from 'node:fs';
const out=new URL('../../assets/clothing/base/',import.meta.url);mkdirSync(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();p.on('pageerror',e=>console.error('ERR',e.message));p.on('console',m=>console.log('C',m.text()));
await p.goto((process.env.WK_TEST_URL||'http://127.0.0.1:8931/')+'tools/clothes-lab/bake.html');
await p.waitForFunction(()=>window.__BAKE__,null,{timeout:400000});
const r=await p.evaluate(()=>window.__BAKE__);
for(const [n,d] of Object.entries(r.files))writeFileSync(new URL(n,out),Buffer.from(d,'base64'));
writeFileSync(new URL('bake-stats.json',out),JSON.stringify(r.stats,null,1)+'\n');
console.log(JSON.stringify(r.stats));await b.close();
