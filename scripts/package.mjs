import {cpSync,existsSync,mkdirSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';

export const root=fileURLToPath(new URL('../',import.meta.url));
export const dist=join(root,'dist');
export function stageRuntime(){
 // Fixed workspace target; never upload attachments, history, tests or tools.
 rmSync(dist,{recursive:true,force:true});mkdirSync(dist);
 const modules=readdirSync(root,{withFileTypes:true}).filter(e=>e.isFile()&&e.name.endsWith('.js')).map(e=>e.name);
 for(const name of [...modules,'index.html','ride-preload.json','manifest.webmanifest','_headers','.nojekyll','vendor','stickers','icons','src','assets'])cpSync(join(root,name),join(dist,name),{recursive:true});
 const sw=readFileSync(join(dist,'sw.js'),'utf8'),shell=JSON.parse(sw.match(/const SHELL = (\[.*?\]);/s)[1]);
 for(const asset of shell)if(!existsSync(join(dist,asset)))throw Error(`Missing precache asset: ${asset}`);
 // Every ./assets/... URL a ride module references must ship (v33f: the HDRI and ground textures were missing).
 for(const mod of modules){const src=readFileSync(join(root,mod),'utf8');for(const m of src.matchAll(/['"`]\.\/(assets\/[A-Za-z0-9_\/.-]+?)(?:\$\{|['"`])/g)){const rel=m[1].endsWith('/')?m[1].slice(0,-1):m[1];if(!existsSync(join(dist,rel)))throw Error(`Missing asset referenced by ${mod}: ${rel}`);}}
 const files=readdirSync(dist,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>join(e.parentPath,e.name));
 // v2.1-63: the shipped cache name carries a stamp of everything in the build, so ANY changed file (script, texture,
 // model) gives a new name. The boot loader and "Check for update" compare that name, and the service worker drops
 // caches with another name, so a phone can no longer keep old copies of files that are not in SHELL.
 const base=sw.match(/const CACHE = "([^"]+)"/)[1],cache=`${base}-${buildStamp(dist)}`;
 if(sw.split(`const CACHE = "${base}"`).length!==2)throw Error('sw.js needs exactly one CACHE line');
 writeFileSync(join(dist,'sw.js'),sw.replace(`const CACHE = "${base}"`,`const CACHE = "${cache}"`));
 return {cache,files};
}
// 8 hex digits from the path and bytes of every file under dir (sorted, so the same build always gives the same stamp).
export function buildStamp(dir){
 const h=createHash('sha256');
 const files=readdirSync(dir,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>relative(dir,join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
 for(const f of files){h.update(f);h.update('\0');h.update(readFileSync(join(dir,f)));h.update('\0');}
 return h.digest('hex').slice(0,8);
}
