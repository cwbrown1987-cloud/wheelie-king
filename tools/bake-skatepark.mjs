// Bakes the Playground skate park (Kenney Mini Skate, CC0): places the pieces, writes the layout for the
// game to draw, and rasterises every piece's triangles into a height grid so the bike rides the real shapes.
// node tools/bake-skatepark.mjs <path to "Models/GLB format"> [--probe]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {writeFileSync,mkdirSync} from 'node:fs';
const dir=process.argv[2],probe=process.argv.includes('--probe');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const cache=new Map();
async function tris(file){
  if(cache.has(file))return cache.get(file);
  const doc=await io.read(dir+'/'+file+'.glb'),out=[];
  for(const node of doc.getRoot().listNodes()){const mesh=node.getMesh();if(!mesh)continue;const m=node.getWorldMatrix();
    const tf=v=>[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
    for(const p of mesh.listPrimitives()){const pos=p.getAttribute('POSITION'),idx=p.getIndices(),n=idx?idx.getCount():pos.getCount(),v=[0,0,0];
      const get=i=>{pos.getElement(i,v);return tf(v);};
      for(let i=0;i<n;i+=3){const a=idx?idx.getScalar(i):i,b=idx?idx.getScalar(i+1):i+1,c=idx?idx.getScalar(i+2):i+2;out.push([get(a),get(b),get(c)]);}}}
  cache.set(file,out);return out;
}
function raster(grid,T){ // max height of the triangle over each cell centre
  const {x0,z0,step,nx,nz,h}=grid;
  for(const [a,b,c] of T){
    const minx=Math.min(a[0],b[0],c[0]),maxx=Math.max(a[0],b[0],c[0]),minz=Math.min(a[2],b[2],c[2]),maxz=Math.max(a[2],b[2],c[2]);
    const i0=Math.max(0,Math.ceil((minx-x0)/step-.5)),i1=Math.min(nx-1,Math.floor((maxx-x0)/step-.5)),j0=Math.max(0,Math.ceil((minz-z0)/step-.5)),j1=Math.min(nz-1,Math.floor((maxz-z0)/step-.5));
    const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)continue;
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const px=x0+(i+.5)*step,pz=z0+(j+.5)*step;
      const l1=((b[2]-c[2])*(px-c[0])+(c[0]-b[0])*(pz-c[2]))/d,l2=((c[2]-a[2])*(px-c[0])+(a[0]-c[0])*(pz-c[2]))/d,l3=1-l1-l2;
      if(l1<-1e-6||l2<-1e-6||l3<-1e-6)continue;const y=l1*a[1]+l2*b[1]+l3*c[1];const k=j*nx+i;if(y>h[k])h[k]=y;}
  }
}
const place=(t,p)=>{ // piece transform: scale s, rotate r quarter turns about y, then translate
  const c=Math.cos(p.r*Math.PI/2),sn=Math.sin(p.r*Math.PI/2);
  return t.map(tri=>tri.map(v=>{const x=v[0]*p.s,y=v[1]*p.s,z=v[2]*p.s;return [x*c+z*sn+p.x,y,-x*sn+z*c+p.z];}));
};
if(probe){
  for(const f of (process.argv[4]||'obstacle-middle,obstacle-box,bowl-platform,structure-wood-platform,structure-wood').split(',')){
    const T=await tris(f),g={x0:-.6,z0:-1.1,step:.1,nx:12,nz:22,h:new Float32Array(12*22)};raster(g,T);
    const row=j=>Array.from({length:12},(_,i)=>g.h[j*12+i].toFixed(2)).join(' ');
    console.log(f,'\n  along x (z=0):',row(11),'\n  along z (x=0):',Array.from({length:22},(_,j)=>g.h[j*12+6].toFixed(2)).join(' '));
  }
  process.exit(0);
}
// ---- layout (metres, park-local; 1 tile = S metres) ----
const S=3.5,R=2.0,P=[];const add=(f,tx,tz,r=0,s=S)=>P.push({f,x:tx*S,z:tz*S,r,s});
// concrete floor 12 x 10 tiles
for(let i=-6;i<6;i++)for(let j=-5;j<5;j++)add('floor-concrete',i+.5,j+.5);
const W=(f,tx,tz,r,s)=>add(f,tx,tz,r,s);
// quarter pipes round the edges, facing in (high side at the wall); low ones along the back
for(let j=-3;j<=3;j++){W('half-pipe',-5.5,j+.5-.5,1);W('half-pipe',5.5,j+.5-.5,3);}
for(let i=-4;i<=4;i++)W('half-pipe-low',i,-4.5,0);
// funbox in the middle: ramp up, box deck, ramp down (two tiles wide)
for(const tx of [-.5,.5]){W('ramp',tx,1,0);W('ramp',tx,0,2);} // two ramps back to back: up, flat deck, down
// ledge line: ramp up onto a box, steps down off it
W('ramp',3,0,2);W('steps',3,1,0); // ride south: up the ramp onto its deck, down the steps
// spine / pyramid from two smooth banks back to back (smaller scale)
W('slope-smooth',-3,-1.5,3,2);W('slope-smooth',-2,-1.5,1,2);
// rails (scaled for bikes: ~0.5 m and ~0.9 m)
W('rail-low',-2.5,2.5,0,R);W('rail-high',-1.2,3,0,R);W('rail-slope',2.2,3.2,0,R);
// a kicker to the box gap
W('ramp',0,4,0,2.2);
// benches and fence along the open south side (gap in the middle to ride in)
for(const tx of [-5,-4,-3,3,4,5])W('fence',tx,4.95,0);
W('benches',-4.3,3.6,0,2.2);W('bench',4.5,3.4,2,2.2);
if(!probe){
  const half={x:22,z:19},step=.1,nx=Math.round(2*half.x/step),nz=Math.round(2*half.z/step);
  const grid={x0:-half.x,z0:-half.z,step,nx,nz,h:new Float32Array(nx*nz)};
  for(const p of P){if(p.f==='floor-concrete')continue;raster(grid,place(await tris(p.f),p));}
  // round off near-vertical faces of the transitions (quarter pipe copings) so the bike launches off the
  // steep top like a lip instead of meeting a vertical wall; square edges of boxes/benches stay walls
  const maxStep=step*Math.tan(72*Math.PI/180);
  const isTrans=new Uint8Array(nx*nz);for(const p of P){if(!/half-pipe|slope-smooth/.test(p.f))continue;const r=p.s*.6;for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=grid.x0+(i+.5)*step,z=grid.z0+(j+.5)*step;if(Math.abs(x-p.x)<r&&Math.abs(z-p.z)<r)isTrans[j*nx+i]=1;}}
  for(let pass=0;pass<40;pass++){let ch=0;for(let j=1;j<nz-1;j++)for(let i=1;i<nx-1;i++){const k=j*nx+i;if(!isTrans[k])continue;const lo=Math.min(grid.h[k-1],grid.h[k+1],grid.h[k-nx],grid.h[k+nx]);if(grid.h[k]-lo>maxStep){grid.h[k]=lo+maxStep;ch++;}}if(!ch)break;}
  const out=process.argv[3]||'.';mkdirSync(out,{recursive:true});
  writeFileSync(out+'/height.bin',Buffer.from(new Uint16Array(Array.from(grid.h,v=>Math.round(Math.max(0,v)*100))).buffer));
  writeFileSync(out+'/park.json',JSON.stringify({grid:{halfX:half.x,halfZ:half.z,step,nx,nz,unit:.01,file:'height.bin'},pieces:P.map(p=>({f:p.f,x:+p.x.toFixed(3),z:+p.z.toFixed(3),r:p.r,s:p.s}))}));
  console.log('pieces',P.length,'grid',nx,nz,'max h',grid.h.reduce((a,b)=>Math.max(a,b),0).toFixed(2));
}
