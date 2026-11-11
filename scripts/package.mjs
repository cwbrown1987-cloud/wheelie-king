import {cpSync,existsSync,mkdirSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

export const root=fileURLToPath(new URL('../',import.meta.url));
export const dist=join(root,'dist');
export function stageRuntime(){
 // Fixed workspace target; never upload attachments, history, tests or tools.
 rmSync(dist,{recursive:true,force:true});mkdirSync(dist);
 const modules=readdirSync(root,{withFileTypes:true}).filter(e=>e.isFile()&&e.name.endsWith('.js')).map(e=>e.name);
 for(const name of [...modules,'index.html','jolt-sandbox.html','manifest.webmanifest','_headers','.nojekyll','vendor','stickers','icons','src','assets'])cpSync(join(root,name),join(dist,name),{recursive:true});
 const sw=readFileSync(join(dist,'sw.js'),'utf8'),shell=JSON.parse(sw.match(/const SHELL = (\[.*?\]);/s)[1]);
 for(const asset of shell)if(!existsSync(join(dist,asset)))throw Error(`Missing precache asset: ${asset}`);
 // Every ./assets/... URL a ride module references must ship (v33f: the HDRI and ground textures were missing).
 for(const mod of modules){const src=readFileSync(join(root,mod),'utf8');for(const m of src.matchAll(/['"`]\.\/(assets\/[A-Za-z0-9_\/.-]+?)(?:\$\{|['"`])/g)){const rel=m[1].endsWith('/')?m[1].slice(0,-1):m[1];if(!existsSync(join(dist,rel)))throw Error(`Missing asset referenced by ${mod}: ${rel}`);}}
 const files=readdirSync(dist,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>join(e.parentPath,e.name));
 return {cache:sw.match(/const CACHE = "([^"]+)"/)[1],files};
}
