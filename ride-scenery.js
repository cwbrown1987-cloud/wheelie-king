// Three clear depth layers: static skyline, textured ride surface, near concrete lip.
export function roadLayers(T,scene,pts,topGeometry){
 let seed=73;const random=()=>((seed=seed*16807%2147483647)/2147483647);
 function texture(foreground=false){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');x.fillStyle=foreground?'#6a6376':'#565166';x.fillRect(0,0,512,256);
  for(let i=0;i<24000;i++){const grey=Math.floor(40+random()*80);x.fillStyle=`rgba(${grey},${grey+4},${grey+10},.12)`;x.fillRect(random()*512,random()*256,.5+random(),.5+random())}
  x.strokeStyle=foreground?'#111721':'#373b48';x.lineWidth=2;x.beginPath();x.moveTo(0,0);x.lineTo(512,0);x.moveTo(256,0);x.lineTo(254,256);x.stroke();
  for(let i=0;i<8;i++){let a=random()*512,b=random()*256;x.beginPath();x.moveTo(a,b);for(let j=0;j<5;j++){a+=random()*20-10;b+=random()*14;x.lineTo(a,b)}x.strokeStyle='#242a3544';x.lineWidth=1;x.stroke()}
  if(foreground){x.fillStyle='#9991a5';x.fillRect(0,0,512,13);x.fillStyle='#54d5fa';x.fillRect(0,13,512,4);x.fillStyle='#be6be7';for(let i=0;i<3;i++){const a=55+i*38;x.beginPath();x.moveTo(a,92);x.lineTo(a+22,116);x.lineTo(a,140);x.lineTo(a+12,140);x.lineTo(a+34,116);x.lineTo(a+12,92);x.fill()}}
  else{const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#7fe9ff28');g.addColorStop(.45,'#a9c8f305');g.addColorStop(1,'#fa89c42b');x.fillStyle=g;x.fillRect(0,0,512,256);x.fillStyle='#b5efffad';x.fillRect(0,12,512,2);x.fillStyle='#dd9cff8a';x.fillRect(0,242,512,2)}
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;
 }
 const topMap=texture(),uv=[];for(const [x]of pts)uv.push(x/8,1,x/8,0);topGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 const group=new T.Group();group.name='wk:foreground';const positions=[],coords=[],indices=[];
 pts.forEach(([x,y],i)=>{positions.push(x,y+.025,1.215,x,y-.36,1.215);coords.push(x/8,1,x/8,0);if(i<pts.length-1){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}});
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(coords,2));geo.setIndex(indices);geo.computeVertexNormals();
 const edge=new T.Mesh(geo,new T.MeshStandardMaterial({map:texture(true),roughness:.85,side:T.DoubleSide}));edge.name='wk:near-concrete-edge';edge.receiveShadow=true;group.add(edge);scene.add(group);
 return {topMap,foreground:group};
}
