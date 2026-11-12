// PLAYGROUND: one big flat ground plane for movement testing. Single tiling
// ambientCG Ground086 texture, world-locked UVs. The HDRI sky and sun live in ride.js.
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {makeLoopMesh} from './ride-loop.js';
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
  // v2.1-8: a ride-round circuit either side of the side-view track. North straight (z = 54) runs +X,
  // south straight (z = 26) runs back -X (dir -1), so you can lap the track hitting jumps both ways.
  {id:'north-1',x:-40,z:54,h:0.6,lip:28,top:2.0,down:4.0,w:3.4},
  {id:'north-2',x:-5,z:54,h:1.0,lip:30,top:3.5,down:6.0,w:3.4},
  {id:'north-3',x:30,z:54,h:0.45,lip:24,top:0.4,down:3.0,w:3.4},
  {id:'south-1',x:60,z:26,h:0.7,lip:28,top:2.5,down:4.5,w:3.4,dir:-1},
  {id:'south-2',x:25,z:26,h:1.1,lip:31,top:3.5,down:6.5,w:3.4,dir:-1},
  {id:'south-3',x:-15,z:26,h:0.5,lip:26,top:1.5,down:3.5,w:3.4,dir:-1},
];
// Loop-the-loops (the rider is carried round by ride-loop.js; the heightfield can't hold an overhang).
// Ride in heading +X, lined up, at about 40 km/h or more; too slow and you fall off the top.
export const PLAYGROUND_LOOPS=[
  {id:'track-loop',x:75,y:0,z:40,w:3,radius:3.5,exitOffset:3,zShift:2.4,minSpeed:4},
  {id:'north-loop',x:62,y:0,z:54,w:3,radius:4.5,exitOffset:3.5,zShift:2.6,minSpeed:4},
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
  let y=0;PLAYGROUND_RAMPS.forEach((r,k)=>{if(Math.abs(z-r.z)>r.w/2)return;let u=x-r.x;const P=PROFILES[k];
    u*=r.dir||1;if(u<=0||u>=P[P.length-1][0])return;for(let i=0;i<P.length-1;i++)if(u<=P[i+1][0]){const t=(u-P[i][0])/(P[i+1][0]-P[i][0]);y=Math.max(y,P[i][1]+(P[i+1][1]-P[i][1])*t);break;}});
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
export const SIDE_TRACK={x0:-50,len:150,z:40,w:5};
export function sideTrackProfile(u){
  if(u<10||u>150)return 0;
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
// PROPS (v2.1-8): CC0 Poly Haven rocks, logs, stumps and trees (assets/polyhaven, see LICENSES.md).
// Two kinds of collision:
//  - 'bump' props (small rocks, logs) are part of the ground: you ride over them like a hump;
//  - 'post' props (trees, stumps, boulders) are solid round obstacles: glance off them, or hit one
//    head-on fast and you crash.
// model: glb file, s: scale, rot: yaw (rad). bump: {a,b,h} half-length, half-width, height (rotated by rot).
export const PROP_MODELS={
  rock7:{file:'rock_07.glb'},rock9:{file:'rock_09.glb'},boulder:{file:'namaqualand_boulder_04.glb'},
  tree:{file:'quiver_tree_01.glb'},log:{file:'dead_tree_trunk.glb'},stump:{file:'tree_stump_01.glb'},
};
function buildProps(){
  const out=[];let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const tree=(x,z,s=1.4+rnd()*.5)=>out.push({m:'tree',x,z,s,rot:rnd()*6.28,post:.24*s});
  const stump=(x,z,s=.9+rnd()*.3)=>out.push({m:'stump',x,z,s,rot:rnd()*6.28,post:.6*s});
  const boulder=(x,z,s=.8+rnd()*.5)=>out.push({m:'boulder',x,z,s,rot:rnd()*6.28,post:1.15*s});
  const rock=(x,z,s)=>{const m=rnd()<.5?'rock7':'rock9',rot=rnd()*6.28;
    // rock_07 is ~0.17 x 0.14 x 0.32 m (x,y,z) as modelled, rock_09 ~0.08 x 0.03 x 0.14 m: scaled up to
    // rideable humps, squashed so none stands taller than ~0.4 m.
    const k=m==='rock7'?s:s*2.2,hx=(m==='rock7'?.085:.04)*k,hz=(m==='rock7'?.16:.07)*k,h0=(m==='rock7'?.14:.03)*k,sy=Math.min(1.4,.4/h0);
    out.push({m,x,z,s:k,rot,sy,bump:{a:hx+.35,b:hz+.35,h:h0*sy}});};
  const log=(x,z,rot,s=1.2)=>out.push({m:'log',x,z,s,rot,bump:{a:1.5*s,b:.75,h:.26*s}});
  // tree lines either side of the side-view track (clear of its 5 m width and the circuit ramps)
  for(let x=-48;x<=78;x+=9){tree(x+rnd()*3,33+rnd()*1.5);tree(x+4+rnd()*3,47-rnd()*1.5);}
  // slalom near spawn: trees to weave through (and test glancing hits)
  for(let i=0;i<8;i++)tree(14+i*8,-6+(i%2?2.2:-2.2),1.5);
  // rock garden: rideable rocks and logs, with boulders and stumps to dodge
  for(let i=0;i<26;i++)rock(86+rnd()*36,62+rnd()*20,2.5+rnd()*1.5);
  for(let i=0;i<5;i++)log(90+rnd()*30,64+rnd()*16,rnd()*3.14);
  for(let i=0;i<6;i++)boulder(88+rnd()*34,62+rnd()*20);
  for(let i=0;i<5;i++)stump(88+rnd()*34,62+rnd()*20);
  // a few logs to hop across the open ground near spawn
  log(-12,6,Math.PI/2);log(-20,6,Math.PI/2+.3);log(-28,6,Math.PI/2-.2);
  // keep posts off the circuit lines and loop run-ins
  return out.filter(p=>!(p.post&&(Math.abs(p.z-54)<3||Math.abs(p.z-26)<3)&&p.x<85));
}
export const PLAYGROUND_PROPS=buildProps();
export const PLAYGROUND_POSTS=PLAYGROUND_PROPS.filter(p=>p.post).map(p=>({x:p.x,z:p.z,r:p.post,kind:p.m,h:(p.m==='tree'?2.7:p.m==='stump'?.55:1.8)*p.s}));
const BUMPS=PLAYGROUND_PROPS.filter(p=>p.bump).map(p=>({x:p.x,z:p.z,c:Math.cos(p.rot),n:Math.sin(p.rot),...p.bump,log:p.m==='log'}));
export function propHeight(x,z){
  let y=0;for(const b of BUMPS){const dx=x-b.x,dz=z-b.z;const R=Math.max(b.a,b.b)+.1;if(Math.abs(dx)>R||Math.abs(dz)>R)continue;
    // model space: +X along the prop (three.js rotation.y=rot maps local x to (cos, -sin) in x,z)
    const u=dx*b.c-dz*b.n,v=dx*b.n+dz*b.c;
    if(b.log){if(Math.abs(u)>b.a)continue;const t=Math.abs(v)/b.b;if(t<1)y=Math.max(y,b.h*Math.cos(t*Math.PI/2)**2*ss((b.a-Math.abs(u))/.8));}
    else{const r=(u/b.a)**2+(v/b.b)**2;if(r<1)y=Math.max(y,b.h*Math.cos(Math.sqrt(r)*Math.PI/2)**2);}
  }
  return y;
}
export const playgroundHeight=(x,z)=>Math.max(rampHeight(x,z),terrainHeight(x,z),sideTrackHeight(x,z),propHeight(x,z));
const GROUND={Color:'./assets/ambientcg/Ground086/Ground086_1K-JPG_Color.jpg',NormalGL:'./assets/ambientcg/Ground086/Ground086_1K-JPG_NormalGL.jpg',Roughness:'./assets/ambientcg/Ground086/Ground086_1K-JPG_Roughness.jpg'};
const DIRT={Color:'./assets/ambientcg/Ground054/Ground054_1K-JPG_Color.jpg',NormalGL:'./assets/ambientcg/Ground054/Ground054_1K-JPG_NormalGL.jpg',Roughness:'./assets/ambientcg/Ground054/Ground054_1K-JPG_Roughness.jpg'};
// Ramp triangles in world space (top surface + both side walls), shared by the drawn mesh and Jolt.
export function rampTriangles(r){
  const P=rampProfile(r),d=r.dir||1,z0=r.z-r.w/2,z1=r.z+r.w/2,tris=[];
  const add=(...t)=>{for(const q of t)tris.push(d<0?[q[0],q[2],q[1]]:q);}; // mirrored ramps flip winding so normals stay outward
  for(let i=0;i<P.length-1;i++){const [ua,ya]=P[i],[ub,yb]=P[i+1],xa=r.x+ua*d,xb=r.x+ub*d;
    add([[xa,ya,z1],[xb,yb,z1],[xb,yb,z0]],[[xa,ya,z1],[xb,yb,z0],[xa,ya,z0]]);        // top (normal up)
    add([[xa,0,z1],[xb,0,z1],[xb,yb,z1]],[[xa,0,z1],[xb,yb,z1],[xa,ya,z1]]);             // +z wall
    add([[xa,0,z0],[xb,yb,z0],[xb,0,z0]],[[xa,0,z0],[xa,ya,z0],[xb,yb,z0]]);}            // -z wall
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
    const P=rampProfile(r);for(const u of [P[ARC_STEPS][0],P[ARC_STEPS+1][0]]){const e=new T.Mesh(new T.BoxGeometry(.12,.03,r.w),edgeMat);e.position.set(r.x+u*(r.dir||1),r.h+.015,r.z);root.add(e);rampGeos.push(e.geometry);}
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
  // Loop-the-loops: the same path ride-loop.js carries the bike along, plus two support legs.
  const loopMeshes=[];
  for(const L of PLAYGROUND_LOOPS){const m=makeLoopMesh(T,L);m.name='environment:loop:'+L.id;m.castShadow=!lowDetail;root.add(m);loopMeshes.push(m);
    for(const sz of [-1,1]){const leg=new T.Mesh(new T.CylinderGeometry(.08,.1,L.radius*2,8),rampMat);leg.position.set(L.x+L.exitOffset/2,L.radius,L.z+sz*(L.zShift/2+1.6));root.add(leg);rampGeos.push(leg.geometry);}}
  // Props (Poly Haven CC0 glTF): loaded in the background, one shared copy of each model.
  const propRoot=new T.Group();propRoot.name='environment:props';root.add(propRoot);let disposed=false;const propRes=[];
  const loader=new GLTFLoader();
  for(const [key,def] of Object.entries(PROP_MODELS)){
    const list=PLAYGROUND_PROPS.filter(p=>p.m===key);if(!list.length)continue;
    loader.loadAsync('./assets/polyhaven/'+def.file).then(g=>{
      if(disposed)return;
      g.scene.traverse(o=>{if(o.isMesh){o.castShadow=!lowDetail||key==='tree';o.receiveShadow=true;propRes.push(o.geometry);[].concat(o.material).forEach(m=>{propRes.push(m);for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(m[k])propRes.push(m[k]);});}});
      for(const p of list){const o=g.scene.clone(true);o.position.set(p.x,0,p.z);o.rotation.y=p.rot;o.scale.set(p.s,p.s*(p.sy||1),p.s);
        // sit bumps on their own hump and everything on the ground under it
        o.position.y=Math.max(0,Math.max(rampHeight(p.x,p.z),terrainHeight(p.x,p.z),sideTrackHeight(p.x,p.z)))-(p.m==='rock7'||p.m==='rock9'?.04*p.s:0);
        o.name='environment:prop:'+key;propRoot.add(o);}
    }).catch(e=>console.warn('[wk] prop model failed',def.file,e));
  }
  return {
    roadMap:mat.map,colliders:[],isDirt:()=>true,surfaceAt:()=>'dirt',
    update(){},view(){},
    state:()=>({playground:true,arena:true,size:SIZE,ground:'Ground086',terrainGround:'Ground054',tile:TILE,uvWorld:true,props:PLAYGROUND_PROPS.length,propsLoaded:propRoot.children.length,posts:PLAYGROUND_POSTS.length,loops:PLAYGROUND_LOOPS.map(l=>l.id),ramps:PLAYGROUND_RAMPS.length,colliders:PLAYGROUND_RAMPS.length+1,terrain:{...TERRAIN,shape:'HeightFieldShape'},bounds:terrain.bounds}),
    dispose(){disposed=true;propRes.forEach(r=>r.dispose?.());loopMeshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});texs.forEach(t=>t.dispose());mat.dispose();geo.dispose();rampGeos.forEach(g=>g.dispose());rampMat.dispose();edgeMat.dispose();tg.dispose();sg.dispose();tmat.dispose();root.removeFromParent();}
  };
}
