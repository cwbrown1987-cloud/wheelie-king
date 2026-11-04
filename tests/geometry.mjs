import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../vendor/three.module.js';
import { buildFrame } from '../frame-geometry.js';
import { hubMotor, hubFlange, useThree } from '../partmodels.js';
useThree(T);
let jointCount=0, boreCount=0;
// Anchors captured from the real app, across all eight catalog frame types.
const baseline=JSON.parse(readFileSync(new URL('./fixtures/frame-anchors.json',import.meta.url)));
for(const {frame,anchors:A} of baseline) {
 const root=new T.Group(), fr=new T.Group();fr.name='wk:frame';root.add(fr);
 fr.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:'red'})));
 const tr=['moto','emoto'].includes(frame)?.03:['bmx','mtb_rigid'].includes(frame)?.017:frame==='mtb_ht'?.021:.022;
 buildFrame(root,{htT:A.headTop,htB:A.headBottom,bb:A.bb,seat:A.seatTop,rear:A.rearAxle,tr},T,()=>fr,{frame});
 assert(fr.getObjectByName('frame:headTube'),frame);
 assert(fr.getObjectByName('frame:dropoutL'),frame);
 assert(fr.getObjectByName('frame:seatCollar'),frame);
 const materials=new Set();
 fr.traverse(o=>{
  if(o.isMesh) {
   assert(!materials.has(o.material),`${frame} ${o.name} shares material`);materials.add(o.material);
   assert([...o.geometry.getAttribute('position').array].every(Number.isFinite),`${frame} ${o.name}: nonfinite geometry`);
  }
  const j=o.userData.joint;if(!j)return;
  const tube=o.children.find(c=>c.geometry?.userData.wkTube);
  assert(tube.geometry.getAttribute('uv').count===tube.geometry.getAttribute('position').count);
  for(const [side,receiver] of [j.start,j.end].entries()) if(receiver) {
   const axis=new T.Vector3(...receiver.axis).normalize();
   for(const point of j.edges[side]) {
    const d=new T.Vector3(...point).sub(new T.Vector3(...receiver.point));d.addScaledVector(axis,-d.dot(axis));
    assert(Math.abs(d.length()-receiver.radius)<1e-6,`${frame} ${o.name} joint gap: ${d.length()-receiver.radius}`);
   }
   jointCount++;
  }
 });
}
for(const radius of [.09,.1,.13,.15,.17]) {
 const h=hubMotor({w:8000,kind:'rear'},{r:radius,wd:.09});
 for(const side of [-1,1]) {
  const flange=h.getObjectByName('hub:flange'+(side>0?'R':'L'));
  const profile=flange.geometry.parameters.shapes;
  assert.equal(profile.holes.length,19);
  for(let k=0;k<18;k++) {
   const a=(k+(side>0?.5:0))/18*Math.PI*2;
   const circle=profile.holes[k+1].curves[0];
   assert(Math.hypot(circle.aX-Math.cos(a)*(radius+.009),circle.aY-Math.sin(a)*(radius+.009))<1e-9);
   boreCount++;
  }
 }
}
for(const side of [-1,1]) assert.equal(hubFlange(.034,.03,side).geometry.parameters.shapes.holes.length,19);
console.log(JSON.stringify({frames:baseline.length,joints:jointCount,motorFlangeBores:boreCount,failures:0}));
