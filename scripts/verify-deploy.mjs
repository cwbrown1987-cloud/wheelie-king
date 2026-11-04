import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stageRuntime,dist} from './package.mjs';

const hash=data=>createHash('sha256').update(data).digest('hex');
export async function verifyLive(pack){
 const files=pack.files.filter(file=>!['_headers','.nojekyll'].includes(relative(dist,file)));
 let failed=[];
 for(let attempt=0;attempt<4;attempt++){
  failed=[];
  // Bound concurrency; compare every served runtime asset, not just the cache name.
  for(let offset=0;offset<files.length;offset+=6)await Promise.all(files.slice(offset,offset+6).map(async file=>{
   const name=relative(dist,file).replaceAll('\\','/');
   try{
    const response=await fetch(`https://wheelie-king.pages.dev/${name}?release=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==hash(readFileSync(file)))failed.push(name);
   }catch{failed.push(name)}
  }));
  if(!failed.length){console.log(`LIVE VERIFIED: ${files.length} files match (${pack.cache})`);return;}
  if(attempt<3)await new Promise(resolve=>setTimeout(resolve,2000));
 }
 throw Error(`Production verification failed: ${failed.join(', ')}`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await verifyLive(stageRuntime())}catch(error){console.error(error.message);process.exitCode=1;}
}
