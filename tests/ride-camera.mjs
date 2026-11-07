import assert from 'node:assert/strict';
import {createSideCamera,SIDE_CAMERA} from '../ride-camera.js';
const G=SIDE_CAMERA.gravity;
// Simulated rider: flat run, then a jump with apex `h`, then flat again. Returns samples at fixed time.
function run(fps,{h=0,speed=12,reduceMotion=false}={}){
 const cam=createSideCamera(),dt=1/fps,y0=.95,vy0=h>0?Math.sqrt(2*G*h):0,tj=3,out=[];
 let x=0,y=y0,vy=0,t=0,air=false,done=false;
 for(let n=0;t<8-1e-9;n++,t=n*dt){
  if(!air&&!done&&t>=tj&&h>0){air=true;done=true;vy=vy0}
  if(air){vy-=G*dt;y+=vy*dt;if(y<=y0&&vy<0){y=y0;vy=0;air=false}}
  x+=speed*dt;
  const o=cam.update(dt,{x,y,vx:speed,vy:air?vy:0,speed:Math.hypot(speed,air?vy:0),grounded:!air,groundY:0,reduceMotion});
  out.push({t,x,y,o:{...o}});
 }
 return out;
}
const at=(a,t)=>a.reduce((b,s)=>Math.abs(s.t-t)<Math.abs(b.t-t)?s:b);
for(const s of run(60,{h:3}))for(const v of Object.values(s.o))assert.ok(Number.isFinite(v));
const flat=run(60),small=run(60,{h:.5}),big=run(60,{h:5});
const maxD=a=>Math.max(...a.map(s=>s.o.dist));
assert.ok(at(flat,2).o.dist<9,'close on the flat');
assert.ok(maxD(small)-maxD(flat)<.15,'small hops keep the close frame');
assert.ok(maxD(big)>maxD(flat)+1.5,'big jumps zoom out');
assert.ok(at(big,7.8).o.dist<maxD(big)-1,'zoom eases back in after landing');
// Zoom-out must lead the apex (predictive): distance already grown before the apex time.
const apexT=3+Math.sqrt(2*5/G);assert.ok(at(big,apexT-.2).o.dist>at(flat,apexT-.2).o.dist+1,'zoom is predictive');
// Bob exists on the ground, is bounded, fades in the air, and is off for reduced motion.
const bob=a=>{const v=a.filter(s=>s.t>1&&s.t<2.9).map(s=>s.o.bobY);return Math.max(...v)-Math.min(...v)};
assert.ok(bob(flat)>.02&&bob(flat)<.12,'bob amplitude sane '+bob(flat));
assert.equal(bob(run(60,{reduceMotion:true})),0,'reduced motion disables bob');
// Frame-rate independence: 30/60/144 fps agree within a few cm / cm-scale zoom.
const a30=run(30,{h:3}),a60=run(60,{h:3}),a144=run(144,{h:3});
for(const t of [2,3.5,4.5,6,7.5])for(const o of [a30,a144]){
 const A=at(a60,t),B=at(o,t);
 assert.ok(Math.abs(A.o.dist-B.o.dist)<.25,'dist fps t='+t+' '+A.o.dist+' '+B.o.dist);
 assert.ok(Math.abs((A.o.y-A.y)-(B.o.y-B.y))<.3,'y offset fps t='+t);
 assert.ok(Math.abs((A.o.x-A.x)-(B.o.x-B.x))<.1,'x offset fps t='+t);
}
// Camera stays near the rider (never loses it) through a big jump.
for(const s of big)assert.ok(Math.abs(s.o.x-s.x)<4.5&&Math.abs(s.o.y-s.y)<4.5,'rider stays framed t='+s.t);
// Teleport snaps, no long glide.
{const c=createSideCamera();c.update(.016,{x:0,y:1,vx:0,vy:0,speed:0,grounded:true,groundY:0});const o=c.update(.016,{x:500,y:1,vx:0,vy:0,speed:0,grounded:true,groundY:0});assert.ok(Math.abs(o.x-500)<1)}
// Landing kick: a hard landing moves the frame briefly, then settles.
{const c=createSideCamera(),i={x:0,y:1,vx:5,vy:0,speed:5,grounded:true,groundY:0};for(let n=0;n<60;n++)c.update(1/60,i);
 c.update(1/60,{...i,vy:-6,grounded:false});let m=0;for(let n=0;n<30;n++)m=Math.max(m,Math.abs(c.update(1/60,{...i,vy:0,grounded:true}).bobY));
 assert.ok(m>.03,'landing kick '+m);}
console.log('ride-camera: ok');
