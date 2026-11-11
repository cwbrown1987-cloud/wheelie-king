// TEST ARENA: a big flat square for free-roam speed, wheelies, burnouts and jumps.
// Painted skyline stays the far backdrop in ride.js. No checkpoints or finish.

const HALF=150;

export function makeArenaWorld(T,scene,terrain,{lowDetail=false}={}){
  const root=new T.Group();root.name='wk:environment';root.userData.arena=true;scene.add(root);
  const sharedTex=[],sharedMat=[],sharedGeo=[];
  const mat=(color,more={})=>{const m=new T.MeshStandardMaterial({color,roughness:.88,...more});sharedMat.push(m);return m};
  const canvasTex=(draw,w=512,h=512)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;t.repeat.set(30,30);sharedTex.push(t);return t};
  const grid=canvasTex((g,w,h)=>{
    g.fillStyle='#3a3b44';g.fillRect(0,0,w,h);
    for(let i=0;i<w;i++){const n=(Math.sin(i*12.9898)*43758.5453)%1;g.fillStyle=`rgba(0,0,0,${0.04+Math.abs(n)*0.08})`;g.fillRect(i,0,1,h);}
    g.strokeStyle='#2a2b32';g.lineWidth=6;g.beginPath();
    for(let i=0;i<=8;i++){const p=i*w/8;g.moveTo(p,0);g.lineTo(p,h);g.moveTo(0,p);g.lineTo(w,p);}g.stroke();
    g.strokeStyle='#c9c28a';g.lineWidth=3;g.setLineDash([28,22]);
    g.beginPath();g.moveTo(w/2,0);g.lineTo(w/2,h);g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
    g.setLineDash([]);g.strokeStyle='#d7d0a4';g.lineWidth=2;
    g.strokeRect(10,10,w-20,h-20);
  });
  const asphalt=mat('#44454f',{map:grid,roughness:.72});
  const segs=lowDetail?80:150;
  const floor=new T.Mesh(new T.PlaneGeometry(HALF*2,HALF*2,segs,segs),asphalt);
  floor.rotation.x=-Math.PI/2;floor.name='environment:arena-floor';floor.receiveShadow=true;
  const pos=floor.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getY(i); // plane is in XY before rotation; Y becomes -Z after rotX
    pos.setZ(i,terrain.height(x,-z));
  }
  floor.geometry.computeVertexNormals();sharedGeo.push(floor.geometry);root.add(floor);

  const wallMat=mat('#6d6874',{roughness:.9});
  const wallH=2.6,thick=1.4,span=HALF*2+thick;
  const box=new T.BoxGeometry(1,1,1);sharedGeo.push(box);
  const wall=(x,z,sx,sz,name)=>{const o=new T.Mesh(box,wallMat);o.position.set(x,wallH/2,z);o.scale.set(sx,wallH,sz);o.name=name;o.castShadow=o.receiveShadow=true;root.add(o);};
  wall(0,-HALF,span,thick,'environment:arena-wall-south');
  wall(0,HALF,span,thick,'environment:arena-wall-north');
  wall(-HALF,0,thick,span,'environment:arena-wall-west');
  wall(HALF,0,thick,span,'environment:arena-wall-east');

  return {
    roadMap:grid,
    update(){},
    view(){},
    state:()=>({arena:true,sample3d:false,midground:false,size:HALF*2,jumps:(terrain.kickers||[]).length,bounds:terrain.bounds}),
    dispose(){sharedTex.forEach(t=>t.dispose());sharedMat.forEach(m=>m.dispose());sharedGeo.forEach(g=>g.dispose());root.removeFromParent();}
  };
}
