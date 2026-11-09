import {createServer} from 'node:http';
import {mkdirSync,readdirSync,writeFileSync,readFileSync,existsSync,statSync} from 'node:fs';
import {join,extname,normalize,relative,isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,stageRuntime} from './package.mjs';

const profiles={static:[],player:['player-rooms','garage-drag','manage-rides'],scene:['scene-depth','terrain-ride'],polish:['spawn-polish','sticker-picker'],vehicles:['vehicle-platforms'],builder:['part-fitment','basic-crazy','unlimited-zoom','check-update','replay-blocks','ride-gallery','boot-loader','simple-builder','workshop-batch','workshop-presentation','workshop-mobile','shop-space'],ride:['ride-camera','ride-loop','ride-finish','ride-lod','ride-quality','ride-themes','quality-lifecycle','ride-landings','wheelie-balance','air-control','ride-controls','crash-physics','crash-ride','race-balance','ride-pause-replay','check-update','replay-blocks','ride-gallery','boot-loader','replay-playback','panel-scroll'],mechanics:['bike-motion','trax-mechanics'],modular:['modular-builds']};
profiles.gpu=['claude-gpu'];
profiles.transitions=['screen-transitions'];
profiles.rooms=['shared-world','world-room','workshop-presentation','garage-drag','player-rooms','manage-rides','workshop-mobile'];
profiles.powertrain=['ride-parameters','physics-cadence','ride-parameter-integration','race-balance'];
profiles.menus=['part-fitment','basic-crazy','unlimited-zoom','check-update','replay-blocks','ride-gallery','boot-loader','simple-builder','sticker-picker','workshop-mobile','shop-space'];
profiles.release=[...profiles.transitions,...profiles.rooms,...profiles.powertrain,...profiles.scene,...profiles.builder,...profiles.ride,...profiles.mechanics,...profiles.modular,...profiles.vehicles,...profiles.polish,...profiles.player];
profiles.changed=[]; // filled below when requested

const MIME={
 '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png',
 '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.wasm':'application/wasm',
 '.mp4':'video/mp4','.webm':'video/webm','.ico':'image/x-icon','.map':'application/json','.txt':'text/plain; charset=utf-8',
 '.woff':'font/woff','.woff2':'font/woff2',
};

