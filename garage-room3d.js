import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {Reflector} from './vendor/Reflector.js';
// Every wall, lamp and floor belongs to this world-space room, alongside the placed rides.
export function garageRoom(T,scene,renderer,{workshop=false,reflections=false,asSecondary=false,origin=null}={}){
 const previousBackground=scene.background,previousFog=scene.fog;
 const previous={environment:scene.environment,background:previousBackground,fog:previousFog};
 if(!asSecondary){scene.background=new T.Color('#202430');scene.fog=new T.Fog('#202430',25,55);}
 const coarse=matchMedia('(pointer:coarse)').matches;
 const room=new T.Group();room.name='garage:fixed-room';if(origin)room.position.set(...origin);scene.add(room);
 let target=null;
 if(!asSecondary){const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment(renderer);for(const [x,color]of [[-3,'#b04cff'],[0,'#52daff'],[3,'#b04cff']]){const strip=new T.Mesh(new T.BoxGeometry(2,.025,.12),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(4)}));strip.position.set(x,3.8,0);environment.add(strip);}target=pmrem.fromScene(environment,.04);scene.environment=target.texture;environment.dispose?.();pmrem.dispose();}
 const textures=[],mat=(color,roughness=.55,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness,envMapIntensity:.35});
 const mesh=(name,geo,m,p)=>{const o=new T.Mesh(geo,m);o.name='garage:'+name;o.position.set(...p);o.castShadow=o.receiveShadow=true;room.add(o);return o};
 const box=(name,w,h,d,m,p)=>mesh(name,new T.BoxGeometry(w,h,d),m,p);
 const dark=mat('#242936',.4,.7),silver=mat('#8894a0',.3,.8),wood=mat('#544c42',.7,.05),cabinet=mat('#283240',.38,.55),black=mat('#111922',.7,.05);
 const texture=(draw,size=512)=>{const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;textures.push(t);return t};
 let seed=531;const rnd=()=>((seed=seed*16807%2147483647)/2147483647);
 const brick=texture((c,n)=>{c.fillStyle=workshop?'#262c37':'#777a80';c.fillRect(0,0,n,n);for(let row=0;row<8;row++)for(let col=-1;col<5;col++){const x=col*128+(row%2)*64,y=row*64,v=(workshop?63:174)+Math.floor(rnd()*14);c.fillStyle=`rgb(${v},${v},${v+3})`;c.fillRect(x+2,y+2,124,60);c.fillStyle=workshop?'#555a65':'#c0c1c4';c.fillRect(x+3,y+3,121,2);}for(let i=0;i<9000;i++){c.fillStyle=rnd()>.5?'#ffffff0a':'#0000000b';c.fillRect(rnd()*n,rnd()*n,1,1)}});brick.colorSpace=T.SRGBColorSpace;
 const wallMat=mat('#fff9f3',.83,.02);wallMat.map=brick;wallMat.bumpMap=brick;wallMat.bumpScale=.018;
 const wall=(name,w,h,pos,angle)=>{const m=wallMat.clone(),map=brick.clone();map.needsUpdate=true;map.repeat.set(w/2,h/1.1);textures.push(map);m.map=m.bumpMap=map;const o=mesh(name,new T.PlaneGeometry(w,h),m,pos);o.rotation.y=angle;o.castShadow=false;return o};
 wall('back-wall',12,4.5,[0,2.25,-4.5],0);wall('left-wall',11,4.5,[-6,2.25,1],Math.PI/2);wall('right-wall',11,4.5,[6,2.25,1],-Math.PI/2);wall('front-wall',12,4.5,[0,2.25,6.5],Math.PI);
 const ceiling=mesh('ceiling',new T.PlaneGeometry(12,11),mat('#171c29',.8),[0,4.5,1]);ceiling.rotation.x=Math.PI/2;ceiling.castShadow=false;
 for(const z of [-4.4,-1.8,1,3.7,6.4]){box('ceiling-beam',12,.17,.14,dark,[0,4.30,z]);for(const x of [-4,-2,0,2,4])box('beam-plate',.09,.19,.17,silver,[x,4.3,z]);}
 for(const x of [-5.85,-3,0,3,5.85])box('ceiling-joist',.10,.15,11,dark,[x,4.38,1]);
 for(const x of [-5.9,-3,0,3,5.9])box('wall-column',.13,4.4,.15,dark,[x,2.2,-4.40]);
 for(const x of [-5.9,5.9])box('side-skirting',.07,.12,11,dark,[x,.06,1]);box('rear-skirting',12,.12,.07,dark,[0,.06,-4.4]);
 const emissive=(color,intensity)=>{const m=mat(color,.25,.2);m.emissive.set(color);m.emissiveIntensity=intensity;return m};
 for(const [x,color]of [[-4,'#bb45ff'],[0,'#55dfff'],[4,'#bb45ff']])for(const z of [-2.8,2.8]){box('strip-housing',2.4,.05,.13,dark,[x,4.16,z]);box('neon-tube',2.23,.026,.055,emissive(color,2.5),[x,4.125,z]);if(!coarse||z<0){const light=new T.PointLight(color,8,9,2);light.position.set(x,3.8,z);room.add(light);}}
 const warm=emissive('#ffd58d',2);
 for(const x of [-4,0,4]){
  mesh('pendant-cord',new T.CylinderGeometry(.008,.008,.65,8),black,[x,3.9,-3.15]);mesh('pendant-shade',new T.ConeGeometry(.23,.18,28,1,true),dark,[x,3.5,-3.15]);const bulb=mesh('pendant-glow',new T.CircleGeometry(.19,24),warm,[x,3.415,-3.15]);bulb.rotation.x=-Math.PI/2;
  const light=new T.SpotLight('#ffc884',18,9,.67,.75,1.5);light.position.set(x,3.4,-3.15);light.target.position.set(x,1,-4.4);room.add(light,light.target);
 }
 // Built-in cabinets and wall shelves are anchored to the room, not the view camera.
 for(const side of [-1,1]){
  const x=side*4.85,z=-3.98;box('fixed-cabinet',1.8,.86,.75,cabinet,[x,.43,z]);box('worktop',1.90,.045,.82,wood,[x,.89,z]);
  for(const dx of [-.45,.45]){box('cabinet-door',.85,.72,.022,dark,[x+dx,.44,z+.39]);box('cabinet-handle',.29,.018,.035,silver,[x+dx,.7,z+.42]);}
  for(const y of [1.65,2.35]){box('wall-shelf',1.9,.055,.46,dark,[x,y,-4.21]);box('shelf-inlay',1.8,.012,.40,wood,[x,y+.034,-4.2]);for(const dx of [-.7,.7])box('shelf-bracket',.035,.22,.27,silver,[x+dx,y-.12,-4.33]);box('shelf-light',1.55,.015,.015,warm,[x,y-.04,-4.02]);}
 }
 if(workshop){
  // Original low-detail tool wall, behind the working bike rather than painted into a backdrop.
  box('tool-board',3.6,1.55,.055,cabinet,[0,1.9,-4.36]);
  const holes=new T.InstancedMesh(new T.CircleGeometry(.008,6),black,144),matrix=new T.Matrix4();holes.name='garage:pegboard-holes';for(let i=0;i<144;i++){matrix.makeTranslation(-1.65+(i%24)*.143,1.22+Math.floor(i/24)*.26,-4.326);holes.setMatrixAt(i,matrix);}room.add(holes);
  for(let i=0;i<8;i++){const x=-1.4+i*.4,length=.23+i*.013;mesh('wrench-shaft',new T.CylinderGeometry(.011,.011,length,8),silver,[x,2.15,-4.28]);mesh('wrench-ring',new T.TorusGeometry(.027,.008,6,14),silver,[x,2.15-length/2-.02,-4.28]);const jaw=mesh('wrench-jaw',new T.TorusGeometry(.034,.009,6,14,Math.PI*1.5),silver,[x,2.15+length/2+.02,-4.28]);jaw.rotation.z=-Math.PI/4;}
  for(let i=0;i<5;i++){const x=-.7+i*.35;mesh('driver-blade',new T.CylinderGeometry(.005,.005,.15,8),silver,[x,1.50,-4.27]);mesh('driver-grip',new T.CapsuleGeometry(.019,.08,4,10),i%2?dark:warm,[x,1.37,-4.27]);}
  const red=mat('#8e294b',.35,.45);box('bench-chest',3.5,.83,.70,red,[0,.415,-3.98]);box('bench-top',3.6,.06,.79,black,[0,.865,-3.98]);for(const x of [-.86,.86])for(let i=0;i<4;i++){const y=.14+i*.18;box('bench-drawer',1.66,.15,.025,cabinet,[x,y,-3.61]);box('bench-handle',1.28,.018,.025,silver,[x,y+.035,-3.585]);}
  for(const [x,color]of [[-2,'#b74bff'],[2,'#46dfff']]){box('bench-neon',.025,1.4,.025,emissive(color,2),[x,1.9,-4.30]);const light=new T.PointLight(color,6,5,2);light.position.set(x,1.9,-4.18);room.add(light);}
 }
 // Side-wall rails and a few storage bins give depth without covering the display area.
 for(const side of [-1,1])for(const z of [-1.5,1.3,4]){box('side-wall-rail',.05,.055,1.9,dark,[side*5.93,2.7,z]);box('storage-bin',.45,.35,.6,cabinet,[side*5.62,.175,z]);box('bin-lid',.48,.035,.63,black,[side*5.62,.365,z]);}
 const green=mat('#375e28',.76,.02),leafMat=mat('#639238',.68,.02),pot=mat('#35322e',.8,.08),leaves=[[],[]],leafPose=new T.Object3D();
 for(const side of [-1,1])for(const z of [-4.13,3.7]){
  const x=side*5.47;mesh('plant-pot',new T.CylinderGeometry(.16,.11,.23,16),pot,[x,2.55,z]);box('plant-bracket',.35,.035,.38,dark,[x,2.42,z]);
  for(let strand=0;strand<3;strand++){const dx=(strand-1)*.11,curve=new T.CatmullRomCurve3([new T.Vector3(x,2.62,z),new T.Vector3(x+dx,2.4,z+.15),new T.Vector3(x+dx*1.7,1.70,z+.17)]);const stem=mesh('ivy-stem',new T.TubeGeometry(curve,12,.008,5,false),green,[0,0,0]);stem.castShadow=false;for(let i=0;i<8;i++){leafPose.position.copy(curve.getPoint(i/8));leafPose.scale.set(.08,.10,.022);leafPose.rotation.set(.35,(i%2?1:-1)*.6,i%2?.65:-.65);leafPose.updateMatrix();leaves[i%2].push(leafPose.matrix.clone());}}
 }
 const leafGeometry=new T.SphereGeometry(1,8,6);for(let i=0;i<2;i++){const batch=new T.InstancedMesh(leafGeometry,i?green:leafMat,leaves[i].length);batch.name='garage:ivy-leaves-'+i;leaves[i].forEach((m,j)=>batch.setMatrixAt(j,m));room.add(batch);}
 const grain=texture((c,n)=>{c.fillStyle='#bbbcc2';c.fillRect(0,0,n,n);for(let i=0;i<25000;i++){const v=165+Math.floor(rnd()*55);c.fillStyle=`rgba(${v},${v},${v},.15)`;c.fillRect(rnd()*n,rnd()*n,2,1)}});grain.colorSpace=T.SRGBColorSpace;grain.repeat.set(8,8);
 let reflector;const reflectSupported=reflections&&!coarse&&renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float');
 if(reflectSupported){const size=matchMedia('(pointer:coarse)').matches?384:512;reflector=new Reflector(new T.PlaneGeometry(40,40),{textureWidth:size,textureHeight:size,color:'#a6a6af',clipBias:.003,multisample:0});reflector.name='garage:floor-reflection';reflector.rotation.x=-Math.PI/2;reflector.position.y=-.018;room.add(reflector);}
 const concrete=mat('#e1e1e5',.24,.14);concrete.map=grain;concrete.bumpMap=grain;concrete.bumpScale=.004;if(reflector){concrete.transparent=true;concrete.opacity=.88;concrete.depthWrite=false;}
 const floor=mesh('floor',new T.PlaneGeometry(40,40),concrete,[0,0,0]);floor.rotation.x=-Math.PI/2;floor.castShadow=false;floor.renderOrder=1;
 const lights=[];room.traverse(o=>{if(o.isLight)lights.push(o);});
 return {room,lights,state:()=>({worldRoom:true,reflection:!!reflector,quality:coarse?'mobile':'desktop',theme:workshop?'workshop':'showroom'}),setActive(on){room.visible=!!on;for(const l of lights)l.visible=!!on;},dispose(){const geometries=new Set(),materials=new Set();room.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material&&o!==reflector)for(const m of [].concat(o.material))materials.add(m);});room.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();if(target&&scene.environment===target.texture){scene.environment=previous.environment;scene.background=previous.background;scene.fog=previous.fog;}target?.dispose();reflector?.dispose()}};
}
