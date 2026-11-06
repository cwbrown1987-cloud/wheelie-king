// Prototype dimensions and performance are game estimates, not manufacturer specs.
// Add future models here: matching parts, named mounts, build and rider anchors.
export const VEHICLES={
 pit125:{name:'Outback 125 Test Bike',vehicleClass:'motorbike',powertrain:'petrol',cc:125,fuelLitres:3,forkTravel:.12,shockTravel:.09,wheelR:.265,wb:1.25,colour:'#ea503b',power:7500,torque:140,kg:68,comH:.84,comBack:.48,speed:72,range:65,
  geometry:R=>({rear:[-.53,R],front:[.72,R],bb:[-.02,.36],seat:[-.2,.71],htT:[.48,.81],htB:[.54,.62],tr:.025}),
  pivot:[-.07,.43],shockFrame:[-.13,.67],shockArm:[-.22,.44],feet:[-.10,.32],
  components:{frame:['Tubular Pit Bike Frame',8,650],motor:['125cc Single-cylinder Engine',19,800],fuel_tank:['3 L Fuel Tank',3,140],exhaust:['Pit Bike Exhaust',2.3,160],rear_frame:['Pit Bike Swingarm',3,220],shock:['Pit Bike Coil Shock',1.7,180],suspension:['Pit Bike Telescopic Fork',4.5,300],seat:['Pit Bike Bench Seat',1.2,100],fender_f:['Pit Bike Front Mudguard',.35,40],fender_r:['Pit Bike Rear Mudguard',.35,40],body_panels:['Pit Bike Plastics',1.4,120],bars:['Pit Bike Crossbar',.8,90],stem:['Pit Bike Bar Clamps',.4,70],headset:['Pit Bike Steering Bearings',.25,50],grips:['Pit Bike Grips',.15,25],tyres:['Pit Bike Knobbly Tyre Pair',3.6,180],rims:['Pit Bike Spoked Rim Pair',2.5,200],hubs:['Pit Bike Hub Pair',1.5,120],brakes:['Pit Bike Hydraulic Disc Set',1.5,160],throttle:['Pit Bike Twist Throttle',.2,45],pedals:['Pit Bike Folding Footpegs',.7,60],chain:['428 Drive Chain',.8,50],sprocket_f:['14T 428 Front Sprocket',.15,25],sprocket_r:['41T 428 Rear Sprocket',.35,45]}},
 kaiji_test:{name:'Kaabo Test E-Scooter',vehicleClass:'escooter',powertrain:'electric',forkTravel:.045,shockTravel:.04,wheelR:.14,wb:1.08,colour:'#52c9bc',power:1200,torque:36,kg:29,comH:.79,comBack:.48,speed:48,range:40,
  geometry:R=>({rear:[-.49,R],front:[.59,R],bb:[-.08,.23],seat:[-.15,.72],htT:[.35,1.06],htB:[.43,.43],tr:.026}),
  pivot:[-.29,.22],shockFrame:[-.25,.30],shockArm:[-.40,.23],feet:[-.10,.30],
  components:{frame:['Scooter Deck and Folding Stem',7.2,600],motor:['1200 W Rear Hub Motor',3.4,350],battery:['52 V 20 Ah Deck Battery',5.2,480],controller:['52 V Scooter Controller',.5,100],rear_frame:['Scooter Rear Swingarm',1.1,120],shock:['Scooter Rear Coil Shock',.6,80],suspension:['Scooter Telescopic Front Fork',1.4,170],bars:['Scooter T-bar',.6,70],stem:['Scooter Bar Clamp',.2,40],headset:['Scooter Steering Bearings',.15,35],grips:['Scooter Grips',.15,25],tyres:['11-inch Scooter Tyre Pair',1.8,120],rims:['11-inch Scooter Split Rims',1.2,140],hubs:['Scooter Axle and Front Hub',.7,80],brakes:['Scooter Hydraulic Disc Set',.8,130],throttle:['Scooter Thumb Throttle',.15,45],fender_r:['Scooter Rear Mudguard',.15,30],body_panels:['Scooter Deck Grip and Covers',.4,60],lights:['Scooter Headlight and Tail Light',.2,55]}}
};
export const prototypeFor=id=>VEHICLES[id?.split('__')[0]];
export const VEHICLE_PARTS=Object.entries(VEHICLES).flatMap(([family,v])=>Object.entries(v.components).map(([slot,[label,kg,price]])=>({
 id:slot==='frame'?family:family+'_'+slot,slot,name:label,family,vehicleClass:v.vehicleClass,prototype:true,real:false,kg,price,color:['frame','body_panels','fuel_tank','fender_f','fender_r'].includes(slot)?v.colour:slot==='rims'?'#a4afb5':'#252e37',
 ...(slot==='frame'?{fc:parseInt(v.colour.slice(1),16),maxW:v.power}:{}),
 ...(slot==='motor'?{w:v.power,nm:v.torque,kind:v.powertrain==='petrol'?'mid':'rear',nopedal:true,powertrain:v.powertrain,...(v.powertrain==='electric'?{v:52,drop:family}: {cc:v.cc,engineNm:9})}:{}),
 ...(slot==='fuel_tank'?{litres:v.fuelLitres}:{}),...(slot==='battery'?{v:52,ah:20,a:35,mount:'deck'}:{}),...(slot==='controller'?{v:52,a:30}:{}),
 ...(slot==='suspension'?{travel:v.forkTravel,damp:.5}:{}),...(slot==='shock'?{travel:v.shockTravel}:{}),
 ...(['rims','tyres'].includes(slot)?{size:family,grip:v.vehicleClass==='motorbike'?1.15:1}:{}),
 ...(slot==='sprocket_f'?{std:'428',teeth:14}:{}),...(slot==='sprocket_r'?{std:'428',teeth:41}:{}),...(slot==='chain'?{std:'428'}:{}),
 note:'Prototype game part. Fits the '+v.name+' platform only. Dimensions and performance are estimates.'
})));
export const VEHICLE_BUILDS=Object.fromEntries(Object.entries(VEHICLES).map(([family,v])=>[family,Object.fromEntries(Object.keys(v.components).map(slot=>[slot,slot==='frame'?family:family+'_'+slot]))]));
export function vehicleFit(build,p){
 if(!p||['frame','kit','sticker'].includes(p.slot))return null;
 const v=prototypeFor(build.frame);if(!v&&!p.prototype)return null;
 const family=build.frame?.split('__')[0];
 return v&&p.family===family?{status:'ok',adapters:[]}:{status:'no',adapters:[],reason:'Mounts do not match this vehicle platform'};
}
export function vehicleReady(build,find){
 const v=prototypeFor(build.frame);if(!v)return null;const missing=Object.keys(v.components).filter(slot=>!build[slot]);
 if(missing.length)return {ready:false,reason:'Fit '+missing.join(', ')};
 for(const id of Object.values(build)){const p=find(id);if(!p)return {ready:false,reason:'Unknown component'};const f=vehicleFit(build,p);if(f?.status==='no')return {ready:false,reason:f.reason}}
 return {ready:true};
}
export function vehicleStats(build){
 const v=prototypeFor(build.frame);if(!v)return null;
 const find=globalThis.__WK_PART__,ready=vehicleReady(build,find),mass=Object.values(build).reduce((n,id)=>n+(find(id)?.kg||0),0),motor=find(build.motor),fork=find(build.suspension),shock=find(build.shock),power=ready.ready?(motor?.w||0):0;
 return {P:power,nm:power?motor.nm:0,speed:power?v.speed:0,range:power?v.range:0,kg:mass,wheelie:power?65:0,air:55,trick:v.vehicleClass==='escooter'?65:48,wb:v.wb,comH:v.comH,comBack:v.comBack,travel:fork?.travel||0,shock:shock?.travel||0,damp:fork?.damp||.3,grip:find(build.tyres)?.grip||1,warn:ready.ready?[]:[{t:ready.reason,bad:true}],powertrain:v.powertrain,cc:v.cc,fuelLitres:find(build.fuel_tank)?.litres||0};
}
globalThis.__WK_VEHICLE_STATS__=vehicleStats;
