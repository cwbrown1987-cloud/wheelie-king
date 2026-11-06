import {RoomEnvironment} from './vendor/RoomEnvironment.js';
// Physical room geometry shares the camera with the vehicles; nothing is a camera-facing backdrop.
export function garageRoom(T,scene,renderer){
 scene.background=new T.Color('#101727');scene.fog=new T.Fog('#101727',18,35);
 const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment(renderer),target=pmrem.fromScene(environment,.04);scene.environment=target.texture;environment.dispose?.();pmrem.dispose();
 const room=new T.Group();room.name='garage:fixed-room';scene.add(room);
 const mat=(color,roughness=.55,metalness=.08)=>new T.MeshStandardMaterial({color,roughness,metalness,envMapIntensity:.45});
 const mesh=(name,geo,m,p)=>{const o=new T.Mesh(geo,m);o.name='garage:'+name;o.position.set(...p);o.receiveShadow=true;room.add(o);return o};
 const box=(name,w,h,d,m,p)=>mesh(name,new T.BoxGeometry(w,h,d),m,p);
 const concrete=mat('#303844',.24,.24),white=mat('#434c60',.33,.22),dark=mat('#161d2b',.4,.4);
 const floor=mesh('floor',new T.PlaneGeometry(30,30),concrete,[0,0,0]);floor.rotation.x=-Math.PI/2;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#343648';ctx.fillRect(0,0,512,512);ctx.strokeStyle='#222535';ctx.lineWidth=2;for(let row=0;row<8;row++){const y=row*64;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();for(let col=-1;col<5;col++){const x=col*128+(row%2)*64;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+64);ctx.stroke()}}const bricks=new T.CanvasTexture(canvas);bricks.colorSpace=T.SRGBColorSpace;bricks.wrapS=bricks.wrapT=T.RepeatWrapping;bricks.repeat.set(3,1.5);const wall=mat('#a3a7bd',.8,.02);wall.map=bricks;
 mesh('back-wall',new T.PlaneGeometry(10,4.5),wall,[0,2.25,-3.8]);
 mesh('left-wall',new T.PlaneGeometry(10,4.5),white,[-5,2.25,1.2]).rotation.y=Math.PI/2;mesh('right-wall',new T.PlaneGeometry(10,4.5),white,[5,2.25,1.2]).rotation.y=-Math.PI/2;
 for(const z of [-3.7,-1,1.8,4.6])box('ceiling-beam',10,.10,.09,dark,[0,4.45,z]);for(const x of [-4.9,0,4.9])box('ceiling-rail',.09,.10,10,dark,[x,4.45,1]);
 for(const [x,color]of [[-3,'#b35cff'],[0,'#71efff'],[3,'#b35cff']]){const m=mat(color,.3);m.emissive.set(color);m.emissiveIntensity=1.5;box('accent-light',1.8,.025,.06,m,[x,3.85,-3.6]);}
 for(const x of [-4,4]){box('cabinet',1.30,.9,.70,dark,[x,.45,-1.7]);box('cabinet-top',1.36,.05,.76,white,[x,.925,-1.7]);for(const y of [1.45,1.95]){box('display-shelf',1.36,.035,.55,white,[x,y,-1.85]);for(const dx of [-.45,.45])box('shelf-bracket',.025,.20,.035,dark,[x+dx,y-.1,-2.1]);}for(const dx of [-.33,.33])box('cabinet-door',.60,.74,.018,white,[x+dx,.45,-1.34]);}
 // Wall details and lights stay in room coordinates while the camera orbits.
 const cyan=mat('#2be4f5',.3);cyan.emissive.set('#16a4cb');cyan.emissiveIntensity=2;
 const purple=mat('#9f43ff',.3);purple.emissive.set('#6a22ca');purple.emissiveIntensity=2;
 for(const x of [-4.85,4.85]){box('wall-upright',.16,4.3,.2,dark,[x,2.15,-3.65]);box('vertical-neon',.025,2.8,.025,x<0?purple:cyan,[x,2.1,-3.52]);}
 for(const x of [-2.8,0,2.8]){box('lower-wall-panel',2.65,1.05,.08,dark,[x,.54,-3.7]);box('neon-trim',2.6,.025,.02,x<0?purple:cyan,[x,1.1,-3.64]);}
 const red=mat('#762a46',.35,.35);box('tool-chest',2.2,.95,.65,red,[0,.475,-3.3]);for(const y of [.18,.38,.58,.78]){box('drawer',2.05,.16,.025,dark,[0,y,-2.96]);box('drawer-handle',1.5,.02,.03,white,[0,y+.02,-2.93]);}
 box('worktop',2.3,.05,.72,white,[0,.98,-3.3]);
 for(const x of [-3.2,3.2]){const light=new T.PointLight(x<0?'#9250ff':'#37d4ff',12,8,2);light.position.set(x,2.7,-2.8);room.add(light);}
 return {room,dispose(){bricks.dispose();target.dispose()}};
}
