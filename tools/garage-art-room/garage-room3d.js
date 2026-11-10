// PROTOTYPE (garage art-room concept): served in place of /garage-room3d.js by proto.mjs.
// Chris's showroom picture (icons/showroom-background.webp -> garage-art.jpg, prop pixels in-painted)
// is projected from the picture's own camera onto the walls, ceiling and floor; the picture's
// free-standing props are modelled from the kit where they stand in it. Same API as the original.
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {createKit} from './src/props/kit/index.js';
export const SHOW={W:1672,H:941,F:752.5,CX:836,CY:401,X0:-.6,H0:.94,ZP:5.5,CEIL:3.68,LEFTX:-6,RIGHTX:6,BACKZ:-4.5,FRONTZ:6.5};
const LIGHTS=[ // [pos, colour, intensity, radius]: the picture's neon strips + warm pendants, continued round the room
 [[-2.9,3.5,-1.6],'#c25cff',1.25,3.2],[[-.6,3.5,-1.4],'#52e6ff',1.1,3.0],[[2.1,3.5,-1.6],'#c25cff',1.25,3.2],
 [[-5.6,3.2,-1.2],'#c25cff',1.0,2.6],[[5.6,3.2,-1.4],'#c25cff',.9,2.6],
 [[-4.23,3.05,-4.2],'#ffcf8a',1.0,1.6],[[-.6,3.05,-4.2],'#ffcf8a',1.0,1.6],[[3.1,3.05,-4.2],'#ffcf8a',1.0,1.6],[[5.7,3.05,-.3],'#ffcf8a',.8,1.4],
 [[-2.9,3.5,3.2],'#c25cff',1.1,3.0],[[-.6,3.5,3.2],'#52e6ff',1.0,3.0],[[2.1,3.5,3.2],'#c25cff',1.1,3.0],[[-5.7,3.05,3.6],'#ffcf8a',.8,1.4],[[5.7,3.05,3.6],'#ffcf8a',.8,1.4]];
