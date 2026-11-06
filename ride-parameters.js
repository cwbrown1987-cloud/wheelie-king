import {bikeParams} from './ride-physics.js';
// Workshop-to-ride boundary: W, game-effective Nm, kg, metres, seconds and Wh.
// Speed/range remain game estimates; petrol storage uses the existing 20% energy approximation.
export function rideParameters(stats={},build={},anchors={},find=()=>null){
 const motor=find(build.motor),battery=find(build.battery),tank=find(build.fuel_tank);
 const powertrain=motor?(motor.powertrain||'electric'):(stats.powertrain||(stats.P>0?'electric':'human'));
 const fuelLitres=Math.max(0,tank?.litres??stats.fuelLitres??0);
 const capacityWh=powertrain==='petrol'?fuelLitres*8900*.2:powertrain==='electric'?Math.max(0,battery?battery.v*battery.ah:0):0;
 const p=bikeParams({...stats,P:stats.P??motor?.w??0,powertrain,batteryWh:capacityWh,wheelR:anchors.wheelR??stats.wheelR});
 // One nominal drive-speed estimate. Gravity/downhill motion can exceed it.
 if(Number.isFinite(stats.speed)&&stats.speed>=0)p.vmax=stats.speed/3.6;
 if(anchors.frontAxle&&anchors.rearAxle)p.wb=Math.max(.6,anchors.frontAxle[0]-anchors.rearAxle[0]);
 p.comH=Math.max(p.R+.45,p.comH);p.driveAxle=motor?.kind==='front'?'front':'rear';
 if(p.pedal&&stats.gear?.g>0)p.torque*=stats.gear.g;
 p.travelF=Math.max(0,find(build.suspension)?.travel??stats.travel??0);
 p.requestedTravelR=build.rear_frame&&build.shock?Math.max(0,find(build.shock)?.travel??stats.shock??0):0;
 p.travelR=Math.min(.06,p.requestedTravelR); // Preserve existing rear-linkage simulation limit.
 p.fuelLitres=fuelLitres;p.energyType=powertrain;p.vehicleClass=anchors.vehicleClass||stats.vehicleClass||(motor?.nopedal?'emoto':motor?'ebike':'bicycle');
 return p;
}
