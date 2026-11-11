
const GRASS_URL='./assets/polyhaven/grass_medium_01/';
// Light tufts only (skip the 2k–6k-tri clumps). Poly Haven grass_medium_01 1K.
const GRASS_MESHES=[0,3,4,5,11,12,13,14,15,16];
const GRASS_CULL=48;

function accessorArray(gltf,bin,accIndex){
  const acc=gltf.accessors[accIndex],view=gltf.bufferViews[acc.bufferView];
  const off=(view.byteOffset||0)+(acc.byteOffset||0);
  const type=acc.componentType,cnt=acc.count,n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[acc.type]||1;
  if(type===5126)return new Float32Array(bin,off,cnt*n);
  if(type===5123)return new Uint16Array(bin,off,cnt*n);
  if(type===5125)return new Uint32Array(bin,off,cnt*n);
  if(type===5121)return new Uint8Array(bin,off,cnt*n);
  if(type===5122)return new Int16Array(bin,off,cnt*n);
  return null;
}

function grassGeometry(T,gltf,bin,meshIndex){
  const prim=gltf.meshes[meshIndex].primitives[0];
  const g=new T.BufferGeometry();
  const pos=accessorArray(gltf,bin,prim.attributes.POSITION);
  g.setAttribute('position',new T.BufferAttribute(new Float32Array(pos),3));
  if(prim.attributes.NORMAL!=null){
    const n=accessorArray(gltf,bin,prim.attributes.NORMAL);
    g.setAttribute('normal',new T.BufferAttribute(new Float32Array(n),3));
  }else g.computeVertexNormals();
  if(prim.attributes.TEXCOORD_0!=null){
    const uv=accessorArray(gltf,bin,prim.attributes.TEXCOORD_0);
    g.setAttribute('uv',new T.BufferAttribute(new Float32Array(uv),2));
  }
  if(prim.indices!=null){
    const idx=accessorArray(gltf,bin,prim.indices);
    const copy=idx instanceof Uint32Array||(idx.length>65535&&!(idx instanceof Uint16Array))?new Uint32Array(idx):new Uint16Array(idx);
    g.setIndex(new T.BufferAttribute(copy,1));
  }
  g.computeBoundingSphere();
  return g;
}

function hash2(x,z){
  const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);
}

function scatterArenaGrass(T,root,opts){
  const {h,terrain,ramps,lowDetail,sharedMat,sharedGeo,sharedTex,grassFx}=opts;
  const onLine=(x,z)=>{
    if(terrain.track){
      const n=terrain.track.nearest(x,z);
      if(n.dist<(terrain.track.width||6)/2+1.15)return true;
    }
    for(const r of ramps||[]){
      const yaw=r.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
      const dx=x-r.x,dz=z-r.z,lx=dx*c+dz*s,lz=-dx*s+dz*c;
      const len=(r.len||((r.takeoff||0)+(r.back||0)+(r.gap||0)+(r.land||0)));
      if(lx>-0.5&&lx<len+0.5&&Math.abs(lz)<(r.w||6)/2+0.45)return true;
    }
    return false;
  };
  const want=(x,z)=>{
    if(Math.abs(x)>HALF-1.2||Math.abs(z)>HALF-1.2)return false;
    if(onLine(x,z))return false;
    const edge=Math.max(Math.abs(x),Math.abs(z))>HALF-14;
    let shoulder=false,base=false;
    if(terrain.track){
      const n=terrain.track.nearest(x,z);
      const hw=(terrain.track.width||6)/2;
      if(n.dist>hw+1.2&&n.dist<hw+4.2)shoulder=true;
    }
    for(const r of ramps||[]){
      const yaw=r.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
      const dx=x-r.x,dz=z-r.z,lx=dx*c+dz*s,lz=-dx*s+dz*c;
      const hw=(r.w||6)/2;
      if(lx>-3.2&&lx<3.4&&Math.abs(lz)>hw+0.6&&Math.abs(lz)<hw+3.6)base=true;
    }
    return edge||shoulder||base;
  };
  const loader=new T.TextureLoader();
  const loadTex=(file,srgb)=>{
    const tex=loader.load(GRASS_URL+file);
    if(srgb)tex.colorSpace=T.SRGBColorSpace;
    tex.flipY=false;tex.anisotropy=4;sharedTex.push(tex);return tex;
  };
  const mat=new T.MeshStandardMaterial({
    map:loadTex('textures/grass_medium_01_diff_1k.jpg',true),
    normalMap:loadTex('textures/grass_medium_01_nor_gl_1k.jpg',false),
    roughnessMap:loadTex('textures/grass_medium_01_arm_1k.jpg',false),
    metalness:0,roughness:.85,
    alphaMap:loadTex('textures/grass_medium_01_alpha_1k.png',false),
    alphaTest:.38,transparent:false,depthWrite:true,side:T.DoubleSide,
  });
  sharedMat.push(mat);
  grassFx.group=new T.Group();grassFx.group.name='environment:grass-tufts';root.add(grassFx.group);
  fetch(GRASS_URL+'grass_medium_01_1k.gltf').then(r=>r.json()).then(async gltf=>{
    const bin=await (await fetch(GRASS_URL+'grass_medium_01.bin')).arrayBuffer();
    const geos=GRASS_MESHES.map(i=>{const g=grassGeometry(T,gltf,bin,i);sharedGeo.push(g);return g;});
    const slots=lowDetail?180:320;
    const pts=[];
    // Edges, dirt shoulders and ramp bases. Seeded so the patch is stable.
    for(let i=0;i<2200&&pts.length<slots;i++){
      const a=hash2(i,1)*Math.PI*2,rad=hash2(i,2);
      let x,z;
      const kind=hash2(i,3);
      if(kind<.45){
        const r=HALF-2-hash2(i,4)*12;
        x=Math.cos(a)*r;z=Math.sin(a)*r;
      }else if(kind<.8&&terrain.track&&terrain.track.samples){
        const samp=terrain.track.samples;
        const s=samp[(hash2(i,5)*samp.length)|0];
        const hw=(terrain.track.width||6)/2,side=hash2(i,6)<.5?-1:1;
        const out=hw+1.4+hash2(i,7)*2.6;
        x=s.x+s.nx*out*side;z=s.z+s.nz*out*side;
      }else if(ramps&&ramps.length){
        const r=ramps[(hash2(i,8)*ramps.length)|0];
        const yaw=r.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
        const lx=-2.4+hash2(i,9)*5.2,lz=((r.w||6)/2+0.8+hash2(i,10)*2.4)*(hash2(i,11)<.5?-1:1);
        x=r.x+lx*c-lz*s;z=r.z+lx*s+lz*c;
      }else continue;
      if(!want(x,z))continue;
      if(pts.some(p=>Math.hypot(p.x-x,p.z-z)<1.15))continue;
      pts.push({x,z,y:h(x,z),yaw:hash2(i,12)*Math.PI*2,sc:.7+hash2(i,13)*0.7,mesh:(hash2(i,14)*geos.length)|0});
    }
    const dummy=new T.Object3D();
    const byMesh=geos.map(()=>[]);
    for(const p of pts)byMesh[p.mesh].push(p);
    grassFx.entries=[];
    for(let m=0;m<geos.length;m++){
      const list=byMesh[m];if(!list.length)continue;
      const inst=new T.InstancedMesh(geos[m],mat,list.length);
      inst.castShadow=false;inst.receiveShadow=!lowDetail;inst.frustumCulled=true;
      inst.name='environment:grass-tuft-'+m;
      inst.matrixAutoUpdate=false;
      const origins=[];
      for(let i=0;i<list.length;i++){
        const p=list[i];
        dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.sc);
        dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
        origins.push(p);
      }
      inst.instanceMatrix.needsUpdate=true;
      grassFx.group.add(inst);
      grassFx.entries.push({mesh:inst,origins,dummy});
    }
    grassFx.ready=true;
  }).catch(err=>{try{console.warn('arena grass tufts failed',err)}catch{}});
}

