import {createServer} from 'node:http';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {join, extname, normalize, relative, isAbsolute} from 'node:path';
import {root} from './package.mjs';

const MIME={
 '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png',
 '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.wasm':'application/wasm',
 '.mp4':'video/mp4','.webm':'video/webm','.ico':'image/x-icon','.map':'application/json','.txt':'text/plain; charset=utf-8',
 '.woff':'font/woff','.woff2':'font/woff2',
};

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

const port=Number(process.env.WK_SERVE_PORT||0);
server.listen(port,'127.0.0.1',()=>{
  const {port:p}=server.address();
  process.stdout.write(`WK_SERVING http://127.0.0.1:${p}/\n`);
});
