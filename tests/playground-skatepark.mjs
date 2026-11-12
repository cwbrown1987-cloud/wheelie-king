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
{let top=0;const s=ride({x:PARK.x,z:PARK.z+13,yaw:-Math.PI/2},8,3.5,s=>{top=Math.max(top,ter.height(s.x,s.z))});assert.equal(s.crashed,null,'funbox ride');assert.ok(top>1.4,'went up onto the funbox deck '+top);assert.ok(s.z<PARK.z-4,'and over it '+s.z);}
// quarter pipe on the west wall: ride west into it, go up the transition
for(const v of [7,10,13]){let maxY=0;const s=ride({x:PARK.x-14,z:PARK.z,yaw:Math.PI},v,5,s=>{maxY=Math.max(maxY,s.y)});
  // v2.1-29: transitions are ridden as curves: the bike goes up the quarter, and comes back down it or lands on the deck
  assert.equal(s.crashed,null,'quarter pipe at '+v+' m/s: no crash');assert.ok(maxY>(v>9?2.6:1.6),'rode up the quarter pipe at '+v+': '+maxY.toFixed(2));
  assert.ok(Math.abs(s.x-PARK.x)<PARK.hx-.5,'still in the park (back down the quarter or on the deck) '+(s.x-PARK.x).toFixed(1));}
// the deck height in the middle of the funbox matches the model (ramp top 0.3 x 3.5 m)
assert.ok(Math.abs(parkHeight(PARK.x,PARK.z+.5*5.25)-1.575)<.1,'funbox deck height '+parkHeight(PARK.x,PARK.z+2.6));
assert.ok(PARK_ENTRY.z>PARK.z+PARK.hz,'entry ring outside the park');
console.log('playground-skatepark: ok');
