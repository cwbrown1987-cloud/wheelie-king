// Skate park: collision comes from the pieces' own shapes. Ride the funbox (up, deck, down), into a quarter
// pipe (ride up, come back down or launch), and a box side or rail stops you like a wall.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadPark,parkHeight,PARK,PARK_ENTRY} from '../ride-skatepark.js';
import {makePlaygroundTerrain,makeState,step,bikeParams} from '../ride-physics.js';
await loadPark(async(f,bin)=>{const b=await readFile(new URL('../assets/kenney/mini-skate/'+f,import.meta.url));return bin?b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength):JSON.parse(b)});
const ter=makePlaygroundTerrain(),P=bikeParams({kg:55,P:3000,nm:150,wb:1.25,wheelR:.33,travel:.15,shock:.15}),D={throttle:0,brake:0,lean:0,steer:0};
const ride=(pose,v,sec,cb)=>{const s=makeState(P,0,ter),y0=s.y;Object.assign(s,pose);s.y=ter.height(s.x,s.z)+y0;s.vx=v;for(let i=0;i<sec*60&&!s.crashed;i++){for(let k=0;k<8;k++)step(s,P,{...D,throttle:s.vx<v?.6:0},1/480,ter);cb?.(s)}return s;};
// funbox: ride north (-z) over it
{let top=0;const s=ride({x:PARK.x,z:PARK.z+9,yaw:-Math.PI/2},7,3,s=>{top=Math.max(top,ter.height(s.x,s.z))});assert.equal(s.crashed,null,'funbox ride');assert.ok(top>.9,'went up onto the funbox deck '+top);assert.ok(s.z<PARK.z-3,'and over it '+s.z);}
// quarter pipe on the west wall: ride west into it, go up the transition
{let maxY=0;const s=ride({x:PARK.x-12,z:PARK.z,yaw:Math.PI},8,3,s=>{maxY=Math.max(maxY,s.y)});assert.ok(maxY>1.8,'rode up the quarter pipe '+maxY);}
// the deck height in the middle of the funbox matches the model (ramp top 0.3 x 3.5 m)
assert.ok(Math.abs(parkHeight(PARK.x,PARK.z+.5*3.5)-1.05)<.08,'funbox deck height '+parkHeight(PARK.x,PARK.z+1.75));
assert.ok(PARK_ENTRY.z>PARK.z+19,'entry ring outside the park');
console.log('playground-skatepark: ok');
