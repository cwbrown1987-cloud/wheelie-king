// Wheelie King's custom-physics arcade assistant.
// This module does NOT run Jolt and does NOT move the bike or own collisions.
// It supplies bounded handling hints to the existing ride-physics.js and ride-freeroam.js.
const clamp=(value,low=0,high=1)=>Math.max(low,Math.min(high,Number.isFinite(value)?value:low));
const angle=value=>Math.atan2(Math.sin(value),Math.cos(value));
export const ARCADE_PRESETS=Object.freeze({
  original:Object.freeze({steering:0,grip:0,balance:0,wheelie:0,stoppie:0,air:0,landing:0,camera:0}),
  balanced:Object.freeze({steering:.32,grip:.22,balance:.34,wheelie:.20,stoppie:.18,air:.38,landing:.35,camera:.30}),
  arcade:Object.freeze({steering:.72,grip:.56,balance:.72,wheelie:.42,stoppie:.40,air:.82,landing:.75,camera:.65})
});
export const ARCADE_KEYS=Object.freeze(Object.keys(ARCADE_PRESETS.original));
const sanitise=value=>Object.fromEntries(ARCADE_KEYS.map(key=>[key,clamp(Number(value?.[key]))]));
const terrainHeight=(ter,x,z)=>typeof ter?.height==='function'?ter.height(x,z):
  typeof ter?.h==='function'?ter.h(x):0;
const terrainSlope=(ter,x,z,yaw)=>typeof ter?.slopeAt==='function'?ter.slopeAt(x,z,yaw):
  typeof ter?.slope==='function'?ter.slope(x):0;

// Uses the SAME terrain functions as the custom wheel-contact solver.
// Predicts an approximate COM crossing, not a collision or guaranteed landing.
export function predictRideLanding(s={},bike={},ter={},maxTime=1.3){
  if(!Number.isFinite(s.y)||!Number.isFinite(s.vx)||!Number.isFinite(s.vy))return null;
  const yaw=Number.isFinite(s.moveYaw)?s.moveYaw:(s.yaw||0);
  const speed=s.vx||0, comH=bike.comH??.9, x=s.x||0,z=s.z||0;
  for(let t=.06;t<=maxTime+.001;t+=.06){
    const px=x+Math.cos(yaw)*speed*t,pz=z+Math.sin(yaw)*speed*t;
    const py=s.y+(s.vy||0)*t-4.905*t*t;
    if(py<=terrainHeight(ter,px,pz)+comH && (s.vy||0)-9.81*t<0){
      return {time:t,x:px,z:pz,y:terrainHeight(ter,px,pz),pitch:clamp(terrainSlope(ter,px,pz,yaw),-1.3,1.3)};
    }
  }
  return null;
}
export function classifyRide(s={},prediction=null){
  if(s.crashed)return 'CRASH';
  const rear=!!s.ground?.[0],front=!!s.ground?.[1];
  if(rear&&!front)return 'WHEELIE';
  if(front&&!rear)return 'STOPPIE';
  if(rear&&front)return s.sliding||s.drift?'DRIFT':'GROUND';
  return prediction && prediction.time<.68 && (s.vy||0)<0?'LANDING':'AIR';
}
export function createArcadeAssistant({mode='original',custom=null}={}){
  let selected=ARCADE_PRESETS[mode]||mode==='custom'?mode:'original';
  let userSettings=sanitise(custom||ARCADE_PRESETS.balanced);
  let state='GROUND',lastState='GROUND',elapsed=0,prediction=null,predictAge=Infinity,assist=null,flightTrick=false;
  function reset(){state=lastState='GROUND';elapsed=0;prediction=null;predictAge=Infinity;assist=null;flightTrick=false;}
  function getMode(){return selected;}
  function getSettings(){return {...(selected==='custom'?userSettings:ARCADE_PRESETS[selected])};}
  function setMode(next){if(next!=='custom'&&!ARCADE_PRESETS[next])return false;if(next!==selected)reset();selected=next;return true;}
  function setSetting(key,value){
    if(!ARCADE_KEYS.includes(key))return false;
    if(selected!=='custom')userSettings=getSettings();
    userSettings[key]=clamp(Number(value));selected='custom';return true;
  }
  function setCustom(settings){userSettings=sanitise(settings);setMode('custom');}
  function update(s,p,input,dt,ter){
    const delta=clamp(dt,0,.05);
    const grounded=!!(s.ground?.[0]||s.ground?.[1]);
    if(grounded){prediction=null;predictAge=Infinity;flightTrick=false;}
    else if(Math.abs(input.lean||0)>.65 || Math.abs(s.airRot||0)>1.25 ||
      input.trick||input.whip||input.tailwhip||input.barspin){
      // Once a flip or intentional spin starts, hands-off landing assistance must not
      // unexpectedly unwind the player's trick after the controls are released.
      flightTrick=true;
    }
    else {
      predictAge+=delta;
      if(predictAge>=.045){prediction=predictRideLanding(s,p,ter);predictAge=0;}
      else if(prediction)prediction={...prediction,time:Math.max(0,prediction.time-delta)};
    }
    state=classifyRide(s,prediction);
    if(state!==lastState){elapsed=0;lastState=state;}else elapsed+=delta;
    if(selected==='original'){assist=null;return input;} // exact classic pass-through
    const settings=getSettings();
    const intentionalPitch=flightTrick||Math.abs(input.lean||0)>.15||Math.abs(s.w||0)>3.0;
    const landing=state==='LANDING'&&!intentionalPitch&&prediction;
    const proximity=landing?clamp((.68-prediction.time)/.55):0;
    const targetPitch=landing?angle(prediction.pitch||0):null;
    assist={
      // Existing vehicle and wheel-contact maths remain authoritative.
      steerTau:.1*(1-.26*settings.steering),
      gripG:1.6*(1+.07*settings.grip),
      leanTau:.15*(1-.20*settings.balance),
      slideHook:.5*(1+.12*settings.grip),
      airYawFactor:1+.45*settings.air,
      vertYawFactor:1+.18*settings.air,
      airPitchFactor:1+.45*settings.air,
      airLevelFactor:1+.30*settings.balance,
      wheelie:settings.wheelie,
      stoppie:settings.stoppie,
      landingStrength:landing?settings.landing*proximity:0,
      landingTargetPitch:targetPitch,
      landingTolerance:.10*settings.landing,
      camera:settings.camera,
    };
    return {...input,arcade:assist};
  }
  function snapshot(){return {mode:selected,state,stateTime:elapsed,settings:getSettings(),
    prediction:prediction?{...prediction}:null,flightTrick,assistance:assist?{...assist}:null};}
  return {update,reset,snapshot,getMode,getSettings,setMode,setSetting,setCustom};
}
