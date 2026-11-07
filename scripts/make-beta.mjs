// Builds a separate BETA copy of the game in ./dist-beta (own cache, own install name, BETA badge).
// Deploy it to its own host, e.g.:  node scripts/make-beta.mjs --deploy   (Cloudflare Pages project "wheelie-king-beta")
import {readFileSync,writeFileSync,rmSync,cpSync,readdirSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stageRuntime,root,dist} from './package.mjs';
const must=(s,a,b)=>{if(s.split(a).length!==2)throw Error('beta patch needs exactly one match: '+a);return s.replace(a,b)};
const pack=stageRuntime();
const out=resolve(root,'dist-beta');if(out!==resolve(root,'dist-beta')||relative(root,out)!=='dist-beta')throw Error('Unsafe beta output');rmSync(out,{recursive:true,force:true});cpSync(dist,out,{recursive:true});
const rw=(f,fn)=>writeFileSync(join(out,f),fn(readFileSync(join(out,f),'utf8')));
rw('sw.js',s=>s.replace(/const CACHE = "([^"]+)"/,(m,c)=>{return `const CACHE = "wk-beta-${c}"`}));
rw('manifest.webmanifest',s=>{const m=JSON.parse(s);m.name='Wheelie King BETA';m.short_name='WK Beta';m.id='./?beta=1';m.start_url='./?beta=1';return JSON.stringify(m,null,2)});
rw('index.html',s=>must(s,'<body>','<body><div style="position:fixed;top:4px;right:6px;z-index:99999;pointer-events:none;font:700 11px/1 system-ui,sans-serif;letter-spacing:.12em;color:#111;background:#ffd23d;padding:3px 7px;border-radius:6px;opacity:.9">BETA</div>'));
rw('index.html',s=>s.replace(/<title>[^<]*<\/title>/,'<title>Wheelie King BETA</title>'));
console.log(`Beta staged: ${pack.files.length} files in dist-beta`);
if(process.argv.includes('--deploy')){
 const r=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['--yes','wrangler@4.157.0','pages','deploy','dist-beta','--project-name','wheelie-king-beta','--branch','main','--commit-dirty=true'],{cwd:root,stdio:'inherit',shell:process.platform==='win32',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'7f9b89a42182a51327a119efb6cf949e'}});
 if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);
 const base='https://wheelie-king-beta.pages.dev';
 if(new URL(base).hostname!=='wheelie-king-beta.pages.dev')throw Error('Refusing non-beta verification');
 const hash=b=>createHash('sha256').update(b).digest('hex'),files=readdirSync(out,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()&&!['_headers','.nojekyll'].includes(e.name));
 let failed=[];for(let attempt=0;attempt<4;attempt++){failed=[];for(let i=0;i<files.length;i+=6)await Promise.all(files.slice(i,i+6).map(async e=>{const file=join(e.parentPath,e.name),name=relative(out,file).replaceAll('\\','/');try{const response=await fetch(base+'/'+name+'?verify='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==hash(readFileSync(file)))failed.push(name)}catch{failed.push(name)}}));if(!failed.length)break;if(attempt<3)await new Promise(r=>setTimeout(r,2000));}
 if(failed.length)throw Error('Beta verification failed: '+failed.join(', '));console.log('BETA VERIFIED: '+files.length+' files match at '+base);

}
