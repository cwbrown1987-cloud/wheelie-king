// Playground soccer: the ball rolls on the heightfield, the bike pushes it, a ball over the line scores
// (fireworks, ball back on the centre spot), and the goal frame stops the bike.
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {makeSoccer,SOCCER} from '../ride-soccer.js';
import {makePlaygroundTerrain,makeState,step,bikeParams} from '../ride-physics.js';
const ter=makePlaygroundTerrain(),scene=new T.Scene();let goals=0;
const soc=makeSoccer(T,scene,ter,{onGoal:n=>goals=n}),b=soc._ball,G=SOCCER.goal;
for(let i=0;i<360;i++)soc.step(1/60,null,null);
assert.ok(Math.abs(b.y-SOCCER.r)<.05,'ball settles on the ground '+b.y);
// a kicked ball rolls toward the goal and scores
Object.assign(b,{x:G.x-12,z:G.z,vx:9,vy:0,vz:0});for(let i=0;i<300&&!goals;i++)soc.step(1/60,null,null);
assert.equal(goals,1,'rolling into the net scores');assert.ok(soc.state().fireworks||soc.state().celebrating,'fireworks go up');
for(let i=0;i<300;i++)soc.step(1/60,null,null);
assert.ok(Math.hypot(b.x-SOCCER.centre.x,b.z-SOCCER.centre.z)<1,'ball back on the centre spot');
// wide of the post: no goal, it bounces off the post/net side
Object.assign(b,{x:G.x-10,z:G.z+G.halfW+.3,vx:9,vy:0,vz:0});for(let i=0;i<240;i++)soc.step(1/60,null,null);assert.equal(goals,1,'wide is not a goal');
// the bike pushes the ball
const P=bikeParams({kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15});soc.reset();for(let i=0;i<120;i++)soc.step(1/60,null,null);
const s=makeState(P,0,ter);Object.assign(s,{x:SOCCER.centre.x-8,z:SOCCER.centre.z,yaw:0,vx:9});s.y=ter.height(s.x,s.z)+s.y;
for(let i=0;i<120;i++){for(let k=0;k<8;k++)step(s,P,{throttle:s.vx<9?1:0,brake:0,lean:0,steer:0},1/480,ter);soc.step(1/60,s,P);}
assert.ok(soc.state().touches>0&&b.vx>3,'bike knocks the ball forward '+b.vx);assert.equal(s.crashed,null);
console.log('playground-soccer: ok',JSON.stringify(soc.state()));
// a hard miss over/beside the goal is caught by the net behind it
{soc.reset();for(let i=0;i<300;i++)soc.step(1/60,null,null);Object.assign(b,{x:G.x-6,z:G.z+G.halfW+4,y:3,vx:25,vy:3,vz:0});for(let i=0;i<300;i++)soc.step(1/60,null,null);assert.ok(b.x<SOCCER.fence.x+.01,'catch net stops a missed shot '+b.x);}
console.log('soccer net: ok');
