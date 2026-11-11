// v34: ride profile = base + fitted parts. Swapping a part changes the derived mass, COM and
// spring values, and measurably changes the Jolt ride. Node only (no browser).
import assert from 'node:assert/strict';
import {deriveRideProfile} from '../ride-profile.js';
import {createJoltRide,joltSettingsFrom} from '../ride-jolt.js';

// Fixture parts: copied from the Garage catalogue (app.js) fields as-is, plus two new-style parts.
const CATALOGUE=[
  {id:'mmid6k',slot:'motor',kind:'mid',nopedal:true,v:60,w:6000,nm:250,kg:6.8},
  {id:'bbs02',slot:'motor',kind:'mid',v:48,w:750,nm:120,kg:4.5},
  {id:'hl36',slot:'battery',v:36,ah:13,kg:3.4},
  {id:'hl52',slot:'battery',v:52,ah:20,kg:5.4},
  {id:'dnm',slot:'suspension',travel:.18,damp:.55,kg:3.4},
  {id:'pike',slot:'suspension',travel:.14,damp:.5,kg:2.6},
  {id:'shk_coil150',slot:'shock',travel:.15,kg:1.1},
  {id:'shk_moto230',slot:'shock',travel:.23,kg:2.4},
  {id:'kenda',slot:'tyres',grip:1,kg:1.6},
  {id:'maxxisdh',slot:'tyres',grip:1.15,kg:2.4},
  {id:'rbmx',slot:'frame',kg:3},
  {id:'sticker_wombat',slot:'sticker',kg:0.01},                 // cosmetic: no ride block
  {id:'paint_red',slot:'paint'},                                 // cosmetic, no mass
  {id:'shk_race_coil',slot:'shock',kg:1.6,ride:{rearTravel:.15,rearSpringHz:3.2,rearDamping:.6}}, // new-style
  {id:'sticky_compound',slot:'tyre_compound',ride:{friction:1.2}},                                  // new slot, no code change
];
const find=id=>CATALOGUE.find(p=>p.id===id)||null;
const anchors={rearAxle:[-.62,.33],frontAxle:[.74,.33],wheelR:.33,bb:[0,.36],seatTop:[-.26,.86],headTop:[.55,.98],swingPivot:[-.05,.42]};
const RIDES={
  emoto:{build:{frame:'rbmx',motor:'mmid6k',battery:'hl52',suspension:'dnm',shock:'shk_moto230',tyres:'maxxisdh',sticker:['sticker_wombat']},stats:{kg:62},base:{torque:250,power:6000,vmax:80/3.6,comBack:.45,comH:.9}},
  ebike:{build:{frame:'rbmx',motor:'bbs02',battery:'hl36',suspension:'pike',shock:'shk_coil150',tyres:'kenda'},stats:{kg:32},base:{torque:120,power:750,vmax:32/3.6,comBack:.42,comH:.92}},
};
const prof=(ride,swap={},kgDelta=0)=>{const r=RIDES[ride];const build={...r.build,...swap};
  // the garage's stats.kg is the whole bike: keep it consistent with the swapped parts
  const partKg=b=>Object.values(b).flat().reduce((a,id)=>a+(find(id)?.kg||0),0);
  return deriveRideProfile({stats:{kg:r.stats.kg-partKg(r.build)+partKg(build)+kgDelta},build,find,anchors,base:r.base});};