const ASSET=p=>new URL('./'+p,import.meta.url).href;
function registerGarageParts(kit){
 const {T}=kit,G=kit.geo,add=(g,geo,m,p=[0,0,0])=>{const o=new T.Mesh(geo,m);o.position.set(...p);g.add(o);return o;};
 const grp=(type,p,size)=>{const g=new T.Group();g.name='kit:'+type;g.userData.kit={type,params:p,size};return g;};
 kit.register('cabinetUnit',(p={})=>{ // two-door base / tall cabinet; origin bottom-back-centre, front +Z
  const w=p.width??.65,h=p.height??.86,d=p.depth??.55,doors=p.doors??2,S=kit.skin({body:{preset:'steel',color:'#3a3e48',metalness:.45,roughness:.42},door:{preset:'steel',color:'#454a55',metalness:.4,roughness:.38},handle:'brushed',kick:'darkSteel'},p.skin);
  const g=grp('cabinetUnit',p,[w,h,d]);add(g,G.rbox(w,h-.06,d,.01),S('body'),[0,(h-.06)/2+.06,d/2]);add(g,G.rbox(w-.02,.06,d-.04,.004),S('kick'),[0,.03,d/2-.02]);
  const dw=(w-.03)/doors;for(let i=0;i<doors;i++){const x=-w/2+.015+dw*(i+.5);add(g,G.rbox(dw-.012,h-.1,.018,.004),S('door'),[x,(h-.1)/2+.075,d+.009]);const hl=Math.min(.18,(h-.1)*.3);add(g,G.rbox(.016,hl,.02,.004),S('handle'),[x+(i%2?-1:1)*(dw/2-.05),h*(p.tall?.55:.78),d+.03]);}
  return g;},{category:'prop'});
 kit.register('cabinetRun',(p={})=>{ // n cabinets under a worktop with a warm LED strip
  const n=p.count??4,w=p.unitWidth??.65,h=p.height??.9,d=p.depth??.55,g=grp('cabinetRun',p,[n*w,h,d]);
  for(let i=0;i<n;i++){const c=kit.build('cabinetUnit',{width:w-.01,height:h-.045,depth:d-.03,skin:p.skin});c.position.set(-n*w/2+w*(i+.5),0,0);g.add(c);}
  const top=kit.build('benchTop',{width:n*w+.04,depth:d+.03,thickness:.045,skin:{top:{preset:'wood',color:'#8a6a45',roughness:.55},edge:{preset:'wood',color:'#6e5236'}}});top.position.set(0,h-.045,d+.015);g.add(top);
  const led=kit.build('neonTube',{length:n*w*.7,color:'#ffb25e',intensity:2.4});led.position.set(0,h+.012,.06);g.add(led);
  return g;},{category:'prop'});
 kit.register('wallShelf',(p={})=>{ // board on two steel brackets; origin at the wall, bottom of brackets
  const w=p.width??1.8,d=p.depth??.32,S=kit.skin({board:{preset:'wood',color:'#6c5440',roughness:.6},bracket:'darkSteel'},p.skin),g=grp('wallShelf',p,[w,.3,d]);
  add(g,G.rbox(w,.04,d,.006),S('board'),[0,.26,d/2]);for(const s of [-1,1]){add(g,G.rbox(.03,.26,.03,.004),S('bracket'),[s*w*.38,.13,.02]);const b=add(g,G.rbox(.025,.03,d*.8,.004),S('bracket'),[s*w*.38,.23,d*.4]);const k=add(g,G.rbox(.02,.02,d*.85,.003),S('bracket'),[s*w*.38,.13,d*.33]);k.rotation.x=-.75;}
  return g;},{category:'prop'});
 kit.register('storageBox',(p={})=>{const w=p.width??.6,h=p.height??.38,d=p.depth??.42,S=kit.skin({body:{preset:'plastic',color:'#4a4d57',roughness:.5},lid:{preset:'plastic',color:'#3d4049',roughness:.5},latch:{preset:'brushed',color:'#c9a24a'}},p.skin),g=grp('storageBox',p,[w,h,d]);
  add(g,G.rbox(w*.97,h-.04,d*.97,.02),S('body'),[0,(h-.04)/2,d/2]);add(g,G.rbox(w,.05,d,.015),S('lid'),[0,h-.025,d/2]);add(g,G.rbox(.12,.04,.012,.004),S('latch'),[0,h-.07,d+.004]);return g;},{category:'prop'});
}
export function garageLayout(){
 const {LEFTX,RIGHTX,BACKZ,CEIL}=SHOW,PI=Math.PI,L=[],put=(type,params,at,rotY=0,extra={})=>L.push({type,params,at,rotY,...extra});
 const left=(z,y,off)=>[LEFTX+off,y,z],right=(z,y,off)=>[RIGHTX-off,y,z];
 // left wall, as in the picture: two tool chests, cabinet run + worktop, wall shelf + plant, tall locker in the corner
 put('toolChest',{width:1.0,height:.84,depth:.55,casterRadius:.04,drawers:[.07,.07,.07,.09,.09,.12,.14],skin:{body:{preset:'steel',color:'#3b3f49',metalness:.5,roughness:.36},handle:'brushed',top:'darkSteel'}},left(-.02,0,0),PI/2);
 put('toolChest',{width:.7,height:.84,depth:.55,casterRadius:.04,drawers:[.07,.07,.07,.09,.12,.14,.14],sideHandles:false,skin:{body:{preset:'steel',color:'#3b3f49',metalness:.5,roughness:.36},handle:'brushed',top:'darkSteel'}},left(-.9,0,0),PI/2);
 put('cabinetRun',{count:4,unitWidth:.66,height:.92,depth:.56},left(-2.65,0,0),PI/2);
 put('cabinetUnit',{width:.7,height:1.9,depth:.5,tall:true},[-5.63,0,BACKZ],0);
 put('wallShelf',{width:2.2,depth:.33},left(-2.1,1.8,0),PI/2);
 put('vine',{length:.75,strands:5,spread:.55,seed:21},left(-3.1,2.15,.12),PI/2);
 put('vine',{length:2.4,strands:7,spread:.7,seed:33},left(.55,CEIL-.05,.05),PI/2);
 // right wall: open steel shelving with wood boards, storage boxes, two hanging plants
 put('shelfUnit',{width:2.25,height:2.2,depth:.45,style:'steel',levels:[.5,.95,1.58,2.15],skin:{board:{preset:'wood',color:'#6c5440',roughness:.6}}},right(-1.42,0,0),-PI/2);
 put('neonTube',{length:.7,color:'#ffb25e',intensity:2.6},right(-1.65,2.2,.25),-PI/2);
 put('storageBox',{width:.6,height:.38,depth:.42},right(-1.85,0,.02),-PI/2);
 put('storageBox',{width:.62,height:.36,depth:.42},right(-1.15,0,.02),-PI/2);
 put('vine',{length:.85,strands:6,spread:.6,seed:41},right(-2.35,2.62,.05),-PI/2);
 put('vine',{length:.65,strands:5,spread:.5,seed:43},right(-2.35,1.62,.05),-PI/2);
 put('vine',{length:1.1,strands:6,spread:.6,seed:47},right(.9,CEIL-.05,.05),-PI/2);
 // continuation (outside the picture): same showroom style on the side and front walls and ceiling
 for(const z of [1.4,4.4])put('beam',{length:12,depth:.22},[0,CEIL-.22,z],0);
 for(const z of [2.2,5.2])for(const s of [-1,1])put('beam',{length:CEIL-.05,depth:.14},[s*5.93,CEIL/2,z],0,{rot:[0,s<0?PI/2:-PI/2,PI/2]});
 for(const [x,c] of [[-2.9,'#c25cff'],[-.6,'#52e6ff'],[2.1,'#c25cff']])put('neonTube',{length:2.0,color:c,intensity:4},[x,CEIL-.03,3.2],0,{rot:[-PI/2,0,0]});
 for(const s of [-1,1])put('shopLight',{length:.5,drop:.25,color:'#ffcf8a'},[s*5.6,3.05,3.6],s<0?PI/2:-PI/2);
 put('vine',{length:1.6,strands:6,spread:.6,seed:53},left(5.6,CEIL-.05,.05),PI/2);
 put('vine',{length:1.4,strands:6,spread:.6,seed:57},right(5.4,CEIL-.05,.05),-PI/2);
 return L;
}
export function garageRoom(T,scene,renderer,{workshop=false,reflections=false,asSecondary=false,origin=null}={}){
 const previous={environment:scene.environment,background:scene.background,fog:scene.fog};
 if(!asSecondary){scene.background=new T.Color('#e9e6ee');scene.fog=new T.Fog('#e9e6ee',22,60);}
 const coarse=matchMedia('(pointer:coarse)').matches,S=SHOW;
 const room=new T.Group();room.name='garage:fixed-room';if(origin)room.position.set(...origin);scene.add(room);
 let target=null;
 if(!asSecondary){const pm=new T.PMREMGenerator(renderer),env=new RoomEnvironment(renderer);for(const [x,c] of [[-3,'#c25cff'],[0,'#52e6ff'],[3,'#c25cff']]){const s=new T.Mesh(new T.BoxGeometry(2,.025,.12),new T.MeshBasicMaterial({color:new T.Color(c).multiplyScalar(4)}));s.position.set(x,3.8,0);env.add(s);}target=pm.fromScene(env,.04);scene.environment=target.texture;env.dispose?.();pm.dispose();}
 const TL=new T.TextureLoader(),tex={art:TL.load(ASSET('assets/garage/garage-art.jpg')),brick:TL.load(ASSET('assets/garage/garage-brick.jpg')),con:TL.load(ASSET('assets/workshop/concrete.jpg'))};
 tex.art.colorSpace=T.NoColorSpace;tex.brick.colorSpace=T.NoColorSpace;tex.con.colorSpace=T.NoColorSpace;tex.brick.wrapS=tex.brick.wrapT=T.RepeatWrapping;tex.con.wrapS=tex.con.wrapT=T.MirroredRepeatWrapping;
 // projector = the picture's camera, in room-local space (shader works in local space via uInv)
 const pc=new T.PerspectiveCamera(),n=.05;pc.position.set(S.X0,S.H0,S.ZP);pc.updateMatrixWorld();pc.projectionMatrix.makePerspective(-S.CX/S.F*n,(S.W-S.CX)/S.F*n,S.CY/S.F*n,-(S.H-S.CY)/S.F*n,n,200);
 const projVP=new T.Matrix4().multiplyMatrices(pc.projectionMatrix,pc.matrixWorldInverse);
 const NL=LIGHTS.length,uLP=LIGHTS.map(l=>new T.Vector3(...l[0])),uLC=LIGHTS.map(l=>new T.Color().setStyle(l[1],T.NoColorSpace).multiplyScalar(l[2])),uLR=LIGHTS.map(l=>l[3]);
 const shared={uProjVP:{value:projVP},uArt:{value:tex.art},uLP:{value:uLP},uLC:{value:uLC},uLR:{value:uLR},uAmb:{value:new T.Color(.62,.6,.66)},uInv:{value:new T.Matrix4()},uProjPos:{value:pc.position.clone()},uOrigin:{value:new T.Vector3()}};
 const VS=`uniform mat4 uInv;varying vec3 vP;varying vec3 vN;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=(uInv*w).xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`;
 const LIT=`uniform vec3 uLP[${NL}];uniform vec3 uLC[${NL}];uniform float uLR[${NL}];uniform vec3 uAmb;uniform mat4 uProjVP;uniform sampler2D uArt;uniform vec3 uProjPos;varying vec3 vP;varying vec3 vN;
 vec3 lightAt(vec3 N,vec3 P){vec3 c=uAmb;for(int i=0;i<${NL};i++){vec3 L=uLP[i]-P;float d=length(L);L/=d;float f=1./(1.+pow(d/uLR[i],2.2));c+=uLC[i]*f*(.3+.7*max(dot(N,L),0.));}return c;}
 float proj(vec3 P,out vec2 uv){vec4 c=uProjVP*vec4(P,1.);uv=c.xy/c.w*.5+.5;if(c.w<=0.||uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)return 0.;return smoothstep(0.,.03,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));}`;
 const wallMat=new T.ShaderMaterial({vertexShader:VS,uniforms:{...shared,uB:{value:tex.brick}},fragmentShader:LIT+`uniform sampler2D uB;
  void main(){vec3 N=normalize(vN);vec2 t=abs(N.y)>.5?vP.xz:vec2(abs(N.x)>.5?vP.z:vP.x,vP.y);vec3 alb=abs(N.y)>.5?vec3(.14,.14,.17):texture2D(uB,t*.25).rgb;
   vec3 col=alb*lightAt(N,vP);vec2 uv;float e=proj(vP,uv);if(e>0.)col=mix(col,texture2D(uArt,uv).rgb,e);gl_FragColor=vec4(col,1.);}`});
 const floorMat=new T.ShaderMaterial({vertexShader:VS,uniforms:{...shared,uC:{value:tex.con}},fragmentShader:LIT+`uniform sampler2D uC;uniform vec3 uOrigin;
  void main(){vec3 N=vec3(0,1,0);float g=texture2D(uC,vP.xz*.23).r;vec3 col=vec3(.66,.64,.68)*(.9+.2*g)+(lightAt(N,vP)-uAmb)*.07;
   vec3 V=normalize(cameraPosition-uOrigin-vP);
   vec2 uv;float e=proj(vP,uv);
   if(e>0.){vec2 dC=normalize(vP.xz-(cameraPosition.xz-uOrigin.xz)+1e-4),dP=vP.xz-uProjPos.xz;float dist=length(dP);dP/=max(dist,1e-4);
    e*=smoothstep(.55,.9,dot(dC,dP))*(1.-smoothstep(9.,12.,dist))*smoothstep(.1,.26,V.y);col=mix(col,texture2D(uArt,uv).rgb,e);}
   float inside=step(-6.,vP.x)*step(vP.x,6.)*step(-4.5,vP.z)*step(vP.z,6.5);col=mix(vec3(.78,.78,.81),col,inside);
   gl_FragColor=vec4(col,1.);}`});
 const quad=(a,b,c,d)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([a,b,c,a,c,d].flat(),3));g.computeVertexNormals();return g;};
 const {LEFTX:L0,RIGHTX:R0,BACKZ:B,FRONTZ:Fz,CEIL:C}=S,shell=new T.Group();shell.name='garage:shell';room.add(shell);
 const face=(name,g,m)=>{const o=new T.Mesh(g,m);o.name='garage:'+name;shell.add(o);return o;};
 face('back-wall',quad([L0,0,B],[R0,0,B],[R0,C,B],[L0,C,B]),wallMat);face('left-wall',quad([L0,0,Fz],[L0,0,B],[L0,C,B],[L0,C,Fz]),wallMat);
 face('right-wall',quad([R0,0,B],[R0,0,Fz],[R0,C,Fz],[R0,C,B]),wallMat);face('front-wall',quad([R0,0,Fz],[L0,0,Fz],[L0,C,Fz],[R0,C,Fz]),wallMat);
 face('ceiling',quad([L0,C,B],[R0,C,B],[R0,C,Fz],[L0,C,Fz]),wallMat);
 const floor=face('floor',quad([-20,0,20],[20,0,20],[20,0,-20],[-20,0,-20]),floorMat);floor.renderOrder=0;
 const catcher=new T.Mesh(new T.PlaneGeometry(40,40),new T.ShadowMaterial({opacity:.22}));catcher.rotation.x=-Math.PI/2;catcher.position.y=.002;catcher.receiveShadow=true;catcher.name='garage:shadow-catcher';room.add(catcher);
 for(const o of shell.children)o.receiveShadow=false;
 // modelled props from the kit
 const kit=createKit(T);registerGarageParts(kit);const layout=garageLayout(),src=new T.Group();
 for(const e of layout){const o=kit.build(e.type,e.params||{});o.position.set(...e.at);if(e.rot)o.rotation.set(...e.rot);else o.rotation.y=e.rotY||0;src.add(o);}
 const baked=kit.bake(src);baked.name='garage:props';room.add(baked);baked.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
 const lights=[];for(const [p,c,i,r] of LIGHTS.slice(0,coarse?6:LIGHTS.length)){const l=new T.PointLight(c,i*6,r*4.5,1.6);l.position.set(...p);room.add(l);lights.push(l);}
 room.updateMatrixWorld(true);const inv=new T.Matrix4().copy(room.matrixWorld).invert();shared.uInv.value.copy(inv);shared.uOrigin.value.setFromMatrixPosition(room.matrixWorld);
 room.onBeforeRender=()=>{};
 const api={room,lights,shell:{projVP,props:baked,layout},state:()=>({worldRoom:true,reflection:false,quality:coarse?'mobile':'desktop',theme:workshop?'workshop':'showroom',art:'showroom',props:layout.length,propDrawCalls:baked.children.length}),setActive(on){room.visible=!!on;for(const l of lights)l.visible=!!on;},
  dispose(){room.removeFromParent();baked.userData.dispose?.();kit.dispose?.();shell.traverse(o=>o.geometry?.dispose());wallMat.dispose();floorMat.dispose();catcher.geometry.dispose();catcher.material.dispose();for(const t of Object.values(tex))t.dispose();if(target&&scene.environment===target.texture){scene.environment=previous.environment;scene.background=previous.background;scene.fog=previous.fog;}target?.dispose();}};
 if(!asSecondary)globalThis.__WK_GARAGE_ART__={...api,renderer};
 return api;
}
