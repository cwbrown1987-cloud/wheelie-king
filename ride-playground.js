// PLAYGROUND: one big flat ground plane for movement testing. Single tiling
// ambientCG Ground086 texture, world-locked UVs. The HDRI sky and sun live in ride.js.
const SIZE=2000,TILE=6;
// Three table-top jumps (kicker, flat deck, landing), off to the side of the spawn line (z = 14 m) and
// running along +X. Our own procedural geometry (no third-party asset). Jolt gets the same shape as a
// static convex hull (ride-jolt.js), so what you see is what you hit.
export const PLAYGROUND_RAMPS=[
  {id:'small',x:30,z:14,h:0.5,up:2.6,top:2.0,down:4.0,w:3.0},
  {id:'medium',x:58,z:14,h:0.85,up:3.4,top:3.0,down:5.5,w:3.2},
  {id:'large',x:92,z:14,h:1.25,up:4.6,top:4.0,down:7.5,w:3.6},
];
export function rampProfile(r){return [[0,0],[r.up,r.h],[r.up+r.top,r.h],[r.up+r.top+r.down,0]];}
export function rampHeight(x,z){
  let y=0;for(const r of PLAYGROUND_RAMPS){if(Math.abs(z-r.z)>r.w/2)continue;const u=x-r.x,P=rampProfile(r);
    if(u<=0||u>=P[3][0])continue;for(let i=0;i<3;i++)if(u<=P[i+1][0]){const t=(u-P[i][0])/(P[i+1][0]-P[i][0]);y=Math.max(y,P[i][1]+(P[i+1][1]-P[i][1])*t);break;}}
  return y;
}
const GROUND={Color:'./assets/ambientcg/Ground086/Ground086_1K-JPG_Color.jpg',NormalGL:'./assets/ambientcg/Ground086/Ground086_1K-JPG_NormalGL.jpg',Roughness:'./assets/ambientcg/Ground086/Ground086_1K-JPG_Roughness.jpg'};
export function makePlaygroundWorld(T,scene,terrain,{lowDetail=false}={}){
  const root=new T.Group();root.name='wk:environment';root.userData.playground=true;scene.add(root);
  const texs=[];
  const load=(kind,srgb=false)=>{
    const t=new T.TextureLoader().load(GROUND[kind]);
    if(srgb)t.colorSpace=T.SRGBColorSpace;
    t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(SIZE/TILE,SIZE/TILE);t.anisotropy=8;texs.push(t);return t;
  };
  const mat=new T.MeshStandardMaterial({map:load('Color',true),normalMap:lowDetail?null:load('NormalGL'),roughnessMap:load('Roughness'),roughness:1,metalness:0});
  const geo=new T.PlaneGeometry(SIZE,SIZE);
  const floor=new T.Mesh(geo,mat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.name='environment:playground-floor';root.add(floor);
  const rampMat=new T.MeshStandardMaterial({color:0x9a958d,roughness:.85,metalness:0}),edgeMat=new T.MeshStandardMaterial({color:0xf2b233,roughness:.6});
  const rampGeos=[];
  for(const r of PLAYGROUND_RAMPS){
    const sh=new T.Shape(rampProfile(r).map(([u,y])=>new T.Vector2(u,y)));
    const g=new T.ExtrudeGeometry(sh,{depth:r.w,bevelEnabled:false});g.translate(0,0,-r.w/2);rampGeos.push(g);
    const m=new T.Mesh(g,rampMat);m.position.set(r.x,0,r.z);m.castShadow=m.receiveShadow=true;m.name='environment:ramp:'+r.id;root.add(m);
    // yellow lip stripes at the kicker top and the landing start so the edges read on a phone
    for(const u of [r.up,r.up+r.top]){const e=new T.Mesh(new T.BoxGeometry(.12,.03,r.w),edgeMat);e.position.set(r.x+u,r.h+.015,r.z);root.add(e);rampGeos.push(e.geometry);}
  }
  return {
    roadMap:mat.map,colliders:[],isDirt:()=>true,surfaceAt:()=>'dirt',
    update(){},view(){},
    state:()=>({playground:true,arena:true,size:SIZE,ground:'Ground086',tile:TILE,uvWorld:true,props:0,ramps:PLAYGROUND_RAMPS.length,colliders:PLAYGROUND_RAMPS.length,bounds:terrain.bounds}),
    dispose(){texs.forEach(t=>t.dispose());mat.dispose();geo.dispose();rampGeos.forEach(g=>g.dispose());rampMat.dispose();edgeMat.dispose();root.removeFromParent();}
  };
}
