import assert from 'node:assert/strict';
import {rideParameters} from '../ride-parameters.js';
import {makeState,makeFlatTerrain,step} from '../ride-physics.js';
import {VEHICLE_PARTS,VEHICLES,vehicleStats,vehicleReady} from '../vehicle-platforms.js';
const vehicleBuild=id=>Object.fromEntries(Object.keys(VEHICLES[id].components).map(slot=>[slot,slot==='frame'?id:id+'_'+slot]));
const parts={motor:{w:8000,nm:140,v:72,kind:'mid',nopedal:true},battery:{v:72,ah:50},fork:{travel:.15},shock:{travel:.12},petrol:{powertrain:'petrol',w:7500,nm:140,cc:125},tank:{litres:3},front:{w:100,v:36,kind:'front'}};
const find=id=>parts[id];
const anchors={wheelR:.265,frontAxle:[.72,.265],rearAxle:[-.53,.265]};
let p=rideParameters({kg:15,speed:18},{},anchors,find);assert(p.pedal);assert.equal(p.power,250);assert.equal(p.vmax,5);assert.equal(p.wb,1.25);assert.equal(p.batteryWh,0);
p=rideParameters({P:8000,nm:140,speed:72,kg:68},{motor:'motor',battery:'battery',suspension:'fork',rear_frame:'arm',shock:'shock'},anchors,find);assert(!p.pedal);assert.equal(p.mass,143);assert.equal(p.power,8000);assert.equal(p.vmax,20);assert.equal(p.batteryWh,3600);assert.equal(p.travelF,.15);assert.equal(p.travelR,.06);assert.equal(p.requestedTravelR,.12);
p=rideParameters({P:100,nm:0,speed:20},{motor:'front'},anchors,find);assert(!p.pedal);assert.equal(p.driveAxle,'front');assert.equal(p.power,100);assert.equal(p.torque,0);
p=rideParameters({speed:72},{motor:'petrol',fuel_tank:'tank'},anchors,find);assert(!p.pedal);assert.equal(p.powertrain,'petrol');assert.equal(p.power,7500);assert.equal(p.batteryWh,5340);
parts.empty={litres:0};p=rideParameters({P:0,nm:0,speed:0},{motor:'petrol',fuel_tank:'empty'},anchors,find);assert(!p.pedal);assert.equal(p.power,0);assert.equal(p.vmax,0);assert.equal(p.batteryWh,0);
// Wh capacity affects drain; fuel uses the same legacy fraction with explicit storage type.
const terrain=makeFlatTerrain();function consume(wh){const p=rideParameters({P:8000,nm:140},{motor:'motor',battery:'battery'},anchors,id=>id==='battery'?{v:72,ah:wh/72}:find(id)),s=makeState(p,2,terrain);for(let i=0;i<480;i++)step(s,p,{throttle:1,brake:0,lean:0},1/480,terrain);return 1-s.battery;}
assert(Math.abs(consume(720)/consume(1440)-2)<.001);
// Prototype stats retain stock values; actual sprockets affect torque and speed.
const catalogue=new Map(VEHICLE_PARTS.map(p=>[p.id,p]));globalThis.__WK_PART__=id=>catalogue.get(id?.split('__')[0]);
for(const id of ['pit125','kaiji_test']){const b=vehicleBuild(id),stats=vehicleStats(b);assert(vehicleReady(b,globalThis.__WK_PART__).ready);assert.equal(stats.P,VEHICLES[id].power);assert.equal(stats.speed,VEHICLES[id].speed);const rp=rideParameters(stats,b,anchors,globalThis.__WK_PART__);assert.equal(rp.powertrain,VEHICLES[id].powertrain);assert.equal(rp.vmax,stats.speed/3.6);assert.equal(rp.mass,stats.kg+75);}
const pit=vehicleBuild('pit125'),rear=catalogue.get(pit.sprocket_r),stock=vehicleStats(pit);catalogue.set(rear.id,{...rear,teeth:48});const short=vehicleStats(pit);assert(short.nm>stock.nm);assert(short.speed<stock.speed);
const scooter=vehicleBuild('kaiji_test'),battery=catalogue.get(scooter.battery);catalogue.set(battery.id,{...battery,v:36});assert.equal(vehicleReady(scooter,globalThis.__WK_PART__).ready,false);assert.equal(vehicleStats(scooter).P,0);catalogue.set(battery.id,{...battery,a:1});assert.equal(vehicleReady(scooter,globalThis.__WK_PART__).ready,false);
console.log('PASS powertrain classification, W/Nm/kg/m/s/Wh, effective speed, capacity drain, stock prototypes, gearing and electrical readiness');