async function drive(profile){
  const P={R:profile.wheelR,wb:profile.wheelbase,comBack:profile.comBack,comH:profile.comH};
  const j=createJoltRide({P,profile});await j.start();assert(j.ready,j.error);
  const s={x:0,z:0,yaw:0,vx:0};j.adopt(s);const dt=1/60;
  for(let i=0;i<60;i++)j.step(s,P,{},dt);
  const rest=j.dump();if(!rest.contact.rear||!rest.contact.front)throw Error("no contact "+JSON.stringify({profile:{...profile,parts:0},restY:j.restY,y:rest.y,pitch:s.pitch,roll:s.joltRoll}));const sag={rear:rest.contact.rear.susp,front:rest.contact.front.susp};
  let t=0,t20=null;while(s.vx<30/3.6&&t<15){j.step(s,P,{throttle:1},dt);t+=dt;if(t20==null&&s.vx>=20/3.6)t20=t;}
  for(let i=0;i<30;i++)j.step(s,P,{},dt);
  const x0=s.x,v0=s.vx;let n=0,pitchMin=0;while(s.vx>0.1&&n<900){j.step(s,P,{brake:1},dt);n++;pitchMin=Math.min(pitchMin,s.pitch);}
  let top=0;const k=createJoltRide({P,profile});await k.start();const s2={x:0,z:0,yaw:0,vx:0};k.adopt(s2);for(let i=0;i<60*25;i++){k.step(s2,P,{throttle:1},dt);top=Math.max(top,s2.vx);}
  j.dispose();k.dispose();
  return {t0_20:t20,t0_30:t,stopFrom:v0*3.6,stopM:s.x-x0,diveDeg:-pitchMin*180/Math.PI,sag,topKmh:top*3.6};
}
const out={};
for(const ride of Object.keys(RIDES)){const p=prof(ride);const C=joltSettingsFrom(p,{});out[ride]={mass:p.mass,comBack:p.comBack,comH:p.comH,frontHz:C.front.hz,rearHz:C.rear.hz,friction:p.friction,parts:p.parts.length,ride:await drive(p)};}
// 1) heavier battery: hl36 -> hl52 on the e-bike
const b0=prof('ebike'),b1=prof('ebike',{battery:'hl52'});
assert.equal(+(b1.mass-b0.mass).toFixed(3),2,'battery +2 kg');
assert(b1.comBack!==b0.comBack&&b1.comH!==b0.comH,'battery moves the COM');
// 2) shock swap: 150 mm coil -> 230 mm moto shock (softer, longer)
const s0=prof('ebike'),s1=prof('ebike',{shock:'shk_moto230'});
const C0=joltSettingsFrom(s0,{}),C1=joltSettingsFrom(s1,{});
assert(C1.rear.travel>C0.rear.travel&&C1.rear.hz<C0.rear.hz,'longer shock is softer');
// 3) new-style part with an explicit ride block overrides the derived spring
const s2=prof('ebike',{shock:'shk_race_coil'}),C2=joltSettingsFrom(s2,{});
assert.equal(C2.rear.hz,3.2);assert.equal(C2.rear.damping,.6);
// 4) cosmetic parts: only their mass, no ride keys
const c0=prof('emoto'),c1=prof('emoto',{paint:'paint_red'});
assert.equal(c1.mass,c0.mass);assert.deepEqual(c1.extra,c0.extra);
assert(c0.parts.find(p=>p.id==='sticker_wombat').cosmetic,'sticker is cosmetic');
// 5) a brand-new slot with a ride block multiplies tyre grip, no code change
const f1=prof('emoto',{tyre_compound:'sticky_compound'});
assert.equal(+f1.friction.toFixed(3),+(1.15*1.2).toFixed(3));
// ride differences, measured in Jolt
const rb0=await drive(b0),rb1=await drive(b1),rs1=await drive(s1),rs2=await drive(s2),rf1=await drive(f1);
out.swaps={
  battery_hl36_to_hl52:{dMass:b1.mass-b0.mass,dComBack:b1.comBack-b0.comBack,dComH:b1.comH-b0.comH,t0_20:[rb0.t0_20,rb1.t0_20]},
  shock_coil150_to_moto230:{hz:[C0.rear.hz,C1.rear.hz],travel:[C0.rear.travel,C1.rear.travel],restRearSusp:[rb0.sag.rear,rs1.sag.rear],dive:[rb0.diveDeg,rs1.diveDeg]},
  shock_to_race_coil_3_2Hz:{restRearSusp:[rb0.sag.rear,rs2.sag.rear]},
  sticky_compound:{friction:[c0.friction,f1.friction],stopM:[out.emoto.ride.stopM*(30/out.emoto.ride.stopFrom)**2,rf1.stopM*(30/rf1.stopFrom)**2]},
};
console.log(JSON.stringify(out,(k,v)=>typeof v==='number'?+v.toFixed(3):v,1));
assert(rb1.t0_20>rb0.t0_20,'heavier battery is slower to 30');
assert(Math.abs(rs1.sag.rear-rb0.sag.rear)>0.01,'shock swap changes rear ride height');
assert(Math.abs(rs2.sag.rear-rb0.sag.rear)>0.005,'race coil changes rear ride height');
assert(out.swaps.sticky_compound.stopM[1]<out.swaps.sticky_compound.stopM[0],'more grip stops shorter');
assert(out.emoto.ride.topKmh>40&&out.emoto.ride.topKmh<=81,'e-moto kit top speed over 25 km/h, capped by its 80 km/h');
assert(out.ebike.ride.topKmh>18&&out.ebike.ride.topKmh<=33,'e-bike top speed under its 32 km/h');
console.log('v34-parts ok');
