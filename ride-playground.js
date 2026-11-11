// PLAYGROUND: one big flat ground plane for movement testing. Single tiling
// ambientCG Ground086 texture, world-locked UVs. The HDRI sky and sun live in ride.js.
const SIZE=2000,TILE=6;
export function makePlaygroundWorld(T,scene,terrain,{lowDetail=false}={}){
  const root=new T.Group();root.name='wk:environment';root.userData.playground=true;scene.add(root);
  const texs=[];
  const load=(kind,srgb=false)=>{
    const t=new T.TextureLoader().load(`./assets/ambientcg/Ground086/Ground086_1K-JPG_${kind}.jpg`);
    if(srgb)t.colorSpace=T.SRGBColorSpace;
    t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(SIZE/TILE,SIZE/TILE);t.anisotropy=8;texs.push(t);return t;
  };
  const mat=new T.MeshStandardMaterial({map:load('Color',true),normalMap:lowDetail?null:load('NormalGL'),roughnessMap:load('Roughness'),roughness:1,metalness:0});
  const geo=new T.PlaneGeometry(SIZE,SIZE);
  const floor=new T.Mesh(geo,mat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.name='environment:playground-floor';root.add(floor);
  return {
    roadMap:mat.map,colliders:[],isDirt:()=>true,surfaceAt:()=>'dirt',
    update(){},view(){},
    state:()=>({playground:true,arena:true,sample3d:false,size:SIZE,ground:'Ground086',tile:TILE,uvWorld:true,props:0,ramps:0,colliders:0,bounds:terrain.bounds}),
    dispose(){texs.forEach(t=>t.dispose());mat.dispose();geo.dispose();root.removeFromParent();}
  };
}
