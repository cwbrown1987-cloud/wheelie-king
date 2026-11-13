// V3 continuous procedural free-roam terrain. All visual mesh heights and contact
// queries share the exact same deterministic height function (no render/physics seams).
// Three biomes are geographically connected: alpine-free forest, green valley and red canyons.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const hash=(x,z)=>{let n=Math.imul(x|0,374761393)+Math.imul(z|0,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const noise=(x,z)=>{const ix=Math.floor(x),iz=Math.floor(z),a=smooth(x-ix),b=smooth(z-iz);
  const aa=hash(ix,iz),ab=hash(ix,iz+1),ba=hash(ix+1,iz),bb=hash(ix+1,iz+1);
  return (aa+(ba-aa)*a)*(1-b)+(ab+(bb-ab)*a)*b;};
const fbm=(x,z)=>((noise(x*.009,z*.009)-.5)*2+(noise(x*.027,z*.027)-.5)*.7+(noise(x*.071,z*.071)-.5)*.18);
export const V3_BIOMES=Object.freeze(['forest','valley','desert']);
export const V3_PATH={minX:-1050,maxX:1950,halfWidth:8};
export const v3TrailZ=x=>Math.sin(x*.006)*22+Math.sin(x*.019)*6;
export const v3Biome=x=>x<-320?'forest':x<540?'valley':'desert';
export function v3TerrainHeight(x,z=0){
  const path=v3TrailZ(x),off=Math.abs(z-path),rough=fbm(x,z);
  const fv=1-smooth((x+400)/180),desert=smooth((x-450)/180);
  const rise=1.5+2*Math.sin(x*.0028)+1.4*Math.sin(x*.008);
  const forestH=rise+Math.max(0,off-25)*.022+Math.max(0,rough*20)+rough*4;
  const valleyH=rise*.35+rough*3-1.25*Math.exp(-((z+110)/55)**2)*Math.exp(-((x-150)/180)**2);
  const canyonSides=Math.pow(Math.max(0,off-17)/42,1.35)*9;
  const desertH=rise*.35+rough*3+canyonSides+2*Math.max(0,noise(x*.025,z*.025)-.65);
  const landscape=forestH*fv+valleyH*(1-fv)*(1-desert)+desertH*desert;
  // A continuous graded dirt trail traverses all three biomes. Berms and a few
  // rounded kickers are additive, so the landings follow the same surface.
  const grade=1.1+1.2*Math.sin(x*.003)+.5*Math.sin(x*.014);
  const trailBlend=1-smooth((off-5)/16);
  const jumpWindow=Math.max(0,Math.sin(x*.057))*Math.pow(Math.max(0,Math.sin(x*.011)),12);
  const kicker=.60*jumpWindow*(1-smooth((off-4)/7));
  return landscape*(1-trailBlend)+grade*trailBlend+kicker;
}
export function makeV3Terrain(){
  const height=v3TerrainHeight;
  const slopeAt=(x,z=0,yaw=0)=>{
    const e=.18,c=Math.cos(yaw),s=Math.sin(yaw);
    return Math.atan2(height(x+c*e,z+s*e)-height(x-c*e,z-s*e),2*e);
  };
  return {
    pts:[[-1200,0],[2000,0]],h:x=>height(x,0),height,slopeAt,slope:x=>slopeAt(x,0,0),
    transition:()=>false,freeRoam:true,freeRide:true,playground:true,v3World:true,
    puddles:[],checkpoints:[0],kickers:[],finish:Infinity,
    inPuddle:()=>false,boxes:[],posts:[],loops:[],
    bounds:{xmin:-1100,xmax:2000,zmin:-900,zmax:900},gates:null,
    trailZ:v3TrailZ,biomeAt:v3Biome,surfaceAt:(x,z)=>Math.abs(z-v3TrailZ(x))<10?'dirt':v3Biome(x)==='desert'?'sand':'grass'
  };
}
export function makeV3World(T,scene,terrain,{lowDetail=false}={}){
  const chunkSize=64,steps=lowDetail?12:20,radius=lowDetail?2:3;
  const active=new Map(),mats={
    forest:new T.MeshStandardMaterial({color:'#55774c',roughness:1,flatShading:lowDetail}),
    valley:new T.MeshStandardMaterial({color:'#86a76a',roughness:1,flatShading:lowDetail}),
    desert:new T.MeshStandardMaterial({color:'#b96c45',roughness:1,flatShading:lowDetail}),
    trail:new T.MeshStandardMaterial({color:'#9d8458',roughness:1,flatShading:true}),
    tree:new T.MeshStandardMaterial({color:'#285b38',roughness:1,flatShading:true}),
    trunk:new T.MeshStandardMaterial({color:'#6c4a34',roughness:1,flatShading:true}),
    sandstone:new T.MeshStandardMaterial({color:'#a95439',roughness:1,flatShading:true})
  };
  const treeGeo=new T.ConeGeometry(1,4.2,5),trunkGeo=new T.CylinderGeometry(.19,.28,1,5),rockGeo=new T.DodecahedronGeometry(1,0);
  const work=new T.Object3D();
  const group=new T.Group();group.name='wk:v3-procedural-world';scene.add(group);
  // A shallow reflective lake occupies a valley depression off the main trail.
  const water=new T.Mesh(new T.CircleGeometry(55,48),new T.MeshStandardMaterial({color:'#428f9b',roughness:.18,metalness:.18,transparent:true,opacity:.86,depthWrite:false}));
  water.rotation.x=-Math.PI/2;water.position.set(160,-1.15,-110);group.add(water);
  const chunkKey=(cx,cz)=>cx+':'+cz;
  const build=(cx,cz)=>{
    const g=new T.Group(),originX=cx*chunkSize,originZ=cz*chunkSize,vertices=[],colors=[],indices=[];
    const c=new T.Color();
    for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){
      const x=originX+i*chunkSize/steps,z=originZ+j*chunkSize/steps,y=terrain.height(x,z);
      vertices.push(x-originX,y,z-originZ);
      const b=terrain.biomeAt(x),near=Math.abs(z-v3TrailZ(x)),color=near<6?'#9b8359':b==='forest'?'#638358':b==='valley'?'#89a36c':'#bd704d';
      c.set(color);const shade=1+Math.min(.13,Math.max(-.12,(y-4)*.009));c.multiplyScalar(shade);
      colors.push(c.r,c.g,c.b);
    }
    for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){
      const k=j*(steps+1)+i;indices.push(k,k+steps+1,k+1,k+1,k+steps+1,k+steps+2);
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    const ground=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));
    ground.receiveShadow=true;g.add(ground);
    const trees=[],rocks=[];
    for(let i=0;i<(lowDetail?9:17);i++){
      const x=originX+hash(cx*73+i,cz*31)*chunkSize,z=originZ+hash(cx*23+i+41,cz*71)*chunkSize;
      if(Math.abs(z-v3TrailZ(x))<13)continue;
      const b=terrain.biomeAt(x);
      if(b==='forest'&&hash(cx*13+i,cz*7)>.2)trees.push([x,terrain.height(x,z),z,.6+hash(cx+i,cz-i)*1.2]);
      else if(b==='desert'&&hash(cx*37+i,cz*11)>.25)rocks.push([x,terrain.height(x,z),z,.8+hash(cx-i,cz+i)*1.8]);
      else if(b==='valley'&&hash(cx*17+i,cz*41)>.68)trees.push([x,terrain.height(x,z),z,.55]);
    }
    const addInstances=(geo,mat,items,offset,scale)=>{
      if(!items.length)return;const mesh=new T.InstancedMesh(geo,mat,items.length);
      items.forEach(([x,y,z,size],idx)=>{work.position.set(x-originX,y+offset*size,z-originZ);work.rotation.set(0,hash(idx+cx,cz)*Math.PI*2,0);
        work.scale.setScalar(size*scale);work.updateMatrix();mesh.setMatrixAt(idx,work.matrix);});
      mesh.instanceMatrix.needsUpdate=true;g.add(mesh);
    };
    addInstances(treeGeo,mats.tree,trees,2.6,1);
    addInstances(trunkGeo,mats.trunk,trees,.5,1);
    addInstances(rockGeo,mats.sandstone,rocks,.2,1);
    g.position.set(originX,0,originZ);group.add(g);
    return g;
  };
  let lastCx=Infinity,lastCz=Infinity;
  function update(x,opts={}){
    const z=opts?.s?.z||0,cx=Math.floor(x/chunkSize),cz=Math.floor(z/chunkSize);
    if(cx===lastCx&&cz===lastCz)return;lastCx=cx;lastCz=cz;
    const wanted=new Set();
    for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
      const px=cx+dx,pz=cz+dz,key=chunkKey(px,pz);wanted.add(key);
      if(!active.has(key))active.set(key,build(px,pz));
    }
    for(const [key,g] of active)if(!wanted.has(key)){
      g.traverse(o=>{if(o.isMesh&&o.geometry!==treeGeo&&o.geometry!==trunkGeo&&o.geometry!==rockGeo)o.geometry.dispose();
        if(o.isMesh&&!o.isInstancedMesh)o.material.dispose();});
      group.remove(g);active.delete(key);
    }
  }
  update(-600,{s:{z:v3TrailZ(-600)}});
  return {
    update,view:()=>{},surfaceAt:terrain.surfaceAt,isDirt:(x,z)=>terrain.surfaceAt(x,z)!=='grass',
    state:()=>({type:'v3-procedural',biomes:V3_BIOMES,chunks:active.size,chunkSize,radius}),
    dispose(){for(const g of active.values()){g.traverse(o=>{if(o.geometry&&o.geometry!==treeGeo&&o.geometry!==trunkGeo&&o.geometry!==rockGeo)o.geometry.dispose();if(o.material&&!o.isInstancedMesh)o.material.dispose();});group.remove(g);}active.clear();
      water.geometry.dispose();water.material.dispose();treeGeo.dispose();trunkGeo.dispose();rockGeo.dispose();
      Object.values(mats).forEach(m=>m.dispose());group.removeFromParent();}
  };
}
