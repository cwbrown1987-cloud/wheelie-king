// Original game furniture: smooth powder-coated steel, brushed fittings and neon trim.
export function furnitureModel(T,style){
 const root=new T.Group();root.name='furniture:'+style;if(style==='toolbox')root.rotation.y=Math.PI;
 const material=(color,metalness=.5,roughness=.3)=>new T.MeshStandardMaterial({color,metalness,roughness});
 const steel=material('#243242',.75),silver=material('#a7bbc8',.88,.23),rubber=material('#101722',.05,.8),paint=material('#a62c50',.45,.25),glow=material('#71efcf',.25);
 glow.emissive.set('#2ad6ac');glow.emissiveIntensity=.7;
 const mesh=(name,g,m,p)=>{const o=new T.Mesh(g,m);o.name=root.name+':'+name;o.position.set(...p);o.castShadow=o.receiveShadow=true;root.add(o);return o};
 const box=(name,w,h,d,m,p,bevel=.008)=>{const shape=new T.Shape(),r=Math.min(bevel,w/5,h/5),x=-w/2,y=-h/2;shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);const g=new T.ExtrudeGeometry(shape,{depth:Math.max(.002,d-r*2),bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:2,steps:1,curveSegments:3});g.translate(0,0,-d/2+r);return mesh(name,g,m,p)};
 const cyl=(name,r,h,m,p)=>mesh(name,new T.CylinderGeometry(r,r,h,20),m,p);
 if(style==='shelf'){
  for(const x of [-.6,.6])for(const z of [-.25,.25]){box('upright',.035,1.85,.035,steel,[x,.96,z]);cyl('adjustable-foot',.038,.045,rubber,[x,.027,z]);for(const y of [.35,.8,1.25,1.7]){const bolt=cyl('hex-fastener',.009,.012,silver,[x,y,z-.025]);bolt.rotation.x=Math.PI/2;}}
  for(const y of [.18,.72,1.26,1.8]){box('shelf-edge',1.25,.055,.55,steel,[0,y,0]);box('shelf-inlay',1.16,.012,.47,rubber,[0,y+.035,0]);box('shelf-light',1.12,.012,.012,glow,[0,y-.025,-.26]);}
  for(const side of [-1,1]){const brace=box('cross-brace',.018,1.66,.012,silver,[side*.1,.98,.255],.003);brace.rotation.z=side*.56;}
 }else{
  box('cabinet',1.22,.72,.60,paint,[0,.48,0],.025);box('rubber-worktop',1.28,.045,.65,rubber,[0,.87,0],.015);box('worktop-rim',1.29,.018,.66,silver,[0,.846,0],.008);
  for(let i=0;i<6;i++){const y=.19+i*.105;box('drawer',1.12,.087,.035,steel,[0,y,-.315]);box('drawer-inset',1.06,.064,.012,paint,[0,y,-.34]);box('pull-handle',.89,.023,.035,silver,[0,y+.018,-.365],.005);}
  for(const x of [-.49,.49])for(const z of [-.20,.20]){cyl('caster-pivot',.024,.055,silver,[x,.10,z]);const wheel=cyl('rubber-caster',.065,.045,rubber,[x,.065,z]);wheel.rotation.z=Math.PI/2;const hub=cyl('caster-hub',.025,.052,silver,[x,.065,z]);hub.rotation.z=Math.PI/2;}
  for(const x of [-.54,.54])box('bumper',.035,.64,.055,rubber,[x,.48,-.34]);box('status-light',.16,.012,.012,glow,[.40,.79,-.32]);
  for(let i=0;i<7;i++)box('side-vent',.01,.015,.23,rubber,[.621,.24+i*.045,0],.002);
  const lock=cyl('lock',.012,.012,silver,[-.46,.79,-.325]);lock.rotation.x=Math.PI/2;
 }
 return root;
}
