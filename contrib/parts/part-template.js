// Example original rotor: geometry only, ready for adaptation and review.
export const metadata={id:'contrib_rotor_example',name:'Slotted rotor concept',category:'brakes',units:'metres',mount:{origin:[0,0,0],axis:[0,0,1]},dimensions:{diameter:.203,thickness:.002},provenance:'Original game concept; mounting dimensions are estimates.'};
// size is outer diameter in metres; diameter is a legacy alias. size takes precedence.
export function createPart(THREE,{size,diameter=.203,color='#aebbc4'}={}){
 diameter=size??diameter;
 const root=new THREE.Group();root.name='contrib:rotor';const metal=new THREE.MeshStandardMaterial({color,metalness:.8,roughness:.32}),radius=diameter/2,shape=new THREE.Shape();shape.absarc(0,0,radius,0,Math.PI*2,false);const centre=new THREE.Path();centre.absarc(0,0,.016,0,Math.PI*2,true);shape.holes.push(centre);
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=radius*.83,h=new THREE.Path();h.absellipse(Math.cos(a)*r,Math.sin(a)*r,.011,.0035,0,Math.PI*2,true,a+Math.PI/2);shape.holes.push(h);}
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.002,bevelEnabled:false,curveSegments:32});geo.translate(0,0,-.001);const ring=new THREE.Mesh(geo,metal);ring.name='rotor:slotted-disc';root.add(ring);root.userData.mount=metadata.mount;return root;
}
