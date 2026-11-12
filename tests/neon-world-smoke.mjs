// Neon Canal visuals build without throwing (a node smoke test with a stub canvas, so a typo in the world
// builder can't ship a level that fails to launch).
import assert from 'node:assert/strict';
const ctx=new Proxy({},{get:(t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:10}):()=>{} ,set:()=>true});
const el=()=>({width:0,height:0,style:{},getContext:()=>ctx,addEventListener(){},removeEventListener(){},setAttribute(){}});
globalThis.document={createElement:el,createElementNS:el};globalThis.self=globalThis;
const T=await import('../vendor/three.module.js');
const {makeNeonWorld}=await import('../ride-neon-world.js');
for(const lowDetail of [false,true]){const root=new T.Group();const w=makeNeonWorld(T,root,{lowDetail});
  let meshes=0;root.traverse(o=>{if(o.isMesh)meshes++;});assert.ok(meshes>40,'neon world has its meshes ('+meshes+')');
  w.update(.016);w.setView(1);w.setView(0);assert.equal(w.takeCoin(0),true);assert.equal(w.takeCoin(0),false);w.resetCoins();w.dispose();}
console.log('neon-world-smoke: ok');