import {makeArenaTrack} from './ride-track.js';
import {rampLength,rampLipX} from './ride-physics.js';
// TEST ARENA: a big flat square for free-roam speed, wheelies, burnouts and jumps.
// No checkpoints or finish. A ring of city kit sits outside the walls; a farther
// silhouette ring sits on the HDRI horizon (sky itself is in ride.js).

const HALF=150;

export function makeArenaWorld(T,scene,terrain,{lowDetail=false}={}){
  const root=new T.Group();root.name='wk:environment';root.userData.arena=true;scene.add(root);
  const sharedTex=[],sharedMat=[],sharedGeo=[];
  const mat=(color,more={})=>{const m=new T.MeshStandardMaterial({color,roughness:.88,...more});sharedMat.push(m);return m};
  const canvasTex=(draw,w=512,h=512)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;sharedTex.push(t);return t};
  const loadAcg=(id,kind,srgb=false)=>{
    const tex=new T.TextureLoader().load(`./assets/ambientcg/${id}/${id}_1K-JPG_${kind}.jpg`);
    if(srgb)tex.colorSpace=T.SRGBColorSpace;
    tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=8;sharedTex.push(tex);return tex;
  };
  const roadACol=loadAcg('Road008A','Color',true),roadANor=loadAcg('Road008A','NormalGL'),roadARough=loadAcg('Road008A','Roughness');
  const roadCCol=loadAcg('Road008C','Color',true),roadCNor=loadAcg('Road008C','NormalGL'),roadCRough=loadAcg('Road008C','Roughness');
  const dirtColMap=loadAcg('Ground086','Color',true),dirtNor=loadAcg('Ground086','NormalGL'),dirtRough=loadAcg('Ground086','Roughness');
  const add=(parent,geo,m,x,y,z,sx=1,sy=1,sz=1,rotY=0)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.y=rotY;o.castShadow=o.receiveShadow=!lowDetail;parent.add(o);return o};
  const h=(x,z)=>terrain.height(x,z)||0;
  const colliders=[];

  const grassTex=canvasTex((g,w,h)=>{
    g.fillStyle='#3f7a3a';g.fillRect(0,0,w,h);
    for(let i=0;i<2800;i++){
      const n=Math.abs(Math.sin(i*12.9898)*43758.5453)%1,m=Math.abs(Math.sin(i*78.233)*24634.863)%1,p=Math.abs(Math.sin(i*3.71+n)*91873.4)%1;
      g.fillStyle=p>.7?'#5a9a48':p>.4?'#2f6a32':'#4a8a3e';
      g.globalAlpha=.35+.5*n;g.fillRect((n*w)|0,(m*h)|0,2+(p>.8?3:1),2);
    }
    g.globalAlpha=1;
    for(let i=0;i<90;i++){const n=Math.abs(Math.sin(i*41.2)*23421.2)%1,m=Math.abs(Math.sin(i*9.3)*8123.4)%1;
      g.fillStyle='rgba(90,70,30,.18)';g.fillRect((n*w)|0,(m*h)|0,6,3)}
  },256,256);
  const packedDirt=canvasTex((g,w,h)=>{
    g.fillStyle='#6a5134';g.fillRect(0,0,w,h);
    for(let i=0;i<2200;i++){const n=Math.abs(Math.sin(i*12.9898)*43758.5453)%1,m=Math.abs(Math.sin(i*78.233)*24634.863)%1,p=Math.abs(Math.sin(i*17.1)*5123)%1;
      g.fillStyle=p>.65?'#8a6a42':p>.3?'#4a3824':'#7a5a38';g.globalAlpha=.4+.4*n;g.fillRect((n*w)|0,(m*h)|0,3,2)}
    g.globalAlpha=1;
  },256,256);
  // World-locked UVs: tile in metres, never scroll or follow the bike/camera.
  const TILE=(HALF*2)/22;
  grassTex.repeat.set(1,1);packedDirt.repeat.set(1,1);
  grassTex.offset.set(0,0);packedDirt.offset.set(0,0);
  const floorMat=mat('#5a8a4a',{map:grassTex,roughness:.94,vertexColors:true});
  floorMat.onBeforeCompile=(shader)=>{
    shader.uniforms.dirtMap={value:dirtColMap};
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <map_pars_fragment>','#include <map_pars_fragment>\nuniform sampler2D dirtMap;')
      .replace('#include <map_fragment>',`#ifdef USE_MAP
        vec4 grassC=texture2D(map,vMapUv);
        vec4 dirtC=texture2D(dirtMap,vMapUv);
        diffuseColor*=mix(grassC,dirtC,vColor.r);
      #endif`)
      .replace('#include <color_fragment>','');
  };
  floorMat.customProgramCacheKey=()=> 'wk-grass-dirt-ground086';
  const segs=lowDetail?80:150;
  const grassFx={ready:false,entries:[],group:null,cull:GRASS_CULL};
  const floor=new T.Mesh(new T.PlaneGeometry(HALF*2,HALF*2,segs,segs),floorMat);
  floor.rotation.x=-Math.PI/2;floor.name='environment:arena-floor';floor.receiveShadow=true;
  const pos=floor.geometry.attributes.position;
  const dirtCol=new Float32Array(pos.count*3);
  const floorUv=new Float32Array(pos.count*2);
  const ramps=terrain.ramps||[];
  const smooth=(a,b,x)=>x<=a?1:x>=b?0:1-(x-a)/(b-a);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getY(i),wz=-z;
    pos.setZ(i,terrain.height(x,wz));
    let dirt=0;
    if(terrain.track){
      const n=terrain.track.nearest(x,wz);
      dirt=Math.max(dirt,smooth((terrain.track.width||6)/2+.5,(terrain.track.width||6)/2+3.5,n.dist));
    }
    for(const r of ramps){
      const yaw=r.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),dx=x-r.x,dz=wz-r.z,lx=dx*c+dz*s,lz=-dx*s+dz*c;
      const len=(r.len||((r.takeoff||0)+(r.back||0)+(r.gap||0)+(r.land||0)));
      if(lx>-2.5&&lx<len+2.5){
        const along=lx<0?smooth(0,2.5,-lx):lx>len?smooth(0,2.5,lx-len):1;
        dirt=Math.max(dirt,smooth(r.w/2+.4,r.w/2+3.2,Math.abs(lz))*along);
      }
    }
    dirtCol[i*3]=Math.max(0,Math.min(1,dirt));dirtCol[i*3+1]=1;dirtCol[i*3+2]=1;
    floorUv[i*2]=x/TILE;floorUv[i*2+1]=wz/TILE;
  }
  floor.geometry.setAttribute('color',new T.BufferAttribute(dirtCol,3));
  floor.geometry.setAttribute('uv',new T.BufferAttribute(floorUv,2));
  floor.geometry.computeVertexNormals();sharedGeo.push(floor.geometry);root.add(floor);

  // Visible side-view track: a dirt/asphalt strip along the S through the kickers.
  const track=terrain.track||makeArenaTrack();
  (function buildTrack(){
    const samp=track.samples,hw=track.width/2,n=samp.length;
    const strip=(half,yOff)=>{
      const pos=new Float32Array(n*2*3),idx=[];
      for(let i=0;i<n;i++){
        const s=samp[i];
        for(const side of [-1,1]){
          const x=s.x+s.nx*half*side,z=s.z+s.nz*half*side,y=h(x,z)+yOff;
          const k=(i*2+(side<0?0:1))*3;pos[k]=x;pos[k+1]=y;pos[k+2]=z;
        }
        if(i<n-1){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,c,b,b,c,d)}
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();sharedGeo.push(g);return g;
    };
    const trackMat=mat('#888',{map:roadACol,normalMap:roadANor,roughnessMap:roadARough,roughness:1,metalness:0,normalScale:new T.Vector2(.7,.7)});
    trackMat.onBeforeCompile=(shader)=>{
      shader.uniforms.roadC={value:roadCCol};
      shader.uniforms.roadCNor={value:roadCNor};
      shader.uniforms.roadCRough={value:roadCRough};
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <map_pars_fragment>','#include <map_pars_fragment>\nuniform sampler2D roadC;')
        .replace('#include <map_fragment>',`#ifdef USE_MAP
        vec2 cell=floor(vMapUv*0.35);
        float n=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
        float patch=step(0.78,n);
        vec4 roadA=texture2D(map,vMapUv);
        vec4 roadCv=texture2D(roadC,vMapUv);
        diffuseColor*=mix(roadA,roadCv,patch);
      #endif`);
    };
    trackMat.customProgramCacheKey=()=> 'wk-road008-patches';
    const tg=strip(hw,.03);
    const uv=new Float32Array(tg.attributes.position.count*2);
    // World-space UVs in metres (tile ~4 m), never scroll with the bike.
    const posAttr=tg.attributes.position;
    for(let i=0;i<posAttr.count;i++){uv[i*2]=posAttr.getX(i)/4;uv[i*2+1]=posAttr.getZ(i)/4}
    tg.setAttribute('uv',new T.BufferAttribute(uv,2));
    const m=new T.Mesh(tg,trackMat);m.name='environment:arena-track';m.userData.trackTex='Road008A';m.receiveShadow=true;m.renderOrder=1;root.add(m);
    const edge=mat('#f0e2a0',{roughness:.65,emissive:'#c9b56a',emissiveIntensity:.18,side:T.DoubleSide});
    for(const side of [-1,1]){
      const g=strip(.16,.04);
      // shift the narrow strip to each edge
      const pos=g.attributes.position;
      for(let i=0;i<pos.count;i++){
        const s=samp[i>>1];
        pos.setX(i,s.x+s.nx*(hw-.12)*side+s.nx*(i%2?-.16:.16)*side*.15);
        pos.setZ(i,s.z+s.nz*(hw-.12)*side+s.nz*(i%2?-.16:.16)*side*.15);
        pos.setY(i,h(pos.getX(i),pos.getZ(i))+.04);
      }
      pos.needsUpdate=true;g.computeVertexNormals();
      const e=new T.Mesh(g,edge);e.name='environment:arena-track-edge';e.receiveShadow=true;e.renderOrder=2;root.add(e);
    }
    const dash=mat('#ece6d0',{roughness:.7,emissive:'#d8d0b0',emissiveIntensity:.1,side:T.DoubleSide});
    const on=2.2,off=1.6,period=on+off;let run=0,segStart=0;
    const dashPos=[],dashIdx=[];
    const pushVert=(x,y,z)=>{const i=dashPos.length/3;dashPos.push(x,y,z);return i};
    for(let i=0;i<n-1;i++){
      const a=samp[i],b=samp[i+1],ds=b.s-a.s;
      const mid=run%period;
      if(mid<on){
        const hw2=.11;
        const aL=pushVert(a.x+a.nx*hw2,h(a.x,a.z)+.045,a.z+a.nz*hw2);
        const aR=pushVert(a.x-a.nx*hw2,h(a.x,a.z)+.045,a.z-a.nz*hw2);
        const bL=pushVert(b.x+b.nx*hw2,h(b.x,b.z)+.045,b.z+b.nz*hw2);
        const bR=pushVert(b.x-b.nx*hw2,h(b.x,b.z)+.045,b.z-b.nz*hw2);
        dashIdx.push(aL,bL,aR,aR,bL,bR);
      }
      run+=ds;
    }
    const dg=new T.BufferGeometry();dg.setAttribute('position',new T.Float32BufferAttribute(dashPos,3));dg.setIndex(dashIdx);dg.computeVertexNormals();sharedGeo.push(dg);
    const dmesh=new T.Mesh(dg,dash);dmesh.name='environment:arena-track-dash';dmesh.receiveShadow=true;dmesh.renderOrder=2;root.add(dmesh);
  })();

  // Cardinal wall colours so each side of the square reads at a glance.
  const wallCols={north:'#4a6fa8',east:'#b85a48',south:'#c9a43a',west:'#4a8a5a'};
  const wallH=2.6,thick=1.4,span=HALF*2+thick;
  const box=new T.BoxGeometry(1,1,1);sharedGeo.push(box);
  const wall=(x,z,sx,sz,name,col)=>{const o=new T.Mesh(box,mat(col,{roughness:.9}));o.position.set(x,wallH/2,z);o.scale.set(sx,wallH,sz);o.name=name;o.castShadow=o.receiveShadow=true;root.add(o);};
  wall(0,HALF,span,thick,'environment:arena-wall-north',wallCols.north);
  wall(HALF,0,thick,span,'environment:arena-wall-east',wallCols.east);
  wall(0,-HALF,span,thick,'environment:arena-wall-south',wallCols.south);
  wall(-HALF,0,thick,span,'environment:arena-wall-west',wallCols.west);

  const dark=mat('#262e41',{metalness:.5,roughness:.6});
  const warm=mat('#ffdf9d',{emissive:'#ffac4c',emissiveIntensity:2.2});
  const wood=mat('#6b4a32',{roughness:.92});
  const glass=mat('#8fb4d8',{metalness:.55,roughness:.22,emissive:'#3a5878',emissiveIntensity:.2});
  const coneMat=mat('#e85c16',{roughness:.7,emissive:'#c43a08',emissiveIntensity:.12});
  const coneStripe=mat('#f4f0e6',{roughness:.65});
  const barrelMat=mat('#3f6a48',{metalness:.25,roughness:.55});
  const barrelRim=mat('#2a2a2e',{metalness:.4,roughness:.5});
  const tyreMat=mat('#1c1c1e',{roughness:.85});
  const trunkMat=mat('#5a3a22',{roughness:.95});
  const leafMat=mat('#2f6a34',{roughness:.9});
  const palmLeaf=mat('#3d8a3a',{roughness:.88,side:T.DoubleSide});
  const facade=(()=>{const t=canvasTex((x,w,h)=>{x.fillStyle='#4a4e62';x.fillRect(0,0,w,h);for(let a=10;a<w;a+=18)for(let y=12;y<h;y+=24){x.fillStyle=(a+y)%36<18?'#e8c48a':'#6e88aa';x.globalAlpha=.45;x.fillRect(a,y,8,12)}x.globalAlpha=1;},256,512);t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.repeat.set(1,1);return t;})();
  const windowMat=mat('#d1c8e0',{map:facade,emissive:'#8e6875',emissiveMap:facade,emissiveIntensity:.18,roughness:.4});

  const cylY=new T.CylinderGeometry(1,1,1,10);
  const coneGeo=new T.CylinderGeometry(.06,.27,.70,8);
  const lampPole=new T.CylinderGeometry(.06,.08,7,6);
  const lampHead=new T.BoxGeometry(.36,.1,.24);
  const post=new T.BoxGeometry(.08,1.15,.08);
  const rail=new T.BoxGeometry(3.2,.06,.05);
  const carBody=new T.BoxGeometry(2.05,.48,.95),carCabin=new T.BoxGeometry(1.0,.34,.86);
  const wheel=new T.CylinderGeometry(.2,.2,.16,10);wheel.rotateZ(Math.PI/2);
  const tyreRing=new T.TorusGeometry(.28,.1,8,12);tyreRing.rotateX(Math.PI/2);
  sharedGeo.push(cylY,coneGeo,lampPole,lampHead,post,rail,carBody,carCabin,wheel,tyreRing);

  // Corner flags (mix of the two meeting wall colours).
  const flagPole=new T.CylinderGeometry(.05,.07,8.2,8);sharedGeo.push(flagPole);
  const flagGeo=new T.PlaneGeometry(1.6,1.05);sharedGeo.push(flagGeo);
  const corners=[[1,1,wallCols.north,wallCols.east],[1,-1,wallCols.east,wallCols.south],[-1,-1,wallCols.south,wallCols.west],[-1,1,wallCols.west,wallCols.north]];
  for(const [sx,sz,a,b] of corners){
    const x=sx*(HALF-4),z=sz*(HALF-4),y=h(x,z);
    add(root,flagPole,dark,x,y+4.1,z);
    const f=add(root,flagGeo,mat(a,{emissive:a,emissiveIntensity:.18,side:T.DoubleSide,roughness:.7}),x-sx*.05,y+7.2,z+sz*.85,1,1,1);
    f.rotation.y=Math.atan2(-sx,sz);
    const f2=f.clone();f2.material=mat(b,{emissive:b,emissiveIntensity:.18,side:T.DoubleSide,roughness:.7});f2.position.y=y+6.1;f2.scale.set(.85,.75,1);root.add(f2);
    f.name='environment:corner-flag';
  }

  // Light poles every 25 m just inside the walls.
  let poleN=0;
  const placePole=(x,z)=>{const y=h(x,z);add(root,lampPole,dark,x,y+3.5,z);add(root,lampHead,warm,x,y+7.05,z);poleN++;colliders.push({kind:'cyl',x,z,r:.12,y0:y,y1:y+7.1});};
  for(let t=-137.5;t<=137.5;t+=25){
    placePole(t,HALF-3.2);placePole(t,-(HALF-3.2));
    placePole(HALF-3.2,t);placePole(-(HALF-3.2),t);
  }

  // Traffic cones: rows and a few gates. Keep the z=80 clear-speed lane empty.
  const coneAt=(x,z)=>{
    const y=h(x,z);
    const g=new T.Group();g.position.set(x,y+.35,z);g.name='environment:cone';root.add(g);
    add(g,coneGeo,coneMat,0,0,0,1,1,1);
    add(g,cylY,coneStripe,0,.11,0,.24,.06,.24);
    colliders.push({kind:'cone',x,z,r:.16,y0:y,y1:y+.7,mesh:g});
  };
  for(let x=-36;x<=36;x+=4)coneAt(x,50);
  for(let x=-28;x<=28;x+=4.5)coneAt(x,-62);
  // slalom off the main runways
  for(let i=0;i<8;i++)coneAt(-50+i*5, 28+(i%2?2.2:-2.2));
  // gates on the +X runway into the small and large kickers (2.4 m wide)
  for(const x of [8,16,22]){coneAt(x,2.3);coneAt(x,-2.3)}
  for(const x of [90,98,106]){coneAt(x,3.2);coneAt(x,-3.2)}
  // gates onto the medium / big kicker lanes
  coneAt(46,14.8);coneAt(46,9.2);coneAt(52,-25.6);coneAt(52,-30.4);

  // Scattered barrels and tyre stacks, off the runways and the z=80 lane.
  const dumps=[[-42,30],[-88,24],[42,-52],[-24,-88],[88,48],[-70,-48],[48,88],[-100,40],[100,-70],[-20,100],[20,-110],[60,60]];
  for(const [x,z] of dumps){
    const y=h(x,z);
    if((x*x+z*z)%2<1){
      add(root,cylY,barrelMat,x,y+.45,z,.28,.9,.28);
      add(root,cylY,barrelRim,x,y+.88,z,.29,.06,.29);
    }else{
      for(let i=0;i<3;i++)add(root,tyreRing,tyreMat,x+(i%2)*.05,y+.14+i*.2,z,.9,1,.9,i*.2);
    }
  }

  // Coloured run-up lanes and chevrons into each kicker, aligned with the ramp heading.
  const laneCols={table:'#e8d36a',small:'#5ec8ff',medium:'#f0a33a',big:'#e26bff',large:'#7dff6a'};
  const arrowShape=(()=>{const s=new T.Shape();s.moveTo(.9,0);s.lineTo(-.45,.55);s.lineTo(-.2,0);s.lineTo(-.45,-.55);s.closePath();const g=new T.ShapeGeometry(s);g.rotateX(-Math.PI/2);sharedGeo.push(g);return g})();
  for(const r of (terrain.ramps||[])){
    const col=laneCols[r.name]||'#d7d0a4';
    const yaw=r.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw);
    const rlen=rampLength(r),len=Math.max(14,rlen*1.4),w=Math.max(3.2,r.w*.7);
    const midX=r.x-c*len/2, midZ=r.z-n*len/2;
    const lane=new T.Mesh(new T.PlaneGeometry(len,w),mat(col,{roughness:.6,emissive:col,emissiveIntensity:.16,transparent:true,opacity:.55}));
    sharedGeo.push(lane.geometry);
    lane.rotation.x=-Math.PI/2;lane.rotation.z=-yaw;lane.position.set(midX,h(midX,midZ)+.03,midZ);lane.name='environment:runway:'+r.name;lane.receiveShadow=true;root.add(lane);
    const chevMat=mat(col,{emissive:col,emissiveIntensity:.35,side:T.DoubleSide,roughness:.55});
    for(let i=0;i<3;i++){
      const d=2.2+i*2.1,ax=r.x-c*d,az=r.z-n*d;
      const a=add(root,arrowShape,chevMat,ax,h(ax,az)+.04,az,1,1,1,yaw);
      a.rotation.y=yaw-Math.PI/2;a.name='environment:arrow:'+r.name;
    }
  }

  // Bright, outlined jump bodies so they read from side and chase at a distance.
  const jumpDirtTex=canvasTex((g,w,h)=>{
    g.fillStyle='#d2a05a';g.fillRect(0,0,w,h);
    for(let i=0;i<2200;i++){const n=Math.abs(Math.sin(i*37.71)*23421.2)%1,m=Math.abs(Math.sin(i*11.13)*91873.4)%1;
      g.fillStyle=n>.6?'#e8c07a':n>.3?'#b8843e':'#8a5a28';g.globalAlpha=.55;g.fillRect((n*w)|0,(m*h)|0,3,2)}
    g.globalAlpha=1;
  },256,256);
  const jumpMat=mat('#d4a056',{map:jumpDirtTex,roughness:.86,emissive:'#7a4a18',emissiveIntensity:.12});
  const lipMat=mat('#ffe27a',{roughness:.45,emissive:'#ffcc44',emissiveIntensity:.55,side:T.DoubleSide});
  const edgeMat=mat('#5a3a1c',{roughness:.9,emissive:'#2a1808',emissiveIntensity:.08,side:T.DoubleSide});
  const shadowMat=mat('#000000',{transparent:true,opacity:.32,depthWrite:false});
  for(const r of (terrain.ramps||[])){
    const yaw=r.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw),rlen=rampLength(r);
    const nx=Math.max(24,Math.round(rlen*3)),nz=Math.max(8,Math.round(r.w*3));
    const pos=[],uv=[],idx=[];
    for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
      const lx=ix/nx*rlen,lz=(iz/nz-0.5)*r.w;
      const x=r.x+c*lx-n*lz,z=r.z+n*lx+c*lz,y=h(x,z)+.04;
      pos.push(x,y,z);uv.push(lx/4, (lz+r.w/2)/2);
      if(ix<nx&&iz<nz){const a=iz*(nx+1)+ix,b=a+1,d=a+nx+1,e=d+1;idx.push(a,d,b,b,d,e)}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();sharedGeo.push(g);
    const body=new T.Mesh(g,jumpMat);body.name='environment:jump:'+r.name;body.receiveShadow=true;body.castShadow=!lowDetail;body.renderOrder=3;root.add(body);
    // Lip stripe (and a landing-start stripe on kickers / table down-edge)
    const stripe=new T.BoxGeometry(0.28,0.1,r.w*.92);sharedGeo.push(stripe);
    const mark=(lx,tag)=>{
      const midX=r.x+c*lx,midZ=r.z+n*lx,lipY=h(midX,midZ)+.1;
      const lip=new T.Mesh(stripe,lipMat);lip.position.set(midX,lipY,midZ);lip.rotation.y=-yaw;lip.name='environment:jump-lip'+tag+':'+r.name;lip.castShadow=!lowDetail;root.add(lip);
    };
    mark(rampLipX(r),'');
    if(r.kind==='table') mark(rlen*(r.down||.64),'2');
    else mark((r.takeoff||0)+(r.back||0)+(r.gap||0),'2');
    // Side outline / edge rails
    for(const side of [-1,1]){
      const ep=[],ei=[];
      for(let ix=0;ix<=nx;ix++){
        const lx=ix/nx*rlen,lz=side*r.w/2;
        const x=r.x+c*lx-n*lz,z=r.z+n*lx+c*lz,y=h(x,z);
        ep.push(x,0.02,z, x,y+.06,z);
        if(ix<nx){const a=ix*2;ei.push(a,a+2,a+1,a+1,a+2,a+3)}
      }
      const eg=new T.BufferGeometry();eg.setAttribute('position',new T.Float32BufferAttribute(ep,3));eg.setIndex(ei);eg.computeVertexNormals();sharedGeo.push(eg);
      const rail=new T.Mesh(eg,edgeMat);rail.name='environment:jump-edge:'+r.name;rail.castShadow=!lowDetail;root.add(rail);
    }
    // Soft ground shadow
    const sh=new T.Mesh(new T.PlaneGeometry(rlen+2.2,r.w+2.4),shadowMat);
    sharedGeo.push(sh.geometry);
    sh.rotation.x=-Math.PI/2;sh.rotation.z=-yaw;
    sh.position.set(r.x+c*(rlen/2),0.02,r.z+n*(rlen/2));
    sh.name='environment:jump-shadow:'+r.name;sh.renderOrder=0;root.add(sh);
  }

  // City ring outside the walls — sample3d kit: mixed buildings, trees, palms, fences, cars.
  const builds=new T.Group();builds.name='environment:buildings';root.add(builds);
  const types=[
    {w:6,ht:7.2,d:5.5,col:'#4a4e68'},{w:8,ht:11,d:6,col:'#5c4a62'},{w:5,ht:14.5,d:5.5,col:'#3e4a58'},
    {w:7,ht:8.2,d:6.2,col:'#55506a'},{w:9,ht:12.2,d:7,col:'#4a3e52'},{w:6,ht:5.6,d:5,col:'#5a5a52'},
    {w:10,ht:9.4,d:6.5,col:'#6a4a32'},{w:5,ht:16,d:5,col:'#3a4860'},{w:8,ht:6.6,d:6,col:'#4a3a28'},
    {w:7,ht:10.4,d:5.8,col:'#4e3e58'},{w:9,ht:8.8,d:6.4,col:'#3a3a42'},{w:6,ht:13.2,d:5.6,col:'#42465c'}
  ];
  const carCols=['#c44c4c','#3d6cb0','#d2a84a','#3e8a5a','#8a8e96'];
  const cyan=mat('#6ee8ff',{emissive:'#20b9ff',emissiveIntensity:1.6});
  const violet=mat('#d59aff',{emissive:'#9850ff',emissiveIntensity:1.2});
  let bi=0,carN=0,treeN=0,hash=7;
  const rnd=()=>{hash=hash*1664525+1013904223&0x7fffffff;return (hash%1000)/1000};

  function tree(x,z,kind){
    const y=h(x,z);treeN++;
    if(kind==='palm'){
      const len=3.4+rnd()*1.4;
      add(root,cylY,trunkMat,x,y+len/2,z,.12,len,.12);
      for(let i=0;i<6;i++){
        const a=i/6*Math.PI*2+rnd()*.2, leaf=add(root,box,palmLeaf,x+Math.cos(a)*.55,y+len+.05,z+Math.sin(a)*.55,1.3,.05,.28,a);
        leaf.rotation.z=-.35;
      }
      return;
    }
    const ht=2.2+rnd()*1.4;
    add(root,cylY,trunkMat,x,y+ht*.45,z,.14,ht,.14);
    add(root,cylY,leafMat,x,y+ht+.35,z,1.1+rnd()*.4,1.1,1.1+rnd()*.3);
    add(root,cylY,leafMat,x+.25,y+ht+.7,z,.7,.7,.7);
  }

  function car(x,z,yaw,col){
    const y=h(x,z),g=new T.Group();g.position.set(x,y,z);g.rotation.y=yaw;g.scale.setScalar(2.2);g.name='environment:car';
    add(g,carBody,mat(col,{metalness:.28,roughness:.42}),0,.26,0);
    add(g,carCabin,glass,-.08,.62,0);
    for(const [wx,wz] of [[-.65,.42],[-.65,-.42],[.7,.42],[.7,-.42]])add(g,wheel,dark,wx,.2,wz);
    root.add(g);carN++;colliders.push({kind:'box',x,z,hx:2.3,hz:1.1,y0:y,y1:y+1.2});
  }

  function placeBuilding(x,z,spec,ix,iz){
    const m=mat(spec.col,{map:facade,roughness:.86});
    const b=add(builds,box,m,x,spec.ht/2,z,spec.w,spec.ht,spec.d,0);b.name='environment:building:'+(bi++);
    const fx=x+ix*spec.d/2,fz=z+iz*spec.d/2,faceYaw=Math.atan2(ix,iz);
    add(builds,box,windowMat,fx,spec.ht*.55,fz,spec.w*.86,spec.ht*.62,.08,faceYaw);
    if(spec.ht>10)add(builds,box,spec.ht>13?cyan:violet,x,spec.ht+.04,z,spec.w*.65,.06,.22);
  }

  // Four sides just outside the wall. (ix,iz) is the inward (arena-facing) direction.
  const sides=[
    {along:'x',sign:1, ix:0,iz:-1},   // north +Z, windows face -Z
    {along:'x',sign:-1,ix:0,iz:1},    // south -Z, windows face +Z
    {along:'z',sign:1, ix:-1,iz:0},   // east +X, windows face -X
    {along:'z',sign:-1,ix:1,iz:0}     // west -X, windows face +X
  ];
  for(const side of sides){
    let cursor=-HALF+5, prev=-1, ti=side.sign>0?0:3;
    const gap0=2.2;
    while(cursor<HALF-5){
      ti=(ti+1+((cursor|0)%3===0?1:0))%types.length;
      if(ti===prev)ti=(ti+1)%types.length;
      const spec=types[ti];prev=ti;
      const mid=cursor+spec.w/2;
      if(mid>HALF-5)break;
      const depth=158+spec.d/2;
      const x=side.along==='x'?mid:side.sign*depth;
      const z=side.along==='z'?mid:side.sign*depth;
      placeBuilding(x,z,spec,side.ix,side.iz);
      // fence posts along the inner kerb (just outside the wall)
      const fx=side.along==='x'?mid:side.sign*(HALF+2.4);
      const fz=side.along==='z'?mid:side.sign*(HALF+2.4);
      add(root,post,wood,fx,.58,fz);
      add(root,rail,wood,fx, .82,fz, side.along==='x'?spec.w/3.2:1,1,side.along==='z'?spec.w/3.2:1, side.along==='z'?Math.PI/2:0);
      // tree or palm in the gap, not the same every time
      if(!lowDetail && rnd()>.35){
        const gx=side.along==='x'?cursor+spec.w+1.1:side.sign*(HALF+5.5);
        const gz=side.along==='z'?cursor+spec.w+1.1:side.sign*(HALF+5.5);
        tree(gx,gz,rnd()>.5?'palm':'tree');
      }
      // a few parked cars along the outer kerb
      if(rnd()>.72){
        const cx=side.along==='x'?mid-spec.w*.2:side.sign*(HALF+5);
        const cz=side.along==='z'?mid-spec.w*.2:side.sign*(HALF+5);
        const yaw=side.along==='x'?(rnd()>.5?0:Math.PI):(rnd()>.5?Math.PI/2:-Math.PI/2);
        car(cx,cz,yaw,carCols[(carN+ti)%carCols.length]);
      }
      cursor+=spec.w+gap0+rnd()*1.6;
    }
    // mid-distance taller towers, sparser, further out
    if(!lowDetail){
      for(let t=-120;t<=120;t+=28+((t/7)|0)%5){
        const spec=types[(Math.abs(t/7)+ti+4)%types.length];
        const tall={...spec,ht:spec.ht+4+rnd()*5,w:spec.w*.85,d:spec.d};
        if(Math.abs(t)<8)continue;
        const depth=182+tall.d/2;
        const x=side.along==='x'?t:side.sign*depth;
        const z=side.along==='z'?t:side.sign*depth;
        placeBuilding(x,z,tall,side.ix,side.iz);
      }
    }
  }

  // Distant skyline silhouettes, world-fixed on the horizon (not camera-parented).
  const sil=new T.Group();sil.name='environment:skyline';root.add(sil);
  const silMat=mat('#141018',{roughness:1,metalness:0,fog:true});
  let silN=0;
  for(let i=0;i<64;i++){
    const a=(i/64)*Math.PI*2+((i*17)%7)*0.01;
    const r=248+((i*13)%9);
    const ht=10+((i*29)%23)+((i%5)===0?14:0);
    const w=7+((i*11)%10),d=6+((i*7)%6);
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    const b=add(sil,box,silMat,x,ht/2,z,w,ht,d,a);
    b.name='environment:skyline:'+(silN++);
    b.castShadow=false;b.receiveShadow=false;
  }

  // Thin rear-tyre marks, laid exactly at the rear contact patch (visual only).
  const SKID=192,TYRE_W=.10,MARK_LEN=.16;
  const skidGeo=new T.PlaneGeometry(MARK_LEN,TYRE_W);skidGeo.rotateX(-Math.PI/2);sharedGeo.push(skidGeo);
  const skidMat=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.55,depthWrite:false,vertexColors:true});sharedMat.push(skidMat);
  const skidMesh=new T.InstancedMesh(skidGeo,skidMat,SKID);skidMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);skidMesh.frustumCulled=false;skidMesh.name='environment:skids';
  const skidCols=new Float32Array(SKID*3);skidMesh.instanceColor=new T.InstancedBufferAttribute(skidCols,3);root.add(skidMesh);
  const skidTint={dirt:[0.12,0.08,0.05],asphalt:[0.07,0.07,0.07],grass:[0.18,0.26,0.14]};
  const skidParts=Array.from({length:SKID},()=>({life:0}));
  const dummy=new T.Object3D();let skidI=0,skidAcc=0,lastSkid=null;
  const hideSkids=()=>{dummy.scale.set(0,0,0);dummy.updateMatrix();for(let i=0;i<SKID;i++)skidMesh.setMatrixAt(i,dummy.matrix);skidMesh.instanceMatrix.needsUpdate=true};

  function update(_x,ctx){
    if(grassFx&&grassFx.ready&&grassFx.entries){
      const sx=ctx?.s?.x||0,sz=ctx?.s?.z||0,cull=grassFx.cull,c2=cull*cull;
      for(const e of grassFx.entries){
        const dummy=e.dummy||new T.Object3D();
        let changed=false;
        for(let i=0;i<e.origins.length;i++){
          const p=e.origins[i],d2=(p.x-sx)*(p.x-sx)+(p.z-sz)*(p.z-sz);
          const show=d2<c2;
          if(p._show===show)continue;
          p._show=show;changed=true;
          dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);
          dummy.scale.setScalar(show?p.sc:0);dummy.updateMatrix();
          e.mesh.setMatrixAt(i,dummy.matrix);
        }
        if(changed)e.mesh.instanceMatrix.needsUpdate=true;
      }
    }

    const s=ctx?.s,dt=ctx?.dt||1/60,P=ctx?.P;
    if(!s){hideSkids();return;}
    if(!ctx.paused){
      const onG=!!(s.ground&&s.ground[0]);
      const yaw=s.yaw||0,c=Math.cos(yaw),n=Math.sin(yaw);
      const wb=P?.wb||1.34,com=P?.comBack||.42,rear=-wb*com;
      const bx=s.x+c*rear,bz=(s.z||0)+n*rear,gy=h(bx,bz)+.012;
      const slip=s.slip?s.slip[0]:0;
      const yawRate=s.burnout?((s.steer||0)/(33*Math.PI/180))*.7:0;
      const lat=Math.abs(yawRate)*wb;
      const sliding=onG&&(s.burnout||Math.abs(slip)>1.4||lat>.2);
      if(sliding){
        const speed=Math.hypot(s.vx||0,lat)||Math.abs(slip);
        skidAcc+=Math.max(.35,speed)*dt;
        if(skidAcc>.09){
          skidAcc=0;
          const mark=skidParts[skidI++%SKID];
          const vxw=(s.vx||0)*c-yawRate*wb*n,vzw=(s.vx||0)*n+yawRate*wb*c;
          const markYaw=Math.hypot(vxw,vzw)>.05?Math.atan2(vzw,vxw):yaw;
          const surface=surfaceAt(bx,bz);
          const tint=skidTint[surface]||skidTint.dirt;
          const opac=surface==='grass'?0.22:surface==='asphalt'?0.40:0.55;
          Object.assign(mark,{life:5.8,x:bx,y:gy,z:bz,yaw:markYaw,tint,opac,surface});
          lastSkid={x:bx,y:gy,z:bz,width:TYRE_W,surface};
        }
      }
    }
    for(let i=0;i<SKID;i++){
      const mark=skidParts[i];
      if(mark.life<=0){dummy.scale.set(0,0,0);dummy.position.set(0,-10,0);skidCols[i*3]=skidCols[i*3+1]=skidCols[i*3+2]=0;}
      else{
        if(!ctx?.paused)mark.life-=dt;
        dummy.position.set(mark.x,mark.y,mark.z);
        dummy.rotation.set(0,-mark.yaw,0);
        // Faint flattened grass marks, dark dirt ruts, rubber on asphalt.
        const w=mark.surface==='dirt'?1.15:mark.surface==='grass'?1.25:1;
        dummy.scale.set(1,1,w);
        const tn=mark.tint||skidTint.dirt, fade=Math.min(1,mark.life/5.8)*(mark.opac??.45);
        skidCols[i*3]=tn[0]*fade;skidCols[i*3+1]=tn[1]*fade;skidCols[i*3+2]=tn[2]*fade;
      }
      dummy.updateMatrix();skidMesh.setMatrixAt(i,dummy.matrix);
    }
    skidMesh.instanceMatrix.needsUpdate=true;
    if(skidMesh.instanceColor)skidMesh.instanceColor.needsUpdate=true;
  }

  const surfaceAt=(x,z)=>{
    if(!terrain.track)return 'dirt';
    if(terrain.track.nearest(x,z).dist<(terrain.track.width||6)/2+3.5)return 'dirt';
    if((terrain.height(x,z)||0)>.04)return 'dirt';
    return 'grass';
  };

  scatterArenaGrass(T,root,{h,terrain,ramps,lowDetail,sharedMat,sharedGeo,sharedTex,grassFx});

  return {
    roadMap:grassTex,
    colliders,
    isDirt:(x,z)=>surfaceAt(x,z)==='dirt',
    surfaceAt,
    update,
    view(){},
    state:()=>({arena:true,sample3d:false,midground:false,size:HALF*2,jumps:(terrain.kickers||[]).length,bounds:terrain.bounds,buildings:bi,poles:poleN,cars:carN,trees:treeN,landmarks:true,track:true,trackWidth:track.width,trackLength:track.length,ground:'grass-dirt',trackTex:'Road008A',patchTex:'Road008C',dirtTex:'Ground086',uvWorld:true,tile:TILE,skyline:silN,floor:{x:floor.position.x,y:floor.position.y,z:floor.position.z},grassOffset:[grassTex.offset.x,grassTex.offset.y],dirtOffset:[0,0],skid:lastSkid,colliders:colliders.length}),
    dispose(){sharedTex.forEach(t=>t.dispose());sharedMat.forEach(m=>m.dispose());sharedGeo.forEach(g=>g.dispose());skidMesh.dispose();grassFx.entries?.forEach(e=>e.mesh.dispose());grassFx.group?.removeFromParent();root.removeFromParent();}
  };
}
