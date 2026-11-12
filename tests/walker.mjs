// On foot: walk/run speeds, jump arc, slide burst and stop, ragdoll then get up, steps and posts block you.
import assert from 'node:assert/strict';
globalThis.fetch=()=>Promise.reject(new Error('no model in node'));
const T=await import('../vendor/three.module.js');
const {makeWalker,WALK}=await import('../rider-walker.js');
const ter={height:(x,z)=>x>20?1.0:0,posts:[{x:10,z:3,r:.5}]};
const w=makeWalker(T,new T.Group(),ter);await new Promise(r=>setTimeout(r,10));
w.spawn(0,0,0);const run=(sec,inp)=>{for(let t=0;t<sec;t+=1/60)w.update(1/60,typeof inp==='function'?inp(t):inp);};
run(2,{mx:1,mz:0});assert.ok(Math.abs(w.S.speed-WALK.walk)<.05,'walks at walking pace '+w.S.speed);
run(1.5,{mx:1,mz:0,run:true});assert.ok(Math.abs(w.S.speed-WALK.run)<.05,'runs '+w.S.speed);
// slide: a burst then slows to a stop-ish and stands back up
let maxSp=0;run(.05,{mx:1,run:true,slide:true});for(let t=0;t<1.2;t+=1/60){w.update(1/60,{mx:1,run:true});maxSp=Math.max(maxSp,w.S.speed);if(w.S.mode!=='slide')break;}
assert.ok(maxSp>WALK.run,'slide gives a burst');assert.equal(w.S.mode,'walk','slide ends');
// held slide keeps going while there's momentum (Fortnite style), then stands up by itself
w.spawn(-40,-40,0);run(1.5,{mx:1,mz:0,run:true});w.update(1/60,{mx:1,run:true,slide:true,slideHeld:true});let st=0;for(let t=0;t<6;t+=1/60){w.update(1/60,{mx:1,run:true,slideHeld:true});if(w.S.mode!=='slide')break;st+=1/60;}
assert.ok(st>3,'held slide lasts while momentum lasts ('+st.toFixed(2)+' s)');assert.equal(w.S.mode,'walk');
// jump arc
w.spawn(-20,-10,0);let peak=0,air=0;w.update(1/60,{jump:true});for(let t=0;t<2;t+=1/60){w.update(1/60,{});peak=Math.max(peak,w.S.y);if(!w.S.onG)air+=1/60;}
assert.ok(peak>1.1&&peak<1.6,'jump height '+peak.toFixed(2));assert.ok(air>.9&&air<1.2,'air time '+air.toFixed(2));
// a 1 m step stops you walking into it
w.spawn(18,-10,0);run(2,{mx:1,mz:0});assert.ok(w.S.x<20.1,'1 m step blocks');
// posts: you can't walk through a tree
w.spawn(6,3,0);run(3,{mx:1,mz:0});assert.ok(Math.hypot(w.S.x-10,w.S.z-3)>=.79,'tree blocks');
// ragdoll and get up
w.spawn(-5,-30,0);w.update(1/60,{ragdoll:true});assert.equal(w.S.mode,'ragdoll');run(7,{});assert.equal(w.S.mode,'walk','gets back up');
// falling off something high = ragdoll
const hi={height:(x,z)=>x<0?8:0,posts:[]};const w2=makeWalker(T,new T.Group(),hi);w2.spawn(-1,0,0);for(let t=0;t<2;t+=1/60){w2.update(1/60,{mx:1,run:true});}assert.equal(w2.S.mode,'ragdoll','big drop knocks you down');
console.log('walker: ok');
