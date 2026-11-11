// Post-deploy check: every Playground runtime asset must come back as itself, not the HTML fallback.
// usage: node scripts/verify-live-assets.mjs https://wheelie-king-beta.pages.dev
import {readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {root} from './package.mjs';
const base=(process.argv[2]||'https://wheelie-king-beta.pages.dev').replace(/\/$/,'');
const dirs=['assets/hdri','assets/ambientcg'];
const files=dirs.flatMap(d=>readdirSync(join(root,d),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()&&!/LICENSE/i.test(e.name)).map(e=>relative(root,join(e.parentPath,e.name)).split('\\').join('/')));
const bad=[];
await Promise.all(files.map(async f=>{
  const r=await fetch(`${base}/${f}?v=${Date.now()}`,{method:'GET'});
  const ct=r.headers.get('content-type')||'';
  await r.arrayBuffer();
  if(!r.ok||ct.includes('text/html'))bad.push(`${f} -> ${r.status} ${ct}`);
}));
if(bad.length){console.error('assets_bad '+bad.length+'\n'+bad.join('\n'));process.exit(1);}
console.log('assets_ok '+files.length);
