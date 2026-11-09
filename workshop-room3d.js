import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {Reflector} from './vendor/Reflector.js';

/** Neon workshop room: dark brick, beams, neon, props as floor-contact objects. */
export function workshopRoom(T,scene,renderer,{reflections=false,origin=[0,0,0]}={}){
 const previousBackground=scene.background,previousFog=scene.fog;
 scene.background=new T.Color('#141820');scene.fog=new T.Fog('#141820',28,60);
 const previous={environment:scene.environment,background:previousBackground,fog:previousFog};
 const coarse=matchMedia('(pointer:coarse)').matches;
 const room=new T.Group();room.name='workshop:fixed-room';room.position.set(...origin);scene.add(room);
 const lights=[];
 const addLight=l=>{lights.push(l);room.add(l);return l;};

 const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment(renderer);
 for(const [x,color]of [[-3,'#b04cff'],[0,'#52daff'],[3,'#b04cff']]){const strip=new T.Mesh(new T.BoxGeometry(2,.025,.12),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(4)}));strip.position.set(x,3.8,0);environment.add(strip);}
 const target=pmrem.fromScene(environment,.04);scene.environment=target.texture;environment.dispose?.();pmrem.dispose();

 const textures=[],mat=(color,roughness=.55,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness,envMapIntensity:.4});
 const mesh=(name,geo,m,p)=>{const o=new T.Mesh(geo,m);o.name='workshop:'+name;o.position.set(...p);o.castShadow=o.receiveShadow=true;room.add(o);return o;};
 const box=(name,w,h,d,m,p)=>mesh(name,new T.BoxGeometry(w,h,d),m,p);
 const dark=mat('#1c222c',.42,.65),silver=mat('#8894a0',.3,.78),wood=mat('#5a4e42',.72,.05),cabinet=mat('#222a36',.4,.5),black=mat('#0e1218',.7,.08);
 const red=mat('#9a2440',.38,.45),yellow=mat('#c9a12a',.45,.35),blueBin=mat('#2a4a72',.55,.15),greyBin=mat('#4a5560',.55,.2);
 const texture=(draw,size=512)=>{const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;textures.push(t);return t;};
 let seed=733;const rnd=()=>((seed=seed*16807%2147483647)/2147483647);
 const brick=texture((c,n)=>{c.fillStyle='#1e2430';c.fillRect(0,0,n,n);for(let row=0;row<10;row++)for(let col=-1;col<6;col++){const x=col*110+(row%2)*55,y=row*52,v=38+Math.floor(rnd()*18);c.fillStyle=`rgb(${v},${v+2},${v+6})`;c.fillRect(x+2,y+2,106,48);c.fillStyle='#4a5160';c.fillRect(x+3,y+3,104,2);}for(let i=0;i<7000;i++){c.fillStyle=rnd()>.5?'#ffffff08':'#0000000c';c.fillRect(rnd()*n,rnd()*n,1,1);}});
 brick.colorSpace=T.SRGBColorSpace;
 const wallMat=mat('#fff8f0',.84,.02);wallMat.map=brick;wallMat.bumpMap=brick;wallMat.bumpScale=.02;
 const wall=(name,w,h,pos,angle)=>{const m=wallMat.clone(),map=brick.clone();map.needsUpdate=true;map.repeat.set(w/2.1,h/1.15);textures.push(map);m.map=m.bumpMap=map;const o=mesh(name,new T.PlaneGeometry(w,h),m,pos);o.rotation.y=angle;o.castShadow=false;return o;};
 wall('back-wall',12,4.5,[0,2.25,-5.2],0);
 wall('left-wall',12,4.5,[-6,2.25,.4],Math.PI/2);
 wall('right-wall',12,4.5,[6,2.25,.4],-Math.PI/2);
 wall('front-wall',12,4.5,[0,2.25,6.2],Math.PI);

 const ceiling=mesh('ceiling',new T.PlaneGeometry(12,12),mat('#12161f',.85),[0,4.5,.4]);ceiling.rotation.x=Math.PI/2;ceiling.castShadow=false;
 for(const z of [-4.8,-2.2,.4,3,5.6]){box('ceiling-beam',12,.16,.13,dark,[0,4.32,z]);for(const x of [-4,-2,0,2,4])box('beam-plate',.08,.18,.15,silver,[x,4.32,z]);}
 for(const x of [-5.85,-3,0,3,5.85])box('ceiling-joist',.09,.14,12,dark,[x,4.4,.4]);

 const emissive=(color,intensity)=>{const m=mat(color,.25,.2);m.emissive.set(color);m.emissiveIntensity=intensity;return m;};
 for(const [x,color]of [[-4,'#bb45ff'],[0,'#55dfff'],[4,'#bb45ff']])for(const z of [-3,2.5]){
  box('strip-housing',2.4,.05,.12,dark,[x,4.18,z]);box('neon-tube',2.22,.025,.05,emissive(color,2.6),[x,4.145,z]);
  if(!coarse||z<0){const light=new T.PointLight(color,7.5,9,2);light.position.set(x,3.75,z);addLight(light);}
 }
 const warm=emissive('#ffd58d',2.1);
 for(const x of [-4.2,0,4.2]){
  mesh('pendant-cord',new T.CylinderGeometry(.008,.008,.7,8),black,[x,3.95,-3.5]);
  mesh('pendant-shade',new T.ConeGeometry(.22,.17,24,1,true),dark,[x,3.52,-3.5]);
  const bulb=mesh('pendant-glow',new T.CircleGeometry(.18,20),warm,[x,3.43,-3.5]);bulb.rotation.x=-Math.PI/2;
  const light=new T.SpotLight('#ffc884',16,9,.65,.72,1.5);light.position.set(x,3.4,-3.5);light.target.position.set(x,1,-4.8);addLight(light);room.add(light.target);
 }

 // Soft contact shadow helper under props
 const shadowTex=texture((c,n)=>{const g=c.createRadialGradient(n/2,n/2,2,n/2,n/2,n/2);g.addColorStop(0,'rgba(0,0,0,.38)');g.addColorStop(.55,'rgba(0,0,0,.12)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,n,n);},128);
 const contact=(name,w,d,p)=>{const m=new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,opacity:.85});const o=mesh(name+'-contact',new T.PlaneGeometry(w,d),m,[p[0],.004,p[2]]);o.rotation.x=-Math.PI/2;o.castShadow=false;o.receiveShadow=false;return o;};

 // --- BACK WALL (tool side): pegboard, blueprint, red chests, workbench ---
 box('tool-board',3.8,1.6,.055,cabinet,[0,2.05,-5.05]);
 // alias for legacy tests
 room.getObjectByName('workshop:tool-board').name='garage:tool-board';
 const holes=new T.InstancedMesh(new T.CircleGeometry(.007,6),black,160),matrix=new T.Matrix4();holes.name='workshop:pegboard-holes';
 for(let i=0;i<160;i++){matrix.makeTranslation(-1.75+(i%20)*.18,1.35+Math.floor(i/20)*.24,-5.015);holes.setMatrixAt(i,matrix);}room.add(holes);
 for(let i=0;i<9;i++){const x=-1.55+i*.38,length=.22+i*.012;mesh('wrench-shaft',new T.CylinderGeometry(.01,.01,length,8),silver,[x,2.35,-4.97]);mesh('wrench-ring',new T.TorusGeometry(.025,.007,6,12),silver,[x,2.35-length/2-.02,-4.97]);}
 for(let i=0;i<6;i++){const x=-1+i*.38;mesh('driver-blade',new T.CylinderGeometry(.004,.004,.14,6),silver,[x,1.55,-4.96]);mesh('driver-grip',new T.CapsuleGeometry(.017,.07,4,8),i%2?dark:warm,[x,1.42,-4.96]);}

 // Cyan blueprint screen
 const bp=texture((c,n)=>{c.fillStyle='#061820';c.fillRect(0,0,n,n);c.strokeStyle='#3be8ff';c.lineWidth=2;c.beginPath();c.moveTo(40,n*.7);c.lineTo(n*.35,n*.35);c.lineTo(n*.55,n*.4);c.lineTo(n*.75,n*.25);c.stroke();c.beginPath();c.arc(n*.72,n*.55,n*.18,0,Math.PI*2);c.stroke();c.beginPath();c.arc(n*.28,n*.62,n*.14,0,Math.PI*2);c.stroke();for(let i=0;i<18;i++){c.fillStyle='#3be8ff55';c.fillRect(20+i*26,n-30,18,3);}c.fillStyle='#3be8ff';c.font='22px monospace';c.fillText('FRAME  ·  FORK  ·  WHEEL',48,42);},512);
 bp.colorSpace=T.SRGBColorSpace;bp.wrapS=bp.wrapT=T.ClampToEdgeWrapping;
 const screenMat=mat('#0a2030',.35,.1);screenMat.map=bp;screenMat.emissive.set('#1ad0ff');screenMat.emissiveIntensity=.55;screenMat.emissiveMap=bp;
 box('blueprint-frame',2.6,1.35,.06,dark,[0,3.35,-5.08]);
 const screen=mesh('blueprint-screen',new T.PlaneGeometry(2.4,1.15),screenMat,[0,3.35,-5.04]);screen.castShadow=false;
 const bpLight=new T.PointLight('#3be8ff',4,5,2);bpLight.position.set(0,3.2,-4.6);addLight(bpLight);

 // Red rolling tool chests
 for(const [sx,x] of [[1,-1.15],[-1,1.15]]){
  box('tool-chest',1.55,.95,.72,red,[x,.48,-4.55]);contact('chest',1.7,.85,[x,0,-4.55]);
  for(let i=0;i<5;i++){const y=.14+i*.16;box('chest-drawer',1.42,.13,.03,cabinet,[x,y,-4.18]);box('chest-handle',.9,.015,.02,silver,[x,y+.03,-4.155]);}
  mesh('chest-caster',new T.CylinderGeometry(.04,.04,.05,10),black,[x+sx*.55,.04,-4.3]);
  mesh('chest-caster2',new T.CylinderGeometry(.04,.04,.05,10),black,[x-sx*.55,.04,-4.8]);
 }
 box('chest-top',3.3,.05,.78,black,[0,.98,-4.55]);

 // Workbench right
 box('workbench',1.9,.82,.85,cabinet,[4.2,.42,-4.4]);box('workbench-top',2,.05,.9,wood,[4.2,.86,-4.4]);contact('bench',2.1,1,[4.2,0,-4.4]);
 mesh('bench-tyre',new T.TorusGeometry(.28,.08,10,20),black,[4.9,.3,-3.85]);
 box('bench-crate',.42,.32,.35,wood,[3.5,.18,-3.95]);contact('crate',.5,.45,[3.5,0,-3.95]);

 // --- LEFT: yellow shelving + bins (instanced) ---
 const uprightMat=yellow,beamMat=mat('#6a727c',.4,.55);
 for(const zx of [-3.8,-1.6]){
  for(const sx of [-1,1])box('shelf-upright',.06,2.6,.06,uprightMat,[-5.35+sx*.55,1.35,zx]);
  for(const y of [.45,1.05,1.65,2.25]){box('shelf-beam',1.15,.04,.45,beamMat,[-5.35,y,zx]);}
  contact('shelf',1.3,.7,[-5.35,0,zx]);
 }
 const binGeo=new T.BoxGeometry(.32,.22,.38),binColors=[blueBin,greyBin,yellow,mat('#3a6a4a',.55,.15)];
 const binCounts=[0,0,0,0],binMeshes=binColors.map((m,i)=>{const im=new T.InstancedMesh(binGeo,m,16);im.name='workshop:parts-bin-'+i;im.castShadow=true;room.add(im);return im;});
 const pose=new T.Object3D();let bi=0;
 for(const zx of [-3.8,-1.6])for(const y of [.58,1.18,1.78,2.38])for(let col=0;col<3;col++){
  const kind=bi%4;pose.position.set(-5.55+col*.28,y,zx);pose.updateMatrix();
  binMeshes[kind].setMatrixAt(binCounts[kind]++,pose.matrix);bi++;
 }
 binMeshes.forEach((b,i)=>{b.count=binCounts[i];b.instanceMatrix.needsUpdate=true;});

 // Air compressor (no brand text)
 box('compressor-tank',1.15,.55,.55,black,[-4.6,.42,2.8]);
 const cEnd=mesh('compressor-end',new T.CylinderGeometry(.275,.275,.08,20),silver,[-5.2,.42,2.8]);cEnd.rotation.z=Math.PI/2;
 const cEnd2=mesh('compressor-end2',new T.CylinderGeometry(.275,.275,.08,20),silver,[-4.0,.42,2.8]);cEnd2.rotation.z=Math.PI/2;
 box('compressor-motor',.45,.35,.4,dark,[-4.3,.7,2.8]);
 const cw=mesh('comp-wheel',new T.CylinderGeometry(.12,.12,.05,12),black,[-5.05,.12,3.05]);cw.rotation.z=Math.PI/2;
 const cw2=mesh('comp-wheel2',new T.CylinderGeometry(.12,.12,.05,12),black,[-4.15,.12,3.05]);cw2.rotation.z=Math.PI/2;
 contact('compressor',1.3,.75,[-4.6,0,2.8]);

 // Tyre rack
 box('tyre-rack',.08,1.6,.08,silver,[5.2,.85,1.5]);box('tyre-rack2',.08,1.6,.08,silver,[5.2,.85,2.6]);
 box('tyre-rail',.08,.06,1.2,silver,[5.2,1.5,2.05]);box('tyre-rail2',.08,.06,1.2,silver,[5.2,.4,2.05]);
 for(const z of [1.55,2.05,2.55])mesh('rack-tyre',new T.TorusGeometry(.32,.09,10,18),black,[5.05,.55,z]);
 contact('tyre-rack',.6,1.4,[5.2,0,2.05]);

 // Crates
 for(const [x,z] of [[-5.2,4.2],[-4.5,4.5],[4.8,-2.2]]){box('floor-crate',.45,.35,.4,wood,[x,.18,z]);contact('fc',.55,.5,[x,0,z]);}

 // Ivy
 const green=mat('#375e28',.76,.02),leafMat=mat('#639238',.68,.02),pot=mat('#35322e',.8,.08),leaves=[[],[]],leafPose=new T.Object3D();
 for(const side of [-1,1])for(const z of [-4.9,5.5]){
  const x=side*5.5;mesh('plant-pot',new T.CylinderGeometry(.15,.1,.2,12),pot,[x,2.6,z]);box('plant-bracket',.32,.03,.34,dark,[x,2.48,z]);
  for(let strand=0;strand<3;strand++){const dx=(strand-1)*.1,curve=new T.CatmullRomCurve3([new T.Vector3(x,2.68,z),new T.Vector3(x+dx,2.35,z+.12),new T.Vector3(x+dx*1.6,1.55,z+.14)]);const stem=mesh('ivy-stem',new T.TubeGeometry(curve,10,.007,4,false),green,[0,0,0]);stem.castShadow=false;for(let i=0;i<7;i++){leafPose.position.copy(curve.getPoint(i/7));leafPose.scale.set(.07,.09,.02);leafPose.rotation.set(.3,(i%2?1:-1)*.55,i%2?.6:-.6);leafPose.updateMatrix();leaves[i%2].push(leafPose.matrix.clone());}}
 }
 const leafGeometry=new T.SphereGeometry(1,6,5);for(let i=0;i<2;i++){const batch=new T.InstancedMesh(leafGeometry,i?green:leafMat,leaves[i].length||1);batch.name='workshop:ivy-'+i;leaves[i].forEach((m,j)=>batch.setMatrixAt(j,m));room.add(batch);}

 // --- FRONT WALL (opposite): roller door + lounge + helmet rack ---
 // Roller door (to garage)
 const doorGroup=new T.Group();doorGroup.name='workshop:roller-door';doorGroup.position.set(0,0,6.15);room.add(doorGroup);
 const doorMat=mat('#2a323e',.45,.55);
 for(let i=0;i<10;i++){const slat=new T.Mesh(new T.BoxGeometry(3.2,.28,.05),doorMat);slat.position.set(0,.35+i*.3,.02);slat.name='workshop:door-slat';doorGroup.add(slat);}
 box('door-frame-l',.12,3.2,.18,dark,[-1.7,1.6,6.15]);box('door-frame-r',.12,3.2,.18,dark,[1.7,1.6,6.15]);box('door-frame-t',3.5,.14,.18,dark,[0,3.25,6.15]);
 // Door hotspot marker (for raycast / UI)
 const hotspot=mesh('door-hotspot',new T.PlaneGeometry(3,2.8),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),[0,1.5,6.12]);hotspot.userData.wkDoor={id:'workshop-to-garage',target:'garage',from:'workshop'};hotspot.castShadow=false;

 // Lounge corner (right of door looking at front)
 box('lounge-couch',1.8,.45,.7,mat('#3a4558',.7,.05),[3.6,.35,5.3]);box('lounge-back',1.8,.55,.18,mat('#323c4e',.7,.05),[3.6,.7,5.55]);contact('couch',2,.9,[3.6,0,5.3]);
 const rugMat=mat('#4a3058',.85,.02);rugMat.emissive.set('#2a1840');rugMat.emissiveIntensity=.15;
 const rug=mesh('lounge-rug',new T.PlaneGeometry(2.2,1.4),rugMat,[3.5,.01,4.6]);rug.rotation.x=-Math.PI/2;rug.castShadow=false;
 box('tv-stand',1.1,.4,.4,dark,[3.6,.22,3.9]);box('tv',1.2,.7,.06,black,[3.6,.85,3.72]);
 const tvGlow=emissive('#6688aa',1.2);box('tv-screen',1.05,.55,.02,tvGlow,[3.6,.85,3.68]);

 // Helmet / jacket rack (left of door)
 box('gear-rack',.06,1.8,.06,silver,[-3.8,.95,5.5]);box('gear-rail',1.2,.04,.04,silver,[-3.8,1.7,5.5]);
 mesh('helmet',new T.SphereGeometry(.18,12,10),mat('#c42838',.4,.2),[-4.2,1.55,5.5]);
 mesh('helmet2',new T.SphereGeometry(.17,12,10),mat('#2a8acc',.4,.2),[-3.4,1.55,5.5]);
 box('jacket',.35,.7,.12,mat('#1a2030',.65,.1),[-3.8,.9,5.55]);contact('rack',1.4,.5,[-3.8,0,5.5]);

 // Outdoor exit stub (side door toward future skate park / race)
 const outsideDoor=mesh('outside-door-stub',new T.PlaneGeometry(1.4,2.2),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),[-5.95,1.2,4.2]);
 outsideDoor.rotation.y=Math.PI/2;outsideDoor.userData.wkDoor={id:'workshop-to-outside',target:'outside',from:'workshop',stub:true};outsideDoor.castShadow=false;
 box('outside-frame-l',.08,2.3,.12,dark,[-5.95,1.2,3.5]);box('outside-frame-r',.08,2.3,.12,dark,[-5.95,1.2,4.9]);box('outside-frame-t',.08,.1,1.5,dark,[-5.95,2.35,4.2]);
 const exitSign=emissive('#44ff88',1.5);box('exit-sign',.5,.14,.04,exitSign,[-5.9,2.5,4.2]);

 // Central lit turntable
 const turn=new T.Group();turn.name='workshop:turntable';turn.position.set(0,0,0);room.add(turn);
 const base=new T.Mesh(new T.CylinderGeometry(1.35,1.4,.08,48),black);base.position.y=.04;base.receiveShadow=true;base.castShadow=true;base.name='workshop:turn-base';turn.add(base);
 const ringMat=emissive('#ff8a3a',2.4);const ring=new T.Mesh(new T.TorusGeometry(1.28,.035,10,48),ringMat);ring.rotation.x=Math.PI/2;ring.position.y=.085;ring.name='workshop:turn-ring';turn.add(ring);
 const disc=new T.Mesh(new T.CylinderGeometry(1.2,1.2,.03,48),mat('#1a1e28',.35,.55));disc.position.y=.1;disc.name='workshop:turn-disc';turn.add(disc);
 contact('turntable',2.9,2.9,[0,0,0]);
 const turnLight=new T.PointLight('#ff9a50',5,4,2);turnLight.position.set(0,.3,0);addLight(turnLight);
 const hemi=new T.HemisphereLight('#9eb6ff','#1a1210',.55);addLight(hemi);
 const doorFill=new T.PointLight('#88aaff',10,14,2);doorFill.position.set(0,2.6,5.2);addLight(doorFill);

 // Floor + Reflector
 const grain=texture((c,n)=>{c.fillStyle='#2a2c34';c.fillRect(0,0,n,n);for(let i=0;i<22000;i++){const v=55+Math.floor(rnd()*40);c.fillStyle=`rgba(${v},${v},${v+4},.18)`;c.fillRect(rnd()*n,rnd()*n,2,1);}});
 grain.colorSpace=T.SRGBColorSpace;grain.repeat.set(8,8);
 let reflector;
 const soft=(()=>{try{const gl=renderer.getContext();const e=gl.getExtension('WEBGL_debug_renderer_info');const name=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):(gl.getParameter(gl.RENDERER)||'');return /swiftshader|software|llvmpipe|basic render/i.test(String(name));}catch{return true;}})();
 const reflectSupported=reflections&&!coarse&&!soft&&renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float');
 if(reflectSupported){const size=coarse?320:448;reflector=new Reflector(new T.PlaneGeometry(24,24),{textureWidth:size,textureHeight:size,color:'#6a6a78',clipBias:.003,multisample:0});reflector.name='workshop:floor-reflection';reflector.rotation.x=-Math.PI/2;reflector.position.y=-.016;room.add(reflector);}
 const concrete=mat('#3a3c44',.22,.18);concrete.map=grain;concrete.bumpMap=grain;concrete.bumpScale=.005;
 if(reflector){concrete.transparent=true;concrete.opacity=.82;concrete.depthWrite=false;}
 const floor=mesh('floor',new T.PlaneGeometry(24,24),concrete,[0,0,.4]);floor.rotation.x=-Math.PI/2;floor.castShadow=false;floor.renderOrder=1;
 floor.name='garage:floor'; // legacy test alias

 const doors=()=>[{id:'workshop-to-garage',target:'garage',from:'workshop',position:[0,1.5,6.15]},{id:'workshop-to-outside',target:'outside',from:'workshop',stub:true,position:[-5.95,1.2,4.2]}];

 return {
  room,lights,doors,
  state:()=>({worldRoom:true,id:'workshop',reflection:!!reflector,quality:coarse?'mobile':'desktop',theme:'workshop',doors:doors()}),
  setActive(on){room.visible=!!on;for(const l of lights)l.visible=!!on;},
  dispose(){const geometries=new Set(),materials=new Set();room.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material&&o!==reflector)for(const m of [].concat(o.material))materials.add(m);});room.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();if(scene.environment===target.texture){scene.environment=previous.environment;scene.background=previous.background;scene.fog=previous.fog;}target.dispose();reflector?.dispose();}
 };
}
