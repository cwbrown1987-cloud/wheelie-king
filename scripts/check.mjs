import {mkdirSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,stageRuntime} from './package.mjs';

const profiles={static:[],scene:['scene-depth','terrain-ride'],builder:['simple-builder','workshop-batch','workshop-presentation'],ride:['ride-landings','ride-controls','crash-physics','crash-ride'],mechanics:['bike-motion','trax-mechanics'],modular:['modular-builds']};
profiles.release=[...profiles.scene,...profiles.builder,...profiles.ride,...profiles.mechanics,...profiles.modular];
const requested=process.argv.slice(2);if(!requested.length)requested.push('static');
for(const profile of requested)if(!Object.hasOwn(profiles,profile)){console.error(`Unknown check group: ${profile}. Choose ${Object.keys(profiles).join(', ')}.`);process.exit(1);}
const out=join(root,'test-results','checks');mkdirSync(out,{recursive:true});
const results=[];
function run(label,args){
 const start=Date.now(),r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'}),passed=r.status===0&&!r.error;
 writeFileSync(join(out,label+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?.message||''));
 results.push({check:label,passed,seconds:Math.round((Date.now()-start)/100)/10});
 writeFileSync(join(out,'summary.json'),JSON.stringify({profiles:requested,results},null,2));
 if(!passed){console.error(`FAIL ${label}\n${r.stderr||r.error?.message||r.stdout}`);process.exit(1);}
}
for(const dir of [root,join(root,'scripts')])for(const e of readdirSync(dir,{withFileTypes:true}))if(e.isFile()&&/\.(?:m?js)$/.test(e.name))run('syntax-'+e.name,['--check',join(dir,e.name)]);
const pack=stageRuntime();console.log(`PASS static: syntax and ${pack.files.length} packaged files (${pack.cache})`);
// One software-rendered Chrome at a time; parallel WebGL runs exhaust this PC.
for(const name of new Set(requested.flatMap(p=>profiles[p]))){run(name,[join('tests',name+'.mjs')]);console.log(`PASS ${name}`);}
console.log(`CHECKS PASSED: ${requested.join(', ')}. Logs: test-results/checks/`);
