import {mkdirSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {root,stageRuntime} from './package.mjs';

const profiles={static:[],player:['player-rooms','garage-drag','manage-rides'],scene:['scene-depth','terrain-ride'],polish:['spawn-polish','sticker-picker'],vehicles:['vehicle-platforms'],builder:['part-fitment','basic-crazy','unlimited-zoom','check-update','replay-blocks','ride-gallery','boot-loader','simple-builder','workshop-batch','workshop-presentation','workshop-mobile','shop-space'],ride:['ride-camera','ride-loop','ride-finish','ride-lod','ride-quality','ride-themes','quality-lifecycle','ride-landings','wheelie-balance','air-control','ride-controls','crash-physics','crash-ride','race-balance','ride-pause-replay','check-update','replay-blocks','ride-gallery','boot-loader','replay-playback','panel-scroll'],mechanics:['bike-motion','trax-mechanics'],modular:['modular-builds']};
profiles.gpu=['claude-gpu'];
profiles.transitions=['screen-transitions'];
profiles.rooms=['shared-world','world-room','workshop-presentation','garage-drag','player-rooms','manage-rides','workshop-mobile'];
profiles.powertrain=['ride-parameters','physics-cadence','ride-parameter-integration','race-balance'];
profiles.menus=['part-fitment','basic-crazy','unlimited-zoom','check-update','replay-blocks','ride-gallery','boot-loader','simple-builder','sticker-picker','workshop-mobile','shop-space'];
profiles.release=[...profiles.transitions,...profiles.rooms,...profiles.powertrain,...profiles.scene,...profiles.builder,...profiles.ride,...profiles.mechanics,...profiles.modular,...profiles.vehicles,...profiles.polish,...profiles.player];
profiles.changed=[]; // filled below when requested

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
  if(f.startsWith('scripts/')) continue;
  for(const rule of rules){
   if(rule.re.test(baseName)||rule.re.test(f)){
    for(const t of rule.tests) if(testExists(t)) tests.add(t);
   }
  }
 }
 return [...tests];
}

function startStaticServerChild(){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[join(root,'scripts','static-server.mjs')],{cwd:root,stdio:['ignore','pipe','pipe']});
  let buf='';
  const timer=setTimeout(()=>{child.kill();reject(new Error('static server start timeout'));},10000);
  child.stdout.on('data',d=>{
   buf+=d.toString();
   const m=buf.match(/WK_SERVING (http:\/\/127\.0\.0\.1:\d+\/)/);
   if(m){clearTimeout(timer);resolve({child,url:m[1]});}
  });
  child.stderr.on('data',d=>{buf+=d.toString();});
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('exit',code=>{clearTimeout(timer);reject(new Error('static server exited early: '+code+' '+buf));});
 });
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
 let child;
 if(!process.env.WK_TEST_URL){
  const started=await startStaticServerChild();
  child=started.child;
  process.env.WK_TEST_URL=started.url;
  console.log(`Serving ${started.url}`);
 }
 try{
  for(const dir of [root,join(root,'scripts'),join(root,'tests')]){
   if(!existsSync(dir)) continue;
   for(const e of readdirSync(dir,{withFileTypes:true})){
    if(e.isFile()&&!e.name.startsWith('.')&&/\.(?:m?js)$/.test(e.name)) run('syntax-'+e.name,['--check',join(dir,e.name)]);
   }
  }
  const pack=stageRuntime();console.log(`PASS static: syntax and ${pack.files.length} packaged files (${pack.cache})`);
  // One software-rendered Chrome at a time; parallel WebGL runs exhaust this PC.
  for(const name of new Set(requested.flatMap(p=>profiles[p]))){run(name,[join('tests',name+'.mjs')]);console.log(`PASS ${name}`);}
  console.log(`CHECKS PASSED: ${requested.join(', ')}. Logs: test-results/checks/`);
 }finally{
  if(child&&!child.killed){child.kill(); try{child.kill('SIGKILL');}catch{}}
 }
}

main().catch(e=>{if(e&&e.code==='CHECK_FAIL'){console.error(e.message);process.exit(1);}console.error(e);process.exit(1);});
