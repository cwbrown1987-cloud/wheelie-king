// Playground track path math. v33f: side view is camera-only, so the old rail lock/return checks are gone (see v33f-controls).
import assert from 'node:assert/strict';
import {makeArenaTerrain} from '../ride-physics.js';
import {makeArenaTrack,easeInOut} from '../ride-track.js';

const track=makeArenaTrack();
assert(track.length>280,'track should span the arena, length='+track.length);
assert.equal(track.width,6);
for(const [x,z,name] of [[28,0,'small'],[70,22,'medium'],[115,0,'large']]){
  const n=track.nearest(x,z);
  assert(n.onTrack&&n.dist<1.2,name+' kicker should sit on the track '+JSON.stringify(n));
}
assert(!track.onTrack(0,40),'z=40 is off the strip');
const near=track.nearest(0,40);
assert(near.dist>30,'nearest to (0,40) should be around z=0, dist='+near.dist);
assert(Math.abs(near.x)<8&&Math.abs(near.z)<4,'projects to the centre line '+JSON.stringify(near));

const ter=makeArenaTerrain();
assert(ter.track,'terrain exposes the track');
assert(easeInOut(0)===0&&easeInOut(1)===1);
console.log(JSON.stringify({arenaTrack:true,length:track.length}));