function startStaticServer(){
 return new Promise((resolve,reject)=>{
  const server=createServer((req,res)=>{
   try{
    const u=new URL(req.url||'/', 'http://127.0.0.1');
    let rel=decodeURIComponent(u.pathname);
    if(rel.endsWith('/')) rel+='index.html';
    if(rel.startsWith('/')) rel=rel.slice(1);
    const full=normalize(join(root,rel));
    const relPath=relative(root,full);
    if(!relPath||isAbsolute(relPath)||relPath.split(/[/\\]/).includes('..')){res.writeHead(403);res.end('forbidden');return;}
    if(!existsSync(full)||statSync(full).isDirectory()){res.writeHead(404);res.end('not found');return;}
    const body=readFileSync(full);
    res.writeHead(200,{'Content-Type':MIME[extname(full).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
   }catch(e){res.writeHead(500);res.end(String(e&&e.message||e));}
  });
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{
   const {port}=server.address();
   resolve({server,url:`http://127.0.0.1:${port}/`});
  });
 });
}

function testExists(name){
 return existsSync(join(root,'tests',name+'.mjs'));
}

function resolveChangedTests(){
 const base=process.env.WK_DIFF_BASE||'origin/work/claude-batch';
 let r=spawnSync('git',['diff','--name-only',`${base}...HEAD`],{cwd:root,encoding:'utf8'});
 if(r.status!==0||!(r.stdout||'').trim()){
  r=spawnSync('git',['diff','--name-only','HEAD~1'],{cwd:root,encoding:'utf8'});
 }
 const files=(r.stdout||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const tests=new Set();
 const rules=[
  {re:/^(shared-world|world-rooms|garage-room3d|garage-furniture|loading-tips)\.js$/, tests:['shared-world','world-room']},
  {re:/^workshop-/, tests:['workshop-presentation','workshop-mobile','workshop-batch']},
  {re:/^ride-(pause|replay|buffer)/, tests:['ride-pause-replay','replay-playback','replay-blocks']},
  {re:/^ride-gallery/, tests:['ride-gallery']},
  {re:/^ride-camera/, tests:['ride-camera']},
  {re:/^(ride\.js|ride-loop|ride-physics|ride-tricks|ride-environment|ride-scenery|race-launch)/, tests:['ride-loop','ride-finish','race-balance','crash-ride']},
  {re:/^(ride-controls|panel-scroll)/, tests:['ride-controls','panel-scroll']},
  {re:/^(ride-quality|ride-lod|ride-themes)/, tests:['ride-quality','ride-lod','ride-themes','quality-lifecycle']},
  {re:/^crash-/, tests:['crash-physics','crash-ride']},
  {re:/^sticker-/, tests:['sticker-picker','sticker-frame']},
  {re:/^player-/, tests:['player-rooms','manage-rides']},
  {re:/^garage-/, tests:['garage-drag','manage-rides','world-room']},
  {re:/^trax-/, tests:['trax-bike','trax-mechanics']},
  {re:/^bike-motion/, tests:['bike-motion']},
  {re:/^vehicle-/, tests:['vehicle-platforms']},
  {re:/^modular-/, tests:['modular-builds']},
  {re:/^(boot-loader|sw\.js)/, tests:['boot-loader','check-update']},
  {re:/^(app\.js|builder-|partmodels|parts3d|fitment|gear-)/, tests:['simple-builder','part-fitment','shop-space','basic-crazy']},
  {re:/^terrain-/, tests:['terrain-ride','scene-depth']},
  {re:/^(screen-|workshop-navigation)/, tests:['screen-transitions']},
  {re:/^ride-parameters|^ride-parameter/, tests:['ride-parameters','ride-parameter-integration','physics-cadence']},
 ];
 for(const f of files){
  if(f.startsWith('tests/')&&f.endsWith('.mjs')){
   const name=f.slice('tests/'.length,-'.mjs'.length);
   if(name&&!name.startsWith('_')&&testExists(name)) tests.add(name);
   continue;
  }
  const baseName=f.includes('/')?f.slice(f.lastIndexOf('/')+1):f;
  const pathForMatch=f.replace(/^.*\//,'')===baseName&&!f.includes('/')?f:f;
  // Match against basename for root js, full path otherwise
  const candidate=f.startsWith('scripts/')?null:baseName;
  if(!candidate) continue;
  for(const rule of rules){
   if(rule.re.test(candidate)||rule.re.test(f)){
    for(const t of rule.tests) if(testExists(t)) tests.add(t);
   }
  }
 }
 return [...tests];
}

const requested=process.argv.slice(2);if(!requested.length)requested.push('static');
if(requested.includes('changed')){
 profiles.changed=resolveChangedTests();
 console.log(`changed → ${profiles.changed.length?profiles.changed.join(', '):'(syntax/static only)'}`);
}
for(const profile of requested)if(!Object.hasOwn(profiles,profile)){console.error(`Unknown check group: ${profile}. Choose ${Object.keys(profiles).join(', ')}.`);process.exit(1);}

const out=join(root,'test-results','checks');mkdirSync(out,{recursive:true});
const results=[];
function run(label,args){
 const start=Date.now(),r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',env:process.env}),passed=r.status===0&&!r.error;
 writeFileSync(join(out,label+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?.message||''));
 results.push({check:label,passed,seconds:Math.round((Date.now()-start)/100)/10});
 writeFileSync(join(out,'summary.json'),JSON.stringify({profiles:requested,results},null,2));
 if(!passed){const err=new Error(`FAIL ${label}\n${r.stderr||r.error?.message||r.stdout}`);err.code='CHECK_FAIL';throw err;}
}

async function main(){
 let server;
 if(!process.env.WK_TEST_URL){
  const started=await startStaticServer();
  server=started.server;
  process.env.WK_TEST_URL=started.url;
  console.log(`Serving ${started.url}`);
 }
 try{
  for(const dir of [root,join(root,'scripts'),join(root,'tests')]){
   if(!existsSync(dir)) continue;
   for(const e of readdirSync(dir,{withFileTypes:true})){
    if(e.isFile()&&/\.(?:m?js)$/.test(e.name)) run('syntax-'+e.name,['--check',join(dir,e.name)]);
   }
  }
  const pack=stageRuntime();console.log(`PASS static: syntax and ${pack.files.length} packaged files (${pack.cache})`);
  // One software-rendered Chrome at a time; parallel WebGL runs exhaust this PC.
  for(const name of new Set(requested.flatMap(p=>profiles[p]))){run(name,[join('tests',name+'.mjs')]);console.log(`PASS ${name}`);}
  console.log(`CHECKS PASSED: ${requested.join(', ')}. Logs: test-results/checks/`);
 }finally{
  if(server) await new Promise(r=>server.close(r));
 }
}

main().catch(e=>{if(e&&e.code==='CHECK_FAIL'){console.error(e.message);process.exit(1);}console.error(e);process.exit(1);});
