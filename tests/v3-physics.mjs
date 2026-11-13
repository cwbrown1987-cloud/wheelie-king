import assert from 'node:assert/strict';
import {makeV3Terrain,v3TerrainHeight,v3Biome,v3TrailZ} from '../ride-v3-world.js';
import {createV3Motorcycle,makeV3BikeState} from '../ride-bike3d.js';
import {createArcadeAssistant} from '../ride-arcade-assist.js';

const ter=makeV3Terrain();
assert.deepEqual(['forest','valley','desert'],[-630,150,700].map(v3Biome));
for(let x=-900;x<1700;x+=41)for(const z of [-120,-50,0,50,120]){
  const h=v3TerrainHeight(x,z);
  assert(Number.isFinite(h)&&Math.abs(h-ter.height(x,z))<1e-10);
  assert(Math.abs(ter.height(x+.02,z)-h)<.3,'terrain must be continuous at '+x+','+z);
  assert(Math.abs(ter.height(x,z+.02)-h)<.3,'terrain z continuity '+x+','+z);
}
assert.equal(ter.freeRoam,true);
const bikes={
  bmx:{mass:89,wb:1,comBack:.42,comH:.82,R:.25,travelR:.05,travelF:.05,power:250,torque:40,pedal:true,grip:.95,vmax:9,driveAxle:'rear',batteryWh:0},
  emoto:{mass:130,wb:1.3,comBack:.42,comH:.86,R:.33,travelR:.17,travelF:.18,power:5000,torque:130,grip:1,vmax:24,batteryWh:700,driveAxle:'rear'}
};
const finite=s=>['x','y','z','vx','vy','vz','wx','wz','yaw','pitch','roll','w','wYaw','wRoll'].every(k=>Number.isFinite(s[k]));
function simulate(P,scenario,{mode='original',steps=1200,seedX=-630}={}){
  const controller=createV3Motorcycle({P});
  const s=makeV3BikeState(P,ter,seedX,v3TrailZ(seedX));
  const arcade=createArcadeAssistant({mode});
  if(scenario==='air'){s.y+=5;s.vy=2;s.wx=8;s.vx=8;}
  let maxSpeed=0,maxRoll=0,minY=Infinity;
  for(let i=0;i<steps&&!s.crashed;i++){
    const t=i/120;
    const input={
      throttle:scenario==='rest'||scenario==='air'?0:scenario==='wheelie'?.9:P.pedal?.8:.6,
      brake:0,steer:scenario==='corner'?.25:0,
      lean:scenario==='wheelie'?.7:scenario==='air'?.4:0
    };
    controller.step(s,P,arcade.update(s,P,input,1/120,ter),1/120,ter);
    assert(finite(s),scenario+' state nonfinite @ '+t);
    minY=Math.min(s.y,minY);maxSpeed=Math.max(maxSpeed,Math.abs(s.vx));maxRoll=Math.max(maxRoll,Math.abs(s.roll));
  }
  return {s,maxSpeed,maxRoll,minY};
}
const idle=simulate(bikes.emoto,'rest');
assert.equal(idle.s.crashed,null);
assert(Math.abs(idle.s.x+630)<.15,'parked bike must not creep');
const ride=simulate(bikes.emoto,'cruise');
assert.equal(ride.s.crashed,null,'e-moto should travel on terrain');
assert(ride.maxSpeed>9,'motor should accelerate');
const turn=simulate(bikes.emoto,'corner');
assert.equal(turn.s.crashed,null,'medium corner must stay upright');
assert(turn.maxRoll<1,'no runaway roll in normal corner');
const mono=simulate(bikes.emoto,'wheelie');
assert.equal(mono.s.crashed,null,'progressive wheelie should not spontaneously crash');
assert(mono.s.pitch>.15,'wheelie torque must raise front');
const bmx=simulate(bikes.bmx,'cruise');
assert.equal(bmx.s.crashed,null,'BMX must remain valid with its lighter frame');
assert(bmx.maxSpeed>2,'BMX should move');

const airOriginal=simulate(bikes.emoto,'air',{steps:120,mode:'original'});
const airArcade=simulate(bikes.emoto,'air',{steps:120,mode:'arcade'});
assert(airArcade.s.pitch>airOriginal.s.pitch,'air response must depend on assistance');
assert(airArcade.s.pitch<3,'air control should not instantly spin out of control');
console.log('PASS V3 world / BMX / e-moto / 3-axis dynamics / corner / wheelie / controlled air');
