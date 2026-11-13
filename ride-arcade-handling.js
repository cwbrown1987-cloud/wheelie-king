// Wheelie King arcade assistance coordinator. Pure JS: no DOM, Jolt, Three.js or storage.
// This module never moves a rigid body. Jolt owns all forces and collision.
// Original mode passes the caller's inputs through unchanged.
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
const smooth = (dt, rate) => 1 - Math.exp(-clamp(dt, 0, 0.1) * rate);
export const HANDLING_PRESETS = Object.freeze({
  original: Object.freeze({steering:0,balance:0,grip:0,air:0,landing:0,wheelie:0}),
  balanced: Object.freeze({steering:0.38,balance:0.35,grip:0.32,air:0.20,landing:0.35,wheelie:0.18}),
  arcade: Object.freeze({steering:0.70,balance:0.70,grip:0.65,air:0.55,landing:0.75,wheelie:0.36}),
});
const KEYS = Object.keys(HANDLING_PRESETS.original);
const clampSettings = settings => Object.fromEntries(KEYS.map(key => [key,clamp(Number(settings?.[key]))]));
export function classifyRide(s = {}, input = {}, terrain = null, bike = {}) {
  if(s.crashed)return 'CRASH';
  const rear=Boolean(s.ground?.[0]),front=Boolean(s.ground?.[1]);
  if(rear&&!front)return 'WHEELIE';
  if(front&&!rear)return 'STOPPIE';
  if(rear&&front)return s.drift?'DRIFT':'GROUND';
  const height=terrain?.height?.(s.x||0,s.z||0) ?? terrain?.h?.(s.x||0) ?? 0;
  const clearance=(s.y??0)-height-(bike.comH??0.9);
  return (s.vy||0)<-0.25&&clearance<2.5?'LANDING':'AIR';
}
export function createArcadeHandling({mode='original',custom=null}={}) {
  let currentMode=(HANDLING_PRESETS[mode]||mode==='custom')?mode:'original';
  let customSettings=clampSettings(custom||HANDLING_PRESETS.balanced);
  let smoothedSteer=0,lastMode=currentMode,lastState='GROUND',stateAge=0,lastAssist=null,lastRawSteer=0;
  const getMode=()=>currentMode;
  const getSettings=()=>({...((currentMode==='custom')?customSettings:HANDLING_PRESETS[currentMode])});
  function setMode(value){
    if(value!=='custom'&&!HANDLING_PRESETS[value])return false;
    if(value!==currentMode){smoothedSteer=0;stateAge=0;}
    currentMode=value;return true;
  }
  function setSetting(key,value){
    if(!KEYS.includes(key))return false;
    if(currentMode!=='custom')customSettings=getSettings();
    customSettings[key]=clamp(Number(value));
    setMode('custom');return true;
  }
  function setCustom(settings){customSettings=clampSettings(settings);setMode('custom');}
  function reset(){smoothedSteer=0;lastRawSteer=0;lastAssist=null;lastState='GROUND';stateAge=0;}
  function prepareInput(s,input,dt,terrain,bike){
    const state=classifyRide(s,input,terrain,bike);
    if(lastState!==state){lastState=state;stateAge=0;}else stateAge+=clamp(dt,0,0.1);
    lastRawSteer=input.steer||0;
    if(currentMode==='original'){
      smoothedSteer=lastRawSteer;lastAssist=null;lastMode=currentMode;
      return input; // important for exact before/after regression comparison
    }
    const settings=getSettings();
    if(lastMode==='original')smoothedSteer=lastRawSteer;
    lastMode=currentMode;
    // Jolt already limits full-lock steering at speed. Add only a small input filter.
    const tau=0.065+(1-settings.steering)*0.06;
    smoothedSteer+=(lastRawSteer-smoothedSteer)*smooth(dt,1/tau);
    const intentionalTrick=(state==='AIR'||state==='LANDING')&&
      (Math.abs(input.lean||0)>0.85||Boolean(input.trick||input.whip||input.tailwhip||input.barspin));
    const approach=state==='LANDING'?Math.min(1,stateAge/0.12+0.35):0;
    const arc={
      steeringRate:4+settings.steering*2.5,
      lateralG:0.9+settings.grip*0.24,
      rearGripRetention:settings.grip*0.14,
      wheelieBalance:1+settings.wheelie*0.25,
      airPitchFactor:intentionalTrick?1:1+settings.air*0.28+approach*settings.landing*0.18,
      airRollFactor:intentionalTrick?0.2:1+settings.balance*0.30+approach*settings.landing*0.55,
      trickIntent:intentionalTrick
    };
    lastAssist=arc;
    return {...input,steer:smoothedSteer,arcade:arc};
  }
  function snapshot(){
    return {mode:currentMode,settings:getSettings(),state:lastState,stateTime:stateAge,
      rawSteer:lastRawSteer,smoothedSteer,assistance:lastAssist?{...lastAssist}:null};
  }
  return {getMode,getSettings,setMode,setSetting,setCustom,prepareInput,reset,snapshot};
}
