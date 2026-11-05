// Reusable articulated rider. Named pieces work from side and future chase cameras.
export function makeRider(T,body,bike,A,mechanical){
 const rider=new T.Group();rider.name='wk:rider';body.add(rider);
 const material=(color,roughness=.85)=>new T.MeshStandardMaterial({color,roughness});
 const blue=material('#1676d8'),cuff=material('#095295'),pants=material('#252a31'),black=material('#131b20'),sole=material('#d6dedb'),skin=material('#c9916c'),lime=material('#71df21',.48);
 const mesh=(name,geometry,mat,parent=rider)=>{const m=new T.Mesh(geometry,mat);m.name='rider:'+name;m.castShadow=true;parent.add(m);return m};
 const off=p=>new T.Vector3(p[0]+bike.position.x,p[1]+bike.position.y,0);
 const hip=off([A.seatTop[0],A.seatTop[1]+.085]),hand=off([A.headTop[0]-.04,A.headTop[1]+.2]),foot=off(A.bb),shoulder=new T.Vector3(.20,.43,0);
 const torso=new T.Group();torso.name='rider:torso';torso.position.copy(hip);rider.add(torso);
 // Shaped shoulders, waist and hem instead of a single capsule body.
 const vertices=[],indices=[],rings=[[0,.085,.095],[.06,.095,.11],[.22,.105,.135],[.37,.09,.155],[.43,.075,.145],[.46,.06,.105]],segments=16;
 for(const [y,depth,width]of rings)for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;vertices.push(y/shoulder.y*shoulder.x+Math.cos(a)*depth,y,Math.sin(a)*width)}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c)}
 for(let i=1;i<segments-1;i++){indices.push(0,i+1,i);const n=(rings.length-1)*segments;indices.push(n,n+i,n+i+1)}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();mesh('hoodie',geo,blue,torso);
 const box=(name,size,mat,position,parent=torso)=>{const m=mesh(name,new T.BoxGeometry(...size),mat,parent);m.position.set(...position);return m};
 box('hoodie-hem',[.15,.035,.21],cuff,[.025,.018,0]);
 for(const side of [-1,1]){const seam=box('pocket-seam'+side,[.008,.08,.006],cuff,[.15,.17,side*.07]);seam.rotation.z=-.7;const cord=box('hood-cord'+side,[.006,.095,.006],sole,[.27,.34,side*.035]);cord.rotation.z=.3}
 const hood=mesh('hood',new T.SphereGeometry(.105,16,10),cuff,torso);hood.scale.set(.75,.65,1.05);hood.position.copy(shoulder).add(new T.Vector3(-.025,.035,0));
 const neck=mesh('neck',new T.CylinderGeometry(.042,.045,.08,12),skin,torso);neck.position.copy(shoulder).add(new T.Vector3(.03,.065,0));
 const headCenter=shoulder.clone().add(new T.Vector3(.04,.17,0)),head=mesh('face',new T.SphereGeometry(.103,16,12),skin,torso);head.scale.set(.88,1,.86);head.position.copy(headCenter);
 const helmet=mesh('helmet-shell',new T.SphereGeometry(.12,20,12,0,Math.PI*2,0,Math.PI*.61),lime,torso);helmet.position.copy(headCenter).add(new T.Vector3(-.006,.022,0));helmet.scale.z=.94;
 const brim=box('helmet-peak',[.11,.018,.18],lime,[headCenter.x+.095,headCenter.y+.06,0]);brim.rotation.z=-.08;
 const nose=mesh('nose',new T.SphereGeometry(.023,8,6),skin,torso);nose.position.copy(headCenter).add(new T.Vector3(.083,-.015,0));nose.scale.set(1,.8,.65);
 const glasses=mesh('goggles',new T.CapsuleGeometry(.021,.115,4,10),black,torso);glasses.rotation.x=Math.PI/2;glasses.position.copy(headCenter).add(new T.Vector3(.077,.018,0));
 for(const side of [-1,1]){box('helmet-strap'+side,[.008,.105,.009],black,[headCenter.x+.01,headCenter.y-.026,side*.081]);const vent=box('helmet-vent'+side,[.065,.007,.018],black,[headCenter.x-.015,headCenter.y+.135,side*.039]);vent.rotation.z=.1}
 function segment(name,r1,r2,mat,parent=rider){return mesh(name,new T.CylinderGeometry(r1,r2,1,12),mat,parent)}
 function pose(m,a,b){const d=b.clone().sub(a);m.position.copy(a).addScaledVector(d,.5);m.scale.y=d.length();m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize())}
 const arms=[],legs=[];
 for(const side of [-1,1]){
  const upper=segment('sleeve-upper'+side,.061,.05,blue,torso),lower=segment('sleeve-lower'+side,.049,.034,blue,torso),elbow=mesh('elbow'+side,new T.SphereGeometry(.049,10,8),blue,torso),glove=mesh('glove'+side,new T.SphereGeometry(.043,10,8),black,torso);glove.scale.set(1,.8,.8);arms.push({side,upper,lower,elbow,glove});
  const thigh=segment('trousers-thigh'+side,.065,.051,pants),shin=segment('trousers-shin'+side,.05,.033,pants),knee=mesh('knee'+side,new T.SphereGeometry(.052,10,8),pants),shoe=new T.Group();shoe.name='rider:shoe'+side;rider.add(shoe);
  const top=mesh('shoe-upper'+side,new T.CapsuleGeometry(.035,.095,4,10),black,shoe);top.rotation.z=Math.PI/2;top.scale.z=1.05;top.position.set(.035,-.015,0);box('shoe-sole'+side,[.17,.016,.078],sole,[.035,-.044,0],shoe);box('shoe-stripe'+side,[.055,.018,.081],sole,[.03,-.011,0],shoe);legs.push({side,thigh,shin,knee,shoe});
 }
 let count=0;rider.traverse(o=>{if(o.isMesh)count++});
 return {root:rider,update({lean=0,crashed=false,superman=0}={}){
  torso.rotation.z=lean*.23+(crashed?.6:0)-superman*.9;
  const localHand=hand.clone().sub(torso.position).applyAxisAngle(new T.Vector3(0,0,1),-torso.rotation.z);
  for(const a of arms){const sh=shoulder.clone().setZ(a.side*.135),h=localHand.clone().setZ(a.side*.18),el=sh.clone().lerp(h,.5).add(new T.Vector3(-.045,-.07,a.side*.025));pose(a.upper,sh,el);pose(a.lower,el,h);a.elbow.position.copy(el);a.glove.position.copy(h)}
  const pedal=!!bike.getObjectByName('cranks:rotor'),angle=mechanical?.state.crankPhase||0;
  for(const l of legs){const h=hip.clone().setZ(l.side*.075),f=pedal?off([A.bb[0]+Math.cos(angle)*l.side*.14,A.bb[1]+Math.sin(angle)*l.side*.14]).setZ(l.side*.12):foot.clone().add(new T.Vector3(-.03,-.025,l.side*.145));f.lerp(new T.Vector3(hip.x-.55,hip.y+.03,l.side*.12),superman);const d=f.clone().sub(h),distance=d.length(),u=d.normalize(),k=h.clone().addScaledVector(u,distance/2).addScaledVector(new T.Vector3(-u.y,u.x,0),Math.sqrt(Math.max(.001,.31**2-(distance/2)**2))*(1-superman*.85));pose(l.thigh,h,k);pose(l.shin,k,f);l.knee.position.copy(k);l.shoe.position.copy(f);l.shoe.rotation.z=-superman*.35}
 },state:()=>({meshes:count,geometryCount:new Set([...arms.flatMap(a=>[a.upper.geometry,a.lower.geometry]),...legs.flatMap(l=>[l.thigh.geometry,l.shin.geometry])]).size,style:'hoodie-helmet-trainers'})};
}
