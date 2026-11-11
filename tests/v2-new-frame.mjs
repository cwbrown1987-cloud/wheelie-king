// v2.0: a new frame is a data entry. A made-up frame (catalogue row + anchor data, no code, no mesh)
// derives a ride profile and drives the full Jolt feature set: ride, wheelie toggle, burnout, rewind/drop-in.
import assert from 'node:assert/strict';
import {deriveRideProfile} from '../ride-profile.js';
import {createJoltRide} from '../ride-jolt.js';
const CATALOGUE=[
  {id:'frame_newdesign_x9',slot:'frame',kg:4.2,com:[-.05,.5],ride:{wheelbase:1.22}},   // the new design: data only
  {id:'bbs02',slot:'motor',kind:'mid',v:48,w:750,nm:120,kg:4.5},
  {id:'hl36',slot:'battery',v:36,ah:13,kg:3.4},
  {id:'pike',slot:'suspension',travel:.14,damp:.5,kg:2.6},
  {id:'shk_coil150',slot:'shock',travel:.15,kg:1.1},
  {id:'kenda',slot:'tyres',grip:1,kg:1.6},
];
const find=id=>CATALOGUE.find(p=>p.id===id)||null;
// Anchors as the frame-geometry data supplies them (seat, pegs/BB, bars, hubs). Different numbers from any shipped frame.
const anchors={rearAxle:[-.55,.31],frontAxle:[.67,.31],wheelR:.31,bb:[0,.33],seatTop:[-.22,.82],headTop:[.5,.95],swingPivot:[-.04,.4]};
const build={frame:'frame_newdesign_x9',motor:'bbs02',battery:'hl36',suspension:'pike',shock:'shk_coil150',tyres:'kenda'};
const base={torque:120,power:750,vmax:32/3.6,comBack:.4,comH:.9,R:.31};
const profile=deriveRideProfile({stats:{kg:30},build,find,anchors,base});
for(const k of ['mass','comBack','comH','wheelbase','wheelR'])assert(Number.isFinite(profile[k]),'profile.'+k+' '+JSON.stringify(profile));
assert(Math.abs(profile.wheelbase-1.22)<1e-6,'frame ride block sets the wheelbase');
assert(Math.abs(profile.wheelR-.31)<.02,'hubs/wheel radius come from anchor data');
const P={R:profile.wheelR,wb:profile.wheelbase,comBack:profile.comBack,comH:profile.comH},dt=1/60;
const j=createJoltRide({P,profile});await j.start();
const s={x:0,z:0,yaw:0,vx:0,events:[]};j.adopt(s);
for(let i=0;i<60;i++)j.step(s,P,{},dt);
assert(!s.crashed&&Math.abs(s.pitch)<.1,'stands at rest');
for(let i=0;i<180;i++)j.step(s,P,{throttle:1},dt);
const v=s.vx;assert(v>4,'drives '+v);
const snap=j.snapshot(),x0=s.x;
// 750 W pedal-assist: lift at walking pace with the toggle + lean back (power-limited higher up, as in life)
for(let i=0;i<120&&s.vx>2;i++)j.step(s,P,{brake:.6},dt);
let lifted=false;for(let i=0;i<90&&!lifted;i++){j.step(s,P,{mono:true,throttle:1,lean:1},dt);if(!s.ground[1]&&s.pitch>.15)lifted=true;}
assert(lifted,'wheelie toggle lifts the front '+JSON.stringify({vx:s.vx,pitch:s.pitch,ground:s.ground,mass:profile.mass,comBack:profile.comBack,comH:profile.comH}));
j.restore(snap,s);assert(Math.abs(s.x-x0)<1e-3,'rewind restores the snapshot');
for(let i=0;i<120;i++)j.step(s,P,{},dt);assert(!s.crashed&&Math.abs(s.pitch)<.26,'upright after rewind');
const b=createJoltRide({P,profile});await b.start();const s2={x:0,z:0,yaw:0,vx:0,events:[]};b.adopt(s2);
for(let i=0;i<120;i++)b.step(s2,P,{throttle:1,brake:1},dt);assert(s2.burnout&&Math.abs(s2.vx)<.5,'burnout in place');
// Forward-compat (data only): a future pegs part moves the stand attach point; damage fields pass through.
CATALOGUE.push({id:'pegs_tall',slot:'pegs',kg:.4,attach:{pegs:[.02,.45]},durability:100,damagedVisual:'pegs_tall_bent'});
const withPegs=deriveRideProfile({stats:{kg:30.4},build:{...build,pegs:'pegs_tall'},find,anchors,base});
assert.deepEqual(withPegs.attach.pegs,[.02,.45],'pegs attach point comes from the part');
assert(withPegs.standRise>profile.standRise,'taller pegs raise the standing rider');
const pp=withPegs.parts.find(p=>p.slot==='pegs');assert(pp.durability===100&&pp.damagedVisual==='pegs_tall_bent','damage fields pass through');
// impact telemetry: drop from 0.6 m
const k=createJoltRide({P,profile});await k.start();const s3={x:0,z:0,yaw:0,vx:0,events:[]};k.adopt(s3);for(let i=0;i<30;i++)k.step(s3,P,{},dt);
const sn=k.snapshot();sn.p[1]+=.6;sn.v=[0,0,0];k.restore(sn,s3);let peak=0;for(let i=0;i<90;i++){k.step(s3,P,{},dt);peak=Math.max(peak,s3.impactN);}
assert(peak>profile.mass*9.81*.5&&Number.isFinite(s3.impactPeakN),'landing shows an impact force '+peak);
console.log(JSON.stringify({impactPeak:peak,standRise:[profile.standRise,withPegs.standRise],profile:{mass:profile.mass,comBack:profile.comBack,comH:profile.comH,wheelbase:profile.wheelbase},v}));console.log('v2-new-frame ok');
