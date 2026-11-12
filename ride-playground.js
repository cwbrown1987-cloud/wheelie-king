// PLAYGROUND: one big flat ground plane for movement testing. Single tiling
// ambientCG Ground086 texture, world-locked UVs. The HDRI sky and sun live in ride.js.
const SIZE=2000,TILE=6;
// Three table-top jumps (kicker, flat deck, landing), off to the side of the spawn line (z = 14 m) and
// running along +X. Our own procedural geometry (no third-party asset). Jolt gets the same triangles
// as a static MeshShape (ride-jolt.js), so what you see is what you hit.
// Kicker = circular transition from flat to the lip angle (as a real dirt/park kicker), so the bike
// leaves the lip pointing up at `lip` degrees. Radius follows from height and lip: R = h / (1 - cos lip).
export const PLAYGROUND_RAMPS=[
  {id:'small',x:30,z:14,h:0.5,lip:28,top:1.6,down:3.5,w:3.0},
  {id:'medium',x:58,z:14,h:0.85,lip:30,top:3.0,down:5.5,w:3.2},
  {id:'large',x:92,z:14,h:1.25,lip:32,top:4.0,down:7.5,w:3.6},
];
const ARC_STEPS=10;
export function rampProfile(r){
  const a=r.lip*Math.PI/180,R=r.h/(1-Math.cos(a)),pts=[];
  for(let i=0;i<=ARC_STEPS;i++){const t=a*i/ARC_STEPS;pts.push([R*Math.sin(t),R*(1-Math.cos(t))]);}
  const up=pts[ARC_STEPS][0];pts.push([up+r.top,r.h],[up+r.top+r.down,0]);
  return pts;
}
const PROFILES=PLAYGROUND_RAMPS.map(rampProfile);
export function rampHeight(x,z){
  let y=0;PLAYGROUND_RAMPS.forEach((r,k)=>{if(Math.abs(z-r.z)>r.w/2)return;const u=x-r.x,P=PROFILES[k];
    if(u<=0||u>=P[P.length-1][0])return;for(let i=0;i<P.length-1;i++)if(u<=P[i+1][0]){const t=(u-P[i][0])/(P[i+1][0]-P[i][0]);y=Math.max(y,P[i][1]+(P[i+1][1]-P[i][1])*t);break;}});
  return y;
}
// UNEVEN TERRAIN lane (v2.0.1): runs along +X at z = TERRAIN.z, to the right of the spawn line.
// Rollers, a 3 m climb, a plateau with a side slope, a descent and moguls, with 10 m embankments.
// Jolt gets it as a HeightFieldShape sampled from this same function.
export const TERRAIN={x0:20,len:150,z:-30,core:8,bank:10};
const ss=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
function lane(u){
  if(u<8||u>150)return 0;
  if(u<38)return 0.35*(0.5-0.5*Math.cos(2*Math.PI*(u-8)/6));          // 5 rollers, 6 m apart
  if(u<46)return 0;
  if(u<84)return 3*ss((u-46)/38);                                     // uphill, max ~12 %
  if(u<104)return 3;                                                  // plateau (side slope added below)
  if(u<136)return 3*(1-ss((u-104)/32));                               // downhill, max ~14 %
  return 0;
}
const moguls=(u,dz)=>u>138&&u<150?0.14*Math.sin(Math.PI*(u-138)/12)*(0.5+0.5*Math.cos(2*Math.PI*(u-138)/3))*(0.6+0.4*Math.cos(dz*0.7)):0;
export function terrainHeight(x,z){
  const T=TERRAIN,u=x-T.x0,dz=z-T.z,az=Math.abs(dz);
  if(u<0||u>T.len||az>=T.core+T.bank)return 0;
  const w=1-ss((az-T.core)/T.bank);
  const side=0.1*Math.max(-T.core,Math.min(T.core,dz))*ss((u-86)/6)*(1-ss((u-96)/6)); // ~10 % cross slope on the plateau
  return Math.max(0,(lane(u)+side+moguls(u,dz))*w);
}
// Side-view test track: a short straight dirt strip along +X (z = 40) with bumps, a table-top, whoops
// and a gap jump. Switching the Playground to side view puts you at its start, steering locked, so the
// side-scroller feel can be tested in the 3D world.
export const SIDE_TRACK={x0:-50,len:110,z:40,w:5};
export function sideTrackProfile(u){
  if(u<10||u>110)return 0;
  if(u<28)return 0.3*(0.5-0.5*Math.cos(2*Math.PI*(u-10)/6));          // 3 bumps
  if(u<37)return 0;
  if(u<40)return 0.9*((u-37)/3)**2;                                    // kicker, ~31 deg lip
  if(u<44)return 0.9;                                                  // table
  if(u<50)return 0.9*(1-ss((u-44)/6));                                 // landing
  if(u<58)return 0;
  if(u<70)return 0.25*(0.5-0.5*Math.cos(2*Math.PI*(u-58)/3));          // whoops
  if(u<76)return 0;
  if(u<79.5)return 1.2*((u-76)/3.5)**2;                                // gap kicker, ~34 deg lip
  if(u<84)return 0;                                                    // gap
  if(u<85)return 1.2*ss(u-84);                                         // landing ramp back face (short)
  if(u<93)return 1.2*(1-ss((u-85)/8));                                 // landing ramp
  return 0;
}
export function sideTrackHeight(x,z){const T=SIDE_TRACK;if(Math.abs(z-T.z)>T.w/2)return 0;return sideTrackProfile(x-T.x0);}
export const playgroundHeight=(x,z)=>Math.max(rampHeight(x,z),terrainHeight(x,z),sideTrackHeight(x,z));
const GROUND={Color:'./assets/ambientcg/Ground086/Ground086_1K-JPG_Color.jpg',NormalGL:'./assets/ambientcg/Ground086/Ground086_1K-JPG_NormalGL.jpg',Roughness:'./assets/ambientcg/Ground086/Ground086_1K-JPG_Roughness.jpg'};
const DIRT={Color:'./assets/ambientcg/Ground054/Ground054_1K-JPG_Color.jpg',NormalGL:'./assets/ambientcg/Ground054/Ground054_1K-JPG_NormalGL.jpg',Roughness:'./assets/ambientcg/Ground054/Ground054_1K-JPG_Roughness.jpg'};
// Ramp triangles in world space (top surface + both side walls), shared by the drawn mesh and Jolt.
export function rampTriangles(r){
  const P=rampProfile(r),z0=r.z-r.w/2,z1=r.z+r.w/2,tris=[];
  for(let i=0;i<P.length-1;i++){const [ua,ya]=P[i],[ub,yb]=P[i+1],xa=r.x+ua,xb=r.x+ub;
    tris.push([[xa,ya,z1],[xb,yb,z1],[xb,yb,z0]],[[xa,ya,z1],[xb,yb,z0],[xa,ya,z0]]);        // top (normal up)
    tris.push([[xa,0,z1],[xb,0,z1],[xb,yb,z1]],[[xa,0,z1],[xb,yb,z1],[xa,ya,z1]]);             // +z wall
    tris.push([[xa,0,z0],[xb,yb,z0],[xb,0,z0]],[[xa,0,z0],[xa,ya,z0],[xb,yb,z0]]);}            // -z wall
  return tris;
}
export function makePlaygroundWorld(T,scene,terrain,{lowDetail=false}={}){
  const root=new T.Group();root.name='wk:environment';root.userData.playground=true;scene.add(root);
  const texs=[];
  const load=(set,kind,srgb=false,rep=SIZE/TILE)=>{
    const t=new T.TextureLoader().load(set[kind]);
    if(srgb)t.colorSpace=T.SRGBColorSpace;
    t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rep,rep);t.anisotropy=8;texs.push(t);return t;
  };
  const mat=new T.MeshStandardMaterial({map:load(GROUND,'Color',true),normalMap:lowDetail?null:load(GROUND,'NormalGL'),roughnessMap:load(GROUND,'Roughness'),roughness:1,metalness:0});
  const geo=new T.PlaneGeometry(SIZE,SIZE);
  const floor=new T.Mesh(geo,mat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.name='environment:playground-floor';root.add(floor);
  const rampMat=new T.MeshStandardMaterial({color:0x9a958d,roughness:.85,metalness:0}),edgeMat=new T.MeshStandardMaterial({color:0xf2b233,roughness:.6});
  const rampGeos=[];
  for(const r of PLAYGROUND_RAMPS){
    const pos=[];for(const t of rampTriangles(r))for(const v of t)pos.push(v[0]-r.x,v[1],v[2]-r.z);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();rampGeos.push(g);
    const m=new T.Mesh(g,rampMat);m.position.set(r.x,0,r.z);m.castShadow=m.receiveShadow=true;m.name='environment:ramp:'+r.id;root.add(m);
    // yellow lip stripes at the kicker lip and the landing start so the edges read on a phone
    const P=rampProfile(r);for(const u of [P[ARC_STEPS][0],P[ARC_STEPS+1][0]]){const e=new T.Mesh(new T.BoxGeometry(.12,.03,r.w),edgeMat);e.position.set(r.x+u,r.h+.015,r.z);root.add(e);rampGeos.push(e.geometry);}
  }
  // Terrain lane: grid mesh displaced by terrainHeight, world-locked UVs, CC0 ambientCG Ground054 dirt.
  const TR=TERRAIN,CELL=0.5,x0=TR.x0-1,x1=TR.x0+TR.len+1,z0=TR.z-TR.core-TR.bank-1,z1=TR.z+TR.core+TR.bank+1;
  const nx=Math.round((x1-x0)/CELL),nz=Math.round((z1-z0)/CELL),tp=[],tu=[],tc=[],ti=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=x0+i*CELL,z=z0+j*CELL,h=terrainHeight(x,z);tp.push(x,h,z);tu.push(x/4,-z/4);
    const sl=Math.hypot(terrainHeight(x+.5,z)-terrainHeight(x-.5,z),terrainHeight(x,z+.5)-terrainHeight(x,z-.5));const c=1-Math.min(.3,sl*.6);tc.push(c,c,c);}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;ti.push(a,c,b,b,c,d);}
  const tg=new T.BufferGeometry();tg.setAttribute('position',new T.Float32BufferAttribute(tp,3));tg.setAttribute('uv',new T.Float32BufferAttribute(tu,2));tg.setAttribute('color',new T.Float32BufferAttribute(tc,3));tg.setIndex(ti);tg.computeVertexNormals();
  const tmat=new T.MeshStandardMaterial({map:load(DIRT,'Color',true,1),normalMap:lowDetail?null:load(DIRT,'NormalGL',false,1),roughnessMap:load(DIRT,'Roughness',false,1),roughness:1,metalness:0,vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const tmesh=new T.Mesh(tg,tmat);tmesh.receiveShadow=true;tmesh.castShadow=!lowDetail;tmesh.name='environment:terrain-lane';root.add(tmesh);
  // Side-view track: dirt ribbon displaced by sideTrackHeight, with start/finish stripes.
  const ST=SIDE_TRACK,SC=0.25,sx0=ST.x0-1,sx1=ST.x0+ST.len+1,sz0=ST.z-ST.w/2-.25,sz1=ST.z+ST.w/2+.25;
  const snx=Math.round((sx1-sx0)/SC),snz=Math.round((sz1-sz0)/SC),sp=[],su=[],si=[],sc=[];
  for(let j=0;j<=snz;j++)for(let i=0;i<=snx;i++){const x=sx0+i*SC,z=sz0+j*SC,h=sideTrackHeight(x,z);sp.push(x,h,z);su.push(x/4,-z/4);const c=Math.abs(z-ST.z)>ST.w/2?.75:1;sc.push(c,c,c);}
  for(let j=0;j<snz;j++)for(let i=0;i<snx;i++){const a=j*(snx+1)+i,b=a+1,c=a+snx+1,d=c+1;si.push(a,c,b,b,c,d);}
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sp,3));sg.setAttribute('uv',new T.Float32BufferAttribute(su,2));sg.setAttribute('color',new T.Float32BufferAttribute(sc,3));sg.setIndex(si);sg.computeVertexNormals();
  const smesh=new T.Mesh(sg,tmat);smesh.receiveShadow=true;smesh.castShadow=!lowDetail;smesh.name='environment:side-track';root.add(smesh);
  for(const u of [2,ST.len-2]){const e=new T.Mesh(new T.BoxGeometry(.3,.03,ST.w),edgeMat);e.position.set(ST.x0+u,.02,ST.z);root.add(e);rampGeos.push(e.geometry);}
  return {
    roadMap:mat.map,colliders:[],isDirt:()=>true,surfaceAt:()=>'dirt',
    update(){},view(){},
    state:()=>({playground:true,arena:true,size:SIZE,ground:'Ground086',terrainGround:'Ground054',tile:TILE,uvWorld:true,props:0,ramps:PLAYGROUND_RAMPS.length,colliders:PLAYGROUND_RAMPS.length+1,terrain:{...TERRAIN,shape:'HeightFieldShape'},bounds:terrain.bounds}),
    dispose(){texs.forEach(t=>t.dispose());mat.dispose();geo.dispose();rampGeos.forEach(g=>g.dispose());rampMat.dispose();edgeMat.dispose();tg.dispose();sg.dispose();tmat.dispose();root.removeFromParent();}
  };
}
