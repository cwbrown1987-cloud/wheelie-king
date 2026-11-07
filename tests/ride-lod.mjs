import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {decimateGrid,simpleRotor,lightenForRide} from '../ride-lod.js';
// 65x65 grid like the helmet, both windings
function grid(lens){const n=65,p=[],idx=[];for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=i/(n-1)*Math.PI*1.5,y=j/(n-1)-.5;p.push(Math.cos(a)*.1,y*.2,Math.sin(a)*.1)}
 for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const a=j*n+i,b=a+1,c=a+n,d=c+1;if(lens)idx.push(a,b,c,b,d,c);else idx.push(a,c,b,b,c,d)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g}
const faceN=(g,t)=>{const i=g.index.array,P=g.attributes.position,v=k=>new T.Vector3().fromBufferAttribute(P,i[t*3+k]);const a=v(0),b=v(1),c=v(2);return b.sub(a).cross(c.sub(a)).normalize()};
for(const lens of [false,true]){const g=grid(lens),d=decimateGrid(T,g);assert.equal(d.index.count/3,2048);
 assert.ok(faceN(g,0).dot(faceN(d,0))>.9,'winding kept '+lens);
 g.computeBoundingBox();d.computeBoundingBox();assert.ok(g.boundingBox.min.distanceTo(d.boundingBox.min)<1e-6&&g.boundingBox.max.distanceTo(d.boundingBox.max)<1e-6,'same extents');}
assert.equal(decimateGrid(T,new T.SphereGeometry(1,8,6)),null,'non-grid geometry is left alone');
// rotor
const sh=new T.Shape();sh.absarc(0,0,.1,0,Math.PI*2,false);const ih=new T.Path();ih.absarc(0,0,.074,0,Math.PI*2,true);sh.holes.push(ih);
for(let k=0;k<24;k++){const a=k/24*Math.PI*2,h=new T.Path();h.absarc(Math.cos(a)*.088,Math.sin(a)*.088,.0028,0,Math.PI*2,true);sh.holes.push(h)}
const rotor=new T.ExtrudeGeometry(sh,{depth:.0022,bevelEnabled:false,curveSegments:20}),simple=simpleRotor(T,rotor);
rotor.computeBoundingBox();simple.computeBoundingBox();
assert.ok(rotor.boundingBox.min.distanceTo(simple.boundingBox.min)<1e-4&&rotor.boundingBox.max.distanceTo(simple.boundingBox.max)<1e-4,'rotor same size');
assert.ok(simple.attributes.position.count/3<rotor.attributes.position.count/3/10,'rotor much lighter');
// scene pass: swaps by name, keeps garage geometry untouched
const root=new T.Group(),shell=new T.Mesh(grid(false),new T.MeshStandardMaterial());shell.name='gear:helmet:shell';const disc=new T.Mesh(rotor,new T.MeshStandardMaterial());disc.name='brake:rotor';
const other=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());other.name='frame';root.add(shell,disc,other);const keep=shell.geometry,keepOther=other.geometry;
const st=lightenForRide(T,root);assert.equal(st.swapped,2);assert.ok(st.after<st.before/3);assert.equal(keep.index.count,24576,'original untouched');assert.equal(other.geometry,keepOther);
console.log('ride-lod: ok',st.before,'->',st.after,'tris');
