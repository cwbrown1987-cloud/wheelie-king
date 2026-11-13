// PLAYGROUND: one big flat ground plane for movement testing. Single tiling
// ambientCG Ground086 texture, world-locked UVs. The HDRI sky and sun live in ride.js.
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {makeLoopMesh} from './ride-loop.js';
import {makeSplatMaterial,fillSplat} from './ride-ground.js';
import {GOAL_POSTS} from './ride-soccer.js';
import {TOWN,townHeight,townArrival,loadTown,makeTownVisuals} from './ride-town.js';
import {PARK,parkHeight,PARK_ENTRY,loadPark,makeSkateParkVisuals} from './ride-skatepark.js';
import {buildFoliage,makeFoliageVisuals} from './ride-foliage.js';
import {makeGrassField} from './ride-grass.js';
import {inBowl,bowlHeight,BOWL,BOWL_ENTRY,makeBowlVisuals} from './ride-bowl.js';
import {CANYON,canyonPathZ,inCanyon,canyonHeight,CANYON_START,CANYON_FINISH_RING,CANYON_POSTS,makeCanyonVisuals} from './ride-canyon.js';
const SIZE=5000,TILE=6;
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
  let y=0;PLAYGROUND_RAMPS.forEach((r,k)=>{const dz=Math.abs(z-r.z)-r.w/2;if(dz>bankWidth(r.h))return;let u=x-r.x;const P=PROFILES[k];
    u*=r.dir||1;if(u<=0||u>=P[P.length-1][0])return;for(let i=0;i<P.length-1;i++)if(u<=P[i+1][0]){const t=(u-P[i][0])/(P[i+1][0]-P[i][0]),h=P[i][1]+(P[i+1][1]-P[i][1])*t;y=Math.max(y,dz<=0?h:h*Math.max(0,1-dz/bankWidth(h)));break;}});
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
  if(u<81.5)return 0;                                                  // gap
  if(u<85)return 1.2*ss((u-81.5)/3.5);                                 // landing ramp back face: steep, but you roll up it if you case the gap
  if(u<93)return 1.2*(1-ss((u-85)/8));                                 // landing ramp
  return 0;
}
// v2.1-20: the track's features have sloped dirt sides (no vertical edges), so you can ride on and off them
// sideways in 3D instead of hitting a wall. Bank width grows with the feature height.
export const bankWidth=h=>1.5+h*2.5;
export function sideTrackHeight(x,z){const T=SIDE_TRACK,dz=Math.abs(z-T.z)-T.w/2;if(dz>5)return 0;const h=sideTrackProfile(x-T.x0);if(dz<=0)return h;return h*Math.max(0,1-dz/bankWidth(h));}
// DOWNHILL (v2.1-10): a 400 m mountain west of spawn, Descenders style. A winding dirt road runs from the
// top (60 m up, x = -480) down to the bottom (x = -80), with rollers and washboard on it; off the road the
// ground is rough, lumpy and rolling (gullies and ridges), so you can feel the bike over real bumps.
// Ride through the blue ring at the bottom to be put at the top facing down the road.
export const DESCENT={x0:-80,len:400,top:80,half:110,fall:150,road:7};
const hash=(i,j)=>{let h=(i*374761393+j*668265263)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295;};
function vnoise(x,z){const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  const a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
export const descentRoadZ=u=>34*Math.sin(u/46)+14*Math.sin(u/17+1)+6*Math.sin(u/7.3+2)*ss(u/40);
const descentBase=u=>DESCENT.top*ss(u/DESCENT.len);
// road features at distance u from the bottom: rollers and a couple of small drops/kickers
function roadFeatures(u){
  let y=0;
  for(const c of [40,44,48,150,154,158,262,266,270])if(Math.abs(u-c)<2)y+=.35*(.5+.5*Math.cos(Math.PI*(u-c)/2)); // roller sets
  for(const c of [110,215,330]){const t=c-u;if(t>0&&t<4)y+=.5*(t/4)**2;}                                       // drop kickers
  // tabletops (kicker, 6 m flat table, landing): clear the table to land on the down-slope, Descenders style; you ride them heading downhill (u falling)
  for(const c of [370,290,190,80]){const t=c-u;if(t>0&&t<4)y+=1.1*(t/4)**2;else if(t>=4&&t<10.6)y+=1.1;else if(t>=10.6&&t<18)y+=1.1*(1-ss((t-10.6)/7.4));}
  return y+.05*Math.sin(u*2.4)*Math.sin(u*.37);                                                                  // washboard
}
export function descentInfo(x,z){
  const D=DESCENT,u=D.x0-x;if(u<-20||u>D.len+20)return null;
  const az=Math.abs(z),edge=az<D.half?1:1-ss((az-D.half)/D.fall);if(edge<=0)return null;
  const uc=Math.max(0,Math.min(D.len,u)),dzr=z-descentRoadZ(uc),roadW=D.road/2;
  const off=ss((Math.abs(dzr)-roadW)/9);                               // 0 on the road, 1 well off it
  // the road runs down a valley: hills rise either side the further you get from it
  const far=Math.max(0,Math.abs(dzr)-roadW),valley=Math.min(18,far*far/140)*ss(uc/40);
  const roll=2.2*Math.sin(z/23+u/31)*Math.sin(u/19+.5)+1.0*Math.sin(z/11-u/13)+valley;
  const rough=.35*(vnoise(x/7,z/7)-.5)*2+.15*(vnoise(x/2.5+40,z/2.5)-.5)*2;
  const top=u>D.len?1:0;
  const h=(descentBase(uc)+(1-off)*roadFeatures(uc)*(1-top)+off*(roll+rough)*ss(uc/25))*edge;
  return {h:Math.max(0,h),road:(1-off)*(u>=0&&u<=D.len?1:0),u,off,dzr:Math.abs(dzr)};
}
export function descentHeight(x,z){const d=descentInfo(x,z);return d?d.h:0;}
// Teleport rings: ride through one and you are placed at `to`. v2.1-28: all the start rings stand in one row
// beside the side track, each with its name above it.
export const PLAYGROUND_PADS=[{id:'descent-start',label:'DOWNHILL',x:-58,z:50,r:1.8,to:{x:DESCENT.x0-DESCENT.len+6,z:descentRoadZ(DESCENT.len-6),yaw:0,vx:2}},
  // Korumburra: a ring by the start of the side track takes you to the main street; one there brings you back
  {id:'town',label:'KORUMBURRA',x:-58,z:56,r:1.8,get to(){const a=townArrival();return {x:a.x,z:a.z,yaw:a.yaw,vx:2};}},
  // skate park (Kenney Mini Skate): a ring next to the town ring takes you to its open side
  {id:'skatepark',label:'SKATE PARK',x:-58,z:62,r:1.8,to:PARK_ENTRY},
  // desert canyon bike track (Quaternius Stylized Nature MegaKit): start ring here, finish ring brings you back
  {id:'canyon',label:'CANYON',x:-58,z:68,r:1.8,to:CANYON_START},
  {id:'bowl',label:'BOWL',x:-58,z:74,r:1.8,to:BOWL_ENTRY},
  // v2.1-35: the Neon Canal level (a locked race track); the ring switches level
  {id:'neon',label:'NEON CANAL',x:-58,z:80,r:1.8,level:'neon',to:{x:-52,z:46,yaw:0,vx:0}},
  {id:'canyon-back',label:'BACK TO PLAYGROUND',x:CANYON_FINISH_RING.x,z:CANYON_FINISH_RING.z,r:1.8,to:{x:-52,z:46,yaw:0,vx:0}},
  {id:'town-back',label:'BACK TO PLAYGROUND',get x(){const a=townArrival();return a.x-Math.cos(a.yaw)*12;},get z(){const a=townArrival();return a.z-Math.sin(a.yaw)*12;},r:1.8,town:true,to:{x:-52,z:46,yaw:0,vx:0}}];
const baseHeight=(x,z)=>x>TOWN.x-TOWN.halfX-TOWN.skirt?townHeight(x,z):Math.abs(x-PARK.x)<PARK.hx&&Math.abs(z-PARK.z)<PARK.hz?parkHeight(x,z):inBowl(x,z)?bowlHeight(x,z):inCanyon(x,z)?canyonHeight(x,z):Math.max(rampHeight(x,z),terrainHeight(x,z),sideTrackHeight(x,z),descentHeight(x,z));
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
    out.push({m,x,z,s:k,rot,sy,bump:{a:hx*.95,b:hz*.95,h:h0*sy}});}; // v2.1-24: the rock's own footprint (was padded 35 cm)
  const log=(x,z,rot,s=1.2)=>out.push({m:'log',x,z,s,rot,bump:{a:1.5*s,b:.13*s,h:.26*s}}); // v2.1-24: the trunk's real round section (was a 1.5 m wide hump)
  // tree lines either side of the side-view track (clear of its 5 m width and the circuit ramps)
  for(let x=-48;x<=78;x+=9){tree(x+rnd()*3,31.5-rnd()*1.2);tree(x+4+rnd()*3,48.5+rnd()*1.2);}
  // slalom near spawn: trees to weave through (and test glancing hits)
  for(let i=0;i<8;i++)tree(14+i*8,-6+(i%2?2.2:-2.2),1.5);
  // rock garden: rideable rocks and logs, with boulders and stumps to dodge
  for(let i=0;i<26;i++)rock(86+rnd()*36,62+rnd()*20,2.5+rnd()*1.5);
  for(let i=0;i<5;i++)log(90+rnd()*30,64+rnd()*16,rnd()*3.14);
  for(let i=0;i<6;i++)boulder(88+rnd()*34,62+rnd()*20);
  for(let i=0;i<5;i++)stump(88+rnd()*34,62+rnd()*20);
  // downhill: trees and boulders scattered off the road, rocks and logs near it to pick lines through
  for(let i=0;i<170;i++){const u=10+rnd()*385,side=rnd()<.5?-1:1,dz=side*(DESCENT.road/2+5+rnd()**1.6*70),z=descentRoadZ(u)+dz;if(Math.abs(z)>DESCENT.half)continue;
    const x=DESCENT.x0-u;rnd()<.75?tree(x,z):boulder(x,z);}
  for(let i=0;i<40;i++){const u=10+rnd()*385,side=rnd()<.5?-1:1,z=descentRoadZ(u)+side*(DESCENT.road/2+1+rnd()*10);rnd()<.8?rock(DESCENT.x0-u,z,2.5+rnd()*1.5):log(DESCENT.x0-u,z,rnd()*3.14);}
  // a few logs to hop across the open ground near spawn
  log(-12,6,Math.PI/2);log(-20,6,Math.PI/2+.3);log(-28,6,Math.PI/2-.2);
  // keep posts off the circuit lines and loop run-ins, and at least 6 m from the downhill road's centre line
  const roadDist=(x,z)=>{const u0=DESCENT.x0-x;if(u0<-15||u0>DESCENT.len+15)return 1e9;let m=1e9;for(let du=-15;du<=15;du+=.5){const u=Math.max(0,Math.min(DESCENT.len,u0+du));m=Math.min(m,Math.hypot(du,z-descentRoadZ(u)));}return m;};
  return out.filter(p=>!(p.post&&(Math.abs(p.z-54)<3||Math.abs(p.z-26)<3)&&p.x<85)&&!(p.post&&roadDist(p.x,p.z)<6)&&!(p.bump&&roadDist(p.x,p.z)<DESCENT.road/2+.5));
}
export const PLAYGROUND_PROPS=buildProps();
// v2.1-34 foliage: where things may grow. 'grass' only stays off hard/ridden surfaces; 'solid' (trees, bushes)
// also stays clear of every track, ramp line, loop, ring row, the slalom, roads and built areas.
function foliageKeep(x,z,kind){
  if(inCanyon(x,z)||inBowl(x,z)||(Math.abs(x-PARK.x)<PARK.hx+3&&Math.abs(z-PARK.z)<PARK.hz+3)||x>TOWN.x-TOWN.halfX-TOWN.skirt-10)return false;
  if(Math.abs(x-62)<58&&Math.abs(z+75)<40)return false;                                  // soccer pitch + nets
  const d=descentInfo(x,z);if(d&&d.u>-4&&d.u<DESCENT.len+4&&d.dzr<(kind==='grass'?4.5:8))return false; // downhill road
  if(x>-56&&x<106&&Math.abs(z-SIDE_TRACK.z)<(kind==='grass'?4.5:20))return false;          // side track (+ circuit, loops)
  if(x>14&&x<176&&Math.abs(z-TERRAIN.z)<(kind==='grass'?10:22))return false;               // terrain lane
  for(const r of PLAYGROUND_RAMPS){const dir=r.dir||1,a=Math.min(r.x-8*dir,r.x+(r.top+r.down+4)*dir),b=Math.max(r.x-8*dir,r.x+(r.top+r.down+4)*dir);if(x>a-2&&x<b+2&&Math.abs(z-r.z)<r.w/2+(kind==='grass'?1:5))return false;}
  if(kind!=='grass'){if(x>-72&&x<-40&&z>38&&z<82)return false;                               // ring row
    if(x>4&&x<90&&z>-14&&z<10)return false;                                                 // slalom + spawn logs
    if(Math.hypot(x,z)<12)return false;}
  return Math.abs(x)<2400&&Math.abs(z)<2400;
}
// v2.1-37 coins: trails along the side track, the downhill road, the canyon track and round the bowl (respawn later)
export function playgroundCoins(){
  const out=[],add=(x,z,up=1)=>out.push({x,z,y:baseHeight(x,z)+up});
  for(let u=6;u<SIDE_TRACK.len-4;u+=4)add(SIDE_TRACK.x0+u,SIDE_TRACK.z,1.1);
  for(let u=12;u<DESCENT.len-10;u+=6)add(DESCENT.x0-u,descentRoadZ(u),1);
  for(let u=8;u<CANYON.len-6;u+=5)add(CANYON.x0+u,canyonPathZ(u),1);
  for(let a=0;a<Math.PI*2;a+=Math.PI/10)add(BOWL.x+Math.cos(a)*(BOWL.ax+.5),BOWL.z+Math.sin(a)*(BOWL.az+.5),1);
  return out;
}
const FOLIAGE=buildFoliage({keep:foliageKeep,area:{x0:-520,x1:700,z0:-280,z1:280},height:(x,z)=>baseHeight(x,z)});
export const PLAYGROUND_POSTS=GOAL_POSTS.concat(CANYON_POSTS,FOLIAGE.posts,PLAYGROUND_PROPS.filter(p=>p.post).map(p=>({x:p.x,z:p.z,r:p.post,kind:p.m,h:baseHeight(p.x,p.z)+(p.m==='tree'?2.7:p.m==='stump'?.55:1.8)*p.s})));
const BUMPS=PLAYGROUND_PROPS.filter(p=>p.bump).map(p=>({x:p.x,z:p.z,c:Math.cos(p.rot),n:Math.sin(p.rot),...p.bump,log:p.m==='log'}));
export function propHeight(x,z){
  let y=0;for(const b of BUMPS){const dx=x-b.x,dz=z-b.z;const R=Math.max(b.a,b.b)+.1;if(Math.abs(dx)>R||Math.abs(dz)>R)continue;
    // model space: +X along the prop (three.js rotation.y=rot maps local x to (cos, -sin) in x,z)
    const u=dx*b.c-dz*b.n,v=dx*b.n+dz*b.c;
    // round log lying on the ground: a circle of radius b with its top at h (the tyre itself rolls over the curve)
    if(b.log){if(Math.abs(u)>b.a)continue;const t=Math.abs(v)/b.b;if(t<1)y=Math.max(y,(b.h-b.b+b.b*Math.sqrt(1-t*t))*ss((b.a-Math.abs(u))/.3));}
    // rock: a dome over its own footprint
    else{const r=(u/b.a)**2+(v/b.b)**2;if(r<1)y=Math.max(y,b.h*Math.sqrt(1-r));}
  }
  return y;
}
export const playgroundHeight=(x,z)=>baseHeight(x,z)+propHeight(x,z);
// v2.1-29: skate park transitions are ridden as curves (the steep top of a quarter pipe isn't a wall)
export const playgroundTransition=(x,z)=>(Math.abs(x-PARK.x)<PARK.hx&&Math.abs(z-PARK.z)<PARK.hz)||inBowl(x,z);
const DIRT={Color:'./assets/ambientcg/Ground054/Ground054_1K-JPG_Color.jpg',NormalGL:'./assets/ambientcg/Ground054/Ground054_1K-JPG_NormalGL.jpg',Roughness:'./assets/ambientcg/Ground054/Ground054_1K-JPG_Roughness.jpg'};
// Ramp triangles in world space (top surface + both side walls), shared by the drawn mesh and Jolt.
export function rampTriangles(r){
  const P=rampProfile(r),d=r.dir||1,z0=r.z-r.w/2,z1=r.z+r.w/2,tris=[];
  const add=(...t)=>{for(const q of t)tris.push(d<0?[q[0],q[2],q[1]]:q);}; // mirrored ramps flip winding so normals stay outward
  for(let i=0;i<P.length-1;i++){const [ua,ya]=P[i],[ub,yb]=P[i+1],xa=r.x+ua*d,xb=r.x+ub*d;
    add([[xa,ya,z1],[xb,yb,z1],[xb,yb,z0]],[[xa,ya,z1],[xb,yb,z0],[xa,ya,z0]]);        // top (normal up)
    const ba=bankWidth(ya),bb=bankWidth(yb);                                              // sloped flanks (rideable sides)
    add([[xa,0,z1+ba],[xb,0,z1+bb],[xb,yb,z1]],[[xa,0,z1+ba],[xb,yb,z1],[xa,ya,z1]]);     // +z flank
    add([[xa,0,z0-ba],[xb,yb,z0],[xb,0,z0-bb]],[[xa,0,z0-ba],[xa,ya,z0],[xb,yb,z0]]);}    // -z flank
  return tris;
}
export function makePlaygroundWorld(T,scene,terrain,{lowDetail=false,quality=lowDetail?'low':'high'}={}){
  const root=new T.Group();root.name='wk:environment';root.userData.playground=true;scene.add(root);
  const texs=[];
  const load=(set,kind,srgb=false,rep=SIZE/TILE)=>{
    const t=new T.TextureLoader().load(set[kind]);
    if(srgb)t.colorSpace=T.SRGBColorSpace;
    t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rep,rep);t.anisotropy=8;texs.push(t);return t;
  };
  // v2.1-10: the floor is grass with worn dirt patches (ambientCG splat material, see ride-ground.js).
  const splat=makeSplatMaterial(T,{lowDetail}),mat=splat.material;
  const geo=fillSplat(T,new T.PlaneGeometry(SIZE,SIZE),[.88,.08,0,.02]);
  const floor=new T.Mesh(geo,mat);floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;floor.name='environment:playground-floor';root.add(floor);
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
  const ST=SIDE_TRACK,SC=0.25,sx0=ST.x0-1,sx1=ST.x0+ST.len+1,sz0=ST.z-ST.w/2-5,sz1=ST.z+ST.w/2+5;
  const snx=Math.round((sx1-sx0)/SC),snz=Math.round((sz1-sz0)/SC),sp=[],su=[],si=[],sc=[];
  for(let j=0;j<=snz;j++)for(let i=0;i<=snx;i++){const x=sx0+i*SC,z=sz0+j*SC,h=sideTrackHeight(x,z);sp.push(x,h,z);su.push(x/4,-z/4);const c=Math.abs(z-ST.z)>ST.w/2?.75:1;sc.push(c,c,c);}
  for(let j=0;j<snz;j++)for(let i=0;i<snx;i++){const a=j*(snx+1)+i,b=a+1,c=a+snx+1,d=c+1;si.push(a,c,b,b,c,d);}
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sp,3));sg.setAttribute('uv',new T.Float32BufferAttribute(su,2));sg.setAttribute('color',new T.Float32BufferAttribute(sc,3));sg.setIndex(si);sg.computeVertexNormals();
  const smesh=new T.Mesh(sg,tmat);smesh.receiveShadow=true;smesh.castShadow=!lowDetail;smesh.name='environment:side-track';root.add(smesh);
  for(const u of [2,ST.len-2]){const e=new T.Mesh(new T.BoxGeometry(.3,.03,ST.w),edgeMat);e.position.set(ST.x0+u,.02,ST.z);root.add(e);rampGeos.push(e.geometry);}
  // Downhill mountain: a fine ribbon along the dirt road (exact bumps where you ride) over a coarser
  // grid for the whole hill. Splat: road dirt, gravel shoulders, grass, rock on steep ground, mud in dips.
  const DS=DESCENT,descGeos=[];
  const paint=(x,z,h,arr)=>{const d=descentInfo(x,z);const e=.6,gx=descentHeight(x+e,z)-descentHeight(x-e,z),gz=descentHeight(x,z+e)-descentHeight(x,z-e),sl=Math.hypot(gx,gz)/(2*e);
    const inside=d&&d.u>=0&&d.u<=DS.len,road=inside?1-ss((d.dzr-DS.road/2+.6)/1.4):0,shoulder=inside?(1-road)*(1-ss((d.dzr-DS.road/2-1.2)/1.6)):0;let rock=ss((sl-.62)/.3)*(1-road)*(.6+.8*vnoise(x/9,z/9)),mud=0;rock=Math.min(1,rock);
    if(d&&d.off>.5){const dip=vnoise(x/11+90,z/11)-.5;mud=ss((-dip-.18)/.12)*(1-rock);}
    const grass=Math.max(0,1-road-shoulder-rock-mud);arr.push(grass,road,rock,mud);};
  const grid=(nx,nz,at,sink)=>{const pos=[],spl=[],idx=[];
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const [x,z]=at(i,j);let h=descentHeight(x,z);if(sink)h-=sink(x,z);pos.push(x,h,z);paint(x,z,h,spl);}
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;idx.push(a,c,b,b,c,d);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('splat',new T.Float32BufferAttribute(spl,4));g.setIndex(idx);g.computeVertexNormals();descGeos.push(g);return g;};
  {const C=lowDetail?3:2,xa=DS.x0-DS.len-20,xb=DS.x0+20,za=-(DS.half+DS.fall),zb=DS.half+DS.fall,nx=Math.round((xb-xa)/C),nz=Math.round((zb-za)/C);
   // sink the coarse hill under the road ribbon so the detailed ribbon always shows
   const g=grid(nx,nz,(i,j)=>[xa+i*C,za+j*C],(x,z)=>{const u=DS.x0-x;if(u<-2||u>DS.len+2)return 0;const dz=Math.abs(z-descentRoadZ(Math.max(0,Math.min(DS.len,u))));return dz<22?.35:dz<24?.35*(24-dz)/2:0;});
   const m=new T.Mesh(g,mat);m.receiveShadow=true;m.name='environment:descent-hill';root.add(m);}
  {const du=lowDetail?1:.6,dz=lowDetail?1:.6,W=24,nu=Math.round(DS.len/du),nw=Math.round(2*W/dz);
   const g=grid(nu,nw,(i,j)=>{const u=DS.len-i*du;return [DS.x0-u,descentRoadZ(u)-W+j*dz];});
   const m=new T.Mesh(g,mat);m.receiveShadow=true;m.name='environment:descent-road';root.add(m);}
  // Teleport rings
  const labelRes=[];
  const ringMat=new T.MeshStandardMaterial({color:0x3fb8ff,emissive:0x1a6cff,emissiveIntensity:1.6,roughness:.4});
  for(const pd of PLAYGROUND_PADS){const ring=new T.Mesh(new T.TorusGeometry(pd.r+.3,.12,10,40),ringMat);ring.rotation.y=Math.PI/2;ring.name='environment:pad:'+pd.id;root.add(ring);rampGeos.push(ring.geometry);
    const base=new T.Mesh(new T.CylinderGeometry(pd.r,pd.r,.04,32),ringMat);root.add(base);rampGeos.push(base.geometry);
    let place=()=>{ring.position.set(pd.x,baseHeight(pd.x,pd.z)+pd.r+.3,pd.z);base.position.set(pd.x,baseHeight(pd.x,pd.z)+.02,pd.z);};place();
    if(pd.label){const cv=document.createElement('canvas');cv.width=512;cv.height=128;const g=cv.getContext('2d');g.fillStyle='rgba(8,20,40,.78)';g.beginPath();g.roundRect?g.roundRect(8,14,496,100,50):g.rect(8,14,496,100);g.fill();g.lineWidth=6;g.strokeStyle='#3fb8ff';g.stroke();
      g.font='900 '+(pd.label.length>12?44:62)+'px system-ui,Segoe UI,Arial,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffffff';g.fillText(pd.label,256,66);
      const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=4;const sm=new T.SpriteMaterial({map:tx,transparent:true,fog:false});const sp=new T.Sprite(sm);sp.scale.set(5.6,1.4,1);sp.name='environment:pad-label:'+pd.id;root.add(sp);labelRes.push(tx,sm);
      const old=place;place=()=>{old();sp.position.set(pd.x,baseHeight(pd.x,pd.z)+2*pd.r+1.3,pd.z);};place();}
    if(pd.town)loadTown().then(()=>place()).catch(()=>{});}
  // the real town (Korumburra), east of the playground
  const town=makeTownVisuals(T,root,mat,{lowDetail});
  const park=makeSkateParkVisuals(T,root,GLTFLoader,{lowDetail});
  const canyon=makeCanyonVisuals(T,root,GLTFLoader,{lowDetail});
  const bowl=makeBowlVisuals(T,root,{lowDetail});
  const treeItems=PLAYGROUND_PROPS.filter(p=>p.m==='tree').map((p,i)=>({m:['oak3','pine1','oak5','pine5'][i%4],x:p.x,z:p.z,s:p.s*.55,rot:p.rot}));
  const folItems=FOLIAGE.items.filter((p,i)=>!lowDetail||p.m.startsWith('oak')||p.m.startsWith('pine')||i%3===0).concat(treeItems);
  const foliage=makeFoliageVisuals(T,root,GLTFLoader,folItems,baseHeight,{lowDetail});
  // v2.1-49: real grass blades round the rider (GPU field); none on tracks, ramps, roads, the town or worn patches
  const grass=makeGrassField(T,root,{lowDetail,quality,height:baseHeight,mask:(x,z)=>{if(!foliageKeep(x,z,'grass'))return{density:0,dry:0};const m=vnoise(x/38,z/38)*.75+vnoise(x/9+40,z/9)*.25,worn=vnoise(x/14+7,z/14-3);return{density:Math.max(0,Math.min(1,(m-.22)*2.2))*(worn<.3?worn/.3:1),dry:vnoise(x/25-9,z/25+4)*.8};}});
  // Loop-the-loops: the same path ride-loop.js carries the bike along, plus two support legs.
  const loopMeshes=[];
  for(const L of PLAYGROUND_LOOPS){const m=makeLoopMesh(T,L);m.name='environment:loop:'+L.id;m.castShadow=!lowDetail;root.add(m);loopMeshes.push(m);
    for(const sz of [-1,1]){const leg=new T.Mesh(new T.CylinderGeometry(.08,.1,L.radius*2,8),rampMat);leg.position.set(L.x+L.exitOffset/2,L.radius,L.z+sz*(L.zShift/2+1.6));root.add(leg);rampGeos.push(leg.geometry);}}
  // Props (Poly Haven CC0 glTF): loaded in the background, one shared copy of each model.
  const propRoot=new T.Group();propRoot.name='environment:props';root.add(propRoot);let disposed=false;const propRes=[];
  const loader=new GLTFLoader();
  for(const [key,def] of Object.entries(PROP_MODELS)){
    if(key==='tree')continue; // v2.1-34: trees are drawn by the foliage (leafy Quaternius trees)
    const list=PLAYGROUND_PROPS.filter(p=>p.m===key);if(!list.length)continue;
    loader.loadAsync('./assets/polyhaven/'+def.file).then(g=>{
      if(disposed)return;
      g.scene.traverse(o=>{if(o.isMesh){o.castShadow=!lowDetail||key==='tree';o.receiveShadow=true;propRes.push(o.geometry);[].concat(o.material).forEach(m=>{propRes.push(m);for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(m[k])propRes.push(m[k]);});}});
      for(const p of list){const o=g.scene.clone(true);o.position.set(p.x,0,p.z);o.rotation.y=p.rot;o.scale.set(p.s,p.s*(p.sy||1),p.s);
        // sit bumps on their own hump and everything on the ground under it
        o.position.y=baseHeight(p.x,p.z)-(p.m==='rock7'||p.m==='rock9'?.04*p.s:0);
        o.name='environment:prop:'+key;propRoot.add(o);}
    }).catch(e=>console.warn('[wk] prop model failed',def.file,e));
  }
  return {
    roadMap:null,colliders:[],isDirt:()=>true,surfaceAt:()=>'dirt',
    update(x,o){foliage.update?.(o?.s?.x??x,o?.s?.z??0);grass.update(o?.s?.x??x,o?.s?.z??0,o?.s?.y??0,o?.dt||0);},view(){},
    state:()=>({playground:true,arena:true,size:SIZE,ground:'splat:Grass004+Ground054+Rock051+Ground109+Gravel041',descent:{...DESCENT},pads:PLAYGROUND_PADS.map(p=>p.id),terrainGround:'Ground054',tile:TILE,uvWorld:true,props:PLAYGROUND_PROPS.length,propsLoaded:propRoot.children.length,posts:PLAYGROUND_POSTS.length,loops:PLAYGROUND_LOOPS.map(l=>l.id),ramps:PLAYGROUND_RAMPS.length,colliders:PLAYGROUND_RAMPS.length+1,terrain:{...TERRAIN,shape:'HeightFieldShape'},bounds:terrain.bounds}),
    dispose(){disposed=true;propRes.forEach(r=>r.dispose?.());loopMeshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});texs.forEach(t=>t.dispose());town.dispose();park.dispose();canyon.dispose();bowl.dispose();foliage.dispose();labelRes.forEach(r=>r.dispose());splat.dispose();descGeos.forEach(g=>g.dispose());ringMat.dispose();geo.dispose();rampGeos.forEach(g=>g.dispose());rampMat.dispose();edgeMat.dispose();tg.dispose();sg.dispose();tmat.dispose();root.removeFromParent();}
  };
}
