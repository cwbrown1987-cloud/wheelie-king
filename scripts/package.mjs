import {cpSync,existsSync,mkdirSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

export const root=fileURLToPath(new URL('../',import.meta.url));
export const dist=join(root,'dist');
export function stageRuntime(){
 // Fixed workspace target; never upload attachments, history, tests or tools.
 rmSync(dist,{recursive:true,force:true});mkdirSync(dist);
 const modules=readdirSync(root,{withFileTypes:true}).filter(e=>e.isFile()&&e.name.endsWith('.js')).map(e=>e.name);
 for(const name of [...modules,'index.html','manifest.webmanifest','_headers','.nojekyll','vendor','stickers','icons','src','assets/workshop'])cpSync(join(root,name),join(dist,name),{recursive:true});
 const sw=readFileSync(join(dist,'sw.js'),'utf8'),shell=JSON.parse(sw.match(/const SHELL = (\[.*?\]);/s)[1]);
 for(const asset of shell)if(!existsSync(join(dist,asset)))throw Error(`Missing precache asset: ${asset}`);
 const files=readdirSync(dist,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>join(e.parentPath,e.name));
 return {cache:sw.match(/const CACHE = "([^"]+)"/)[1],files};
}
