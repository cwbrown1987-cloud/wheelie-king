// The shipped cache name must change whenever any shipped file changes (v2.1-63). Before this, the name stayed
// "wk-v2.1-classic" build after build, so phones kept old copies of every file outside the service-worker SHELL.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {buildStamp,stageRuntime,dist} from '../scripts/package.mjs';
const dir=mkdtempSync(join(tmpdir(),'wk-stamp-'));
try{
 mkdirSync(join(dir,'assets'));writeFileSync(join(dir,'a.js'),'one');writeFileSync(join(dir,'assets','sky.hdr'),'sky');
 const first=buildStamp(dir);assert.match(first,/^[0-9a-f]{8}$/);
 assert.equal(buildStamp(dir),first,'same files, same stamp');
 writeFileSync(join(dir,'assets','sky.hdr'),'sky2');const second=buildStamp(dir);assert.notEqual(second,first,'a changed texture changes the stamp');
 writeFileSync(join(dir,'b.js'),'');assert.notEqual(buildStamp(dir),second,'a new file changes the stamp');
}finally{rmSync(dir,{recursive:true,force:true});}
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8').match(/const CACHE = "([^"]+)"/)[1];
const pack=stageRuntime(),shipped=readFileSync(join(dist,'sw.js'),'utf8').match(/const CACHE = "([^"]+)"/)[1];
assert.equal(shipped,pack.cache);
assert.match(shipped,new RegExp('^'+source.replace(/[.]/g,'\\.')+'-[0-9a-f]{8}$'),'shipped cache name = source name + build stamp');
// the names the game compares (boot-loader.js / builder-mode.js shortBuild) must keep the stamp
const short=s=>(String(s).match(/racefix\d+|wk-[\w.-]+$/)||[])[0];
assert.equal(short(shipped),shipped);assert.equal(short('wk-beta-'+shipped),'wk-beta-'+shipped);
console.log('build stamp ok:',shipped);
