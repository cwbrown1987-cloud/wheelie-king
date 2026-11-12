// Playground soccer: the ball rolls on the heightfield, the bike pushes it, a ball over either goal line
// scores (fireworks, ball back on the centre spot), catch nets stop misses, and a ball over a net or off the
// side of the pitch respawns at the centre.
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {makeSoccer,SOCCER,GOALS} from '../ride-soccer.js';
import {makePlaygroundTerrain,makeState,step,bikeParams} from '../ride-physics.js';
const ter=makePlaygroundTerrain(),scene=new T.Scene();let goals=0,last=null;
const soc=makeSoccer(T,scene,ter,{onGoal:(n,id)=>{goals=n;last=id;}}),b=soc._ball,GG=SOCCER.goal,F=SOCCER.fence;
const run=(n,s,P)=>{for(let i=0;i<n;i++)soc.step(1/60,s||null,P||null);};
const atCentre=()=>Math.hypot(b.x-SOCCER.centre.x,b.z-SOCCER.centre.z)<1;
run(360);assert.ok(Math.abs(b.y-SOCCER.r)<.05,'ball settles on the ground '+b.y);
for(const g of GOALS){const before=goals;soc.reset();run(200);Object.assign(b,{x:g.x-g.dir*12,z:g.z,vx:9*g.dir,vy:0,vz:0});for(let i=0;i<300&&goals===before;i++)run(1);
  assert.equal(goals,before+1,g.id+' goal scores');assert.equal(last,g.id);assert.ok(soc.state().fireworks||soc.state().celebrating,'fireworks go up');run(300);assert.ok(atCentre(),'ball back on the centre spot after '+g.id);}
// a hard miss beside the goal is caught by the catch net
{const g=GOALS[0];soc.reset();run(200);Object.assign(b,{x:g.x-6,z:g.z+GG.halfW+4,y:3,vx:25,vy:3,vz:0});run(120);assert.ok(b.x<g.x+F.back+.01,'catch net stops a missed shot '+b.x);}
// over the top of the catch net -> respawn at the centre
{const g=GOALS[1],r0=soc.state().respawns;Object.assign(b,{x:g.x+5,z:g.z,y:12,vx:-30,vy:6,vz:0});run(240);assert.ok(soc.state().respawns>r0,'over the net respawns');}
// off the side of the pitch -> respawn
{const r0=soc.state().respawns;Object.assign(b,{x:SOCCER.centre.x,z:SOCCER.centre.z+SOCCER.halfWidth+40,y:1,vx:0,vy:0,vz:0});run(5);assert.ok(soc.state().respawns>r0&&atCentre(),'off the pitch respawns');}
// the bike pushes the ball
const P=bikeParams({kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15});soc.reset();run(120);
const s=makeState(P,0,ter);Object.assign(s,{x:SOCCER.centre.x-8,z:SOCCER.centre.z,yaw:0,vx:9});s.y=ter.height(s.x,s.z)+s.y;
for(let i=0;i<120;i++){for(let k=0;k<8;k++)step(s,P,{throttle:s.vx<9?1:0,brake:0,lean:0,steer:0},1/480,ter);soc.step(1/60,s,P);}
assert.ok(soc.state().touches>0&&b.vx>3,'bike knocks the ball forward '+b.vx);assert.equal(s.crashed,null);
console.log('playground-soccer: ok',JSON.stringify(soc.state()));
